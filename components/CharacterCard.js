import React, { useState, useEffect } from 'react';
import { Tag, X, Gem, Key } from 'lucide-react';

// ─── Cancellable concurrency limiter ─────────────────────────────────────────
const MAX_CONCURRENT = 8;
let activeCount = 0;
const waitQueue = []; // [{ resolve }]

function acquireSlot() {
  let resolver;
  const promise = new Promise(resolve => {
    resolver = resolve;
    if (activeCount < MAX_CONCURRENT) {
      activeCount++;
      resolve(true);
    } else {
      waitQueue.push({ resolve });
    }
  });
  const cancel = () => {
    // Remove from queue if still waiting (slot was never active → no decrement)
    const idx = waitQueue.findIndex(e => e.resolve === resolver);
    if (idx !== -1) waitQueue.splice(idx, 1);
  };
  return { promise, cancel };
}

function releaseSlot() {
  if (waitQueue.length) {
    // Pass the active slot directly to the next waiter
    const entry = waitQueue.shift();
    entry.resolve(true);
    // activeCount stays the same — slot transferred
  } else {
    activeCount--;
  }
}

// ─── Inline SVG placeholder — zero external dependency, always renders ────────
function makePlaceholder(name) {
  const label = (name || '?').slice(0, 16).replace(/[<>&'"]/g, c => ({ '<': '%3C', '>': '%3E', '&': '%26', "'": '%27', '"': '%22' }[c]));
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='225' height='350'>` +
    `<rect width='225' height='350' fill='%23161b29'/>` +
    `<rect x='20' y='20' width='185' height='310' rx='12' fill='%230f172a' stroke='%23334155' stroke-width='1.5'/>` +
    `<text x='112' y='158' text-anchor='middle' dominant-baseline='middle' fill='%23e879f9' font-family='sans-serif' font-size='13' font-weight='bold'>${label}</text>` +
    `<text x='112' y='182' text-anchor='middle' dominant-baseline='middle' fill='%23475569' font-family='sans-serif' font-size='10'>No image found</text>` +
    `</svg>`;
  return `data:image/svg+xml,${svg}`;
}

const CharacterCard = ({ char, isUnlocked, onToggleTrade, onDelete, isTagged }) => {
  // imgSrc: null=loading | ''=not found | string=CDN url
  const [imgSrc, setImgSrc]           = useState(null);
  const [proxySrc, setProxySrc]       = useState(null);
  const [proxyFailed, setProxyFailed] = useState(false);
  const [inView, setInView]           = useState(false);
  const [isLoaded, setIsLoaded]       = useState(false);
  const cardRef = React.useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setInView(true);
        observer.disconnect();
      }
    }, { rootMargin: '200px' });
    
    if (cardRef.current) {
      observer.observe(cardRef.current);
    }
    
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!inView) return;

    let cancelled = false;
    setImgSrc(null);
    setProxySrc(null);
    setProxyFailed(false);
    setIsLoaded(false);

    const apiUrl = `/api/mudae?name=${encodeURIComponent(char.name)}&series=${encodeURIComponent(char.series || '')}`;
    const slot = acquireSlot();

    slot.promise.then(acquired => {
      if (!acquired || cancelled) return;
      fetch(apiUrl)
        .then(r => r.json())
        .then(data => {
          if (cancelled) return;
          const url = data.img;
          if (url && !url.includes('questionmark') && !url.includes('default')) {
            setImgSrc(url);
          } else {
            setImgSrc(''); // nothing found → fallback
          }
        })
        .catch(() => { if (!cancelled) setImgSrc(''); })
        .finally(() => releaseSlot());
    });

    return () => {
      cancelled = true;
      slot.cancel();
    };
  }, [char.name, char.series, inView]);

  const fallback = makePlaceholder(char.name);

  // ── Display state machine ──────────────────────────────────────────────────
  // null        → skeleton spinner (still fetching from API)
  // ''          → API returned nothing → local SVG placeholder
  // imgSrc URL  → try direct CDN first
  //   onError   → set proxySrc → server-proxy the image
  //   onError   → set proxyFailed → local SVG placeholder
  let displaySrc;
  if (imgSrc === null) {
    displaySrc = null;                     // skeleton
  } else if (imgSrc === '' || proxyFailed) {
    displaySrc = fallback;                 // no image at all → guaranteed render
  } else if (proxySrc) {
    displaySrc = proxySrc;                 // proxy mode (CDN failed, server fetches it)
  } else {
    displaySrc = imgSrc;                   // happy path: direct CDN
  }

  return (
    <div ref={cardRef} className="group relative bg-[#161b29] rounded-[24px] border-2 border-slate-800 hover:border-pink-500 transition-all duration-500 overflow-hidden shadow-2xl flex flex-col">
      <div className="aspect-[2/3] relative overflow-hidden bg-[#0b0f1a]">

        {/* Skeleton while loading */}
        {(!isLoaded || displaySrc === null) && (
          <div className="absolute inset-0 z-10 animate-pulse bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
            <div className="w-10 h-10 rounded-full border-4 border-pink-600 border-t-transparent animate-spin" />
          </div>
        )}

        {displaySrc !== null && (
          <img
            src={displaySrc}
            alt={char.name}
            className={`w-full h-full object-cover transition-all duration-700 ease-out transform-gpu ${isLoaded ? 'opacity-100 group-hover:scale-110' : 'opacity-0 scale-95'}`}
            onLoad={() => setIsLoaded(true)}
            onError={() => {
              setIsLoaded(false);
              // Only escalate if we were showing the direct CDN URL (not already proxy/placeholder)
              if (!proxySrc && imgSrc && !imgSrc.startsWith('data:')) {
                // Attempt 2: server-side proxy (bypasses CORS / hotlink protection)
                const proxyUrl = `/api/mudae?name=${encodeURIComponent(char.name)}&series=${encodeURIComponent(char.series || '')}&proxy=1`;
                setProxySrc(proxyUrl);
              } else {
                // Attempt 3: all remote sources failed → SVG placeholder (guaranteed render)
                setProxyFailed(true);
              }
            }}
            loading="lazy"
          />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-[#0b0f1a] via-transparent to-transparent opacity-90 pointer-events-none" />

        <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-xl px-3 py-1.5 rounded-xl text-[13px] font-black text-orange-400 border border-white/10 shadow-2xl z-10 flex items-center gap-1.5">
          <Gem size={12} className="text-orange-400 fill-orange-400/20" />
          {char.kakera?.toLocaleString()}
        </div>

        {char.keys > 0 && !isUnlocked && (
          <div className="absolute top-4 right-4 bg-yellow-500/90 backdrop-blur-md px-3 py-1.5 rounded-xl text-[13px] font-black text-black shadow-2xl z-10 flex items-center gap-1.5">
            <Key size={12} className="fill-black" />
            {char.keys}
          </div>
        )}

        {isUnlocked && (
          <button onClick={() => onDelete(char)} className="absolute top-4 right-4 p-2.5 bg-red-600 hover:bg-red-500 text-white rounded-2xl opacity-0 group-hover:opacity-100 transition-all shadow-xl z-30">
            <X size={20} />
          </button>
        )}

        <button onClick={() => onToggleTrade(char.id)} className={`absolute bottom-5 right-5 p-4 rounded-[20px] backdrop-blur-xl transition-all z-20 ${isTagged ? 'bg-pink-600 text-white shadow-pink-600/50 shadow-lg scale-110' : 'bg-white/5 text-white/20 hover:bg-white/10'}`}>
          <Tag size={22} />
        </button>
      </div>

      <div className="p-6 bg-[#161b29] z-20">
        <div className="flex items-center gap-2">
          <h4 className="text-[20px] font-bold text-white truncate uppercase tracking-tight leading-tight mb-1">{char.name}</h4>
          {char.gender === 'female' && <span className="text-pink-500 font-black text-lg">♀</span>}
          {char.gender === 'male' && <span className="text-blue-500 font-black text-lg">♂</span>}
        </div>
        <p className={`text-[14px] truncate font-black uppercase tracking-widest ${char.series?.toLowerCase().includes('unknown') ? 'text-red-500' : 'text-slate-500'}`}>
          {char.series || 'Unknown'}
        </p>
        {char.rank && <p className="text-[10px] font-black text-slate-700 mt-1 uppercase tracking-tighter italic">Rank #{char.rank}</p>}
      </div>
    </div>
  );
};

export default React.memo(CharacterCard);
