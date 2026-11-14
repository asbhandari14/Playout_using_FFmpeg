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
  Loader2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Move,
  Maximize2,
  Tv
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
  const [timerLabel, setTimerLabel] = useState(channel?.branding?.backInTimer?.label !== undefined ? channel.branding.backInTimer.label : 'BACK IN ');
  const [timerFormat, setTimerFormat] = useState('MM:SS');
  const [timerPosition, setTimerPosition] = useState('top-left');
  const [timerPositionX, setTimerPositionX] = useState(5);
  const [timerPositionY, setTimerPositionY] = useState(5);
  const [timerFontSize, setTimerFontSize] = useState(24);
  const [timerFontColor, setTimerFontColor] = useState('#ffffff');
  const [timerBgColor, setTimerBgColor] = useState('#000000cc');
  const [timerAssetPath, setTimerAssetPath] = useState('');
  const [timerImageWidth, setTimerImageWidth] = useState(220);
  const [timerImageHeight, setTimerImageHeight] = useState(70);
  const [timerTextOffsetX, setTimerTextOffsetX] = useState(50);
  const [timerTextOffsetY, setTimerTextOffsetY] = useState(50);
  const [isUploadingTimerImage, setIsUploadingTimerImage] = useState(false);
  const [timerPadFocus, setTimerPadFocus] = useState('text'); // 'text' | 'image'
  const [activeTimerDrag, setActiveTimerDrag] = useState(null); // 'text' | 'image' | null
  const [padWidth, setPadWidth] = useState(360);
  const [tickerPadWidth, setTickerPadWidth] = useState(360);
  const timerInputRef = useRef(null);
  const timerScreenPadRef = useRef(null);
  const tickerScreenPadRef = useRef(null);
  const activeTimerDragRef = useRef(null);

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

    const bLogo = channel?.branding?.logo || {};
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

    const bBug = channel?.branding?.bug || {};
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

    const bTicker = channel?.branding?.ticker || {};
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

    const bTimer = channel?.branding?.backInTimer || {};
    const timerJson = JSON.stringify(bTimer);
    if (timerJson !== lastSyncedSectionsRef.current.backInTimer) {
      lastSyncedSectionsRef.current.backInTimer = timerJson;
      setTimerEnabled(!!bTimer.enabled);
      setTimerShowDuringSchedule(bTimer.showDuringSchedule !== false);
      setTimerFormat(bTimer.format || 'MM:SS');
      setTimerPosition(bTimer.position || 'custom');
      setTimerAssetPath(bTimer.assetPath || '');
      if (!isTimerDirtyRef.current) {
        const initPosX = bTimer.positionX !== undefined ? Number(bTimer.positionX) : 5;
        const initPosY = bTimer.positionY !== undefined ? Number(bTimer.positionY) : 5;
        setTimerLabel(bTimer.label !== undefined ? bTimer.label : 'BACK IN ');
        setTimerPositionX(initPosX);
        setTimerPositionY(initPosY);
        setTimerFontSize(bTimer.fontSize || 24);
        setTimerFontColor(bTimer.fontColor || '#ffffff');
        setTimerBgColor(bTimer.bgColor || '#000000cc');
        setTimerImageWidth(bTimer.imageWidth !== undefined ? Number(bTimer.imageWidth) : 220);
        setTimerImageHeight(bTimer.imageHeight !== undefined ? Number(bTimer.imageHeight) : 70);
        setTimerTextOffsetX(bTimer.textOffsetX !== undefined ? Number(bTimer.textOffsetX) : initPosX);
        setTimerTextOffsetY(bTimer.textOffsetY !== undefined ? Number(bTimer.textOffsetY) : initPosY);
      }
    }
  }, [channel]);

  // Dynamically observe preview monitor width for 100% broadcast-accurate font scaling
  useEffect(() => {
    if (!timerScreenPadRef.current) return;
    const updateWidth = () => {
      if (timerScreenPadRef.current) {
        const w = timerScreenPadRef.current.clientWidth;
        if (w > 0) setPadWidth(w);
      }
    };
    updateWidth();
    const ro = new ResizeObserver(updateWidth);
    ro.observe(timerScreenPadRef.current);
    return () => ro.disconnect();
  }, [timerEnabled]);

  useEffect(() => {
    if (!tickerScreenPadRef.current) return;
    const updateWidth = () => {
      if (tickerScreenPadRef.current) {
        const w = tickerScreenPadRef.current.clientWidth;
        if (w > 0) setTickerPadWidth(w);
      }
    };
    updateWidth();
    const ro = new ResizeObserver(updateWidth);
    ro.observe(tickerScreenPadRef.current);
    return () => ro.disconnect();
  }, [activeTab]);

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

    // File and Channel ID validation
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
    if (updates.assetPath !== undefined) setTimerAssetPath(updates.assetPath);
    if (updates.imageWidth !== undefined) setTimerImageWidth(updates.imageWidth);
    if (updates.imageHeight !== undefined) setTimerImageHeight(updates.imageHeight);
    if (updates.textOffsetX !== undefined) setTimerTextOffsetX(updates.textOffsetX);
    if (updates.textOffsetY !== undefined) setTimerTextOffsetY(updates.textOffsetY);

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
    if (updates.assetPath !== undefined) payload.assetPath = updates.assetPath;
    if (updates.imageWidth !== undefined) payload.imageWidth = updates.imageWidth;
    if (updates.imageHeight !== undefined) payload.imageHeight = updates.imageHeight;
    if (updates.textOffsetX !== undefined) payload.textOffsetX = updates.textOffsetX;
    if (updates.textOffsetY !== undefined) payload.textOffsetY = updates.textOffsetY;

    try {
      const res = await api.put(`/channels/${channel._id}/timer`, payload);
      const serverTimer = res.data?.timer;
      if (
        updates.label !== undefined ||
        updates.positionX !== undefined ||
        updates.positionY !== undefined ||
        updates.fontSize !== undefined ||
        updates.fontColor !== undefined ||
        updates.bgColor !== undefined ||
        updates.imageWidth !== undefined ||
        updates.imageHeight !== undefined ||
        updates.textOffsetX !== undefined ||
        updates.textOffsetY !== undefined
      ) {
        isTimerDirtyRef.current = false;
      }
      if (serverTimer) {
        if (serverTimer.enabled !== undefined) setTimerEnabled(!!serverTimer.enabled);
        if (serverTimer.showDuringSchedule !== undefined) setTimerShowDuringSchedule(serverTimer.showDuringSchedule !== false);
        if (serverTimer.format !== undefined) setTimerFormat(serverTimer.format);
        if (serverTimer.position !== undefined) setTimerPosition(serverTimer.position);
        if (serverTimer.assetPath !== undefined) setTimerAssetPath(serverTimer.assetPath || '');
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
        if (!isTimerDirtyRef.current || updates.imageWidth !== undefined) {
          if (serverTimer.imageWidth !== undefined) setTimerImageWidth(serverTimer.imageWidth);
        }
        if (!isTimerDirtyRef.current || updates.imageHeight !== undefined) {
          if (serverTimer.imageHeight !== undefined) setTimerImageHeight(serverTimer.imageHeight);
        }
        if (!isTimerDirtyRef.current || updates.textOffsetX !== undefined) {
          if (serverTimer.textOffsetX !== undefined) setTimerTextOffsetX(serverTimer.textOffsetX);
        }
        if (!isTimerDirtyRef.current || updates.textOffsetY !== undefined) {
          if (serverTimer.textOffsetY !== undefined) setTimerTextOffsetY(serverTimer.textOffsetY);
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

  const handleTimerImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !channel?._id) return;

    const formData = new FormData();
    formData.append('image', file);
    formData.append('imageWidth', timerImageWidth || 220);
    formData.append('imageHeight', timerImageHeight || 70);
    formData.append('textOffsetX', timerTextOffsetX !== undefined ? timerTextOffsetX : 50);
    formData.append('textOffsetY', timerTextOffsetY !== undefined ? timerTextOffsetY : 50);

    setIsUploadingTimerImage(true);
    try {
      const res = await api.post(`/channels/${channel._id}/timer/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const newPath = res.data?.assetPath || res.data?.timer?.assetPath || '';
      setTimerAssetPath(newPath);
      showAlert('success', 'Timer background image uploaded successfully');
      if (onBrandingUpdated) onBrandingUpdated({ type: 'timer', data: res.data?.timer });
    } catch (err) {
      showAlert('error', err.response?.data?.message || 'Failed to upload timer image');
    } finally {
      setIsUploadingTimerImage(false);
      if (timerInputRef.current) timerInputRef.current.value = '';
    }
  };

  const handleRemoveTimerImage = async () => {
    try {
      await handleUpdateTimer({ assetPath: '' });
      setTimerAssetPath('');
      showAlert('success', 'Timer image removed');
    } catch {
      showAlert('error', 'Failed to remove timer image');
    }
  };

  // Coordinate calculation relative to the 16:9 broadcast monitor preview pad
  const calculateTimerPadCoords = (e) => {
    if (!timerScreenPadRef.current) return null;
    const rect = timerScreenPadRef.current.getBoundingClientRect();
    const clientX = e.clientX ?? e.touches?.[0]?.clientX;
    const clientY = e.clientY ?? e.touches?.[0]?.clientY;
    if (clientX === undefined || clientY === undefined) return null;
    const x = Math.max(1, Math.min(99, Math.round(((clientX - rect.left) / rect.width) * 100)));
    const y = Math.max(1, Math.min(99, Math.round(((clientY - rect.top) / rect.height) * 100)));
    return { x, y };
  };

  // Safe boundary calculation guaranteeing the graphic plate NEVER exceeds the 16:9 preview screen
  const getSafeImageCoords = (x, y, w = timerImageWidth, h = timerImageHeight) => {
    const halfW = ((w / 1280) * 100) / 2;
    const halfH = ((h / 720) * 100) / 2;
    const minX = Math.min(50, Math.ceil(halfW));
    const maxX = Math.max(50, Math.floor(100 - halfW));
    const minY = Math.min(50, Math.ceil(halfH));
    const maxY = Math.max(50, Math.floor(100 - halfH));
    return {
      x: Math.round(Math.max(minX, Math.min(maxX, x))),
      y: Math.round(Math.max(minY, Math.min(maxY, y)))
    };
  };

  const getSafeTextCoords = (x, y) => {
    return {
      x: Math.round(Math.max(3, Math.min(97, x))),
      y: Math.round(Math.max(3, Math.min(97, y)))
    };
  };

  const handleTimerPadPointerDown = (e) => {
    const coords = calculateTimerPadCoords(e);
    if (!coords) return;

    let target = timerPadFocus;
    if (e.target.closest('[data-timer-target="text"]')) {
      target = 'text';
    } else if (e.target.closest('[data-timer-target="image"]')) {
      target = 'image';
    }

    activeTimerDragRef.current = target;
    setActiveTimerDrag(target);
    setTimerPadFocus(target);

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (_) { }

    if (target === 'image') {
      const safe = getSafeImageCoords(coords.x, coords.y);
      updateTimerDraft(setTimerPositionX, safe.x);
      updateTimerDraft(setTimerPositionY, safe.y);
      setTimerPosition('custom');
    } else {
      const safe = getSafeTextCoords(coords.x, coords.y);
      updateTimerDraft(setTimerTextOffsetX, safe.x);
      updateTimerDraft(setTimerTextOffsetY, safe.y);
    }
  };

  const handleTimerPadPointerMove = (e) => {
    if (!activeTimerDragRef.current) return;
    const coords = calculateTimerPadCoords(e);
    if (!coords) return;

    if (activeTimerDragRef.current === 'image') {
      const safe = getSafeImageCoords(coords.x, coords.y);
      updateTimerDraft(setTimerPositionX, safe.x);
      updateTimerDraft(setTimerPositionY, safe.y);
      setTimerPosition('custom');
    } else if (activeTimerDragRef.current === 'text') {
      const safe = getSafeTextCoords(coords.x, coords.y);
      updateTimerDraft(setTimerTextOffsetX, safe.x);
      updateTimerDraft(setTimerTextOffsetY, safe.y);
    }
  };

  const handleTimerPadPointerUp = (e) => {
    if (!activeTimerDragRef.current) return;
    activeTimerDragRef.current = null;
    setActiveTimerDrag(null);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (_) { }
  };

  // Proportional Image Size Change: scales both width and height automatically preserving aspect ratio
  // Clamps position dynamically so increasing graphic size never causes it to hang outside the monitor pad
  const handleImageSizeChange = (newWidth) => {
    const currentRatio = (timerImageWidth && timerImageHeight) ? (timerImageWidth / timerImageHeight) : (220 / 70);
    const newHeight = Math.max(20, Math.min(720, Math.round(newWidth / currentRatio)));
    updateTimerDraft(setTimerImageWidth, newWidth);
    updateTimerDraft(setTimerImageHeight, newHeight);

    const safe = getSafeImageCoords(timerPositionX, timerPositionY, newWidth, newHeight);
    if (safe.x !== timerPositionX) updateTimerDraft(setTimerPositionX, safe.x);
    if (safe.y !== timerPositionY) updateTimerDraft(setTimerPositionY, safe.y);
  };

  const handleImageNaturalLoad = (e) => {
    const { naturalWidth, naturalHeight } = e.target;
    if (naturalWidth && naturalHeight) {
      const ratio = naturalWidth / naturalHeight;
      const newHeight = Math.max(20, Math.min(720, Math.round(timerImageWidth / ratio)));
      updateTimerDraft(setTimerImageHeight, newHeight);

      const safe = getSafeImageCoords(timerPositionX, timerPositionY, timerImageWidth, newHeight);
      if (safe.x !== timerPositionX) updateTimerDraft(setTimerPositionX, safe.x);
      if (safe.y !== timerPositionY) updateTimerDraft(setTimerPositionY, safe.y);
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

              <div className="relative aspect-video max-h-28.75 xl:max-h-31.25 2xl:max-h-38.75 w-full mx-auto bg-[#090c12] border border-[#222938] rounded-lg 2xl:rounded-xl flex items-center justify-center p-2">
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
                className={`w-9 h-5 2xl:w-11 2xl:h-6 flex items-center rounded-full p-0.5 2xl:p-1 transition-colors duration-300 shrink-0 ${bugEnabled ? 'bg-[#2563eb]' : 'bg-slate-700'
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
                <span className="text-[9.5px] 2xl:text-[10px] font-mono text-[#2563eb] px-1.5 py-0.5 rounded border border-[#2563eb]">
                  X: {bugPositionX}% Y: {bugPositionY}%
                </span>
              </div>

              {/* 16:9 Screen Positioning Pad: Click or Drag Anywhere */}
              <div
                ref={bugPadRef}
                onPointerDown={handleBugPadPointerDown}
                onPointerMove={handleBugPadPointerMove}
                onPointerUp={handleBugPadPointerUp}
                className="relative aspect-video max-h-28.75 xl:max-h-31.25 2xl:max-h-38.75 w-full mx-auto bg-[#090c12] border border-[#222938] rounded-lg 2xl:rounded-xl overflow-hidden cursor-crosshair select-none touch-none shadow-inner"
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
                  className="absolute border-2 border-[#2563eb] rounded flex items-center justify-center pointer-events-none transition-all duration-75 overflow-hidden"
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
                        ? ' text-[#2563eb] border-[#2563eb] shadow-sm'
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
                  <span className="font-mono text-[#2563eb]">{bugSizePercent}%</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="45"
                  value={bugSizePercent}
                  onChange={(e) => setBugSizePercent(Number(e.target.value))}
                  onMouseUp={(e) => handleUpdateBug({ sizePercent: Number(e.currentTarget.value) })}
                  onTouchEnd={(e) => handleUpdateBug({ sizePercent: Number(e.currentTarget.value) })}
                  className="w-full accent-[#2563eb] cursor-pointer h-1.5 bg-[#090c12] rounded-lg"
                />
              </div>

              {/* HORIZONTAL POSITION X */}
              <div>
                <div className="flex items-center justify-between text-[10px] 2xl:text-xs font-semibold text-slate-300 mb-1">
                  <span className="uppercase tracking-wider text-[9.5px] 2xl:text-[10px]">Position X (Horizontal)</span>
                  <span className="font-mono text-[#2563eb]">{bugPositionX}%</span>
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
                  className="w-full accent-[#2563eb] cursor-pointer h-1.5 bg-[#090c12] rounded-lg"
                />
              </div>

              {/* VERTICAL POSITION Y */}
              <div>
                <div className="flex items-center justify-between text-[10px] 2xl:text-xs font-semibold text-slate-300 mb-1">
                  <span className="uppercase tracking-wider text-[9.5px] 2xl:text-[10px]">Position Y (Vertical)</span>
                  <span className="font-mono text-[#2563eb]">{bugPositionY}%</span>
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
                  className="w-full accent-[#2563eb] cursor-pointer h-1.5 bg-[#090c12] rounded-lg"
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

            {/* 16:9 Broadcast Screen Live Position Monitor for Ticker */}
            <div className="bg-[#151a24] border border-[#232c3d] rounded-xl 2xl:rounded-2xl p-2.5 2xl:p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-slate-300 text-[10px] 2xl:text-[11px] font-bold uppercase tracking-wider">
                  <Tv size={12} className="text-blue-400" />
                  <span>16:9 Broadcast Ticker Monitor</span>
                </div>
                <span className="text-[8.5px] 2xl:text-[9.5px] font-mono text-slate-400">
                  Align: <span className="text-blue-400 font-bold">{tickerAlignment}</span> | W: <span className="text-blue-400 font-bold">{tickerWidth}%</span> | Bottom: <span className="text-blue-400 font-bold">{tickerMarginBottom}%</span>
                </span>
              </div>

              <div
                ref={tickerScreenPadRef}
                className="relative aspect-video @container max-h-32 2xl:max-h-44 w-full mx-auto bg-[#090c12] border border-[#222938] rounded-xl overflow-hidden select-none shadow-2xl flex flex-col justify-end"
                title="16:9 broadcast monitor preview showing live ticker position on screen"
              >
                {/* Broadcast Grid Guide Lines */}
                <div className="absolute inset-0 pointer-events-none opacity-20">
                  <div className="absolute left-1/3 top-0 bottom-0 border-r border-dashed border-slate-600" />
                  <div className="absolute left-2/3 top-0 bottom-0 border-r border-dashed border-slate-600" />
                  <div className="absolute top-1/3 left-0 right-0 border-b border-dashed border-slate-600" />
                  <div className="absolute top-2/3 left-0 right-0 border-b border-dashed border-slate-600" />
                </div>

                {/* Title Safe Area Guide */}
                <div className="absolute inset-2 border border-dashed border-slate-800/60 pointer-events-none rounded" />

                {/* Simulated Program Center Watermark */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-25">
                  <span className="text-slate-500 font-mono text-[9px] tracking-widest uppercase">
                    {channel?.name || 'Live Playout'} • 1280x720 Broadcast
                  </span>
                </div>

                {/* Ticker Bar on Screen */}
                {(() => {
                  const scale = tickerPadWidth > 0 ? tickerPadWidth / 1280 : 0.28;
                  const previewFontSize = Math.max(8, Math.round(tickerFontSize * scale));
                  const previewPadY = Math.max(1, Math.round(tickerPaddingY * scale));
                  const align = (tickerAlignment || 'center').toLowerCase();

                  let leftStyle = '50%';
                  let transformStyle = 'translateX(-50%)';
                  let rightStyle = 'auto';

                  if (align === 'left') {
                    leftStyle = '0%';
                    transformStyle = 'none';
                  } else if (align === 'right') {
                    leftStyle = 'auto';
                    rightStyle = '0%';
                    transformStyle = 'none';
                  }

                  return (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: `${tickerMarginBottom}%`,
                        left: leftStyle,
                        right: rightStyle,
                        transform: transformStyle,
                        width: `${tickerWidth}%`,
                        backgroundColor: tickerBgColor || '#000000dd',
                        color: tickerTextColor || '#ffffff',
                        fontFamily: getCssFontFamily(tickerFontFamily),
                        fontSize: `${previewFontSize}px`,
                        paddingTop: `${previewPadY}px`,
                        paddingBottom: `${previewPadY}px`,
                        borderRadius: Number(tickerWidth) < 100 ? '4px' : '0px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.6)',
                        zIndex: 10
                      }}
                      className="overflow-hidden whitespace-nowrap flex items-center px-2 border-t border-white/10"
                    >
                      <div className="font-bold truncate select-none leading-none">
                        {tickerText || 'Welcome to Cloud Playout Live Broadcast'}
                      </div>
                    </div>
                  );
                })()}
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

            {/* 1. CHOOSE GRAPHIC */}
            <div className="bg-[#151a24] border border-[#232c3d] rounded-xl 2xl:rounded-2xl p-2.5 2xl:p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] 2xl:text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <ImageIcon size={12} className="text-blue-400" />
                  Choose Graphic
                </span>
                {/* On/Off Switch */}
                <div className="flex items-center gap-2">
                  <span className="text-[9.5px] 2xl:text-[10px] text-slate-400">
                    {timerEnabled ? 'Active' : 'Disabled'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !timerEnabled;
                      setTimerEnabled(next);
                      setTimerShowDuringSchedule(next);
                      handleUpdateTimer({ enabled: next, showDuringSchedule: next });
                    }}
                    className={`w-8 h-4.5 2xl:w-9 2xl:h-5 flex items-center rounded-full p-0.5 transition-colors duration-300 shrink-0 ${timerEnabled ? 'bg-blue-600' : 'bg-slate-700'
                      }`}
                  >
                    <div
                      className={`bg-white w-3.5 h-3.5 rounded-full shadow-md transform transition-transform duration-300 ${timerEnabled ? 'translate-x-3.5 2xl:translate-x-4' : 'translate-x-0'
                        }`}
                    />
                  </button>
                </div>
              </div>

              <input
                ref={timerInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={handleTimerImageUpload}
              />

              {timerAssetPath ? (
                <div className="flex items-center gap-2.5 p-2 bg-[#090c12] border border-[#222938] rounded-lg">
                  <div className="w-12 h-10 rounded bg-[#141822] border border-[#2b354a] p-1 flex items-center justify-center shrink-0 overflow-hidden">
                    <img
                      src={`/${timerAssetPath}`}
                      alt="Timer Graphic"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[11px] text-slate-200 font-medium truncate block">
                      {timerAssetPath.split('/').pop()}
                    </span>
                    <span className="text-[9.5px] text-slate-400">
                      {timerImageWidth} × {timerImageHeight} px
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => timerInputRef.current?.click()}
                      disabled={isUploadingTimerImage}
                      className="px-2.5 py-1 rounded bg-[#202736] hover:bg-[#2b354a] text-slate-200 text-[10.5px] font-semibold border border-[#2b364c] transition flex items-center gap-1"
                    >
                      {isUploadingTimerImage ? <Loader2 size={11} className="animate-spin" /> : 'Change'}
                    </button>
                    <button
                      type="button"
                      onClick={handleRemoveTimerImage}
                      className="p-1 rounded bg-[#202736] hover:bg-red-950/60 text-slate-400 hover:text-red-400 border border-[#2b364c] transition"
                      title="Remove Graphic"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => timerInputRef.current?.click()}
                  className="border-2 border-dashed border-[#2b364c] hover:border-blue-500 rounded-xl p-3 flex flex-col items-center justify-center gap-1 cursor-pointer bg-[#0c1017]/50 hover:bg-[#121722] transition text-center"
                >
                  {isUploadingTimerImage ? (
                    <Loader2 size={18} className="animate-spin text-blue-400" />
                  ) : (
                    <Upload size={18} className="text-slate-400" />
                  )}
                  <span className="text-[11px] text-slate-200 font-semibold">
                    Upload Graphic Image
                  </span>
                  <span className="text-[9.5px] text-slate-400">
                    Click to select PNG, SVG, or JPG badge
                  </span>
                </div>
              )}
            </div>

            {/* 2. BROADCAST 16:9 PREVIEW & ACCURATE POSITIONING PAD */}
            <div className="bg-[#151a24] border border-[#232c3d] rounded-xl 2xl:rounded-2xl p-2.5 2xl:p-3.5 space-y-2.5">
              {/* Header with target selection and live position readouts */}
              <div className="flex flex-wrap items-center justify-between gap-1.5 pb-2 border-b border-[#232a39]">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] 2xl:text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <Crosshair size={12} className="text-blue-400" />
                    Screen Position & Preview
                  </span>
                  {/* Dynamic placement relation badge */}
                  {(() => {
                    const imgHalfW = ((timerImageWidth / 1280) * 100) / 2;
                    const imgHalfH = ((timerImageHeight / 720) * 100) / 2;
                    const isOver =
                      Math.abs(timerTextOffsetX - timerPositionX) <= imgHalfW &&
                      Math.abs(timerTextOffsetY - timerPositionY) <= imgHalfH;
                    const isAbove =
                      !isOver &&
                      timerTextOffsetY < timerPositionY &&
                      Math.abs(timerTextOffsetX - timerPositionX) <= imgHalfW + 10;

                    if (isOver) {
                      return (
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-500/40">
                          ✓ On Graphic Plate
                        </span>
                      );
                    }
                    if (isAbove) {
                      return (
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-500/40">
                          ↑ Above Graphic Plate
                        </span>
                      );
                    }
                    return (
                      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-blue-950/80 text-blue-300 border border-blue-500/40">
                        Screen Float
                      </span>
                    );
                  })()}
                </div>

                {/* Focus element toggle pills */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setTimerPadFocus('image')}
                    className={`px-2 py-0.5 rounded text-[9.5px] font-mono font-semibold border transition flex items-center gap-1 ${timerPadFocus === 'image'
                      ? 'bg-amber-950/80 border-amber-500 text-amber-300 shadow-sm'
                      : 'bg-[#10141d] border-[#222a3a] text-slate-400 hover:text-slate-200'
                      }`}
                    title="Click to focus Graphic Box placement"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                    <span>Graphic: X:{timerPositionX}% Y:{timerPositionY}%</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTimerPadFocus('text')}
                    className={`px-2 py-0.5 rounded text-[9.5px] font-mono font-semibold border transition flex items-center gap-1 ${timerPadFocus === 'text'
                      ? 'bg-blue-950/80 border-blue-500 text-blue-300 shadow-sm'
                      : 'bg-[#10141d] border-[#222a3a] text-slate-400 hover:text-slate-200'
                      }`}
                    title="Click to focus Timer Text placement"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />
                    <span>Text: X:{timerTextOffsetX}% Y:{timerTextOffsetY}%</span>
                  </button>
                </div>
              </div>

              {/* Graphic Size Slider (Proportional Width & Height auto-scaling) */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] 2xl:text-[11px] text-slate-400 font-medium flex items-center gap-1">
                    <span>Graphic Size</span>
                    <span className="text-slate-500 text-[9px]">(Auto-adjusts W × H)</span>
                  </label>
                  <span className="text-[10px] text-slate-300 font-mono">
                    {timerImageWidth} × {timerImageHeight} px
                    <span className="text-slate-500 ml-1">
                      ({((timerImageWidth / 1280) * 100).toFixed(1)}% × {((timerImageHeight / 720) * 100).toFixed(1)}%)
                    </span>
                  </span>
                </div>
                <input
                  type="range"
                  min="60"
                  max="640"
                  step="4"
                  value={timerImageWidth}
                  onChange={(e) => handleImageSizeChange(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer h-1.5"
                />
                <div className="flex justify-between text-[8.5px] text-slate-500">
                  <span>Smaller</span>
                  <span className="text-amber-400/70 font-medium">Aspect Ratio Maintained</span>
                  <span>Larger</span>
                </div>
              </div>

              {/* 16:9 Broadcast Screen Positioning Pad */}
              <div
                ref={timerScreenPadRef}
                onPointerDown={handleTimerPadPointerDown}
                onPointerMove={handleTimerPadPointerMove}
                onPointerUp={handleTimerPadPointerUp}
                className="relative aspect-video @container max-h-36 2xl:max-h-48 w-full mx-auto bg-[#090c12] border border-[#222938] rounded-xl overflow-hidden cursor-crosshair select-none touch-none shadow-2xl"
                title="Click or drag to place the timer graphic or text"
              >
                {/* Broadcast Rule of Thirds Guide Lines */}
                <div className="absolute inset-0 pointer-events-none opacity-25">
                  <div className="absolute left-1/3 top-0 bottom-0 border-r border-dashed border-slate-600" />
                  <div className="absolute left-2/3 top-0 bottom-0 border-r border-dashed border-slate-600" />
                  <div className="absolute top-1/3 left-0 right-0 border-b border-dashed border-slate-600" />
                  <div className="absolute top-2/3 left-0 right-0 border-b border-dashed border-slate-600" />
                </div>

                {/* Broadcast Title-Safe Area Guide (dashed inner perimeter) */}
                <div className="absolute inset-2 border border-dashed border-slate-800/60 pointer-events-none rounded" />

                {/* 1. Timer Graphic Outer Box (Represents position and frame-accurate dimensions on screen) */}
                {(() => {
                  const imgHalfWPct = ((timerImageWidth / 1280) * 100) / 2;
                  const imgHalfHPct = ((timerImageHeight / 720) * 100) / 2;
                  const minImgX = Math.min(50, imgHalfWPct);
                  const maxImgX = Math.max(50, 100 - imgHalfWPct);
                  const minImgY = Math.min(50, imgHalfHPct);
                  const maxImgY = Math.max(50, 100 - imgHalfHPct);
                  const renderImgX = Math.max(minImgX, Math.min(maxImgX, timerPositionX));
                  const renderImgY = Math.max(minImgY, Math.min(maxImgY, timerPositionY));

                  return (
                    <div
                      data-timer-target="image"
                      style={{
                        left: `${renderImgX}%`,
                        top: `${renderImgY}%`,
                        transform: 'translate(-50%, -50%)',
                        width: `${Math.max(4, Math.min(100, (timerImageWidth / 1280) * 100))}%`,
                        height: `${Math.max(4, Math.min(100, (timerImageHeight / 720) * 100))}%`,
                        zIndex: 10
                      }}
                      className={`absolute rounded flex items-center justify-center cursor-grab active:cursor-grabbing select-none touch-none transition-shadow duration-75 overflow-hidden ${
                        timerPadFocus === 'image' || activeTimerDrag === 'image'
                          ? 'ring-2 ring-amber-400 bg-amber-950/20 shadow-[0_0_12px_rgba(251,191,36,0.45)]'
                          : 'ring-1 ring-amber-500/40 hover:ring-amber-400/80 bg-black/20'
                      }`}
                      title="Drag to place the graphic plate on screen"
                    >
                      {timerAssetPath ? (
                        <img
                          src={`/${timerAssetPath}`}
                          alt="Timer Graphic"
                          onLoad={handleImageNaturalLoad}
                          className="w-full h-full object-contain pointer-events-none select-none rounded"
                        />
                      ) : (
                        <div
                          className="w-full h-full rounded border border-dashed border-amber-500/40 flex items-center justify-center text-amber-300/70 pointer-events-none"
                          style={{ backgroundColor: timerBgColor || '#141822' }}
                        >
                          <span className="text-[8px] 2xl:text-[9px] uppercase font-bold tracking-wider opacity-75">
                            Graphic
                          </span>
                        </div>
                      )}

                      {activeTimerDrag === 'image' && (
                        <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-amber-600 text-black font-bold text-[7.5px] font-mono px-1 rounded shadow pointer-events-none whitespace-nowrap">
                          X:{renderImgX}% Y:{renderImgY}%
                        </span>
                      )}
                    </div>
                  );
                })()}

                {/* 2. Timer Text Box (Can be placed anywhere on screen; renders above/on top of image if same position) */}
                {(() => {
                  const broadcastScale = padWidth > 0 ? padWidth / 1280 : 0.28;
                  const previewFontSize = Math.max(7, Math.round(timerFontSize * broadcastScale));
                  const displayText = `${timerLabel !== undefined ? timerLabel : ''}${timerFormat === 'SS' ? '30s' : '00:30'}`;
                  const renderTextX = Math.max(3, Math.min(97, timerTextOffsetX));
                  const renderTextY = Math.max(3, Math.min(97, timerTextOffsetY));

                  return (
                    <div
                      data-timer-target="text"
                      style={{
                        left: `${renderTextX}%`,
                        top: `${renderTextY}%`,
                        transform: 'translate(-50%, -50%)',
                        color: timerFontColor || '#ffffff',
                        fontSize: `${previewFontSize}px`,
                        lineHeight: 1,
                        textShadow: '0 1px 3px rgba(0,0,0,0.95), 0 0 2px #000',
                        zIndex: 20
                      }}
                      className={`absolute px-1 py-0.5 rounded font-mono font-bold whitespace-nowrap select-none touch-none cursor-grab active:cursor-grabbing transition-shadow duration-75 ${timerPadFocus === 'text' || activeTimerDrag === 'text'
                        ? 'ring-1.5 ring-blue-400 bg-blue-950/80 shadow-[0_0_12px_rgba(59,130,246,0.6)]'
                        : 'hover:ring-1 hover:ring-blue-400 bg-black/40 ring-1 ring-blue-500/40'
                        }`}
                      title="Drag to place the countdown timer text anywhere on screen"
                    >
                      <span className="pointer-events-none select-none">
                        {displayText}
                      </span>

                      {activeTimerDrag === 'text' && (
                        <span className="absolute -top-4.5 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[7.5px] font-mono px-1 rounded shadow pointer-events-none whitespace-nowrap">
                          X:{renderTextX}% Y:{renderTextY}%
                        </span>
                      )}
                    </div>
                  );
                })()}

                {/* Drag hint overlay at bottom-right */}
                <div className="absolute bottom-1 right-2 text-[8px] 2xl:text-[8.5px] text-slate-500 pointer-events-none font-semibold">
                  Click or drag graphic / text anywhere
                </div>
              </div>

              {/* Graphic Presets & Text Alignment Actions */}
              <div className="space-y-1.5 pt-0.5">
                {/* Graphic Screen Presets (Frame-accurate broadcast positions clamped within borders) */}
                {(() => {
                  const imgHalfWPct = ((timerImageWidth / 1280) * 100) / 2;
                  const imgHalfHPct = ((timerImageHeight / 720) * 100) / 2;
                  const safePresetMarginX = Math.max(2, Math.round(imgHalfWPct + 1.5));
                  const safePresetMarginY = Math.max(2, Math.round(imgHalfHPct + 1.5));
                  const presets = [
                    { label: 'Top-L', x: safePresetMarginX, y: safePresetMarginY },
                    { label: 'Top-R', x: Math.max(50, 100 - safePresetMarginX), y: safePresetMarginY },
                    { label: 'Center', x: 50, y: 50 },
                    { label: 'Bot-L', x: safePresetMarginX, y: Math.max(50, 100 - safePresetMarginY) },
                    { label: 'Bot-R', x: Math.max(50, 100 - safePresetMarginX), y: Math.max(50, 100 - safePresetMarginY) }
                  ];

                  return (
                    <div className="grid grid-cols-5 gap-1">
                      {presets.map((preset) => {
                        const isActive =
                          Math.abs(timerPositionX - preset.x) <= 3 && Math.abs(timerPositionY - preset.y) <= 3;
                        return (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => {
                              updateTimerDraft(setTimerPositionX, preset.x);
                              updateTimerDraft(setTimerPositionY, preset.y);
                              setTimerPosition('custom');
                            }}
                            className={`py-0.5 2xl:py-1 rounded text-[9px] 2xl:text-[9.5px] font-semibold border transition ${isActive
                              ? 'text-amber-400 border-amber-500 bg-amber-950/40 shadow-sm'
                              : 'bg-[#121620] text-slate-400 hover:text-white border-[#222938]'
                              }`}
                            title={`Place Graphic at ${preset.label}`}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}

                {/* Alignment Actions for Text relative to Graphic */}
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const imgHalfWPct = ((timerImageWidth / 1280) * 100) / 2;
                      const imgHalfHPct = ((timerImageHeight / 720) * 100) / 2;
                      const renderImgX = Math.max(imgHalfWPct, Math.min(100 - imgHalfWPct, timerPositionX));
                      const renderImgY = Math.max(imgHalfHPct, Math.min(100 - imgHalfHPct, timerPositionY));
                      updateTimerDraft(setTimerTextOffsetX, renderImgX);
                      updateTimerDraft(setTimerTextOffsetY, renderImgY);
                    }}
                    className="py-1 px-2 rounded-lg bg-[#141b28] hover:bg-[#1c2638] text-emerald-300 border border-emerald-500/30 hover:border-emerald-500/60 text-[9.5px] 2xl:text-[10px] font-semibold transition flex items-center justify-center gap-1 shadow-sm"
                    title="Center the timer text directly onto the graphic plate"
                  >
                    <span>🎯 Snap Text on Graphic</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const imgHalfWPct = ((timerImageWidth / 1280) * 100) / 2;
                      const imgHalfHPct = ((timerImageHeight / 720) * 100) / 2;
                      const renderImgX = Math.max(imgHalfWPct, Math.min(100 - imgHalfWPct, timerPositionX));
                      const renderImgY = Math.max(imgHalfHPct, Math.min(100 - imgHalfHPct, timerPositionY));
                      const textHeightPct = (timerFontSize / 720) * 100;
                      const gapPct = 1.5;
                      updateTimerDraft(setTimerTextOffsetX, renderImgX);
                      updateTimerDraft(
                        setTimerTextOffsetY,
                        Math.max(3, Math.round(renderImgY - imgHalfHPct - (textHeightPct / 2) - gapPct))
                      );
                    }}
                    className="py-1 px-2 rounded-lg bg-[#141b28] hover:bg-[#1c2638] text-amber-300 border border-amber-500/30 hover:border-amber-500/60 text-[9.5px] 2xl:text-[10px] font-semibold transition flex items-center justify-center gap-1 shadow-sm"
                    title="Place the timer text immediately above the graphic plate"
                  >
                    <span>⬆ Place Text Above Graphic</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 3. BELOW THE PREVIEW BOX: FONT SIZE, TEXT, COLOR & SAVE */}
            <div className="bg-[#151a24] border border-[#232c3d] rounded-xl 2xl:rounded-2xl p-2.5 2xl:p-3.5 space-y-2.5">
              <span className="text-[10px] 2xl:text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                Timer Text & Appearance
              </span>

              {/* Timer Text & Format */}
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] 2xl:text-[11px] text-slate-400 font-medium">
                      Timer Text Prefix
                    </label>
                    {timerLabel ? (
                      <button
                        type="button"
                        onClick={() => updateTimerDraft(setTimerLabel, '')}
                        className="text-[9px] text-blue-400 hover:text-blue-300 underline"
                      >
                        Remove Prefix
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => updateTimerDraft(setTimerLabel, 'BACK IN ')}
                        className="text-[9px] text-slate-500 hover:text-slate-300"
                      >
                        + Use "BACK IN "
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={timerLabel !== undefined ? timerLabel : ''}
                    onChange={(e) => updateTimerDraft(setTimerLabel, e.target.value)}
                    placeholder="e.g. BACK IN (leave empty for numbers only)"
                    className="w-full bg-[#090c12] border border-[#232a39] text-[11px] 2xl:text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] 2xl:text-[11px] text-slate-400 font-medium block mb-1">
                    Time Format
                  </label>
                  <div className="grid grid-cols-2 gap-1">
                    <button
                      type="button"
                      onClick={() => updateTimerDraft(setTimerFormat, 'MM:SS')}
                      className={`py-1.5 rounded text-[10px] font-mono font-semibold border transition ${timerFormat === 'MM:SS'
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : 'bg-[#090c12] border-[#232a39] text-slate-400 hover:text-white'
                        }`}
                    >
                      00:30
                    </button>
                    <button
                      type="button"
                      onClick={() => updateTimerDraft(setTimerFormat, 'SS')}
                      className={`py-1.5 rounded text-[10px] font-mono font-semibold border transition ${timerFormat === 'SS'
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : 'bg-[#090c12] border-[#232a39] text-slate-400 hover:text-white'
                        }`}
                    >
                      30s
                    </button>
                  </div>
                </div>
              </div>

              {/* Font Size & Color */}
              <div className="grid grid-cols-2 gap-2.5 pt-0.5">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] 2xl:text-[11px] text-slate-400 font-medium">
                      Font Size
                    </label>
                    <span className="text-[10px] text-slate-300 font-mono">{timerFontSize}px</span>
                  </div>
                  <input
                    type="range"
                    min="12"
                    max="64"
                    value={timerFontSize}
                    onChange={(e) => updateTimerDraft(setTimerFontSize, Number(e.target.value))}
                    className="w-full accent-blue-600 cursor-pointer h-1.5"
                  />
                  <div className="flex justify-between text-[8px] text-slate-500">
                    <span>12px</span>
                    <span>Broadcast Size</span>
                    <span>64px</span>
                  </div>
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
                      className="w-7 h-7 rounded border border-slate-700 cursor-pointer bg-transparent shrink-0"
                    />
                    <input
                      type="text"
                      value={timerFontColor}
                      onChange={(e) => updateTimerDraft(setTimerFontColor, e.target.value)}
                      className="w-full bg-[#090c12] border border-[#232a39] text-[10.5px] text-slate-200 rounded px-1.5 py-1 font-mono uppercase"
                    />
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
                      position: 'custom',
                      positionX: timerPositionX,
                      positionY: timerPositionY,
                      fontSize: timerFontSize,
                      fontColor: timerFontColor,
                      bgColor: timerBgColor,
                      assetPath: timerAssetPath,
                      imageWidth: timerImageWidth,
                      imageHeight: timerImageHeight,
                      textOffsetX: timerTextOffsetX,
                      textOffsetY: timerTextOffsetY
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
