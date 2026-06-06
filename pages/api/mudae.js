export default async function handler(req, res) {
  const { name, series: seriesHint, info } = req.query;
  if (!name) return res.status(400).end();

  // 1. CLEANING: Remove everything except standard letters/numbers for the search
  const cleanName = name.replace(/\(.*\)/g, '').replace(/[^\x00-\x7F]/gu, '').trim();
  const searchName = cleanName.replace(/\s+/g, ''); // Variations (OMGkawaiiAngel-chan)
  const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0' };

  try {
    let img = "";
    let series = seriesHint || "Unknown Series";
    let gender = "none";

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

    // SEARCH PRIORITY: 
    // 1. Name without spaces (Fixes Angel-chan)
    // 2. Name as is
    // 3. Name + Series
    let charData = await fetchAniList(searchName);
    if (!charData) charData = await fetchAniList(cleanName);
    if (!charData && seriesHint) charData = await fetchAniList(`${cleanName} ${seriesHint}`);

    if (charData) {
      img = charData.image.large;
      gender = charData.gender?.toLowerCase() || "none";
      if (series === "Unknown Series") series = charData.media.nodes[0]?.title.userPreferred;
    }

    // 3. MAL FALLBACK (If AniList fails)
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

    // 4. PROXY IMAGE (Fixes broken icons)
    const finalImg = (!img || img.includes('questionmark')) 
      ? `https://via.placeholder.com/225x350?text=${encodeURIComponent(cleanName)}` 
      : img;

    const imageRes = await fetch(finalImg, { headers });
    const buffer = Buffer.from(await imageRes.arrayBuffer());
    
    res.setHeader('Content-Type', imageRes.headers.get('content-type') || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, s-maxage=31536000, immutable');
    return res.send(buffer);

  } catch (e) { 
    return res.status(200).json({ series: seriesHint || "Unknown Series", img: "", gender: "none" }); 
  }
}
