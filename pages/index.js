import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { db } from '../lib/firebase';
import { doc, setDoc, onSnapshot, collection, updateDoc, arrayUnion, arrayRemove, deleteDoc } from 'firebase/firestore';
import { Search, Lock, Unlock, Import, Plus, Tag, Trash2, X, RefreshCw, Users, Edit3 } from 'lucide-react';

const CharacterCard = React.memo(({ char, isUnlocked, onToggleTrade, onDelete, onEditSeries, isTagged }) => (
  <div className="group relative bg-[#1a202c] rounded-xl border border-slate-800 hover:border-pink-500/50 transition-all overflow-hidden shadow-lg">
    <div className="aspect-[2/3] relative bg-slate-900">
      <img src={`/api/mudae?name=${encodeURIComponent(char.name)}`} alt={char.name} className="w-full h-full object-cover" loading="lazy" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-70"></div>
      <div className="absolute top-2 left-2 bg-black/70 px-2 py-0.5 rounded text-[10px] font-bold text-orange-400 border border-white/5">{char.kakera.toLocaleString()}</div>
      {isUnlocked && (
        <button onClick={() => onDelete(char)} className="absolute top-2 right-2 p-1 bg-red-500/20 text-red-500 hover:bg-red-600 hover:text-white rounded opacity-0 group-hover:opacity-100 transition-all"><X size={12}/></button>
      )}
      <button onClick={() => onToggleTrade(char.series)} className={`absolute bottom-2 right-2 p-2 rounded-lg backdrop-blur-md transition-all ${isTagged ? 'bg-green-500 text-white' : 'bg-white/5 text-white/20 hover:bg-white/10'}`}><Tag size={12}/></button>
    </div>
    <div className="p-2.5">
      <h4 className="text-[10px] font-black text-white truncate uppercase tracking-tighter">{char.name}</h4>
      <div 
        onClick={() => isUnlocked && onEditSeries(char)} 
        className={`text-[8px] truncate font-bold uppercase mt-0.5 flex items-center gap-1 cursor-pointer ${char.series === 'Unknown Series' ? 'text-red-400' : 'text-slate-500'}`}
      >
        {char.series || 'Unknown Series'} {isUnlocked && <Edit3 size={8}/>}
      </div>
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
  const [fixStatus, setFixStatus] = useState({ current: 0, total: 0, name: '' });

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "profiles"), (snapshot) => {
      const data = {};
      snapshot.forEach(doc => data[doc.id] = doc.data());
      setProfiles(data);
      if (!activeProfile && Object.keys(data).length > 0) setActiveProfile(Object.keys(data)[0]);
    });
    return () => unsub();
  }, [activeProfile]);

  const smartFixer = async () => {
    if (!isUnlocked || isFixing) return;
    const allChars = [...(profiles[activeProfile]?.characters || [])];
    const targets = allChars.filter(c => c.series === "Unknown Series" || !c.series);
    if (!targets.length) return alert("Harem is updated!");

    setIsFixing(true);
    setFixStatus({ current: 0, total: targets.length, name: '' });

    for (let i = 0; i < targets.length; i++) {
      const char = targets[i];
      setFixStatus(s => ({ ...s, current: i + 1, name: char.name }));
      try {
        const res = await fetch(`/api/mudae?name=${encodeURIComponent(char.name)}&info=true`);
        const data = await res.json();
        const match = allChars.find(c => c.id === char.id);
        if (match && data.series && data.series !== "Unknown Series") match.series = data.series;
        if (i % 10 === 0) await updateDoc(doc(db, "profiles", activeProfile), { characters: allChars });
      } catch (e) {}
      await new Promise(r => setTimeout(r, 400));
    }
    await updateDoc(doc(db, "profiles", activeProfile), { characters: allChars });
    setIsFixing(false);
    setFixStatus({ current: 0, total: 0, name: '' });
  };

  const manualEditSeries = async (char) => {
    const newSeries = prompt(`Enter series name for ${char.name}:`, char.series);
    if (newSeries === null) return;
    const allChars = [...(profiles[activeProfile]?.characters || [])];
    const match = allChars.find(c => c.id === char.id);
    if (match) {
      match.series = newSeries;
      await updateDoc(doc(db, "profiles", activeProfile), { characters: allChars });
    }
  };

  const handleImport = async () => {
    if (!isUnlocked) return alert("Enter PIN!");
    const newChars = inputText.split('\n').map(line => {
      const kaMatch = line.match(/([\d,]+)\s*ka/);
      if (!kaMatch) return null;
      const kakera = parseInt(kaMatch[1].replace(/,/g, ''));
      const name = line.replace(/#[\d,]+ - /, '').replace(kaMatch[0], '').trim();
      return { name, series: "Unknown Series", kakera, keys: line.match(/\((\d+)\)/)?.[1] || 0, id: Math.random().toString(36).substr(2, 9) };
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
    const tagged = profiles[activeProfile]?.tradeTags?.includes(series);
    await updateDoc(doc(db, "profiles", activeProfile), { tradeTags: tagged ? arrayRemove(series) : arrayUnion(series) });
  }, [activeProfile, isUnlocked, profiles]);

  const handleDeleteCharacter = useCallback(async (char) => {
    if (!isUnlocked) return;
    await updateDoc(doc(db, "profiles", activeProfile), { characters: arrayRemove(char) });
  }, [activeProfile, isUnlocked]);

  return (
    <div className="min-h-screen bg-[#0b0f1a] text-slate-300 flex flex-col md:flex-row font-sans">
      <aside className="w-full md:w-56 bg-[#0f172a] border-r border-slate-800 p-5 space-y-6 shrink-0 z-50">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 bg-pink-600 rounded-lg flex items-center justify-center text-white font-black italic shadow-lg shadow-pink-600/20">M</div>
          <h1 className="text-xs font-black text-white tracking-widest uppercase italic">Mudae Hub</h1>
        </div>
        <nav className="space-y-1">
          {Object.keys(profiles).map(name => (
            <button key={name} onClick={() => setActiveProfile(name)} className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-bold transition-all ${activeProfile === name ? 'bg-pink-600 text-white shadow-lg shadow-pink-600/20' : 'text-slate-400 hover:bg-white/5'}`}>
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-tighter"><Users size={12}/> {name}</div>
              {isUnlocked && activeProfile === name && <Trash2 size={12} className="opacity-40 hover:opacity-100" onClick={(e) => { e.stopPropagation(); if(confirm(`Delete ${name}?`)) deleteDoc(doc(db, "profiles", name)); }}/>}
            </button>
          ))}
          <div className="pt-4 space-y-2">
            <input className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-[10px] outline-none focus:border-pink-600" placeholder="New Friend..." value={newProfileName} onChange={(e) => setNewProfileName(e.target.value)} />
            <button onClick={() => { if(!newProfileName) return; setDoc(doc(db, "profiles", newProfileName), { characters: [], tradeTags: [] }); setActiveProfile(newProfileName); setNewProfileName(''); }} className="w-full bg-slate-800 py-1.5 rounded-lg text-[10px] font-bold">Add +</button>
          </div>
        </nav>
      </aside>

      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-10">
          <div>
            <h2 className="text-5xl font-black text-white italic uppercase tracking-tighter leading-none">{activeProfile}</h2>
            <p className="text-slate-600 text-[10px] font-bold uppercase tracking-widest mt-2 italic">{filteredChars.length} Characters Loaded</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-slate-900 border border-slate-800 rounded-xl flex p-1 shadow-inner">
              <input type="password" placeholder="PIN" className="bg-transparent px-2 w-12 text-[10px] outline-none" onChange={(e) => setPin(e.target.value)} />
              <button onClick={() => setIsUnlocked(pin === "1234")} className={`p-1.5 rounded-lg transition-all ${isUnlocked ? 'text-green-500 bg-green-500/10' : 'text-slate-600'}`}>
                {isUnlocked ? <Unlock size={14}/> : <Lock size={14}/>}
              </button>
            </div>
            <button onClick={smartFixer} disabled={!isUnlocked || isFixing} className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-lg shadow-blue-600/20">
              {isFixing ? <RefreshCw size={12} className="animate-spin"/> : <RefreshCw size={12}/>}
              {isFixing ? `${fixStatus.current}/${fixStatus.total}` : 'Fix Unknown Series'}
            </button>
          </div>
        </header>

        {isFixing && (
          <div className="mb-6 bg-blue-500/10 border border-blue-500/20 p-3 rounded-xl flex items-center justify-between shadow-sm">
            <div className="text-[10px] font-bold text-blue-400 uppercase tracking-widest animate-pulse italic">Scanning: {fixStatus.name}</div>
            <div className="text-[10px] font-mono text-blue-500">{Math.round((fixStatus.current / fixStatus.total) * 100)}% COMPLETE</div>
          </div>
        )}

        <section className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-[#111622] border border-slate-800 p-5 rounded-2xl space-y-4 shadow-2xl">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 text-slate-600" size={14}/>
                <input className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-9 text-[10px] outline-none focus:border-pink-500 transition-all font-bold" placeholder="Search Harem..." onChange={(e) => setSearch(e.target.value)} />
              </div>
              <textarea className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-[10px] h-32 outline-none font-mono focus:border-pink-600 shadow-inner" placeholder="Paste $mms l- k here..." value={inputText} onChange={(e) => setInputText(e.target.value)} />
              <button onClick={handleImport} disabled={!isUnlocked} className="w-full bg-pink-600 hover:bg-pink-500 disabled:bg-slate-800 py-3 rounded-xl text-[10px] font-black text-white uppercase tracking-widest transition-all shadow-lg shadow-pink-600/20">Import Characters</button>
            </div>
          </div>
          <div className="lg:col-span-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
              {filteredChars.map((char) => (
                <CharacterCard key={char.id} char={char} isUnlocked={isUnlocked} onDelete={handleDeleteCharacter} onToggleTrade={toggleTradeTag} onEditSeries={manualEditSeries} isTagged={profiles[activeProfile]?.tradeTags?.includes(char.series)} />
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
