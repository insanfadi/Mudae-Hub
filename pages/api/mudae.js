export default async function handler(req, res) {
  const { name, info } = req.query;
  if (!name) return res.status(400).end();

  // 1. CLEANING: Remove emojis and tags
  const baseClean = name.replace(/\(.*\)/g, '').replace(/[^\x00-\x7F]/gu, '').trim();
  
  // 2. SEARCH VARIATIONS: Original clean name, then NO SPACES (for Angel-chan)
  const variations = [
    baseClean, 
    baseClean.replace(/\s+/g, '') 
  ];

  const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0' };

  const fetchAniList = async (term) => {
    try {
      const res = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: `query($s:String){Character(search:$s){image{large}media(perPage:1){nodes{title{userPreferred}}}}} `, 
          variables: { s: term } 
        })
      });
      const data = await res.json();
      const char = data.data?.Character;
      if (!char) return null;
      
      return {
        img: char.image.large,
        series: char.media.nodes[0]?.title.userPreferred || "Unknown"
      };
    } catch (e) { return null; }
  };

  try {
    let result = null;

    // Try variants (fixes Angel-chan)
    for (const v of variations) {
      result = await fetchAniList(v);
      if (result) break;
    }

    // MAL Fallback if AniList is wrong or missing
    if (!result || result.series.includes('Trash')) {
      const malRes = await fetch(`https://api.jikan.moe/v4/characters?q=${encodeURIComponent(baseClean)}&limit=1`, { headers });
      const malData = await malRes.json();
      if (malData.data?.[0]) {
        const char = malData.data[0];
        const img = char.images.jpg.image_url;
        // Check if image is the MAL placeholder "question mark"
        if (!img.includes('questionmark')) {
          result = { img, series: "Unknown (MAL Match)" };
        }
      }
    }

    if (info) return res.status(200).json(result || { series: "Unknown Series", img: "" });

    // PROXY IMAGE (Prevents MAL logo blocking)
    const finalImg = (result?.img && !result.img.includes('questionmark')) 
      ? result.img 
      : `https://via.placeholder.com/225x350?text=${encodeURIComponent(baseClean)}`;
      
    const imageRes = await fetch(finalImg, { headers });
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, s-maxage=31536000, immutable');
    return res.send(Buffer.from(await imageRes.arrayBuffer()));
    
  } catch (e) { return res.status(200).json({ series: "Unknown Series", img: "" }); }
}
