import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, setDoc, onSnapshot, collection, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { Search, Lock, Unlock, Import, Plus, Tag, Share2 } from 'lucide-react';

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
    if (!isUnlocked) return alert("Enter the correct PIN to edit!");
    if (!activeProfile) return alert("Select or create a profile first!");
    
    const lines = inputText.split('\n');
    const newCharacters = lines.map(line => {
      let name = "", series = "Unknown", kakera = 0;

      // New Format Support: #123 - Name 456 ka
      if (line.includes('#') && line.includes('ka')) {
        const cleanLine = line.replace(/#[\d,]+ - /, '').trim();
        const kaMatch = cleanLine.match(/([\d,]+)\s*ka/);
        if (kaMatch) {
          kakera = parseInt(kaMatch[1].replace(/,/g, ''));
          name = cleanLine.replace(kaMatch[0], '').trim();
        }
      } 
      // Original Format: Name · Series · Kakera
      else if (line.includes('·')) {
        const parts = line.replace(/:[^:]+:/g, '').split('·').map(p => p.trim());
        name = parts[0];
        series = parts[1] || "Unknown";
        kakera = parts[2] ? parseInt(parts[2].replace(/,/g, '').replace('ka', '')) : 0;
      }

      if (!name) return null;
      return { 
        name, 
        series, 
        kakera, 
        keys: line.match(/\((\d+)\)/) ? line.match(/\((\d+)\)/)[1] : 0 
      };
    }).filter(Boolean);

    await setDoc(doc(db, "profiles", activeProfile), {
      characters: newCharacters,
      lastUpdated: new Date().toLocaleString()
    }, { merge: true });
    
    setInputText('');
    alert(`Imported ${newCharacters.length} characters!`);
  };

  const createProfile = async () => {
    if (!newProfileName) return;
    await setDoc(doc(db, "profiles", newProfileName), {
      characters: [],
      tradeTags: [],
      lastUpdated: new Date().toLocaleString()
    });
    setActiveProfile(newProfileName);
    setNewProfileName('');
  };

  const toggleTradeTag = async (series) => {
    if (!isUnlocked) return;
    const profileRef = doc(db, "profiles", activeProfile);
    const isTagged = profiles[activeProfile]?.tradeTags?.includes(series);
    await updateDoc(profileRef, {
      tradeTags: isTagged ? arrayRemove(series) : arrayUnion(series)
    });
  };

  const filteredChars = (profiles[activeProfile]?.characters || []).filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.series.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 p-4 pb-20">
      <header className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4 mb-8 border-b border-slate-800 pb-6">
        <div className="flex items-center gap-3">
          <div className="bg-pink-600 p-2 rounded-lg"><Share2 size={24} className="text-white"/></div>
          <h1 className="text-2xl font-black text-white tracking-tight uppercase">Mudae Hub</h1>
        </div>
        <div className="flex items-center gap-4 bg-slate-800/50 p-2 rounded-xl border border-slate-700">
          <div className="flex items-center gap-2 px-2 border-r border-slate-700">
            <input 
              type="password" 
              placeholder="PIN" 
              className="bg-transparent w-16 text-sm outline-none focus:text-pink-400"
              onChange={(e) => setPin(e.target.value)}
            />
            <button 
              onClick={() => setIsUnlocked(pin === "1234")}
              className={`transition-all ${isUnlocked ? 'text-green-400' : 'text-slate-500'}`}
            >
              {isUnlocked ? <Unlock size={20}/> : <Lock size={20}/>}
            </button>
          </div>
          <select 
            value={activeProfile} 
            onChange={(e) => setActiveProfile(e.target.value)}
            className="bg-transparent text-sm font-bold outline-none cursor-pointer text-pink-400"
          >
            {Object.keys(profiles).map(name => <option key={name} value={name}>{name}</option>)}
          </select>
        </div>
      </header>

      <main className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 text-slate-500" size={18}/>
            <input 
              className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:border-pink-500 outline-none transition-all"
              placeholder="Search Harem..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="bg-slate-800/40 border border-slate-700 p-4 rounded-2xl">
            <h3 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2">
              <Import size={14}/> Import Data ($mm)
            </h3>
            <textarea 
              className="w-full bg-slate-900 rounded-lg p-3 text-[10px] h-24 mb-3 outline-none focus:ring-1 ring-pink-500"
              placeholder="Paste bot output here..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
            />
            <button onClick={handleImport} disabled={!isUnlocked} className="w-full bg-pink-600 hover:bg-pink-500 disabled:bg-slate-700 text-white font-bold py-2 rounded-lg text-xs transition-all">
              Update Profile
            </button>
          </div>
          <div className="flex gap-2">
            <input 
              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs"
              placeholder="New Profile Name"
              value={newProfileName}
              onChange={(e) => setNewProfileName(e.target.value)}
            />
            <button onClick={createProfile} className="bg-slate-700 p-2 rounded-lg hover:bg-slate-600"><Plus size={18}/></button>
          </div>
        </div>

        <div className="lg:col-span-3">
          <div className="flex justify-between items-end mb-6">
            <h2 className="text-3xl font-bold text-white uppercase tracking-tighter">{activeProfile || 'No Profile'}</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredChars.map((char, i) => (
              <div key={i} className="group bg-slate-800/40 border border-slate-700 rounded-xl overflow-hidden hover:border-pink-500/50 transition-all shadow-lg">
                <div className="aspect-[2/3] relative overflow-hidden bg-slate-900">
                  <img 
                    src={`/api/mudae?name=${encodeURIComponent(char.name)}`} 
                    alt={char.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    loading="lazy"
                  />
                  <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-md px-1.5 py-0.5 rounded text-[10px] font-bold text-orange-400">
                    {char.kakera} ka
                  </div>
                  {char.keys > 0 && (
                    <div className="absolute top-2 right-2 bg-pink-600 px-1.5 py-0.5 rounded text-[10px] font-bold text-white shadow-lg">🔑 {char.keys}</div>
                  )}
                  <button onClick={() => toggleTradeTag(char.series)} className={`absolute bottom-2 right-2 p-1.5 rounded-lg backdrop-blur-md transition-all shadow-md ${profiles[activeProfile]?.tradeTags?.includes(char.series) ? 'bg-green-500 text-white' : 'bg-black/40 text-white/50 hover:bg-black/60'}`}>
                    <Tag size={14}/>
                  </button>
                </div>
                <div className="p-3">
                  <h4 className="text-xs font-bold text-white truncate">{char.name}</h4>
                  <p className="text-[10px] text-slate-500 truncate">{char.series}</p>
                  {profiles[activeProfile]?.tradeTags?.includes(char.series) && (
                    <span className="inline-block mt-2 text-[9px] font-bold text-green-400 border border-green-400/30 bg-green-400/10 px-1.5 py-0.5 rounded uppercase tracking-wider">For Trade</span>
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
