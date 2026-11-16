import React from 'react';
import CreateChannelForm from './CreateChannelForm.jsx';
import UpdateChannelForm from './UpdateChannelForm.jsx';

export default function ChannelForm({ mode, ...props }) {
  if (mode === 'create') {
    return <CreateChannelForm {...props} />;
  }
  return <UpdateChannelForm {...props} />;
}
