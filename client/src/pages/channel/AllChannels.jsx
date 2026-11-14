import React, { useState } from 'react';
import { Tv, Search } from 'lucide-react';
import useChannel from '../../hooks/useChannel.js';
import DashboardHeader from '../../components/header/DashboardHeader.jsx';
import ChannelCard from '../../components/card/ChannelCard.jsx';
import EpgModal from '../../components/modals/EpgModal.jsx';

export default function AllChannels() {
  const [epgModal, setEpgModal] = useState({ isOpen: false, channel: null });

  const {
    currentUser,
    filteredChannels,
    loading,
    searchQuery,
    setSearchQuery,
    isProfileMenuOpen,
    toggleProfileMenu,
    openChannelStudio,
    logout
  } = useChannel();

  return (
    <div className="min-h-screen bg-[#0a0d13] text-slate-100 flex flex-col font-mono select-none">
      {/* Top Header - No navigation links */}
      <DashboardHeader
        currentUser={currentUser}
        isProfileMenuOpen={isProfileMenuOpen}
        onToggleProfileMenu={toggleProfileMenu}
        onLogoClick={() => {}}
        onOpenControlRoom={() => {
          if (filteredChannels[0]?._id) {
            openChannelStudio(filteredChannels[0]._id);
          }
        }}
        onLogout={logout}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-4 lg:p-5 2xl:p-6 space-y-4">
        {/* Title and Search Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
          <div>
            <h1 className="text-base sm:text-lg 2xl:text-xl font-bold tracking-tight text-white flex items-center gap-2 m-0">
              <Tv className="text-[#00bcd4]" size={18} />
              Broadcast Channels
            </h1>
            <p className="text-[11px] 2xl:text-xs text-slate-400 mt-0.5">
              Select a channel to enter the Playout Control Room deck.
            </p>
          </div>

          {/* Search Bar */}
          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search channels..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 2xl:py-2 bg-[#0f131c] border border-[#1f2738] rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#00bcd4] transition"
            />
          </div>
        </div>

        {/* Channels Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3.5 2xl:gap-4">
          {loading && filteredChannels.length === 0 ? (
            <div className="col-span-full text-center py-16 text-slate-500 text-xs">
              Loading broadcast channels...
            </div>
          ) : filteredChannels.length === 0 ? (
            <div className="col-span-full text-center py-16 text-slate-500 text-xs">
              No channels found matching your search.
            </div>
          ) : (
            filteredChannels.map((channel) => (
              <ChannelCard
                key={channel._id}
                channel={channel}
                onEnter={openChannelStudio}
                onOpenEpg={(ch) => setEpgModal({ isOpen: true, channel: ch })}
              />
            ))
          )}
        </div>
      </main>

      {/* EPG Modal */}
      <EpgModal
        isOpen={epgModal.isOpen}
        onClose={() => setEpgModal({ isOpen: false, channel: null })}
        channel={epgModal.channel}
        channels={filteredChannels}
      />
    </div>
  );
}
