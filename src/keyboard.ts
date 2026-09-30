// Keyboard layouts for typo suggestions: how many keys apart two characters
// are, so that `gotmail` (G beside H) reads as a slip for `hotmail` but
// `lastmail` (L five keys from F) doesn't read as one for `fastmail`.

/** A keyboard layout that typo suggestions measure key distance on. */
export type Keyboard = 'qwerty' | 'qwertz' | 'azerty';

// Each layout's unshifted letters and digits, row by row. Only characters a
// hostname can hold matter, and `-` and `.` are left out: they sit in
// different places on each layout and rarely stand in for a letter.
const layouts: Readonly<Record<Keyboard, readonly string[]>> = {
  qwerty: ['1234567890', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm'],
  qwertz: ['1234567890', 'qwertzuiop', 'asdfghjkl', 'yxcvbnm'],
  azerty: ['1234567890', 'azertyuiop', 'qsdfghjklm', 'wxcvbn'],
};

// How far each row starts from the left, in key widths, as on an ANSI or
// ISO board. Two keys touch when their centers are under 1.3 widths apart:
// neighbors in a row are 1 apart, and each key touches two above and two
// below at 1.03 to 1.25.
const stagger = [0, 0.5, 0.75, 1.25];
const touching = 1.3;

// The distances for each layout, built on first use: 128 × 128 entries,
// one for each pair of ASCII codes, 255 for a character not on the layout.
const tables = new Map<Keyboard, Uint8Array>();

/** Whether `name` is a layout this module knows. @internal */
export function isKeyboard(name: unknown): name is Keyboard {
  return typeof name === 'string' && Object.hasOwn(layouts, name);
}

/**
 * The number of keys between each pair of ASCII characters on `keyboard`,
 * at `a * 128 + b`, counting each step to a touching key as one: 0 for the
 * same key, 1 for neighbors, and 255 when either isn't on the layout.
 *
 * @internal
 */
export function keyDistances(keyboard: Keyboard): Uint8Array {
  let table = tables.get(keyboard);
  if (table === undefined) {
    table = buildTable(layouts[keyboard]);
    tables.set(keyboard, table);
  }
  return table;
}

function buildTable(rows: readonly string[]): Uint8Array {
  const keys: { code: number; x: number; y: number }[] = [];
  rows.forEach((row, y) => {
    for (let i = 0; i < row.length; i++) {
      keys.push({ code: row.charCodeAt(i), x: i + stagger[y]!, y });
    }
  });
  const table = new Uint8Array(128 * 128).fill(255);
  // Breadth-first from each key over the keys it touches.
  for (const start of keys) {
    const seen = new Map([[start, 0]]);
    const queue = [start];
    for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
      const steps = seen.get(next)!;
      table[start.code * 128 + next.code] = steps;
      for (const key of keys) {
        if (
          !seen.has(key) &&
          Math.hypot(key.x - next.x, key.y - next.y) < touching
        ) {
          seen.set(key, steps + 1);
          queue.push(key);
        }
      }
    }
  }
  return table;
}
