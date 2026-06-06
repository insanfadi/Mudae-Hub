export default async function handler(req, res) {
  const { name, series: seriesHint, info } = req.query;
  if (!name) return res.status(400).end();

  const cleanName = name.replace(/\(.*\)/g, '').replace(/[^\x00-\x7F]/gu, '').trim();
  const searchName = cleanName.replace(/\s+/g, ''); // Variations for Angel-chan
  const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0' };

  try {
    let img = "";
    let series = seriesHint || "Unknown Series";
    let gender = "none";

    // 1. ANILIST SEARCH (Optimized with Series Hint if available)
    const queryTerm = seriesHint && seriesHint !== 'Unknown' ? `${cleanName} ${seriesHint}` : cleanName;
    
    try {
      const aniRes = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: `query($s:String){Character(search:$s){gender image{large}media(perPage:1){nodes{title{userPreferred}}}}} `, 
          variables: { s: queryTerm } 
        })
      });
      const ani = await aniRes.json();
      if (ani.data?.Character) {
        img = ani.data.Character.image.large;
        gender = ani.data.Character.gender?.toLowerCase() || "none";
        if (series === "Unknown Series") series = ani.data.Character.media.nodes[0]?.title.userPreferred;
      }
    } catch (e) {}

    // 2. STUBBORN FALLBACK (For Angel-chan / No Space)
    if (!img) {
        try {
            const aniRes2 = await fetch('https://graphql.anilist.co', {
                method: 'POST',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  query: `query($s:String){Character(search:$s){gender image{large}}} `, 
                  variables: { s: searchName } 
                })
              });
              const ani2 = await aniRes2.json();
              if (ani2.data?.Character) {
                img = ani2.data.Character.image.large;
                gender = ani2.data.Character.gender?.toLowerCase() || "none";
              }
        } catch (e) {}
    }

    if (info) return res.status(200).json({ series, img, gender });

    const finalImg = (!img || img.includes('questionmark')) ? `https://via.placeholder.com/225x350?text=${encodeURIComponent(cleanName)}` : img;
    const imageRes = await fetch(finalImg, { headers });
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, s-maxage=31536000, immutable');
    return res.send(Buffer.from(await imageRes.arrayBuffer()));
  } catch (e) { return res.status(200).json({ series: "Unknown Series", img: "", gender: "none" }); }
}
