import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { applyDisplay } from './lib/display';
import { sendPending } from './lib/track';

// Text size and contrast, before the first paint.
applyDisplay();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Usage counts kept from a visit with no connection.
sendPending();
