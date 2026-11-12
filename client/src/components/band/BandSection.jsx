import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import api from '../../api/axios.js';
import BandTable from './BandTable.jsx';
import BandForm from './BandForm.jsx';
import BandPresetForm from './BandPresetForm.jsx';
import ConfirmDeleteModal from '../modals/ConfirmDeleteModal.jsx';

export default function BandSection({
  type = 'lband', // 'lband' | 'ashton'
  channels = [],
  currentUser = null
}) {
  const isLBand = type === 'lband';
  const bandLabel = isLBand ? 'L-Band' : 'Ashton Band';

  const [selectedChannelId, setSelectedChannelId] = useState(channels[0]?._id || '');
  const [activeTab, setActiveTab] = useState('bands'); // 'bands' | 'schedules'
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'create_band' | 'edit_band' | 'create_schedule' | 'edit_schedule'
  const [editingBand, setEditingBand] = useState(null);
  const [editingSchedule, setEditingSchedule] = useState(null);

  const [bands, setBands] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [firingId, setFiringId] = useState(null);

  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    kind: 'band', // 'band' | 'schedule'
    item: null
  });

  useEffect(() => {
    if (!selectedChannelId && channels.length > 0) {
      setSelectedChannelId(channels[0]._id);
    }
  }, [channels, selectedChannelId]);

  const fetchData = useCallback(async () => {
    if (!selectedChannelId) return;
    setIsLoading(true);
    try {
      const [bandsRes, schedRes] = await Promise.all([
        api.get(`/channels/${selectedChannelId}/bands?type=${type}`),
        api.get(`/channels/${selectedChannelId}/schedules?type=${type}`)
      ]);
      setBands(Array.isArray(bandsRes.data) ? bandsRes.data : []);
      setSchedules(Array.isArray(schedRes.data) ? schedRes.data : []);
    } catch (err) {
      console.error(`[BandSection] Error fetching ${type} data:`, err);
      toast.error(`Failed to load ${bandLabel} library & schedules`);
    } finally {
      setIsLoading(false);
    }
  }, [selectedChannelId, type, bandLabel]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Create or Update Band Preset
  const handleSubmitBand = async ({ channelId, bandId, formData }) => {
    setIsSubmitting(true);
    const targetChannel = channelId || selectedChannelId;
    try {
      if (bandId) {
        await api.put(`/channels/${targetChannel}/bands/${bandId}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        toast.success(`${bandLabel} updated successfully`);
      } else {
        await api.post(`/channels/${targetChannel}/bands`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        toast.success(`${bandLabel} created successfully`);
      }
      if (targetChannel !== selectedChannelId) {
        setSelectedChannelId(targetChannel);
      }
      setViewMode('list');
      setActiveTab('bands');
      setEditingBand(null);
      fetchData();
    } catch (err) {
      console.error('[BandSection] Save band error:', err);
      toast.error(err.response?.data?.message || `Failed to save ${bandLabel}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Create or Update Schedule linked to a Band Preset
  const handleSubmitSchedule = async ({ channelId, scheduleId, payload }) => {
    setIsSubmitting(true);
    const targetChannel = channelId || selectedChannelId;
    try {
      if (scheduleId) {
        await api.put(`/channels/${targetChannel}/schedules/${scheduleId}`, payload);
        toast.success('Schedule updated successfully');
      } else {
        await api.post(`/channels/${targetChannel}/schedules`, payload);
        toast.success('Schedule created successfully');
      }
      if (targetChannel !== selectedChannelId) {
        setSelectedChannelId(targetChannel);
      }
      setViewMode('list');
      setActiveTab('schedules');
      setEditingSchedule(null);
      fetchData();
    } catch (err) {
      console.error('[BandSection] Save schedule error:', err);
      toast.error(err.response?.data?.message || 'Failed to save schedule');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleScheduleStatus = async (item) => {
    try {
      await api.patch(`/channels/${selectedChannelId}/schedules/${item._id}/toggle`);
      setSchedules((prev) =>
        prev.map((s) => (s._id === item._id ? { ...s, enabled: !s.enabled } : s))
      );
      toast.success(`${item.title} ${!item.enabled ? 'enabled' : 'disabled'}`);
    } catch (err) {
      console.error('[BandSection] Toggle error:', err);
      toast.error('Failed to toggle schedule status');
    }
  };

  const handleFireBandLive = async (band) => {
    setFiringId(band._id);
    try {
      const res = await api.post(`/channels/${selectedChannelId}/bands/${band._id}/play-now`);
      toast.success(res.data?.message || `${band.title} triggered live on air!`);
    } catch (err) {
      console.error('[BandSection] Fire band error:', err);
      toast.error(err.response?.data?.message || `Failed to fire ${bandLabel} live`);
    } finally {
      setFiringId(null);
    }
  };

  const handleFireScheduleLive = async (item) => {
    setFiringId(item._id);
    try {
      const res = await api.post(`/channels/${selectedChannelId}/schedules/${item._id}/play-now`);
      toast.success(res.data?.message || `${item.title} triggered live on air!`);
    } catch (err) {
      console.error('[BandSection] Fire schedule error:', err);
      toast.error(err.response?.data?.message || 'Failed to trigger schedule live');
    } finally {
      setFiringId(null);
    }
  };

  const confirmDelete = async () => {
    const { item, kind } = deleteModal;
    if (!item) return;
    try {
      if (kind === 'band') {
        await api.delete(`/channels/${selectedChannelId}/bands/${item._id}`);
        setBands((prev) => prev.filter((b) => b._id !== item._id));
        toast.success(`${item.title} deleted successfully`);
      } else {
        await api.delete(`/channels/${selectedChannelId}/schedules/${item._id}`);
        setSchedules((prev) => prev.filter((s) => s._id !== item._id));
        toast.success(`${item.title} deleted successfully`);
      }
      fetchData();
    } catch (err) {
      console.error('[BandSection] Delete error:', err);
      toast.error(`Failed to delete ${kind === 'band' ? bandLabel : 'schedule'}`);
    } finally {
      setDeleteModal({ isOpen: false, kind: 'band', item: null });
    }
  };

  const selectedChannel = channels.find((c) => c._id === selectedChannelId) || channels[0];

  if (viewMode === 'create_band' || viewMode === 'edit_band') {
    return (
      <BandPresetForm
        type={type}
        initialData={editingBand}
        channel={selectedChannel}
        channels={channels}
        currentUser={currentUser}
        onSubmit={handleSubmitBand}
        onCancel={() => {
          setViewMode('list');
          setEditingBand(null);
        }}
        isSubmitting={isSubmitting}
      />
    );
  }

  if (viewMode === 'create_schedule' || viewMode === 'edit_schedule') {
    return (
      <BandForm
        type={type}
        bands={bands}
        initialData={editingSchedule}
        channel={selectedChannel}
        channels={channels}
        currentUser={currentUser}
        onSubmit={handleSubmitSchedule}
        onCreateBandShortcut={() => {
          setEditingSchedule(null);
          setEditingBand(null);
          setViewMode('create_band');
        }}
        onCancel={() => {
          setViewMode('list');
          setEditingSchedule(null);
        }}
        isSubmitting={isSubmitting}
      />
    );
  }

  return (
    <>
      <BandTable
        type={type}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        bands={bands}
        schedules={schedules}
        channels={channels}
        selectedChannelId={selectedChannelId}
        onSelectChannel={(chId) => setSelectedChannelId(chId)}
        currentUser={currentUser}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onCreateBand={() => {
          setEditingBand(null);
          setViewMode('create_band');
        }}
        onEditBand={(band) => {
          setEditingBand(band);
          setViewMode('edit_band');
        }}
        onDeleteBand={(band) => setDeleteModal({ isOpen: true, kind: 'band', item: band })}
        onFireBandLive={handleFireBandLive}
        onCreateSchedule={() => {
          setEditingSchedule(null);
          setViewMode('create_schedule');
        }}
        onEditSchedule={(sched) => {
          setEditingSchedule(sched);
          setViewMode('edit_schedule');
        }}
        onDeleteSchedule={(sched) => setDeleteModal({ isOpen: true, kind: 'schedule', item: sched })}
        onToggleScheduleStatus={handleToggleScheduleStatus}
        onFireScheduleLive={handleFireScheduleLive}
        firingId={firingId}
        isLoading={isLoading}
      />

      <ConfirmDeleteModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, kind: 'band', item: null })}
        onConfirm={confirmDelete}
        title={deleteModal.kind === 'band' ? `Delete ${bandLabel}` : `Delete ${bandLabel} Schedule`}
        itemName={deleteModal.item?.title || ''}
        message={
          deleteModal.kind === 'band'
            ? `Are you sure you want to delete "${deleteModal.item?.title}"? Existing schedules linked to it will keep their cached settings.`
            : `Are you sure you want to delete schedule "${deleteModal.item?.title}"?`
        }
        confirmText="Confirm Delete"
      />
    </>
  );
}
