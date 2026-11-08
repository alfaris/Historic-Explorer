// How much of a route a wheelchair user or a parent with a pushchair can do:
// its stops' step-free access, from the visitor tips. Pure, so it's tested.

import type { Location } from '../data/locations';
import { byLang } from '../i18n/lang';
import { STOP_CATEGORIES } from './walk';

type Place = Pick<Location, 'routeId' | 'category'> & Partial<Pick<Location, 'tips'>>;

export type RouteAccess<T> = { total: number; yes: number; partial: number; no: number; unchecked: T[] };

/** The route's stops by step-free access, with those not yet checked in walking order. */
export function routeAccess<T extends Place>(places: T[], routeId: string): RouteAccess<T> {
  // The stops in walking order, as walkStops gives them.
  const stops = places.filter(p => p.routeId === routeId && STOP_CATEGORIES.has(p.category));
  const count = (a: 'yes' | 'partial' | 'no') => stops.filter(p => p.tips?.wheelchair === a).length;
  return { total: stops.length, yes: count('yes'), partial: count('partial'), no: count('no'), unchecked: stops.filter(p => !p.tips?.wheelchair) };
}

/** 0 to 1: the share of the route's stops that are step-free, partly step-free ones counting half. */
export const stepFreeShare = (a: RouteAccess<unknown>) => (a.total ? (a.yes + a.partial / 2) / a.total : 0);

/** Whether to show a summary: once at least one stop has been checked. */
export const hasAccessInfo = (a: RouteAccess<unknown>) => a.total > 0 && a.unchecked.length < a.total;

/** "Step-free: 12 of 20 stops". */
export const stepFreeText = (a: RouteAccess<unknown>) =>
  byLang({
    en: `Step-free: ${a.yes} of ${a.total} stops`,
    ar: `بدون درجات: ${a.yes} من ${a.total} ${a.total >= 3 && a.total <= 10 ? 'محطات' : 'محطة'}`,
    fr: `De plain-pied : ${a.yes} étape${a.yes === 1 ? '' : 's'} sur ${a.total}`,
    es: `Sin escalones: ${a.yes} de ${a.total} paradas`,
  });

/** "2 partly", or empty. */
export const partlyText = (a: RouteAccess<unknown>) =>
  a.partial ? byLang({ en: `${a.partial} partly`, ar: `${a.partial} جزئيًا`, fr: `${a.partial} en partie`, es: `${a.partial} en parte` }) : '';

/** "3 not yet checked", or empty. */
export const uncheckedText = (a: RouteAccess<unknown>) => {
  const n = a.unchecked.length;
  return n ? byLang({ en: `${n} not yet checked`, ar: `${n} لم يُتحقق منها بعد`, fr: `${n} pas encore vérifiée${n === 1 ? '' : 's'}`, es: `${n} sin comprobar todavía` }) : '';
};

/** The whole summary on one line: "Step-free: 12 of 20 stops · 2 partly · 3 not yet checked". */
export const accessSummary = (a: RouteAccess<unknown>) => [stepFreeText(a), partlyText(a), uncheckedText(a)].filter(Boolean).join(' · ');
