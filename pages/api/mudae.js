export default async function handler(req, res) {
  const { name, info } = req.query;
  if (!name) return res.status(400).end();

  // Basic Clean: No emojis, no Mudae tags like (BP)
  const baseClean = name
    .replace(/\(.*\)/g, '')          
    .replace(/[^\x00-\x7F]/gu, '')   
    .trim();

  // STUBBORN SEARCH VARIATIONS
  const variations = [
    baseClean,                                      // 1. "OMGkawaii Angel-chan"
    baseClean.replace(/\s+/g, ''),                  // 2. "OMGkawaiiAngel-chan" (Fixes the space trap)
    baseClean.split(' ').slice(-2).join(' ')        // 3. "Angel-chan" (Takes core name only)
  ];

  const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36' };

  const fetchFromAniList = async (term) => {
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
      return data.data?.Character ? {
        img: data.data.Character.image.large,
        series: data.data.Character.media.nodes[0]?.title.userPreferred || "Unknown"
      } : null;
    } catch (e) { return null; }
  };

  try {
    let result = null;

    // Try each variation until one works
    for (const term of variations) {
      if (term.length < 2) continue; // Skip single letters
      result = await fetchFromAniList(term);
      if (result) break; 
    }

    // FINAL FALLBACK: If AniList totally fails, try a direct Jikan (MAL) search
    if (!result) {
      try {
        const malRes = await fetch(`https://api.jikan.moe/v4/characters?q=${encodeURIComponent(variations[0])}&limit=1`, { headers });
        const malData = await malRes.json();
        if (malData.data?.[0]) {
          result = {
            img: malData.data[0].images.jpg.image_url,
            series: "Unknown (Found on MAL)" 
          };
        }
      } catch (e) {}
    }

    if (info) return res.status(200).json(result || { series: "Unknown Series", img: "" });

    // Serve Image
    const finalImg = (result?.img && !result.img.includes('questionmark')) 
      ? result.img 
      : `https://via.placeholder.com/225x350?text=${encodeURIComponent(baseClean)}`;
      
    const imageRes = await fetch(finalImg, { headers });
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, s-maxage=31536000, immutable');
    return res.send(Buffer.from(await imageRes.arrayBuffer()));
    
  } catch (e) { 
    return res.status(200).json({ series: "Unknown Series", img: "" }); 
  }
}
