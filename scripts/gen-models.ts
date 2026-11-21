// Writes the apps' Kotlin content models (see scripts/kotlin-models.ts).
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { kotlinModels, MODELS_PATH } from './kotlin-models.js';

mkdirSync(dirname(MODELS_PATH), { recursive: true });
writeFileSync(MODELS_PATH, kotlinModels());
console.log(`Wrote ${MODELS_PATH}`);
