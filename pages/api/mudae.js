export default async function handler(req, res) {
  const { name, series: seriesHint, info } = req.query;
  if (!name) return res.status(400).end();

  // 1. CLEANING
  const cleanName = name.replace(/\(.*\)/g, '').replace(/[^\x00-\x7F]/gu, '').trim();
  const headers = { 
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
    'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
  };

  try {
    let img = "";
    let series = seriesHint || "Unknown Series";
    let gender = "none";

    // 2. SEARCH STRATEGY: Try just the name first (Most accurate)
    const fetchAniList = async (term) => {
      try {
        const aniRes = await fetch('https://graphql.anilist.co', {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            query: `query($s:String){Character(search:$s){gender image{large}media(perPage:1){nodes{title{userPreferred}}}}} `, 
            variables: { s: term } 
          })
        });
        const data = await aniRes.json();
        return data.data?.Character;
      } catch (e) { return null; }
    };

    let charData = await fetchAniList(cleanName);
    
    // Fallback: Try Name + Series if Name alone fails
    if (!charData && seriesHint && seriesHint !== 'Unknown') {
      charData = await fetchAniList(`${cleanName} ${seriesHint}`);
    }

    if (charData) {
      img = charData.image.large;
      gender = charData.gender?.toLowerCase() || "none";
      if (series === "Unknown Series") series = charData.media.nodes[0]?.title.userPreferred;
    }

    // 3. MAL FALLBACK (If AniList has no image)
    if (!img) {
      try {
        const malRes = await fetch(`https://api.jikan.moe/v4/characters?q=${encodeURIComponent(cleanName)}&limit=1`, { headers });
        const malData = await malRes.json();
        if (malData.data?.[0]) {
          img = malData.data[0].images.jpg.image_url;
        }
      } catch (e) {}
    }

    if (info) return res.status(200).json({ series, img, gender });

    // 4. IMAGE PROXY ENGINE (Ensures images load on all devices)
    const finalImg = (!img || img.includes('questionmark')) 
      ? `https://via.placeholder.com/225x350?text=${encodeURIComponent(cleanName)}` 
      : img;

    const imageRes = await fetch(finalImg, { headers });
    if (!imageRes.ok) throw new Error("Image fetch failed");

    const arrayBuffer = await imageRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Set cache for 1 year to make the site super fast
    res.setHeader('Content-Type', imageRes.headers.get('content-type') || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, s-maxage=31536000, immutable');
    return res.send(buffer);

  } catch (e) { 
    console.error("Scraper Error:", e);
    return res.status(200).json({ series: seriesHint || "Unknown Series", img: "", gender: "none" }); 
  }
}
