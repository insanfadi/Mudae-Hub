export default async function handler(req, res) {
  const { name, info } = req.query;
  if (!name) return res.status(400).end();

  try {
    const aniQuery = `query($s:String){Character(search:$s){image{large}media(perPage:1){nodes{title{userPreferred}}}}} `;
    const aniRes = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: aniQuery, variables: { s: name } })
    });
    
    const aniData = await aniRes.json();
    let img = "", series = "Unknown Series";

    if (aniData.data?.Character) {
      img = aniData.data.Character.image.large;
      series = aniData.data.Character.media.nodes[0]?.title.userPreferred || series;
    } else {
      // Deep scrape Mudae.net if AniList fails
      const wikiRes = await fetch(`https://mudae.net/wiki/search?term=${encodeURIComponent(name.split('(')[0])}`);
      const html = await wikiRes.text();
      img = html.match(/https:\/\/mudae\.net\/uploads\/char\/[^"]+/)?.[0] || "";
      series = html.match(/<a href="\/wiki\/[^"]+">([^<]+)<\/a>/)?.[1] || series;
    }

    if (info) return res.status(200).json({ series, img });

    // Edge Caching: 1 year public cache
    res.setHeader('Cache-Control', 'public, s-maxage=31536000, immutable');
    if (img) {
      const imageRes = await fetch(img);
      return res.send(Buffer.from(await imageRes.arrayBuffer()));
    }
    return res.redirect(`https://via.placeholder.com/225x350/0b0f1a/475569?text=${encodeURIComponent(name)}`);
  } catch (e) { return res.status(500).end(); }
}
