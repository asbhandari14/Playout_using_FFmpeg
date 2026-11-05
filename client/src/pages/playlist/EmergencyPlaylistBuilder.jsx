import React from 'react';
import PlaylistBuilder from './PlaylistBuilder.jsx';

export default function EmergencyPlaylistBuilder(props) {
  return <PlaylistBuilder {...props} forcedType="emergency" />;
}
