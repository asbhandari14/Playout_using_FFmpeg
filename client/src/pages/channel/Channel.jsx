import React from 'react';
import ChannelHeader from '../../components/header/ChannelHeader';
import ChannelTable from '../../components/table/ChannelTable';

export default function Channel({
  channels,
  searchQuery,
  onSearchChange,
  onCreate,
  onEdit,
  onDelete,
  onOpenStudio,
  copiedUrl,
  onCopyUrl,
  onOpenEpg,
}) {
  return (
    <div className="space-y-3.5 2xl:space-y-4">

      {/* Channel Header */}
      <ChannelHeader
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        onCreate={onCreate}
      />

      {/* Channel Table */}
      <ChannelTable
        channels={channels}
        onOpenStudio={onOpenStudio}
        onCopyUrl={onCopyUrl}
        copiedUrl={copiedUrl}
        onEdit={onEdit}
        onDelete={onDelete}
        onOpenEpg={onOpenEpg}
      />
    </div>
  );
}