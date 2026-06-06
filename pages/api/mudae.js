export default async function handler(req, res) {
  const { name, info } = req.query;
  if (!name) return res.status(400).end();

  // We keep the original name for the first attempt
  const originalName = name.trim();
  
  // We create a "Search Name" for the backup attempt (No emojis, no (BP))
  const searchName = name
    .replace(/\(.*\)/g, '') 
    .replace(/[^\x00-\x7F]/gu, '')
    .trim()
    .replace(/\s+/g, ' ');

  const search = async (term) => {
    try {
      // 1. Try Mudae Wiki
      const wikiRes = await fetch(`https://mudae.net/wiki/search?term=${encodeURIComponent(term)}`);
      const html = await wikiRes.text();
      let img = html.match(/https:\/\/mudae\.net\/uploads\/char\/[^"]+/)?.[0] || "";
      const seriesMatch = html.match(/<a href="\/wiki\/[^"]+">([^<]+)<\/a>/);
      let series = (seriesMatch && !seriesMatch[1].includes('Wiki')) ? seriesMatch[1] : "Unknown Series";

      // 2. Try AniList Fallback
      if (!img || series === "Unknown Series") {
        const aniRes = await fetch('https://graphql.anilist.co', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            query: `query($s:String){Character(search:$s){image{large}media(perPage:1){nodes{title{userPreferred}}}}} `, 
            variables: { s: term } 
          })
        });
        const ani = await aniRes.json();
        if (ani.data?.Character) {
          img = img || ani.data.Character.image.large;
          if (series === "Unknown Series") series = ani.data.Character.media.nodes[0]?.title.userPreferred || "Unknown Series";
        }
      }
      return { img, series };
    } catch (e) { return null; }
  };

  try {
    // ATTEMPT 1: Search with original name (including emojis/tags)
    let result = await search(originalName);

    // ATTEMPT 2: If first try failed or returned "Unknown", try the cleaned name
    if (!result || result.series === "Unknown Series" || !result.img) {
      const backup = await search(searchName);
      if (backup && backup.img) result = backup;
    }

    if (info) return res.status(200).json(result || { series: "Unknown Series", img: "" });

    res.setHeader('Cache-Control', 'public, s-maxage=31536000, immutable');
    const finalImg = result?.img || "https://via.placeholder.com/225x350?text=Not+Found";
    const imageRes = await fetch(finalImg);
    return res.send(Buffer.from(await imageRes.arrayBuffer()));
    
  } catch (e) { 
    return res.status(200).json({ series: "Unknown Series", img: "" }); 
  }
}
