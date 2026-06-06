export default async function handler(req, res) {
  const { name, info } = req.query;
  if (!name) return res.status(400).end();

  // DEEP CLEAN: Removes emojis, Mudae tags (BP), and special symbols for searching
  const searchName = name
    .replace(/\(.*\)/g, '')          // Removes (BP), (Alts), (EZ)
    .replace(/[^\x00-\x7F]/gu, '')   // Removes ALL emojis/symbols
    .replace(/[:]/g, '')             // Removes colons
    .trim()
    .replace(/\s+/g, ' ');           // Collapses double spaces

  const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36' };

  try {
    let img = "";
    let series = "Unknown Series";

    // --- STEP 1: ANILIST (Primary - High Speed) ---
    try {
      const aniRes = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: `query($s:String){Character(search:$s){image{large}media(perPage:1){nodes{title{userPreferred}}}}} `, 
          variables: { s: searchName } 
        })
      });
      const ani = await aniRes.json();
      if (ani.data?.Character) {
        img = ani.data.Character.image.large;
        series = ani.data.Character.media.nodes[0]?.title.userPreferred || "Unknown Series";
      }
    } catch (e) {}

    // --- STEP 2: MAL FALLBACK (If AniList failed or series is still Unknown) ---
    if (!img || series === "Unknown Series") {
      try {
        const jikanRes = await fetch(`https://api.jikan.moe/v4/characters?q=${encodeURIComponent(searchName)}&limit=1`, { headers });
        const jikanData = await jikanRes.json();
        if (jikanData.data?.length > 0) {
          const char = jikanData.data[0];
          img = img || char.images.jpg.image_url;
          // Get Series from MAL
          const fullRes = await fetch(`https://api.jikan.moe/v4/characters/${char.mal_id}/full`, { headers });
          const fullData = await fullRes.json();
          if (series === "Unknown Series") {
            series = fullData.data.anime?.[0]?.anime?.title || fullData.data.manga?.[0]?.manga?.title || "Unknown Series";
          }
        }
      } catch (e) {}
    }

    // --- STEP 3: MUDAE WIKI (Last Resort) ---
    if (!img || series === "Unknown Series") {
      try {
        const wikiRes = await fetch(`https://mudae.net/wiki/search?term=${encodeURIComponent(searchName)}`, { headers });
        const html = await wikiRes.text();
        const wikiImg = html.match(/https:\/\/mudae\.net\/uploads\/char\/[^"]+/)?.[0];
        if (wikiImg) img = wikiImg;
        const sMatch = html.match(/<a href="\/wiki\/[^"]+">([^<]+)<\/a>/);
        if (series === "Unknown Series" && sMatch && !sMatch[1].includes('Wiki')) series = sMatch[1];
      } catch (e) {}
    }

    // FINAL CLEANUP: Prevent MAL placeholders
    if (img.includes('questionmark_23')) img = "";

    if (info) return res.status(200).json({ series, img });

    // PROXY IMAGE SERVICE
    const finalImg = img || `https://via.placeholder.com/225x350?text=${encodeURIComponent(searchName)}`;
    const imageRes = await fetch(finalImg, { headers });
    const buffer = Buffer.from(await imageRes.arrayBuffer());
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, s-maxage=31536000, immutable');
    return res.send(buffer);
  } catch (e) { return res.status(200).json({ series: "Unknown Series", img: "" }); }
}
