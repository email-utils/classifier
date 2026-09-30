import { describe, expect, it } from 'vitest';
import { isKeyboard, type Keyboard, keyDistances } from '../src/keyboard';

function distance(keyboard: Keyboard, a: string, b: string): number {
  return keyDistances(keyboard)[a.charCodeAt(0) * 128 + b.charCodeAt(0)]!;
}

const keyboards: readonly Keyboard[] = ['qwerty', 'qwertz', 'azerty'];

describe('keyDistances', () => {
  it('counts neighbors in a row and above and below as one key', () => {
    for (const pair of ['gh', 'gt', 'gy', 'gv', 'gb', 'qa', 'az', '1q', 'p0']) {
      expect(distance('qwerty', pair[0]!, pair[1]!)).toBe(1);
    }
  });

  it('counts the keys between farther ones', () => {
    expect(distance('qwerty', 'g', 'g')).toBe(0);
    expect(distance('qwerty', 'g', 'r')).toBe(2);
    expect(distance('qwerty', 'c', 'g')).toBe(2);
    expect(distance('qwerty', 'l', 'f')).toBe(5);
  });

  it('follows each layout', () => {
    expect(distance('qwerty', 't', 'y')).toBe(1);
    expect(distance('qwertz', 't', 'z')).toBe(1);
    expect(distance('qwertz', 't', 'y')).toBeGreaterThan(1);
    expect(distance('azerty', 'm', 'l')).toBe(1);
    expect(distance('qwerty', 'm', 'l')).toBe(2);
    expect(distance('azerty', 'a', 'z')).toBe(1);
  });

  it('is symmetric and reaches every key on the layout', () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    for (const keyboard of keyboards) {
      for (const a of chars) {
        for (const b of chars) {
          const d = distance(keyboard, a, b);
          expect(d).toBe(distance(keyboard, b, a));
          expect(d).toBeLessThan(255);
        }
      }
    }
  });

  it('puts characters off the layout out of reach', () => {
    expect(distance('qwerty', '-', 'a')).toBe(255);
    expect(distance('qwerty', '.', '-')).toBe(255);
  });
});

describe('isKeyboard', () => {
  it('knows each layout and nothing else', () => {
    for (const keyboard of keyboards) {
      expect(isKeyboard(keyboard)).toBe(true);
    }
    for (const other of ['dvorak', 'toString', 'QWERTY', 1, undefined]) {
      expect(isKeyboard(other)).toBe(false);
    }
  });
});
