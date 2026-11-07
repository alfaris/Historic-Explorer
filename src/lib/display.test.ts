import { describe, expect, it } from 'vitest';
import { displayAttributes, readDisplay, resolvedTheme } from './display';

describe('readDisplay', () => {
  it('reads stored preferences', () => {
    expect(readDisplay('{"text":"larger","contrast":true}', false)).toEqual({ text: 'larger', contrast: true, theme: 'auto' });
  });
  it('defaults to standard text, and high contrast when the device asks for it', () => {
    expect(readDisplay(null, false)).toEqual({ text: 'standard', contrast: false, theme: 'auto' });
    expect(readDisplay(null, true)).toEqual({ text: 'standard', contrast: true, theme: 'auto' });
  });
  it('ignores unreadable or unknown values', () => {
    expect(readDisplay('nope', false)).toEqual({ text: 'standard', contrast: false, theme: 'auto' });
    expect(readDisplay('{"text":"huge"}', true)).toEqual({ text: 'standard', contrast: true, theme: 'auto' });
  });
});

describe('displayAttributes', () => {
  it('maps preferences to the attributes index.css reads', () => {
    expect(displayAttributes({ text: 'large', contrast: true, theme: 'dark' })).toEqual({ 'data-text': 'large', 'data-contrast': 'more', 'data-theme': 'dark' });
    expect(displayAttributes({ text: 'standard', contrast: false, theme: 'auto' }, true)).toEqual({ 'data-text': 'standard', 'data-contrast': 'standard', 'data-theme': 'dark' });
  });
});

describe('theme', () => {
  it('is read from storage, and auto by default', () => {
    expect(readDisplay('{"theme":"dark"}', false).theme).toBe('dark');
    expect(readDisplay('{"theme":"sepia"}', false).theme).toBe('auto');
  });
  it('auto follows the phone; light and dark are fixed', () => {
    expect(resolvedTheme({ text: 'standard', contrast: false, theme: 'auto' }, true)).toBe('dark');
    expect(resolvedTheme({ text: 'standard', contrast: false, theme: 'auto' }, false)).toBe('light');
    expect(resolvedTheme({ text: 'standard', contrast: false, theme: 'light' }, true)).toBe('light');
    expect(resolvedTheme({ text: 'standard', contrast: false, theme: 'dark' }, false)).toBe('dark');
  });
});
