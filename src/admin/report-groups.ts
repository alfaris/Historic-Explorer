// Helpers for the Reports tab: which places a filter covers, and reports
// grouped by the place they're about.

import type { Content } from '../data/content';
import type { Report } from './api';

export interface ReportView {
  /** 'all', or a route ID. */
  route: string;
  type: Report['type'] | 'all';
  /** One place, chosen from its badge in the Places tab. */
  placeId: number | null;
}

/**
 * The place IDs the server should limit reports to, or undefined for every
 * place. A route covers the places on it now.
 */
export function filterPlaces(content: Content, view: ReportView): number[] | undefined {
  if (view.placeId !== null) return [view.placeId];
  if (view.route === 'all') return undefined;
  return content.places.filter(p => p.routeId === view.route).map(p => p.id);
}

export interface ReportGroup {
  placeId: number;
  reports: Report[];
}

/**
 * Reports grouped by place, keeping each place's reports newest first and
 * ordering the places by their newest report (the order they come in).
 */
export function groupByPlace(reports: Report[]): ReportGroup[] {
  const groups = new Map<number, Report[]>();
  for (const r of reports) {
    const list = groups.get(r.placeId);
    if (list) list.push(r);
    else groups.set(r.placeId, [r]);
  }
  return [...groups].map(([placeId, list]) => ({ placeId, reports: list }));
}

/** "1 report", "3 reports". */
export const reportsLabel = (n: number) => `${n} report${n === 1 ? '' : 's'}`;
