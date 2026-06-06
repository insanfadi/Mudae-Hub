import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { db } from '../lib/firebase';
import { doc, setDoc, onSnapshot, collection, updateDoc, arrayUnion, arrayRemove, deleteDoc } from 'firebase/firestore';
import { Search, Lock, Unlock, Import, Plus, Tag, Share2, Trash2, X } from 'lucide-react';

// Optimized Card Component to prevent lag
const CharacterCard = React.memo(({ char, isUnlocked, onToggleTrade, onDelete, isTagged }) => (
  <div className="group relative bg-[#161b29] rounded-xl border border-slate-800 hover:border-pink-600/50 transition-all overflow-hidden shadow-xl">
    <div className="aspect-[2/3] relative">
      <img 
        src={`/api/mudae?name=${encodeURIComponent(char.name)}`} 
        alt={char.name} 
        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
        loading="lazy" 
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60"></div>
      <div className="absolute top-2 left-2 bg-black/80 px-2 py-0.5 rounded text-[10px] font-bold text-orange-400 border border-orange-400/20">{char.kakera} ka</div>
      
      {isUnlocked && (
        <button onClick={() => onDelete(char)} className="absolute top-2 right-2 p-1.5 bg-black/60 text-white/50 hover:text-red-500 rounded-lg backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all">
          <X size={14}/>
        </button>
      )}

      <button onClick={() => onToggleTrade(char.series)} className={`absolute bottom-3 right-3 p-2 rounded-full backdrop-blur-md transition-all shadow-lg ${isTagged ? 'bg-green-500 text-white' : 'bg-black/40 text-white/50 hover:bg-black/60'}`}>
        <Tag size={12}/>
      </button>
    </div>
    <div className="p-3 relative bg-[#161b29]">
      <h4 className="text-[11px] font-black text-white truncate uppercase tracking-tight">{char.name}</h4>
      <p className="text-[9px] text-slate-600 truncate font-bold uppercase">{char.series || 'Unknown'}</p>
      {isTagged && (
        <div className="mt-2 text-[8px] font-black text-green-400 flex items-center gap-1 italic">
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

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "profiles"), (snapshot) => {
      const data = {};
      snapshot.forEach(doc => data[doc.id] = doc.data());
      setProfiles(data);
      if (!activeProfile && Object.keys(data).length > 0) setActiveProfile(Object.keys(data)[0]);
    });
    return () => unsub();
  }, [activeProfile]);

  const handleDeleteProfile = async (name) => {
    if (!isUnlocked) return alert("Enter PIN!");
    if (confirm(`Delete "${name}"?`)) {
      await deleteDoc(doc(db, "profiles", name));
      setActiveProfile(Object.keys(profiles).filter(p => p !== name)[0] || '');
    }
  };

  const handleDeleteCharacter = useCallback(async (char) => {
    if (!isUnlocked) return;
    await updateDoc(doc(db, "profiles", activeProfile), { characters: arrayRemove(char) });
  }, [activeProfile, isUnlocked]);

  const toggleTradeTag = useCallback(async (series) => {
    if (!isUnlocked) return;
    const isTagged = profiles[activeProfile]?.tradeTags?.includes(series);
    await updateDoc(doc(db, "profiles", activeProfile), {
      tradeTags: isTagged ? arrayRemove(series) : arrayUnion(series)
    });
  }, [activeProfile, isUnlocked, profiles]);

  // Optimized Search Filter
  const filteredChars = useMemo(() => {
    const chars = profiles[activeProfile]?.characters || [];
    if (!search) return chars;
    return chars.filter(c => 
      c.name.toLowerCase().includes(search.toLowerCase()) || 
      (c.series && c.series.toLowerCase().includes(search.toLowerCase()))
    );
  }, [profiles, activeProfile, search]);

  const handleImport = async () => {
    if (!isUnlocked) return alert("Enter PIN!");
    const lines = inputText.split('\n');
    const newChars = lines.map(line => {
      let name = "", kakera = 0;
      if (line.includes('#') && line.includes('ka')) {
        const clean = line.replace(/#[\d,]+ - /, '').trim();
        const ka = clean.match(/([\d,]+)\s*ka/);
        if (ka) { kakera = parseInt(ka[1].replace(/,/g, '')); name = clean.replace(ka[0], '').trim(); }
      } else if (line.includes('·')) {
        const parts = line.replace(/:[^:]+:/g, '').split('·').map(p => p.trim());
        name = parts[0]; kakera = parts[2] ? parseInt(parts[2].replace(/,/g, '').replace('ka', '')) : 0;
      }
      return name ? { name, series: "Unknown", kakera, keys: line.match(/\((\d+)\)/)?.[1] || 0, id: Math.random().toString(36).substr(2, 9) } : null;
    }).filter(Boolean);

    await setDoc(doc(db, "profiles", activeProfile), { characters: arrayUnion(...newChars), lastUpdated: new Date().toLocaleString() }, { merge: true });
    setInputText('');
  };

  return (
    <div className="min-h-screen bg-[#0b0f1a] text-slate-300">
      <nav className="border-b border-slate-800 bg-[#0f172a]/90 sticky top-0 z-50 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-pink-600 rounded flex items-center justify-center text-white font-black">M</div>
            <span className="font-black text-white text-xs hidden sm:block tracking-widest">MUDAE HUB</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-800">
              <input type="password" placeholder="PIN" className="bg-transparent px-2 w-16 text-[10px] outline-none" onChange={(e) => setPin(e.target.value)} />
              <button onClick={() => setIsUnlocked(pin === "1234")} className={isUnlocked ? 'text-green-500' : 'text-slate-600'}>
                {isUnlocked ? <Unlock size={14}/> : <Lock size={14}/>}
              </button>
            </div>
            <select value={activeProfile} onChange={(e) => setActiveProfile(e.target.value)} className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs font-bold text-pink-500 outline-none">
              {Object.keys(profiles).map(name => <option key={name} value={name}>{name}</option>)}
            </select>
            {isUnlocked && activeProfile && <button onClick={() => handleDeleteProfile(activeProfile)} className="text-slate-600 hover:text-red-500"><Trash2 size={16}/></button>}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl">
            <Search className="absolute ml-3 mt-2.5 text-slate-600" size={14}/>
            <input className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 pl-9 text-xs outline-none focus:border-pink-600" placeholder="Search..." onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl">
            <textarea className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-[10px] h-32 outline-none font-mono" placeholder="Paste $mms l- k here..." value={inputText} onChange={(e) => setInputText(e.target.value)} />
            <button onClick={handleImport} disabled={!isUnlocked} className="w-full mt-3 bg-pink-600 py-2 rounded-lg text-xs font-bold text-white shadow-lg">Update Collection</button>
          </div>
          <div className="flex gap-2">
            <input className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs" placeholder="New Profile..." value={newProfileName} onChange={(e) => setNewProfileName(e.target.value)} />
            <button onClick={() => { if (!newProfileName) return; setDoc(doc(db, "profiles", newProfileName), { characters: [], tradeTags: [] }); setActiveProfile(newProfileName); setNewProfileName(''); }} className="bg-slate-800 p-2 rounded-lg hover:bg-slate-700"><Plus size={18}/></button>
          </div>
        </div>

        <div className="lg:col-span-9">
          <h2 className="text-4xl font-black text-white italic uppercase mb-6">{activeProfile} <span className="text-xs text-slate-600 not-italic ml-2">({filteredChars.length})</span></h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredChars.map((char) => (
              <CharacterCard 
                key={char.id} 
                char={char} 
                isUnlocked={isUnlocked} 
                onDelete={handleDeleteCharacter} 
                onToggleTrade={toggleTradeTag}
                isTagged={profiles[activeProfile]?.tradeTags?.includes(char.series)}
              />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
