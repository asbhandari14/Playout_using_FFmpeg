import React, { useMemo, useState } from 'react';
import { Eye, Tv, Upload } from 'lucide-react';

export default function BandPreviewScreen({
  type = 'lband', // 'lband' | 'ashton'
  previewUrl = '',
  channelName = 'Live Playout',
  windowX = 300,
  windowY = 20,
  windowWidth = 960,
  windowHeight = 540,
  ashtonSqueeze = true,
  ashtonHeight = 160,
  duration = 10,
  emptyHint = 'Upload an image on the right to see live preview'
}) {
  const [isSimulatingAir, setIsSimulatingAir] = useState(true);
  const isLBand = type === 'lband';

  const cutoutStyles = useMemo(() => {
    const x = Math.max(0, Math.min(1280, Number(windowX) || 0));
    const y = Math.max(0, Math.min(720, Number(windowY) || 0));
    const w = Math.max(64, Math.min(1280 - x, Number(windowWidth) || 960));
    const h = Math.max(64, Math.min(720 - y, Number(windowHeight) || 540));
    return {
      left: `${(x / 1280) * 100}%`,
      top: `${(y / 720) * 100}%`,
      width: `${(w / 1280) * 100}%`,
      height: `${(h / 720) * 100}%`,
      raw: { x, y, w, h }
    };
  }, [windowX, windowY, windowWidth, windowHeight]);

  const safeAshtonH = Math.max(60, Math.min(400, Number(ashtonHeight) || 160));
  const ashtonVideoHeight = ashtonSqueeze ? Math.max(20, 720 - safeAshtonH) : 720;
  const ashtonBarPct = `${(safeAshtonH / 720) * 100}%`;
  const ashtonVidPct = `${(ashtonVideoHeight / 720) * 100}%`;

  return (
    <div className="bg-[#10141e] border border-[#1e2638] rounded-xl 2xl:rounded-2xl p-4 shadow-xl space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
          <Eye size={14} className="text-cyan-400" />
          <span>16:9 Broadcast Playout Preview</span>
        </span>
        <button
          type="button"
          onClick={() => setIsSimulatingAir((prev) => !prev)}
          className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border transition flex items-center gap-1.5 cursor-pointer ${
            isSimulatingAir
              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
              : 'bg-slate-800/60 text-slate-400 border-slate-700'
          }`}
          title="Toggle overlay display in preview"
        >
          <span className={`w-1.5 h-1.5 rounded-full ${isSimulatingAir ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'}`} />
          <span>{isSimulatingAir ? 'Overlay ON Air' : 'Overlay OFF'}</span>
        </button>
      </div>

      {/* Simulated 16:9 Broadcast Screen */}
      <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-[#05070d] border border-[#1c263b] shadow-inner select-none">
        {/* Program Video Simulation Layer */}
        <div
          className="absolute inset-0 transition-all duration-200 overflow-hidden flex flex-col justify-between p-2.5"
          style={
            !isSimulatingAir
              ? { inset: 0 }
              : isLBand
                ? {
                    left: cutoutStyles.left,
                    top: cutoutStyles.top,
                    width: cutoutStyles.width,
                    height: cutoutStyles.height
                  }
                : ashtonSqueeze
                  ? {
                      left: 0,
                      top: 0,
                      width: '100%',
                      height: ashtonVidPct
                    }
                  : { inset: 0 }
          }
        >
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/85 via-slate-900 to-cyan-950/75" />

          <div className="relative z-10 flex items-center justify-between text-[9px] font-mono font-bold text-white/80">
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-600/90 text-white tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
              LIVE
            </span>
            <span className="bg-black/60 backdrop-blur px-1.5 py-0.5 rounded text-cyan-300 border border-cyan-500/20">
              {isSimulatingAir
                ? isLBand
                  ? `Video: ${cutoutStyles.raw.w}x${cutoutStyles.raw.h} @ (${cutoutStyles.raw.x},${cutoutStyles.raw.y})`
                  : ashtonSqueeze
                    ? `Squeezed: 1280x${ashtonVideoHeight}`
                    : 'Full: 1280x720'
                : '1280x720 Full Screen'}
            </span>
          </div>

          <div className="relative z-10 text-center my-auto">
            <Tv size={24} className="mx-auto text-cyan-400/70 mb-1" />
            <p className="text-[10px] font-bold text-slate-200 tracking-wide font-mono">
              MAIN BROADCAST PROGRAM
            </p>
            <p className="text-[8.5px] text-slate-400 font-mono">{channelName || 'Live Playout'}</p>
          </div>

          <div className="relative z-10 text-right text-[8px] text-slate-400 font-mono">
            {Number(duration) || 10}s air duration
          </div>
        </div>

        {/* Graphic Overlay Layer */}
        {isSimulatingAir && previewUrl && (
          isLBand ? (
            <img
              src={previewUrl}
              alt="L-Band Preview"
              className="absolute inset-0 w-full h-full object-fill pointer-events-none z-20"
            />
          ) : (
            <div
              style={{ height: ashtonBarPct }}
              className="absolute bottom-0 left-0 right-0 z-20 overflow-hidden flex items-center justify-center bg-black/35 pointer-events-none"
            >
              <img
                src={previewUrl}
                alt="Ashton Preview"
                className="w-full h-full object-fill"
              />
            </div>
          )
        )}

        {/* Dashed Video Window Frame Outline */}
        {isSimulatingAir && isLBand && (
          <div
            style={{
              left: cutoutStyles.left,
              top: cutoutStyles.top,
              width: cutoutStyles.width,
              height: cutoutStyles.height
            }}
            className="absolute z-30 border-2 border-dashed border-cyan-400/80 pointer-events-none shadow-[0_0_0_1px_rgba(0,0,0,0.6)]"
          >
            <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/75 text-[8.5px] font-mono text-cyan-300 border border-cyan-500/40">
              Window {cutoutStyles.raw.w}x{cutoutStyles.raw.h}
            </span>
          </div>
        )}

        {isSimulatingAir && !isLBand && (
          <div
            style={{ height: ashtonBarPct }}
            className="absolute bottom-0 left-0 right-0 z-30 border-t-2 border-dashed border-purple-400/80 pointer-events-none"
          >
            <span className="absolute top-1 right-1 px-1.5 py-0.5 rounded bg-black/75 text-[8.5px] font-mono text-purple-300 border border-purple-500/40">
              Band H: {safeAshtonH}px
            </span>
          </div>
        )}

        {/* Empty graphic notice */}
        {isSimulatingAir && !previewUrl && (
          <div className="absolute inset-0 z-10 pointer-events-none flex flex-col items-center justify-center bg-black/25 p-4 text-center">
            <div className="p-2 rounded-xl bg-cyan-950/70 border border-cyan-800/60 text-cyan-300 mb-1.5">
              <Upload size={16} />
            </div>
            <span className="text-[11px] font-mono font-semibold text-slate-200">
              No Graphic Selected Yet
            </span>
            <span className="text-[9.5px] font-mono text-slate-400 mt-0.5">
              {emptyHint}
            </span>
          </div>
        )}
      </div>

      {/* Preview Specifications */}
      <div className="p-3 bg-[#070a12] border border-[#182236] rounded-xl font-mono text-[11px] space-y-1.5">
        <div className="flex items-center justify-between text-slate-400">
          <span>Overlay Type:</span>
          <span className="text-cyan-300 font-bold uppercase">
            {isLBand ? 'L-Band Cutout' : 'Ashton Lower Third'}
          </span>
        </div>
        <div className="flex items-center justify-between text-slate-400">
          <span>Video Window:</span>
          {isLBand ? (
            <span className="text-slate-200">
              X:{cutoutStyles.raw.x} Y:{cutoutStyles.raw.y} • {cutoutStyles.raw.w}x{cutoutStyles.raw.h}
            </span>
          ) : (
            <span className="text-slate-200">
              X:0 Y:0 • 1280x{ashtonVideoHeight} ({ashtonSqueeze ? 'Squeeze' : 'Overlay'})
            </span>
          )}
        </div>
        {!isLBand && (
          <div className="flex items-center justify-between text-slate-400">
            <span>Banner Height:</span>
            <span className="text-purple-300 font-bold">{safeAshtonH}px</span>
          </div>
        )}
        <div className="flex items-center justify-between text-slate-400">
          <span>Band Duration:</span>
          <span className="text-emerald-400 font-bold">{Number(duration) || 10} seconds</span>
        </div>
      </div>
    </div>
  );
}

