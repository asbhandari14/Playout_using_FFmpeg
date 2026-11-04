import React from 'react';
import { Radio } from 'lucide-react';

export default function LoginHeader() {
  return (
    <div className="text-center mb-8">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600/10 border border-blue-500/30 text-blue-400 mb-3 shadow-lg shadow-blue-500/5">
        <Radio size={28} className="animate-pulse" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-white m-0">
        Playlist Playout
      </h1>
      <p className="text-xs text-slate-400 mt-1 uppercase tracking-wider font-medium">
        Broadcast Ingest & Live Feed
      </p>
    </div>
  );
}