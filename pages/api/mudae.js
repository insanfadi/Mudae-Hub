export default async function handler(req, res) {
  const { name, info } = req.query;
  if (!name) return res.status(400).end();

  // 1. CLEANING: Search for the real name, not the emojis
  const clean = name
    .replace(/\(.*\)/g, '')          
    .replace(/[^\x00-\x7F]/gu, '')   
    .trim()
    .replace(/\s+/g, ' ');

  const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36' };

  try {
    let img = "";
    let series = "Unknown Series";

    // --- STEP A: JIKAN (MAL) FULL SEARCH ---
    const jikanRes = await fetch(`https://api.jikan.moe/v4/characters?q=${encodeURIComponent(clean)}&limit=1`, { headers });
    const jikanData = await jikanRes.json();

    if (jikanData.data && jikanData.data.length > 0) {
      const char = jikanData.data[0];
      img = char.images.jpg.image_url;

      // NEW: Get the series name from the character's anime or manga list
      try {
        const fullCharRes = await fetch(`https://api.jikan.moe/v4/characters/${char.mal_id}/full`, { headers });
        const fullData = await fullCharRes.json();
        
        // Take the first Anime title as the Series
        if (fullData.data.anime && fullData.data.anime.length > 0) {
          series = fullData.data.anime[0].anime.title;
        } else if (fullData.data.manga && fullData.data.manga.length > 0) {
          series = fullData.data.manga[0].manga.title;
        }
      } catch (e) { console.log("MAL Full Detail Failed"); }
    }

    // --- STEP B: ANILIST FALLBACK (If MAL failed or series is still unknown) ---
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

    // Final cleanup: Don't show the "MAL Question Mark" placeholder
    if (img.includes('questionmark_23')) img = "";

    if (info) return res.status(200).json({ series, img });

    // IMAGE PROXY: This prevents the "MAL" logo block by fetching the image on the server side
    if (!img) img = `https://via.placeholder.com/225x350?text=${encodeURIComponent(clean)}`;
    const imageRes = await fetch(img, { headers });
    const buffer = Buffer.from(await imageRes.arrayBuffer());
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, s-maxage=31536000, immutable');
    return res.send(buffer);
    
  } catch (e) { 
    return res.status(200).json({ series: "Unknown Series", img: "" }); 
  }
}
