export default async function handler(req, res) {
  const { name } = req.query;

  const query = `
    query ($search: String) {
      Character (search: $search) {
        image { large }
        media (perPage: 1) {
          nodes { title { userPreferred } }
        }
      }
    }
  `;

  try {
    const response = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ query, variables: { search: name } })
    });

    const data = await response.json();
    
    if (data.data && data.data.Character) {
      const imageUrl = data.data.Character.image.large;
      const seriesName = data.data.Character.media.nodes[0]?.title.userPreferred || "Unknown Series";

      // If the user wants the image, we pipe it. 
      // If the user wants the series name, we send JSON.
      if (req.query.info) {
        return res.status(200).json({ series: seriesName });
      }

      const imageRes = await fetch(imageUrl);
      const buffer = await imageRes.arrayBuffer();
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=604800'); // Cache for 1 week
      return res.send(Buffer.from(buffer));
    }
    
    return res.redirect('https://via.placeholder.com/225x350?text=Not+Found');
  } catch (e) {
    res.status(500).json({ error: 'Failed' });
  }
}
