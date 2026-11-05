/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { MotionConfig } from 'motion/react';
import { LanguageProvider } from './i18n/LanguageContext';
import { MainContent } from './components/MainContent';
import { ContentProvider } from './data/ContentContext';

export default function App() {
  return (
    // reducedMotion="user": animations are skipped for visitors who ask for less motion.
    <MotionConfig reducedMotion="user">
      <LanguageProvider>
        <ContentProvider>
          <MainContent />
        </ContentProvider>
      </LanguageProvider>
    </MotionConfig>
  );
}
