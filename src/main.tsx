import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { applyDisplay } from './lib/display';
import { sendPending } from './lib/track';
import { startingLang } from './i18n/LanguageContext';
import { loadDictionary } from './i18n/lang';

// Text size and contrast, before the first paint.
applyDisplay();

// The starting language's interface text (French, Spanish) comes first, so
// English never flashes. English and Arabic have nothing to load.
loadDictionary(startingLang()).then(() =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  ),
);

// Usage counts kept from a visit with no connection.
sendPending();
