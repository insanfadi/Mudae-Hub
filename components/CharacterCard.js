import React, { useState } from 'react';
import { Tag, X, Gem, Key } from 'lucide-react';

const CharacterCard = ({ char, isUnlocked, onToggleTrade, onDelete, isTagged }) => {
  const [imgError, setImgError] = useState(false);
  const imgUrl = `/api/mudae?name=${encodeURIComponent(char.name)}&series=${encodeURIComponent(char.series || 'unknown')}`;

  return (
    <div className="group relative bg-[#161b29] rounded-[24px] border-2 border-slate-800 hover:border-pink-500 transition-all duration-500 overflow-hidden shadow-2xl flex flex-col">
      <div className="aspect-[2/3] relative overflow-hidden bg-[#0b0f1a]">
        <img 
          src={imgError ? `https://via.placeholder.com/225x350?text=Reloading` : imgUrl} 
          alt={char.name} 
          className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110 transform-gpu" 
          onError={() => setImgError(true)}
          loading="lazy" 
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b0f1a] via-transparent to-transparent opacity-90" />
        <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-xl px-3 py-1.5 rounded-xl text-[13px] font-black text-orange-400 border border-white/10 shadow-2xl z-10 flex items-center gap-1.5">
          <Gem size={12} className="text-orange-400 fill-orange-400/20" />
          {char.kakera?.toLocaleString()}
        </div>
        {char.keys > 0 && (
          <div className="absolute top-4 right-4 bg-yellow-500/90 backdrop-blur-md px-3 py-1.5 rounded-xl text-[13px] font-black text-black shadow-2xl z-10 flex items-center gap-1.5">
            <Key size={12} className="fill-black" />
            {char.keys}
          </div>
        )}
        {isUnlocked && (
          <button onClick={() => onDelete(char)} className="absolute top-4 right-4 p-2.5 bg-red-600 hover:bg-red-500 text-white rounded-2xl opacity-0 group-hover:opacity-100 transition-all shadow-xl z-30">
            <X size={20}/>
          </button>
        )}
        <button onClick={() => onToggleTrade(char.id)} className={`absolute bottom-5 right-5 p-4 rounded-[20px] backdrop-blur-xl transition-all z-20 ${isTagged ? 'bg-pink-600 text-white shadow-pink-600/50 shadow-lg scale-110' : 'bg-white/5 text-white/20 hover:bg-white/10'}`}>
          <Tag size={22}/>
        </button>
      </div>
      <div className="p-6 bg-[#161b29] z-20">
        <div className="flex items-center gap-2">
           <h4 className="text-[20px] font-bold text-white truncate uppercase tracking-tight leading-tight mb-1">{char.name}</h4>
           {char.gender === 'female' && <span className="text-pink-500 font-black text-lg">♀</span>}
           {char.gender === 'male' && <span className="text-blue-500 font-black text-lg">♂</span>}
        </div>
        <p className={`text-[14px] truncate font-black uppercase tracking-widest ${char.series?.toLowerCase().includes('unknown') ? 'text-red-500' : 'text-slate-500'}`}>
          {char.series || 'Unknown'}
        </p>
        {char.rank && <p className="text-[10px] font-black text-slate-700 mt-1 uppercase tracking-tighter italic">Rank #{char.rank}</p>}
      </div>
    </div>
  );
};

export default React.memo(CharacterCard);
