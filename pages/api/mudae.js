export default async function handler(req, res) {
  const { name, info } = req.query;
  if (!name) return res.status(400).json({ error: "Name required" });

  try {
    // 1. Try AniList First (Best quality)
    const aniQuery = `query ($s: String) { Character (search: $s) { image { large } media (perPage: 1) { nodes { title { userPreferred } } } } }`;
    const aniRes = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: aniQuery, variables: { s: name } })
    });
    const aniData = await aniRes.json();

    let imageUrl = "";
    let seriesName = "Unknown Series";

    if (aniData.data?.Character) {
      imageUrl = aniData.data.Character.image.large;
      seriesName = aniData.data.Character.media.nodes[0]?.title.userPreferred || "Unknown";
    } else {
      // 2. Fallback to Mudae Wiki if AniList fails
      const wikiRes = await fetch(`https://mudae.net/wiki/search?term=${encodeURIComponent(name)}`);
      const html = await wikiRes.text();
      const imgMatch = html.match(/https:\/\/mudae\.net\/uploads\/char\/[^"]+/);
      if (imgMatch) imageUrl = imgMatch[0];
    }

    // If we only wanted the Series Name (JSON mode)
    if (info) {
      return res.status(200).json({ series: seriesName, image: imageUrl });
    }

    // 3. Serve the Image with "Turbo" Caching
    if (imageUrl) {
      const imageRes = await fetch(imageUrl);
      const buffer = await imageRes.arrayBuffer();
      res.setHeader('Content-Type', 'image/png');
      // Tells Vercel to cache this image globally for 1 month
      res.setHeader('Cache-Control', 'public, s-maxage=2592000, stale-while-revalidate');
      return res.send(Buffer.from(buffer));
    }

    return res.redirect('https://via.placeholder.com/225x350?text=No+Image');
  } catch (e) {
    return res.status(500).json({ error: "Failed" });
  }
}
