import { describe, expect, it } from 'vitest';
import { bundledContent } from '../data/content';
import { addEvents, emptyDay, type StatEvent } from '../lib/stats';
import { walkStops } from '../lib/walk';
import type { StatsResponse } from './api';
import { dailySeries, statsCsv } from './stats-csv';

const today = new Date('2026-11-08T09:00:00Z');
const content = bundledContent;
const route = content.routes[0];
const [a, b] = walkStops(content.places, route.id);

/** Splits CSV text (every cell quoted, CRLF lines) into rows of cells. */
function readCsv(text: string): string[][] {
  return text
    .replace(/^﻿/, '')
    .split('\r\n')
    .filter((line, i, all) => i < all.length - 1 || line)
    .map(line => (line ? [...line.matchAll(/"((?:[^"]|"")*)"/g)].map(m => m[1].replace(/""/g, '"')) : []));
}

const events: StatEvent[] = [
  { t: 'play', id: a.id },
  { t: 'play', id: a.id },
  { t: 'play', id: b.id },
  { t: 'arrive', id: b.id },
  { t: 'route', id: route.id },
  { t: 'up', id: a.id },
  { t: 'down', id: b.id },
  { t: 'why', id: b.id, r: 'outdated' },
];
const total = addEvents(emptyDay(), events);
const data: StatsResponse = {
  total,
  perDay: [
    { date: '2026-11-02', plays: 1, routes: 0, arrivals: 1 },
    { date: '2026-11-08', plays: 2, routes: 1, arrivals: 0 },
  ],
};

const section = (rows: string[][], title: string) => {
  const start = rows.findIndex(r => r.length === 1 && r[0] === title);
  const end = rows.findIndex((r, i) => i > start && r.length === 0);
  return rows.slice(start + 2, end === -1 ? undefined : end);
};

describe('dailySeries', () => {
  it('has every day of the period, oldest first, with zeros for quiet days', () => {
    const s = dailySeries(data.perDay, 7, today);
    expect(s.map(d => d.date)).toEqual(['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08']);
    expect(s[0]).toEqual({ date: '2026-11-02', plays: 1, routes: 0, arrivals: 1 });
    expect(s[3]).toEqual({ date: '2026-11-05', plays: 0, routes: 0, arrivals: 0 });
  });
});

describe('statsCsv', () => {
  const file = statsCsv(data, content, 7, today);
  const rows = readCsv(file.text);

  it('is a UTF-8 CSV named for the period', () => {
    expect(file.name).toBe('cairo-walks-stats-7-days-2026-11-08.csv');
    expect(file.text.startsWith('﻿')).toBe(true);
    expect(rows[0]).toEqual(['Cairo Walks stats', 'Last 7 days', '2026-11-02 to 2026-11-08 (UTC)']);
  });

  it('lists each day and totals that match the tiles', () => {
    const daily = section(rows, 'Per day');
    expect(daily).toHaveLength(8);
    expect(daily.at(-1)).toEqual(['Total', '3', '1', '1']);
  });

  it('gives each place its plays, arrivals, votes and reasons', () => {
    const places = section(rows, 'Per place');
    expect(places).toHaveLength(content.places.length);
    const rowOf = (id: number) => places.find(r => r[0] === String(id))!;
    expect(rowOf(a.id).slice(1, 7)).toEqual([a.nameEn, route.nameEn, '2', '0', '1', '0']);
    expect(rowOf(b.id).slice(3, 8)).toEqual(['1', '1', '0', '1', '1']); // plays, arrivals, yes, no, "out of date"
  });

  it('sums each route and lists its stops in walking order', () => {
    const routes = section(rows, 'Per route');
    expect(routes.find(r => r[0] === route.id)).toEqual([route.id, route.nameEn, '1', '3', '1']);
    const stops = section(rows, 'Stops in walking order').filter(r => r[0] === route.nameEn);
    expect(stops.slice(0, 2)).toEqual([
      [route.nameEn, '1', String(a.id), a.nameEn, '2', '0'],
      [route.nameEn, '2', String(b.id), b.nameEn, '1', '1'],
    ]);
  });

  it('keeps the loaded period when downloaded after midnight', () => {
    // The file is built with the time the stats were loaded, not the time of the click.
    const later = readCsv(statsCsv(data, content, 7, today).text);
    expect(later[0][2]).toBe('2026-11-02 to 2026-11-08 (UTC)');
    expect(section(later, 'Per day').at(-1)).toEqual(['Total', '3', '1', '1']);
    // Built with a later date, the oldest day would fall off: what the tab avoids by passing loadedAt.
    const shifted = readCsv(statsCsv(data, content, 7, new Date('2026-11-09T00:30:00Z')).text);
    expect(section(shifted, 'Per day').at(-1)).toEqual(['Total', '2', '1', '0']);
  });
});
