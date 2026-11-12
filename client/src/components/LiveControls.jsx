import { toast } from 'react-hot-toast';
import React, { useState, useRef, useEffect } from 'react';
import api from '../api/axios.js';
import ConfirmDeleteModal from './modals/ConfirmDeleteModal.jsx';
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
  Timer as TimerIcon,
  Film,
  Loader2
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
  const lastChannelIdRef = useRef(null);
  const lastSyncedSectionsRef = useRef({});
  const isTickerDirtyRef = useRef(false);
  const isTimerDirtyRef = useRef(false);

  const updateTickerDraft = (setter, value) => {
    isTickerDirtyRef.current = true;
    setter(value);
  };

  const updateTimerDraft = (setter, value) => {
    isTimerDirtyRef.current = true;
    setter(value);
  };

  // Logo state
  const [logoAssetPath, setLogoAssetPath] = useState('');
  const [logoEnabled, setLogoEnabled] = useState(false);
  const [logoPosition, setLogoPosition] = useState('top-right');
  const [logoSizePercent, setLogoSizePercent] = useState(10);
  const [logoMarginX, setLogoMarginX] = useState(2);
  const [logoMarginY, setLogoMarginY] = useState(2);
  const [logoShowDuringSchedule, setLogoShowDuringSchedule] = useState(true);

  // Station Bug state (supports static PNG & QuickTime MOV + free positioning)
  const [bugAssetPath, setBugAssetPath] = useState('');
  const [bugPreviewPath, setBugPreviewPath] = useState('');
  const [bugPreviewVersion, setBugPreviewVersion] = useState(0);
  const [bugPreviewErrorFor, setBugPreviewErrorFor] = useState('');
  const [isUploadingBug, setIsUploadingBug] = useState(false);
  const [bugEnabled, setBugEnabled] = useState(false);
  const [bugPosition, setBugPosition] = useState('custom');
  const [bugPositionX, setBugPositionX] = useState(95);
  const [bugPositionY, setBugPositionY] = useState(95);
  const [bugSizePercent, setBugSizePercent] = useState(8);
  const [bugMarginX, setBugMarginX] = useState(2);
  const [bugMarginY, setBugMarginY] = useState(2);
  const [bugIsGif, setBugIsGif] = useState(false);
  const [bugIsMov, setBugIsMov] = useState(false);
  const requestedBugPreviewForRef = useRef('');

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

  // Toast alert & confirmation modal
  const [alert, setAlert] = useState(null);
  const [isDeleteLogoModalOpen, setIsDeleteLogoModalOpen] = useState(false);
  const [isDeletingLogo, setIsDeletingLogo] = useState(false);

  useEffect(() => {
    if (!channel?.branding) return;

    if (channel._id !== lastChannelIdRef.current) {
      lastChannelIdRef.current = channel._id || null;
      lastSyncedSectionsRef.current = {};
      isTickerDirtyRef.current = false;
      isTimerDirtyRef.current = false;
    }

    const bLogo = channel.branding.logo || {};
    const logoJson = JSON.stringify(bLogo);
    if (logoJson !== lastSyncedSectionsRef.current.logo) {
      lastSyncedSectionsRef.current.logo = logoJson;
      setLogoAssetPath(bLogo.assetPath || '');
      setLogoEnabled(!!bLogo.enabled);
      setLogoPosition(bLogo.position || 'top-right');
      setLogoSizePercent(bLogo.sizePercent !== undefined && bLogo.sizePercent !== null ? bLogo.sizePercent : 10);
      setLogoMarginX(bLogo.marginX !== undefined && bLogo.marginX !== null ? bLogo.marginX : 2);
      setLogoMarginY(bLogo.marginY !== undefined && bLogo.marginY !== null ? bLogo.marginY : 2);
      setLogoShowDuringSchedule(bLogo.showDuringSchedule !== false);
    }

    const bBug = channel.branding.bug || {};
    const bugJson = JSON.stringify(bBug);
    if (bugJson !== lastSyncedSectionsRef.current.bug && !isDraggingBugRef.current) {
      lastSyncedSectionsRef.current.bug = bugJson;
      setBugAssetPath(bBug.assetPath || '');
      setBugPreviewPath(bBug.previewPath || '');
      setBugPreviewErrorFor('');
      if (!bBug.assetPath) requestedBugPreviewForRef.current = '';
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
    }

    const bTicker = channel.branding.ticker || {};
    const tickerJson = JSON.stringify(bTicker);
    if (tickerJson !== lastSyncedSectionsRef.current.ticker) {
      lastSyncedSectionsRef.current.ticker = tickerJson;
      setTickerEnabled(!!bTicker.enabled);
      if (!isTickerDirtyRef.current) {
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
    }

    const bTimer = channel.branding.backInTimer || {};
    const timerJson = JSON.stringify(bTimer);
    if (timerJson !== lastSyncedSectionsRef.current.backInTimer) {
      lastSyncedSectionsRef.current.backInTimer = timerJson;
      setTimerEnabled(!!bTimer.enabled);
      setTimerShowDuringSchedule(bTimer.showDuringSchedule !== false);
      setTimerFormat(bTimer.format || 'MM:SS');
      setTimerPosition(bTimer.position || 'top-left');
      if (!isTimerDirtyRef.current) {
        setTimerLabel(bTimer.label !== undefined ? bTimer.label : 'BACK IN ');
        setTimerPositionX(bTimer.positionX !== undefined ? Number(bTimer.positionX) : 5);
        setTimerPositionY(bTimer.positionY !== undefined ? Number(bTimer.positionY) : 5);
        setTimerFontSize(bTimer.fontSize || 24);
        setTimerFontColor(bTimer.fontColor || '#ffffff');
        setTimerBgColor(bTimer.bgColor || '#000000cc');
      }
    }
  }, [channel]);

  // Backfill browser-playable preview when a channel already has an uploaded .mov bug without previewPath
  useEffect(() => {
    const channelId = channel?._id;
    const isMovBug = Boolean(bugIsMov || (bugAssetPath && String(bugAssetPath).toLowerCase().endsWith('.mov')));
    if (!channelId || !bugAssetPath || !isMovBug || bugPreviewPath) return;
    if (requestedBugPreviewForRef.current === bugAssetPath) return;

    requestedBugPreviewForRef.current = bugAssetPath;
    let cancelled = false;

    api.post(`/channels/${channelId}/bug/preview`)
      .then((res) => {
        if (cancelled) return;
        const preview = res.data?.bug?.previewPath;
        if (preview) {
          setBugPreviewPath(preview);
          setBugPreviewVersion((v) => v + 1);
          if (onBrandingUpdated) onBrandingUpdated({ type: 'bug', data: res.data.bug });
        }
      })
      .catch(() => { });

    return () => {
      cancelled = true;
    };
  }, [channel?._id, bugAssetPath, bugIsMov, bugPreviewPath, onBrandingUpdated]);

  const showAlert = (type, message) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 3500);
  };

  // Upload custom logo image
  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !channel?._id) {
      toast.error("No file selected or channel not available");
      return;
    }

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
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  // Delete uploaded channel logo
  const handleDeleteLogo = async () => {
    if (!channel?._id || !logoAssetPath || isDeletingLogo) return;
    setIsDeletingLogo(true);
    try {
      const res = await api.delete(`/channels/${channel._id}/logo`);
      const deletedLogo = res.data?.logo || { assetPath: '', enabled: false };
      setLogoAssetPath('');
      setLogoEnabled(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
      setIsDeleteLogoModalOpen(false);
      showAlert('success', res.data?.message || 'Channel logo deleted');
      if (onBrandingUpdated) onBrandingUpdated({ type: 'logo', data: deletedLogo });
    } catch (err) {
      showAlert('error', err.response?.data?.message || 'Failed to delete logo');
    } finally {
      setIsDeletingLogo(false);
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
        setLogoMarginX(channel.branding.logo.marginX ?? 2);
        setLogoMarginY(channel.branding.logo.marginY ?? 2);
      }
      showAlert('error', 'Failed to update logo overlay');
    }
  };

  // Upload custom bug image (PNG) or QuickTime animation (MOV)
  const handleBugUpload = async (e) => {
    console.log("files", e.target.files);
    const file = e.target.files?.[0];
    if (!file || !channel?._id) {
      toast.error('No file selected or channel not available');
      return;
    }

    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (ext !== '.png' && ext !== '.mov') {
      showAlert('error', 'Only PNG (.png) and QuickTime MOV (.mov) files are supported for Station Bug');
      if (e.target) e.target.value = '';
      return;
    }

    const formData = new FormData();
    formData.append('bug', file);

    setIsUploadingBug(true);
    try {
      const res = await api.post(`/channels/${channel._id}/bug/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setBugAssetPath(res.data.bug.assetPath);
      setBugPreviewPath(res.data.bug.previewPath || '');
      setBugPreviewErrorFor('');
      requestedBugPreviewForRef.current = '';
      setBugPreviewVersion((v) => v + 1);
      setBugEnabled(true);
      setBugIsMov(!!res.data.bug.isMov || ext === '.mov');
      setBugIsGif(false);
      showAlert('success', res.data.message || 'Bug uploaded & pushed to stream overlay');
      if (onBrandingUpdated) onBrandingUpdated({ type: 'bug', data: res.data.bug });
    } catch (err) {
      showAlert('error', err.response?.data?.message || 'Failed to upload station bug');
    } finally {
      setIsUploadingBug(false);
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
    } catch (_) { }
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
    } catch (_) { }
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
      const clearedBug = res.data?.bug || {
        assetPath: '',
        previewPath: '',
        enabled: false,
        isMov: false,
        isGif: false
      };
      setBugAssetPath('');
      setBugPreviewPath('');
      setBugPreviewErrorFor('');
      setBugIsMov(false);
      setBugIsGif(false);
      setBugEnabled(false);
      requestedBugPreviewForRef.current = '';
      setBugPreviewVersion((v) => v + 1);
      if (bugInputRef.current) bugInputRef.current.value = '';
      showAlert('success', res.data?.message || 'Station bug removed from air');
      if (onBrandingUpdated) onBrandingUpdated({ type: 'bug', data: clearedBug });
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
      isTickerDirtyRef.current = false;
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
      if (
        updates.label !== undefined ||
        updates.fontSize !== undefined ||
        updates.fontColor !== undefined ||
        updates.bgColor !== undefined
      ) {
        isTimerDirtyRef.current = false;
      }
      if (serverTimer) {
        if (serverTimer.enabled !== undefined) setTimerEnabled(!!serverTimer.enabled);
        if (serverTimer.showDuringSchedule !== undefined) setTimerShowDuringSchedule(serverTimer.showDuringSchedule !== false);
        if (serverTimer.format !== undefined) setTimerFormat(serverTimer.format);
        if (serverTimer.position !== undefined) setTimerPosition(serverTimer.position);
        if (!isTimerDirtyRef.current || updates.label !== undefined) {
          if (serverTimer.label !== undefined) setTimerLabel(serverTimer.label);
        }
        if (!isTimerDirtyRef.current || updates.positionX !== undefined) {
          if (serverTimer.positionX !== undefined) setTimerPositionX(serverTimer.positionX);
        }
        if (!isTimerDirtyRef.current || updates.positionY !== undefined) {
          if (serverTimer.positionY !== undefined) setTimerPositionY(serverTimer.positionY);
        }
        if (!isTimerDirtyRef.current || updates.fontSize !== undefined) {
          if (serverTimer.fontSize !== undefined) setTimerFontSize(serverTimer.fontSize);
        }
        if (!isTimerDirtyRef.current || updates.fontColor !== undefined) {
          if (serverTimer.fontColor !== undefined) setTimerFontColor(serverTimer.fontColor);
        }
        if (!isTimerDirtyRef.current || updates.bgColor !== undefined) {
          if (serverTimer.bgColor !== undefined) setTimerBgColor(serverTimer.bgColor);
        }
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

  const renderBugGraphicPreview = (isMarker = false) => {
    if (!isMarker && isUploadingBug) {
      return <Loader2 size={16} className="text-amber-400 animate-spin" />;
    }

    if (!bugAssetPath) {
      return <Sparkles size={isMarker ? 11 : 18} className={isMarker ? 'text-amber-300' : 'text-slate-600'} />;
    }

    const activeRelPath = bugPreviewPath || bugAssetPath;
    const cleanRelPath = String(activeRelPath).replace(/^\/+/, '');
    const src = `/${cleanRelPath}${bugPreviewVersion ? `?v=${bugPreviewVersion}` : ''}`;
    const extLower = cleanRelPath.toLowerCase();
    const isVideoSrc = extLower.endsWith('.webm') || extLower.endsWith('.mp4') || extLower.endsWith('.mov');
    const hasMediaError = bugPreviewErrorFor === src;

    if (isVideoSrc && !hasMediaError) {
      return (
        <video
          key={src}
          src={src}
          autoPlay
          loop
          muted
          playsInline
          onError={() => setBugPreviewErrorFor(src)}
          className="w-full h-full object-contain pointer-events-none"
        />
      );
    }

    if (isVideoSrc && hasMediaError) {
      return (
        <div className="flex flex-col items-center justify-center text-amber-300 pointer-events-none">
          <Film size={isMarker ? 11 : 16} />
          {!isMarker && <span className="text-[7.5px] font-bold tracking-wider mt-0.5">MOV</span>}
        </div>
      );
    }

    return (
      <img
        src={src}
        alt={isMarker ? 'Bug target' : 'Bug'}
        onError={() => setBugPreviewErrorFor(src)}
        className={`w-full h-full object-contain ${isMarker ? 'pointer-events-none' : ''}`}
      />
    );
  };

  return (
    <div className="h-full flex flex-col bg-[#12151b] border-l border-[#202634] select-none text-slate-200 overflow-hidden">
      {/* Top Header */}
      <div className="px-3 py-2 2xl:px-4 2xl:py-2.5 border-b border-[#202634] flex items-center justify-between bg-[#151922] shrink-0">
        <div className="flex items-center gap-1.5 2xl:gap-2">
          <Sliders size={13} className="text-blue-500" />
          <h2 className="text-[11px] 2xl:text-xs font-bold uppercase tracking-wider text-slate-200 m-0">
            Live Controls
          </h2>
        </div>
      </div>

      {/* Pill Tabs: LOGO | BUG | TICKER | TIMER */}
      <div className="p-2 2xl:p-3 border-b border-[#1d2331] shrink-0">
        <div className="grid grid-cols-4 bg-[#0b0e14] p-0.5 2xl:p-1 rounded-lg 2xl:rounded-xl border border-[#222938]">
          <button
            onClick={() => setActiveTab('logo')}
            className={`py-1 2xl:py-1.5 rounded-md 2xl:rounded-lg text-[10px] 2xl:text-xs font-bold uppercase tracking-wider transition ${activeTab === 'logo'
              ? 'bg-[#2563eb] text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
              }`}
          >
            Logo
          </button>
          <button
            onClick={() => setActiveTab('bug')}
            className={`py-1 2xl:py-1.5 rounded-md 2xl:rounded-lg text-[10px] 2xl:text-xs font-bold uppercase tracking-wider transition ${activeTab === 'bug'
              ? 'bg-[#2563eb] text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
              }`}
          >
            Bug
          </button>
          <button
            onClick={() => setActiveTab('ticker')}
            className={`py-1 2xl:py-1.5 rounded-md 2xl:rounded-lg text-[10px] 2xl:text-xs font-bold uppercase tracking-wider transition ${activeTab === 'ticker'
              ? 'bg-[#2563eb] text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
              }`}
          >
            Ticker
          </button>
          <button
            onClick={() => setActiveTab('timer')}
            className={`py-1 2xl:py-1.5 rounded-md 2xl:rounded-lg text-[10px] 2xl:text-xs font-bold uppercase tracking-wider transition ${activeTab === 'timer'
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
          className={`mx-2.5 mt-2 p-2 rounded-lg border text-[11px] 2xl:text-xs flex items-center gap-1.5 animate-fadeIn shrink-0 ${alert.type === 'success'
            ? 'bg-emerald-950/70 border-emerald-800 text-emerald-300'
            : 'bg-red-950/70 border-red-800 text-red-300'
            }`}
        >
          {alert.type === 'success' ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
          <span className="leading-tight">{alert.message}</span>
        </div>
      )}

      {/* Body content */}
      <div className="flex-1 overflow-y-auto p-2.5 2xl:p-4 space-y-2.5 2xl:space-y-4 min-h-0">
        {/* ================= LOGO TAB ================= */}
        {activeTab === 'logo' && (
          <div className="space-y-2.5 2xl:space-y-4">
            {/* Box: Channel Branding */}
            <div className="bg-[#151a24] border border-[#232c3d] rounded-xl 2xl:rounded-2xl p-2.5 2xl:p-3.5 space-y-2 2xl:space-y-3">
              <div className="flex items-center gap-1.5 2xl:gap-2 text-slate-300 text-[10.5px] 2xl:text-xs font-bold uppercase tracking-wider">
                <ImageIcon size={12} className="text-blue-400" />
                <span>Channel Branding</span>
              </div>

              {/* Logo preview + Browse + Delete button */}
              <div className="flex items-center gap-2.5 2xl:gap-3">
                <div className="w-10 h-10 2xl:w-13 2xl:h-13 rounded-lg 2xl:rounded-xl bg-[#090c12] border border-[#222938] overflow-hidden flex items-center justify-center p-1 shrink-0">
                  {logoAssetPath ? (
                    <img
                      src={`/${logoAssetPath}`}
                      alt="Logo"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <ImageIcon size={18} className="text-slate-600" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={handleLogoUpload}
                  />
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      className="px-2.5 py-1 2xl:px-3.5 2xl:py-1.5 rounded-md 2xl:rounded-lg bg-[#202736] hover:bg-[#2b354a] text-slate-200 text-[11px] 2xl:text-xs font-semibold flex items-center gap-1.5 transition border border-[#2b364c]"
                    >
                      <Upload size={12} />
                      <span>Browse</span>
                    </button>
                    {logoAssetPath && (
                      <button
                        type="button"
                        onClick={() => setIsDeleteLogoModalOpen(true)}
                        className="p-1.5 2xl:p-2 rounded-md 2xl:rounded-lg bg-[#202736] hover:bg-red-950/60 text-slate-400 hover:text-red-400 border border-[#2b364c] flex items-center justify-center transition"
                        title="Delete Logo"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                  <p className="text-[9px] 2xl:text-[10px] text-slate-500 mt-1 leading-tight">
                    Transparent PNG (Optimized for 720p 25fps)
                  </p>
                </div>
              </div>
            </div>

            {/* SHOW LOGO ON AIR Toggle */}
            <div className="flex items-center justify-between p-2.5 2xl:p-3 bg-[#151a24] border border-[#232c3d] rounded-lg 2xl:rounded-xl">
              <span className="text-[10.5px] 2xl:text-xs font-bold uppercase tracking-wider text-slate-200">
                Show Logo On Air
              </span>

              <button
                type="button"
                onClick={() => {
                  const next = !logoEnabled;
                  if (next && !logoAssetPath) {
                    showAlert('error', 'Please upload a logo image first');
                    return;
                  }
                  setLogoEnabled(next);
                  handleUpdateLogo({ enabled: next });
                }}
                className={`w-9 h-5 2xl:w-11 2xl:h-6 flex items-center rounded-full p-0.5 2xl:p-1 transition-colors duration-300 shrink-0 ${logoEnabled ? 'bg-blue-600' : 'bg-slate-700'
                  }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${logoEnabled ? 'translate-x-4 2xl:translate-x-5' : 'translate-x-0'
                    }`}
                />
              </button>
            </div>

            {/* SHOW LOGO DURING AD Toggle */}
            {/* <div className="flex items-center justify-between gap-2 p-2.5 2xl:p-3 bg-[#151a24] border border-[#232c3d] rounded-lg 2xl:rounded-xl">
              <div className="space-y-0.5 min-w-0">
                <span className="text-[10.5px] 2xl:text-xs font-bold uppercase tracking-wider text-slate-200 block">
                  Show Logo during Ad
                </span>
                <span className="text-[9px] 2xl:text-[10px] text-slate-400 leading-tight block">
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
                className={`w-9 h-5 2xl:w-11 2xl:h-6 flex items-center rounded-full p-0.5 2xl:p-1 transition-colors duration-300 shrink-0 ${logoShowDuringSchedule ? 'bg-blue-600' : 'bg-slate-700'
                  }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${logoShowDuringSchedule ? 'translate-x-4 2xl:translate-x-5' : 'translate-x-0'
                    }`}
                />
              </button>
            </div> */}

            {/* Position Box (5 buttons) */}
            <div className="bg-[#151a24] border border-[#232c3d] rounded-xl 2xl:rounded-2xl p-2.5 2xl:p-3.5">
              <span className="text-[10px] 2xl:text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                Logo Position
              </span>

              <div className="relative aspect-video max-h-[115px] xl:max-h-[125px] 2xl:max-h-[155px] w-full mx-auto bg-[#090c12] border border-[#222938] rounded-lg 2xl:rounded-xl flex items-center justify-center p-2">
                {/* Top-Left */}
                <button
                  onClick={() => {
                    setLogoPosition('top-left');
                    handleUpdateLogo({ position: 'top-left' });
                  }}
                  className={`absolute top-2 left-2 w-6 h-6 2xl:w-7 2xl:h-7 rounded-md 2xl:rounded-lg flex items-center justify-center transition border ${logoPosition === 'top-left'
                    ? 'bg-blue-600 border-blue-400 text-white shadow-md'
                    : 'bg-[#141822] border-[#222a3a] text-slate-400 hover:text-white'
                    }`}
                  title="Top Left"
                >
                  <CornerUpLeft size={12} />
                </button>

                {/* Top-Right */}
                <button
                  onClick={() => {
                    setLogoPosition('top-right');
                    handleUpdateLogo({ position: 'top-right' });
                  }}
                  className={`absolute top-2 right-2 w-6 h-6 2xl:w-7 2xl:h-7 rounded-md 2xl:rounded-lg flex items-center justify-center transition border ${logoPosition === 'top-right'
                    ? 'bg-blue-600 border-blue-400 text-white shadow-md'
                    : 'bg-[#141822] border-[#222a3a] text-slate-400 hover:text-white'
                    }`}
                  title="Top Right"
                >
                  <CornerUpRight size={12} />
                </button>

                {/* Center */}
                <button
                  onClick={() => {
                    setLogoPosition('center');
                    handleUpdateLogo({ position: 'center' });
                  }}
                  className={`w-6 h-6 2xl:w-7 2xl:h-7 rounded-md 2xl:rounded-lg flex items-center justify-center transition border ${logoPosition === 'center'
                    ? 'bg-blue-600 border-blue-400 text-white shadow-md'
                    : 'bg-[#141822] border-[#222a3a] text-slate-400 hover:text-white'
                    }`}
                  title="Center"
                >
                  <Circle size={12} />
                </button>

                {/* Bottom-Left */}
                <button
                  onClick={() => {
                    setLogoPosition('bottom-left');
                    handleUpdateLogo({ position: 'bottom-left' });
                  }}
                  className={`absolute bottom-2 left-2 w-6 h-6 2xl:w-7 2xl:h-7 rounded-md 2xl:rounded-lg flex items-center justify-center transition border ${logoPosition === 'bottom-left'
                    ? 'bg-blue-600 border-blue-400 text-white shadow-md'
                    : 'bg-[#141822] border-[#222a3a] text-slate-400 hover:text-white'
                    }`}
                  title="Bottom Left"
                >
                  <CornerDownLeft size={12} />
                </button>

                {/* Bottom-Right */}
                <button
                  onClick={() => {
                    setLogoPosition('bottom-right');
                    handleUpdateLogo({ position: 'bottom-right' });
                  }}
                  className={`absolute bottom-2 right-2 w-6 h-6 2xl:w-7 2xl:h-7 rounded-md 2xl:rounded-lg flex items-center justify-center transition border ${logoPosition === 'bottom-right'
                    ? 'bg-blue-600 border-blue-400 text-white shadow-md'
                    : 'bg-[#141822] border-[#222a3a] text-slate-400 hover:text-white'
                    }`}
                  title="Bottom Right"
                >
                  <CornerDownRight size={12} />
                </button>
              </div>
            </div>

            {/* Sliders: SIZE, MARGIN X, MARGIN Y */}
            <div className="space-y-2.5 2xl:space-y-3.5 bg-[#151a24] border border-[#232c3d] rounded-xl 2xl:rounded-2xl p-2.5 2xl:p-3.5">
              {/* SIZE */}
              <div>
                <div className="flex items-center justify-between text-[10px] 2xl:text-xs font-semibold text-slate-300 mb-1">
                  <span className="uppercase tracking-wider text-[9.5px] 2xl:text-[10px]">Size</span>
                  <span className="font-mono text-blue-400">{logoSizePercent}%</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="45"
                  value={logoSizePercent}
                  onChange={(e) => setLogoSizePercent(Number(e.target.value))}
                  onMouseUp={(e) => handleUpdateLogo({ sizePercent: Number(e.currentTarget.value) })}
                  onTouchEnd={(e) => handleUpdateLogo({ sizePercent: Number(e.currentTarget.value) })}
                  className="w-full accent-blue-600 cursor-pointer h-1.5 bg-[#090c12] rounded-lg"
                />
              </div>

              {/* MARGIN X */}
              <div>
                <div className="flex items-center justify-between text-[10px] 2xl:text-xs font-semibold text-slate-300 mb-1">
                  <span className="uppercase tracking-wider text-[9.5px] 2xl:text-[10px]">Margin X</span>
                  <span className="font-mono text-blue-400">{logoMarginX}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="15"
                  value={logoMarginX}
                  onChange={(e) => setLogoMarginX(Number(e.target.value))}
                  onMouseUp={(e) => handleUpdateLogo({ marginX: Number(e.currentTarget.value) })}
                  onTouchEnd={(e) => handleUpdateLogo({ marginX: Number(e.currentTarget.value) })}
                  className="w-full accent-blue-600 cursor-pointer h-1.5 bg-[#090c12] rounded-lg"
                />
              </div>

              {/* MARGIN Y */}
              <div>
                <div className="flex items-center justify-between text-[10px] 2xl:text-xs font-semibold text-slate-300 mb-1">
                  <span className="uppercase tracking-wider text-[9.5px] 2xl:text-[10px]">Margin Y</span>
                  <span className="font-mono text-blue-400">{logoMarginY}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="15"
                  value={logoMarginY}
                  onChange={(e) => setLogoMarginY(Number(e.target.value))}
                  onMouseUp={(e) => handleUpdateLogo({ marginY: Number(e.currentTarget.value) })}
                  onTouchEnd={(e) => handleUpdateLogo({ marginY: Number(e.currentTarget.value) })}
                  className="w-full accent-blue-600 cursor-pointer h-1.5 bg-[#090c12] rounded-lg"
                />
              </div>
            </div>
          </div>
        )}

        {/* ================= BUG TAB ================= */}
        {activeTab === 'bug' && (
          <div className="space-y-2.5 2xl:space-y-4">
            {/* Active Schedule Notification */}
            {currentOnAirSchedule && (
              <div className="p-2.5 2xl:p-3 rounded-xl 2xl:rounded-2xl bg-amber-950/40 border border-amber-500/40 text-amber-200 flex items-start gap-2">
                <Sparkles size={14} className="text-amber-400 shrink-0 mt-0.5 animate-pulse" />
                <div className="text-[11px] 2xl:text-xs">
                  <span className="font-bold text-amber-300 block">
                    Schedule Active: "{currentOnAirSchedule.title}"
                  </span>
                  <span className="text-[9.5px] 2xl:text-[10px] text-amber-200/80 leading-relaxed block mt-0.5">
                    Station overlays (Ticker, Bug, Ashton, L-Band) are hidden during schedule playout and will restore automatically when the schedule ends.
                  </span>
                </div>
              </div>
            )}

            {/* Box: Station Bug Upload */}
            <div className="bg-[#151a24] border border-[#232c3d] rounded-xl 2xl:rounded-2xl p-2.5 2xl:p-3.5 space-y-2 2xl:space-y-3">
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 text-slate-300 text-[10.5px] 2xl:text-xs font-bold uppercase tracking-wider">
                  <Sparkles size={12} className="text-amber-400" />
                  <span>Station Bug Graphic</span>
                </div>
                {/* {bugIsMov ? (
                  <span className="text-[8.5px] 2xl:text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 animate-pulse">
                    MOV ANIMATED
                  </span>
                ) : bugAssetPath ? (
                  <span className="text-[8.5px] 2xl:text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    PNG STATIC
                  </span>
                ) : null} */}
              </div>

              {/* Bug preview + Browse button */}
              <div className="flex items-center gap-2.5 2xl:gap-3">
                <div className="w-10 h-10 2xl:w-13 2xl:h-13 rounded-lg 2xl:rounded-xl bg-[#090c12] border border-[#222938] overflow-hidden flex items-center justify-center p-1 shrink-0 relative">
                  {renderBugGraphicPreview(false)}
                </div>

                <div className="flex-1 min-w-0">
                  <input
                    ref={bugInputRef}
                    type="file"
                    accept=".png,image/png,.mov,video/quicktime"
                    className="hidden"
                    onChange={handleBugUpload}
                  />
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => bugInputRef.current?.click()}
                      disabled={isUploadingBug}
                      className="px-2.5 py-1 2xl:px-3.5 2xl:py-1.5 rounded-md 2xl:rounded-lg bg-[#202736] hover:bg-[#2b354a] disabled:opacity-60 text-slate-200 text-[11px] 2xl:text-xs font-semibold flex items-center gap-1.5 transition border border-[#2b364c]"
                    >
                      {isUploadingBug ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                      <span>{isUploadingBug ? 'Uploading...' : 'Browse'}</span>
                    </button>
                    {bugAssetPath && (
                      <button
                        onClick={handleRemoveBug}
                        className="p-1 2xl:p-1.5 rounded-md 2xl:rounded-lg bg-[#202736] hover:bg-red-950/60 text-slate-400 hover:text-red-400 border border-[#2b364c] transition"
                        title="Remove Bug"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                  <p className="text-[9px] 2xl:text-[10px] text-slate-500 mt-1 leading-tight">
                    Supports PNG and MOV files only
                  </p>
                </div>
              </div>
            </div>

            {/* SHOW BUG ON AIR Toggle */}
            <div className="flex items-center justify-between p-2.5 2xl:p-3 bg-[#151a24] border border-[#232c3d] rounded-lg 2xl:rounded-xl">
              <span className="text-[10.5px] 2xl:text-xs font-bold uppercase tracking-wider text-slate-200">
                Show Bug On Air
              </span>

              <button
                onClick={() => {
                  const next = !bugEnabled;
                  if (next && !bugAssetPath) {
                    showAlert('error', 'Please upload a station bug first');
                    return;
                  }
                  setBugEnabled(next);
                  handleUpdateBug({ enabled: next });
                }}
                className={`w-9 h-5 2xl:w-11 2xl:h-6 flex items-center rounded-full p-0.5 2xl:p-1 transition-colors duration-300 shrink-0 ${bugEnabled ? 'bg-amber-500' : 'bg-slate-700'
                  }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${bugEnabled ? 'translate-x-4 2xl:translate-x-5' : 'translate-x-0'
                    }`}
                />
              </button>
            </div>

            {/* Flexible Screen Positioning Pad */}
            <div className="bg-[#151a24] border border-[#232c3d] rounded-xl 2xl:rounded-2xl p-2.5 2xl:p-3.5 space-y-2 2xl:space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] 2xl:text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <Crosshair size={12} className="text-amber-400" />
                  <span>Screen Position</span>
                </span>
                <span className="text-[9.5px] 2xl:text-[10px] font-mono text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                  X: {bugPositionX}% Y: {bugPositionY}%
                </span>
              </div>

              {/* 16:9 Screen Positioning Pad: Click or Drag Anywhere */}
              <div
                ref={bugPadRef}
                onPointerDown={handleBugPadPointerDown}
                onPointerMove={handleBugPadPointerMove}
                onPointerUp={handleBugPadPointerUp}
                className="relative aspect-video max-h-[115px] xl:max-h-[125px] 2xl:max-h-[155px] w-full mx-auto bg-[#090c12] border border-[#222938] rounded-lg 2xl:rounded-xl overflow-hidden cursor-crosshair select-none touch-none shadow-inner"
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
                    width: `${Math.max(14, Math.min(54, Math.round(14 + (bugSizePercent * 0.8))))}px`,
                    height: `${Math.max(14, Math.min(54, Math.round(14 + (bugSizePercent * 0.8))))}px`
                  }}
                  className="absolute border-2 border-amber-400 bg-amber-500/30 rounded shadow-[0_0_12px_rgba(245,158,11,0.6)] flex items-center justify-center pointer-events-none transition-all duration-75 overflow-hidden"
                >
                  {renderBugGraphicPreview(true)}
                </div>

                {/* Drag hint overlay */}
                <div className="absolute bottom-1 right-2 text-[8.5px] 2xl:text-[9px] text-slate-500 pointer-events-none font-semibold">
                  Click or drag anywhere
                </div>
              </div>

              {/* Quick-Snap Preset Buttons */}
              <div className="grid grid-cols-5 gap-1 pt-0.5">
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
                      className={`py-0.5 2xl:py-1 rounded text-[9.5px] 2xl:text-[10px] font-semibold border transition ${isActive
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
            <div className="space-y-2.5 2xl:space-y-3.5 bg-[#151a24] border border-[#232c3d] rounded-xl 2xl:rounded-2xl p-2.5 2xl:p-3.5">
              {/* SIZE SLIDER */}
              <div>
                <div className="flex items-center justify-between text-[10px] 2xl:text-xs font-semibold text-slate-300 mb-1">
                  <span className="uppercase tracking-wider text-[9.5px] 2xl:text-[10px]">
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
                  onMouseUp={(e) => handleUpdateBug({ sizePercent: Number(e.currentTarget.value) })}
                  onTouchEnd={(e) => handleUpdateBug({ sizePercent: Number(e.currentTarget.value) })}
                  className="w-full accent-amber-500 cursor-pointer h-1.5 bg-[#090c12] rounded-lg"
                />
              </div>

              {/* HORIZONTAL POSITION X */}
              <div>
                <div className="flex items-center justify-between text-[10px] 2xl:text-xs font-semibold text-slate-300 mb-1">
                  <span className="uppercase tracking-wider text-[9.5px] 2xl:text-[10px]">Position X (Horizontal)</span>
                  <span className="font-mono text-amber-400">{bugPositionX}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={bugPositionX}
                  onChange={(e) => setBugPositionX(Number(e.target.value))}
                  onMouseUp={(e) =>
                    handleUpdateBug({
                      position: 'custom',
                      positionX: Number(e.currentTarget.value),
                      positionY: bugPositionY
                    })
                  }
                  onTouchEnd={(e) =>
                    handleUpdateBug({
                      position: 'custom',
                      positionX: Number(e.currentTarget.value),
                      positionY: bugPositionY
                    })
                  }
                  className="w-full accent-amber-500 cursor-pointer h-1.5 bg-[#090c12] rounded-lg"
                />
              </div>

              {/* VERTICAL POSITION Y */}
              <div>
                <div className="flex items-center justify-between text-[10px] 2xl:text-xs font-semibold text-slate-300 mb-1">
                  <span className="uppercase tracking-wider text-[9.5px] 2xl:text-[10px]">Position Y (Vertical)</span>
                  <span className="font-mono text-amber-400">{bugPositionY}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={bugPositionY}
                  onChange={(e) => setBugPositionY(Number(e.target.value))}
                  onMouseUp={(e) =>
                    handleUpdateBug({
                      position: 'custom',
                      positionX: bugPositionX,
                      positionY: Number(e.currentTarget.value)
                    })
                  }
                  onTouchEnd={(e) =>
                    handleUpdateBug({
                      position: 'custom',
                      positionX: bugPositionX,
                      positionY: Number(e.currentTarget.value)
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
          <div className="space-y-2.5 2xl:space-y-3.5">
            {/* Active Schedule Notification */}
            {currentOnAirSchedule && (
              <div className="p-2.5 2xl:p-3 rounded-xl 2xl:rounded-2xl bg-amber-950/40 border border-amber-500/40 text-amber-200 flex items-start gap-2">
                <Sparkles size={14} className="text-amber-400 shrink-0 mt-0.5 animate-pulse" />
                <div className="text-[11px] 2xl:text-xs">
                  <span className="font-bold text-amber-300 block">
                    Schedule Active: "{currentOnAirSchedule.title}"
                  </span>
                  <span className="text-[9.5px] 2xl:text-[10px] text-amber-200/80 leading-relaxed block mt-0.5">
                    Station overlays (Ticker, Bug, Ashton, L-Band) are hidden during schedule playout and will restore automatically when the schedule ends.
                  </span>
                </div>
              </div>
            )}

            {/* Header banner */}
            <div className="bg-[#151a24] border border-[#232c3d] rounded-xl 2xl:rounded-2xl p-2.5 2xl:p-3.5 space-y-2 2xl:space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-slate-200 text-[10.5px] 2xl:text-xs font-bold uppercase tracking-wider">
                  <Type size={13} className="text-blue-400" />
                  <span>Live Ticker</span>
                </div>

                {/* Color pickers */}
                <div className="flex items-center gap-1.5">
                  <label className="flex items-center gap-1 cursor-pointer bg-[#0b0e14] px-1.5 py-0.5 rounded-md border border-[#232b3c]" title="Background Color">
                    <span className="text-[8.5px] uppercase font-bold text-slate-400">BG</span>
                    <input
                      type="color"
                      value={tickerBgColor.substring(0, 7)}
                      onChange={(e) => updateTickerDraft(setTickerBgColor, e.target.value)}
                      className="w-3.5 h-3.5 rounded border-0 cursor-pointer bg-transparent"
                    />
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer bg-[#0b0e14] px-1.5 py-0.5 rounded-md border border-[#232b3c]" title="Text Color">
                    <span className="text-[8.5px] uppercase font-bold text-slate-400">TEXT</span>
                    <input
                      type="color"
                      value={tickerTextColor.substring(0, 7)}
                      onChange={(e) => updateTickerDraft(setTickerTextColor, e.target.value)}
                      className="w-3.5 h-3.5 rounded border-0 cursor-pointer bg-transparent"
                    />
                  </label>
                </div>
              </div>

              {/* Textarea for crawl text */}
              <div>
                <textarea
                  rows={2}
                  value={tickerText}
                  onChange={(e) => updateTickerDraft(setTickerText, e.target.value)}
                  placeholder="Enter Hindi or English ticker text..."
                  className="w-full p-2 bg-[#090c12] border border-[#232a39] rounded-lg text-[11px] 2xl:text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-all shadow-inner"
                  style={{
                    backgroundColor: tickerBgColor.substring(0, 7),
                    color: tickerTextColor.substring(0, 7),
                    fontFamily: getCssFontFamily(tickerFontFamily),
                    fontWeight: 'bold',
                    fontSize: `${Math.max(10, Math.round(tickerFontSize * 0.5))}px`,
                    padding: `${Math.max(4, Math.round(tickerPaddingY * 0.35))}px 8px`,
                    width: `${tickerWidth}%`,
                    margin: tickerAlignment.toLowerCase() === 'center' ? '0 auto' : tickerAlignment.toLowerCase() === 'right' ? '0 0 0 auto' : '0 auto 0 0'
                  }}
                />
              </div>
            </div>

            {/* Font select */}
            <div>
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <label className="text-[9.5px] 2xl:text-[10px] font-bold uppercase tracking-wider">
                  Font Family
                </label>
                <span className="text-[9.5px] 2xl:text-[10px] text-blue-400 font-mono">
                  {tickerFontFamily}
                </span>
              </div>
              <select
                value={tickerFontFamily}
                onChange={(e) => updateTickerDraft(setTickerFontFamily, e.target.value)}
                className="w-full bg-[#090c12] border border-[#232a39] text-[11px] 2xl:text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-500"
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
            <div className="space-y-2.5 2xl:space-y-3 bg-[#151a24] border border-[#232c3d] rounded-xl 2xl:rounded-2xl p-2.5 2xl:p-3.5">
              {/* Font Size */}
              <div>
                <div className="flex items-center justify-between text-[10px] 2xl:text-xs font-semibold text-slate-300 mb-0.5">
                  <span className="uppercase tracking-wider text-[9.5px] 2xl:text-[10px]">Font Size</span>
                  <span className="font-mono text-blue-400">{tickerFontSize}px</span>
                </div>
                <input
                  type="range"
                  min="12"
                  max="44"
                  value={tickerFontSize}
                  onChange={(e) => updateTickerDraft(setTickerFontSize, Number(e.target.value))}
                  className="w-full accent-blue-600 cursor-pointer h-1.5 bg-[#090c12] rounded-lg"
                />
              </div>

              {/* Margin Bottom */}
              <div>
                <div className="flex items-center justify-between text-[10px] 2xl:text-xs font-semibold text-slate-300 mb-0.5">
                  <span className="uppercase tracking-wider text-[9.5px] 2xl:text-[10px]">Margin Bottom</span>
                  <span className="font-mono text-blue-400">{tickerMarginBottom}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="20"
                  value={tickerMarginBottom}
                  onChange={(e) => updateTickerDraft(setTickerMarginBottom, Number(e.target.value))}
                  className="w-full accent-blue-600 cursor-pointer h-1.5 bg-[#090c12] rounded-lg"
                />
                <p className="text-[8.5px] 2xl:text-[9px] text-slate-500 mt-0.5">
                  0% is flush at the very bottom edge of video
                </p>
              </div>

              {/* Padding Y */}
              <div>
                <div className="flex items-center justify-between text-[10px] 2xl:text-xs font-semibold text-slate-300 mb-0.5">
                  <span className="uppercase tracking-wider text-[9.5px] 2xl:text-[10px]">Padding Y</span>
                  <span className="font-mono text-blue-400">{tickerPaddingY}px</span>
                </div>
                <input
                  type="range"
                  min="4"
                  max="30"
                  value={tickerPaddingY}
                  onChange={(e) => updateTickerDraft(setTickerPaddingY, Number(e.target.value))}
                  className="w-full accent-blue-600 cursor-pointer h-1.5 bg-[#090c12] rounded-lg"
                />
              </div>

              {/* Ticker Width */}
              <div>
                <div className="flex items-center justify-between text-[10px] 2xl:text-xs font-semibold text-slate-300 mb-0.5">
                  <span className="uppercase tracking-wider text-[9.5px] 2xl:text-[10px]">Ticker Width</span>
                  <span className="font-mono text-blue-400">{tickerWidth}%</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="100"
                  value={tickerWidth}
                  onChange={(e) => updateTickerDraft(setTickerWidth, Number(e.target.value))}
                  className="w-full accent-blue-600 cursor-pointer h-1.5 bg-[#090c12] rounded-lg"
                />
              </div>

              {/* Ticker Position */}
              <div>
                <label className="block text-[9.5px] 2xl:text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Ticker Position
                </label>
                <select
                  value={tickerAlignment}
                  onChange={(e) => updateTickerDraft(setTickerAlignment, e.target.value)}
                  className="w-full bg-[#090c12] border border-[#232a39] text-[11px] 2xl:text-xs text-slate-200 rounded-lg px-2.5 py-1 focus:outline-none focus:border-blue-500"
                >
                  <option value="Center">Center</option>
                  <option value="Left">Left</option>
                  <option value="Right">Right</option>
                </select>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-1.5 pt-1">
              <button
                onClick={handlePushTicker}
                className="w-full py-2 rounded-lg 2xl:rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-[11px] 2xl:text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition shadow-lg shadow-blue-600/30"
              >
                <Send size={13} />
                <span>Push Live to Air</span>
              </button>

              <button
                onClick={handleRemoveTicker}
                className="w-full py-1.5 2xl:py-2 rounded-lg 2xl:rounded-xl bg-[#1b2230] hover:bg-red-950/40 text-slate-400 hover:text-red-400 font-semibold text-[11px] 2xl:text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition border border-[#263145]"
              >
                <Trash2 size={12} />
                <span>Remove Ticker</span>
              </button>
            </div>
          </div>
        )}

        {/* ================= BACK IN TIMER TAB ================= */}
        {activeTab === 'timer' && (
          <div className="space-y-2.5 2xl:space-y-4">
            {currentOnAirSchedule && (
              <div className="p-2.5 2xl:p-3 rounded-xl 2xl:rounded-2xl bg-amber-950/40 border border-amber-500/40 text-amber-200 flex items-start gap-2">
                <Sparkles size={14} className="text-amber-400 shrink-0 mt-0.5 animate-pulse" />
                <div className="text-[11px] 2xl:text-xs">
                  <span className="font-bold text-amber-300 block">
                    Schedule Active: "{currentOnAirSchedule.title}"
                  </span>
                  <span className="text-[9.5px] 2xl:text-[10px] text-amber-200/80 leading-relaxed block mt-0.5">
                    {timerEnabled
                      ? 'Back In Timer is counting down live on the broadcast stream until the ad ends.'
                      : 'Back In Timer is disabled and will not show during ads.'}
                  </span>
                </div>
              </div>
            )}

            {/* Live Timer Preview Box */}
            <div className="bg-[#151a24] border border-[#232c3d] rounded-xl 2xl:rounded-2xl p-2.5 2xl:p-3.5 space-y-2 2xl:space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] 2xl:text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Clock size={12} className="text-blue-400" />
                  Live Preview
                </span>
                <span
                  className={`text-[9px] 2xl:text-[10px] font-bold px-2 py-0.5 rounded-full ${timerEnabled
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-slate-800 text-slate-500'
                    }`}
                >
                  {timerEnabled ? 'SHOWING DURING AD' : 'OFF'}
                </span>
              </div>

              <div className="relative aspect-video max-h-[115px] xl:max-h-[125px] 2xl:max-h-[155px] w-full mx-auto bg-[#090c12] border border-[#222938] rounded-lg 2xl:rounded-xl flex items-center justify-center p-2 overflow-hidden">
                <div
                  className={`absolute px-2 py-1 2xl:px-3 2xl:py-1.5 rounded-md font-mono font-bold text-[10px] 2xl:text-xs shadow-lg flex items-center gap-1 transition-all ${timerPosition === 'top-left'
                    ? 'top-2 left-2'
                    : timerPosition === 'top-right'
                      ? 'top-2 right-2'
                      : timerPosition === 'bottom-left'
                        ? 'bottom-2 left-2'
                        : timerPosition === 'bottom-right'
                          ? 'bottom-2 right-2'
                          : 'top-2 left-2'
                    }`}
                  style={{
                    backgroundColor: timerBgColor || '#000000cc',
                    color: timerFontColor || '#ffffff',
                    fontSize: `${Math.max(9, Math.min(18, (timerFontSize / 24) * 11))}px`,
                    opacity: timerEnabled ? 1 : 0.4
                  }}
                >
                  <Clock size={10} className="opacity-80" />
                  <span>
                    {timerLabel || 'BACK IN '}
                    {timerFormat === 'SS' ? '30s' : '00:30'}
                  </span>
                </div>
                <span className="text-[9px] 2xl:text-[10px] text-slate-600 font-bold uppercase tracking-wider">
                  Ad Broadcast Frame (1280x720)
                </span>
              </div>
            </div>

            {/* SINGLE TOGGLE: Show Back In Timer During Ad */}
            <div className="flex items-center justify-between gap-2 p-2.5 2xl:p-3 bg-[#151a24] border border-[#232c3d] rounded-lg 2xl:rounded-xl">
              <div className="min-w-0">
                <span className="text-[10.5px] 2xl:text-xs font-bold uppercase tracking-wider text-slate-200 block">
                  Show Timer During Ad
                </span>
                <span className="text-[9px] 2xl:text-[10px] text-slate-400 leading-tight block">
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
                className={`w-9 h-5 2xl:w-11 2xl:h-6 flex items-center rounded-full p-0.5 2xl:p-1 transition-colors duration-300 shrink-0 ${timerEnabled ? 'bg-blue-600' : 'bg-slate-700'
                  }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${timerEnabled ? 'translate-x-4 2xl:translate-x-5' : 'translate-x-0'
                    }`}
                />
              </button>
            </div>

            {/* Configuration Box: Label, Format, Position */}
            <div className="bg-[#151a24] border border-[#232c3d] rounded-xl 2xl:rounded-2xl p-2.5 2xl:p-3.5 space-y-2.5 2xl:space-y-3.5">
              <span className="text-[10px] 2xl:text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                Timer Customization
              </span>

              {/* Text Label */}
              <div>
                <label className="text-[10px] 2xl:text-[11px] text-slate-400 font-medium block mb-1">
                  Text Prefix Label
                </label>
                <input
                  type="text"
                  value={timerLabel}
                  onChange={(e) => updateTimerDraft(setTimerLabel, e.target.value)}
                  placeholder="BACK IN "
                  className="w-full bg-[#090c12] border border-[#232a39] text-[11px] 2xl:text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              {/* Format Selection */}
              <div>
                <label className="text-[10px] 2xl:text-[11px] text-slate-400 font-medium block mb-1">
                  Countdown Format
                </label>
                <div className="grid grid-cols-2 gap-1.5 2xl:gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setTimerFormat('MM:SS');
                      handleUpdateTimer({ format: 'MM:SS' });
                    }}
                    className={`py-1.5 2xl:py-2 rounded-lg border text-[10.5px] 2xl:text-xs font-bold transition flex items-center justify-center ${timerFormat === 'MM:SS'
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
                    className={`py-1.5 2xl:py-2 rounded-lg border text-[10.5px] 2xl:text-xs font-bold transition flex items-center justify-center ${timerFormat === 'SS'
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
                <label className="text-[10px] 2xl:text-[11px] text-slate-400 font-medium block mb-1">
                  Screen Position
                </label>
                <div className="grid grid-cols-2 gap-1.5 2xl:gap-2">
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
                      className={`py-1.5 2xl:py-2 px-2 rounded-lg border text-[10.5px] 2xl:text-xs font-bold transition flex items-center justify-center ${timerPosition === p.id
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
              <div className="grid grid-cols-2 gap-2.5 pt-0.5">
                <div>
                  <label className="text-[10px] 2xl:text-[11px] text-slate-400 font-medium block mb-1">
                    Font Size ({timerFontSize}px)
                  </label>
                  <input
                    type="range"
                    min="14"
                    max="48"
                    value={timerFontSize}
                    onChange={(e) => updateTimerDraft(setTimerFontSize, Number(e.target.value))}
                    className="w-full accent-blue-600 cursor-pointer h-1.5"
                  />
                </div>

                <div>
                  <label className="text-[10px] 2xl:text-[11px] text-slate-400 font-medium block mb-1">
                    Font Color
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="color"
                      value={timerFontColor}
                      onChange={(e) => updateTimerDraft(setTimerFontColor, e.target.value)}
                      className="w-7 h-7 rounded border border-slate-700 cursor-pointer bg-transparent"
                    />
                    <span className="text-[11px] text-slate-300 font-mono">{timerFontColor}</span>
                  </div>
                </div>
              </div>

              {/* Save Button */}
              <div className="pt-1">
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
                  className="w-full py-2 rounded-lg 2xl:rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] 2xl:text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition shadow-lg shadow-blue-600/30"
                >
                  <Send size={13} />
                  <span>Save Timer Settings</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Confirm Delete Channel Logo Modal */}
      <ConfirmDeleteModal
        isOpen={isDeleteLogoModalOpen}
        onClose={() => !isDeletingLogo && setIsDeleteLogoModalOpen(false)}
        onConfirm={handleDeleteLogo}
        title="Delete Channel Logo"
        itemName={logoAssetPath ? logoAssetPath.split('/').pop() : 'Channel Logo'}
        message="Are you sure you want to delete this channel logo? It will be removed from air and deleted from channel storage."
        confirmText="Delete Logo"
        isLoading={isDeletingLogo}
      />
    </div>
  );
}
