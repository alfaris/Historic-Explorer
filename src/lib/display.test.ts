import { describe, expect, it } from 'vitest';
import { displayAttributes, readDisplay } from './display';

describe('readDisplay', () => {
  it('reads stored preferences', () => {
    expect(readDisplay('{"text":"larger","contrast":true}', false)).toEqual({ text: 'larger', contrast: true });
  });
  it('defaults to standard text, and high contrast when the device asks for it', () => {
    expect(readDisplay(null, false)).toEqual({ text: 'standard', contrast: false });
    expect(readDisplay(null, true)).toEqual({ text: 'standard', contrast: true });
  });
  it('ignores unreadable or unknown values', () => {
    expect(readDisplay('nope', false)).toEqual({ text: 'standard', contrast: false });
    expect(readDisplay('{"text":"huge"}', true)).toEqual({ text: 'standard', contrast: true });
  });
});

describe('displayAttributes', () => {
  it('maps preferences to the attributes index.css reads', () => {
    expect(displayAttributes({ text: 'large', contrast: true })).toEqual({ 'data-text': 'large', 'data-contrast': 'more' });
    expect(displayAttributes({ text: 'standard', contrast: false })).toEqual({ 'data-text': 'standard', 'data-contrast': 'standard' });
  });
});
