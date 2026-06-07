import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';

// ─── File-persisted cache ───────────────────────────────────────────────────
const CACHE = new Map();
const CACHE_FILE = path.join(process.cwd(), '.mudae_cache.json');

try {
  if (fs.existsSync(CACHE_FILE)) {
    const data = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
    for (const [key, val] of Object.entries(data)) {
      // Handle both old schema { image: { large } } and new schema { img, series, gender }
      let normalizedVal = val;
      if (val && val.image && val.image.large) {
         normalizedVal = {
           img: val.image.large,
           gender: val.gender || 'none',
           series: val.media?.nodes?.[0]?.title?.userPreferred || 'Unknown Series'
         };
      }
      CACHE.set(key, { value: normalizedVal, ts: Date.now(), ttl: 30 * 24 * 60 * 60 * 1000 });
    }
  }
} catch (e) {
  console.error('Failed to load cache:', e);
}

const CACHE_HIT_TTL  = 30 * 24 * 60 * 60 * 1000; // 30 days
const CACHE_MISS_TTL =  5 * 60 * 1000; // 5 mins

function cacheGet(key) {
  const entry = CACHE.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.ts > entry.ttl) { CACHE.delete(key); return undefined; }
  return entry.value; 
}

function cacheSet(key, value, ttl) {
  CACHE.set(key, { value, ts: Date.now(), ttl });
  
  // Persist to disk on successful hits to save API calls across restarts
  if (value && value.img) {
    try {
      const toSave = {};
      for (const [k, v] of CACHE.entries()) {
        if (v.value && v.value.img) toSave[k] = v.value;
      }
      fs.writeFileSync(CACHE_FILE, JSON.stringify(toSave, null, 2));
    } catch (e) {
      console.error('Failed to save cache to disk:', e);
    }
  }
}

// ─── Fetch with hard timeout ──────────────────────────────────────────────────
async function timedFetch(url, opts = {}, ms = 5000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(id);
  }
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0 Safari/537.36';
const HEADERS = { 'User-Agent': UA, 'Accept': '*/*' };

// Loose word-level series match
function seriesMatches(found, hint) {
  if (!hint || hint === 'Unknown Series' || hint === 'Unknown') return true;
  const f = (found || '').toLowerCase();
  return hint.toLowerCase().split(/\s+/).filter(w => w.length > 2).some(w => f.includes(w));
}

// ─── AniList: top-5 candidates, pick best series match ───────────────────────
let anilistQueue = Promise.resolve();
async function fetchAniList(term, seriesHint) {
  const p = anilistQueue.then(async () => {
    await new Promise(r => setTimeout(r, 300)); // ~1.4 req/sec throttle (90/min limit)
    try {
      const r = await timedFetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { ...HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `query($s:String){Page(perPage:5){characters(search:$s){id gender image{large}media(perPage:3){nodes{title{userPreferred}}}}}}`,
          variables: { s: term }
        })
      }, 6000);

      if (r.status === 429) return 'rate_limited';
      if (!r.ok) return null;

      const data = await r.json();
      const candidates = data.data?.Page?.characters || [];
      if (!candidates.length) return null;

      const best =
        candidates.find(c => c.media?.nodes?.some(n => seriesMatches(n.title?.userPreferred, seriesHint))) ||
        candidates[0];

      const large = best?.image?.large || '';
      if (!large || large.includes('questionmark') || large.includes('default')) return null;
      return { image: { large }, gender: best.gender, media: best.media };
    } catch {
      return null;
    }
  });
  anilistQueue = p.catch(() => {});
  return p;
}

// ─── Mudae Fandom Wiki ────────────────────────────────────────────────────────
async function fetchMudaeWiki(term, seriesHint) {
  try {
    const seriesPart = seriesHint && seriesHint !== 'Unknown Series' ? `"${seriesHint}"` : '';
    const query = encodeURIComponent(`"${term}" ${seriesPart}`.trim());
    const searchUrl = `https://mudae.fandom.com/api.php?action=query&list=search&srsearch=${query}&utf8=&format=json&origin=*`;
    
    const sr = await timedFetch(searchUrl, { headers: HEADERS }, 6000);
    if (!sr.ok) return null;
    const searchData = await sr.json();
    
    if (!searchData.query?.search || searchData.query.search.length === 0) {
        return null;
    }
    
    let pageTitle = null;
    for (const result of searchData.query.search) {
        const title = result.title.toLowerCase();
        // Skip generic fandom pages
        if (title.includes('list of') || title.includes(' games') || title.includes('bundles')) continue;
        
        // Ensure the title or snippet is somewhat relevant
        const snippet = (result.snippet || '').toLowerCase();
        const termLower = term.toLowerCase();
        
        if (title.includes(termLower) || snippet.includes(termLower)) {
            pageTitle = result.title;
            break;
        }
    }
    
    if (!pageTitle) return null;
    
    const htmlUrl = `https://mudae.fandom.com/wiki/${encodeURIComponent(pageTitle)}`;
    const hr = await timedFetch(htmlUrl, { headers: HEADERS }, 9000);
    if (!hr.ok) return null;
    const html = await hr.text();
    
    const $ = cheerio.load(html);
    const imageUrl = $('aside.portable-infobox img').attr('src');
    
    if (!imageUrl) return null;
    
    // Check series strictness to avoid wrong images for aliases/typos
    if (seriesHint && seriesHint !== 'Unknown Series') {
        // Scope to categories, infobox, and first paragraph to avoid false positives in huge pages
        const text = $('aside.portable-infobox, .page-header__categories, .mw-parser-output > p').text().toLowerCase();
        const seriesWords = seriesHint.toLowerCase().split(' ').filter(w => w.length > 2);
        if (seriesWords.length > 0) {
            const hasSeries = seriesWords.some(w => text.includes(w));
            if (!hasSeries) return null; // Wrong character/series
        }
    }
    
    const cleanImageUrl = imageUrl.split('/revision/latest')[0];
    
    return {
      image: { large: cleanImageUrl },
      gender: 'none',
      media: { nodes: [{ title: { userPreferred: pageTitle } }] }
    };
  } catch {
    return null;
  }
}

// ─── Series-Specific Fandom Wiki ──────────────────────────────────────────────
async function fetchSeriesFandom(term, seriesHint) {
  if (!seriesHint || seriesHint === 'Unknown Series') return null;
  try {
    const subdomain = seriesHint.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const query = encodeURIComponent(`"${term}"`);
    const searchUrl = `https://${subdomain}.fandom.com/api.php?action=query&list=search&srsearch=${query}&utf8=&format=json&origin=*`;
    
    const sr = await timedFetch(searchUrl, { headers: HEADERS }, 5000);
    if (!sr.ok) return null;
    const searchData = await sr.json();
    
    if (!searchData.query?.search || searchData.query.search.length === 0) return null;
    
    let pageTitle = null;
    for (const result of searchData.query.search) {
        const title = result.title.toLowerCase();
        if (title.includes('list of') || title.includes(' games') || title.includes('bundles')) continue;
        pageTitle = result.title;
        break;
    }
    if (!pageTitle) return null;
    
    const htmlUrl = `https://${subdomain}.fandom.com/wiki/${encodeURIComponent(pageTitle)}`;
    const hr = await timedFetch(htmlUrl, { headers: HEADERS }, 6000);
    if (!hr.ok) return null;
    const html = await hr.text();
    
    const $ = cheerio.load(html);
    const imageUrl = $('aside.portable-infobox img').attr('src');
    if (!imageUrl) return null;
    
    const cleanImageUrl = imageUrl.split('/revision/latest')[0];
    return {
      image: { large: cleanImageUrl },
      gender: 'none',
      media: { nodes: [{ title: { userPreferred: seriesHint } }] }
    };
  } catch {
    return null;
  }
}

// ─── Jikan / MyAnimeList ──────────────────────────────────────────────────────
async function fetchJikan(term, seriesHint) {
  try {
    const r = await timedFetch(
      `https://api.jikan.moe/v4/characters?q=${encodeURIComponent(term)}&limit=5`,
      { headers: HEADERS },
      6000
    );
    if (!r.ok) return null;
    const data = await r.json();
    const chars = data.data || [];

    const valid = chars.filter(c => {
      const name = c.name.toLowerCase();
      const t = term.toLowerCase();
      // Ensure strict match (either exact, or term is fully contained in name, OR name has parts that match term heavily)
      return name === t || name.includes(t) || c.nicknames?.some(n => n.toLowerCase() === t);
    });

    const best = valid[0];
    if (!best) return null;
    const imgUrl = best.images?.jpg?.image_url || best.images?.webp?.image_url || '';
    if (!imgUrl || imgUrl.includes('questionmark') || imgUrl.includes('default')) return null;
    return {
      image: { large: imgUrl },
      gender: 'none',
      media: { nodes: [{ title: { userPreferred: 'Unknown Series' } }] }
    };
  } catch {
    return null;
  }
}

// ─── Wikimedia Commons image search (lightweight, no auth required) ───────────
async function fetchWikimedia(term, seriesHint) {
  try {
    // Search Wikipedia for the character name, then get page images
    const query = encodeURIComponent(term + ' ' + (seriesHint && seriesHint !== 'Unknown Series' ? seriesHint : 'character'));
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${query}&srlimit=3&format=json&origin=*`;
    const sr = await timedFetch(searchUrl, { headers: HEADERS }, 5000);
    if (!sr.ok) return null;
    const searchData = await sr.json();
    
    let hit = null;
    for (const r of (searchData.query?.search || [])) {
        if (r.title.toLowerCase().includes(term.toLowerCase()) || (r.snippet || '').toLowerCase().includes(term.toLowerCase())) {
            hit = r;
            break;
        }
    }
    if (!hit) return null;

    const imgUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(hit.title)}&prop=pageimages&pithumbsize=400&format=json&origin=*`;
    const ir = await timedFetch(imgUrl, { headers: HEADERS }, 5000);
    if (!ir.ok) return null;
    const imgData = await ir.json();
    const pages = Object.values(imgData.query?.pages || {});
    const thumb = pages[0]?.thumbnail?.source;
    if (!thumb) return null;
    return {
      image: { large: thumb },
      gender: 'none',
      media: { nodes: [{ title: { userPreferred: hit.title } }] }
    };
  } catch {
    return null;
  }
}

// ─── Wikimedia Commons (Loose Fallback for typos) ─────────────────────────────
async function fetchWikimediaLoose(term) {
  try {
    const query = encodeURIComponent(term + ' character');
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${query}&srlimit=1&format=json&origin=*`;
    const sr = await timedFetch(searchUrl, { headers: HEADERS }, 5000);
    if (!sr.ok) return null;
    const searchData = await sr.json();
    const hit = searchData.query?.search?.[0];
    if (!hit) return null;

    const imgUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(hit.title)}&prop=pageimages&pithumbsize=400&format=json&origin=*`;
    const ir = await timedFetch(imgUrl, { headers: HEADERS }, 5000);
    if (!ir.ok) return null;
    const imgData = await ir.json();
    const pages = Object.values(imgData.query?.pages || {});
    const thumb = pages[0]?.thumbnail?.source;
    if (!thumb) return null;
    return {
      image: { large: thumb },
      gender: 'none',
      media: { nodes: [{ title: { userPreferred: hit.title } }] }
    };
  } catch {
    return null;
  }
}

// ─── Mudae.net (Cloudflare-protected fallback) ───────────────────────────────
async function fetchMudaeNet(term, seriesHint) {
  try {
    const q = seriesHint && seriesHint !== 'Unknown Series' ? `${term} ${seriesHint}` : term;
    const r = await timedFetch(`https://mudae.net/search?q=${encodeURIComponent(q)}`, { headers: HEADERS }, 5000);
    if (!r.ok) return null;
    const html = await r.text();
    const imgMatch = html.match(/<img[^>]+src="([^">]+)"[^>]*alt="([^">]*)"/i);
    if (!imgMatch || !imgMatch[2].toLowerCase().includes(term.toLowerCase())) return null;
    const src = imgMatch[1].startsWith('http') ? imgMatch[1] : `https://mudae.net${imgMatch[1]}`;
    return {
      image: { large: src },
      gender: 'none',
      media: { nodes: [{ title: { userPreferred: 'Mudae.net' } }] }
    };
  } catch { return null; }
}

// ─── Google Image Search (Absolute Last Resort) ──────────────────────────────
async function fetchGoogleImage(term, seriesHint) {
  try {
    const q = seriesHint && seriesHint !== 'Unknown Series' ? `${term} ${seriesHint}` : term;
    const url = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(q)}`;
    const r = await timedFetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, 6000);
    if (!r.ok) return null;
    const html = await r.text();
    const $ = cheerio.load(html);
    
    let imgUrl = null;
    $('img').each((i, el) => {
        const src = $(el).attr('src');
        if (src && src.startsWith('https://encrypted-tbn0.gstatic.com/')) {
            imgUrl = src;
            return false; // break loop
        }
    });
    
    if (!imgUrl) return null;
    
    return {
      image: { large: imgUrl },
      gender: 'none',
      media: { nodes: [{ title: { userPreferred: seriesHint !== 'Unknown Series' ? seriesHint : 'Google Search' } }] }
    };
  } catch {
    return null;
  }
}

// ─── Mudae Fandom Wiki (Loose Fallback) ───────────────────────────────────────
async function fetchMudaeWikiLoose(term) {
  try {
    const query = encodeURIComponent(`"${term}"`);
    const searchUrl = `https://mudae.fandom.com/api.php?action=query&list=search&srsearch=${query}&utf8=&format=json&origin=*`;
    
    const sr = await timedFetch(searchUrl, { headers: HEADERS }, 6000);
    if (!sr.ok) return null;
    const searchData = await sr.json();
    
    if (!searchData.query?.search || searchData.query.search.length === 0) return null;
    
    let pageTitle = null;
    for (const result of searchData.query.search) {
        const title = result.title.toLowerCase();
        if (title.includes('list of') || title.includes(' games') || title.includes('bundles')) continue;
        pageTitle = result.title;
        break;
    }
    if (!pageTitle) return null;
    
    const htmlUrl = `https://mudae.fandom.com/wiki/${encodeURIComponent(pageTitle)}`;
    const hr = await timedFetch(htmlUrl, { headers: HEADERS }, 6000);
    if (!hr.ok) return null;
    const html = await hr.text();
    
    const $ = cheerio.load(html);
    const imageUrl = $('aside.portable-infobox img').attr('src') || $('img').attr('src');
    if (!imageUrl) return null;
    
    const cleanImageUrl = imageUrl.split('/revision/latest')[0];
    return {
      image: { large: cleanImageUrl },
      gender: 'none',
      media: { nodes: [{ title: { userPreferred: pageTitle } }] }
    };
  } catch {
    return null;
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  const { name, series: seriesHint, proxy } = req.query;
  if (!name) return res.status(400).end();
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  const cleanName   = name.replace(/\(.*\)/g, '').replace(/[^\x00-\x7F]/gu, '').trim();
  const cleanSeries = (seriesHint || '').replace(/[^\x00-\x7F]/gu, '').trim();
  const cacheKey    = `${cleanName}||${cleanSeries}`;

  // ─── Cache hit (including known misses) ──────────────────────────────────
  const cached = cacheGet(cacheKey);
  if (cached !== undefined) {
    if (proxy === '1' && cached?.img) {
      try {
        const imgRes = await timedFetch(cached.img, { headers: HEADERS }, 8000);
        if (imgRes.ok) {
          res.setHeader('Content-Type', imgRes.headers.get('content-type') || 'image/jpeg');
          return res.send(Buffer.from(await imgRes.arrayBuffer()));
        }
      } catch { /* fall through to JSON */ }
    }
    return res.status(200).json(cached ?? { series: cleanSeries || 'Unknown Series', img: '', gender: 'none' });
  }

  // Build name variants to try
  const spacedName  = cleanName.replace(/([a-z])([A-Z])/g, '$1 $2');
  const noHonorific = cleanName.replace(/[\s-]?(chan|kun|san|sama|dono|senpai|sensei)$/i, '');
  const namesToTry  = [...new Set([cleanName, spacedName, noHonorific])];

  try {
    let img = '', series = cleanSeries || 'Unknown Series', gender = 'none';
    let charData = null;
    let rateLimited = false;

    // ── Round 1: Series Fandom vs AniList vs Mudae Wiki (parallel) ────────
    for (const n of namesToTry) {
      const [sf, al, mw] = await Promise.all([
        fetchSeriesFandom(n, cleanSeries),
        fetchAniList(n, cleanSeries),
        fetchMudaeWiki(n, cleanSeries)
      ]);
      if (al === 'rate_limited') rateLimited = true;
      const result = sf || (al && al !== 'rate_limited' ? al : mw);
      if (result) { charData = result; break; }
    }

    // ── Round 2: Jikan / MyAnimeList ──────────────────────────────────────
    if (!charData) {
      for (const n of namesToTry) {
        charData = await fetchJikan(n, cleanSeries);
        if (charData) break;
      }
    }

    // ── Round 3: Wikimedia Commons (last resort before giving up) ─────────
    if (!charData) {
      for (const n of namesToTry) {
        charData = await fetchWikimedia(n, cleanSeries);
        if (charData) break;
      }
    }

    // ── Round 4: Loose Fallbacks
    if (!charData) {
      for (const n of namesToTry) {
        charData = await fetchMudaeNet(n, cleanSeries);
        if (!charData) charData = await fetchMudaeWikiLoose(n);
        if (!charData) charData = await fetchWikimediaLoose(n);
        if (charData) break;
      }
    }

    // ── Round 5: Absolute Last Resort (Google Images) ─────────────────────
    if (!charData) {
      for (const n of namesToTry) {
        charData = await fetchGoogleImage(n, cleanSeries);
        if (charData) break;
      }
    }

    if (charData) {
      img    = charData.image?.large || '';
      gender = charData.gender?.toLowerCase() || 'none';
      const found = charData.media?.nodes?.[0]?.title?.userPreferred;
      if (series === 'Unknown Series' && found && !['Mudae Wiki', 'Unknown Series'].includes(found)) {
        series = found;
      }
    }

    const result = { series, img, gender };

    // Cache: 1 hour on hit; 5 mins on miss; skip if rate-limited (try again sooner)
    if (!rateLimited) {
      cacheSet(cacheKey, img ? result : null, img ? CACHE_HIT_TTL : CACHE_MISS_TTL);
    }

    // Proxy mode: pipe the image bytes through the server
    if (proxy === '1' && img) {
      try {
        const imgRes = await timedFetch(img, { headers: HEADERS }, 8000);
        if (imgRes.ok) {
          res.setHeader('Content-Type', imgRes.headers.get('content-type') || 'image/jpeg');
          return res.send(Buffer.from(await imgRes.arrayBuffer()));
        }
      } catch { /* fall through to JSON */ }
    }

    return res.status(200).json(result);
  } catch {
    return res.status(200).json({ series: 'Unknown Series', img: '', gender: 'none' });
  }
}
