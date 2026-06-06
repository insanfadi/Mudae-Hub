export default async function handler(req, res) {
  const { name, info } = req.query;
  if (!name) return res.status(400).end();

  // DEEP CLEAN ENGINE: Removes emojis, Mudae tags (BP), and special symbols
  let clean = name
    .replace(/\(.*\)/g, '')          // Removes (BP), (Alts), etc.
    .replace(/[^\x00-\x7F]/gu, '')   // Removes ALL emojis/symbols
    .replace(/[:]/g, '')             // Removes colons
    .trim()
    .replace(/\s+/g, ' ');           // Collapses double spaces

  try {
    // Attempt 1: Mudae Wiki
    const wikiRes = await fetch(`https://mudae.net/wiki/search?term=${encodeURIComponent(clean)}`);
    const html = await wikiRes.text();
    
    let img = html.match(/https:\/\/mudae\.net\/uploads\/char\/[^"]+/)?.[0] || "";
    const seriesMatch = html.match(/<a href="\/wiki\/[^"]+">([^<]+)<\/a>/);
    let series = (seriesMatch && !seriesMatch[1].includes('Wiki')) ? seriesMatch[1] : "Unknown Series";

    // Attempt 2: AniList Fallback (If Mudae has no image or unknown series)
    if (!img || series === "Unknown Series") {
      const aniRes = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: `query($s:String){Character(search:$s){image{large}media(perPage:1){nodes{title{userPreferred}}}}} `, 
          variables: { s: clean } 
        })
      });
      const ani = await aniRes.json();
      if (ani.data?.Character) {
        if (!img) img = ani.data.Character.image.large;
        if (series === "Unknown Series") series = ani.data.Character.media.nodes[0]?.title.userPreferred || "Unknown Series";
      }
    }

    // Safety check for metadata requests
    if (info) return res.status(200).json({ series, img });

    // Handle Image Serving
    res.setHeader('Cache-Control', 'public, s-maxage=31536000, immutable');
    const imageRes = await fetch(img || "https://via.placeholder.com/225x350?text=No+Image");
    const buffer = Buffer.from(await imageRes.arrayBuffer());
    return res.send(buffer);
    
  } catch (e) { 
    return res.status(200).json({ series: "Unknown Series", img: "" }); 
  }
}
