import React from 'react';
import CreateServerForm from './CreateServerForm.jsx';
import UpdateServerForm from './UpdateServerForm.jsx';

export default function ServerForm({ mode, ...props }) {
  if (mode === 'create') {
    return <CreateServerForm {...props} />;
  }
  return <UpdateServerForm {...props} />;
}
