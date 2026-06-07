(async () => {
    const fetchMudaeWiki = async (term) => {
      try {
        const url = `https://mudae.fandom.com/api.php?action=query&format=json&prop=pageimages|info&generator=search&gsrsearch=${encodeURIComponent(term)}&pithumbsize=500`;
        const res = await fetch(url);
        const data = await res.json();
        const pages = data.query?.pages;
        if (pages) {
          const sortedPages = Object.values(pages).sort((a,b) => a.index - b.index);
          // Look for an exact match or very close match
          const exactMatch = sortedPages.find(p => p.title.toLowerCase() === term.toLowerCase() && p.thumbnail);
          if (exactMatch) return exactMatch.thumbnail.source;
          
          const validPage = sortedPages.find(p => p.thumbnail && p.title.toLowerCase().includes(term.toLowerCase()));
          if (validPage) {
            return validPage.thumbnail.source;
          }
        }
        return null;
      } catch (e) { return null; }
    };
    
    console.log(await fetchMudaeWiki("Iron Man"));
    console.log(await fetchMudaeWiki("Zero Two"));
    console.log(await fetchMudaeWiki("OMGkawaiiAngel"));
})();
