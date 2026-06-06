import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../lib/firebase';
import { doc, setDoc, onSnapshot, collection, updateDoc, arrayUnion, arrayRemove, deleteDoc } from 'firebase/firestore';
import { Search, Lock, Unlock, Tag, Trash2, X, RefreshCw, Users, CheckCircle2, ArrowUpDown, UserPlus, Heart } from 'lucide-react';

const CharacterCard = React.memo(({ char, isUnlocked, onToggleTrade, onDelete, isTagged }) => {
  const [imgError, setImgError] = useState(false);
  const imgUrl = `/api/mudae?name=${encodeURIComponent(char.name)}&series=${encodeURIComponent(char.series || 'unknown')}`;

  return (
    <div className="group relative bg-[#161b29] rounded-[24px] border-2 border-slate-800 hover:border-pink-500 transition-all duration-500 overflow-hidden shadow-2xl flex flex-col">
      <div className="aspect-[2/3] relative overflow-hidden bg-[#0b0f1a]">
        <img 
          src={imgError ? `https://via.placeholder.com/225x350?text=Reloading` : imgUrl} 
          alt={char.name} 
          className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110" 
          onError={() => setImgError(true)}
          loading="lazy" 
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b0f1a] via-transparent to-transparent opacity-90" />
        <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-xl px-3 py-1 rounded-xl text-[13px] font-black text-orange-400 border border-white/10 shadow-2xl z-10">
          {char.kakera.toLocaleString()}
        </div>
        {isUnlocked && (
          <button onClick={() => onDelete(char)} className="absolute top-4 right-4 p-2.5 bg-red-600 hover:bg-red-500 text-white rounded-2xl opacity-0 group-hover:opacity-100 transition-all shadow-xl z-20">
            <X size={20}/>
          </button>
        )}
        <button onClick={() => onToggleTrade(char.series)} className={`absolute bottom-5 right-5 p-4 rounded-[20px] backdrop-blur-xl transition-all z-20 ${isTagged ? 'bg-pink-600 text-white shadow-pink-600/50 shadow-lg scale-110' : 'bg-white/5 text-white/20 hover:bg-white/10'}`}>
          <Tag size={22}/>
        </button>
      </div>
      <div className="p-6 bg-[#161b29] z-20">
        <h4 className="text-[20px] font-bold text-white truncate uppercase tracking-tight leading-tight mb-1">{char.name}</h4>
        <p className={`text-[14px] truncate font-black uppercase tracking-widest ${char.series?.toLowerCase().includes('unknown') ? 'text-red-500' : 'text-slate-500'}`}>
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
  const [totalToFix, setTotalToFix] = useState(0);
  const [sortMode, setSortMode] = useState('kakera');

  useEffect(() => {
    return onSnapshot(collection(db, "profiles"), (s) => {
      const d = {}; s.forEach(doc => d[doc.id] = doc.data());
      setProfiles(d);
      if (!activeProfile && Object.keys(d).length > 0) setActiveProfile(Object.keys(d)[0]);
    });
  }, [activeProfile]);

  useEffect(() => { setIsUnlocked(false); setPasswordInput(''); }, [activeProfile]);

  const handleUnlock = async () => {
    const profileData = profiles[activeProfile];
    if (!profileData) return;
    if (!profileData.password) {
      const newPass = prompt("Set Password:");
      if (newPass) await updateDoc(doc(db, "profiles", activeProfile), { password: newPass });
      return;
    }
    if (passwordInput === profileData.password) setIsUnlocked(true);
    else alert("Wrong Password!");
  };

  const smartFixer = async () => {
    if (!isUnlocked || isFixing) return;
    const allChars = [...(profiles[activeProfile]?.characters || [])];
    // ONLY SCAN BROKEN ONES (Saves 30 minutes of waiting!)
    const targets = allChars.filter(c => !c.series || c.series.toLowerCase().includes('unknown'));
    if (targets.length === 0) return alert("Harem is already fully scanned!");

    setIsFixing(true); setTotalToFix(targets.length); setProgress(0);
    const BATCH_SIZE = 3; 
    for (let i = 0; i < targets.length; i += BATCH_SIZE) {
      const batch = targets.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async (char) => {
        try {
          const res = await fetch(`/api/mudae?name=${encodeURIComponent(char.name)}&info=true`);
          const data = await res.json();
          const idx = allChars.findIndex(c => c.id === char.id);
          if (idx !== -1 && data.series && !data.series.toLowerCase().includes('unknown')) {
            allChars[idx].series = data.series;
          }
        } catch (e) {}
      }));
      setProgress(i + batch.length);
      if (i % 15 === 0) await updateDoc(doc(db, "profiles", activeProfile), { characters: allChars });
      await new Promise(r => setTimeout(r, 1800)); 
    }
    await updateDoc(doc(db, "profiles", activeProfile), { characters: allChars });
    setIsFixing(false);
  };

  const sortedChars = useMemo(() => {
    let chars = [...(profiles[activeProfile]?.characters || [])];
    if (search) chars = chars.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.series?.toLowerCase().includes(search.toLowerCase()));
    return chars.sort((a, b) => sortMode === 'kakera' ? b.kakera - a.kakera : a.name.localeCompare(b.name));
  }, [profiles, activeProfile, search, sortMode]);

  return (
    <div className="min-h-screen bg-[#0b0f1a] text-slate-300 flex flex-col md:flex-row font-sans">
      <aside className="w-full md:w-80 bg-[#0f172a] border-r border-slate-800 p-8 flex flex-col shrink-0 z-50">
        <div className="flex items-center gap-4 mb-12">
          <div className="w-14 h-14 bg-gradient-to-br from-pink-400 via-pink-500 to-pink-700 rounded-[18px] flex items-center justify-center shadow-xl shadow-pink-600/30">
            <Heart className="text-white fill-white" size={28} />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-tighter uppercase italic leading-none">Mudae Hub</h1>
            <p className="text-[10px] font-bold text-pink-500 tracking-[0.4em] uppercase mt-1">Dashboard</p>
          </div>
        </div>
        <nav className="flex-1 space-y-3">
          <p className="text-[12px] font-black text-slate-600 uppercase tracking-widest ml-2 mb-6">Rollers List</p>
          {Object.keys(profiles).map(name => (
            <button key={name} onClick={() => setActiveProfile(name)} className={`w-full flex items-center justify-between px-6 py-4 rounded-[20px] text-[15px] font-bold transition-all duration-300 ${activeProfile === name ? 'bg-pink-600 text-white shadow-2xl translate-x-2' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
              <div className="flex items-center gap-4"><Users size={20}/> {name}</div>
            </button>
          ))}
          <button onClick={() => { const n = prompt("Name?"); if(n) setDoc(doc(db, "profiles", n), { characters: [], tradeTags: [], password: prompt("Set Password:") }); }} className="w-full border-2 border-dashed border-slate-800 hover:border-pink-600 py-5 rounded-[20px] text-[13px] font-black uppercase text-slate-500 mt-10 flex items-center justify-center gap-3">
            <UserPlus size={18}/> Add Roller
          </button>
        </nav>
      </aside>

      <main className="flex-1 p-8 md:p-16 overflow-y-auto bg-gradient-to-br from-[#0b0f1a] to-[#0f172a]">
        <header className="flex flex-col xl:flex-row justify-between gap-10 mb-20 items-center">
          <div className="text-center xl:text-left">
            <h2 className="text-7xl font-black text-white italic uppercase tracking-tighter leading-none drop-shadow-2xl">{activeProfile || 'Select'}</h2>
            <div className="flex gap-8 mt-6 justify-center xl:justify-start items-center">
              <span className="bg-slate-900 border-2 border-slate-800 px-6 py-2 rounded-full text-[14px] font-black text-slate-400 uppercase tracking-widest">{sortedChars.length} CHARS</span>
              <div className="flex items-center gap-4">
                <span className="text-[12px] font-black text-slate-600 uppercase tracking-widest">Sort:</span>
                <button onClick={() => setSortMode(sortMode === 'kakera' ? 'name' : 'kakera')} className="text-[15px] font-black text-pink-500 uppercase flex items-center gap-2 hover:scale-105 transition-transform">
                  <ArrowUpDown size={18}/> {sortMode === 'kakera' ? 'Kakera' : 'Name'}
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 justify-center">
            <div className="bg-slate-900 border-2 border-slate-800 rounded-[28px] flex items-center p-2.5 shadow-2xl focus-within:border-pink-600 transition-all">
              <input type="password" placeholder="PASSWORD" value={passwordInput} className="bg-transparent px-6 w-48 text-sm outline-none font-black tracking-[0.2em] text-white placeholder:text-slate-700" onChange={(e) => setPasswordInput(e.target.value)} />
              <button onClick={handleUnlock} className={`p-3.5 rounded-2xl transition-all duration-500 ${isUnlocked ? 'bg-green-500 text-white shadow-lg rotate-[360deg]' : 'bg-slate-800 text-slate-500 hover:text-white'}`}><Unlock size={24}/></button>
            </div>
            {/* FIXED SCAN HAREM BUTTON SIZE */}
            <button 
              onClick={smartFixer} 
              disabled={!isUnlocked || isFixing} 
              className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-900 text-white px-14 py-5 rounded-[32px] text-[16px] font-black uppercase tracking-widest flex items-center gap-6 shadow-2xl shadow-blue-600/20 active:scale-95 transition-all min-w-[240px] justify-center"
            >
              {isFixing ? <RefreshCw size={22} className="animate-spin"/> : <CheckCircle2 size={22}/>}
              {isFixing ? `FIXING: ${Math.min(progress, totalToFix)} / ${totalToFix}` : 'Scan Harem'}
            </button>
          </div>
        </header>

        <section className="grid grid-cols-1 lg:grid-cols-4 gap-16">
          <div className="lg:col-span-1">
            <div className="bg-[#111622]/90 backdrop-blur-3xl border-2 border-slate-800 p-8 rounded-[32px] space-y-8 shadow-2xl sticky top-10">
              <div className="relative">
                <Search className="absolute left-6 top-6 text-slate-600" size={22}/>
                <input className="w-full bg-slate-950 border-2 border-slate-800 rounded-[20px] py-5 pl-16 pr-8 text-base outline-none focus:border-pink-500 font-bold transition-all shadow-inner" placeholder="Quick Search..." onChange={(e) => setSearch(e.target.value)} />
              </div>
              <div className="space-y-4">
                <p className="text-[12px] font-black text-slate-500 uppercase tracking-widest ml-2">Import Data</p>
                <textarea className="w-full bg-slate-950 border-2 border-slate-800 rounded-[20px] p-5 text-[13px] h-52 outline-none font-mono focus:border-pink-600 text-pink-500" placeholder="$mms l- k" value={inputText} onChange={(e) => setInputText(e.target.value)} />
                <button onClick={() => { const news = inputText.split('\n').map(l => { const k = l.match(/([\d,]+)\s*ka/); if (!k) return null; return { name: l.replace(/#[\d,]+ - /, '').split(k[0])[0].trim(), series: "Unknown", kakera: parseInt(k[1].replace(/,/g, '')), id: Math.random().toString(36).substr(2, 9) }; }).filter(Boolean); updateDoc(doc(db, "profiles", activeProfile), { characters: arrayUnion(...news) }); setInputText(''); }} disabled={!isUnlocked} className="w-full bg-pink-600 hover:bg-pink-500 py-5 rounded-[20px] text-[15px] font-black text-white uppercase shadow-2xl">Import Chars</button>
              </div>
            </div>
          </div>
          <div className="lg:col-span-3 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-10">
            {sortedChars.map((c) => (
              <CharacterCard key={c.id} char={c} isUnlocked={isUnlocked} onDelete={(char) => updateDoc(doc(db, "profiles", activeProfile), { characters: arrayRemove(char) })} onToggleTrade={(s) => {
                  const t = profiles[activeProfile]?.tradeTags?.includes(s);
                  updateDoc(doc(db, "profiles", activeProfile), { tradeTags: t ? arrayRemove(s) : arrayUnion(s) });
                }} isTagged={profiles[activeProfile]?.tradeTags?.includes(c.series)} 
              />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
