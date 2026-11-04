import React from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';

import useDashboard from '../../hooks/useDashboard.js';
import ConfirmDeleteModal from '../../components/ConfirmDeleteModal.jsx';
import DashboardHeader from '../../components/Header/DashboardHeader.jsx';
import DashboardSidebar from '../../components/Sidebar/DashboardSidebar.jsx';
import User from '../auth/User.jsx';
import UserForm from '../../components/Form/UserForm.jsx';
import Channel from '../channel/Channel.jsx';
import ChannelForm from '../../components/Form/ChannelForm.jsx';
import Server from '../server/Server.jsx';
import ServerForm from '../../components/Form/ServerForm.jsx';
import ModulePlaceholder from '../../components/placeholder/ModulePlaceholder.jsx';

export default function Dashboard({ initialSection = 'channels' }) {
  const {
    currentUser,
    users,
    channels,
    servers,
    filteredUsers,
    filteredChannels,
    filteredServers,
    nav,
    alerts,
    searchQuery,
    setSearchQuery,
    copiedUrl,
    copyUrl,
    userForm,
    channelForm,
    serverForm,
    deleteModal,
    actions
  } = useDashboard(initialSection);

  const { activeSection, subView } = nav;
  const isFormView = subView === 'create' || subView === 'edit';
  const { type: deleteType, item: deleteItem } = deleteModal.state;

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col font-sans select-none overflow-x-hidden">
      <DashboardHeader
        currentUser={currentUser}
        isProfileMenuOpen={nav.isProfileMenuOpen}
        onToggleProfileMenu={nav.toggleProfileMenu}
        onLogoClick={() => nav.goToSection('channels')}
        onOpenControlRoom={actions.openControlRoom}
        onLogout={actions.logout}
      />

      <div className="flex-1 flex overflow-hidden">
        <DashboardSidebar
          currentUser={currentUser}
          isOpen={nav.isSidebarOpen}
          activeSection={activeSection}
          onNavigate={nav.goToSection}
        />

        <main className="flex-1 overflow-y-auto bg-[#07090e] p-4 sm:p-6 lg:p-8">
          {/* Notification alerts */}
          {alerts.success && (
            <div className="mb-4 p-3 bg-emerald-950/60 border border-emerald-800 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 size={16} />
              <span>{alerts.success}</span>
            </div>
          )}
          {alerts.error && (
            <div className="mb-4 p-3 bg-rose-950/60 border border-rose-800 rounded-xl text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle size={16} />
              <span>{alerts.error}</span>
            </div>
          )}

          {/* Channels */}
          {(activeSection === 'channels' || activeSection === 'dashboard') &&
            (isFormView ? (
              <ChannelForm
                mode={subView}
                formData={channelForm.data}
                setFormData={channelForm.setData}
                servers={servers}
                users={users}
                onSubmit={channelForm.submit}
                onCancel={() => nav.setSubView('list')}
              />
            ) : (
              <Channel
                channels={filteredChannels}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onCreate={channelForm.openCreate}
                onEdit={channelForm.openEdit}
                onDelete={deleteModal.prompt}
                onOpenStudio={actions.openChannelStudio}
                copiedUrl={copiedUrl}
                onCopyUrl={copyUrl}
              />
            ))}

          {/* Servers */}
          {activeSection === 'servers' &&
            (isFormView ? (
              <ServerForm
                mode={subView}
                formData={serverForm.data}
                setFormData={serverForm.setData}
                onSubmit={serverForm.submit}
                onCancel={() => nav.setSubView('list')}
              />
            ) : (
              <Server
                servers={filteredServers}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onCreate={serverForm.openCreate}
                onEdit={serverForm.openEdit}
                onDelete={deleteModal.prompt}
                copiedUrl={copiedUrl}
                onCopyUrl={copyUrl}
              />
            ))}

          {/* Users */}
          {activeSection === 'users' &&
            (isFormView ? (
              <UserForm
                mode={subView}
                formData={userForm.data}
                setFormData={userForm.setData}
                onTogglePermission={userForm.togglePermission}
                onSubmit={userForm.submit}
                onCancel={() => nav.setSubView('list')}
              />
            ) : (
              <User
                users={filteredUsers}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onCreate={userForm.openCreate}
                onEdit={userForm.openEdit}
                onDelete={deleteModal.prompt}
              />
            ))}

          {/* Other sections fallback */}
          {activeSection !== 'users' &&
            activeSection !== 'channels' &&
            activeSection !== 'dashboard' &&
            activeSection !== 'servers' && (
              <ModulePlaceholder
                section={activeSection}
                firstChannel={channels[0]}
                onOpenControlRoom={() => actions.openChannelStudio(channels[0]?._id)}
              />
            )}
        </main>
      </div>

      <ConfirmDeleteModal
        isOpen={deleteModal.state.isOpen}
        onClose={deleteModal.close}
        onConfirm={deleteModal.confirm}
        title={
          deleteType === 'user'
            ? 'Confirm Delete User'
            : deleteType === 'server'
            ? 'Confirm Delete Server'
            : 'Confirm Delete Channel'
        }
        itemName={deleteItem?.name || ''}
        message={
          deleteType === 'user'
            ? `Are you sure you want to delete user '${deleteItem?.name}' (${deleteItem?.email})? All assigned channels and access permissions will be revoked.`
            : deleteType === 'server'
            ? `Are you sure you want to delete server '${deleteItem?.name}'? Channels configured with this media server will be affected.`
            : `Are you sure you want to delete channel '${deleteItem?.name}'? Active live broadcast streams, playout schedules, and HLS playlists will be permanently removed.`
        }
        confirmText="Confirm Delete"
      />
    </div>
  );
}
