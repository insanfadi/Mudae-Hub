import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { db } from '../lib/firebase';
import { doc, setDoc, onSnapshot, collection, updateDoc, arrayUnion, arrayRemove, deleteDoc } from 'firebase/firestore';
import { Search, Lock, Unlock, Import, Plus, Tag, Trash2, X, RefreshCw, Users, CheckCircle2 } from 'lucide-react';

const CharacterCard = React.memo(({ char, isUnlocked, onToggleTrade, onDelete, isTagged }) => (
  <div className="group relative bg-[#1a202c] rounded-xl border border-slate-800 hover:border-pink-500/50 transition-all overflow-hidden shadow-lg">
    <div className="aspect-[2/3] relative bg-slate-900">
      <img src={`/api/mudae?name=${encodeURIComponent(char.name)}`} alt={char.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-transparent to-transparent opacity-80"></div>
      <div className="absolute top-2 left-2 bg-black/80 px-2 py-1 rounded-lg text-[10px] font-black text-orange-400 border border-white/5 shadow-xl">{char.kakera.toLocaleString()}</div>
      {isUnlocked && (
        <button onClick={() => onDelete(char)} className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all shadow-xl"><X size={14}/></button>
      )}
      <button onClick={() => onToggleTrade(char.series)} className={`absolute bottom-3 right-3 p-2.5 rounded-xl backdrop-blur-md transition-all shadow-xl ${isTagged ? 'bg-green-500 text-white' : 'bg-white/5 text-white/30 hover:bg-white/10'}`}>
        <Tag size={12} fill={isTagged ? "currentColor" : "none"}/>
      </button>
    </div>
    <div className="p-3">
      <h4 className="text-[11px] font-black text-white truncate uppercase tracking-tight">{char.name}</h4>
      <p className={`text-[9px] truncate font-bold uppercase mt-0.5 tracking-widest ${char.series?.toLowerCase().includes('unknown') ? 'text-red-500' : 'text-slate-500'}`}>
        {char.series || 'Unknown Series'}
      </p>
    </div>
  </div>
));

export default function MudaeHub() {
  const [profiles, setProfiles] = useState({});
  const [activeProfile, setActiveProfile] = useState('');
  const [inputText, setInputText] = useState('');
  const [pin, setPin] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [search, setSearch] = useState('');
  const [newProfileName, setNewProfileName] = useState('');
  const [isFixing, setIsFixing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "profiles"), (snapshot) => {
      const data = {};
      snapshot.forEach(doc => data[doc.id] = doc.data());
      setProfiles(data);
      if (!activeProfile && Object.keys(data).length > 0) setActiveProfile(Object.keys(data)[0]);
    });
    return () => unsub();
  }, [activeProfile]);

  const autoFixer = async () => {
    if (!isUnlocked || isFixing) return;
    const allChars = [...(profiles[activeProfile]?.characters || [])];
    // This filter catches "Unknown", "Unknown Series", or empty series
    const targets = allChars.filter(c => !c.series || c.series.toLowerCase().includes('unknown'));
    
    if (targets.length === 0) return alert("All characters look good!");

    setIsFixing(true);
    setProgress({ current: 0, total: targets.length });

    for (let i = 0; i < targets.length; i++) {
      const char = targets[i];
      try {
        const res = await fetch(`/api/mudae?name=${encodeURIComponent(char.name)}&info=true`);
        const data = await res.json();
        
        const mainMatch = allChars.find(c => c.id === char.id);
        if (mainMatch && data.series && !data.series.toLowerCase().includes('unknown')) {
          mainMatch.series = data.series;
        }
        
        setProgress(p => ({ ...p, current: i + 1 }));
        
        // Save to DB every 10 items so we don't lag or lose progress
        if (i % 10 === 0) {
          await updateDoc(doc(db, "profiles", activeProfile), { characters: allChars });
        }
      } catch (e) { console.error(e); }
      
      // Wait a bit to avoid getting banned
      await new Promise(r => setTimeout(r, 500));
    }

    await updateDoc(doc(db, "profiles", activeProfile), { characters: allChars });
    setIsFixing(false);
    alert("Automatic Fix Complete!");
  };

  const handleImport = async () => {
    if (!isUnlocked) return alert("Enter PIN!");
    const newChars = inputText.split('\n').map(line => {
      const ka = line.match(/([\d,]+)\s*ka/);
      if (!ka) return null;
      return { 
        name: line.replace(/#[\d,]+ - /, '').replace(ka[0], '').trim(), 
        series: "Unknown Series", 
        kakera: parseInt(ka[1].replace(/,/g, '')), 
        keys: line.match(/\((\d+)\)/)?.[1] || 0, 
        id: Math.random().toString(36).substr(2, 9) 
      };
    }).filter(Boolean);
    await updateDoc(doc(db, "profiles", activeProfile), { characters: arrayUnion(...newChars) });
    setInputText('');
  };

  const filteredChars = useMemo(() => {
    const chars = profiles[activeProfile]?.characters || [];
    return search ? chars.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.series?.toLowerCase().includes(search.toLowerCase())) : chars;
  }, [profiles, activeProfile, search]);

  const toggleTradeTag = useCallback(async (series) => {
    if (!isUnlocked) return;
    const tagged = profiles[activeProfile]?.tradeTags?.includes(series);
    await updateDoc(doc(db, "profiles", activeProfile), { tradeTags: tagged ? arrayRemove(series) : arrayUnion(series) });
  }, [activeProfile, isUnlocked, profiles]);

  const handleDeleteCharacter = useCallback(async (char) => {
    if (!isUnlocked) return;
    await updateDoc(doc(db, "profiles", activeProfile), { characters: arrayRemove(char) });
  }, [activeProfile, isUnlocked]);

  return (
    <div className="min-h-screen bg-[#0b0f1a] text-slate-300 flex flex-col md:flex-row">
      <aside className="w-full md:w-64 bg-[#0f172a] border-r border-slate-800 p-6 space-y-8 shrink-0 z-50">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-pink-600 rounded-xl flex items-center justify-center text-white font-black italic shadow-lg shadow-pink-600/40">M</div>
          <h1 className="text-sm font-black text-white tracking-[0.2em] uppercase italic leading-none">Mudae<br/>Hub</h1>
        </div>
        <nav className="space-y-2">
          <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-4">Profiles</p>
          {Object.keys(profiles).map(name => (
            <button key={name} onClick={() => setActiveProfile(name)} className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-bold transition-all ${activeProfile === name ? 'bg-pink-600 text-white shadow-xl' : 'text-slate-400 hover:bg-white/5'}`}>
              <div className="flex items-center gap-2"><Users size={14}/> {name}</div>
              {isUnlocked && activeProfile === name && <Trash2 size={14} className="opacity-40 hover:opacity-100" onClick={(e) => { e.stopPropagation(); deleteDoc(doc(db, "profiles", name)); }}/>}
            </button>
          ))}
          <div className="pt-6 space-y-3">
            <input className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs outline-none focus:border-pink-600" placeholder="Friend's Name..." value={newProfileName} onChange={(e) => setNewProfileName(e.target.value)} />
            <button onClick={() => { if(!newProfileName) return; setDoc(doc(db, "profiles", newProfileName), { characters: [], tradeTags: [] }); setActiveProfile(newProfileName); setNewProfileName(''); }} className="w-full bg-slate-800 hover:bg-slate-700 py-3 rounded-xl text-xs font-bold transition-colors">Add New Profile +</button>
          </div>
        </nav>
      </aside>

      <main className="flex-1 p-4 md:p-10 overflow-y-auto">
        <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 mb-12">
          <div>
            <h2 className="text-6xl font-black text-white italic uppercase tracking-tighter leading-none">{activeProfile}</h2>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-[0.4em] mt-4 flex items-center gap-2">
               {filteredChars.length} Characters in harem
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl flex p-1.5 shadow-2xl">
              <input type="password" placeholder="PIN" className="bg-transparent px-3 w-16 text-xs outline-none font-bold" onChange={(e) => setPin(e.target.value)} />
              <button onClick={() => setIsUnlocked(pin === "1234")} className={`p-2.5 rounded-xl transition-all ${isUnlocked ? 'bg-green-500 text-white shadow-lg shadow-green-500/30' : 'text-slate-600 hover:bg-white/5'}`}>
                {isUnlocked ? <Unlock size={18}/> : <Lock size={18}/>}
              </button>
            </div>
            <button onClick={autoFixer} disabled={!isUnlocked || isFixing} className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white px-6 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-widest flex items-center gap-3 transition-all shadow-xl shadow-blue-600/20">
              {isFixing ? <RefreshCw size={16} className="animate-spin"/> : <RefreshCw size={16}/>}
              {isFixing ? `${progress.current} / ${progress.total}` : 'Auto-Fix Unknowns'}
            </button>
          </div>
        </header>

        <section className="grid grid-cols-1 lg:grid-cols-4 gap-10">
          <div className="lg:col-span-1 space-y-8">
            <div className="bg-[#111622] border border-slate-800 p-6 rounded-3xl space-y-6 shadow-2xl sticky top-24">
              <div className="relative">
                <Search className="absolute left-4 top-3.5 text-slate-600" size={16}/>
                <input className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-4 pl-12 pr-4 text-xs outline-none focus:border-pink-500 transition-all font-bold" placeholder="Search Harem..." onChange={(e) => setSearch(e.target.value)} />
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">Paste $mms l- k</label>
                <textarea className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-[10px] h-40 outline-none font-mono focus:border-pink-600 shadow-inner" placeholder="Paste Discord list here..." value={inputText} onChange={(e) => setInputText(e.target.value)} />
                <button onClick={handleImport} disabled={!isUnlocked} className="w-full bg-pink-600 hover:bg-pink-500 disabled:bg-slate-800 py-4 rounded-2xl text-xs font-black text-white uppercase tracking-widest transition-all shadow-xl shadow-pink-600/30">Import</button>
              </div>
            </div>
          </div>
          <div className="lg:col-span-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 md:gap-6">
              {filteredChars.map((char) => (
                <CharacterCard key={char.id} char={char} isUnlocked={isUnlocked} onDelete={handleDeleteCharacter} onToggleTrade={toggleTradeTag} isTagged={profiles[activeProfile]?.tradeTags?.includes(char.series)} />
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
