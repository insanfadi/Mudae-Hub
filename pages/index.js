import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { db } from '../lib/firebase';
import { doc, setDoc, onSnapshot, collection, updateDoc, arrayUnion, arrayRemove, deleteDoc } from 'firebase/firestore';
import { Search, Lock, Unlock, Import, Plus, Tag, Trash2, X, RefreshCw, Users, LayoutGrid, CheckCircle2 } from 'lucide-react';

const CharacterCard = React.memo(({ char, isUnlocked, onToggleTrade, onDelete, isTagged }) => (
  <div className="group relative bg-[#1a1f2e] rounded-2xl border border-slate-800 hover:border-pink-500/50 transition-all duration-300 overflow-hidden shadow-2xl">
    <div className="aspect-[2/3] relative bg-slate-900 overflow-hidden">
      <img src={`/api/mudae?name=${encodeURIComponent(char.name)}`} alt={char.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" loading="lazy" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0b0f1a] via-transparent to-transparent opacity-90"></div>
      
      {/* Kakera Badge */}
      <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg text-[10px] font-black text-orange-400 border border-white/5">
        {char.kakera.toLocaleString()}
      </div>

      {/* Delete Button */}
      {isUnlocked && (
        <button onClick={() => onDelete(char)} className="absolute top-2 right-2 p-1.5 bg-red-500/20 text-red-500 hover:bg-red-500 hover:text-white rounded-lg backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all">
          <X size={14}/>
        </button>
      )}

      {/* Trade Toggle */}
      <button onClick={() => onToggleTrade(char.series)} className={`absolute bottom-3 right-3 p-2.5 rounded-xl backdrop-blur-md transition-all shadow-xl ${isTagged ? 'bg-green-500 text-white shadow-green-500/20' : 'bg-white/5 text-white/20 hover:bg-white/10'}`}>
        <Tag size={14} fill={isTagged ? "currentColor" : "none"}/>
      </button>
    </div>

    <div className="p-3">
      <h4 className="text-[11px] font-black text-white truncate uppercase tracking-tight">{char.name}</h4>
      <p className="text-[9px] text-slate-500 truncate font-bold uppercase tracking-widest mt-0.5">{char.series || 'Unknown'}</p>
      {isTagged && (
        <div className="mt-2 text-[8px] font-black text-green-400 flex items-center gap-1.5 bg-green-400/10 w-fit px-2 py-0.5 rounded-full border border-green-400/20">
          <div className="w-1 h-1 bg-green-400 rounded-full animate-pulse"></div> FOR TRADE
        </div>
      )}
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

  // SMART PARALLEL FIXER (3x Faster)
  const smartFixer = async () => {
    if (!isUnlocked || isFixing) return;
    const allChars = [...(profiles[activeProfile]?.characters || [])];
    const targetChars = allChars.filter(c => c.series === "Unknown" || !c.series);
    
    if (targetChars.length === 0) return alert("Harem is already fully detailed!");
    
    setIsFixing(true);
    setProgress({ current: 0, total: targetChars.length });

    // Process in batches of 3
    for (let i = 0; i < targetChars.length; i += 3) {
      const batch = targetChars.slice(i, i + 3);
      await Promise.all(batch.map(async (char) => {
        try {
          const res = await fetch(`/api/mudae?name=${encodeURIComponent(char.name)}&info=true`);
          const data = await res.json();
          const mainChar = allChars.find(c => c.id === char.id);
          if (mainChar && data.series) {
            mainChar.series = data.series;
            setProgress(prev => ({ ...prev, current: prev.current + 1 }));
          }
        } catch (e) { console.error(e); }
      }));
      
      // Save progress to database every 15 successful fixes
      if (i % 15 === 0) {
        await updateDoc(doc(db, "profiles", activeProfile), { characters: allChars });
      }
      // Tiny delay to keep AniList happy
      await new Promise(r => setTimeout(r, 800));
    }

    await updateDoc(doc(db, "profiles", activeProfile), { characters: allChars });
    setIsFixing(false);
    alert("Harem Cleaned & Updated!");
  };

  const handleImport = async () => {
    if (!isUnlocked) return alert("Enter PIN!");
    const lines = inputText.split('\n');
    const newChars = lines.map(line => {
      const kaMatch = line.match(/([\d,]+)\s*ka/);
      if (!kaMatch) return null;
      const kakera = parseInt(kaMatch[1].replace(/,/g, ''));
      const name = line.replace(/#[\d,]+ - /, '').replace(kaMatch[0], '').trim();
      return { name, series: "Unknown", kakera, keys: line.match(/\((\d+)\)/)?.[1] || 0, id: Math.random().toString(36).substr(2, 9) };
    }).filter(Boolean);

    await updateDoc(doc(db, "profiles", activeProfile), { characters: arrayUnion(...newChars) });
    setInputText('');
  };

  const filteredChars = useMemo(() => {
    const chars = profiles[activeProfile]?.characters || [];
    const s = search.toLowerCase();
    return s ? chars.filter(c => c.name.toLowerCase().includes(s) || c.series?.toLowerCase().includes(s)) : chars;
  }, [profiles, activeProfile, search]);

  const toggleTradeTag = useCallback(async (series) => {
    if (!isUnlocked) return;
    const isTagged = profiles[activeProfile]?.tradeTags?.includes(series);
    await updateDoc(doc(db, "profiles", activeProfile), { tradeTags: isTagged ? arrayRemove(series) : arrayUnion(series) });
  }, [activeProfile, isUnlocked, profiles]);

  const handleDeleteCharacter = useCallback(async (char) => {
    if (!isUnlocked) return;
    await updateDoc(doc(db, "profiles", activeProfile), { characters: arrayRemove(char) });
  }, [activeProfile, isUnlocked]);

  return (
    <div className="min-h-screen bg-[#0b0f1a] text-slate-300 flex flex-col md:flex-row">
      
      {/* SIDEBAR - PROFILE SWITCHER */}
      <aside className="w-full md:w-64 bg-[#0f172a] border-r border-slate-800 p-6 space-y-8 z-50">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-rose-600 rounded-xl flex items-center justify-center text-white font-black shadow-lg shadow-pink-500/20">M</div>
          <h1 className="text-lg font-black text-white tracking-tighter uppercase leading-none">Mudae<br/>Hub</h1>
        </div>

        <nav className="space-y-1">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 block">Switch Profiles</label>
          {Object.keys(profiles).map(name => (
            <button 
              key={name} 
              onClick={() => setActiveProfile(name)}
              className={`w-full flex items-center justify-between group px-4 py-3 rounded-xl text-xs font-bold transition-all ${activeProfile === name ? 'bg-pink-600 text-white shadow-lg shadow-pink-600/20' : 'text-slate-400 hover:bg-white/5'}`}
            >
              <div className="flex items-center gap-3"><Users size={14}/> {name}</div>
              {isUnlocked && activeProfile === name && (
                <Trash2 size={14} className="text-white/40 hover:text-white" onClick={(e) => { e.stopPropagation(); if(confirm(`Delete ${name}?`)) deleteDoc(doc(db, "profiles", name)); }}/>
              )}
            </button>
          ))}
          
          <div className="pt-4 space-y-2">
            <input className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-[10px] focus:border-pink-600 outline-none transition-colors" placeholder="Create Profile..." value={newProfileName} onChange={(e) => setNewProfileName(e.target.value)} />
            <button onClick={() => { if(!newProfileName) return; setDoc(doc(db, "profiles", newProfileName), { characters: [], tradeTags: [] }); setActiveProfile(newProfileName); setNewProfileName(''); }} className="w-full bg-slate-800 hover:bg-slate-700 py-2 rounded-xl text-[10px] font-bold transition-all">Add Friend +</button>
          </div>
        </nav>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 p-4 md:p-10 lg:p-16 overflow-y-auto">
        <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-12">
          <div>
            <h2 className="text-6xl font-black text-white italic uppercase tracking-tighter leading-none mb-2">{activeProfile}</h2>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-[0.3em] flex items-center gap-2">
              <LayoutGrid size={12}/> {filteredChars.length} Total Characters
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl flex p-1.5">
              <input type="password" placeholder="PIN" className="bg-transparent px-3 w-16 text-xs outline-none" onChange={(e) => setPin(e.target.value)} />
              <button onClick={() => setIsUnlocked(pin === "1234")} className={`p-2 rounded-xl transition-all ${isUnlocked ? 'bg-green-500 text-white shadow-lg shadow-green-500/20' : 'text-slate-600 hover:bg-white/5'}`}>
                {isUnlocked ? <Unlock size={16}/> : <Lock size={16}/>}
              </button>
            </div>
            
            <button 
              onClick={smartFixer} 
              disabled={!isUnlocked || isFixing} 
              className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-blue-500/20 flex items-center gap-3 transition-all"
            >
              {isFixing ? <RefreshCw size={16} className="animate-spin"/> : <CheckCircle2 size={16}/>}
              {isFixing ? `FIXING: ${progress.current}/${progress.total}` : 'Smart Fix Series'}
            </button>
          </div>
        </header>

        <section className="grid grid-cols-1 lg:grid-cols-4 gap-10">
          {/* Controls */}
          <div className="lg:col-span-1 space-y-8">
            <div className="bg-[#111622] border border-slate-800 p-6 rounded-3xl space-y-6">
              <div className="relative">
                <Search className="absolute left-4 top-3.5 text-slate-600" size={16}/>
                <input className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3.5 pl-12 pr-4 text-xs outline-none focus:border-pink-500 transition-all" placeholder="Search harem..." onChange={(e) => setSearch(e.target.value)} />
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Bulk Import ($mms)</label>
                <textarea className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-[10px] h-40 outline-none font-mono focus:border-pink-600 transition-all" placeholder="Paste Discord text here..." value={inputText} onChange={(e) => setInputText(e.target.value)} />
                <button onClick={handleImport} disabled={!isUnlocked} className="w-full bg-pink-600 hover:bg-pink-500 disabled:bg-slate-800 py-4 rounded-2xl text-xs font-black text-white uppercase tracking-widest transition-all shadow-xl shadow-pink-600/20">Update Collection</button>
              </div>
            </div>
          </div>
