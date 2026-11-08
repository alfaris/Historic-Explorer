import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AdminApp } from './AdminApp';
import '../index.css';
import { stopTracking } from '../lib/track';

// Playing an audio guide in a place preview isn't a visitor's play.
stopTracking();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AdminApp />
  </StrictMode>,
);
