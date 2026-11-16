import React from 'react';
import CreateUserForm from './CreateUserForm.jsx';
import UpdateUserForm from './UpdateUserForm.jsx';

export default function UserForm({ mode, ...props }) {
  if (mode === 'create') {
    return <CreateUserForm {...props} />;
  }
  return <UpdateUserForm {...props} />;
}
