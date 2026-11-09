import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import api from '../../api/axios.js';
import BandTable from './BandTable.jsx';
import BandForm from './BandForm.jsx';
import ConfirmDeleteModal from '../modals/ConfirmDeleteModal.jsx';

export default function BandSection({
  type = 'lband', // 'lband' | 'ashton'
  channels = [],
  currentUser = null
}) {
  const [selectedChannelId, setSelectedChannelId] = useState(
    channels[0]?._id || ''
  );
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'create' | 'edit'
  const [editingBand, setEditingBand] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [firingId, setFiringId] = useState(null);

  // Delete modal state
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    item: null
  });

  // Ensure selectedChannelId syncs if channels load
  useEffect(() => {
    if (!selectedChannelId && channels.length > 0) {
      setSelectedChannelId(channels[0]._id);
    }
  }, [channels, selectedChannelId]);

  // Fetch schedules for selected channel and type
  const fetchSchedules = useCallback(async () => {
    if (!selectedChannelId) return;
    setIsLoading(true);
    try {
      const res = await api.get(`/channels/${selectedChannelId}/schedules?type=${type}`);
      const data = Array.isArray(res.data) ? res.data : [];
      setSchedules(data);
    } catch (err) {
      console.error(`[BandSection] Error fetching ${type} schedules:`, err);
      toast.error(`Failed to load ${type === 'lband' ? 'L-Band' : 'Ashton Band'} schedules`);
    } finally {
      setIsLoading(false);
    }
  }, [selectedChannelId, type]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  // Handle Create or Update submission
  const handleSubmitForm = async ({ channelId, scheduleId, formData }) => {
    setIsSubmitting(true);
    const targetChannel = channelId || selectedChannelId;
    try {
      if (scheduleId) {
        // Update
        await api.put(`/channels/${targetChannel}/schedules/${scheduleId}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        toast.success(`${type === 'lband' ? 'L-Band' : 'Ashton Band'} updated successfully`);
      } else {
        // Create
        await api.post(`/channels/${targetChannel}/schedules`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        toast.success(`${type === 'lband' ? 'L-Band' : 'Ashton Band'} created successfully`);
      }
      setViewMode('list');
      setEditingBand(null);
      fetchSchedules();
    } catch (err) {
      console.error('[BandSection] Submit error:', err);
      toast.error(err.response?.data?.message || 'Failed to save schedule');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle active status
  const handleToggleStatus = async (item) => {
    try {
      await api.patch(`/channels/${selectedChannelId}/schedules/${item._id}/toggle`);
      setSchedules((prev) =>
        prev.map((s) => (s._id === item._id ? { ...s, enabled: !s.enabled } : s))
      );
      toast.success(`${item.title} ${!item.enabled ? 'activated' : 'deactivated'}`);
    } catch (err) {
      console.error('[BandSection] Toggle error:', err);
      toast.error('Failed to toggle status');
    }
  };

  // Quick Play / Fire Live on Air
  const handleFireLive = async (item) => {
    setFiringId(item._id);
    try {
      const res = await api.post(`/channels/${selectedChannelId}/schedules/${item._id}/play-now`);
      toast.success(res.data?.message || `${item.title} triggered live on air!`);
    } catch (err) {
      console.error('[BandSection] Fire Live error:', err);
      toast.error(err.response?.data?.message || 'Failed to trigger overlay on air');
    } finally {
      setFiringId(null);
    }
  };

  // Delete flow
  const promptDelete = (item) => {
    setDeleteModal({ isOpen: true, item });
  };

  const confirmDelete = async () => {
    const item = deleteModal.item;
    if (!item) return;
    try {
      await api.delete(`/channels/${selectedChannelId}/schedules/${item._id}`);
      setSchedules((prev) => prev.filter((s) => s._id !== item._id));
      toast.success(`${item.title} deleted successfully`);
    } catch (err) {
      console.error('[BandSection] Delete error:', err);
      toast.error('Failed to delete schedule');
    } finally {
      setDeleteModal({ isOpen: false, item: null });
    }
  };

  const selectedChannel = channels.find((c) => c._id === selectedChannelId) || channels[0];

  if (viewMode === 'create' || viewMode === 'edit') {
    return (
      <BandForm
        type={type}
        initialData={editingBand}
        channel={selectedChannel}
        channels={channels}
        currentUser={currentUser}
        onSubmit={handleSubmitForm}
        onCancel={() => {
          setViewMode('list');
          setEditingBand(null);
        }}
        isSubmitting={isSubmitting}
      />
    );
  }

  return (
    <>
      <BandTable
        type={type}
        schedules={schedules}
        channels={channels}
        selectedChannelId={selectedChannelId}
        onSelectChannel={(chId) => setSelectedChannelId(chId)}
        currentUser={currentUser}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onCreate={() => {
          setEditingBand(null);
          setViewMode('create');
        }}
        onEdit={(item) => {
          setEditingBand(item);
          setViewMode('edit');
        }}
        onDelete={promptDelete}
        onToggleStatus={handleToggleStatus}
        onFireLive={handleFireLive}
        firingId={firingId}
        isLoading={isLoading}
      />

      <ConfirmDeleteModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, item: null })}
        onConfirm={confirmDelete}
        title={`Confirm Delete ${type === 'lband' ? 'L-Band' : 'Ashton Band'}`}
        itemName={deleteModal.item?.title || ''}
        message={`Are you sure you want to delete "${deleteModal.item?.title}"? Its broadcast schedule and graphic overlay configuration will be permanently removed.`}
        confirmText="Confirm Delete"
      />
    </>
  );
}
