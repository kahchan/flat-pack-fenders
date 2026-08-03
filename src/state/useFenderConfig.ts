import { useCallback, useEffect, useReducer, useState } from 'react';
import { CONFIG_ORDER, DEFAULTS } from '../fender/defaults';
import { SPIN_DEFAULT } from '../fender/isometric';
import { PRESETS } from './presets';
import { decodeConfig, encodeConfig } from './urlCodec';
import type { ConfigKey, FenderConfig } from '../fender/types';

const STORAGE_KEY = 'flat-pack-fenders:config';
const HASH_DEBOUNCE_MS = 250;

// ── Pure helpers — no React, testable in plain `node` without jsdom ──────────────

/** Structural subsets of `Storage`/`Location`/`History`, small enough to hand-stub. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface LocationLike {
  hash: string;
  pathname: string;
  search: string;
}

export interface HistoryLike {
  replaceState(data: unknown, title: string, url?: string | null): void;
}

function hasHashContent(h: string | null | undefined): boolean {
  if (!h) return false;
  const body = h.startsWith('#') ? h.slice(1) : h;
  return body.length > 0;
}

/** Precedence: URL hash > localStorage > DEFAULTS. Both inputs are untrusted strings —
 * `decodeConfig` already clamps/backfills, so a garbage hash still yields a valid config. */
export function resolveInitialConfig(
  hash: string | null | undefined,
  stored: string | null | undefined
): FenderConfig {
  if (hasHashContent(hash)) return decodeConfig(hash as string);
  if (hasHashContent(stored)) return decodeConfig(stored as string);
  return { ...DEFAULTS };
}

export function isDefaultConfig(config: FenderConfig): boolean {
  return CONFIG_ORDER.every((key) => config[key] === DEFAULTS[key]);
}

/** `null` means "at defaults — nothing worth persisting", the reset target. */
export function configForPersistence(config: FenderConfig): string | null {
  return isDefaultConfig(config) ? null : encodeConfig(config);
}

export function readStorage(storage: StorageLike | null | undefined, key: string): string | null {
  if (!storage) return null;
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(
  storage: StorageLike | null | undefined,
  key: string,
  value: string
): void {
  if (!storage) return;
  try {
    storage.setItem(key, value);
  } catch {
    /* private-mode / quota errors — persistence is best-effort */
  }
}

export function clearStorage(storage: StorageLike | null | undefined, key: string): void {
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    /* best-effort */
  }
}

/** `history.replaceState`, never `pushState` — see PLAN §6: the back button must not
 * become a slider undo. */
export function writeHash(
  history: HistoryLike | null | undefined,
  loc: LocationLike | null | undefined,
  encoded: string
): void {
  if (!history || !loc) return;
  history.replaceState(null, '', `${loc.pathname}${loc.search}#${encoded}`);
}

export function clearHash(
  history: HistoryLike | null | undefined,
  loc: LocationLike | null | undefined
): void {
  if (!history || !loc) return;
  history.replaceState(null, '', `${loc.pathname}${loc.search}`);
}

function safeLocalStorage(): StorageLike | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    return window.localStorage;
  } catch {
    // Safari private-mode throws merely touching localStorage in some old versions.
    return undefined;
  }
}

function initialConfig(): FenderConfig {
  if (typeof window === 'undefined') return { ...DEFAULTS };
  const stored = readStorage(safeLocalStorage(), STORAGE_KEY);
  return resolveInitialConfig(window.location.hash, stored);
}

// ── Reducer ────────────────────────────────────────────────────────────────────

type Action =
  | { type: 'set'; patch: Partial<FenderConfig> }
  | { type: 'preset'; config: FenderConfig }
  | { type: 'reset' };

function reducer(state: FenderConfig, action: Action): FenderConfig {
  switch (action.type) {
    case 'set':
      return { ...state, ...action.patch };
    case 'preset':
      return action.config;
    case 'reset':
      return { ...DEFAULTS };
    default:
      return state;
  }
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export interface UseFenderConfig {
  config: FenderConfig;
  setField: <K extends ConfigKey>(key: K, value: FenderConfig[K]) => void;
  applyPreset: (id: string) => void;
  reset: () => void;
  /** Isometric camera rotation, degrees. A view angle, not a fender — never persisted. */
  spin: number;
  setSpin: (spin: number) => void;
}

/**
 * `useReducer` over `FenderConfig`, synced to `location.hash` (debounced, replaceState
 * only) and localStorage. `spin` is plain `useState` — PLAN §6 scopes the URL/storage
 * contract to config alone, so the persistence effect below never reads it. SSR/test-safe:
 * every `window`/`localStorage` touch is behind the guards above, so importing this
 * module outside a browser never throws.
 */
export function useFenderConfig(): UseFenderConfig {
  const [config, dispatch] = useReducer(reducer, undefined, initialConfig);
  const [spin, setSpin] = useState(SPIN_DEFAULT);

  useEffect(() => {
    const encoded = configForPersistence(config);
    const storage = safeLocalStorage();
    if (encoded === null) clearStorage(storage, STORAGE_KEY);
    else writeStorage(storage, STORAGE_KEY, encoded);

    if (typeof window === 'undefined') return;
    const id = window.setTimeout(() => {
      if (encoded === null) clearHash(window.history, window.location);
      else writeHash(window.history, window.location, encoded);
    }, HASH_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [config]);

  const setField = useCallback(<K extends ConfigKey>(key: K, value: FenderConfig[K]) => {
    dispatch({ type: 'set', patch: { [key]: value } as Partial<FenderConfig> });
  }, []);

  const applyPreset = useCallback((id: string) => {
    const found = PRESETS.find((p) => p.id === id);
    if (found) dispatch({ type: 'preset', config: found.config });
  }, []);

  const reset = useCallback(() => dispatch({ type: 'reset' }), []);

  return { config, setField, applyPreset, reset, spin, setSpin };
}
