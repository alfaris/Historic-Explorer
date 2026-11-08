import { describe, expect, it } from 'vitest';
import { bundledContent } from '../data/content';
import { setCurrentLang } from '../i18n/lang';
import { walkStops } from './walk';
import { accessSummary, hasAccessInfo, routeAccess, stepFreeShare } from './step-free';

const route = bundledContent.routes[0];
const stops = walkStops(bundledContent.places, route.id);
const marks: Record<number, 'yes' | 'partial' | 'no'> = { [stops[0].id]: 'yes', [stops[1].id]: 'yes', [stops[2].id]: 'partial', [stops[3].id]: 'no' };
const places = bundledContent.places.map(p => (marks[p.id] ? { ...p, tips: { ...p.tips, wheelchair: marks[p.id] } } : p));

describe('routeAccess', () => {
  it("counts the route's stops by access, with the unchecked ones in walking order", () => {
    const a = routeAccess(places, route.id);
    expect({ total: a.total, yes: a.yes, partial: a.partial, no: a.no }).toEqual({ total: stops.length, yes: 2, partial: 1, no: 1 });
    expect(a.unchecked.map(p => p.id)).toEqual(stops.slice(4).map(p => p.id));
    expect(stepFreeShare(a)).toBeCloseTo(2.5 / stops.length);
  });
  it('has no summary until a stop is checked', () => {
    expect(hasAccessInfo(routeAccess(bundledContent.places.map(p => ({ ...p, tips: undefined })), route.id))).toBe(false);
    expect(hasAccessInfo(routeAccess(places, route.id))).toBe(true);
    expect(hasAccessInfo(routeAccess(places, 'no-such-route'))).toBe(false);
  });
});

describe('accessSummary', () => {
  const a = routeAccess(places, route.id);
  const left = stops.length - 4;
  it('reads in every language', () => {
    setCurrentLang('en');
    expect(accessSummary(a)).toBe(`Step-free: 2 of ${stops.length} stops · 1 partly · ${left} not yet checked`);
    setCurrentLang('ar');
    expect(accessSummary(a)).toBe(`بدون درجات: 2 من ${stops.length} ${stops.length >= 3 && stops.length <= 10 ? "محطات" : "محطة"} · 1 جزئيًا · ${left} لم يُتحقق منها بعد`);
    setCurrentLang('fr');
    expect(accessSummary(a)).toBe(`De plain-pied : 2 étapes sur ${stops.length} · 1 en partie · ${left} pas encore vérifiées`);
    setCurrentLang('es');
    expect(accessSummary(a)).toBe(`Sin escalones: 2 de ${stops.length} paradas · 1 en parte · ${left} sin comprobar todavía`);
    setCurrentLang('en');
  });
  it('leaves out the parts that are zero', () => {
    const all = routeAccess(bundledContent.places.map(p => (p.routeId === route.id ? { ...p, tips: { wheelchair: 'yes' as const } } : p)), route.id);
    expect(accessSummary(all)).toBe(`Step-free: ${stops.length} of ${stops.length} stops`);
  });
});
