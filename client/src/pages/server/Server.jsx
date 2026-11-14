import React from 'react';
import ServerHeader from '../../components/header/ServerHeader.jsx';
import ServerTable from '../../components/table/ServerTable.jsx';

export default function Server({
  servers = [],
  searchQuery = '',
  onSearchChange,
  onCreate,
  onEdit,
  onDelete,
  copiedUrl = '',
  onCopyUrl,
}) {
  return (
    <div className="space-y-3.5 2xl:space-y-4">
      {/* Server Header */}
      <ServerHeader
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        onCreate={onCreate}
      />

      {/* Server Table */}
      <ServerTable
        servers={servers}
        onCopyUrl={onCopyUrl}
        copiedUrl={copiedUrl}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </div>
  );
}