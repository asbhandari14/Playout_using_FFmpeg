import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Calendar,
  Clock,
  Tv,
  Radio,
  Play,
  CheckCircle2,
  AlertTriangle,
  Download,
  Copy,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Film,
  Megaphone,
  Layers,
  Sparkles,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  List,
  ZoomIn,
  ZoomOut,
  Target,
  X,
  ExternalLink,
  Info
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../../api/axios.js';
import TableScrollContainer from '../table/TableScrollContainer.jsx';

const formatDuration = (seconds) => {
  if (!seconds || isNaN(seconds) || seconds < 0) return '00:00';
  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

export default function EpgSection({ channels = [], activeChannelId = null }) {
  const getTodayStr = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const [selectedChannelId, setSelectedChannelId] = useState(
    activeChannelId || (channels[0]?._id ? String(channels[0]._id) : 'all')
  );
  const [selectedDate, setSelectedDate] = useState(getTodayStr());
  const [epgData, setEpgData] = useState(null);
  const [multiEpgData, setMultiEpgData] = useState({});
  const [loading, setLoading] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [expandedAdIds, setExpandedAdIds] = useState(new Set());
  const [autoPoll, setAutoPoll] = useState(true);

  // View & UI controls
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'
  const [hourWidth, setHourWidth] = useState(280); // px per hour in grid
  const [selectedProgram, setSelectedProgram] = useState(null); // program inspector drawer

  // Current time tracker for live playhead
  const [currentTimeSec, setCurrentTimeSec] = useState(() => {
    const d = new Date();
    return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
  });

  const timelineScrollRef = useRef(null);
  const hasAutoScrolledRef = useRef(false);

  // Sync with prop when channels load
  useEffect(() => {
    if (!selectedChannelId && channels.length > 0) {
      setSelectedChannelId(String(channels[0]._id));
    }
  }, [channels, selectedChannelId]);

  // Real-time second clock for playhead line
  useEffect(() => {
    const clockTimer = setInterval(() => {
      const d = new Date();
      setCurrentTimeSec(d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds());
    }, 1000);
    return () => clearInterval(clockTimer);
  }, []);

  // Fetch single channel EPG
  const fetchSingleEpg = useCallback(async (channelId, dateStr, isSilent = false, forceRefresh = false) => {
    if (!channelId || channelId === 'all') return;
    if (!isSilent) setLoading(true);
    try {
      const res = await api.get(`/channels/${channelId}/epg`, {
        params: {
          date: dateStr,
          refresh: forceRefresh ? 'true' : undefined
        }
      });
      if (res.data?.success && res.data?.data) {
        setEpgData(res.data.data);
      }
    } catch (err) {
      console.warn('[EPG Error]', err);
      if (!isSilent) {
        toast.error(err.response?.data?.message || 'Failed to fetch EPG guide');
      }
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, []);

  // Fetch all channels EPG when "all" is selected
  const fetchAllChannelsEpg = useCallback(async (dateStr, isSilent = false, forceRefresh = false) => {
    if (!channels || channels.length === 0) return;
    if (!isSilent) setLoading(true);
    try {
      const promises = channels.map(async (ch) => {
        try {
          const res = await api.get(`/channels/${ch._id}/epg`, {
            params: {
              date: dateStr,
              refresh: forceRefresh ? 'true' : undefined
            }
          });
          return { channelId: String(ch._id), data: res.data?.data || null };
        } catch {
          return { channelId: String(ch._id), data: null };
        }
      });

      const results = await Promise.all(promises);
      const dataMap = {};
      results.forEach((r) => {
        if (r.data) dataMap[r.channelId] = r.data;
      });
      setMultiEpgData(dataMap);

      // Also set epgData to the first channel's data for unified header stats
      if (channels[0]?._id && dataMap[String(channels[0]._id)]) {
        setEpgData(dataMap[String(channels[0]._id)]);
      }
    } catch (err) {
      console.warn('[Multi-EPG Error]', err);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [channels]);

  // Master fetch dispatcher
  const fetchEpg = useCallback((chId, dateStr, isSilent = false, forceRefresh = false) => {
    if (chId === 'all') {
      return fetchAllChannelsEpg(dateStr, isSilent, forceRefresh);
    }
    return fetchSingleEpg(chId, dateStr, isSilent, forceRefresh);
  }, [fetchAllChannelsEpg, fetchSingleEpg]);

  // Initial & channel/date change fetch
  useEffect(() => {
    hasAutoScrolledRef.current = false; // allow auto-scroll once on date or channel change
    if (selectedChannelId) {
      fetchEpg(selectedChannelId, selectedDate, false);
    }
  }, [selectedChannelId, selectedDate, fetchEpg]);

  // Periodic polling for real-time status updates every 4 seconds (silent, NO scroll reset)
  useEffect(() => {
    if (!autoPoll || !selectedChannelId) return;
    const interval = setInterval(() => {
      fetchEpg(selectedChannelId, selectedDate, true);
    }, 4000);
    return () => clearInterval(interval);
  }, [autoPoll, selectedChannelId, selectedDate, fetchEpg]);

  const isToday = selectedDate === getTodayStr();

  // Initial scroll to current time (Runs ONLY ONCE per channel/date change, NEVER during polling)
  useEffect(() => {
    if (viewMode !== 'grid') return;
    if (!hasAutoScrolledRef.current && isToday && timelineScrollRef.current) {
      const scrollTarget = Math.max(0, (currentTimeSec / 3600) * hourWidth - 260);
      timelineScrollRef.current.scrollLeft = scrollTarget;
      hasAutoScrolledRef.current = true;
    }
  }, [viewMode, isToday, currentTimeSec, hourWidth, epgData, multiEpgData]);

  // User explicit jump to current time
  const handleJumpToNow = () => {
    if (!timelineScrollRef.current) return;
    const scrollTarget = Math.max(0, (currentTimeSec / 3600) * hourWidth - 260);
    timelineScrollRef.current.scrollTo({ left: scrollTarget, behavior: 'smooth' });
  };

  // Date Shift Helpers
  const shiftDate = (days) => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    dateObj.setDate(dateObj.getDate() + days);
    const ny = dateObj.getFullYear();
    const nm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const nd = String(dateObj.getDate()).padStart(2, '0');
    setSelectedDate(`${ny}-${nm}-${nd}`);
  };

  const handleResetToday = () => {
    setSelectedDate(getTodayStr());
  };

  // Toggle expanded ads breakdown
  const toggleExpandAd = (id) => {
    setExpandedAdIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // XMLTV Export
  const handleDownloadXmltv = () => {
    const targetChannelId = selectedChannelId === 'all' ? channels[0]?._id : selectedChannelId;
    if (!targetChannelId) return;
    const url = `/api/v1/channels/${targetChannelId}/epg.xml?date=${selectedDate}`;
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `epg-${targetChannelId}-${selectedDate}.xml`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    toast.success('Downloading XMLTV feed');
  };

  const handleCopyXmltvLink = () => {
    const targetChannelId = selectedChannelId === 'all' ? channels[0]?._id : selectedChannelId;
    if (!targetChannelId) return;
    const origin = window.location.origin;
    const fullUrl = `${origin}/api/v1/channels/${targetChannelId}/epg.xml?date=${selectedDate}`;
    navigator.clipboard.writeText(fullUrl).then(() => {
      toast.success('XMLTV URL copied to clipboard');
    }).catch(() => {
      toast.error('Could not copy link');
    });
  };

  // Filtered Programs helper
  const filterProgramList = useCallback((list = []) => {
    return list.filter((p) => {
      if (typeFilter !== 'all' && p.type !== typeFilter) return false;
      if (searchFilter.trim()) {
        const q = searchFilter.toLowerCase();
        const matchesTitle = p.title?.toLowerCase().includes(q);
        const matchesDesc = p.description?.toLowerCase().includes(q);
        const matchesCommercial = p.commercials?.some(c => c.title?.toLowerCase().includes(q));
        if (!matchesTitle && !matchesDesc && !matchesCommercial) return false;
      }
      return true;
    });
  }, [typeFilter, searchFilter]);

  const filteredPrograms = useMemo(() => {
    return filterProgramList(epgData?.programs || []);
  }, [epgData, filterProgramList]);

  // Multi-channel rows data for Grid
  const gridRows = useMemo(() => {
    if (selectedChannelId === 'all') {
      // Row per assigned channel
      return channels.map((ch) => {
        const cData = multiEpgData[String(ch._id)];
        const rawPrograms = cData?.programs || [];
        return {
          id: String(ch._id),
          title: ch.name,
          subtitle: ch.status === 'online' ? 'ON AIR' : 'OFFLINE',
          status: ch.status,
          channel: ch,
          programs: filterProgramList(rawPrograms)
        };
      });
    }

    // Single channel: Primary track + Ad track + Live/Emergency track
    const activeCh = channels.find((c) => String(c._id) === String(selectedChannelId));
    const allProgs = filterProgramList(epgData?.programs || []);

    const primaryPrograms = allProgs.filter((p) => p.type !== 'advertisement' && p.type !== 'emergency');
    const adPrograms = allProgs.filter((p) => p.type === 'advertisement');
    const emergencyPrograms = allProgs.filter((p) => p.type === 'emergency');

    const rows = [
      {
        id: 'primary',
        title: activeCh?.name || 'Main Channel Playout',
        subtitle: 'Programs & Shows (P1/P2/P3)',
        status: activeCh?.status,
        channel: activeCh,
        programs: primaryPrograms.length > 0 ? primaryPrograms : allProgs
      }
    ];

    if (adPrograms.length > 0) {
      rows.push({
        id: 'ads',
        title: 'Commercial Breaks',
        subtitle: `${adPrograms.length} Ad Slots Scheduled (P4)`,
        badge: 'ADS',
        channel: activeCh,
        programs: adPrograms
      });
    }

    if (emergencyPrograms.length > 0) {
      rows.push({
        id: 'emergency',
        title: 'Emergency Playout',
        subtitle: `${emergencyPrograms.length} Priority Alerts (P5)`,
        badge: 'URGENT',
        channel: activeCh,
        programs: emergencyPrograms
      });
    }

    return rows;
  }, [selectedChannelId, channels, multiEpgData, epgData, filterProgramList]);

  // Priority Styling helper
  const getPriorityBadge = (priority, type) => {
    switch (priority) {
      case 5:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse">
            <AlertTriangle size={11} />
            P5 EMERGENCY
          </span>
        );
      case 4:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
            <Megaphone size={11} />
            P4 AD BREAK
          </span>
        );
      case 3:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-300 border border-red-500/40">
            <Radio size={11} />
            P3 LIVE
          </span>
        );
      case 2:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
            <Film size={11} />
            P2 SCHEDULE
          </span>
        );
      case 1:
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
            <Layers size={11} />
            P1 DEFAULT
          </span>
        );
    }
  };

  // Status Styling helper
  const getStatusBadge = (status, isPlayingNow, progressPercent = 0) => {
    if (isPlayingNow || status === 'PLAYING') {
      return (
        <div className="flex flex-col items-start gap-1">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-[0_0_12px_rgba(16,185,129,0.35)] animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            PLAYING NOW
          </span>
          {progressPercent > 0 && (
            <div className="w-24 bg-[#1a2234] rounded-full h-1 overflow-hidden border border-[#2b354d]">
              <div
                className="bg-emerald-400 h-1 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          )}
        </div>
      );
    }
    if (status === 'PLAYED') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
          <CheckCircle2 size={11} />
          PLAYED
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-sky-950/60 text-sky-400 border border-sky-800/60">
        <Clock size={11} />
        QUEUED
      </span>
    );
  };

  // Stats calculation
  const totalCommercialSec = useMemo(() => {
    return (epgData?.programs || [])
      .filter((p) => p.type === 'advertisement')
      .reduce((sum, p) => sum + (p.duration || 0), 0);
  }, [epgData]);

  const totalGridWidth = 24 * hourWidth;
  const hoursArray = Array.from({ length: 24 }, (_, i) => i);
  const playheadX = (currentTimeSec / 3600) * hourWidth;

  return (
    <div className="flex flex-col gap-4 font-mono select-none">
      {/* 1. Header & Controls Toolbar */}
      <div className="bg-[#0f1420] border border-[#1e2638] rounded-xl p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4 shadow-xl">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-md">
              <Tv size={20} />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-100 flex items-center gap-2 m-0">
                <span>Electronic Programme Guide</span>
                <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-cyan-950/60 border border-cyan-500/40 text-cyan-300 uppercase tracking-wider">
                  EPG Timeline
                </span>
              </h1>
              <p className="text-xs text-slate-400 m-0">
                Real-time broadcast schedule grid, micro-event programs &amp; commercial guide
              </p>
            </div>
          </div>
        </div>

        {/* Channel Selector & Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Channel Dropdown */}
          <div className="relative min-w-[210px]">
            <select
              value={selectedChannelId}
              onChange={(e) => setSelectedChannelId(e.target.value)}
              className="w-full bg-[#141b2b] border border-[#253047] rounded-lg px-3 py-2 text-xs font-mono font-medium text-slate-200 focus:outline-none focus:border-cyan-500 transition cursor-pointer"
            >
              {channels.length > 1 && (
                <option value="all">★ All Assigned Channels ({channels.length})</option>
              )}
              {channels.map((ch) => (
                <option key={ch._id} value={ch._id}>
                  {ch.name} {ch.status === 'online' ? '● (ON AIR)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* View Mode Toggle: Grid vs Table */}
          <div className="flex items-center bg-[#141b2b] p-0.5 rounded-lg border border-[#253047]">
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Switch to TV Timeline Grid View"
            >
              <LayoutGrid size={13} />
              <span>Timeline Grid</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Switch to Tabular List View"
            >
              <List size={13} />
              <span>Table List</span>
            </button>
          </div>

          {/* XMLTV Export Actions */}
          <button
            onClick={handleDownloadXmltv}
            title="Download XMLTV XML File for IPTV/OTT Players"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#141b2b] hover:bg-[#1a2338] border border-[#253047] text-xs font-medium text-cyan-300 hover:text-cyan-200 transition"
          >
            <Download size={13} />
            <span>XMLTV</span>
          </button>

          <button
            onClick={handleCopyXmltvLink}
            title="Copy Public XMLTV Feed Link"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#141b2b] hover:bg-[#1a2338] border border-[#253047] text-xs font-medium text-slate-300 hover:text-white transition"
          >
            <Copy size={13} />
            <span className="hidden sm:inline">Feed Link</span>
          </button>

          {/* Refresh & Force Sync Button */}
          <button
            onClick={() => fetchEpg(selectedChannelId, selectedDate, false, true)}
            disabled={loading}
            className="p-2 rounded-lg bg-[#141b2b] hover:bg-[#1a2338] border border-[#253047] text-slate-300 hover:text-cyan-400 transition disabled:opacity-50"
            title="Recalculate & Sync EPG Schedule"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-cyan-400' : ''} />
          </button>
        </div>
      </div>

      {/* 2. Date Navigation, Live Status, Zoom & Jump Controls */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
        {/* Date Selector & Jump to Now */}
        <div className="md:col-span-6 lg:col-span-5 bg-[#0f1420] border border-[#1e2638] rounded-xl p-2.5 flex items-center justify-between gap-2 shadow">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => shiftDate(-1)}
              className="p-1.5 rounded-lg bg-[#141b2b] hover:bg-[#1a2338] border border-[#253047] text-slate-300 hover:text-white transition"
              title="Previous Day"
            >
              <ChevronLeft size={16} />
            </button>

            <div className="flex items-center gap-2 px-1">
              <Calendar size={14} className="text-cyan-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent border-0 text-xs font-mono font-bold text-slate-100 focus:outline-none cursor-pointer"
              />
            </div>

            <button
              onClick={() => shiftDate(1)}
              className="p-1.5 rounded-lg bg-[#141b2b] hover:bg-[#1a2338] border border-[#253047] text-slate-300 hover:text-white transition"
              title="Next Day"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {!isToday ? (
              <button
                onClick={handleResetToday}
                className="text-[11px] px-2.5 py-1 rounded-md bg-[#141b2b] hover:bg-[#1a2338] border border-[#253047] text-slate-300 hover:text-cyan-400 font-semibold transition"
              >
                Today
              </button>
            ) : (
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Today
              </span>
            )}

            {/* Jump to Now button */}
            {isToday && viewMode === 'grid' && (
              <button
                onClick={handleJumpToNow}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-linear-to-r from-cyan-950/80 to-blue-950/80 hover:from-cyan-900 hover:to-blue-900 border border-cyan-500/50 text-cyan-200 text-xs font-bold transition shadow-sm cursor-pointer"
                title="Scroll Timeline Directly to Current Playing Program"
              >
                <Target size={12} className="text-cyan-400 animate-pulse" />
                <span>Jump to Now</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick Stats & Grid Zoom */}
        <div className="md:col-span-6 lg:col-span-7 flex flex-wrap items-center justify-between gap-2">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 flex-1 text-xs">
            <div className="bg-[#0f1420] border border-[#1e2638] rounded-xl p-2.5 flex flex-col justify-center">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Events</span>
              <span className="text-sm font-bold text-slate-100">{epgData?.totalEvents || 0} Shows</span>
            </div>

            <div className="bg-[#0f1420] border border-[#1e2638] rounded-xl p-2.5 flex flex-col justify-center">
              <span className="text-[10px] text-emerald-400 uppercase tracking-wider font-semibold">On Air</span>
              <span className="text-sm font-bold text-emerald-300">
                {epgData?.activeProgramsCount || 0} Active
              </span>
            </div>

            <div className="bg-[#0f1420] border border-[#1e2638] rounded-xl p-2.5 flex flex-col justify-center">
              <span className="text-[10px] text-amber-400 uppercase tracking-wider font-semibold">Ad Airtime</span>
              <span className="text-sm font-bold text-amber-300">
                {Math.floor(totalCommercialSec / 60)}m {totalCommercialSec % 60}s
              </span>
            </div>
          </div>

          {/* Grid Zoom Buttons */}
          {viewMode === 'grid' && (
            <div className="flex items-center gap-1 bg-[#0f1420] border border-[#1e2638] rounded-xl p-1.5">
              <button
                onClick={() => setHourWidth((w) => Math.max(180, w - 40))}
                className="p-1.5 rounded-lg bg-[#141b2b] hover:bg-[#1a2338] text-slate-400 hover:text-white transition cursor-pointer"
                title="Zoom Out Timeline"
              >
                <ZoomOut size={14} />
              </button>
              <span className="text-[10px] font-bold text-slate-400 px-1.5">
                {hourWidth}px/h
              </span>
              <button
                onClick={() => setHourWidth((w) => Math.min(460, w + 40))}
                className="p-1.5 rounded-lg bg-[#141b2b] hover:bg-[#1a2338] text-slate-400 hover:text-white transition cursor-pointer"
                title="Zoom In Timeline"
              >
                <ZoomIn size={14} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 3. Search & Category Filters */}
      <div className="bg-[#0f1420] border border-[#1e2638] rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3 shadow">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search shows, movies, sponsors..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full bg-[#141b2b] border border-[#253047] rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
          />
        </div>

        {/* Type Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
          {[
            { id: 'all', label: 'All' },
            { id: 'scheduling', label: 'Programs (P2)' },
            { id: 'advertisement', label: 'Ads (P4)' },
            { id: 'live_schedule', label: 'Live (P3)' },
            { id: 'emergency', label: 'Emergency (P5)' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setTypeFilter(tab.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition cursor-pointer ${
                typeFilter === tab.id
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow'
                  : 'bg-[#141b2b] text-slate-400 hover:text-slate-200 hover:bg-[#1a2338]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4. MAIN CONTENT: TIMELINE GRID VIEW (Default) */}
      {viewMode === 'grid' && (
        <div className="bg-[#0a0d14] border border-[#1e2638] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
          {/* Timeline Scroll Container */}
          <div
            ref={timelineScrollRef}
            className="overflow-x-auto overflow-y-hidden scroll-smooth relative"
            style={{ scrollbarWidth: 'thin', scrollbarColor: '#2b3852 #0d121c' }}
          >
            <div style={{ width: `${totalGridWidth + 220}px` }} className="flex flex-col relative min-h-[460px]">
              {/* TOP RULER: 24-Hour Timeline */}
              <div className="sticky top-0 z-20 flex bg-[#0d121c] border-b border-[#1b2333] shadow-md">
                {/* Channel Header spacer (sticky left) */}
                <div className="sticky left-0 z-30 w-[220px] shrink-0 bg-[#0d121c] border-r border-[#1e273a] px-3.5 py-2.5 flex items-center justify-between text-xs font-bold text-slate-300">
                  <span className="flex items-center gap-1.5 uppercase text-[11px] tracking-wider text-slate-400">
                    <Tv size={13} className="text-cyan-400" />
                    Channel / Track
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">24H</span>
                </div>

                {/* Hour Columns along the top */}
                <div className="flex relative" style={{ width: `${totalGridWidth}px` }}>
                  {hoursArray.map((h) => (
                    <div
                      key={h}
                      style={{ width: `${hourWidth}px` }}
                      className="border-r border-[#1a2233] h-10 px-2 flex flex-col justify-between py-1 relative text-[11px] font-mono text-slate-400"
                    >
                      <div className="flex items-center justify-between font-bold text-slate-200">
                        <span>{String(h).padStart(2, '0')}:00</span>
                      </div>
                      {/* Minor tick marks at 15m, 30m, 45m */}
                      <div className="flex items-end justify-between px-1 h-2 opacity-40">
                        <span className="w-[1px] h-1 bg-slate-500"></span>
                        <span className="w-[1px] h-2 bg-slate-400"></span>
                        <span className="w-[1px] h-1 bg-slate-500"></span>
                      </div>
                    </div>
                  ))}

                  {/* Vertical Playhead Head Marker on Ruler */}
                  {isToday && (
                    <div
                      style={{ left: `${playheadX}px` }}
                      className="absolute top-0 bottom-0 -translate-x-1/2 z-40 flex flex-col items-center pointer-events-none"
                    >
                      <div className="bg-red-500 text-white font-mono text-[9px] font-extrabold px-1.5 py-0.5 rounded shadow-lg animate-pulse flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                        NOW
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* GRID ROWS: Broadcast Streams / Channels */}
              <div className="flex flex-col relative divide-y divide-[#151c2a]">
                {/* Full-Height Vertical Playhead Line across all rows */}
                {isToday && (
                  <div
                    style={{ left: `${playheadX + 220}px` }}
                    className="absolute top-0 bottom-0 w-[2px] bg-gradient-to-b from-red-500 via-rose-400 to-red-500 shadow-[0_0_12px_rgba(239,68,68,0.8)] z-30 pointer-events-none"
                  />
                )}

                {loading && gridRows.length === 0 ? (
                  <div className="py-24 text-center text-slate-400 text-xs">
                    <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-cyan-400" />
                    Calculating 24-hour broadcast EPG timeline grid...
                  </div>
                ) : gridRows.length === 0 ? (
                  <div className="py-24 text-center text-slate-500 text-xs">
                    No EPG events found matching the selected filters.
                  </div>
                ) : (
                  gridRows.map((row) => (
                    <div key={row.id} className="flex group min-h-[96px] relative hover:bg-[#0c101a]/40 transition">
                      {/* Left Header for Row (Sticky left) */}
                      <div className="sticky left-0 z-20 w-[220px] shrink-0 bg-[#0e131d] border-r border-[#1e273a] p-3 flex flex-col justify-center gap-1 shadow-md">
                        <div className="flex items-center gap-2">
                          {row.status === 'online' ? (
                            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#10b981] animate-pulse shrink-0" />
                          ) : (
                            <span className="w-2 h-2 rounded-full bg-slate-600 shrink-0" />
                          )}
                          <span className="text-xs font-bold text-slate-100 truncate" title={row.title}>
                            {row.title}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 truncate pl-4">
                          {row.subtitle}
                        </span>
                        {row.badge && (
                          <div className="pl-4 mt-0.5">
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              {row.badge}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Right Timeline Track with Rectangular Program Blocks */}
                      <div
                        className="relative h-[96px] flex items-center"
                        style={{ width: `${totalGridWidth}px` }}
                      >
                        {/* Background hour grid dividers */}
                        {hoursArray.map((h) => (
                          <div
                            key={h}
                            style={{
                              left: `${h * hourWidth}px`,
                              width: `${hourWidth}px`
                            }}
                            className="absolute top-0 bottom-0 border-r border-[#141b29] pointer-events-none"
                          />
                        ))}

                        {/* Program rectangular cards */}
                        {row.programs.map((item) => {
                          const leftPx = ((item.startSeconds || 0) / 3600) * hourWidth;
                          const rawWidthPx = ((item.duration || 60) / 3600) * hourWidth;
                          const widthPx = Math.max(90, rawWidthPx - 4); // leave gap between cards

                          const isAd = item.type === 'advertisement';
                          const isEmergency = item.type === 'emergency';
                          const isLive = item.type === 'live_schedule';

                          return (
                            <div
                              key={item.id}
                              onClick={() => setSelectedProgram(item)}
                              style={{
                                left: `${leftPx}px`,
                                width: `${widthPx}px`
                              }}
                              className={`absolute top-2 bottom-2 rounded-xl p-2.5 flex flex-col justify-between cursor-pointer transition-all duration-150 border select-none group/card shadow-md overflow-hidden ${
                                item.isPlayingNow
                                  ? 'bg-gradient-to-r from-blue-950/95 via-indigo-950/95 to-[#1c263c] border-cyan-400 text-white shadow-[0_0_20px_rgba(6,182,212,0.4)] ring-1 ring-cyan-400/60 z-10'
                                  : isAd
                                    ? 'bg-[#18140c] hover:bg-[#231d12] border-amber-700/50 hover:border-amber-400 text-amber-100'
                                    : isEmergency
                                      ? 'bg-rose-950/60 hover:bg-rose-950/90 border-rose-600/60 hover:border-rose-400 text-rose-100'
                                      : isLive
                                        ? 'bg-red-950/50 hover:bg-red-950/80 border-red-500/50 hover:border-red-400 text-red-100'
                                        : 'bg-[#141b2a] hover:bg-[#1b2438] border-[#222d42] hover:border-cyan-500/60 text-slate-200'
                              }`}
                              title={`${item.title} (${item.startTime} - ${item.endTime})`}
                            >
                              {/* Top row: Thumbnail + Title + Live Dot */}
                              <div className="flex items-start gap-2 overflow-hidden">
                                {/* Thumbnail preview if available, else type icon */}
                                {item.icon || item.asset?.thumbnailPath ? (
                                  <img
                                    src={item.icon ? `/${item.icon}` : `/${item.asset?.thumbnailPath}`}
                                    alt=""
                                    className="w-10 h-10 rounded-lg object-cover border border-[#2b3a54] shrink-0 hidden sm:block shadow"
                                    onError={(e) => { e.target.style.display = 'none'; }}
                                  />
                                ) : (
                                  <div
                                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border text-[11px] font-bold ${
                                      isAd
                                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                                        : isEmergency
                                          ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                                          : isLive
                                            ? 'bg-red-500/10 border-red-500/30 text-red-400'
                                            : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
                                    }`}
                                  >
                                    {isAd ? (
                                      <Megaphone size={12} />
                                    ) : isEmergency ? (
                                      <AlertTriangle size={12} />
                                    ) : isLive ? (
                                      <Radio size={12} />
                                    ) : (
                                      <Film size={12} />
                                    )}
                                  </div>
                                )}

                                {/* Title & Timings */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    {item.isPlayingNow && (
                                      <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping shrink-0" />
                                    )}
                                    <span className="text-xs font-bold truncate group-hover/card:text-cyan-300 transition">
                                      {item.title}
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-mono truncate mt-0.5">
                                    {item.startTime} - {item.endTime}
                                  </div>
                                </div>
                              </div>

                              {/* Bottom row: Duration & Type Badges */}
                              <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono mt-1">
                                <span className="truncate">{item.durationFormatted}</span>
                                {isAd && item.commercials?.length > 0 && (
                                  <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-bold shrink-0">
                                    {item.commercials.length} Ads
                                  </span>
                                )}
                                {item.isPlayingNow && (
                                  <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-cyan-500 text-slate-950 shrink-0">
                                    ON AIR
                                  </span>
                                )}
                              </div>

                              {/* Progress bar along bottom if currently playing */}
                              {item.isPlayingNow && item.progressPercent > 0 && (
                                <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#101726]">
                                  <div
                                    className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-500"
                                    style={{ width: `${item.progressPercent}%` }}
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. ALTERNATE CONTENT: TABLE LIST VIEW */}
      {viewMode === 'table' && (
        <div className="bg-[#0f1420] border border-[#1e2638] rounded-xl overflow-hidden shadow-xl">
          <TableScrollContainer allowVerticalScroll={true}>
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#131926] border-b border-[#1e2638] text-slate-400 text-[11px] uppercase tracking-wider font-bold">
                  <th className="py-3 px-3.5 w-28 whitespace-nowrap">Date</th>
                  <th className="py-3 px-3.5 w-28 whitespace-nowrap">Start Time</th>
                  <th className="py-3 px-3.5 w-28 whitespace-nowrap">Stop Time</th>
                  <th className="py-3 px-3.5 min-w-[300px]">Program (Title &amp; Description)</th>
                  <th className="py-3 px-3.5 w-24 text-center whitespace-nowrap">Duration</th>
                  <th className="py-3 px-3.5 w-36 whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#182133]">
                {loading && filteredPrograms.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 text-xs">
                      <RefreshCw size={22} className="animate-spin mx-auto mb-2 text-cyan-400" />
                      Calculating 24-hour broadcast EPG timeline...
                    </td>
                  </tr>
                ) : filteredPrograms.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500 text-xs">
                      No EPG events found matching the selected filters.
                    </td>
                  </tr>
                ) : (
                  filteredPrograms.map((item) => {
                    const isExpanded = expandedAdIds.has(item.id);
                    const isAdBreak = item.type === 'advertisement' && item.commercials?.length > 0;

                    return (
                      <React.Fragment key={item.id}>
                        <tr
                          className={`transition cursor-pointer ${
                            item.isPlayingNow
                              ? 'bg-emerald-950/25 border-l-4 border-l-emerald-500'
                              : 'hover:bg-[#141b2b]/60'
                          }`}
                          onClick={() => {
                            if (isAdBreak) toggleExpandAd(item.id);
                            else setSelectedProgram(item);
                          }}
                        >
                          {/* 1. Date */}
                          <td className="py-3 px-3.5 whitespace-nowrap font-mono text-slate-300 text-xs">
                            <div className="flex items-center gap-1.5">
                              <Calendar size={12} className="text-slate-500" />
                              <span>{item.date}</span>
                            </div>
                          </td>

                          {/* 2. Start Time */}
                          <td className="py-3 px-3.5 whitespace-nowrap font-mono font-bold text-slate-100 text-xs">
                            <div className="flex items-center gap-1.5">
                              <Clock size={12} className={item.isPlayingNow ? 'text-emerald-400' : 'text-slate-500'} />
                              <span>{item.startTime}</span>
                            </div>
                          </td>

                          {/* 3. Stop Time */}
                          <td className="py-3 px-3.5 whitespace-nowrap font-mono font-medium text-slate-300 text-xs">
                            {item.endTime}
                          </td>

                          {/* 4. Program (Title & Description) */}
                          <td className="py-3 px-3.5 min-w-[300px]">
                            <div className="flex flex-col gap-1">
                              <div className="flex flex-wrap items-center gap-2">
                                {getPriorityBadge(item.priority, item.type)}
                                <span className="text-sm font-bold text-slate-100 hover:text-cyan-300 transition">
                                  {item.title}
                                </span>
                                {item.hasTimerOverlay && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                    Timer Overlay
                                  </span>
                                )}
                                {item.isLive && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/30 animate-pulse">
                                    LIVE
                                  </span>
                                )}
                                {isAdBreak && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30 inline-flex items-center gap-1">
                                    <Megaphone size={10} />
                                    {item.commercials.length} Ads {isExpanded ? '▲' : '▼'}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-400 line-clamp-2">
                                {item.description}
                              </p>
                            </div>
                          </td>

                          {/* 5. Duration */}
                          <td className="py-3 px-3.5 text-center whitespace-nowrap font-mono text-xs font-semibold text-slate-300">
                            {item.durationFormatted}
                          </td>

                          {/* 6. Status */}
                          <td className="py-3 px-3.5 whitespace-nowrap">
                            {getStatusBadge(
                              item.status,
                              item.isPlayingNow,
                              item.progressPercent
                            )}
                          </td>
                        </tr>

                        {/* Expandable Commercial Breakdown Drawer */}
                        {isExpanded && isAdBreak && (
                          <tr className="bg-[#0b0e17] border-b border-[#1b2336]">
                            <td colSpan={6} className="p-3 pl-8">
                              <div className="bg-[#121824] border border-[#222d42] rounded-lg p-3">
                                <h4 className="text-xs font-bold text-amber-300 mb-2 flex items-center gap-1.5">
                                  <Megaphone size={13} />
                                  Commercials Airing in This Break ({item.commercials.length} Ads):
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                  {item.commercials.map((comm) => (
                                    <div
                                      key={comm.index}
                                      className="bg-[#161f30] border border-[#26344d] rounded p-2 flex items-center justify-between text-xs"
                                    >
                                      <div className="flex items-center gap-2 truncate pr-2">
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                          #{comm.index}
                                        </span>
                                        <span className="text-slate-200 truncate font-medium">
                                          {comm.title}
                                        </span>
                                      </div>
                                      <span className="text-slate-400 font-mono text-[11px] shrink-0">
                                        {comm.durationFormatted}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </TableScrollContainer>
        </div>
      )}

      {/* 6. PROGRAM INSPECTOR MODAL (When clicking any card on the timeline) */}
      {selectedProgram && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
          onClick={() => setSelectedProgram(null)}
        >
          <div
            className="w-full max-w-xl bg-[#0f1422] border border-[#26334a] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Top Bar */}
            <div className="p-4 bg-[#141b2c] border-b border-[#212b3e] flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getPriorityBadge(selectedProgram.priority, selectedProgram.type)}
                {selectedProgram.isPlayingNow && (
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse">
                    ON AIR NOW
                  </span>
                )}
              </div>
              <button
                onClick={() => setSelectedProgram(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 flex flex-col gap-4 overflow-y-auto max-h-[75vh]">
              {/* Thumbnail & Title */}
              <div className="flex items-start gap-4">
                {selectedProgram.icon || selectedProgram.asset?.thumbnailPath ? (
                  <img
                    src={selectedProgram.icon ? `/${selectedProgram.icon}` : `/${selectedProgram.asset?.thumbnailPath}`}
                    alt=""
                    className="w-24 h-24 rounded-xl object-cover border border-[#2b3a54] shrink-0 shadow-lg"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                ) : (
                  <div className="w-20 h-20 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                    <Tv size={32} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold text-slate-100 m-0 leading-tight">
                    {selectedProgram.title}
                  </h3>
                  {selectedProgram.subTitle && (
                    <p className="text-xs text-cyan-300 mt-1 m-0">
                      {selectedProgram.subTitle}
                    </p>
                  )}
                  <p className="text-xs text-slate-400 mt-2 line-clamp-3">
                    {selectedProgram.description || 'No detailed broadcast synopsis available for this program.'}
                  </p>
                </div>
              </div>

              {/* Schedule Timings Grid */}
              <div className="grid grid-cols-3 gap-2 bg-[#141b2a] border border-[#232f45] rounded-xl p-3 text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Start Time</span>
                  <span className="text-slate-100 font-bold">{selectedProgram.startTime}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">End Time</span>
                  <span className="text-slate-100 font-bold">{selectedProgram.endTime}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Duration</span>
                  <span className="text-cyan-300 font-bold">{selectedProgram.durationFormatted}</span>
                </div>
              </div>

              {/* Playout Status */}
              {selectedProgram.isPlayingNow && (
                <div className="bg-emerald-950/30 border border-emerald-500/40 rounded-xl p-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-emerald-300 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                      Currently Playout Active
                    </span>
                    <span className="text-emerald-400 font-mono">
                      {selectedProgram.remainingSeconds ? `${formatDuration(selectedProgram.remainingSeconds)} left` : ''}
                    </span>
                  </div>
                  {selectedProgram.progressPercent > 0 && (
                    <div className="w-full bg-[#121824] rounded-full h-2 overflow-hidden border border-emerald-900/50">
                      <div
                        className="bg-emerald-400 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${selectedProgram.progressPercent}%` }}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Commercial Breakdown if Advertisement Break */}
              {selectedProgram.type === 'advertisement' && selectedProgram.commercials?.length > 0 && (
                <div className="bg-[#141b2b] border border-[#232f45] rounded-xl p-3">
                  <h4 className="text-xs font-bold text-amber-300 mb-2.5 flex items-center gap-1.5">
                    <Megaphone size={14} />
                    Commercials in this Break ({selectedProgram.commercials.length} Spots):
                  </h4>
                  <div className="flex flex-col gap-1.5">
                    {selectedProgram.commercials.map((comm) => (
                      <div
                        key={comm.index}
                        className="bg-[#182133] border border-[#28364f] rounded-lg p-2 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2 truncate pr-2">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            #{comm.index}
                          </span>
                          <span className="text-slate-200 truncate font-medium">
                            {comm.title}
                          </span>
                        </div>
                        <span className="text-slate-400 font-mono text-[11px] shrink-0">
                          {comm.durationFormatted}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-[#141b2c] border-t border-[#212b3e] flex justify-end">
              <button
                onClick={() => setSelectedProgram(null)}
                className="px-4 py-1.5 rounded-lg bg-[#1f293d] hover:bg-[#28354e] border border-[#2d3a54] text-xs font-semibold text-slate-200 transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
