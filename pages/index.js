import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../lib/firebase';
import { doc, setDoc, onSnapshot, collection, updateDoc, arrayUnion, arrayRemove, deleteDoc } from 'firebase/firestore';
import { Search, Lock, Unlock, Tag, Trash2, X, RefreshCw, Users, CheckCircle2, ArrowUpDown, UserPlus } from 'lucide-react';

const CharacterCard = React.memo(({ char, isUnlocked, onToggleTrade, onDelete, isTagged }) => {
  const [imgError, setImgError] = useState(false);
  const imgUrl = `/api/mudae?name=${encodeURIComponent(char.name)}&series=${encodeURIComponent(char.series || 'unknown')}`;

  return (
    <div className="group relative bg-[#161b29] rounded-2xl border border-slate-800 hover:border-pink-500 transition-all overflow-hidden shadow-2xl">
      <div className="aspect-[2/3] relative bg-[#0b0f1a]">
        <img 
          src={imgError ? `https://via.placeholder.com/225x350?text=Reloading` : imgUrl} 
          alt={char.name} 
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
          onError={() => setImgError(true)}
          loading="lazy" 
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b0f1a] via-transparent to-transparent opacity-90" />
        <div className="absolute top-3 left-3 bg-black/80 backdrop-blur-md px-2 py-1 rounded-lg text-[11px] font-black text-orange-400 border border-white/10 shadow-lg">
          {char.kakera.toLocaleString()}
        </div>
        {isUnlocked && (
          <button onClick={() => onDelete(char)} className="absolute top-3 right-3 p-2 bg-red-600/90 hover:bg-red-500 text-white rounded-xl opacity-0 group-hover:opacity-100 transition-all shadow-xl">
            <X size={16}/>
          </button>
        )}
        <button onClick={() => onToggleTrade(char.series)} className={`absolute bottom-4 right-4 p-3 rounded-2xl backdrop-blur-xl transition-all ${isTagged ? 'bg-pink-600 text-white shadow-pink-600/50 shadow-lg scale-110' : 'bg-white/5 text-white/20 hover:bg-white/10'}`}>
          <Tag size={16}/>
        </button>
      </div>
      <div className="p-4">
        <h4 className="text-[13px] font-bold text-white truncate uppercase tracking-tight">{char.name}</h4>
        <p className={`text-[10px] truncate font-black uppercase mt-1 tracking-wider ${char.series?.toLowerCase().includes('unknown') ? 'text-red-500' : 'text-slate-500'}`}>
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
  const [passwordInput, setPasswordInput] = useState('');
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

  // Lock the dashboard whenever the profile changes
  useEffect(() => {
    setIsUnlocked(false);
    setPasswordInput('');
  }, [activeProfile]);

  const handleUnlock = () => {
    const profileData = profiles[activeProfile];
    if (!profileData) return;
    
    // Check if password matches what was set during profile creation
    if (passwordInput === profileData.password) {
      setIsUnlocked(true);
    } else {
      alert("Incorrect Password for " + activeProfile);
    }
  };

  const handleAddRoller = async () => {
    const name = prompt("Enter Roller Name:");
    if (!name) return;
    if (profiles[name]) return alert("This roller already exists!");
    
    const pass = prompt("Create a Security Password for this profile (Letters, Numbers, Symbols allowed):");
    if (!pass || pass.length < 4) return alert("Password must be at least 4 characters!");

    await setDoc(doc(db, "profiles", name), { 
      characters: [], 
      tradeTags: [],
      password: pass, // Password saved specifically for THIS profile
      createdAt: new Date().toISOString()
    });
    
    setActiveProfile(name);
    alert("Profile created! Use your password to unlock editing.");
  };

  const smartFixer = async () => {
    if (!isUnlocked || isFixing) return;
    const allChars = [...(profiles[activeProfile]?.characters || [])];
    const targets = allChars.filter(c => !c.series || c.series.toLowerCase().includes('unknown'));
    if (targets.length === 0) return alert("Harem is clean!");
    setIsFixing(true); setProgress(0);
    for (let i = 0; i < targets.length; i++) {
      const char = targets[i];
      try {
        const res = await fetch(`/api/mudae?name=${encodeURIComponent(char.name)}&info=true`);
        const data = await res.json();
        const idx = allChars.findIndex(c => c.id === char.id);
        if (idx !== -1 && data.series && !data.series.toLowerCase().includes('unknown')) {
          allChars[idx].series = data.series;
          if (i % 5 === 0) await updateDoc(doc(db, "profiles", activeProfile), { characters: allChars });
        }
      } catch (e) {}
      setProgress(i + 1);
      await new Promise(r => setTimeout(r, 2000)); 
    }
    await updateDoc(doc(db, "profiles", activeProfile), { characters: allChars });
    setIsFixing(false);
  };

  const handleImport = async () => {
    if (!isUnlocked) return alert("Please Unlock this Profile First!");
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
    <div className="min-h-screen bg-[#0b0f1a] text-slate-300 flex flex-col md:flex-row font-sans">
      {/* SIDEBAR */}
      <aside className="w-full md:w-80 bg-[#0f172a] border-r border-slate-800 p-8 space-y-10 shrink-0 z-50">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-pink-400 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg shadow-pink-600/20">
            <img src="https://mudae.net/favicon.ico" className="w-8 h-8 brightness-200" alt="Mudae" />
          </div>
          <div>
            <h1 className="text-lg font-black text-white tracking-tighter uppercase italic leading-none">Mudae Hub</h1>
            <p className="text-[10px] font-bold text-pink-500 tracking-[0.2em] uppercase mt-1">Dashboard</p>
          </div>
        </div>

        <nav className="space-y-3">
          <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-2 mb-4">Rollers List</p>
          {Object.keys(profiles).map(name => (
            <button key={name} onClick={() => setActiveProfile(name)} className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl text-[13px] font-bold transition-all duration-300 ${activeProfile === name ? 'bg-pink-600 text-white shadow-2xl translate-x-2' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
              <div className="flex items-center gap-4"><Users size={18}/> {name}</div>
              {isUnlocked && activeProfile === name && <Trash2 size={16} className="opacity-40 hover:opacity-100" onClick={(e) => { e.stopPropagation(); if(confirm('Delete Profile?')) deleteDoc(doc(db, "profiles", name)); }}/>}
            </button>
          ))}
          <button onClick={handleAddRoller} className="w-full border-2 border-dashed border-slate-800 hover:border-pink-600 py-4 rounded-2xl text-[11px] font-black uppercase text-slate-500 mt-8 transition-colors flex items-center justify-center gap-3">
            <UserPlus size={16}/> Add New Roller
          </button>
        </nav>
      </aside>

      <main className="flex-1 p-6 md:p-16 overflow-y-auto bg-gradient-to-br from-[#0b0f1a] to-[#0f172a]">
        <header className="flex flex-col xl:flex-row justify-between gap-12 mb-20 items-center">
          <div className="text-center xl:text-left">
            <h2 className="text-8xl font-black text-white italic uppercase tracking-tighter leading-none">{activeProfile || 'Select'}</h2>
            <div className="flex gap-6 mt-6 justify-center xl:justify-start items-center">
              <span className="bg-slate-900/50 border border-slate-800 px-4 py-1.5 rounded-full text-[11px] font-black text-slate-400 uppercase tracking-widest">{sortedChars.length} CHARACTERS</span>
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-black text-slate-600 uppercase">Sort By:</span>
                <button onClick={() => setSortMode(sortMode === 'kakera' ? 'name' : 'kakera')} className="text-[11px] font-black text-pink-500 uppercase flex items-center gap-2">
                  <ArrowUpDown size={14}/> {sortMode === 'kakera' ? 'Highest Kakera' : 'A-Z Name'}
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 justify-center">
            {/* SELF-SERVICE PASSWORD INPUT */}
            <div className="bg-slate-900 border-2 border-slate-800 rounded-3xl flex items-center p-2.5 shadow-2xl focus-within:border-pink-600 transition-all">
              <input 
                type="password" 
                placeholder={`PASS FOR ${activeProfile.toUpperCase()}`} 
                value={passwordInput}
                className="bg-transparent px-5 w-48 text-xs outline-none font-black tracking-widest text-white placeholder:text-slate-700" 
                onChange={(e) => setPasswordInput(e.target.value)} 
              />
              <button 
                onClick={handleUnlock} 
                className={`p-3.5 rounded-2xl transition-all duration-500 ${isUnlocked ? 'bg-green-500 text-white shadow-lg rotate-[360deg]' : 'bg-slate-800 text-slate-500 hover:text-white'}`}
              >
                {isUnlocked ? <Unlock size={20}/> : <Lock size={20}/>}
              </button>
            </div>

            <button 
              onClick={smartFixer} 
              disabled={!isUnlocked || isFixing} 
              className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-900 disabled:text-slate-700 text-white px-10 py-5 rounded-3xl text-[12px] font-black uppercase tracking-widest flex items-center gap-4 shadow-2xl shadow-blue-600/20"
            >
              {isFixing ? <RefreshCw size={18} className="animate-spin"/> : <CheckCircle2 size={18}/>}
              {isFixing ? `SCANNING: ${progress}` : 'Scan Harem'}
            </button>
          </div>
        </header>

        <section className="grid grid-cols-1 lg:grid-cols-4 gap-16">
          <div className="lg:col-span-1">
            <div className="bg-[#111622]/50 backdrop-blur-md border border-slate-800 p-8 rounded-[2rem] space-y-8 shadow-2xl sticky top-10">
              <div className="relative">
                <Search className="absolute left-5 top-5 text-slate-600" size={18}/>
                <input className="w-full bg-slate-950 border-2 border-slate-800 rounded-2xl py-5 pl-14 pr-6 text-sm outline-none focus:border-pink-500 font-bold transition-all" placeholder="Quick Filter..." onChange={(e) => setSearch(e.target.value)} />
              </div>
              <div className="space-y-4">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Paste Mudae Data</p>
                <textarea className="w-full bg-slate-950 border-2 border-slate-800 rounded-2xl p-5 text-[11px] h-52 outline-none font-mono focus:border-pink-600 text-pink-500" placeholder="$mms l- k" value={inputText} onChange={(e) => setInputText(e.target.value)} />
                <button onClick={handleImport} disabled={!isUnlocked} className="w-full bg-pink-600 hover:bg-pink-500 py-5 rounded-2xl text-[12px] font-black text-white uppercase tracking-widest shadow-xl transition-all">Import Chars</button>
              </div>
            </div>
          </div>
          <div className="lg:col-span-3 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 md:gap-8">
            {sortedChars.map((c) => (
              <CharacterCard 
                key={c.id} 
                char={c} 
                isUnlocked={isUnlocked} 
                onDelete={(char) => updateDoc(doc(db, "profiles", activeProfile), { characters: arrayRemove(char) })} 
                onToggleTrade={(s) => {
                  const t = profiles[activeProfile]?.tradeTags?.includes(s);
                  updateDoc(doc(db, "profiles", activeProfile), { tradeTags: t ? arrayRemove(s) : arrayUnion(s) });
                }} 
                isTagged={profiles[activeProfile]?.tradeTags?.includes(c.series)} 
              />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
