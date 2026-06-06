export default async function handler(req, res) {
  const { name, info } = req.query;
  if (!name) return res.status(400).json({ error: "Name required" });

  try {
    const aniQuery = `query ($s: String) { Character (search: $s) { image { large } media (perPage: 1) { nodes { title { userPreferred } } } } }`;
    const aniRes = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: aniQuery, variables: { s: name } })
    });
    
    const aniData = await aniRes.json();
    let imageUrl = "https://via.placeholder.com/225x350?text=Searching...";
    let seriesName = "Unknown Series";

    if (aniData.data?.Character) {
      imageUrl = aniData.data.Character.image.large;
      seriesName = aniData.data.Character.media.nodes[0]?.title.userPreferred || "Unknown";
    }

    if (info) return res.status(200).json({ series: seriesName, image: imageUrl });

    // Stream the image with a fast timeout
    const imageRes = await fetch(imageUrl);
    const buffer = await imageRes.arrayBuffer();
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, s-maxage=604800'); 
    return res.send(Buffer.from(buffer));
  } catch (e) {
    return res.redirect('https://via.placeholder.com/225x350?text=Error');
  }
}
