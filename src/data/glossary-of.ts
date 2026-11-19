// The glossary in use: the admin's, or the built-in one until the admin saves
// one. Kept out of content.ts so the built-in table loads only with what shows
// the glossary (GlossaryText, in a place card's body) and with the admin.

import type { Content } from './content.js';
import { DEFAULT_GLOSSARY } from './glossary.js';
import type { GlossaryTerm } from '../lib/glossary.js';

export const glossaryOf = (content: Content): GlossaryTerm[] => content.glossary ?? DEFAULT_GLOSSARY;
