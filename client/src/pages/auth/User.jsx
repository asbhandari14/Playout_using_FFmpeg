import React from 'react';
import UserHeader from '../../components/header/UserHeader';
import UserTable from '../../components/table/ChannelTable';

export default function User({
  users,
  searchQuery,
  onSearchChange,
  onCreate,
  onEdit,
  onDelete,
}) {
  return (
    <div className="space-y-3.5 2xl:space-y-4">
      {/* User Header */}
      <UserHeader
        totalUsers={users.length}
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        onCreate={onCreate}
      />

      {/* User Table */}
      <UserTable users={users} onEdit={onEdit} onDelete={onDelete} />
    </div>
  );
}