import { describe, expect, it } from 'vitest';
import { DEFAULTS } from '../../fender/defaults';
import { encodeConfig } from '../urlCodec';
import {
  clearHash,
  clearStorage,
  configForPersistence,
  isDefaultConfig,
  readStorage,
  resolveInitialConfig,
  writeHash,
  writeStorage,
  type HistoryLike,
  type LocationLike,
  type StorageLike
} from '../useFenderConfig';
import type { FenderConfig } from '../../fender/types';

/**
 * `useFenderConfig` needs a DOM to test end to end and `jsdom` is neither installed nor
 * allowed (PLAN's no-new-dependencies rule). So the hook is a thin wrapper — see its file
 * comment — over the plain functions exercised here with hand-written `StorageLike` /
 * `LocationLike` / `HistoryLike` stubs, exactly as WP5's pathPolys.test.ts stubbed
 * `document` instead of installing jsdom.
 *
 * NOT covered by these tests (would need a real DOM / React renderer):
 *   - the `useReducer`/`useEffect`/`useState` wiring inside `useFenderConfig` itself
 *   - the ~250ms debounce timer (`window.setTimeout`) around the hash write
 *   - `safeLocalStorage()`'s try/catch around a real Safari private-mode throw
 */

// ── Hand-written stubs ────────────────────────────────────────────────────────

function stubStorage(initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => (key in data ? (data[key] as string) : null),
    setItem: (key, value) => {
      data[key] = value;
    },
    removeItem: (key) => {
      delete data[key];
    }
  };
}

function throwingStorage(): StorageLike {
  return {
    getItem: () => {
      throw new Error('SecurityError: private mode');
    },
    setItem: () => {
      throw new Error('QuotaExceededError');
    },
    removeItem: () => {
      throw new Error('SecurityError: private mode');
    }
  };
}

function stubLocation(hash = '', pathname = '/flat-pack-fenders/', search = ''): LocationLike & {
  calls: string[];
} {
  const calls: string[] = [];
  const loc = { hash, pathname, search, calls };
  return loc;
}

function stubHistory(loc: LocationLike): HistoryLike & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    replaceState: (_data, _title, url) => {
      calls.push(url ?? '');
      if (url) {
        const hashIdx = url.indexOf('#');
        loc.hash = hashIdx === -1 ? '' : url.slice(hashIdx);
      }
    }
  };
}

// ── resolveInitialConfig — precedence: URL hash > localStorage > DEFAULTS ────────

describe('resolveInitialConfig', () => {
  it('falls back to DEFAULTS when both hash and storage are empty', () => {
    expect(resolveInitialConfig('', null)).toEqual(DEFAULTS);
    expect(resolveInitialConfig(undefined, undefined)).toEqual(DEFAULTS);
    expect(resolveInitialConfig('#', '')).toEqual(DEFAULTS);
  });

  it('uses localStorage when the hash is empty', () => {
    const stored: FenderConfig = { ...DEFAULTS, side: 'front' };
    expect(resolveInitialConfig('', encodeConfig(stored))).toEqual(stored);
    expect(resolveInitialConfig(undefined, encodeConfig(stored))).toEqual(stored);
  });

  it('prefers the URL hash over localStorage when both are present', () => {
    const fromHash: FenderConfig = { ...DEFAULTS, wheel: '26in' };
    const fromStorage: FenderConfig = { ...DEFAULTS, wheel: '650b' };
    const result = resolveInitialConfig(`#${encodeConfig(fromHash)}`, encodeConfig(fromStorage));
    expect(result).toEqual(fromHash);
  });

  it('a present-but-garbage hash still wins over valid storage (decodes to safe defaults)', () => {
    const fromStorage: FenderConfig = { ...DEFAULTS, wheel: '650b' };
    const result = resolveInitialConfig('#garbage-not-versioned', encodeConfig(fromStorage));
    expect(result).toEqual(DEFAULTS); // hash present → wins → malformed → decodes to DEFAULTS
  });
});

// ── isDefaultConfig / configForPersistence ───────────────────────────────────────

describe('isDefaultConfig / configForPersistence', () => {
  it('DEFAULTS is the default config', () => {
    expect(isDefaultConfig(DEFAULTS)).toBe(true);
    expect(configForPersistence(DEFAULTS)).toBeNull();
  });

  it('a single differing field makes it non-default', () => {
    const config: FenderConfig = { ...DEFAULTS, hem: true };
    expect(isDefaultConfig(config)).toBe(false);
    expect(configForPersistence(config)).toBe(encodeConfig(config));
  });

  it('a config equal to DEFAULTS field-by-field but a fresh object is still default', () => {
    const config: FenderConfig = { ...DEFAULTS };
    expect(isDefaultConfig(config)).toBe(true);
    expect(configForPersistence(config)).toBeNull();
  });
});

// ── readStorage / writeStorage / clearStorage — guarded and best-effort ──────────

describe('readStorage / writeStorage / clearStorage', () => {
  it('round-trips a value through a stub storage', () => {
    const storage = stubStorage();
    writeStorage(storage, 'k', 'v');
    expect(readStorage(storage, 'k')).toBe('v');
    clearStorage(storage, 'k');
    expect(readStorage(storage, 'k')).toBeNull();
  });

  it('returns null / no-ops when storage is undefined (SSR-safe)', () => {
    expect(readStorage(undefined, 'k')).toBeNull();
    expect(() => writeStorage(undefined, 'k', 'v')).not.toThrow();
    expect(() => clearStorage(undefined, 'k')).not.toThrow();
  });

  it('swallows a throwing storage (private-mode Safari) instead of throwing', () => {
    const storage = throwingStorage();
    expect(readStorage(storage, 'k')).toBeNull();
    expect(() => writeStorage(storage, 'k', 'v')).not.toThrow();
    expect(() => clearStorage(storage, 'k')).not.toThrow();
  });

  it('missing key reads back null', () => {
    expect(readStorage(stubStorage(), 'missing')).toBeNull();
  });
});

// ── writeHash / clearHash — replaceState only, never pushState ───────────────────

describe('writeHash / clearHash', () => {
  it('writes the encoded config as the URL hash via replaceState', () => {
    const loc = stubLocation();
    const history = stubHistory(loc);
    writeHash(history, loc, 'f1.front');
    expect(history.calls).toEqual(['/flat-pack-fenders/#f1.front']);
    expect(loc.hash).toBe('#f1.front');
  });

  it('clearHash removes the hash, keeping pathname and search', () => {
    const loc = stubLocation('#f1.front', '/flat-pack-fenders/', '?ref=x');
    const history = stubHistory(loc);
    clearHash(history, loc);
    expect(history.calls).toEqual(['/flat-pack-fenders/?ref=x']);
    expect(loc.hash).toBe('');
  });

  it('no-ops when history or location is missing (SSR-safe)', () => {
    const loc = stubLocation();
    const history = stubHistory(loc);
    expect(() => writeHash(undefined, loc, 'f1.front')).not.toThrow();
    expect(() => writeHash(history, undefined, 'f1.front')).not.toThrow();
    expect(() => clearHash(undefined, loc)).not.toThrow();
    expect(() => clearHash(history, undefined)).not.toThrow();
    expect(history.calls).toEqual([]);
  });

  it('every replaceState call in this module uses "replaceState", never "pushState"', () => {
    // writeHash/clearHash only ever call the HistoryLike.replaceState member — there is
    // no pushState in their signature at all, so misuse is a compile error, not a test.
    const loc = stubLocation();
    const history = stubHistory(loc);
    writeHash(history, loc, 'f1.rear');
    clearHash(history, loc);
    expect(history.calls).toHaveLength(2);
  });
});
