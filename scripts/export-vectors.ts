// Writes the golden vectors in contracts/vectors from the web's own code (see scripts/vectors).
import { writeFileSync } from 'node:fs';
import { PRAYER_VECTORS_PATH, prayerVectorsText } from './prayer-vectors.js';
import { VECTOR_SETS, vectorFileText, vectorPath } from './vectors/index.js';

writeFileSync(PRAYER_VECTORS_PATH, prayerVectorsText());
for (const set of VECTOR_SETS) writeFileSync(vectorPath(set), await vectorFileText(set));
console.log(`Wrote ${VECTOR_SETS.length + 1} files in contracts/vectors`);
