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
  Circle
} from 'lucide-react';

export default function LiveControls({ channel, onBrandingUpdated }) {
  const [activeTab, setActiveTab] = useState('logo');
  const logoInputRef = useRef(null);

  // Logo state
  const [logoAssetPath, setLogoAssetPath] = useState('');
  const [logoEnabled, setLogoEnabled] = useState(false);
  const [logoPosition, setLogoPosition] = useState('top-right');
  const [logoSizePercent, setLogoSizePercent] = useState(10);
  const [logoMarginX, setLogoMarginX] = useState(2);
  const [logoMarginY, setLogoMarginY] = useState(2);

  // Ticker state
  const [tickerEnabled, setTickerEnabled] = useState(false);
  const [tickerText, setTickerText] = useState('Shree Sai Bhakti Dhara');
  const [tickerBgColor, setTickerBgColor] = useState('#000000');
  const [tickerTextColor, setTickerTextColor] = useState('#ffffff');
  const [tickerFontFamily, setTickerFontFamily] = useState('Sans Bold');
  const [tickerFontSize, setTickerFontSize] = useState(18);
  const [tickerMarginBottom, setTickerMarginBottom] = useState(0);
  const [tickerPaddingY, setTickerPaddingY] = useState(13);
  const [tickerWidth, setTickerWidth] = useState(100);
  const [tickerAlignment, setTickerAlignment] = useState('Center');
  const [tickerSpeed, setTickerSpeed] = useState(3);

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

    // Build targeted payload with ONLY the fields explicitly modified
    const payload = {};
    if (updates.assetPath !== undefined) payload.assetPath = updates.assetPath;
    if (updates.enabled !== undefined) payload.enabled = updates.enabled;
    if (updates.position !== undefined) payload.position = updates.position;
    if (updates.sizePercent !== undefined) payload.sizePercent = updates.sizePercent;
    if (updates.marginX !== undefined) payload.marginX = updates.marginX;
    if (updates.marginY !== undefined) payload.marginY = updates.marginY;

    try {
      const res = await api.put(`/channels/${channel._id}/logo`, payload);
      const serverLogo = res.data?.logo;
      if (serverLogo) {
        if (serverLogo.position !== undefined) setLogoPosition(serverLogo.position);
        if (serverLogo.enabled !== undefined) setLogoEnabled(!!serverLogo.enabled);
        if (serverLogo.sizePercent !== undefined) setLogoSizePercent(serverLogo.sizePercent);
        if (serverLogo.marginX !== undefined) setLogoMarginX(serverLogo.marginX);
        if (serverLogo.marginY !== undefined) setLogoMarginY(serverLogo.marginY);
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
      speed: Number(tickerSpeed)
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

      {/* Pill Tabs: LOGO | TICKER */}
      <div className="p-3 border-b border-[#1d2331]">
        <div className="grid grid-cols-2 bg-[#0b0e14] p-1 rounded-xl border border-[#222938]">
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
            onClick={() => setActiveTab('ticker')}
            className={`py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition ${activeTab === 'ticker'
                ? 'bg-[#2563eb] text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
              }`}
          >
            Ticker
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

        {/* ================= TICKER TAB ================= */}
        {activeTab === 'ticker' && (
          <div className="space-y-4">
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
                  className="w-full p-2.5 bg-[#090c12] border border-[#232a39] rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500 font-sans"
                  style={{
                    backgroundColor: tickerBgColor.substring(0, 7),
                    color: tickerTextColor.substring(0, 7),
                    fontFamily: tickerFontFamily,
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
                    fontFamily: tickerFontFamily,
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
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Font Family
              </label>
              <select
                value={tickerFontFamily}
                onChange={(e) => setTickerFontFamily(e.target.value)}
                className="w-full bg-[#090c12] border border-[#232a39] text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-500"
              >
                <option value="Sans Bold">Sans Bold</option>
                <option value="Sans">Sans</option>
                <option value="Arial">Arial</option>
                <option value="Roboto">Roboto</option>
                <option value="Noto Sans Devanagari">Hindi (Devanagari)</option>
                <option value="Impact">Impact</option>
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
      </div>
    </div>
  );
}
