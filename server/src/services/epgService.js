import { Playlist, parseTimeToSeconds, PLAYLIST_TYPE } from '../models/playlist.model.js';
import { Schedule } from '../models/schedule.model.js';
import { Channel } from '../models/channel.model.js';
import { Epg } from '../models/epg.model.js';
import { streamManager } from './streaming/streamManager.js';
import { formatDuration } from '../utils/media.js';

export { parseTimeToSeconds };

export const formatSecondsToTime = (totalSeconds) => {
  const s = Math.max(0, Math.floor(totalSeconds)) % 86400;
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

export const escapeXml = (unsafe) => {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

export const toXmltvDate = (dateStr, timeStr) => {
  const cleanDate = String(dateStr).replace(/-/g, '');
  const cleanTime = String(timeStr).replace(/:/g, '');
  return `${cleanDate}${cleanTime} +0000`;
};

/**
 * Calculates 24-hour Micro-Event EPG schedule using Approach B (FAST / Teleshopping Model).
 * Automatically splits programs around commercial breaks into Part 1, Ad Break, and Part 2.
 */
export const calculateMicroEventTimeline = async (channel, targetDate, targetDateObj) => {
  const channelId = channel._id;
  const targetDayOfWeek = targetDateObj.getDay();
  const [year, month, day] = targetDate.split('-').map(Number);

  // Fetch all playlists for this channel populated with asset metadata
  const playlists = await Playlist.find({ channel: channelId })
    .populate('items.asset')
    .lean();

  // Fetch all active calendar schedule broadcasts
  const schedules = await Schedule.find({ channel: channelId, enabled: true })
    .populate('asset')
    .populate('assets')
    .lean();

  const isPlaylistValidForDate = (pl) => {
    if (!pl) return false;
    if (pl.startDate && new Date(pl.startDate) > new Date(year, month - 1, day, 23, 59, 59, 999)) return false;
    if (pl.endDate && new Date(pl.endDate) < new Date(year, month - 1, day, 0, 0, 0, 0)) return false;
    if (Array.isArray(pl.daysOfWeek) && pl.daysOfWeek.length > 0) {
      if (!pl.daysOfWeek.includes(targetDayOfWeek)) return false;
    }
    return true;
  };

  const isScheduleValidForDate = (sc) => {
    if (!sc || sc.enabled === false) return false;
    if (sc.startDate && new Date(sc.startDate) > new Date(year, month - 1, day, 23, 59, 59, 999)) return false;
    if (sc.endDate && new Date(sc.endDate) < new Date(year, month - 1, day, 0, 0, 0, 0)) return false;
    if (Array.isArray(sc.daysOfWeek) && sc.daysOfWeek.length > 0) {
      if (!sc.daysOfWeek.includes(targetDayOfWeek)) return false;
    }
    return true;
  };

  const defaultPlaylist = playlists.find(p => p.type === PLAYLIST_TYPE.DEFAULT && isPlaylistValidForDate(p))
    || playlists.find(p => p.type === PLAYLIST_TYPE.DEFAULT);
  const schedulingPlaylists = playlists.filter(p => p.type === PLAYLIST_TYPE.SCHEDULING && isPlaylistValidForDate(p));
  const livePlaylists = playlists.filter(p => p.type === PLAYLIST_TYPE.LIVE_SCHEDULE && isPlaylistValidForDate(p));
  const adPlaylists = playlists.filter(p => p.type === PLAYLIST_TYPE.ADVERTISEMENT && isPlaylistValidForDate(p));
  const emergencyPlaylists = playlists.filter(p => p.type === PLAYLIST_TYPE.EMERGENCY && isPlaylistValidForDate(p));

  // 1. Prepare Ad Break Intervals (Priority 4)
  const adIntervals = [];

  // 1A. Ads from Advertisement Playlists (Priority 4)
  for (const adPl of adPlaylists) {
    if (!adPl.startTime) continue;
    const startSec = parseTimeToSeconds(adPl.startTime);
    if (startSec === null) continue;

    let totalDuration = 0;
    const commercials = [];
    if (Array.isArray(adPl.items) && adPl.items.length > 0) {
      adPl.items.forEach((it, idx) => {
        const dur = Number(it.asset?.duration) || 30;
        totalDuration += dur;
        commercials.push({
          index: idx + 1,
          title: it.asset?.originalName || `Commercial #${idx + 1}`,
          duration: dur,
          durationFormatted: formatDuration(dur),
          asset: it.asset?._id || null
        });
      });
    }

    let endSec = startSec + Math.max(30, totalDuration || 120);
    if (adPl.endTime) {
      const explicitEnd = parseTimeToSeconds(adPl.endTime);
      if (explicitEnd !== null && explicitEnd > startSec) {
        endSec = explicitEnd;
      }
    }

    adIntervals.push({
      startSec,
      endSec: Math.min(86400, endSec),
      title: adPl.name || 'Commercial Break',
      playlist: adPl,
      commercials,
      totalDuration: Math.max(30, endSec - startSec)
    });
  }

  // 1B. Ads from Schedule model (Calendar ads with priority >= 4 or ad keywords)
  const validSchedules = schedules.filter(isScheduleValidForDate);

  for (const sched of validSchedules) {
    const isAdSchedule = sched.priority >= 4 ||
      (sched.type === 'video' && /ad|advertisement|commercial|promo|break|sponsor/i.test(sched.title || ''));

    if (isAdSchedule) {
      if (!sched.dailyStartTime) continue;
      const startSec = parseTimeToSeconds(sched.dailyStartTime);
      if (startSec === null) continue;

      let dur = Number(sched.duration) || 120;
      let endSec = startSec + dur;
      if (sched.dailyEndTime) {
        const explicitEnd = parseTimeToSeconds(sched.dailyEndTime);
        if (explicitEnd !== null && explicitEnd > startSec) {
          endSec = explicitEnd;
          dur = endSec - startSec;
        }
      }

      const commercials = [];
      const assetList = (Array.isArray(sched.assets) && sched.assets.length > 0)
        ? sched.assets
        : (sched.asset ? [sched.asset] : []);

      assetList.forEach((it, idx) => {
        const aDur = Number(it?.duration) || dur;
        commercials.push({
          index: idx + 1,
          title: it?.originalName || `Ad Spot #${idx + 1}`,
          duration: aDur,
          durationFormatted: formatDuration(aDur),
          asset: it?._id || null
        });
      });

      adIntervals.push({
        startSec,
        endSec: Math.min(86400, endSec),
        title: sched.title || 'Commercial Break',
        commercials,
        totalDuration: dur,
        isFromSchedule: true,
        scheduleId: sched._id
      });
    }
  }

  adIntervals.sort((a, b) => a.startSec - b.startSec);

  // Helper to emit Ad Break micro-events
  const adEvents = [];
  const handledAdSet = new Set();

  const emitAdEvent = (ad) => {
    const adTitle = ad.title || ad.playlist?.name || 'Commercial Break';
    const adDesc = (ad.commercials && ad.commercials.length > 0)
      ? `Commercial break (${ad.commercials.length} ads: ${ad.commercials.map(c => c.title).slice(0, 3).join(', ')}${ad.commercials.length > 3 ? '...' : ''}). Back to show at ${formatSecondsToTime(ad.endSec)}.`
      : `Commercial break. Programming resumes at ${formatSecondsToTime(ad.endSec)}.`;

    adEvents.push({
      title: adTitle,
      description: adDesc,
      startSec: ad.startSec,
      endSec: ad.endSec,
      duration: ad.totalDuration || (ad.endSec - ad.startSec),
      priority: 4,
      type: 'advertisement',
      category: 'Advertisement',
      playlist: ad.playlist?._id || null,
      playlistName: ad.playlist?.name || adTitle || 'Advertisement',
      hasTimerOverlay: Boolean(ad.playlist?.showBackInTimer),
      commercials: ad.commercials || []
    });
  };

  // 2. Prepare Scheduled Fixed-Time Programs (Priority 2 & Regular Calendar Schedules)
  // Simulates sequential playout: when an ad interrupts a video, the video PAUSES and RESUMES,
  // extending its end time so the full video duration is preserved.
  const programIntervals = [];

  // 2A. Process Calendar Schedules
  for (const sched of validSchedules) {
    const isAdSchedule = sched.priority >= 4 ||
      (sched.type === 'video' && /ad|advertisement|commercial|promo|break|sponsor/i.test(sched.title || ''));

    if (isAdSchedule) continue; // Handled in adIntervals

    if (!sched.dailyStartTime) continue;
    const blockStartSec = parseTimeToSeconds(sched.dailyStartTime);
    if (blockStartSec === null) continue;

    const schedAssets = (Array.isArray(sched.assets) && sched.assets.length > 0)
      ? sched.assets
      : (sched.asset ? [sched.asset] : []);

    let explicitDur = Number(sched.duration) || 0;
    if (explicitDur <= 0 && schedAssets.length > 0) {
      explicitDur = schedAssets.reduce((sum, a) => sum + (Number(a?.duration) || 0), 0);
    }
    if (explicitDur <= 0) explicitDur = 1800;

    let blockEndSec = blockStartSec + explicitDur;
    if (sched.dailyEndTime) {
      const explicitEnd = parseTimeToSeconds(sched.dailyEndTime);
      if (explicitEnd !== null && explicitEnd > blockStartSec) {
        blockEndSec = explicitEnd;
      }
    }

    if (schedAssets.length === 0) {
      programIntervals.push({
        startSec: blockStartSec,
        endSec: blockEndSec,
        title: sched.title || 'Scheduled Broadcast',
        description: sched.description || `Calendar event scheduled program (${formatDuration(blockEndSec - blockStartSec)}).`,
        duration: blockEndSec - blockStartSec,
        priority: sched.priority || 2,
        type: 'schedule_event',
        category: 'Special'
      });
      continue;
    }

    let curClock = blockStartSec;
    let assetIdx = 0;
    const repeat = sched.repeatForever !== false;

    while (curClock < blockEndSec && (assetIdx < schedAssets.length || repeat)) {
      const asset = schedAssets[assetIdx % schedAssets.length];
      const assetTitle = asset?.originalName || sched.title || `Scheduled Video #${(assetIdx % schedAssets.length) + 1}`;
      const assetDesc = sched.description || `Calendar event program (${sched.title}).`;
      let remainingDur = Number(asset?.duration) || explicitDur;
      let partNumber = 1;
      let hasBeenSplit = false;

      while (remainingDur > 0 && curClock < blockEndSec) {
        const nextAd = adIntervals.find(ad => ad.startSec < curClock + remainingDur && ad.endSec > curClock);

        if (nextAd) {
          if (nextAd.startSec <= curClock) {
            if (!handledAdSet.has(nextAd)) {
              emitAdEvent(nextAd);
              handledAdSet.add(nextAd);
            }
            curClock = nextAd.endSec;
            continue;
          }

          const played = Math.min(nextAd.startSec - curClock, blockEndSec - curClock);
          if (played > 0) {
            hasBeenSplit = true;
            programIntervals.push({
              startSec: curClock,
              endSec: curClock + played,
              title: `${assetTitle} (Part ${partNumber})`,
              description: `${assetDesc} (Part ${partNumber} — airs until ${formatSecondsToTime(curClock + played)}).`,
              duration: played,
              priority: sched.priority || 2,
              type: 'schedule_event',
              category: 'Special',
              asset: asset?._id || null
            });
            remainingDur -= played;
            curClock += played;
            partNumber++;
          }

          if (curClock >= blockEndSec) break;

          if (!handledAdSet.has(nextAd)) {
            emitAdEvent(nextAd);
            handledAdSet.add(nextAd);
          }
          curClock = nextAd.endSec;
        } else {
          const played = Math.min(remainingDur, blockEndSec - curClock);
          if (played > 0) {
            programIntervals.push({
              startSec: curClock,
              endSec: curClock + played,
              title: hasBeenSplit ? `${assetTitle} (Part ${partNumber})` : assetTitle,
              description: hasBeenSplit
                ? `Resumed from commercial break. Conclusion of ${assetTitle}.`
                : assetDesc,
              duration: played,
              priority: sched.priority || 2,
              type: 'schedule_event',
              category: 'Special',
              asset: asset?._id || null
            });
            remainingDur -= played;
            curClock += played;
          }
        }
      }

      assetIdx++;
    }
  }

  // 2B. Process Scheduled Playlists (Priority 2)
  for (const p2 of schedulingPlaylists) {
    if (!p2.startTime) continue;
    const blockStartSec = parseTimeToSeconds(p2.startTime);
    if (blockStartSec === null) continue;
    let blockEndSec = 86400;
    if (p2.endTime) {
      const explicitEnd = parseTimeToSeconds(p2.endTime);
      if (explicitEnd !== null && explicitEnd > blockStartSec) {
        blockEndSec = explicitEnd;
      }
    }

    const items = Array.isArray(p2.items) ? p2.items : [];
    if (items.length === 0) {
      programIntervals.push({
        startSec: blockStartSec,
        endSec: blockEndSec,
        title: p2.name,
        description: `Scheduled programming block (${p2.name}).`,
        duration: blockEndSec - blockStartSec,
        priority: 2,
        type: 'scheduling',
        category: 'Entertainment',
        playlist: p2._id,
        playlistName: p2.name
      });
      continue;
    }

    let curClock = blockStartSec;
    let itemIdx = 0;

    while (curClock < blockEndSec && (itemIdx < items.length || p2.loop)) {
      const item = items[itemIdx % items.length];
      const itemTitle = item?.asset?.originalName || `${p2.name} - Item #${(itemIdx % items.length) + 1}`;
      const itemDesc = `Scheduled program item #${(itemIdx % items.length) + 1} from ${p2.name}.`;
      let remainingDur = Number(item?.asset?.duration) || 1200;
      let partNumber = 1;
      let hasBeenSplit = false;

      while (remainingDur > 0 && curClock < blockEndSec) {
        const nextAd = adIntervals.find(ad => ad.startSec < curClock + remainingDur && ad.endSec > curClock);

        if (nextAd) {
          if (nextAd.startSec <= curClock) {
            if (!handledAdSet.has(nextAd)) {
              emitAdEvent(nextAd);
              handledAdSet.add(nextAd);
            }
            curClock = nextAd.endSec;
            continue;
          }

          const played = Math.min(nextAd.startSec - curClock, blockEndSec - curClock);
          if (played > 0) {
            hasBeenSplit = true;
            programIntervals.push({
              startSec: curClock,
              endSec: curClock + played,
              title: `${itemTitle} (Part ${partNumber})`,
              description: `${itemDesc} (Part ${partNumber} — airs until ${formatSecondsToTime(curClock + played)}).`,
              duration: played,
              priority: 2,
              type: 'scheduling',
              category: 'Movie',
              playlist: p2._id,
              playlistName: p2.name,
              asset: item?.asset?._id || null
            });
            remainingDur -= played;
            curClock += played;
            partNumber++;
          }

          if (curClock >= blockEndSec) break;

          if (!handledAdSet.has(nextAd)) {
            emitAdEvent(nextAd);
            handledAdSet.add(nextAd);
          }
          curClock = nextAd.endSec;
        } else {
          const played = Math.min(remainingDur, blockEndSec - curClock);
          if (played > 0) {
            programIntervals.push({
              startSec: curClock,
              endSec: curClock + played,
              title: hasBeenSplit ? `${itemTitle} (Part ${partNumber})` : itemTitle,
              description: hasBeenSplit
                ? `Resumed from commercial break. Conclusion of ${itemTitle}.`
                : itemDesc,
              duration: played,
              priority: 2,
              type: 'scheduling',
              category: 'Movie',
              playlist: p2._id,
              playlistName: p2.name,
              asset: item?.asset?._id || null
            });
            remainingDur -= played;
            curClock += played;
          }
        }
      }

      itemIdx++;
    }
  }

  // 3. Prepare Live Schedule Ingests (Priority 3)
  const liveIntervals = [];
  for (const live of livePlaylists) {
    if (!live.startTime) continue;
    const startSec = parseTimeToSeconds(live.startTime);
    if (startSec === null) continue;
    let endSec = startSec + 7200;
    if (live.endTime) {
      const explicitEnd = parseTimeToSeconds(live.endTime);
      if (explicitEnd !== null && explicitEnd > startSec) {
        endSec = explicitEnd;
      }
    }
    liveIntervals.push({
      startSec,
      endSec: Math.min(86400, endSec),
      title: `LIVE: ${live.name}`,
      description: `Live remote broadcast relay. Ingest Source: ${live.liveSourceUrl || 'OB Van / Live Ingest'}`,
      duration: endSec - startSec,
      priority: 3,
      type: 'live_schedule',
      category: 'Sports',
      isLive: true,
      playlist: live._id,
      playlistName: live.name
    });
  }

  // 4. Include any standalone Ad Breaks that do not intersect any scheduled show
  for (const ad of adIntervals) {
    if (!handledAdSet.has(ad)) {
      emitAdEvent(ad);
      handledAdSet.add(ad);
    }
  }

  // 5. Combine all micro-events (Scheduled Programs, Ads, Live Relays)
  // NOTE: Default playlist (Priority 1) is intentionally excluded from EPG storage per requirement.
  const finalMicroEvents = [...programIntervals, ...adEvents, ...liveIntervals];

  // 7. Emergency (P5) Alert Overlay
  if (emergencyPlaylists.some(p => p.isActive)) {
    const emPl = emergencyPlaylists.find(p => p.isActive);
    finalMicroEvents.unshift({
      title: '*** EMERGENCY BROADCAST ALERT ***',
      description: `High-priority station alert: ${emPl.name}. Regular programming is paused.`,
      startSec: 0,
      endSec: 86400,
      duration: 86400,
      priority: 5,
      type: 'emergency',
      category: 'Emergency',
      playlist: emPl._id,
      playlistName: emPl.name
    });
  }

  return finalMicroEvents
    .filter(ev => ev.endSec > ev.startSec && ev.type !== 'default' && ev.priority > 1)
    .sort((a, b) => a.startSec - b.startSec);
};

/**
 * Syncs and persists calculated timeline events into the MongoDB EPG model collection.
 * Completely purges stale records and inserts fresh sliced micro-events.
 */
export const syncAndPersistChannelEpg = async (channel, targetDate, targetDateObj) => {
  const microEvents = await calculateMicroEventTimeline(channel, targetDate, targetDateObj);

  // Preserve any custom operator overrides
  const existingCustom = await Epg.find({ channel: channel._id, date: targetDate, isCustom: true }).lean();
  const customMap = new Map(existingCustom.map(c => [c.startSeconds, c]));

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const isTargetToday = targetDate === todayStr;
  const currentSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();

  const docsToInsert = microEvents.map((ev) => {
    const custom = customMap.get(ev.startSec);
    const title = custom?.program?.title || ev.title;
    const description = custom?.program?.description || ev.description;
    const category = custom?.program?.category || ev.category || 'General';

    const startTime = formatSecondsToTime(ev.startSec);
    const endTime = formatSecondsToTime(ev.endSec);
    const duration = ev.duration || (ev.endSec - ev.startSec);

    let status = 'QUEUED';
    if (!isTargetToday) {
      status = targetDate < todayStr ? 'PLAYED' : 'QUEUED';
    } else {
      if (currentSec >= ev.startSec && currentSec < ev.endSec) {
        status = 'PLAYING';
      } else if (currentSec >= ev.endSec) {
        status = 'PLAYED';
      } else {
        status = 'QUEUED';
      }
    }

    return {
      channel: channel._id,
      date: targetDate,
      startTime,
      endTime,
      startSeconds: ev.startSec,
      endSeconds: ev.endSec,
      duration,
      durationFormatted: formatDuration(duration),
      program: {
        title,
        description,
        category,
        subTitle: custom?.program?.subTitle || '',
        genre: custom?.program?.genre || '',
        rating: custom?.program?.rating || 'G',
        icon: custom?.program?.icon || '',
        episode: custom?.program?.episode || ''
      },
      priority: ev.priority || 1,
      type: ev.type || 'default',
      playlist: ev.playlist || null,
      playlistName: ev.playlistName || '',
      asset: ev.asset || null,
      commercials: Array.isArray(ev.commercials) ? ev.commercials : [],
      hasTimerOverlay: !!ev.hasTimerOverlay,
      isLive: !!ev.isLive,
      isCustom: !!custom,
      isPublished: true,
      status
    };
  });

  // Remove existing non-custom records for this channel & date, and purge any default playlist records
  await Epg.deleteMany({ channel: channel._id, date: targetDate, isCustom: { $ne: true } });
  await Epg.deleteMany({ channel: channel._id, type: 'default' });

  if (docsToInsert.length > 0) {
    await Epg.insertMany(docsToInsert);
  }

  return Epg.find({ channel: channel._id, date: targetDate, type: { $ne: 'default' } })
    .sort({ startSeconds: 1 })
    .lean();
};

/**
 * Automatically regenerates and persists EPG records for a channel when playlists/schedules change.
 * Slices timeline into micro-events (Approach B) including Part 1, Ad Break, Part 2.
 * @param {string|ObjectId} channelId
 * @param {Array<string|Date>|string|Date|null} [extraDates] - Optional dates to sync in addition to today
 */
export const autoSyncChannelEpg = async (channelId, extraDates = null) => {
  if (!channelId) return;
  try {
    const channel = await Channel.findById(channelId).lean();
    if (!channel) return;

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const datesToSync = new Set([todayStr]);

    if (extraDates) {
      const list = Array.isArray(extraDates) ? extraDates : [extraDates];
      for (const d of list) {
        if (!d) continue;
        if (typeof d === 'string') {
          const match = d.match(/^\d{4}-\d{2}-\d{2}/);
          if (match) datesToSync.add(match[0]);
        } else if (d instanceof Date && !isNaN(d.getTime())) {
          const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          datesToSync.add(ds);
        }
      }
    }

    for (const dStr of datesToSync) {
      const [year, month, day] = dStr.split('-').map(Number);
      const targetDateObj = new Date(year, month - 1, day, 0, 0, 0);
      await syncAndPersistChannelEpg(channel, dStr, targetDateObj);
    }
  } catch (err) {
    console.warn(`[EPG autoSyncChannelEpg channel: ${channelId}]`, err.message);
  }
};

/**
 * Main Service API: Retrieves channel EPG for targetDate, leveraging the Epg Mongoose model.
 */
export const generateChannelEpg = async (channelId, targetDateStr = null, forceSync = false) => {
  const channel = await Channel.findById(channelId).lean();
  if (!channel) {
    throw new Error('Channel not found');
  }

  const now = new Date();
  let targetDate = targetDateStr;
  if (!targetDate || typeof targetDate !== 'string') {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    targetDate = `${y}-${m}-${d}`;
  }

  const [year, month, day] = targetDate.split('-').map(Number);
  const targetDateObj = new Date(year, month - 1, day, 0, 0, 0);

  // Check if EPG entries exist in MongoDB Epg collection (excluding default playlist)
  let epgRecords = await Epg.find({ channel: channelId, date: targetDate, type: { $ne: 'default' } })
    .sort({ startSeconds: 1 })
    .lean();

  // If no records in MongoDB yet, or forceSync requested, calculate and persist them automatically
  if (epgRecords.length === 0 || forceSync) {
    epgRecords = await syncAndPersistChannelEpg(channel, targetDate, targetDateObj);
  }

  // Calculate real-time status (PLAYING / PLAYED / QUEUED) against the live clock
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const isTargetToday = targetDate === todayStr;
  const currentSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();

  const formattedPrograms = epgRecords.map((doc) => {
    let status = 'QUEUED';
    let isPlayingNow = false;
    let progressPercent = 0;
    let elapsedSeconds = 0;
    let remainingSeconds = doc.duration;

    if (!isTargetToday) {
      status = targetDate < todayStr ? 'PLAYED' : 'QUEUED';
    } else {
      if (currentSec >= doc.startSeconds && currentSec < doc.endSeconds) {
        status = 'PLAYING';
        isPlayingNow = true;
        elapsedSeconds = Math.max(0, currentSec - doc.startSeconds);
        remainingSeconds = Math.max(0, doc.endSeconds - currentSec);
        progressPercent = Math.min(100, Math.round((elapsedSeconds / doc.duration) * 100));
      } else if (currentSec >= doc.endSeconds) {
        status = 'PLAYED';
        progressPercent = 100;
      } else {
        status = 'QUEUED';
        progressPercent = 0;
      }
    }

    return {
      id: String(doc._id),
      _id: doc._id,
      date: doc.date,
      startTime: doc.startTime,
      endTime: doc.endTime,
      startSeconds: doc.startSeconds,
      endSeconds: doc.endSeconds,
      duration: doc.duration,
      durationFormatted: doc.durationFormatted,
      title: doc.program?.title || 'Program',
      subTitle: doc.program?.subTitle || '',
      description: doc.program?.description || '',
      category: doc.program?.category || 'General',
      genre: doc.program?.genre || '',
      rating: doc.program?.rating || 'G',
      icon: doc.program?.icon || '',
      episode: doc.program?.episode || '',
      priority: doc.priority,
      type: doc.type,
      playlist: doc.playlist,
      playlistName: doc.playlistName,
      asset: doc.asset,
      commercials: doc.commercials || [],
      hasTimerOverlay: doc.hasTimerOverlay,
      isLive: doc.isLive,
      isCustom: doc.isCustom,
      status,
      isPlayingNow,
      progressPercent,
      elapsedSeconds,
      remainingSeconds
    };
  });

  return {
    channel: {
      id: channel._id,
      name: channel.name,
      logoUrl: channel.logoUrl || null,
      status: channel.status
    },
    date: targetDate,
    totalEvents: formattedPrograms.length,
    programs: formattedPrograms
  };
};

/**
 * Generates an XMLTV compliant XML feed for standard IPTV / OTT applications.
 */
export const generateChannelXmltv = (epgData) => {
  const { channel, programs } = epgData;
  const channelIdStr = `channel-${channel.id}`;

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<!DOCTYPE tv SYSTEM "xmltv.dtd">\n';
  xml += '<tv generator-info-name="Antigravity Broadcast Playout Engine" generator-info-url="https://antigravity.tv">\n';

  // Channel Definition
  xml += `  <channel id="${escapeXml(channelIdStr)}">\n`;
  xml += `    <display-name lang="en">${escapeXml(channel.name)}</display-name>\n`;
  if (channel.logoUrl) {
    xml += `    <icon src="${escapeXml(channel.logoUrl)}" />\n`;
  }
  xml += '  </channel>\n';

  // Micro-Event Programmes
  programs.forEach((prog) => {
    const startXmlDate = toXmltvDate(prog.date, prog.startTime);
    const stopXmlDate = toXmltvDate(prog.date, prog.endTime);

    xml += `  <programme start="${startXmlDate}" stop="${stopXmlDate}" channel="${escapeXml(channelIdStr)}">\n`;
    xml += `    <title lang="en">${escapeXml(prog.title)}</title>\n`;
    if (prog.subTitle) {
      xml += `    <sub-title lang="en">${escapeXml(prog.subTitle)}</sub-title>\n`;
    }
    if (prog.description) {
      xml += `    <desc lang="en">${escapeXml(prog.description)}</desc>\n`;
    }
    xml += `    <category lang="en">${escapeXml(prog.category || 'General')}</category>\n`;
    if (prog.icon) {
      xml += `    <icon src="${escapeXml(prog.icon)}" />\n`;
    }
    if (prog.rating) {
      xml += '    <rating system="MPAA">\n';
      xml += `      <value>${escapeXml(prog.rating)}</value>\n`;
      xml += '    </rating>\n';
    }
    xml += '  </programme>\n';
  });

  xml += '</tv>\n';
  return xml;
};
