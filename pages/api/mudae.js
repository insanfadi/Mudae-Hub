export default async function handler(req, res) {
  const { name } = req.query;
  const searchUrl = `https://mudae.net/wiki/search?term=${encodeURIComponent(name)}`;
  try {
    const response = await fetch(searchUrl);
    const html = await response.text();
    const imgRegex = /https:\/\/mudae\.net\/uploads\/char\/[^"]+/;
    const match = html.match(imgRegex);
    if (match) {
      const imageUrl = match[0];
      const imageRes = await fetch(imageUrl);
      const buffer = await imageRes.arrayBuffer();
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.send(Buffer.from(buffer));
    }
    return res.redirect('https://via.placeholder.com/225x350?text=No+Image');
  } catch (e) {
    res.status(500).json({ error: 'Failed' });
  }
}
