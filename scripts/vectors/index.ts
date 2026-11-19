// Every set of golden vectors in contracts/vectors (prayer times have their own, scripts/prayer-vectors.ts).
import { hoursVectors, openNowVectors, prayerPauseVectors, specialHoursVectors } from './hours.js';
import { contentSampleVectors } from './content-sample.js';
import { idSetStoreVectors, loadStores, visitDatesVectors } from './stores.js';
import { geoVectors, nearbyVectors, noticeVectors, passportVectors, quizVectors, walkVectors } from './visitor.js';
import { vectorText, type VectorSet } from './common.js';

export const VECTOR_SETS: VectorSet[] = [
  hoursVectors, specialHoursVectors, openNowVectors, prayerPauseVectors, walkVectors, geoVectors, nearbyVectors, noticeVectors, quizVectors, passportVectors, idSetStoreVectors, visitDatesVectors, contentSampleVectors,
];

export const vectorPath = (set: VectorSet) => `contracts/vectors/${set.name}.json`;

export async function vectorFileText(set: VectorSet): Promise<string> {
  await loadStores();
  return vectorText(await set.build());
}
