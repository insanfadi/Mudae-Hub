export default async function handler(req, res) {
  const { name, series: seriesHint, info } = req.query;
  if (!name) return res.status(400).end();

  // 1. CLEANING: Remove everything except standard letters and numbers
  const cleanName = name.replace(/\(.*\)/g, '').replace(/[^\x00-\x7F]/gu, '').trim();
  const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0' };

  try {
    let img = "";
    let series = seriesHint || "Unknown Series";
    let gender = "none";

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

    // SEARCH STRATEGY (Tested for Angel-chan):
    // 1. Search name exactly (e.g. "OMGkawaiiAngel-chan")
    // 2. Search name with a space (e.g. "OMGkawaii Angel-chan")
    let charData = await fetchAniList(cleanName);
    if (!charData) charData = await fetchAniList(cleanName.replace(/([a-z])([A-Z])/g, '$1 $2'));

    if (charData) {
      img = charData.image.large;
      gender = charData.gender?.toLowerCase() || "none";
      if (series === "Unknown Series") series = charData.media.nodes[0]?.title.userPreferred;
    }

    if (info) return res.status(200).json({ series, img, gender });

    // IMAGE PROXY (Verified for Vercel)
    const finalImg = (!img || img.includes('questionmark')) 
      ? `https://via.placeholder.com/225x350?text=${encodeURIComponent(cleanName)}` 
      : img;

    const imageRes = await fetch(finalImg, { headers });
    const buffer = Buffer.from(await imageRes.arrayBuffer());
    
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, s-maxage=31536000, immutable');
    return res.send(buffer);

  } catch (e) { 
    return res.status(200).json({ series: "Unknown Series", img: "", gender: "none" }); 
  }
}
