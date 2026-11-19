// Writes the shared test vectors in contracts/vectors (see scripts/prayer-vectors.ts).
import { writeFileSync } from 'node:fs';
import { PRAYER_VECTORS_PATH, prayerVectorsText } from './prayer-vectors.js';

writeFileSync(PRAYER_VECTORS_PATH, prayerVectorsText());
console.log(`Wrote ${PRAYER_VECTORS_PATH}`);
