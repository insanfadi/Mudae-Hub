export default async function handler(req, res) {
  const { name, info } = req.query;
  if (!name) return res.status(400).end();

  const clean = name.replace(/\(.*\)/g, '').replace(/[^\x00-\x7F]/gu, '').trim().replace(/\s+/g, ' ');
  const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/119.0.0.0 Safari/537.36' };

  try {
    let img = "";
    let series = "Unknown Series";

    const jikanRes = await fetch(`https://api.jikan.moe/v4/characters?q=${encodeURIComponent(clean)}&limit=1`, { headers });
    const jikanData = await jikanRes.json();

    if (jikanData.data && jikanData.data.length > 0) {
      const char = jikanData.data[0];
      img = char.images.jpg.image_url;
      try {
        const fullCharRes = await fetch(`https://api.jikan.moe/v4/characters/${char.mal_id}/full`, { headers });
        const fullData = await fullCharRes.json();
        if (fullData.data.anime?.length > 0) series = fullData.data.anime[0].anime.title;
        else if (fullData.data.manga?.length > 0) series = fullData.data.manga[0].manga.title;
      } catch (e) {}
    }

    if (!img || series === "Unknown Series") {
      const aniRes = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: `query($s:String){Character(search:$s){image{large}media(perPage:1){nodes{title{userPreferred}}}}} `, 
          variables: { s: clean } 
        })
      });
      const ani = await aniRes.json();
      if (ani.data?.Character) {
        img = img || ani.data.Character.image.large;
        if (series === "Unknown Series") series = ani.data.Character.media.nodes[0]?.title.userPreferred || "Unknown Series";
      }
    }

    if (img.includes('questionmark_23')) img = "";
    if (info) return res.status(200).json({ series, img });

    if (!img) img = `https://via.placeholder.com/225x350?text=${encodeURIComponent(clean)}`;
    const imageRes = await fetch(img, { headers });
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, s-maxage=31536000, immutable');
    return res.send(Buffer.from(await imageRes.arrayBuffer()));
  } catch (e) { return res.status(200).json({ series: "Unknown Series", img: "" }); }
}
