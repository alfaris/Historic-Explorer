/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { LanguageProvider } from './i18n/LanguageContext';
import { MainContent } from './components/MainContent';

export default function App() {
  return (
    <LanguageProvider>
      <MainContent />
    </LanguageProvider>
  );
}
