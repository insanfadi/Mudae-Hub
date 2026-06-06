import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, setDoc, onSnapshot, collection, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { Search, Lock, Unlock, Import, Plus, Trash2, Tag, Share2, User } from 'lucide-react';

export default function MudaeHub() {
  const [profiles, setProfiles] = useState({});
  const [activeProfile, setActiveProfile] = useState('');
  const [inputText, setInputText] = useState('');
  const [pin, setPin] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [search, setSearch] = useState('');
  const [newProfileName, setNewProfileName] = useState('');

  // 1. Real-time Sync with Database
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

  // 2. The Mudae List Parser ($mm / $mml)
  const handleImport = async () => {
    if (!isUnlocked) return alert("Enter the correct PIN to edit!");
    if (!activeProfile) return alert("Select or create a profile first!");
    
    const lines = inputText.split('\n');
    const newCharacters = lines.map(line => {
      // Regex cleans emojis and split by the dot separator
      const cleanLine = line.replace(/:[^:]+:/g, '').trim();
      const parts = cleanLine.split('·').map(p => p.trim());
      
      if (parts.length < 2) return null;

      return {
        name: parts[0],
        series: parts[1],
        kakera: parts[2] ? parseInt(parts[2].replace(/,/g, '').replace('ka', '')) : 0,
        keys: line.match(/\((\d+)\)/) ? line.match(/\((\d+)\)/)[1] : 0,
        id: Math.random().toString(36).substr(2, 9)
      };
    }).filter(Boolean);

    await setDoc(doc(db, "profiles", activeProfile), {
      characters: newCharacters,
      lastUpdated: new Date().toLocaleString()
    }, { merge: true });
    
    setInputText('');
    alert("Import Successful!");
  };

  // 3. Create New Profile
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

  // 4. Trade System Logic
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
      {/* HEADER SECTION */}
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
              onClick={() => setIsUnlocked(pin === "1234")} // YOU CAN CHANGE 1234 TO YOUR PIN
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
        {/* LEFT COLUMN: CONTROLS */}
        <div className="lg:col-span-1 space-y-6">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-3 text-slate-500" size={18}/>
            <input 
              className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:border-pink-500 outline-none transition-all"
              placeholder="Search Harem..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Import Box */}
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
            <button 
              onClick={handleImport}
              disabled={!isUnlocked}
              className="w-full bg-pink-600 hover:bg-pink-500 disabled:bg-slate-700 text-white font-bold py-2 rounded-lg text-xs transition-all"
            >
              Update Profile
            </button>
          </div>

          {/* Add Profile */}
          <div className="flex gap-2">
            <input 
              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs"
              placeholder="New Profile Name"
              value={newProfileName}
              onChange={(e) => setNewProfile
