import React, { useState, useRef, useEffect } from 'react';
import api from '../api/axios.js';
import {
  Sliders,
  Image as ImageIcon,
  Type,
  Upload,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Send,
  CornerUpLeft,
  CornerUpRight,
  CornerDownLeft,
  CornerDownRight,
  Circle,
  Sparkles,
  Layers,
  Crosshair,
  Clock,
  Timer as TimerIcon
} from 'lucide-react';

export const TICKER_FONT_OPTIONS = [
  { value: 'Arial', label: 'Arial (Clean Sans)', css: 'Arial, sans-serif' },
  { value: 'Impact', label: 'Impact (Heavy Headline)', css: 'Impact, sans-serif' },
  { value: 'Times New Roman', label: 'Times New Roman (Classic Serif)', css: '"Times New Roman", Times, serif' },
  { value: 'Georgia', label: 'Georgia (Elegant Serif)', css: 'Georgia, serif' },
  { value: 'Verdana', label: 'Verdana (Wide Sans)', css: 'Verdana, sans-serif' },
  { value: 'Trebuchet MS', label: 'Trebuchet MS (Modern)', css: '"Trebuchet MS", sans-serif' },
  { value: 'Courier New', label: 'Courier New (Monospace)', css: '"Courier New", Courier, monospace' },
  { value: 'Segoe UI', label: 'Segoe UI (Crisp Modern)', css: '"Segoe UI", Tahoma, sans-serif' },
  { value: 'Noto Sans Devanagari', label: 'Hindi (Devanagari)', css: '"Nirmala UI", "Mangal", "Noto Sans Devanagari", sans-serif' },
  { value: 'Comic Sans MS', label: 'Comic Sans (Casual)', css: '"Comic Sans MS", cursive, sans-serif' },
];

export const getCssFontFamily = (font) => {
  const match = TICKER_FONT_OPTIONS.find(
    (o) => o.value.toLowerCase() === String(font || '').toLowerCase()
  );
  if (match) return match.css;
  const fLower = String(font || '').toLowerCase();
  if (fLower === 'sans bold' || fLower === 'sans') return 'Arial, sans-serif';
  return font ? `"${font}", Arial, sans-serif` : 'Arial, sans-serif';
};

export default function LiveControls({ channel, onBrandingUpdated, currentOnAirSchedule = null }) {
  const [activeTab, setActiveTab] = useState('logo');
  const logoInputRef = useRef(null);
  const bugInputRef = useRef(null);
  const bugPadRef = useRef(null);
  const isDraggingBugRef = useRef(false);

  // Logo state
  const [logoAssetPath, setLogoAssetPath] = useState('');
  const [logoEnabled, setLogoEnabled] = useState(false);
  const [logoPosition, setLogoPosition] = useState('top-right');
  const [logoSizePercent, setLogoSizePercent] = useState(10);
  const [logoMarginX, setLogoMarginX] = useState(2);
  const [logoMarginY, setLogoMarginY] = useState(2);
  const [logoShowDuringSchedule, setLogoShowDuringSchedule] = useState(true);

  // Station Bug state (supports static images & animated GIF + free positioning)
  const [bugAssetPath, setBugAssetPath] = useState('');
  const [bugEnabled, setBugEnabled] = useState(false);
  const [bugPosition, setBugPosition] = useState('custom');
  const [bugPositionX, setBugPositionX] = useState(95);
  const [bugPositionY, setBugPositionY] = useState(95);
  const [bugSizePercent, setBugSizePercent] = useState(8);
  const [bugMarginX, setBugMarginX] = useState(2);
  const [bugMarginY, setBugMarginY] = useState(2);
  const [bugIsGif, setBugIsGif] = useState(false);
  const [bugIsMov, setBugIsMov] = useState(false);

  // Ticker state
  const [tickerEnabled, setTickerEnabled] = useState(false);
  const [tickerText, setTickerText] = useState('Shree Sai Bhakti Dhara');
  const [tickerBgColor, setTickerBgColor] = useState('#000000');
  const [tickerTextColor, setTickerTextColor] = useState('#ffffff');
  const [tickerFontFamily, setTickerFontFamily] = useState('Arial');
  const [tickerFontSize, setTickerFontSize] = useState(18);
  const [tickerMarginBottom, setTickerMarginBottom] = useState(0);
  const [tickerPaddingY, setTickerPaddingY] = useState(13);
  const [tickerWidth, setTickerWidth] = useState(100);
  const [tickerAlignment, setTickerAlignment] = useState('Center');
  const [tickerSpeed, setTickerSpeed] = useState(3);

  // Back In Timer state (counts down frame-accurately until schedule ad ends)
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [timerShowDuringSchedule, setTimerShowDuringSchedule] = useState(true);
  const [timerLabel, setTimerLabel] = useState('BACK IN ');
  const [timerFormat, setTimerFormat] = useState('MM:SS');
  const [timerPosition, setTimerPosition] = useState('top-left');
  const [timerPositionX, setTimerPositionX] = useState(5);
  const [timerPositionY, setTimerPositionY] = useState(5);
  const [timerFontSize, setTimerFontSize] = useState(24);
  const [timerFontColor, setTimerFontColor] = useState('#ffffff');
  const [timerBgColor, setTimerBgColor] = useState('#000000cc');

  // Toast alert
  const [alert, setAlert] = useState(null);

  useEffect(() => {
    if (channel?.branding) {
      const bLogo = channel.branding.logo || {};
      setLogoAssetPath(bLogo.assetPath || '');
      setLogoEnabled(!!bLogo.enabled);
      setLogoPosition(bLogo.position || 'top-right');
      setLogoSizePercent(bLogo.sizePercent !== undefined ? bLogo.sizePercent : 10);
      setLogoMarginX(bLogo.marginX || 2);
      setLogoMarginY(bLogo.marginY || 2);
      setLogoShowDuringSchedule(bLogo.showDuringSchedule !== false);

      const bBug = channel.branding.bug || {};
      setBugAssetPath(bBug.assetPath || '');
      setBugEnabled(!!bBug.enabled);
      setBugPosition(bBug.position || 'custom');
      setBugPositionX(
        bBug.positionX !== undefined
          ? bBug.positionX
          : bBug.position === 'top-left'
            ? 3
            : bBug.position === 'top-right'
              ? 95
              : bBug.position === 'center'
                ? 50
                : bBug.position === 'bottom-left'
                  ? 3
                  : 95
      );
      setBugPositionY(
        bBug.positionY !== undefined
          ? bBug.positionY
          : bBug.position === 'top-left'
            ? 3
            : bBug.position === 'top-right'
              ? 3
              : bBug.position === 'center'
                ? 50
                : bBug.position === 'bottom-left'
                  ? 95
                  : 95
      );
      setBugSizePercent(bBug.sizePercent !== undefined ? bBug.sizePercent : 8);
      setBugMarginX(bBug.marginX !== undefined ? bBug.marginX : 2);
      setBugMarginY(bBug.marginY !== undefined ? bBug.marginY : 2);
      const isMov = Boolean(bBug.isMov || (bBug.assetPath && String(bBug.assetPath).toLowerCase().endsWith('.mov')));
      setBugIsMov(isMov);
      setBugIsGif(Boolean(bBug.isGif || (bBug.assetPath && String(bBug.assetPath).toLowerCase().endsWith('.gif'))));

      const bTicker = channel.branding.ticker || {};
      setTickerEnabled(!!bTicker.enabled);
      if (bTicker.text) setTickerText(bTicker.text);
      if (bTicker.bgColor) setTickerBgColor(bTicker.bgColor);
      if (bTicker.textColor) setTickerTextColor(bTicker.textColor);
      if (bTicker.fontFamily) setTickerFontFamily(bTicker.fontFamily);
      if (bTicker.fontSize) setTickerFontSize(bTicker.fontSize);
      if (bTicker.marginBottom !== undefined) setTickerMarginBottom(bTicker.marginBottom);
      else setTickerMarginBottom(0);
      if (bTicker.paddingY !== undefined) setTickerPaddingY(bTicker.paddingY);
      if (bTicker.width !== undefined) setTickerWidth(bTicker.width);
      if (bTicker.alignment) {
        const a = String(bTicker.alignment).toLowerCase();
        if (a === 'left') setTickerAlignment('Left');
        else if (a === 'right') setTickerAlignment('Right');
        else setTickerAlignment('Center');
      }
      if (bTicker.speed !== undefined) setTickerSpeed(bTicker.speed);

      const bTimer = channel.branding.backInTimer || {};
      setTimerEnabled(!!bTimer.enabled);
      setTimerShowDuringSchedule(bTimer.showDuringSchedule !== false);
      setTimerLabel(bTimer.label !== undefined ? bTimer.label : 'BACK IN ');
      setTimerFormat(bTimer.format || 'MM:SS');
      setTimerPosition(bTimer.position || 'top-left');
      setTimerPositionX(bTimer.positionX !== undefined ? Number(bTimer.positionX) : 5);
      setTimerPositionY(bTimer.positionY !== undefined ? Number(bTimer.positionY) : 5);
      setTimerFontSize(bTimer.fontSize || 24);
      setTimerFontColor(bTimer.fontColor || '#ffffff');
      setTimerBgColor(bTimer.bgColor || '#000000cc');
    }
  }, [channel]);

  const showAlert = (type, message) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 3500);
  };

  // Upload custom logo image
  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !channel?._id) return;

    const formData = new FormData();
    formData.append('logo', file);

    try {
      const res = await api.post(`/channels/${channel._id}/logo/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setLogoAssetPath(res.data.logo.assetPath);
      setLogoEnabled(true);
      showAlert('success', 'Logo uploaded & pushed to stream overlay');
      if (onBrandingUpdated) onBrandingUpdated({ type: 'logo', data: res.data.logo });
    } catch (err) {
      showAlert('error', err.response?.data?.message || 'Failed to upload logo');
    }
  };

  // Toggle or update logo settings
  const handleUpdateLogo = async (updates = {}) => {
    if (!channel?._id) return;

    // Optimistically update local UI state immediately
    if (updates.position !== undefined) setLogoPosition(updates.position);
    if (updates.enabled !== undefined) setLogoEnabled(updates.enabled);
    if (updates.sizePercent !== undefined) setLogoSizePercent(updates.sizePercent);
    if (updates.marginX !== undefined) setLogoMarginX(updates.marginX);
    if (updates.marginY !== undefined) setLogoMarginY(updates.marginY);
    if (updates.showDuringSchedule !== undefined) setLogoShowDuringSchedule(updates.showDuringSchedule);

    // Build targeted payload with ONLY the fields explicitly modified
    const payload = {};
    if (updates.assetPath !== undefined) payload.assetPath = updates.assetPath;
    if (updates.enabled !== undefined) payload.enabled = updates.enabled;
    if (updates.position !== undefined) payload.position = updates.position;
    if (updates.sizePercent !== undefined) payload.sizePercent = updates.sizePercent;
    if (updates.marginX !== undefined) payload.marginX = updates.marginX;
    if (updates.marginY !== undefined) payload.marginY = updates.marginY;
    if (updates.showDuringSchedule !== undefined) payload.showDuringSchedule = updates.showDuringSchedule;

    try {
      const res = await api.put(`/channels/${channel._id}/logo`, payload);
      const serverLogo = res.data?.logo;
      if (serverLogo) {
        if (serverLogo.position !== undefined) setLogoPosition(serverLogo.position);
        if (serverLogo.enabled !== undefined) setLogoEnabled(!!serverLogo.enabled);
        if (serverLogo.sizePercent !== undefined) setLogoSizePercent(serverLogo.sizePercent);
        if (serverLogo.marginX !== undefined) setLogoMarginX(serverLogo.marginX);
        if (serverLogo.marginY !== undefined) setLogoMarginY(serverLogo.marginY);
        if (serverLogo.showDuringSchedule !== undefined) setLogoShowDuringSchedule(serverLogo.showDuringSchedule !== false);
      }
      showAlert('success', 'Live logo overlay updated');
      if (onBrandingUpdated) onBrandingUpdated({ type: 'logo', data: serverLogo || payload });
    } catch (err) {
      if (channel?.branding?.logo) {
        setLogoPosition(channel.branding.logo.position || 'top-right');
        setLogoEnabled(!!channel.branding.logo.enabled);
      }
      showAlert('error', 'Failed to update logo overlay');
    }
  };

  // Upload custom bug image (PNG) or QuickTime animation (MOV)
  const handleBugUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !channel?._id) return;

    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (ext !== '.png' && ext !== '.mov') {
      showAlert('error', 'Only PNG (.png) and QuickTime MOV (.mov) files are supported for Station Bug');
      if (e.target) e.target.value = '';
      return;
    }

    const formData = new FormData();
    formData.append('bug', file);

    try {
      const res = await api.post(`/channels/${channel._id}/bug/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setBugAssetPath(res.data.bug.assetPath);
      setBugEnabled(true);
      setBugIsMov(!!res.data.bug.isMov || ext === '.mov');
      setBugIsGif(false);
      showAlert('success', res.data.message || 'Bug uploaded & pushed to stream overlay');
      if (onBrandingUpdated) onBrandingUpdated({ type: 'bug', data: res.data.bug });
    } catch (err) {
      showAlert('error', err.response?.data?.message || 'Failed to upload station bug');
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  // Bug coordinate helper: calculates 0-100% (X, Y) relative to the screen pad
  const calculateBugCoordsFromEvent = (e) => {
    if (!bugPadRef.current) return null;
    const rect = bugPadRef.current.getBoundingClientRect();
    const clientX = e.clientX ?? e.touches?.[0]?.clientX;
    const clientY = e.clientY ?? e.touches?.[0]?.clientY;
    if (clientX === undefined || clientY === undefined) return null;
    const x = Math.max(0, Math.min(100, Math.round(((clientX - rect.left) / rect.width) * 100)));
    const y = Math.max(0, Math.min(100, Math.round(((clientY - rect.top) / rect.height) * 100)));
    return { x, y };
  };

  const handleBugPadPointerDown = (e) => {
    isDraggingBugRef.current = true;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (_) {}
    const coords = calculateBugCoordsFromEvent(e);
    if (!coords) return;
    setBugPositionX(coords.x);
    setBugPositionY(coords.y);
    setBugPosition('custom');
  };

  const handleBugPadPointerMove = (e) => {
    if (!isDraggingBugRef.current) return;
    const coords = calculateBugCoordsFromEvent(e);
    if (!coords) return;
    setBugPositionX(coords.x);
    setBugPositionY(coords.y);
    setBugPosition('custom');
  };

  const handleBugPadPointerUp = (e) => {
    if (!isDraggingBugRef.current) return;
    isDraggingBugRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (_) {}
    const coords = calculateBugCoordsFromEvent(e);
    const finalX = coords ? coords.x : bugPositionX;
    const finalY = coords ? coords.y : bugPositionY;
    setBugPositionX(finalX);
    setBugPositionY(finalY);
    setBugPosition('custom');
    handleUpdateBug({
      position: 'custom',
      positionX: finalX,
      positionY: finalY
    });
  };

  // Toggle or update bug settings
  const handleUpdateBug = async (updates = {}) => {
    if (!channel?._id) return;

    if (updates.position !== undefined) setBugPosition(updates.position);
    if (updates.positionX !== undefined) setBugPositionX(updates.positionX);
    if (updates.positionY !== undefined) setBugPositionY(updates.positionY);
    if (updates.enabled !== undefined) setBugEnabled(updates.enabled);
    if (updates.sizePercent !== undefined) setBugSizePercent(updates.sizePercent);
    if (updates.marginX !== undefined) setBugMarginX(updates.marginX);
    if (updates.marginY !== undefined) setBugMarginY(updates.marginY);

    const payload = {};
    if (updates.assetPath !== undefined) payload.assetPath = updates.assetPath;
    if (updates.enabled !== undefined) payload.enabled = updates.enabled;
    if (updates.position !== undefined) payload.position = updates.position;
    if (updates.positionX !== undefined) payload.positionX = updates.positionX;
    if (updates.positionY !== undefined) payload.positionY = updates.positionY;
    if (updates.sizePercent !== undefined) payload.sizePercent = updates.sizePercent;
    if (updates.marginX !== undefined) payload.marginX = updates.marginX;
    if (updates.marginY !== undefined) payload.marginY = updates.marginY;

    try {
      const res = await api.put(`/channels/${channel._id}/bug`, payload);
      const serverBug = res.data?.bug;
      if (serverBug) {
        if (serverBug.position !== undefined) setBugPosition(serverBug.position);
        if (serverBug.positionX !== undefined) setBugPositionX(serverBug.positionX);
        if (serverBug.positionY !== undefined) setBugPositionY(serverBug.positionY);
        if (serverBug.enabled !== undefined) setBugEnabled(!!serverBug.enabled);
        if (serverBug.sizePercent !== undefined) setBugSizePercent(serverBug.sizePercent);
        if (serverBug.marginX !== undefined) setBugMarginX(serverBug.marginX);
        if (serverBug.marginY !== undefined) setBugMarginY(serverBug.marginY);
      }
      showAlert('success', 'Live bug overlay updated');
      if (onBrandingUpdated) onBrandingUpdated({ type: 'bug', data: serverBug || payload });
    } catch (err) {
      if (channel?.branding?.bug) {
        setBugPosition(channel.branding.bug.position || 'custom');
        setBugPositionX(channel.branding.bug.positionX !== undefined ? channel.branding.bug.positionX : 95);
        setBugPositionY(channel.branding.bug.positionY !== undefined ? channel.branding.bug.positionY : 95);
        setBugEnabled(!!channel.branding.bug.enabled);
      }
      showAlert('error', 'Failed to update bug overlay');
    }
  };

  const handleRemoveBug = async () => {
    if (!channel?._id) return;
    try {
      const res = await api.delete(`/channels/${channel._id}/bug`);
      setBugEnabled(false);
      showAlert('success', 'Station bug removed from air');
      if (onBrandingUpdated) onBrandingUpdated({ type: 'bug', data: res.data.bug });
    } catch (err) {
      showAlert('error', 'Failed to remove station bug');
    }
  };

  // Push ticker to air
  const handlePushTicker = async () => {
    if (!channel?._id) return;
    const payload = {
      enabled: true,
      text: tickerText,
      bgColor: tickerBgColor,
      textColor: tickerTextColor,
      fontFamily: tickerFontFamily,
      fontSize: Number(tickerFontSize),
      marginBottom: Number(tickerMarginBottom),
      paddingY: Number(tickerPaddingY),
      width: Number(tickerWidth),
      alignment: tickerAlignment,
      speed: Number(tickerSpeed),
      forcePush: true
    };

    try {
      const res = await api.put(`/channels/${channel._id}/ticker`, payload);
      setTickerEnabled(true);
      showAlert('success', 'Ticker pushed live to air overlay');
      if (onBrandingUpdated) onBrandingUpdated({ type: 'ticker', data: res.data.ticker });
    } catch (err) {
      showAlert('error', 'Failed to push ticker to air');
    }
  };

  // Remove ticker
  const handleRemoveTicker = async () => {
    if (!channel?._id) return;
    try {
      const res = await api.delete(`/channels/${channel._id}/ticker`);
      setTickerEnabled(false);
      showAlert('success', 'Ticker removed from air');
      if (onBrandingUpdated) onBrandingUpdated({ type: 'ticker', data: res.data.ticker });
    } catch (err) {
      showAlert('error', 'Failed to remove ticker');
    }
  };

  // Toggle or update Back In Timer settings
  const handleUpdateTimer = async (updates = {}) => {
    if (!channel?._id) return;

    if (updates.enabled !== undefined) {
      setTimerEnabled(updates.enabled);
      setTimerShowDuringSchedule(updates.enabled);
    }
    if (updates.label !== undefined) setTimerLabel(updates.label);
    if (updates.format !== undefined) setTimerFormat(updates.format);
    if (updates.position !== undefined) setTimerPosition(updates.position);
    if (updates.positionX !== undefined) setTimerPositionX(updates.positionX);
    if (updates.positionY !== undefined) setTimerPositionY(updates.positionY);
    if (updates.fontSize !== undefined) setTimerFontSize(updates.fontSize);
    if (updates.fontColor !== undefined) setTimerFontColor(updates.fontColor);
    if (updates.bgColor !== undefined) setTimerBgColor(updates.bgColor);

    const payload = {};
    if (updates.enabled !== undefined) {
      payload.enabled = updates.enabled;
      payload.showDuringSchedule = updates.enabled;
    }
    if (updates.label !== undefined) payload.label = updates.label;
    if (updates.format !== undefined) payload.format = updates.format;
    if (updates.position !== undefined) payload.position = updates.position;
    if (updates.positionX !== undefined) payload.positionX = updates.positionX;
    if (updates.positionY !== undefined) payload.positionY = updates.positionY;
    if (updates.fontSize !== undefined) payload.fontSize = updates.fontSize;
    if (updates.fontColor !== undefined) payload.fontColor = updates.fontColor;
    if (updates.bgColor !== undefined) payload.bgColor = updates.bgColor;

    try {
      const res = await api.put(`/channels/${channel._id}/timer`, payload);
      const serverTimer = res.data?.timer;
      if (serverTimer) {
        if (serverTimer.enabled !== undefined) setTimerEnabled(!!serverTimer.enabled);
        if (serverTimer.showDuringSchedule !== undefined) setTimerShowDuringSchedule(serverTimer.showDuringSchedule !== false);
        if (serverTimer.label !== undefined) setTimerLabel(serverTimer.label);
        if (serverTimer.format !== undefined) setTimerFormat(serverTimer.format);
        if (serverTimer.position !== undefined) setTimerPosition(serverTimer.position);
        if (serverTimer.positionX !== undefined) setTimerPositionX(serverTimer.positionX);
        if (serverTimer.positionY !== undefined) setTimerPositionY(serverTimer.positionY);
        if (serverTimer.fontSize !== undefined) setTimerFontSize(serverTimer.fontSize);
        if (serverTimer.fontColor !== undefined) setTimerFontColor(serverTimer.fontColor);
        if (serverTimer.bgColor !== undefined) setTimerBgColor(serverTimer.bgColor);
      }
      showAlert('success', 'Back In Timer settings updated');
      if (onBrandingUpdated) onBrandingUpdated({ type: 'timer', data: serverTimer || payload });
    } catch (err) {
      if (channel?.branding?.backInTimer) {
        const b = channel.branding.backInTimer;
        setTimerEnabled(!!b.enabled);
        setTimerShowDuringSchedule(b.showDuringSchedule !== false);
      }
      showAlert('error', err.response?.data?.message || 'Failed to update Back In Timer');
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#12151b] border-l border-[#202634] select-none text-slate-200">
      {/* Top Header */}
      <div className="px-4 py-3 border-b border-[#202634] flex items-center justify-between bg-[#151922]">
        <div className="flex items-center gap-2">
          <Sliders size={15} className="text-blue-500" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200 m-0">
            Live Controls
          </h2>
        </div>
      </div>

      {/* Pill Tabs: LOGO | BUG | TICKER | TIMER */}
      <div className="p-3 border-b border-[#1d2331]">
        <div className="grid grid-cols-4 bg-[#0b0e14] p-1 rounded-xl border border-[#222938]">
          <button
            onClick={() => setActiveTab('logo')}
            className={`py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition ${activeTab === 'logo'
                ? 'bg-[#2563eb] text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
              }`}
          >
            Logo
          </button>
          <button
            onClick={() => setActiveTab('bug')}
            className={`py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition ${activeTab === 'bug'
                ? 'bg-[#2563eb] text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
              }`}
          >
            Bug
          </button>
          <button
            onClick={() => setActiveTab('ticker')}
            className={`py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition ${activeTab === 'ticker'
                ? 'bg-[#2563eb] text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
              }`}
          >
            Ticker
          </button>
          <button
            onClick={() => setActiveTab('timer')}
            className={`py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition ${activeTab === 'timer'
                ? 'bg-[#2563eb] text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
              }`}
          >
            Timer
          </button>
        </div>
      </div>

      {/* Feedback Toast */}
      {alert && (
        <div
          className={`mx-3 mt-2 p-2.5 rounded-xl border text-xs flex items-center gap-2 animate-fadeIn ${alert.type === 'success'
              ? 'bg-emerald-950/70 border-emerald-800 text-emerald-300'
              : 'bg-red-950/70 border-red-800 text-red-300'
            }`}
        >
          {alert.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
          <span>{alert.message}</span>
        </div>
      )}

      {/* Body content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* ================= LOGO TAB ================= */}
        {activeTab === 'logo' && (
          <div className="space-y-5">
            {/* {currentOnAirSchedule && (
              <div className="p-3 rounded-2xl bg-amber-950/40 border border-amber-500/40 text-amber-200 flex items-start gap-2.5">
                <Sparkles size={16} className="text-amber-400 shrink-0 mt-0.5 animate-pulse" />
                <div className="text-xs">
                  <span className="font-bold text-amber-300 block">
                    Schedule Active: "{currentOnAirSchedule.title}"
                  </span>
                  <span className="text-[10px] text-amber-200/80 leading-relaxed block mt-0.5">
                    {logoShowDuringSchedule
                      ? 'Main Logo remains visible on air during this scheduled broadcast.'
                      : 'Main Logo is hidden during this ad because "Show Logo During Ad" is off.'}
                  </span>
                </div>
              </div>
            )} */}

            {/* Box: Channel Branding */}
            <div className="bg-[#151a24] border border-[#232c3d] rounded-2xl p-4 space-y-4">
              <div className="flex items-center gap-2 text-slate-300 text-xs font-bold uppercase tracking-wider">
                <ImageIcon size={14} className="text-blue-400" />
                <span>Channel Branding</span>
              </div>

              {/* Logo preview + Browse button */}
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-xl bg-[#090c12] border border-[#222938] overflow-hidden flex items-center justify-center p-1.5 shrink-0">
                  {logoAssetPath ? (
                    <img
                      src={`/${logoAssetPath}`}
                      alt="Logo"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <ImageIcon size={22} className="text-slate-600" />
                  )}
                </div>

                <div className="flex-1">
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={handleLogoUpload}
                  />
                  <button
                    onClick={() => logoInputRef.current?.click()}
                    className="px-3.5 py-1.5 rounded-lg bg-[#202736] hover:bg-[#2b354a] text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition border border-[#2b364c]"
                  >
                    <Upload size={13} />
                    <span>Browse</span>
                  </button>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Transparent PNG (Optimized for 720p 25fps)
                  </p>
                </div>
              </div>
            </div>

            {/* SHOW LOGO ON AIR Toggle */}
            <div className="flex items-center justify-between p-3 bg-[#151a24] border border-[#232c3d] rounded-xl">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Show Logo On Air
              </span>

              <button
                onClick={() => {
                  const next = !logoEnabled;
                  setLogoEnabled(next);
                  handleUpdateLogo({ enabled: next });
                }}
                className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-300 ${logoEnabled ? 'bg-blue-600' : 'bg-slate-700'
                  }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${logoEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                />
              </button>
            </div>

            {/* SHOW LOGO DURING AD Toggle */}
            <div className="flex items-center justify-between p-3 bg-[#151a24] border border-[#232c3d] rounded-xl">
              <div className="space-y-0.5">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-200 block">
                  Show Logo during Ad
                </span>
                <span className="text-[10px] text-slate-400">
                  Keep main channel logo visible when scheduled ad plays
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  const next = !logoShowDuringSchedule;
                  setLogoShowDuringSchedule(next);
                  handleUpdateLogo({ showDuringSchedule: next });
                }}
                className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-300 ${logoShowDuringSchedule ? 'bg-blue-600' : 'bg-slate-700'
                  }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${logoShowDuringSchedule ? 'translate-x-5' : 'translate-x-0'
                    }`}
                />
              </button>
            </div>

            {/* Position Box (5 buttons) */}
            <div className="bg-[#151a24] border border-[#232c3d] rounded-2xl p-4">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-3">
                Logo Position
              </span>

              <div className="relative aspect-video bg-[#090c12] border border-[#222938] rounded-xl flex items-center justify-center p-3">
                {/* Top-Left */}
                <button
                  onClick={() => {
                    setLogoPosition('top-left');
                    handleUpdateLogo({ position: 'top-left' });
                  }}
                  className={`absolute top-2.5 left-2.5 w-7 h-7 rounded-lg flex items-center justify-center transition border ${logoPosition === 'top-left'
                      ? 'bg-blue-600 border-blue-400 text-white shadow-md'
                      : 'bg-[#141822] border-[#222a3a] text-slate-400 hover:text-white'
                    }`}
                  title="Top Left"
                >
                  <CornerUpLeft size={13} />
                </button>

                {/* Top-Right */}
                <button
                  onClick={() => {
                    setLogoPosition('top-right');
                    handleUpdateLogo({ position: 'top-right' });
                  }}
                  className={`absolute top-2.5 right-2.5 w-7 h-7 rounded-lg flex items-center justify-center transition border ${logoPosition === 'top-right'
                      ? 'bg-blue-600 border-blue-400 text-white shadow-md'
                      : 'bg-[#141822] border-[#222a3a] text-slate-400 hover:text-white'
                    }`}
                  title="Top Right"
                >
                  <CornerUpRight size={13} />
                </button>

                {/* Center */}
                <button
                  onClick={() => {
                    setLogoPosition('center');
                    handleUpdateLogo({ position: 'center' });
                  }}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center transition border ${logoPosition === 'center'
                      ? 'bg-blue-600 border-blue-400 text-white shadow-md'
                      : 'bg-[#141822] border-[#222a3a] text-slate-400 hover:text-white'
                    }`}
                  title="Center"
                >
                  <Circle size={13} />
                </button>

                {/* Bottom-Left */}
                <button
                  onClick={() => {
                    setLogoPosition('bottom-left');
                    handleUpdateLogo({ position: 'bottom-left' });
                  }}
                  className={`absolute bottom-2.5 left-2.5 w-7 h-7 rounded-lg flex items-center justify-center transition border ${logoPosition === 'bottom-left'
                      ? 'bg-blue-600 border-blue-400 text-white shadow-md'
                      : 'bg-[#141822] border-[#222a3a] text-slate-400 hover:text-white'
                    }`}
                  title="Bottom Left"
                >
                  <CornerDownLeft size={13} />
                </button>

                {/* Bottom-Right */}
                <button
                  onClick={() => {
                    setLogoPosition('bottom-right');
                    handleUpdateLogo({ position: 'bottom-right' });
                  }}
                  className={`absolute bottom-2.5 right-2.5 w-7 h-7 rounded-lg flex items-center justify-center transition border ${logoPosition === 'bottom-right'
                      ? 'bg-blue-600 border-blue-400 text-white shadow-md'
                      : 'bg-[#141822] border-[#222a3a] text-slate-400 hover:text-white'
                    }`}
                  title="Bottom Right"
                >
                  <CornerDownRight size={13} />
                </button>
              </div>
            </div>

            {/* Sliders: SIZE, MARGIN X, MARGIN Y */}
            <div className="space-y-4 bg-[#151a24] border border-[#232c3d] rounded-2xl p-4">
              {/* SIZE */}
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-1">
                  <span className="uppercase tracking-wider text-[10px]">Size</span>
                  <span className="font-mono text-blue-400">{logoSizePercent}%</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="45"
                  value={logoSizePercent}
                  onChange={(e) => setLogoSizePercent(Number(e.target.value))}
                  onMouseUp={() => handleUpdateLogo({ sizePercent: logoSizePercent })}
                  onTouchEnd={() => handleUpdateLogo({ sizePercent: logoSizePercent })}
                  className="w-full accent-blue-600 cursor-pointer h-1.5 bg-[#090c12] rounded-lg"
                />
              </div>

              {/* MARGIN X */}
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-1">
                  <span className="uppercase tracking-wider text-[10px]">Margin X</span>
                  <span className="font-mono text-blue-400">{logoMarginX}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="15"
                  value={logoMarginX}
                  onChange={(e) => setLogoMarginX(Number(e.target.value))}
                  onMouseUp={() => handleUpdateLogo({ marginX: logoMarginX })}
                  onTouchEnd={() => handleUpdateLogo({ marginX: logoMarginX })}
                  className="w-full accent-blue-600 cursor-pointer h-1.5 bg-[#090c12] rounded-lg"
                />
              </div>

              {/* MARGIN Y */}
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-1">
                  <span className="uppercase tracking-wider text-[10px]">Margin Y</span>
                  <span className="font-mono text-blue-400">{logoMarginY}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="15"
                  value={logoMarginY}
                  onChange={(e) => setLogoMarginY(Number(e.target.value))}
                  onMouseUp={() => handleUpdateLogo({ marginY: logoMarginY })}
                  onTouchEnd={() => handleUpdateLogo({ marginY: logoMarginY })}
                  className="w-full accent-blue-600 cursor-pointer h-1.5 bg-[#090c12] rounded-lg"
                />
              </div>
            </div>
          </div>
        )}

        {/* ================= BUG TAB ================= */}
        {activeTab === 'bug' && (
          <div className="space-y-5">
            {/* Active Schedule Notification */}
            {currentOnAirSchedule && (
              <div className="p-3 rounded-2xl bg-amber-950/40 border border-amber-500/40 text-amber-200 flex items-start gap-2.5">
                <Sparkles size={16} className="text-amber-400 shrink-0 mt-0.5 animate-pulse" />
                <div className="text-xs">
                  <span className="font-bold text-amber-300 block">
                    Schedule Active: "{currentOnAirSchedule.title}"
                  </span>
                  <span className="text-[10px] text-amber-200/80 leading-relaxed block mt-0.5">
                    Station overlays (Ticker, Bug, Ashton, L-Band) are hidden during schedule playout and will restore automatically when the schedule ends.
                  </span>
                </div>
              </div>
            )}

            {/* Box: Station Bug Upload */}
            <div className="bg-[#151a24] border border-[#232c3d] rounded-2xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-300 text-xs font-bold uppercase tracking-wider">
                  <Sparkles size={14} className="text-amber-400" />
                  <span>Station Bug Graphic</span>
                </div>
                {bugIsMov ? (
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 animate-pulse">
                    MOV ANIMATED
                  </span>
                ) : bugAssetPath ? (
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    PNG STATIC
                  </span>
                ) : null}
              </div>

              {/* Bug preview + Browse button */}
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-xl bg-[#090c12] border border-[#222938] overflow-hidden flex items-center justify-center p-1.5 shrink-0 relative">
                  {bugAssetPath ? (
                    bugIsMov || bugAssetPath.toLowerCase().endsWith('.mov') ? (
                      <video
                        src={`/${bugAssetPath}`}
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="w-full h-full object-contain pointer-events-none"
                      />
                    ) : (
                      <img
                        src={`/${bugAssetPath}`}
                        alt="Bug"
                        className="w-full h-full object-contain"
                      />
                    )
                  ) : (
                    <Sparkles size={22} className="text-slate-600" />
                  )}
                </div>

                <div className="flex-1">
                  <input
                    ref={bugInputRef}
                    type="file"
                    accept=".png,image/png,.mov,video/quicktime"
                    className="hidden"
                    onChange={handleBugUpload}
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => bugInputRef.current?.click()}
                      className="px-3.5 py-1.5 rounded-lg bg-[#202736] hover:bg-[#2b354a] text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition border border-[#2b364c]"
                    >
                      <Upload size={13} />
                      <span>Browse</span>
                    </button>
                    {bugAssetPath && (
                      <button
                        onClick={handleRemoveBug}
                        className="p-1.5 rounded-lg bg-[#202736] hover:bg-red-950/60 text-slate-400 hover:text-red-400 border border-[#2b364c] transition"
                        title="Remove Bug"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Supports PNG and MOV files only
                  </p>
                </div>
              </div>
            </div>

            {/* SHOW BUG ON AIR Toggle */}
            <div className="flex items-center justify-between p-3 bg-[#151a24] border border-[#232c3d] rounded-xl">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Show Bug On Air
              </span>

              <button
                onClick={() => {
                  const next = !bugEnabled;
                  setBugEnabled(next);
                  handleUpdateBug({ enabled: next });
                }}
                className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-300 ${bugEnabled ? 'bg-amber-500' : 'bg-slate-700'
                  }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${bugEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                />
              </button>
            </div>

            {/* Flexible Screen Positioning Pad */}
            <div className="bg-[#151a24] border border-[#232c3d] rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Crosshair size={13} className="text-amber-400" />
                  <span>Free Screen Positioning</span>
                </span>
                <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  X: {bugPositionX}% · Y: {bugPositionY}%
                </span>
              </div>

              {/* 16:9 Screen Positioning Pad: Click or Drag Anywhere */}
              <div
                ref={bugPadRef}
                onPointerDown={handleBugPadPointerDown}
                onPointerMove={handleBugPadPointerMove}
                onPointerUp={handleBugPadPointerUp}
                className="relative aspect-video bg-[#090c12] border border-[#222938] rounded-xl overflow-hidden cursor-crosshair select-none touch-none shadow-inner"
                title="Click or drag anywhere to place the bug"
              >
                {/* Rule of thirds / Alignment guide lines */}
                <div className="absolute inset-0 pointer-events-none opacity-30">
                  <div className="absolute left-1/3 top-0 bottom-0 border-r border-dashed border-slate-600" />
                  <div className="absolute left-2/3 top-0 bottom-0 border-r border-dashed border-slate-600" />
                  <div className="absolute top-1/3 left-0 right-0 border-b border-dashed border-slate-600" />
                  <div className="absolute top-2/3 left-0 right-0 border-b border-dashed border-slate-600" />
                </div>

                {/* Bug Target Marker (Scales proportionally maintaining aspect ratio) */}
                <div
                  style={{
                    left: `${bugPositionX}%`,
                    top: `${bugPositionY}%`,
                    transform: `translate(-${bugPositionX}%, -${bugPositionY}%)`,
                    width: `${Math.max(16, Math.min(64, Math.round(16 + (bugSizePercent * 0.9))))}px`,
                    height: `${Math.max(16, Math.min(64, Math.round(16 + (bugSizePercent * 0.9))))}px`
                  }}
                  className="absolute border-2 border-amber-400 bg-amber-500/30 rounded shadow-[0_0_12px_rgba(245,158,11,0.6)] flex items-center justify-center pointer-events-none transition-all duration-75 overflow-hidden"
                >
                  {bugAssetPath ? (
                    bugIsMov || bugAssetPath.toLowerCase().endsWith('.mov') ? (
                      <video
                        src={`/${bugAssetPath}`}
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="w-full h-full object-contain pointer-events-none"
                      />
                    ) : (
                      <img
                        src={`/${bugAssetPath}`}
                        alt="Bug target"
                        className="w-full h-full object-contain pointer-events-none"
                      />
                    )
                  ) : (
                    <Sparkles size={12} className="text-amber-300" />
                  )}
                </div>

                {/* Drag hint overlay */}
                <div className="absolute bottom-1 right-2 text-[9px] text-slate-500 pointer-events-none font-semibold">
                  Click or drag anywhere
                </div>
              </div>

              {/* Quick-Snap Preset Buttons */}
              <div className="grid grid-cols-5 gap-1 pt-1">
                {[
                  { label: 'Top-L', x: 3, y: 3 },
                  { label: 'Top-R', x: 97, y: 3 },
                  { label: 'Center', x: 50, y: 50 },
                  { label: 'Bot-L', x: 3, y: 97 },
                  { label: 'Bot-R', x: 97, y: 97 }
                ].map((preset) => {
                  const isActive =
                    Math.abs(bugPositionX - preset.x) <= 3 && Math.abs(bugPositionY - preset.y) <= 3;
                  return (
                    <button
                      key={preset.label}
                      onClick={() => {
                        setBugPositionX(preset.x);
                        setBugPositionY(preset.y);
                        setBugPosition('custom');
                        handleUpdateBug({
                          position: 'custom',
                          positionX: preset.x,
                          positionY: preset.y
                        });
                      }}
                      className={`py-1 rounded text-[10px] font-semibold border transition ${
                        isActive
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm'
                          : 'bg-[#121620] text-slate-400 hover:text-white border-[#222938]'
                      }`}
                      title={`Snap to ${preset.label}`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Sliders: SIZE, POSITION X, POSITION Y */}
            <div className="space-y-4 bg-[#151a24] border border-[#232c3d] rounded-2xl p-4">
              {/* SIZE SLIDER: Scales both width and height proportionally */}
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-1">
                  <span className="uppercase tracking-wider text-[10px]">
                    Bug Size (Proportional W × H)
                  </span>
                  <span className="font-mono text-amber-400">{bugSizePercent}%</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="45"
                  value={bugSizePercent}
                  onChange={(e) => setBugSizePercent(Number(e.target.value))}
                  onMouseUp={() => handleUpdateBug({ sizePercent: bugSizePercent })}
                  onTouchEnd={() => handleUpdateBug({ sizePercent: bugSizePercent })}
                  className="w-full accent-amber-500 cursor-pointer h-1.5 bg-[#090c12] rounded-lg"
                />
                {/* <p className="text-[10px] text-slate-400 mt-1">
                  {bugIsGif ? '⚡ Animated GIF: ' : '🖼️ Static Image: '}
                  Scales both width and height proportionally, maintaining original aspect ratio.
                </p> */}
              </div>

              {/* HORIZONTAL POSITION X */}
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-1">
                  <span className="uppercase tracking-wider text-[10px]">Position X (Horizontal)</span>
                  <span className="font-mono text-amber-400">{bugPositionX}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={bugPositionX}
                  onChange={(e) => setBugPositionX(Number(e.target.value))}
                  onMouseUp={() =>
                    handleUpdateBug({
                      position: 'custom',
                      positionX: bugPositionX,
                      positionY: bugPositionY
                    })
                  }
                  onTouchEnd={() =>
                    handleUpdateBug({
                      position: 'custom',
                      positionX: bugPositionX,
                      positionY: bugPositionY
                    })
                  }
                  className="w-full accent-amber-500 cursor-pointer h-1.5 bg-[#090c12] rounded-lg"
                />
              </div>

              {/* VERTICAL POSITION Y */}
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-1">
                  <span className="uppercase tracking-wider text-[10px]">Position Y (Vertical)</span>
                  <span className="font-mono text-amber-400">{bugPositionY}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={bugPositionY}
                  onChange={(e) => setBugPositionY(Number(e.target.value))}
                  onMouseUp={() =>
                    handleUpdateBug({
                      position: 'custom',
                      positionX: bugPositionX,
                      positionY: bugPositionY
                    })
                  }
                  onTouchEnd={() =>
                    handleUpdateBug({
                      position: 'custom',
                      positionX: bugPositionX,
                      positionY: bugPositionY
                    })
                  }
                  className="w-full accent-amber-500 cursor-pointer h-1.5 bg-[#090c12] rounded-lg"
                />
              </div>
            </div>
          </div>
        )}

        {/* ================= TICKER TAB ================= */}
        {activeTab === 'ticker' && (
          <div className="space-y-4">
            {/* Active Schedule Notification */}
            {currentOnAirSchedule && (
              <div className="p-3 rounded-2xl bg-amber-950/40 border border-amber-500/40 text-amber-200 flex items-start gap-2.5">
                <Sparkles size={16} className="text-amber-400 shrink-0 mt-0.5 animate-pulse" />
                <div className="text-xs">
                  <span className="font-bold text-amber-300 block">
                    Schedule Active: "{currentOnAirSchedule.title}"
                  </span>
                  <span className="text-[10px] text-amber-200/80 leading-relaxed block mt-0.5">
                    Station overlays (Ticker, Bug, Ashton, L-Band) are hidden during schedule playout and will restore automatically when the schedule ends.
                  </span>
                </div>
              </div>
            )}

            {/* Header banner */}
            <div className="bg-[#151a24] border border-[#232c3d] rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-200 text-xs font-bold uppercase tracking-wider">
                  <Type size={14} className="text-blue-400" />
                  <span>Live Ticker</span>
                  {/* <span
                    className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider ${
                      tickerEnabled
                        ? 'bg-emerald-950 border border-emerald-600 text-emerald-400'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    {tickerEnabled ? '● ON AIR' : 'OFF AIR'}
                  </span> */}
                </div>

                {/* Color pickers */}
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 cursor-pointer bg-[#0b0e14] px-2 py-1 rounded-lg border border-[#232b3c]" title="Background Color">
                    <span className="text-[9px] uppercase font-bold text-slate-400">BG</span>
                    <input
                      type="color"
                      value={tickerBgColor.substring(0, 7)}
                      onChange={(e) => setTickerBgColor(e.target.value)}
                      className="w-4 h-4 rounded border-0 cursor-pointer bg-transparent"
                    />
                    {/* <span className="text-[9px] font-mono text-slate-300 uppercase">{tickerBgColor.substring(0, 7)}</span> */}
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer bg-[#0b0e14] px-2 py-1 rounded-lg border border-[#232b3c]" title="Text Color">
                    <span className="text-[9px] uppercase font-bold text-slate-400">TEXT</span>
                    <input
                      type="color"
                      value={tickerTextColor.substring(0, 7)}
                      onChange={(e) => setTickerTextColor(e.target.value)}
                      className="w-4 h-4 rounded border-0 cursor-pointer bg-transparent"
                    />
                    {/* <span className="text-[9px] font-mono text-slate-300 uppercase">{tickerTextColor.substring(0, 7)}</span> */}
                  </label>
                </div>
              </div>

              {/* Textarea for crawl text */}
              <div>
                <textarea
                  rows={3}
                  value={tickerText}
                  onChange={(e) => setTickerText(e.target.value)}
                  placeholder="Enter Hindi or English ticker text..."
                  className="w-full p-2.5 bg-[#090c12] border border-[#232a39] rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-all shadow-inner"
                  style={{
                    backgroundColor: tickerBgColor.substring(0, 7),
                    color: tickerTextColor.substring(0, 7),
                    fontFamily: getCssFontFamily(tickerFontFamily),
                    fontWeight: 'bold',
                    fontSize: `${Math.max(11, Math.round(tickerFontSize * 0.55))}px`,
                    padding: `${Math.max(4, Math.round(tickerPaddingY * 0.4))}px 10px`,
                    width: `${tickerWidth}%`,
                    margin: tickerAlignment.toLowerCase() === 'center' ? '0 auto' : tickerAlignment.toLowerCase() === 'right' ? '0 0 0 auto' : '0 auto 0 0'
                  }}
                />
              </div>

              {/* Ticker Live Preview Strip */}
              {/* <div className="bg-[#0b0e14] p-2 rounded-xl border border-[#232b3c] space-y-1">
                <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Live Preview</div>
                <div
                  className="rounded-lg overflow-hidden font-bold truncate text-center transition-all shadow-inner border border-white/10"
                  style={{
                    backgroundColor: tickerBgColor.substring(0, 7),
                    color: tickerTextColor.substring(0, 7),
                    fontFamily: getCssFontFamily(tickerFontFamily),
                    fontWeight: 'bold',
                    fontSize: `${Math.max(11, Math.round(tickerFontSize * 0.55))}px`,
                    padding: `${Math.max(4, Math.round(tickerPaddingY * 0.4))}px 10px`,
                    width: `${tickerWidth}%`,
                    margin: tickerAlignment.toLowerCase() === 'center' ? '0 auto' : tickerAlignment.toLowerCase() === 'right' ? '0 0 0 auto' : '0 auto 0 0'
                  }}
                >
                  {tickerText || 'Welcome to Cloud Playout Live Broadcast'}
                </div>
              </div> */}
            </div>

            {/* Font select */}
            <div>
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <label className="text-[10px] font-bold uppercase tracking-wider">
                  Font Family
                </label>
                <span className="text-[10px] text-blue-400 font-mono">
                  {tickerFontFamily}
                </span>
              </div>
              <select
                value={tickerFontFamily}
                onChange={(e) => setTickerFontFamily(e.target.value)}
                className="w-full bg-[#090c12] border border-[#232a39] text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-500"
              >
                {['sans bold', 'sans'].includes(String(tickerFontFamily || '').toLowerCase()) && (
                  <option value={tickerFontFamily}>{tickerFontFamily} (Arial)</option>
                )}
                {TICKER_FONT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value} style={{ fontFamily: opt.css }}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Sliders: Font Size, Margin Bottom, Padding Y, Ticker Width, Ticker Position */}
            <div className="space-y-3.5 bg-[#151a24] border border-[#232c3d] rounded-2xl p-4">
              {/* Font Size */}
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-1">
                  <span className="uppercase tracking-wider text-[10px]">Font Size</span>
                  <span className="font-mono text-blue-400">{tickerFontSize}px</span>
                </div>
                <input
                  type="range"
                  min="12"
                  max="44"
                  value={tickerFontSize}
                  onChange={(e) => setTickerFontSize(Number(e.target.value))}
                  className="w-full accent-blue-600 cursor-pointer h-1.5 bg-[#090c12] rounded-lg"
                />
              </div>

              {/* Margin Bottom */}
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-1">
                  <span className="uppercase tracking-wider text-[10px]">Margin Bottom</span>
                  <span className="font-mono text-blue-400">{tickerMarginBottom}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="20"
                  value={tickerMarginBottom}
                  onChange={(e) => setTickerMarginBottom(Number(e.target.value))}
                  className="w-full accent-blue-600 cursor-pointer h-1.5 bg-[#090c12] rounded-lg"
                />
                <p className="text-[9px] text-slate-500 mt-0.5">
                  0% is flush at the very bottom edge of video
                </p>
              </div>

              {/* Padding Y */}
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-1">
                  <span className="uppercase tracking-wider text-[10px]">Padding Y</span>
                  <span className="font-mono text-blue-400">{tickerPaddingY}px</span>
                </div>
                <input
                  type="range"
                  min="4"
                  max="30"
                  value={tickerPaddingY}
                  onChange={(e) => setTickerPaddingY(Number(e.target.value))}
                  className="w-full accent-blue-600 cursor-pointer h-1.5 bg-[#090c12] rounded-lg"
                />
              </div>

              {/* Ticker Width */}
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-1">
                  <span className="uppercase tracking-wider text-[10px]">Ticker Width</span>
                  <span className="font-mono text-blue-400">{tickerWidth}%</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="100"
                  value={tickerWidth}
                  onChange={(e) => setTickerWidth(Number(e.target.value))}
                  className="w-full accent-blue-600 cursor-pointer h-1.5 bg-[#090c12] rounded-lg"
                />
              </div>

              {/* Ticker Position (Appears directly below Ticker Width) */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Ticker Position
                </label>
                <select
                  value={tickerAlignment}
                  onChange={(e) => setTickerAlignment(e.target.value)}
                  className="w-full bg-[#090c12] border border-[#232a39] text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-500"
                >
                  <option value="Center">Center</option>
                  <option value="Left">Left</option>
                  <option value="Right">Right</option>
                </select>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-2">
              <button
                onClick={handlePushTicker}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition shadow-lg shadow-blue-600/30"
              >
                <Send size={14} />
                <span>Push Live to Air</span>
              </button>

              <button
                onClick={handleRemoveTicker}
                className="w-full py-2 rounded-xl bg-[#1b2230] hover:bg-red-950/40 text-slate-400 hover:text-red-400 font-semibold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition border border-[#263145]"
              >
                <Trash2 size={13} />
                <span>Remove Ticker</span>
              </button>
            </div>
          </div>
        )}

        {/* ================= BACK IN TIMER TAB ================= */}
        {activeTab === 'timer' && (
          <div className="space-y-5">
            {currentOnAirSchedule && (
              <div className="p-3 rounded-2xl bg-amber-950/40 border border-amber-500/40 text-amber-200 flex items-start gap-2.5">
                <Sparkles size={16} className="text-amber-400 shrink-0 mt-0.5 animate-pulse" />
                <div className="text-xs">
                  <span className="font-bold text-amber-300 block">
                    Schedule Active: "{currentOnAirSchedule.title}"
                  </span>
                  <span className="text-[10px] text-amber-200/80 leading-relaxed block mt-0.5">
                    {timerEnabled
                      ? 'Back In Timer is counting down live on the broadcast stream until the ad ends.'
                      : 'Back In Timer is disabled and will not show during ads.'}
                  </span>
                </div>
              </div>
            )}

            {/* Live Timer Preview Box */}
            <div className="bg-[#151a24] border border-[#232c3d] rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Clock size={13} className="text-blue-400" />
                  Live Preview
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    timerEnabled
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-slate-800 text-slate-500'
                  }`}
                >
                  {timerEnabled ? 'SHOWING DURING AD' : 'OFF'}
                </span>
              </div>

              <div className="relative aspect-video bg-[#090c12] border border-[#222938] rounded-xl flex items-center justify-center p-3 overflow-hidden">
                <div
                  className={`absolute px-3 py-1.5 rounded-md font-mono font-bold text-xs shadow-lg flex items-center gap-1.5 transition-all ${
                    timerPosition === 'top-left'
                      ? 'top-3 left-3'
                      : timerPosition === 'top-right'
                      ? 'top-3 right-3'
                      : timerPosition === 'bottom-left'
                      ? 'bottom-3 left-3'
                      : timerPosition === 'bottom-right'
                      ? 'bottom-3 right-3'
                      : 'top-3 left-3'
                  }`}
                  style={{
                    backgroundColor: timerBgColor || '#000000cc',
                    color: timerFontColor || '#ffffff',
                    fontSize: `${Math.max(10, Math.min(22, (timerFontSize / 24) * 12))}px`,
                    opacity: timerEnabled ? 1 : 0.4
                  }}
                >
                  <Clock size={12} className="opacity-80" />
                  <span>
                    {timerLabel || 'BACK IN '}
                    {timerFormat === 'SS' ? '30s' : '00:30'}
                  </span>
                </div>
                <span className="text-[10px] text-slate-600 font-bold uppercase tracking-wider">
                  Ad Broadcast Frame (1280x720)
                </span>
              </div>
            </div>

            {/* SINGLE TOGGLE: Show Back In Timer During Ad */}
            <div className="flex items-center justify-between p-3.5 bg-[#151a24] border border-[#232c3d] rounded-xl">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-200 block">
                  Show Timer During Ad
                </span>
                <span className="text-[10px] text-slate-400">
                  Display real-time countdown backward until the ad ends
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  const next = !timerEnabled;
                  setTimerEnabled(next);
                  setTimerShowDuringSchedule(next);
                  handleUpdateTimer({ enabled: next, showDuringSchedule: next });
                }}
                className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-300 ${
                  timerEnabled ? 'bg-blue-600' : 'bg-slate-700'
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${
                    timerEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Configuration Box: Label, Format, Position */}
            <div className="bg-[#151a24] border border-[#232c3d] rounded-2xl p-4 space-y-4">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                Timer Customization
              </span>

              {/* Text Label */}
              <div>
                <label className="text-[11px] text-slate-400 font-medium block mb-1.5">
                  Text Prefix Label
                </label>
                <input
                  type="text"
                  value={timerLabel}
                  onChange={(e) => setTimerLabel(e.target.value)}
                  placeholder="BACK IN "
                  className="w-full bg-[#090c12] border border-[#232a39] text-xs text-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              {/* Format Selection */}
              <div>
                <label className="text-[11px] text-slate-400 font-medium block mb-1.5">
                  Countdown Format
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setTimerFormat('MM:SS');
                      handleUpdateTimer({ format: 'MM:SS' });
                    }}
                    className={`py-2 rounded-lg border text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                      timerFormat === 'MM:SS'
                        ? 'bg-blue-600 border-blue-400 text-white shadow-md'
                        : 'bg-[#090c12] border-[#222938] text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>MM:SS (00:30)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTimerFormat('SS');
                      handleUpdateTimer({ format: 'SS' });
                    }}
                    className={`py-2 rounded-lg border text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                      timerFormat === 'SS'
                        ? 'bg-blue-600 border-blue-400 text-white shadow-md'
                        : 'bg-[#090c12] border-[#222938] text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>Seconds (30s)</span>
                  </button>
                </div>
              </div>

              {/* Position Presets */}
              <div>
                <label className="text-[11px] text-slate-400 font-medium block mb-1.5">
                  Screen Position
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'top-left', label: 'Top Left' },
                    { id: 'top-right', label: 'Top Right' },
                    { id: 'bottom-left', label: 'Bottom Left' },
                    { id: 'bottom-right', label: 'Bottom Right' }
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setTimerPosition(p.id);
                        handleUpdateTimer({ position: p.id });
                      }}
                      className={`py-2 px-3 rounded-lg border text-xs font-bold transition flex items-center justify-center ${
                        timerPosition === p.id
                          ? 'bg-blue-600 border-blue-400 text-white shadow-md'
                          : 'bg-[#090c12] border-[#222938] text-slate-400 hover:text-white'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Font Size & Colors */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-[11px] text-slate-400 font-medium block mb-1">
                    Font Size ({timerFontSize}px)
                  </label>
                  <input
                    type="range"
                    min="14"
                    max="48"
                    value={timerFontSize}
                    onChange={(e) => setTimerFontSize(Number(e.target.value))}
                    className="w-full accent-blue-600 cursor-pointer"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 font-medium block mb-1">
                    Font Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={timerFontColor}
                      onChange={(e) => setTimerFontColor(e.target.value)}
                      className="w-8 h-8 rounded border border-slate-700 cursor-pointer bg-transparent"
                    />
                    <span className="text-xs text-slate-300 font-mono">{timerFontColor}</span>
                  </div>
                </div>
              </div>

              {/* Save Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() =>
                    handleUpdateTimer({
                      label: timerLabel,
                      format: timerFormat,
                      position: timerPosition,
                      fontSize: timerFontSize,
                      fontColor: timerFontColor
                    })
                  }
                  className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition shadow-lg shadow-blue-600/30"
                >
                  <Send size={14} />
                  <span>Save Timer Settings</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
