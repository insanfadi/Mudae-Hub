import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../lib/firebase';
import { doc, setDoc, onSnapshot, collection, updateDoc, arrayUnion, arrayRemove, deleteDoc } from 'firebase/firestore';
import { Search, Lock, Unlock, Tag, Trash2, X, RefreshCw, Users, CheckCircle2, ArrowUpDown } from 'lucide-react';

const CharacterCard = React.memo(({ char, isUnlocked, onToggleTrade, onDelete, isTagged }) => {
  const [imgError, setImgError] = useState(false);
  // Force image refresh when series changes from Unknown
  const imgUrl = `/api/mudae?name=${encodeURIComponent(char.name)}&series=${encodeURIComponent(char.series || 'unknown')}`;

  return (
    <div className="group relative bg-[#1a202c] rounded-xl border border-slate-800 hover:border-pink-500 transition-all overflow-hidden shadow-lg">
      <div className="aspect-[2/3] relative bg-[#0b0f1a]">
        <img 
          src={imgError ? `https://via.placeholder.com/225x350?text=Reloading` : imgUrl} 
          alt={char.name} 
          className="w-full h-full object-cover transition-transform group-hover:scale-105" 
          onError={() => setImgError(true)}
          loading="lazy" 
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-transparent to-transparent opacity-80" />
        <div className="absolute top-2 left-2 bg-black/70 px-2 py-0.5 rounded text-[10px] font-black text-orange-400 border border-white/5">
          {char.kakera.toLocaleString()}
        </div>
        {isUnlocked && (
          <button onClick={() => onDelete(char)} className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all">
            <X size={14}/>
          </button>
        )}
        <button onClick={() => onToggleTrade(char.series)} className={`absolute bottom-3 right-3 p-2.5 rounded-xl backdrop-blur-md transition-all ${isTagged ? 'bg-green-500 text-white shadow-lg' : 'bg-white/5 text-white/30'}`}>
          <Tag size={12}/>
        </button>
      </div>
      <div className="p-3">
        <h4 className="text-[10px] font-black text-white truncate uppercase tracking-tighter">{char.name}</h4>
        <p className={`text-[8px] truncate font-bold uppercase mt-0.5 ${char.series?.toLowerCase().includes('unknown') ? 'text-red-500' : 'text-slate-400'}`}>
          {char.series || 'Unknown'}
        </p>
      </div>
    </div>
  );
});

export default function MudaeHub() {
  const [profiles, setProfiles] = useState({});
  const [activeProfile, setActiveProfile] = useState('');
  const [inputText, setInputText] = useState('');
  const [pin, setPin] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [search, setSearch] = useState('');
  const [isFixing, setIsFixing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [sortMode, setSortMode] = useState('kakera');

  useEffect(() => {
    return onSnapshot(collection(db, "profiles"), (s) => {
      const d = {}; s.forEach(doc => d[doc.id] = doc.data());
      setProfiles(d);
      if (!activeProfile && Object.keys(d).length > 0) setActiveProfile(Object.keys(d)[0]);
    });
  }, [activeProfile]);

  const smartFixer = async () => {
    if (!isUnlocked || isFixing) return;
    const allChars = [...(profiles[activeProfile]?.characters || [])];
    const targets = allChars.filter(c => !c.series || c.series.toLowerCase().includes('unknown'));
    
    if (targets.length === 0) return alert("Everything is synced!");
    
    setIsFixing(true); setProgress(0);

    // CRITICAL: We now process 1 by 1 with a 2-second delay to avoid MAL's "Rate Limit" blocks
    for (let i = 0; i < targets.length; i++) {
      const char = targets[i];
      try {
        const res = await fetch(`/api/mudae?name=${encodeURIComponent(char.name)}&info=true`);
        const data = await res.json();
        const idx = allChars.findIndex(c => c.id === char.id);
        
        if (idx !== -1 && data.series && !data.series.toLowerCase().includes('unknown')) {
          allChars[idx].series = data.series;
          // Partial update to Firebase every 5 chars so we don't lose progress
          if (i % 5 === 0) {
            await updateDoc(doc(db, "profiles", activeProfile), { characters: allChars });
          }
        }
      } catch (e) { console.error("Sync error for " + char.name); }
      
      setProgress(i + 1);
      await new Promise(r => setTimeout(r, 2000)); // 2 second pause between characters
    }

    await updateDoc(doc(db, "profiles", activeProfile), { characters: allChars });
    setIsFixing(false);
    alert("Deep Sync Finished!");
  };

  const handleImport = async () => {
    if (!isUnlocked) return alert("Enter PIN!");
    const news = inputText.split('\n').map(l => {
      const k = l.match(/([\d,]+)\s*ka/);
      if (!k) return null;
      return { 
        name: l.replace(/#[\d,]+ - /, '').split(k[0])[0].trim(), 
        series: "Unknown", 
        kakera: parseInt(k[1].replace(/,/g, '')), 
        id: Math.random().toString(36).substr(2, 9) 
      };
    }).filter(Boolean);
    await updateDoc(doc(db, "profiles", activeProfile), { characters: arrayUnion(...news) });
    setInputText('');
  };

  const sortedChars = useMemo(() => {
    let chars = [...(profiles[activeProfile]?.characters || [])];
    if (search) chars = chars.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.series?.toLowerCase().includes(search.toLowerCase()));
    return chars.sort((a, b) => sortMode === 'kakera' ? b.kakera - a.kakera : a.name.localeCompare(b.name));
  }, [profiles, activeProfile, search, sortMode]);

  return (
    <div className="min-h-screen bg-[#0b0f1a] text-slate-300 flex flex-col md:flex-row">
      <aside className="w-full md:w-64 bg-[#0f172a] border-r border-slate-800 p-6 space-y-8 shrink-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-pink-600 rounded-xl flex items-center justify-center text-white font-black italic shadow-lg text-xl">M</div>
          <h1 className="text-sm font-black text-white uppercase italic">Mudae Hub</h1>
        </div>
        <nav className="space-y-2">
          {Object.keys(profiles).map(name => (
            <button key={name} onClick={() => setActiveProfile(name)} className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-black transition-all ${activeProfile === name ? 'bg-pink-600 text-white shadow-xl' : 'text-slate-400 hover:bg-white/5'}`}>
              <div className="flex items-center gap-3"><Users size={14}/> {name}</div>
              {isUnlocked && activeProfile === name && <Trash2 size={14} className="opacity-40 hover:opacity-100" onClick={(e) => { e.stopPropagation(); if(confirm('Delete Profile?')) deleteDoc(doc(db, "profiles", name)); }}/>}
            </button>
          ))}
          <button onClick={() => { const n = prompt("Name?"); if(n) setDoc(doc(db, "profiles", n), { characters: [], tradeTags: [] }); }} className="w-full border border-dashed border-slate-700 py-3 rounded-xl text-[10px] font-black uppercase text-slate-500 mt-6">+ Add Friend</button>
        </nav>
      </aside>

      <main className="flex-1 p-4 md:p-12 overflow-y-auto">
        <header className="flex flex-col xl:flex-row justify-between gap-8 mb-16 items-center">
          <div>
            <h2 className="text-7xl font-black text-white italic uppercase tracking-tighter leading-none">{activeProfile || 'Select'}</h2>
            <div className="flex gap-4 mt-4 justify-center xl:justify-start">
              <span className="text-[10px] font-black text-slate-500 uppercase">{sortedChars.length} CHARS</span>
              <button onClick={() => setSortMode(sortMode === 'kakera' ? 'name' : 'kakera')} className="text-[10px] font-black text-pink-500 uppercase flex items-center gap-2"><ArrowUpDown size={10}/> {sortMode}</button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 justify-center">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl flex p-2">
              <input type="password" placeholder="PIN" className="bg-transparent px-3 w-16 text-xs outline-none font-bold" onChange={(e) => setPin(e.target.value)} />
              <button onClick={() => setIsUnlocked(pin === "1234")} className={`p-2.5 rounded-xl transition-all ${isUnlocked ? 'bg-green-500 text-white shadow-lg' : 'text-slate-600'}`}>{isUnlocked ? <Unlock size={18}/> : <Lock size={18}/>}</button>
            </div>
            <button onClick={smartFixer} disabled={!isUnlocked || isFixing} className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white px-8 py-4 rounded-2xl text-[11px] font-black uppercase flex items-center gap-3">
              {isFixing ? <RefreshCw size={16} className="animate-spin"/> : <CheckCircle2 size={16}/>}
              {isFixing ? `SYNCING: ${progress} / ${targets.length}` : 'High-Quality Sync'}
            </button>
          </div>
        </header>

        <section className="grid grid-cols-1 lg:grid-cols-4 gap-12">
          <div className="lg:col-span-1">
            <div className="bg-[#111622] border border-slate-800 p-6 rounded-3xl space-y-6 shadow-2xl sticky top-10">
              <div className="relative">
                <Search className="absolute left-4 top-4 text-slate-600" size={16}/>
                <input className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-4 pl-12 pr-4 text-xs outline-none focus:border-pink-500 font-bold" placeholder="Search..." onChange={(e) => setSearch(e.target.value)} />
              </div>
              <textarea className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-[10px] h-40 outline-none font-mono" placeholder="Paste $mms l- k" value={inputText} onChange={(e) => setInputText(e.target.value)} />
              <button onClick={handleImport} disabled={!isUnlocked} className="w-full bg-pink-600 hover:bg-pink-500 py-4 rounded-2xl text-xs font-black text-white uppercase shadow-xl">Import</button>
            </div>
          </div>
          <div className="lg:col-span-3 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 md:gap-6">
            {sortedChars.map((c) => (
              <CharacterCard key={c.id} char={c} isUnlocked={isUnlocked} onDelete={(char) => updateDoc(doc(db, "profiles", activeProfile), { characters: arrayRemove(char) })} onToggleTrade={(s) => {
                  const t = profiles[activeProfile]?.tradeTags?.includes(s);
                  updateDoc(doc(db, "profiles", activeProfile), { tradeTags: t ? arrayRemove(s) : arrayUnion(s) });
                }} isTagged={profiles[activeProfile]?.tradeTags?.includes(c.series)} 
              />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
