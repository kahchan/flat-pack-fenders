import { CONFIG_ORDER, DEFAULTS, PARAM_SPECS } from '../fender/defaults';
import type { ConfigKey, FenderConfig, NumericSpec } from '../fender/types';

/**
 * `#f1.rear.20in.50.0.16...` — see PLAN §6. Fixed field order from `CONFIG_ORDER`,
 * `.`-separated, version-prefixed. `thick` travels as tenths (an integer) so no field
 * ever contains a `.`; every other numeric field already sits on an integer step per
 * `PARAM_SPECS`, so plain `Math.round` is enough for them.
 */
const VERSION = 'f1';

const strip = (hash: string): string => (hash.startsWith('#') ? hash.slice(1) : hash);

const encodeField = <K extends ConfigKey>(key: K, value: FenderConfig[K]): string => {
  const spec = PARAM_SPECS[key];
  if (spec.kind === 'boolean') return value ? '1' : '0';
  if (spec.kind === 'enum') return String(value);
  const n = value as number;
  return key === 'thick' ? String(Math.round(n * 10)) : String(Math.round(n));
};

/**
 * Trailing values equal to `DEFAULTS` are dropped — the decoder backfills them, so a
 * config that only tweaks its first few fields produces a short link.
 */
export function encodeConfig(c: FenderConfig): string {
  let end = CONFIG_ORDER.length;
  while (end > 0) {
    const key = CONFIG_ORDER[end - 1] as ConfigKey;
    if (c[key] !== DEFAULTS[key]) break;
    end--;
  }
  const fields = CONFIG_ORDER.slice(0, end).map((key) => encodeField(key, c[key]));
  return [VERSION, ...fields].join('.');
}

/** Digits after the decimal point in a step, e.g. `0.1` → 1, `5` → 0. */
function stepDecimals(step: number): number {
  const s = String(step);
  const dot = s.indexOf('.');
  return dot === -1 ? 0 : s.length - dot - 1;
}

/** Clamp to `[min,max]` and snap to `step`, matching the grid every slider walks. */
function clampToGrid(spec: NumericSpec, value: number): number {
  const steps = Math.round((value - spec.min) / spec.step);
  const snapped = spec.min + steps * spec.step;
  const clamped = Math.min(spec.max, Math.max(spec.min, snapped));
  const p = 10 ** stepDecimals(spec.step);
  return Math.round(clamped * p) / p;
}

/**
 * Decode one field. Untrusted input — any malformed, out-of-range, non-finite or
 * unknown-enum token falls back to that field's own default rather than aborting the
 * whole decode, so one bad field never drags the rest of a valid config down with it.
 */
function decodeField<K extends ConfigKey>(key: K, token: string | undefined): FenderConfig[K] {
  const spec = PARAM_SPECS[key];
  const fallback = DEFAULTS[key];
  if (token === undefined) return fallback;

  if (spec.kind === 'boolean') {
    if (token === '1') return true as FenderConfig[K];
    if (token === '0') return false as FenderConfig[K];
    return fallback;
  }

  if (spec.kind === 'enum') {
    return (spec.options as readonly string[]).includes(token)
      ? (token as FenderConfig[K])
      : fallback;
  }

  const raw = Number(token);
  if (!Number.isFinite(raw)) return fallback;
  const mm = key === 'thick' ? raw / 10 : raw;
  return clampToGrid(spec, mm) as FenderConfig[K];
}

/**
 * Never throws. Any hash that isn't exactly `f1.<fields…>` — wrong version, garbage,
 * empty string, a bare `#`, injected text, absurd lengths — falls back field-by-field
 * to `DEFAULTS`, so the result always feeds finite geometry through `geo()`.
 */
export function decodeConfig(hash: string): FenderConfig {
  const body = strip(hash);
  const tokens = body.split('.');

  if (tokens[0] !== VERSION) return { ...DEFAULTS };

  const entries = CONFIG_ORDER.map((key, i) => [key, decodeField(key, tokens[i + 1])] as const);
  return Object.fromEntries(entries) as unknown as FenderConfig;
}
