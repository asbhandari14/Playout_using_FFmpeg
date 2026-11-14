import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  ChevronUp
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
    activeChannelId || (channels[0]?._id ? String(channels[0]._id) : '')
  );
  const [selectedDate, setSelectedDate] = useState(getTodayStr());
  const [epgData, setEpgData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [expandedAdIds, setExpandedAdIds] = useState(new Set());
  const [autoPoll, setAutoPoll] = useState(true);

  // Sync with prop when channels load
  useEffect(() => {
    if (!selectedChannelId && channels.length > 0) {
      setSelectedChannelId(String(channels[0]._id));
    }
  }, [channels, selectedChannelId]);

  // Fetch EPG data from API
  const fetchEpg = useCallback(async (channelId, dateStr, isSilent = false, forceRefresh = false) => {
    if (!channelId) return;
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

  // Initial & channel/date change fetch
  useEffect(() => {
    if (selectedChannelId) {
      fetchEpg(selectedChannelId, selectedDate, false);
    }
  }, [selectedChannelId, selectedDate, fetchEpg]);

  // Periodic polling for real-time status updates every 4 seconds
  useEffect(() => {
    if (!autoPoll || !selectedChannelId) return;
    const interval = setInterval(() => {
      fetchEpg(selectedChannelId, selectedDate, true);
    }, 4000);
    return () => clearInterval(interval);
  }, [autoPoll, selectedChannelId, selectedDate, fetchEpg]);

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
    if (!selectedChannelId) return;
    const url = `/api/v1/channels/${selectedChannelId}/epg.xml?date=${selectedDate}`;
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `epg-${selectedChannelId}-${selectedDate}.xml`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    toast.success('Downloading XMLTV feed');
  };

  const handleCopyXmltvLink = () => {
    if (!selectedChannelId) return;
    const origin = window.location.origin;
    const fullUrl = `${origin}/api/v1/channels/${selectedChannelId}/epg.xml?date=${selectedDate}`;
    navigator.clipboard.writeText(fullUrl).then(() => {
      toast.success('XMLTV URL copied to clipboard');
    }).catch(() => {
      toast.error('Could not copy link');
    });
  };

  // Filtered Programs
  const filteredPrograms = useMemo(() => {
    const list = epgData?.programs || [];
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
  }, [epgData, typeFilter, searchFilter]);

  // Priority Styling helper
  const getPriorityBadge = (priority, type) => {
    switch (priority) {
      case 5:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse">
            <AlertTriangle size={12} />
            P5 EMERGENCY
          </span>
        );
      case 4:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
            <Megaphone size={12} />
            P4 AD BREAK
          </span>
        );
      case 3:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-red-500/20 text-red-300 border border-red-500/40">
            <Radio size={12} />
            P3 LIVE
          </span>
        );
      case 2:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
            <Film size={12} />
            P2 SCHEDULE
          </span>
        );
      case 1:
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
            <Layers size={12} />
            P1 DEFAULT
          </span>
        );
    }
  };

  // Status Styling helper
  const getStatusBadge = (status, isPlayingNow, progressPercent = 0, remainingFormatted = '') => {
    if (isPlayingNow || status === 'PLAYING') {
      return (
        <div className="flex flex-col items-start gap-1">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-[0_0_12px_rgba(16,185,129,0.35)] animate-pulse">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            PLAYING NOW
          </span>
          {progressPercent > 0 && (
            <div className="w-28 bg-[#1a2234] rounded-full h-1.5 overflow-hidden border border-[#2b354d]">
              <div
                className="bg-emerald-400 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          )}
        </div>
      );
    }
    if (status === 'PLAYED') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
          <CheckCircle2 size={12} />
          PLAYED
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-sky-950/60 text-sky-400 border border-sky-800/60">
        <Clock size={12} />
        QUEUED
      </span>
    );
  };

  const activeChannel = channels.find(c => String(c._id) === String(selectedChannelId));
  const isToday = selectedDate === getTodayStr();

  // Stats calculation
  const totalCommercialSec = useMemo(() => {
    return (epgData?.programs || [])
      .filter(p => p.type === 'advertisement')
      .reduce((sum, p) => sum + (p.duration || 0), 0);
  }, [epgData]);

  return (
    <div className="flex flex-col gap-4 font-mono select-none">
      {/* 1. Header & Controls Toolbar */}
      <div className="bg-[#0f1420] border border-[#1e2638] rounded-xl p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4 shadow-lg">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Tv size={18} />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-100 flex items-center gap-2">
                Electronic Programme Guide (EPG)
                <span className="text-[10px] font-normal px-2 py-0.5 rounded bg-[#182133] border border-[#26324d] text-cyan-400 uppercase tracking-wider">
                  FAST Micro-Events
                </span>
              </h1>
              <p className="text-xs text-slate-400">
                Timeline schedule, program segments, and commercial break guide
              </p>
            </div>
          </div>
        </div>

        {/* Channel Selector & Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Channel Dropdown */}
          <div className="relative min-w-[200px]">
            <select
              value={selectedChannelId}
              onChange={(e) => setSelectedChannelId(e.target.value)}
              className="w-full bg-[#141b2b] border border-[#253047] rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500 transition cursor-pointer"
            >
              {channels.map((ch) => (
                <option key={ch._id} value={ch._id}>
                  {ch.name} {ch.status === 'online' ? '● (LIVE)' : ''}
                </option>
              ))}
            </select>
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
            <span className="hidden sm:inline">Copy Feed</span>
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

      {/* 2. Date Navigation & Summary Stats Bar */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
        {/* Date Selector (Left) */}
        <div className="md:col-span-6 lg:col-span-5 bg-[#0f1420] border border-[#1e2638] rounded-xl p-2.5 flex items-center justify-between gap-2 shadow">
          <button
            onClick={() => shiftDate(-1)}
            className="p-1.5 rounded-lg bg-[#141b2b] hover:bg-[#1a2338] border border-[#253047] text-slate-300 hover:text-white transition"
            title="Previous Day"
          >
            <ChevronLeft size={16} />
          </button>

          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-cyan-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent border-0 text-xs font-mono font-bold text-slate-100 focus:outline-none cursor-pointer"
            />
            {isToday && (
              <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Today
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {!isToday && (
              <button
                onClick={handleResetToday}
                className="text-[11px] px-2 py-1 rounded bg-[#141b2b] hover:bg-[#1a2338] border border-[#253047] text-slate-300 hover:text-cyan-400 transition"
              >
                Today
              </button>
            )}
            <button
              onClick={() => shiftDate(1)}
              className="p-1.5 rounded-lg bg-[#141b2b] hover:bg-[#1a2338] border border-[#253047] text-slate-300 hover:text-white transition"
              title="Next Day"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Quick Stats (Right) */}
        <div className="md:col-span-6 lg:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className="bg-[#0f1420] border border-[#1e2638] rounded-xl p-2.5 flex flex-col justify-center">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Total Shows</span>
            <span className="text-sm font-bold text-slate-100">{epgData?.totalEvents || 0} Events</span>
          </div>

          <div className="bg-[#0f1420] border border-[#1e2638] rounded-xl p-2.5 flex flex-col justify-center">
            <span className="text-[10px] text-emerald-400 uppercase tracking-wider font-semibold">On Air</span>
            <span className="text-sm font-bold text-emerald-300">
              {epgData?.activeProgramsCount || 0} Active
            </span>
          </div>

          <div className="bg-[#0f1420] border border-[#1e2638] rounded-xl p-2.5 flex flex-col justify-center">
            <span className="text-[10px] text-sky-400 uppercase tracking-wider font-semibold">Upcoming</span>
            <span className="text-sm font-bold text-sky-300">{epgData?.queuedCount || 0} Queued</span>
          </div>

          <div className="bg-[#0f1420] border border-[#1e2638] rounded-xl p-2.5 flex flex-col justify-center">
            <span className="text-[10px] text-amber-400 uppercase tracking-wider font-semibold">Ad Airtime</span>
            <span className="text-sm font-bold text-amber-300">
              {Math.floor(totalCommercialSec / 60)}m {totalCommercialSec % 60}s
            </span>
          </div>
        </div>
      </div>

      {/* 3. Search & Category Filters */}
      <div className="bg-[#0f1420] border border-[#1e2638] rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3 shadow">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search programs, movies, sponsors..."
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

      {/* 4. Main Micro-Event EPG Table */}
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
                            item.progressPercent,
                            item.remainingSeconds ? formatDuration(item.remainingSeconds) : ''
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
    </div>
  );
}
