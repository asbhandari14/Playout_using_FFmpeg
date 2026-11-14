import React from 'react';
import PlaylistHeader from '../../components/header/PlaylistHeader.jsx';
import PlaylistScheduleTable from '../../components/table/PlaylistScheduleTable.jsx';

export default function PlaylistSection({
  type = 'default',
  playlists = [],
  searchQuery = '',
  onSearchChange,
  onCreate,
  onEdit,
  onDelete,
  onOpenStudio,
}) {
  return (
    <div className="space-y-3.5 2xl:space-y-4">
      {/* Playlist Header */}
      <PlaylistHeader
        type={type}
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        onCreate={onCreate}
      />

      {/* Playlist Schedule Table */}
      <PlaylistScheduleTable
        playlists={playlists}
        onEdit={onEdit}
        onDelete={onDelete}
        onOpenStudio={onOpenStudio}
      />
    </div>
  );
}