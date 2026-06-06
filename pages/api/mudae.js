export default async function handler(req, res) {
  const { name, info } = req.query;
  if (!name) return res.status(400).end();

  // DEEP CLEAN: Removes emojis, (Tags), and special symbols
  let clean = name
    .replace(/\(.*\)/g, '') // Removes (BP), (Alts), etc.
    .replace(/[^\x00-\x7F]/g, '') // Removes ALL emojis and non-standard symbols
    .replace(/[:]/g, '') // Removes colons
    .trim()
    .replace(/\s+/g, ' '); // Collapses double spaces to single

  try {
    // Phase 1: Try Mudae Wiki
    const wikiRes = await fetch(`https://mudae.net/wiki/search?term=${encodeURIComponent(clean)}`);
    const html = await wikiRes.text();
    
    let img = html.match(/https:\/\/mudae\.net\/uploads\/char\/[^"]+/)?.[0] || "";
    const seriesMatch = html.match(/<a href="\/wiki\/[^"]+">([^<]+)<\/a>/);
    let series = (seriesMatch && !seriesMatch[1].includes('Wiki')) ? seriesMatch[1] : "Unknown Series";

    // Phase 2: If Mudae fails or series is unknown, Force AniList
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
        img = img || ani.data.Character.image.large;
        if (series === "Unknown Series") series = ani.data.Character.media.nodes[0]?.title.userPreferred || series;
      }
    }

    // Safety: Final check for Series
    if (series.toLowerCase().includes('search')) series = "Unknown Series";

    if (info) return res.status(200).json({ series, img });

    // Handle Image Redirect
    res.setHeader('Cache-Control', 'public, s-maxage=31536000, immutable');
    const finalImg = img || "https://via.placeholder.com/225x350?text=No+Image";
    const imageRes = await fetch(finalImg);
    return res.send(Buffer.from(await imageRes.arrayBuffer()));
    
  } catch (e) { 
    return res.status(200).json({ series: "Unknown Series", img: "" }); 
  }
}
