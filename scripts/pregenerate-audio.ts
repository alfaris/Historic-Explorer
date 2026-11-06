// Generates the audio guide for every place in both languages and stores it in
// Vercel Blob, so no visitor has to wait for the first generation.
//
//   npm run pregenerate-audio                 generate everything that's missing
//   npm run pregenerate-audio -- --dry-run    only list what's missing
//   npm run pregenerate-audio -- --lang=ar    one language only
//   npm run pregenerate-audio -- --delay=5000 wait longer between Gemini calls (ms)
//
// Needs GEMINI_API_KEY and BLOB_READ_WRITE_TOKEN, read from the environment or
// from .env.local (`vercel env pull .env.local` fetches both).

import { existsSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { audioStatus, generateAndStoreAudio, type Lang } from '../api/_lib/gemini.js';
import { isLang, LANGS } from '../src/i18n/lang.js';
import { getContent } from '../api/_lib/content.js';

const { values: args } = parseArgs({
  options: {
    'dry-run': { type: 'boolean', default: false },
    lang: { type: 'string' },
    delay: { type: 'string', default: '2000' },
  },
});

const langs: Lang[] = isLang(args.lang) ? [args.lang] : [...LANGS];
if (args.lang && langs.length !== 1) {
  console.error(`--lang must be one of ${LANGS.join(', ')}`);
  process.exit(1);
}
const delayMs = Number(args.delay);
if (!Number.isFinite(delayMs) || delayMs < 0) {
  console.error('--delay must be a number of milliseconds');
  process.exit(1);
}

if (existsSync('.env.local')) process.loadEnvFile('.env.local');
const missingEnv = ['BLOB_READ_WRITE_TOKEN', ...(args['dry-run'] ? [] : ['GEMINI_API_KEY'])].filter(
  name => !process.env[name],
);
if (missingEnv.length) {
  console.error(`Missing ${missingEnv.join(' and ')}. Set it in the environment or in .env.local.`);
  process.exit(1);
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const label = (name: string, lang: Lang) => `${name} [${lang}]`;

const counts = { stored: 0, generated: 0, missing: 0, failed: 0, noText: 0 };
const failures: string[] = [];
let generatedAny = false;

// The live content from Blob (or the bundled data if nothing has been saved).
const { places: locations } = await getContent();
for (const location of locations) {
  for (const lang of langs) {
    const name = label(location.nameEn, lang);
    let status: Awaited<ReturnType<typeof audioStatus>>;
    try {
      status = await audioStatus(location, lang);
    } catch (err) {
      counts.failed++;
      failures.push(`${name}: checking Blob failed: ${(err as Error).message}`);
      console.log(`✗ ${name} (checking Blob failed)`);
      continue;
    }

    if (status === 'stored') {
      counts.stored++;
      continue;
    }
    if (status === 'no-text') {
      counts.noText++;
      console.log(`- ${name} has no description, skipped`);
      continue;
    }
    if (args['dry-run']) {
      counts.missing++;
      console.log(`• ${name} is missing`);
      continue;
    }

    // Space out Gemini calls to stay under its rate limits.
    if (generatedAny) await sleep(delayMs);
    generatedAny = true;
    const started = Date.now();
    try {
      await generateAndStoreAudio(location, lang);
      counts.generated++;
      console.log(`✓ ${name} (${((Date.now() - started) / 1000).toFixed(1)}s)`);
    } catch (err) {
      counts.failed++;
      failures.push(`${name}: ${(err as Error).message}`);
      console.log(`✗ ${name}: ${(err as Error).message}`);
    }
  }
}

console.log('');
console.log(
  [
    `${counts.stored} already stored`,
    args['dry-run'] ? `${counts.missing} missing` : `${counts.generated} generated`,
    `${counts.failed} failed`,
    ...(counts.noText ? [`${counts.noText} without a description`] : []),
  ].join(', '),
);
if (failures.length) {
  console.log('\nFailures (run the script again to retry them):');
  for (const failure of failures) console.log(`  ${failure}`);
  process.exitCode = 1;
}
