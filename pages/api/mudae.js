export default async function handler(req, res) {
  const { name, info } = req.query;
  if (!name) return res.status(400).end();

  // 1. CLEANING FOR SEARCH: We keep your name in the UI, but search with a clean string
  const clean = name
    .replace(/\(.*\)/g, '')          // Removes (BP), (KAC), (ENS)
    .replace(/[^\x00-\x7F]/gu, '')   // Removes ALL emojis
    .trim()
    .replace(/\s+/g, ' ');

  const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36' };

  try {
    let img = "";
    let series = "Unknown Series";

    // --- STEP A: TRY JIKAN (MYANIMELIST) --- 
    // This is the most reliable way to find characters by name
    try {
      const jikanRes = await fetch(`https://api.jikan.moe/v4/characters?q=${encodeURIComponent(clean)}&limit=1`, { headers });
      const jikanData = await jikanRes.json();
      if (jikanData.data && jikanData.data.length > 0) {
        const char = jikanData.data[0];
        img = char.images.jpg.image_url;
        // Jikan doesn't give "Series" directly in the char object easily, so we fallback to AniList for series name
      }
    } catch (e) { console.error("Jikan Failed"); }

    // --- STEP B: TRY ANILIST (For Series Name and Fallback Image) ---
    if (!img || series === "Unknown Series") {
      try {
        const aniRes = await fetch('https://graphql.anilist.co', {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            query: `query($s:String){Character(search:$s){image{large}media(perPage:1){nodes{title{userPreferred}}}}} `, 
            variables: { s: clean } 
          })
        });
        const ani = await aniRes.json();
        if (ani.data?.Character) {
          if (!img) img = ani.data.Character.image.large;
          series = ani.data.Character.media.nodes[0]?.title.userPreferred || "Unknown Series";
        }
      } catch (e) { console.error("AniList Failed"); }
    }

    // --- STEP C: TRY MUDAE WIKI (Last Resort) ---
    if (!img) {
      try {
        const wikiRes = await fetch(`https://mudae.net/wiki/search?term=${encodeURIComponent(clean)}`, { headers });
        const html = await wikiRes.text();
        img = html.match(/https:\/\/mudae\.net\/uploads\/char\/[^"]+/)?.[0] || "";
        const sMatch = html.match(/<a href="\/wiki\/[^"]+">([^<]+)<\/a>/);
        if (series === "Unknown Series" && sMatch) series = sMatch[1];
      } catch (e) { console.error("Mudae Wiki Failed"); }
    }

    // Safety: If after everything we still have nothing
    if (!img) img = `https://via.placeholder.com/225x350?text=${encodeURIComponent(clean)}`;

    if (info) return res.status(200).json({ series, img });

    // Serve Image
    res.setHeader('Cache-Control', 'public, s-maxage=31536000, immutable');
    const imageRes = await fetch(img);
    const buffer = Buffer.from(await imageRes.arrayBuffer());
    return res.send(buffer);
    
  } catch (e) { 
    return res.status(200).json({ series: "Unknown Series", img: "" }); 
  }
}
