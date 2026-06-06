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

  // Load profiles from Firestore
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "profiles"), (s) => {
      const d = {}; s.forEach(doc => d[doc.id] = doc.data());
      setProfiles(d);
      // Auto-select first profile if none active
      if (!activeProfile && Object.keys(d).length > 0) {
        setActiveProfile(Object.keys(d)[0]);
      }
    });
    return () => unsub();
  }, [activeProfile]);

  // Reset lock status when switching profiles
  useEffect(() => {
    setIsUnlocked(false);
    setPasswordInput('');
  }, [activeProfile]);

  const handleUnlock = async () => {
    if (!activeProfile) return alert("Please select a profile first!");
    
    const profileData = profiles[activeProfile];
    
    // Safety check if profile exists in data
    if (!profileData) return alert("Profile data not found!");

    // 1. Master Recovery Bypass
    if (passwordInput === "AhmadMudae2026") {
      await updateDoc(doc(db, "profiles", activeProfile), { password: "AhmadMudae2026" });
      setIsUnlocked(true);
      return;
    }

    // 2. Claim Mode (If profile has no password yet)
    if (!profileData.password || profileData.password === "") {
      if (passwordInput.length < 4) return alert("Please enter a password at least 4 characters long to set it.");
      if (confirm(`Set "${passwordInput}" as the permanent password for ${activeProfile}?`)) {
        await updateDoc(doc(db, "profiles", activeProfile), { password: passwordInput });
        setIsUnlocked(true);
      }
      return;
    }
    
    // 3. Normal Password Check
    if (passwordInput === profileData.password) {
      setIsUnlocked(true);
    } else {
      alert("Wrong Password! Try again.");
    }
  };

  const smartFixer = async (forceAll = false) => {
    if (!isUnlocked || isFixing) return;
    const allChars = [...(profiles[activeProfile]?.characters || [])];
    const targets = forceAll ? allChars : allChars.filter(c => !c.series || c.series.toLowerCase().includes('unknown') || c.gender === 'none');
    if (targets.length === 0) return alert("Harem is fully synced!");

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
    if (!isUnlocked) return alert("Unlock profile to import!");
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
          let name = namePart.split(' · ')[0].split(/[\d,]+\s*ka/)[0].trim();
          newCharacters.push({ id: Math.random().toString(36).substr(2, 9), name, series: currentSeries, kakera: parseInt(kakeraMatch[1].replace(/,/g, '')), rank: rankMatch ? rankMatch[1] : null, keys: keysMatch ? parseInt(keysMatch[1]) : 0, gender: "none" });
        }
      }
    });

    if (newCharacters.length === 0) return alert("No valid characters found in text!");
    await updateDoc(doc(db, "profiles", activeProfile), { characters: arrayUnion(...newCharacters) });
    setInputText('');
    alert(`Successfully imported ${newCharacters.length} characters!`);
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
          <p className="text-[12px] font-black text-slate-600 uppercase tracking-widest ml-2 mb-6">Rollers List</p>
          {Object.keys(profiles).map(name => (
            <button key={name} onClick={() => setActiveProfile(name)} className={`w-full flex items-center justify-between px-6 py-4 rounded-[20px] text-[15px] font-bold transition-all duration-300 ${activeProfile === name ? 'bg-pink-600 text-white shadow-2xl translate-x-2' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
              <div className="flex items-center gap-4"><Users size={20}/> {name}</div>
              {isUnlocked && activeProfile === name && (
                <Trash2 size={18} className="text-white/40 hover:text-white transition-colors" onClick={(e) => { e.stopPropagation(); if(confirm(`Delete ${name} permanently?`)) deleteDoc(doc(db, "profiles", name)); }} />
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
              <span className="bg-pink-900/20 border-2 border-pink-500/20 px-6 py-2 ro
