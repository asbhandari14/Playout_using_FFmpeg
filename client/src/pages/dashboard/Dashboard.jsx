import React from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';

import useDashboard from '../../hooks/useDashboard.js';
import ConfirmDeleteModal from '../../components/modals/ConfirmDeleteModal.jsx';
import DashboardHeader from '../../components/header/DashboardHeader.jsx';
import DashboardSidebar from '../../components/sidebar/DashboardSidebar.jsx';

import User from '../auth/User.jsx';
import CreateUserForm from '../../components/form/CreateUserForm.jsx';
import UpdateUserForm from '../../components/form/UpdateUserForm.jsx';

import Channel from '../channel/Channel.jsx';
import CreateChannelForm from '../../components/form/CreateChannelForm.jsx';
import UpdateChannelForm from '../../components/form/UpdateChannelForm.jsx';

import Server from '../server/Server.jsx';
import CreateServerForm from '../../components/form/CreateServerForm.jsx';
import UpdateServerForm from '../../components/form/UpdateServerForm.jsx';

import PlaylistSection from '../playlist/PlaylistSection.jsx';
import PlaylistBuilder from '../playlist/PlaylistBuilder.jsx';
import CreatePlaylistForm from '../../components/form/CreatePlaylistForm.jsx';
import UpdatePlaylistForm from '../../components/form/UpdatePlaylistForm.jsx';

import ChannelInfoForm from '../../components/form/ChannelInfoForm.jsx';
import ModulePlaceholder from '../../components/placeholder/ModulePlaceholder.jsx';

export default function Dashboard({ initialSection = 'channels', initialSubView = 'list' }) {
  const {
    currentUser,
    users,
    channels,
    servers,
    filteredUsers,
    filteredChannels,
    filteredServers,
    defaultPlaylists,
    schedulingPlaylists,
    liveSchedulePlaylists,
    advertisementPlaylists,
    emergencyPlaylists,
    nav,
    alerts,
    searchQuery,
    setSearchQuery,
    copiedUrl,
    copyUrl,
    userForm,
    channelForm,
    serverForm,
    playlistForm,
    deleteModal,
    actions
  } = useDashboard(initialSection, initialSubView);

  const { activeSection, subView } = nav;
  const isFormView = subView === 'create' || subView === 'edit';
  const { type: deleteType, item: deleteItem } = deleteModal.state;

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col font-sans select-none overflow-x-hidden">
      {/* Dashboard Header */}
      <DashboardHeader
        currentUser={currentUser}
        isProfileMenuOpen={nav.isProfileMenuOpen}
        onToggleProfileMenu={nav.toggleProfileMenu}
        onLogoClick={() => nav.goToSection('channels')}
        onOpenControlRoom={actions.openControlRoom}
        onLogout={actions.logout}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Dashboard Sidebar */}
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

          {/* 1. Channels */}
          {(activeSection === 'channels' || activeSection === 'dashboard') &&
            (isFormView ? (
              subView === 'create' ? (
                <CreateChannelForm
                  formData={channelForm.data}
                  setFormData={channelForm.setData}
                  servers={servers}
                  users={users}
                  currentUser={currentUser}
                  onSubmit={channelForm.submit}
                  onCancel={() => nav.setSubView('list')}
                />
              ) : (
                <UpdateChannelForm
                  formData={channelForm.data}
                  setFormData={channelForm.setData}
                  servers={servers}
                  users={users}
                  currentUser={currentUser}
                  onSubmit={channelForm.submit}
                  onCancel={() => nav.setSubView('list')}
                />
              )
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

          {/* 2. Servers */}
          {activeSection === 'servers' &&
            (isFormView ? (
              subView === 'create' ? (
                <CreateServerForm
                  formData={serverForm.data}
                  setFormData={serverForm.setData}
                  onSubmit={serverForm.submit}
                  onCancel={() => nav.setSubView('list')}
                />
              ) : (
                <UpdateServerForm
                  formData={serverForm.data}
                  setFormData={serverForm.setData}
                  onSubmit={serverForm.submit}
                  onCancel={() => nav.setSubView('list')}
                />
              )
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

          {/* 3. Users */}
          {activeSection === 'users' &&
            (isFormView ? (
              subView === 'create' ? (
                <CreateUserForm
                  formData={userForm.data}
                  setFormData={userForm.setData}
                  currentUser={currentUser}
                  onSubmit={userForm.submit}
                  onCancel={() => nav.setSubView('list')}
                />
              ) : (
                <UpdateUserForm
                  formData={userForm.data}
                  setFormData={userForm.setData}
                  currentUser={currentUser}
                  onSubmit={userForm.submit}
                  onCancel={() => nav.setSubView('list')}
                />
              )
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

          {/* Info - Channel Broadcast Information */}
          {activeSection === 'info' && (
            <ChannelInfoForm
              channels={channels}
              selectedChannelId={channels[0]?._id}
              onCancel={() => nav.goToSection('channels')}
              onOpenStudio={actions.openChannelStudio}
            />
          )}

          {/* 4. Emergency Playlist (Priority 5) */}
          {activeSection === 'emergency_playlist' &&
            (isFormView ? (
              <PlaylistBuilder
                formData={playlistForm.data}
                setFormData={playlistForm.setData}
                channels={channels}
                forcedType="emergency"
                onSubmit={playlistForm.submit}
                onCancel={() => nav.setSubView('list')}
                mode={subView}
              />
            ) : (
              <PlaylistSection
                type="emergency"
                playlists={emergencyPlaylists}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onCreate={() => playlistForm.openCreate('emergency')}
                onEdit={playlistForm.openEdit}
                onDelete={(item) => deleteModal.prompt('playlist', item)}
                onOpenStudio={actions.openChannelStudio}
              />
            ))}

          {/* 5. Advertisement Playlist (Priority 4) */}
          {activeSection === 'advertisement_playlist' &&
            (isFormView ? (
              <PlaylistBuilder
                formData={playlistForm.data}
                setFormData={playlistForm.setData}
                channels={channels}
                forcedType="advertisement"
                onSubmit={playlistForm.submit}
                onCancel={() => nav.setSubView('list')}
                mode={subView}
              />
            ) : (
              <PlaylistSection
                type="advertisement"
                playlists={advertisementPlaylists}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onCreate={() => playlistForm.openCreate('advertisement')}
                onEdit={playlistForm.openEdit}
                onDelete={(item) => deleteModal.prompt('playlist', item)}
                onOpenStudio={actions.openChannelStudio}
              />
            ))}

          {/* 6. Live Scheduling (Priority 3) */}
          {activeSection === 'live_schedule' &&
            (isFormView ? (
              <PlaylistBuilder
                formData={playlistForm.data}
                setFormData={playlistForm.setData}
                channels={channels}
                forcedType="live_schedule"
                onSubmit={playlistForm.submit}
                onCancel={() => nav.setSubView('list')}
                mode={subView}
              />
            ) : (
              <PlaylistSection
                type="live_schedule"
                playlists={liveSchedulePlaylists}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onCreate={() => playlistForm.openCreate('live_schedule')}
                onEdit={playlistForm.openEdit}
                onDelete={(item) => deleteModal.prompt('playlist', item)}
                onOpenStudio={actions.openChannelStudio}
              />
            ))}

          {/* 7. Scheduling Playlist (Priority 2) */}
          {activeSection === 'scheduling_playlist' &&
            (isFormView ? (
              <PlaylistBuilder
                formData={playlistForm.data}
                setFormData={playlistForm.setData}
                channels={channels}
                forcedType="scheduling"
                onSubmit={playlistForm.submit}
                onCancel={() => nav.setSubView('list')}
                mode={subView}
              />
            ) : (
              <PlaylistSection
                type="scheduling"
                playlists={schedulingPlaylists}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onCreate={() => playlistForm.openCreate('scheduling')}
                onEdit={playlistForm.openEdit}
                onDelete={(item) => deleteModal.prompt('playlist', item)}
                onOpenStudio={actions.openChannelStudio}
              />
            ))}

          {/* 8. Default Playlist (Priority 1) */}
          {activeSection === 'default_playlist' &&
            (isFormView ? (
              <PlaylistBuilder
                formData={playlistForm.data}
                setFormData={playlistForm.setData}
                channels={channels}
                forcedType="default"
                onSubmit={playlistForm.submit}
                onCancel={() => nav.setSubView('list')}
                mode={subView}
              />
            ) : (
              <PlaylistSection
                type="default"
                playlists={defaultPlaylists}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onCreate={() => playlistForm.openCreate('default')}
                onEdit={playlistForm.openEdit}
                onDelete={(item) => deleteModal.prompt('playlist', item)}
                onOpenStudio={actions.openChannelStudio}
              />
            ))}

          {/* General Playlist Form */}
          {activeSection === 'playlists' && isFormView && (
            <PlaylistBuilder
              formData={playlistForm.data}
              setFormData={playlistForm.setData}
              channels={channels}
              forcedType={playlistForm.data?.type || 'default'}
              onSubmit={playlistForm.submit}
              onCancel={() => nav.setSubView('list')}
              mode={subView}
            />
          )}

          {/* Fallback for other sections */}
          {activeSection !== 'users' &&
            activeSection !== 'channels' &&
            activeSection !== 'dashboard' &&
            activeSection !== 'servers' &&
            activeSection !== 'info' &&
            activeSection !== 'default_playlist' &&
            activeSection !== 'scheduling_playlist' &&
            activeSection !== 'live_schedule' &&
            activeSection !== 'advertisement_playlist' &&
            activeSection !== 'emergency_playlist' &&
            activeSection !== 'playlists' && (
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
            : deleteType === 'channel'
            ? 'Confirm Delete Channel'
            : 'Confirm Delete Playlist'
        }
        itemName={deleteItem?.name || ''}
        message={
          deleteType === 'user'
            ? `Are you sure you want to delete user '${deleteItem?.name}' (${deleteItem?.email})? All assigned channels and access permissions will be revoked.`
            : deleteType === 'server'
            ? `Are you sure you want to delete server '${deleteItem?.name}'? Channels configured with this media server will be affected.`
            : deleteType === 'channel'
            ? `Are you sure you want to delete channel '${deleteItem?.name}'? Active live broadcast streams, playout schedules, and HLS playlists will be permanently removed.`
            : `Are you sure you want to delete playlist '${deleteItem?.name}'? Its schedule and associated items will be permanently removed.`
        }
        confirmText="Confirm Delete"
      />
    </div>
  );
}
