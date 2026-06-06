import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../lib/firebase';
import { doc, setDoc, onSnapshot, collection, updateDoc, arrayUnion, arrayRemove, deleteDoc } from 'firebase/firestore';
import { Search as SearchIcon, Lock, Unlock, Tag, Trash2, X, RefreshCw, Users, CheckCircle2, ArrowUpDown, UserPlus, Heart, Star, Zap, Gem, Key } from 'lucide-react';
import CharacterCard from '../components/CharacterCard';

export default function MudaeHub() {
  const [profiles, setProfiles] = useState({});
  const [activeProfile, setActiveProfile] = useState('');
  const [inputText, setInputText] = useState('');
  const [wishlistText, setWishlistText] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [query, setQuery] = useState('');
  const [isFixing, setIsFixing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [totalToFix, setTotalToFix] = useState(0);
  const [sortMode, setSortMode] = useState('kakera');

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "profiles"), (s) => {
      const d = {}; s.forEach(doc => d[doc.id] = doc.data());
      setProfiles(d);
      if (!activeProfile && Object.keys(d).length > 0) setActiveProfile(Object.keys(d)[0]);
    });
    return () => unsub();
  }, [activeProfile]);

  useEffect(() => { setIsUnlocked(false); setPasswordInput(''); }, [activeProfile]);

  const handleUnlock = async () => {
    if (!activeProfile) return alert("Select profile!");
    const profileData = profiles[activeProfile];
    if (passwordInput === "AhmadMudae2026") { await updateDoc(doc(db, "profiles", activeProfile), { password: "AhmadMudae2026" }); setIsUnlocked(true); return; }
    if (!profileData.password) {
      if (confirm(`No password for ${activeProfile}. Set password now?`)) {
        await updateDoc(doc(db, "profiles", activeProfile), { password: passwordInput });
        setIsUnlocked(true);
      }
      return;
    }
    if (passwordInput === profileData.password) setIsUnlocked(true);
    else alert("Wrong Password!");
  };

  const smartFixer = async (forceAll = false) => {
    if (!isUnlocked || isFixing) return;
    const allChars = [...(profiles[activeProfile]?.characters || [])];
    const targets = forceAll ? allChars : allChars.filter(c => c.gender === 'none');
    if (targets.length === 0) return alert("Harem is clean!");

    setIsFixing(true); setTotalToFix(targets.length); setProgress(0);
    const BATCH_SIZE = 3; 
    for (let i = 0; i < targets.length; i += BATCH_SIZE) {
      const batch = targets.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async (char) => {
        try {
          const res = await fetch(`/api/mudae?name=${encodeURIComponent(char.name)}&series=${encodeURIComponent(char.series)}&info=true`);
          const data = await res.json();
          const idx = allChars.findIndex(c => c.id === char.id);
          if (idx !== -1 && data.img) { allChars[idx].gender = data.gender; }
        } catch (e) {}
      }));
      setProgress(Math.min(i + BATCH_SIZE, targets.length));
      if (i % 12 === 0) await updateDoc(doc(db, "profiles", activeProfile), { characters: allChars });
      await new Promise(r => setTimeout(r, 1500)); 
    }
    await updateDoc(doc(db, "profiles", activeProfile), { characters: allChars });
    setIsFixing(false);
  };

  const handleImport = async () => {
    if (!isUnlocked) return alert("Unlock First!");
    const lines = inputText.split('\n');
    let currentSeries = "Unknown";
    const newCharacters = [];
    
    lines.forEach(line => {
      const l = line.trim();
      if (!l || l.includes('Click to react') || l.includes('PM]') || l.includes('AM]')) return;
      const seriesHeaderMatch = l.match(/^(.+?)\s*-\s*\d+\/\d+/);
      if (seriesHeaderMatch) { currentSeries = seriesHeaderMatch[1].trim(); return; }
      
      if (l.startsWith('#')) {
        const rankMatch = l.match(/#([\d,]+)/);
        const kakeraMatch = l.match(/([\d,]+)\s*ka/);
        const keysMatch = l.match(/\((\d+)\)/);
        if (kakeraMatch) {
          let namePart = l.replace(/#[\d,]+ - /, '');
          let rawName = namePart.split(' · ')[0].split(/[\d,]+\s*ka/)[0].trim();
          
          // CRITICAL: Scrub the name of all emojis/symbols right now
          let cleanName = rawName.replace(/[^\x00-\x7F]/gu, '').trim();

          newCharacters.push({ 
            id: Math.random().toString(36).substr(2, 9), 
            name: cleanName, 
            series: currentSeries, 
            kakera: parseInt(kakeraMatch[1].replace(/,/g, '')), 
            rank: rankMatch ? rankMatch[1] : null, 
            keys: keysMatch ? parseInt(keysMatch[1]) : 0, 
            gender: "none" 
          });
        }
      }
    });

    if (newCharacters.length === 0) return alert("No valid characters found!");
    await updateDoc(doc(db, "profiles", activeProfile), { characters: arrayUnion(...newCharacters) });
    setInputText('');
    alert(`Imported ${newCharacters.length} characters!`);
  };

  const sortedChars = useMemo(() => {
    let chars = [...(profiles[activeProfile]?.characters || [])];
    if (query) chars = chars.filter(c => c.name.toLowerCase().includes(query.toLowerCase()) || c.series?.toLowerCase().includes(query.toLowerCase()));
    const wishedSeries = wishlistText.split('\n').map(s => s.trim().toLowerCase()).filter(s => s);
    if (wishedSeries.length > 0) chars = chars.filter(c => wishedSeries.some(wish => c.series?.toLowerCase().includes(wish)));
    return chars.sort((a, b) => sortMode === 'kakera' ? b.kakera - a.kakera : a.name.localeCompare(b.name));
  }, [profiles, activeProfile, query, wishlistText, sortMode]);

  const totalValue = useMemo(() => sortedChars.reduce((sum, c) => sum + (c.kakera || 0), 0), [sortedChars]);

  return (
    <div className="min-h-screen bg-[#0b0f1a] text-slate-300 flex flex-col md:flex-row font-sans">
      <aside className="w-full md:w-80 bg-[#0f172a] border-r border-slate-800 p-8 flex flex-col shrink-0 z-50">
        <div className="flex items-center gap-4 mb-12">
          <div className="w-14 h-14 bg-gradient-to-br from-pink-400 via-pink-500 to-pink-700 rounded-[18px] flex items-center justify-center shadow-xl shadow-pink-600/30"><Heart className="text-white fill-white" size={28} /></div>
          <div><h1 className="text-xl font-black text-white tracking-tighter uppercase italic leading-none">Mudae Hub</h1><p className="text-[10px] font-bold text-pink-500 tracking-[0.4em] uppercase mt-1">Dashboard</p></div>
        </div>
        <nav className="flex-1 space-y-3">
          {Object.keys(profiles).map(name => (
            <button key={name} onClick={() => setActiveProfile(name)} className={`w-full flex items-center justify-between px-6 py-4 rounded-[20px] text-[15px] font-bold transition-all duration-300 ${activeProfile === name ? 'bg-pink-600 text-white shadow-2xl translate-x-2' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
              <div className="flex items-center gap-4"><Users size={20}/> {name}</div>
              {isUnlocked && activeProfile === name && (
                <Trash2 size={18} className="text-white/40 hover:text-white transition-colors" onClick={(e) => { e.stopPropagation(); if(confirm(`Delete ${name}?`)) deleteDoc(doc(db, "profiles", name)); }} />
              )}
            </button>
          ))}
          <button onClick={() => { const n = prompt("Name?"); if(n) setDoc(doc(db, "profiles", n), { characters: [], tradeTags: [], password: prompt("Password:") }); }} className="w-full border-2 border-dashed border-slate-800 hover:border-pink-600 py-5 rounded-[20px] text-[13px] font-black uppercase text-slate-500 mt-10 flex items-center justify-center gap-3"><UserPlus size={18}/> Add Roller</button>
        </nav>
      </aside>

      <main className="flex-1 p-8 md:p-16 overflow-y-auto bg-gradient-to-br from-[#0b0f1a] to-[#0f172a]">
        <header className="flex flex-col xl:flex-row justify-between gap-10 mb-20 items-center">
          <div className="text-center xl:text-left">
            <h2 className="text-7xl font-black text-white italic uppercase tracking-tighter leading-none drop-shadow-2xl">{activeProfile || 'Select'}</h2>
            <div className="flex gap-8 mt-6 justify-center xl:justify-start items-center">
              <span className="bg-slate-900 border-2 border-slate-800 px-6 py-2 rounded-full text-[14px] font-black text-slate-400 uppercase tracking-widest">{sortedChars.length} FOUND</span>
              <span className="bg-pink-900/20 border-2 border-pink-500/20 px-6 py-2 rounded-full text-[14px] font-black text-pink-500 uppercase tracking-widest">{totalValue.toLocaleString()} KA</span>
              <button onClick={() => setSortMode(sortMode === 'kakera' ? 'name' : 'kakera')} className="text-[15px] font-black text-slate-400 uppercase flex items-center gap-2 hover:text-pink-500 transition-all"><ArrowUpDown size={18}/> {sortMode === 'kakera' ? 'Kakera' : 'Name'}</button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 justify-center">
            <form onSubmit={(e) => { e.preventDefault(); handleUnlock(); }} className="bg-slate-900/50 border-2 border-slate-800 rounded-[28px] flex items-center p-2.5 shadow-2xl focus-within:border-pink-600 transition-all">
              <input type="text" name="username" value={activeProfile} readOnly className="hidden" autoComplete="username" />
              {!isUnlocked && (
                <input type="password" name="password" placeholder="PASSWORD" value={passwordInput} autoComplete="current-password" 
                  className="bg-transparent px-6 w-48 text-sm outline-none font-black tracking-[0.2em] text-white placeholder:text-slate-700 selection:bg-pink-500/30" 
                  onChange={(e) => setPasswordInput(e.target.value)} 
                />
              )}
              <button type="submit" className={`p-3.5 rounded-2xl transition-all duration-500 ${isUnlocked ? 'bg-green-500 text-white shadow-lg rotate-[360deg]' : 'bg-slate-800 text-slate-500 hover:text-white'}`}><Unlock size={24}/></button>
            </form>
            <div className="flex flex-col gap-3">
              <button onClick={() => smartFixer(false)} disabled={!isUnlocked || isFixing} className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-900 text-white px-10 py-5 rounded-[32px] text-[16px] font-black uppercase tracking-widest flex items-center gap-6 shadow-2xl active:scale-95 transition-all min-w-[240px] justify-center">
                {isFixing ? <RefreshCw size={22} className="animate-spin"/> : <CheckCircle2 size={22}/>}
                {isFixing ? `FIXING: ${progress} / ${totalToFix}` : 'Scan Harem'}
              </button>
              {isUnlocked && !isFixing && <button onClick={() => {if(confirm('Refresh ALL data?')) smartFixer(true)}} className="bg-slate-900/50 border-2 border-pink-600/20 hover:border-pink-600/60 text-[11px] font-black text-slate-400 hover:text-pink-500 uppercase py-3 rounded-[20px] flex items-center justify-center gap-3 transition-all tracking-widest"><Zap size={14}/> FULL RESCAN</button>}
            </div>
          </div>
        </header>

        <section className="grid grid-cols-1 lg:grid-cols-4 gap-12">
          <div className="lg:col-span-1 space-y-8">
            <div className="bg-[#111622]/90 backdrop-blur-3xl border-2 border-slate-800 p-8 rounded-[32px] space-y-8 shadow-2xl sticky top-10">
              <div className="relative"><SearchIcon className="absolute left-6 top-6 text-slate-600" size={22}/><input className="w-full bg-slate-950 border-2 border-slate-800 rounded-[20px] py-5 pl-16 pr-8 text-base outline-none focus:border-pink-500 font-bold transition-all shadow-inner" placeholder="Quick Search..." onChange={(e) => setQuery(e.target.value)} /></div>
              <div className="space-y-4">
                <div className="flex items-center gap-2 ml-2"><Star size={14} className="text-orange-500 fill-orange-500"/><p className="text-[12px] font-black text-slate-500 uppercase tracking-widest">Wishlist Search</p></div>
                <textarea className="w-full bg-slate-950 border-2 border-slate-800 rounded-[20px] p-5 text-[13px] h-40 outline-none font-mono focus:border-orange-500 text-orange-400 shadow-inner" placeholder="Series names..." value={wishlistText} onChange={(e) => setWishlistText(e.target.value)} />
              </div>
              <div className="space-y-4 border-t border-slate-800 pt-8">
                <p className="text-[12px] font-black text-slate-500 uppercase tracking-widest ml-2">Import Data</p>
                <textarea className="w-full bg-slate-950 border-2 border-slate-800 rounded-[20px] p-5 text-[13px] h-32 outline-none font-mono focus:border-pink-600 text-pink-500 shadow-inner" placeholder="$mmsl-ky+a" value={inputText} onChange={(e) => setInputText(e.target.value)} />
                <button onClick={handleImport} disabled={!isUnlocked} className="w-full bg-pink-600 hover:bg-pink-500 py-5 rounded-[20px] text-[15px] font-black text-white uppercase shadow-2xl transition-all">Import Chars</button>
              </div>
            </div>
          </div>
          <div className="lg:col-span-3 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-10">
            {sortedChars.map((c) => (<CharacterCard key={c.id} char={c} isUnlocked={isUnlocked} onDelete={(char) => updateDoc(doc(db, "profiles", activeProfile), { characters: arrayRemove(char) })} onToggleTrade={(cid) => { const currentTags = profiles[activeProfile]?.tradeTags || []; const isTagged = currentTags.includes(cid); updateDoc(doc(db, "profiles", activeProfile), { tradeTags: isTagged ? arrayRemove(cid) : arrayUnion(cid) }); }} isTagged={profiles[activeProfile]?.tradeTags?.includes(c.id)} />))}
          </div>
        </section>
      </main>
    </div>
  );
}
