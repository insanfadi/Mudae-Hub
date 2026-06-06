import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { db } from '../lib/firebase';
import { doc, setDoc, onSnapshot, collection, updateDoc, arrayUnion, arrayRemove, deleteDoc } from 'firebase/firestore';
import { Search, Lock, Unlock, Import, Plus, Tag, Share2, Trash2, X, RefreshCw } from 'lucide-react';

const CharacterCard = React.memo(({ char, isUnlocked, onToggleTrade, onDelete, isTagged }) => (
  <div className="group relative bg-[#111622] rounded-xl border border-slate-800 hover:border-pink-600/50 transition-all overflow-hidden shadow-2xl">
    <div className="aspect-[2/3] relative bg-slate-900">
      <img src={`/api/mudae?name=${encodeURIComponent(char.name)}`} alt={char.name} className="w-full h-full object-cover" loading="lazy" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0b0f1a] via-transparent to-transparent opacity-80"></div>
      <div className="absolute top-2 left-2 bg-black/80 px-2 py-0.5 rounded text-[10px] font-bold text-orange-400 border border-orange-400/20">{char.kakera.toLocaleString()} ka</div>
      {isUnlocked && (
        <button onClick={() => onDelete(char)} className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all"><X size={12}/></button>
      )}
      <button onClick={() => onToggleTrade(char.series)} className={`absolute bottom-3 right-3 p-2 rounded-full backdrop-blur-md transition-all ${isTagged ? 'bg-green-500 text-white' : 'bg-white/5 text-white/30'}`}><Tag size={10}/></button>
    </div>
    <div className="p-2.5">
      <h4 className="text-[10px] font-black text-white truncate uppercase tracking-tighter">{char.name}</h4>
      <p className="text-[8px] text-slate-500 truncate font-bold uppercase">{char.series || 'Unknown'}</p>
      {isTagged && <div className="mt-1 text-[7px] font-black text-green-400 italic">FOR TRADE</div>}
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
  const [isFixing, setIsFixing] = useState(false);
  const [fixStatus, setFixStatus] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "profiles"), (snapshot) => {
      const data = {};
      snapshot.forEach(doc => data[doc.id] = doc.data());
      setProfiles(data);
      if (!activeProfile && Object.keys(data).length > 0) setActiveProfile(Object.keys(data)[0]);
    });
    return () => unsub();
  }, [activeProfile]);

  const fixSeriesNames = async () => {
    if (!isUnlocked || isFixing) return;
    setIsFixing(true);
    const currentChars = [...(profiles[activeProfile]?.characters || [])];
    let updatedCount = 0;

    for (let i = 0; i < currentChars.length; i++) {
      if (currentChars[i].series === "Unknown" || !currentChars[i].series) {
        setFixStatus(`Fixing: ${currentChars[i].name}...`);
        try {
          const res = await fetch(`/api/mudae?name=${encodeURIComponent(currentChars[i].name)}&info=true`);
          const data = await res.json();
          if (data.series) {
            currentChars[i].series = data.series;
            updatedCount++;
          }
        } catch (e) { console.error(e); }
        if (updatedCount >= 15) break; // Do 15 at a time
      }
    }

    await updateDoc(doc(db, "profiles", activeProfile), { characters: currentChars });
    setIsFixing(false);
    setFixStatus('');
    alert(`Successfully updated ${updatedCount} characters!`);
  };

  const handleImport = async () => {
    if (!isUnlocked) return alert("Enter PIN!");
    const lines = inputText.split('\n');
    const newChars = lines.map(line => {
      let name = "", kakera = 0;
      const kaMatch = line.match(/([\d,]+)\s*ka/);
      if (kaMatch) {
        kakera = parseInt(kaMatch[1].replace(/,/g, ''));
        name = line.replace(/#[\d,]+ - /, '').replace(kaMatch[0], '').trim();
      }
      return name ? { name, series: "Unknown", kakera, keys: line.match(/\((\d+)\)/)?.[1] || 0, id: Math.random().toString(36).substr(2, 9) } : null;
    }).filter(Boolean);

    await updateDoc(doc(db, "profiles", activeProfile), { characters: arrayUnion(...newChars) });
    setInputText('');
  };

  const filteredChars = useMemo(() => {
    const chars = profiles[activeProfile]?.characters || [];
    if (!search) return chars;
    return chars.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.series?.toLowerCase().includes(search.toLowerCase()));
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
    <div className="min-h-screen bg-[#0b0f1a] text-slate-300">
      <nav className="border-b border-slate-800 bg-[#0f172a]/95 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="font-black text-white text-xs tracking-widest uppercase">MUDAE HUB</div>
          <div className="flex items-center gap-3">
            <div className="flex bg-slate-900 rounded p-1 border border-slate-800">
              <input type="password" placeholder="PIN" className="bg-transparent px-2 w-12 text-[10px] outline-none" onChange={(e) => setPin(e.target.value)} />
              <button onClick={() => setIsUnlocked(pin === "1234")} className={isUnlocked ? 'text-green-500' : 'text-slate-600'}><Unlock size={12}/></button>
            </div>
            <select value={activeProfile} onChange={(e) => setActiveProfile(e.target.value)} className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[10px] font-bold text-pink-500">
              {Object.keys(profiles).map(name => <option key={name} value={name}>{name}</option>)}
            </select>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl">
             <button onClick={fixSeriesNames} disabled={!isUnlocked || isFixing} className="w-full mb-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 py-2 rounded text-[10px] font-bold text-white flex items-center justify-center gap-2">
              <RefreshCw size={12} className={isFixing ? 'animate-spin' : ''}/> {isFixing ? 'Fixing...' : 'Fix Unknown Series'}
            </button>
            {fixStatus && <div className="text-[9px] text-blue-400 text-center mb-2 animate-pulse">{fixStatus}</div>}
            
            <div className="relative mb-3">
              <Search className="absolute left-2.5 top-2.5 text-slate-600" size={12}/>
              <input className="w-full bg-slate-950 border border-slate-800 rounded py-2 pl-8 text-[10px] outline-none" placeholder="Search..." onChange={(e) => setSearch(e.target.value)} />
            </div>

            <textarea className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-[10px] h-24 outline-none font-mono" placeholder="Paste $mms l- k here..." value={inputText} onChange={(e) => setInputText(e.target.value)} />
            <button onClick={handleImport} disabled={!isUnlocked} className="w-full mt-2 bg-pink-600 py-2 rounded text-xs font-bold text-white">Update Collection</button>
          </div>
        </div>

        <div className="lg:col-span-9">
          <h2 className="text-3xl font-black text-white italic uppercase mb-4">{activeProfile} <span className="text-xs text-slate-600 not-italic ml-2">({filteredChars.length})</span></h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
            {filteredChars.map((char) => (
              <CharacterCard key={char.id} char={char} isUnlocked={isUnlocked} onDelete={handleDeleteCharacter} onToggleTrade={toggleTradeTag} isTagged={profiles[activeProfile]?.tradeTags?.includes(char.series)} />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
