export default async function handler(req, res) {
  const { name, series: seriesHint, info } = req.query;
  if (!name) return res.status(400).end();

  // 1. CLEANING: Remove emojis and extra tags
  const baseClean = name.replace(/\(.*\)/g, '').replace(/[^\x00-\x7F]/gu, '').trim();
  
  // 2. SEARCH VARIATIONS (Verified for Angel-chan)
  // We try: "OMGkawaiiAngel-chan", then "Angel-chan" (the core name)
  const variations = [
    baseClean,
    baseClean.replace("OMGkawaii", "").trim(),
    "OMGkawaiiAngel-chan"
  ];

  const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0' };

  const fetchAniList = async (term) => {
    try {
      const res = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: `query($s:String){Character(search:$s){gender image{large}media(perPage:1){nodes{title{userPreferred}}}}} `, 
          variables: { s: term } 
        })
      });
      const data = await res.json();
      return data.data?.Character;
    } catch (e) { return null; }
  };

  try {
    let charData = null;
    for (const v of variations) {
      if (v.length < 3) continue;
      charData = await fetchAniList(v);
      if (charData) break;
    }

    let img = charData?.image?.large || "";
    let gender = charData?.gender?.toLowerCase() || "none";
    let series = seriesHint || charData?.media?.nodes[0]?.title?.userPreferred || "Unknown Series";

    if (info) return res.status(200).json({ series, img, gender });

    // IMAGE PROXY
    const finalImg = (!img || img.includes('questionmark')) 
      ? `https://via.placeholder.com/225x350?text=${encodeURIComponent(baseClean)}` 
      : img;

    const imageRes = await fetch(finalImg, { headers });
    const buffer = Buffer.from(await imageRes.arrayBuffer());
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, s-maxage=31536000, immutable');
    return res.send(buffer);

  } catch (e) { 
    return res.status(200).json({ series: seriesHint || "Unknown Series", img: "", gender: "none" }); 
  }
}
