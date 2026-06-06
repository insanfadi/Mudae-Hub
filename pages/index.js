import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../lib/firebase';
import { doc, setDoc, onSnapshot, collection, updateDoc, arrayUnion, arrayRemove, deleteDoc } from 'firebase/firestore';
import { Search, Lock, Unlock, Tag, Trash2, X, RefreshCw, Users, CheckCircle2, ArrowUpDown, UserPlus } from 'lucide-react';

const CharacterCard = React.memo(({ char, isUnlocked, onToggleTrade, onDelete, isTagged }) => {
  const [imgError, setImgError] = useState(false);
  const imgUrl = `/api/mudae?name=${encodeURIComponent(char.name)}&series=${encodeURIComponent(char.series || 'unknown')}`;

  return (
    <div className="group relative bg-[#161b29] rounded-3xl border-2 border-slate-800 hover:border-pink-500 transition-all duration-300 overflow-hidden shadow-2xl">
      <div className="aspect-[2/3] relative bg-[#0b0f1a]">
        <img 
          src={imgError ? `https://via.placeholder.com/225x350?text=Reloading` : imgUrl} 
          alt={char.name} 
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
          onError={() => setImgError(true)}
          loading="lazy" 
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b0f1a] via-transparent to-transparent opacity-90" />
        <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-md px-3 py-1 rounded-xl text-[13px] font-black text-orange-400 border border-white/10 shadow-2xl">
          {char.kakera.toLocaleString()}
        </div>
        {isUnlocked && (
          <button onClick={() => onDelete(char)} className="absolute top-4 right-4 p-2.5 bg-red-600 hover:bg-red-500 text-white rounded-2xl opacity-0 group-hover:opacity-100 transition-all shadow-xl">
            <X size={20}/>
          </button>
        )}
        <button onClick={() => onToggleTrade(char.series)} className={`absolute bottom-5 right-5 p-4 rounded-2xl backdrop-blur-xl transition-all ${isTagged ? 'bg-pink-600 text-white shadow-pink-600/50 shadow-lg scale-110' : 'bg-white/5 text-white/20 hover:bg-white/10'}`}>
          <Tag size={20}/>
        </button>
      </div>
      <div className="p-5">
        {/* BIGGER FONT FOR NAMES */}
        <h4 className="text-[16px] font-bold text-white truncate uppercase tracking-tight leading-tight">{char.name}</h4>
        {/* BIGGER FONT FOR SERIES */}
        <p className={`text-[12px] truncate font-black uppercase mt-2 tracking-widest ${char.series?.toLowerCase().includes('unknown') ? 'text-red-500' : 'text-slate-500'}`}>
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

  useEffect(() => {
    setIsUnlocked(false);
    setPasswordInput('');
  }, [activeProfile]);

  const handleUnlock = async () => {
    const profileData = profiles[activeProfile];
    if (!profileData) return;

    // FIX FOR OLD PROFILES (Like Ahmad)
    if (!profileData.password) {
      const newPass = prompt("This profile has no password. Create one now to lock it:");
      if (newPass) {
        await updateDoc(doc(db, "profiles", activeProfile), { password: newPass });
        alert("Password set! Now enter it to unlock.");
      }
      return;
    }
    
    if (passwordInput === profileData.password) {
      setIsUnlocked(true);
    } else {
      alert("Wrong password!");
    }
  };

  const handleAddRoller = async () => {
    const name = prompt("Roller Name:");
    if (!name) return;
    if (profiles[name]) return alert("Exists already!");
    const pass = prompt("Create Password:");
    if (!pass) return;

    await setDoc(doc(db, "profiles", name), { 
      characters: [], 
      tradeTags: [],
      password: pass,
      createdAt: new Date().toISOString()
    });
    setActiveProfile(name);
  };

  const smartFixer = async () => {
    if (!isUnlocked || isFixing) return;
    const allChars = [...(profiles[activeProfile]?.characters || [])];
    const targets = allChars.filter(c => !c.series || c.series.toLowerCase().includes('unknown'));
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
    if (!isUnlocked) return alert("Unlock Profile First!");
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
    <div className="min-h-screen bg-[#0b0f1a] text-slate-300 flex flex-col md:flex-row font-sans selection:bg-pink-500/30">
      {/* SIDEBAR WITH TOP-LEFT LOGO */}
      <aside className="w-full md:w-80 bg-[#0f172a] border-r border-slate-800 p-8 flex flex-col shrink-0 z-50">
        <div className="flex items-center gap-4 mb-12">
          <div className="w-14 h-14 bg-gradient-to-br from-pink-400 to-pink-600 rounded-2xl flex items-center justify-center shadow-xl shadow-pink-600/20">
            <img src="https://mudae.net/favicon.ico" className="w-10 h-10 brightness-200" alt="Mudae" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-tighter uppercase italic leading-none">Mudae Hub</h1>
            <p className="text-[11px] font-bold text-pink-500 tracking-[0.3em] uppercase mt-1">Dashboard</p>
          </div>
        </div>

        <nav className="flex-1 space-y-4">
          <p className="text-[12px] font-black text-slate-600 uppercase tracking-widest ml-2 mb-6">Rollers List</p>
          {Object.keys(profiles).map(name => (
            <button key={name} onClick={() => setActiveProfile(name)} className={`w-full flex items-center justify-between px-6 py-5 rounded-[20px] text-[15px] font-bold transition-all duration-300 ${activeProfile === name ? 'bg-pink-600 text-white shadow-2xl translate-x-2' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
              <div className="flex items-center gap-4"><Users size={22}/> {name}</div>
              {isUnlocked && activeProfile === name && <Trash2 size={18} className="opacity-40 hover:opacity-100" onClick={(e) => { e.stopPropagation(); if(confirm('Delete?')) deleteDoc(doc(db, "profiles", name)); }}/>}
            </button>
          ))}
          <button onClick={handleAddRoller} className="w-full border-2 border-dashed border-slate-800 hover:border-pink-600 py-5 rounded-[20px] text-[13px] font-black uppercase text-slate-500 mt-10 transition-colors flex items-center justify-center gap-3">
            <UserPlus size={20}/> Add New Roller
          </button>
        </nav>
      </aside>

      <main className="flex-1 p-8 md:p-20 overflow-y-auto bg-gradient-to-br from-[#0b0f1a] to-[#0f172a]">
        <header className="flex flex-col xl:flex-row justify-between gap-12 mb-24 items-center">
          <div className="text-center xl:text-left">
            <h2 className="text-[120px] font-black text-white italic uppercase tracking-tighter leading-none drop-shadow-2xl">{activeProfile || 'Ready'}</h2>
            <div className="flex gap-8 mt-8 justify-center xl:justify-start items-center">
              <span className="bg-slate-900 border-2 border-slate-800 px-6 py-2 rounded-full text-[13px] font-black text-slate-400 uppercase tracking-widest">{sortedChars.length} CHARACTERS</span>
              <div className="flex items-center gap-4">
                <span className="text-[12px] font-black text-slate-600 uppercase tracking-widest">Sort By:</span>
                <button onClick={() => setSortMode(sortMode === 'kakera' ? 'name' : 'kakera')} className="text-[14px] font-black text-pink-500 uppercase flex items-center gap-2 hover:scale-105 transition-transform">
                  <ArrowUpDown size={18}/> {sortMode === 'kakera' ? 'Highest Kakera' : 'A-Z Name'}
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-8 justify-center">
            <div className="bg-slate-900 border-2 border-slate-800 rounded-[30px] flex items-center p-3 shadow-2xl focus-within:border-pink-600 transition-all">
              <input 
                type="password" 
                placeholder="ENTER PASSWORD" 
                value={passwordInput}
                className="bg-transparent px-6 w-56 text-sm outline-none font-black tracking-[0.2em] text-white placeholder:text-slate-700" 
                onChange={(e) => setPasswordInput(e.target.value)} 
              />
              <button 
                onClick={handleUnlock} 
                className={`p-4 rounded-2xl transition-all duration-500 ${isUnlocked ? 'bg-green-500 text-white shadow-lg rotate-[360deg]' : 'bg-slate-800 text-slate-500 hover:text-white'}`}
              >
                {isUnlocked ? <Unlock size={24}/> : <Lock size={24}/>}
              </button>
            </div>

            <button 
              onClick={smartFixer} 
              disabled={!isUnlocked || isFixing} 
              className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-900 disabled:text-slate-700 text-white px-12 py-6 rounded-[30px] text-[14px] font-black uppercase tracking-[0.1em] flex items-center gap-5 shadow-2xl shadow-blue-600/20 active:scale-95 transition-all"
            >
              {isFixing ? <RefreshCw size={22} className="animate-spin"/> : <CheckCircle2 size={22}/>}
              {isFixing ? `SCANNING: ${progress}` : 'Scan Harem'}
            </button>
          </div>
        </header>

        <section className="grid grid-cols-1 lg:grid-cols-4 gap-20">
          <div className="lg:col-span-1">
            <div className="bg-[#111622]/80 backdrop-blur-2xl border-2 border-slate-800 p-10 rounded-[40px] space-y-10 shadow-2xl sticky top-10">
              <div className="relative">
                <Search className="absolute left-6 top-6 text-slate-600" size={22}/>
                <input className="w-full bg-slate-950 border-2 border-slate-800 rounded-[24px] py-6 pl-16 pr-8 text-base outline-none focus:border-pink-500 font-bold transition-all shadow-inner" placeholder="Quick Search..." onChange={(e) => setSearch(e.target.value)} />
              </div>
              <div className="space-y-6">
                <p className="text-[12px] font-black text-slate-500 uppercase tracking-widest ml-2">Import Mudae Data</p>
                <textarea className="w-full bg-slate-950 border-2 border-slate-800 rounded-[24px] p-6 text-[12px] h-64 outline-none font-mono focus:border-pink-600 text-pink-500 shadow-inner" placeholder="$mms l- k" value={inputText} onChange={(e) => setInputText(e.target.value)} />
                <button onClick={handleImport} disabled={!isUnlocked} className="w-full bg-pink-600 hover:bg-pink-500 py-6 rounded-[24px] text-[14px] font-black text-white uppercase tracking-widest shadow-2xl shadow-pink-600/40 active:scale-95 transition-all">Import Chars</button>
              </div>
            </div>
          </div>
          <div className="lg:col-span-3 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-8 md:gap-10">
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
