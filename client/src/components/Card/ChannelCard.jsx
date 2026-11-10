import React from 'react';
import { Radio, PlayCircle } from 'lucide-react';

export default function ChannelCard({ channel, onEnter }) {
  if (!channel) return null;

  return (
    <div className="bg-[#10141e] border border-[#1e2638] hover:border-[#2d3a54] rounded-xl 2xl:rounded-2xl p-3.5 2xl:p-4 shadow-xl flex flex-col justify-between transition group relative overflow-hidden">
      {/* Glowing top line for live channels */}
      {channel.isLive && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-red-600 via-rose-500 to-amber-500 animate-pulse" />
      )}

      <div>
        {/* Channel Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
                channel.isLive
                  ? 'bg-red-500/10 border-red-500/30 text-red-400'
                  : 'bg-blue-500/10 border-blue-500/30 text-blue-400'
              }`}
            >
              <Radio size={15} className={channel.isLive ? 'animate-pulse' : ''} />
            </div>
            <div>
              <h3 className="font-bold text-xs 2xl:text-sm text-white group-hover:text-cyan-400 transition m-0">
                {channel.name}
              </h3>
              <span className="text-[10px] text-slate-400 font-mono">
                Key: {channel.streamKey}
              </span>
            </div>
          </div>

          {/* Status Badge */}
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9.5px] font-bold uppercase tracking-wider ${
              channel.isLive
                ? 'bg-red-950/80 text-red-400 border border-red-700/80 animate-pulse shadow-sm shadow-red-900/50'
                : 'bg-slate-800/80 text-slate-300 border border-slate-700/60'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                channel.isLive ? 'bg-red-500 animate-ping' : 'bg-slate-400'
              }`}
            />
            {channel.isLive ? 'ON AIR' : 'IDLE'}
          </span>
        </div>

        {/* Metadata Details */}
        <div className="space-y-1.5 py-2.5 border-y border-[#1b2232] text-[11px] text-slate-300">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-medium">Assigned User</span>
            <span className="font-semibold text-slate-200">{channel.assignedOperator}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-medium">Media Server</span>
            <span className="text-slate-300">{channel.mediaServer}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-medium">Stream Format</span>
            <span className="text-slate-400 font-mono text-[10px]">{channel.streamFormat}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-medium">Storage Quota</span>
            <span className="font-mono text-cyan-300 font-semibold text-[10px]">
              {channel.storageDisplay || '0.00 GB / Unlimited'}
            </span>
          </div>

          {/* Endpoints */}
          <div className="pt-1.5 space-y-1 border-t border-[#181e2b]">
            <div>
              <span className="text-slate-500 block text-[9px] uppercase font-semibold">
                HLS Output URL
              </span>
              <code
                className="text-emerald-400 bg-[#090d14] px-2 py-0.5 rounded block truncate font-mono text-[10px] border border-[#1d2536]"
                title={channel.hlsUrl}
              >
                {channel.hlsUrl}
              </code>
            </div>
            <div>
              <span className="text-slate-500 block text-[9px] uppercase font-semibold">
                RTMP Push URL
              </span>
              <code
                className="text-blue-400 bg-[#090d14] px-2 py-0.5 rounded block truncate font-mono text-[10px] border border-[#1d2536]"
                title={channel.rtmpUrl}
              >
                {channel.rtmpUrl}
              </code>
            </div>
          </div>
        </div>
      </div>

      {/* Actions footer */}
      <div className="mt-3 pt-1 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => onEnter?.(channel._id)}
          className="flex-1 py-2 px-3 rounded-lg bg-[#00bcd4] hover:bg-[#06b6d4] text-black font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-md shadow-cyan-500/20 cursor-pointer"
        >
          <PlayCircle size={15} />
          Enter Control Room
        </button>
      </div>
    </div>
  );
}

