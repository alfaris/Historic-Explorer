import { describe, expect, it } from 'vitest';
import { EMERGENCY, phrases, positionLink, positionText } from './help';

describe('help', () => {
  it("has Egypt's emergency numbers", () => {
    expect(EMERGENCY.map(e => [e.id, e.number])).toEqual([['ambulance', '123'], ['touristPolice', '126'], ['police', '122'], ['fire', '180']]);
  });
  it('writes the position to read out and to send', () => {
    expect(positionText({ lat: 30.0444196, lng: 31.2357116 })).toBe('30.04442, 31.23571');
    expect(positionLink({ lat: 30.0444196, lng: 31.2357116 })).toBe('https://maps.google.com/?q=30.04442,31.23571');
  });
  it('asks to be taken to the start of the walk when lost', () => {
    expect(phrases('باب زويلة').find(p => p.id === 'lost')!.ar).toBe('أنا تائه. من فضلك ساعدني في الوصول إلى: باب زويلة');
    expect(phrases().find(p => p.id === 'lost')!.ar).toBe('أنا تائه. من فضلك ساعدني.');
    expect(phrases().every(p => /[؀-ۿ]/.test(p.ar))).toBe(true);
  });
});
