import React from 'react';
import UserHeader from '../../components/header/UserHeader';
import UserTable from '../../components/table/UserTable';

export default function User({
  users = [],
  searchQuery = '',
  onSearchChange,
  onCreate,
  onEdit,
  onDelete,
}) {
  const userList = Array.isArray(users) ? users : [];

  return (
    <div className="space-y-3.5 2xl:space-y-4">
      {/* User Header */}
      <UserHeader
        totalUsers={userList.length}
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        onCreate={onCreate}
      />

      {/* User Table */}
      <UserTable users={userList} onEdit={onEdit} onDelete={onDelete} />
    </div>
  );
}