import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, setDoc, onSnapshot, collection, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { Search, Lock, Unlock, Import, Plus, Tag, Share2, RefreshCw } from 'lucide-react';

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
      if (!activeProfile && Object.keys(data).length > 0) {
        setActiveProfile(Object.keys(data)[0]);
      }
    });
    return () => unsub();
  }, [activeProfile]);

  const handleImport = async () => {
    if (!isUnlocked) return alert("Enter PIN to edit!");
    const lines = inputText.split('\n');
    const newCharacters = lines.map(line => {
      let name = "", kakera = 0;
      if (line.includes('#') && line.includes('ka')) {
        const cleanLine = line.replace(/#[\d,]+ - /, '').trim();
        const kaMatch = cleanLine.match(/([\d,]+)\s*ka/);
        if (kaMatch) {
          kakera = parseInt(kaMatch[1].replace(/,/g, ''));
          name = cleanLine.replace(kaMatch[0], '').trim();
        }
      } else if (line.includes('·')) {
        const parts = line.replace(/:[^:]+:/g, '').split('·').map(p => p.trim());
        name = parts[0];
        kakera = parts[2] ? parseInt(parts[2].replace(/,/g, '').replace('ka', '')) : 0;
      }
      if (!name) return null;
      return { name, series: "Unknown", kakera, keys: line.match(/\((\d+)\)/) ? line.match(/\((\d+)\)/)[1] : 0 };
    }).filter(Boolean);

    await setDoc(doc(db, "profiles", activeProfile), {
      characters: newCharacters,
      lastUpdated: new Date().toLocaleString()
    }, { merge: true });
    setInputText('');
  };

  const createProfile = async () => {
    if (!newProfileName) return;
    await setDoc(doc(db, "profiles", newProfileName), { characters: [], tradeTags: [], lastUpdated: new Date().toLocaleString() });
    setActiveProfile(newProfileName);
    setNewProfileName('');
  };

  const toggleTradeTag = async (series) => {
    if (!isUnlocked) return;
    const isTagged = profiles[activeProfile]?.tradeTags?.includes(series);
    await updateDoc(doc(db, "profiles", activeProfile), {
      tradeTags: isTagged ? arrayRemove(series) : arrayUnion(series)
    });
  };

  const filteredChars = (profiles[activeProfile]?.characters || []).filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || c.series.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#0b0f1a] text-slate-300 font-sans">
      <nav className="border-b border-slate-800 bg-[#0f172a]/50 sticky top-0 z-50 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-pink-600 rounded flex items-center justify-center text-white font-black">M</div>
            <span className="font-black text-white tracking-widest uppercase text-sm">Mudae Hub</span>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-800">
              <input type="password" placeholder="PIN" className="bg-transparent px-2 w-16 text-xs outline-none" onChange={(e) => setPin(e.target.value)} />
              <button onClick={() => setIsUnlocked(pin === "1234")} className={isUnlocked ? 'text-green-500' : 'text-slate-600'}>
                {isUnlocked ? <Unlock size={16}/> : <Lock size={16}/>}
              </button>
            </div>
            <select value={activeProfile} onChange={(e) => setActiveProfile(e.target.value)} className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs font-bold text-pink-500">
              {Object.keys(profiles).map(name => <option key={name} value={name}>{name}</option>)}
            </select>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-slate-600" size={14}/>
              <input className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 pl-9 pr-4 text-xs focus:border-pink-600 outline-none" placeholder="Search harem..." onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>

          <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 block">Import List ($mm)</label>
            <textarea className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-[10px] h-32 outline-none focus:border-pink-600" placeholder="Paste Discord text here..." value={inputText} onChange={(e) => setInputText(e.target.value)} />
            <button onClick={handleImport} disabled={!isUnlocked} className="w-full mt-3 bg-pink-600 hover:bg-pink-500 disabled:bg-slate-800 py-2 rounded-lg text-xs font-bold text-white transition-all">Update Collection</button>
          </div>

          <div className="flex gap-2">
            <input className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs" placeholder="New Profile..." value={newProfileName} onChange={(e) => setNewProfileName(e.target.value)} />
            <button onClick={createProfile} className="bg-slate-800 p-2 rounded-lg hover:bg-slate-700 text-white"><Plus size={18}/></button>
          </div>
        </div>

        <div className="lg:col-span-9">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-4xl font-black text-white italic uppercase tracking-tighter">{activeProfile}</h2>
            <div className="text-[10px] text-slate-500 font-mono">COUNT: {filteredChars.length}</div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-6">
            {filteredChars.map((char, i) => (
              <div key={i} className="group relative bg-[#161b29] rounded-xl border border-slate-800 hover:border-pink-600/50 transition-all overflow-hidden shadow-2xl">
                <div className="aspect-[2/3] relative">
                  <img src={`/api/mudae?name=${encodeURIComponent(char.name)}`} alt={char.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" loading="lazy" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-60"></div>
                  
                  <div className="absolute top-2 left-2 bg-black/80 px-2 py-0.5 rounded text-[10px] font-bold text-orange-400 border border-orange-400/20">{char.kakera} ka</div>
                  {char.keys > 0 && <div className="absolute top-2 right-2 bg-pink-600 px-2 py-0.5 rounded text-[10px] font-bold text-white shadow-lg">🔑 {char.keys}</div>}
                  
                  <button onClick={() => toggleTradeTag(char.series)} className={`absolute bottom-3 right-3 p-2 rounded-full backdrop-blur-md transition-all ${profiles[activeProfile]?.tradeTags?.includes(char.series) ? 'bg-green-500 text-white shadow-[0_0_15px_rgba(34,197,94,0.5)]' : 'bg-black/40 text-white/50 hover:bg-black/60'}`}>
                    <Tag size={12}/>
                  </button>
                </div>

                <div className="p-3 relative bg-[#161b29]">
                  <h4 className="text-xs font-black text-white truncate uppercase tracking-tight">{char.name}</h4>
                  <p className="text-[9px] text-slate-500 truncate font-bold uppercase">{char.series}</p>
                  {profiles[activeProfile]?.tradeTags?.includes(char.series) && (
                    <div className="mt-2 text-[8px] font-black text-green-400 flex items-center gap-1">
                      <div className="w-1 h-1 bg-green-400 rounded-full animate-pulse"></div> FOR TRADE
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
