import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, setDoc, onSnapshot, collection, updateDoc, arrayUnion, arrayRemove, deleteDoc } from 'firebase/firestore';
import { Search, Lock, Unlock, Import, Plus, Tag, Share2, Trash2, X } from 'lucide-react';

export default function MudaeHub() {
  const [profiles, setProfiles] = useState({});
  const [activeProfile, setActiveProfile] = useState('');
  const [inputText, setInputText] = useState('');
  const [pin, setPin] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [search, setSearch] = useState('');
  const [newProfileName, setNewProfileName] = useState('');

  // 1. Sync with Firebase
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

  // 2. Delete a whole Profile
  const handleDeleteProfile = async (profileName) => {
    if (!isUnlocked) return alert("Enter PIN to delete!");
    if (confirm(`Are you sure you want to delete the profile "${profileName}"? This cannot be undone.`)) {
      await deleteDoc(doc(db, "profiles", profileName));
      setActiveProfile(Object.keys(profiles)[0] || '');
    }
  };

  // 3. Delete a single character
  const handleDeleteCharacter = async (character) => {
    if (!isUnlocked) return;
    const profileRef = doc(db, "profiles", activeProfile);
    await updateDoc(profileRef, {
      characters: arrayRemove(character)
    });
  };

  // 4. Import Parser (Handles your #Rank - Name Kakera format)
  const handleImport = async () => {
    if (!isUnlocked) return alert("Enter PIN to edit!");
    if (!activeProfile) return alert("Select a profile first!");
    
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
      return { 
        name, 
        series: "Unknown", 
        kakera, 
        keys: line.match(/\((\d+)\)/) ? line.match(/\((\d+)\)/)[1] : 0,
        id: Math.random().toString(36).substr(2, 9) // Unique ID for character
      };
    }).filter(Boolean);

    await setDoc(doc(db, "profiles", activeProfile), {
      characters: arrayUnion(...newCharacters),
      lastUpdated: new Date().toLocaleString()
    }, { merge: true });
    
    setInputText('');
    alert(`Added ${newCharacters.length} characters to ${activeProfile}!`);
  };

  const createProfile = async () => {
    if (!newProfileName) return;
    if (profiles[newProfileName]) return alert("Profile already exists!");
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
    const isTagged = profiles[activeProfile]?.tradeTags?.includes(series);
    await updateDoc(doc(db, "profiles", activeProfile), {
      tradeTags: isTagged ? arrayRemove(series) : arrayUnion(series)
    });
  };

  const filteredChars = (profiles[activeProfile]?.characters || []).filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.series.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#0b0f1a] text-slate-300 font-sans">
      {/* NAVIGATION BAR */}
      <nav className="border-b border-slate-800 bg-[#0f172a]/80 sticky top-0 z-50 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-pink-600 rounded flex items-center justify-center text-white font-black shadow-lg shadow-pink-600/20">M</div>
            <span className="font-black text-white tracking-widest uppercase text-xs hidden sm:block">Mudae Hub</span>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-800">
              <input type="password" placeholder="PIN" className="bg-transparent px-2 w-16 text-[10px] outline-none" onChange={(e) => setPin(e.target.value)} />
              <button onClick={() => setIsUnlocked(pin === "1234")} className={`p-1 rounded transition-colors ${isUnlocked ? 'text-green-500 bg-green-500/10' : 'text-slate-600'}`}>
                {isUnlocked ? <Unlock size={14}/> : <Lock size={14}/>}
              </button>
            </div>
            
            <div className="flex items-center gap-1">
              <select value={activeProfile} onChange={(e) => setActiveProfile(e.target.value)} className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs font-bold text-pink-500 outline-none">
                {Object.keys(profiles).map(name => <option key={name} value={name}>{name}</option>)}
              </select>
              {isUnlocked && activeProfile && (
                <button onClick={() => handleDeleteProfile(activeProfile)} className="p-2 text-slate-600 hover:text-red-500 transition-colors">
                  <Trash2 size={16}/>
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* SIDEBAR */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-slate-600" size={14}/>
              <input className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 pl-9 pr-4 text-xs focus:border-pink-600 outline-none" placeholder="Search characters..." onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>

          <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 block">Import Harem ($mms l- k)</label>
            <textarea className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-[10px] h-32 outline-none focus:border-pink-600 font-mono" placeholder="Paste bot text here..." value={inputText} onChange={(e) => setInputText(e.target.value)} />
            <button onClick={handleImport} disabled={!isUnlocked} className="w-full mt-3 bg-pink-600 hover:bg-pink-500 disabled:bg-slate-800 py-2.5 rounded-lg text-xs font-bold text-white transition-all shadow-lg shadow-pink-600/20">Add to Collection</button>
          </div>

          <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 block">New Profile</label>
            <div className="flex gap-2">
              <input className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs outline-none focus:border-pink-600" placeholder="Name..." value={newProfileName} onChange={(e) => setNewProfileName(e.target.value)} />
              <button onClick={createProfile} className="bg-slate-800 p-2 rounded-lg hover:bg-slate-700 text-white transition-colors"><Plus size={18}/></button>
            </div>
          </div>
        </div>

        {/* CHARACTER GRID */}
        <div className="lg:col-span-9">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-2">
            <div>
              <h2 className="text-4xl font-black text-white italic uppercase tracking-tighter leading-none">{activeProfile || 'No Profiles'}</h2>
              <p className="text-[10px] text-slate-500 mt-2 font-bold uppercase tracking-widest">Total: {filteredChars.length} characters</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
            {filteredChars.map((char, i) => (
              <div key={char.id || i} className="group relative bg-[#161b29] rounded-xl border border-slate-800 hover:border-pink-600/50 transition-all overflow-hidden shadow-xl">
                <div className="aspect-[2/3] relative">
                  <img src={`/api/mudae?name=${encodeURIComponent(char.name)}`} alt={char.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" loading="lazy" />
                  
                  {/* Overlays */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60"></div>
                  <div className="absolute top-2 left-2 bg-black/80 px-2 py-0.5 rounded text-[10px] font-bold text-orange-400 border border-orange-400/20">{char.kakera} ka</div>
                  
                  {isUnlocked && (
                    <button onClick={() => handleDeleteCharacter(char)} className="absolute top-2 right-2 p-1.5 bg-black/60 text-white/50 hover:text-red-500 rounded-lg backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all">
                      <X size={14}/>
                    </button>
                  )}

                  <button onClick={() => toggleTradeTag(char.series)} className={`absolute bottom-3 right-3 p-2 rounded-full backdrop-blur-md transition-all shadow-lg ${profiles[activeProfile]?.tradeTags?.includes(char.series) ? 'bg-green-500 text-white' : 'bg-black/40 text-white/50 hover:bg-black/60'}`}>
                    <Tag size={12}/>
                  </button>
                </div>

                <div className="p-3 relative bg-[#161b29]">
                  <h4 className="text-[11px] font-black text-white truncate uppercase tracking-tight">{char.name}</h4>
                  <p className="text-[9px] text-slate-600 truncate font-bold uppercase">{char.series}</p>
                  {profiles[activeProfile]?.tradeTags?.includes(char.series) && (
                    <div className="mt-2 text-[8px] font-black text-green-400 flex items-center gap-1 italic">
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
