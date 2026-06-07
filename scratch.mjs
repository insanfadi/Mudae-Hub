const HEADERS = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0 Safari/537.36', 'Accept': '*/*' };

async function fetchJikan(term) {
  try {
    const r = await fetch(`https://api.jikan.moe/v4/characters?q=${encodeURIComponent(term)}&limit=1`, { headers: HEADERS });
    const data = await r.json();
    console.log(JSON.stringify(data.data[0], null, 2));
  } catch (e) {
  }
}

fetchJikan('Lara Croft');
