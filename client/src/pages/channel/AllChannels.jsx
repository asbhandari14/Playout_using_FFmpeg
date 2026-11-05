import React from 'react';
import { Tv, Search } from 'lucide-react';
import useChannel from '../../hooks/useChannel.js';
import DashboardHeader from '../../components/header/DashboardHeader.jsx';
import ChannelCard from '../../components/card/ChannelCard.jsx';

export default function AllChannels() {
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
    <div className="min-h-screen bg-[#0c0e12] text-slate-100 flex flex-col font-sans select-none">
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

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Title and Search Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2 m-0">
              <Tv className="text-[#00bcd4]" size={22} />
              Broadcast Channels
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Select a channel to enter the Playout Control Room deck.
            </p>
          </div>

          {/* Search Bar */}
          <div className="relative w-full sm:w-80">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search channels..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 bg-[#090d16] border border-[#1a2337] rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#00bcd4] transition"
            />
          </div>
        </div>

        {/* Channels Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
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
              />
            ))
          )}
        </div>
      </main>
    </div>
  );
}
