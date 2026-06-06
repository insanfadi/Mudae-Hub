export default async function handler(req, res) {
  const { name, info } = req.query;
  if (!name) return res.status(400).end();

  // Clean name: Remove emojis and extra symbols for the search
  const cleanName = name.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F200}-\u{1F2FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F018}-\u{1F270}\u{238C}-\u{2454}\u{1F300}-\u{1F5FF}]/gu, '').trim();

  try {
    // 1. Search Mudae Wiki Directly (The Source of Truth)
    const wikiUrl = `https://mudae.net/wiki/search?term=${encodeURIComponent(cleanName)}`;
    const wikiRes = await fetch(wikiUrl);
    const html = await wikiRes.text();

    // Regex to find the image on Mudae Wiki
    const imgMatch = html.match(/https:\/\/mudae\.net\/uploads\/char\/[^"]+/);
    // Regex to find the Series Name (usually follows the character name in the wiki)
    const seriesMatch = html.match(/<a href="\/wiki\/[^"]+">([^<]+)<\/a>/);

    let img = imgMatch ? imgMatch[0] : "";
    let series = (seriesMatch && seriesMatch[1] && !seriesMatch[1].includes('Wiki')) ? seriesMatch[1] : "Unknown Series";

    // 2. AniList Fallback (Only if Mudae Wiki has no image)
    if (!img) {
      const aniQuery = `query($s:String){Character(search:$s){image{large}media(perPage:1){nodes{title{userPreferred}}}}} `;
      const aniRes = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: aniQuery, variables: { s: cleanName } })
      });
      const aniData = await aniRes.json();
      if (aniData.data?.Character) {
        img = aniData.data.Character.image.large;
        if (series === "Unknown Series") {
          series = aniData.data.Character.media.nodes[0]?.title.userPreferred || series;
        }
      }
    }

    if (info) return res.status(200).json({ series, img });

    // Edge Caching: 1 year public cache
    res.setHeader('Cache-Control', 'public, s-maxage=31536000, immutable');
    if (img) {
      const imageRes = await fetch(img);
      const buffer = await imageRes.arrayBuffer();
      res.setHeader('Content-Type', 'image/png');
      return res.send(Buffer.from(buffer));
    }
    
    // Placeholder if truly nothing found
    return res.redirect(`https://via.placeholder.com/225x350/0b0f1a/475569?text=${encodeURIComponent(name)}`);
  } catch (e) { return res.status(500).end(); }
}
