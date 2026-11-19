// Shared helpers for the golden vectors in contracts/vectors: JSON files of
// inputs and the web's outputs, which the native apps' ports are checked
// against. Each file has `about`, its inputs, then `cases`. Only semantic values
// (instants, minutes, IDs, enums, states) are recorded; formatted text differs
// by platform and isn't part of these files.

export interface VectorFile {
  about: string;
  [key: string]: unknown;
}

export interface VectorSet {
  /** File name under contracts/vectors, without .json. */
  name: string;
  build: () => VectorFile | Promise<VectorFile>;
}

/** An instant as written in the vectors: ISO 8601 in UTC, to the minute. */
export const iso = (d: Date) => d.toISOString().replace(':00.000Z', 'Z');
export const at = (s: string) => new Date(s);

/** A seeded random source (mulberry32), so a case that takes randomness lists the numbers it drew. */
export function seeded(seed: number) {
  let a = seed >>> 0;
  const drawn: number[] = [];
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    drawn.push(r);
    return r;
  };
  return { next, drawn };
}

/** The file's text: two-space JSON, each case on one line so a diff shows which changed. */
export function vectorText(file: VectorFile): string {
  const { cases, ...head } = file as VectorFile & { cases?: unknown[] };
  const top = JSON.stringify(head, null, 2);
  if (!cases) return `${top}\n`;
  const rows = cases.map(c => `    ${JSON.stringify(c)}`).join(',\n');
  return `${top.replace(/\n}$/, `,\n  "cases": [\n${rows}\n  ]\n}`)}\n`;
}
