export default async function handler(req, res) {
  const { name, info } = req.query;
  if (!name) return res.status(400).json({ error: "Name required" });

  try {
    let imageUrl = "";
    let seriesName = "Unknown Series";

    // 1. Try AniList First
    const aniQuery = `query ($s: String) { Character (search: $s) { image { large } media (perPage: 1) { nodes { title { userPreferred } } } } }`;
    const aniRes = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: aniQuery, variables: { s: name } })
    });
    const aniData = await aniRes.json();

    if (aniData.data?.Character) {
      imageUrl = aniData.data.Character.image.large;
      seriesName = aniData.data.Character.media.nodes[0]?.title.userPreferred || "Unknown";
    } 

    // 2. Stronger Mudae.net Scraper for Memes/Western/Custom chars
    if (!imageUrl || seriesName === "Unknown Series") {
      const searchName = name.split('(')[0].trim();
      const wikiRes = await fetch(`https://mudae.net/wiki/search?term=${encodeURIComponent(searchName)}`);
      const html = await wikiRes.text();
      
      // Look for images and look for the series name in the HTML
      const imgMatch = html.match(/https:\/\/mudae\.net\/uploads\/char\/[^"]+/);
      const seriesMatch = html.match(/<a href="\/wiki\/[^"]+">([^<]+)<\/a>/);
      
      if (imgMatch) imageUrl = imgMatch[0];
      if (seriesMatch && seriesMatch[1] && !seriesMatch[1].includes('Wiki')) {
        seriesName = seriesMatch[1];
      }
    }

    if (info) return res.status(200).json({ series: seriesName, image: imageUrl });

    if (imageUrl) {
      const imageRes = await fetch(imageUrl);
      const buffer = await imageRes.arrayBuffer();
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, s-maxage=31536000'); 
      return res.send(Buffer.from(buffer));
    }
    
    return res.redirect(`https://via.placeholder.com/225x350/1a202c/e2e8f0?text=${encodeURIComponent(name)}`);
  } catch (e) {
    return res.status(500).json({ error: "Failed" });
  }
}
