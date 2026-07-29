import { CONFIG_ORDER } from '../fender/defaults';
import type { FenderConfig } from '../fender/types';
import type { Preset } from '../state/presets';

/** Whether the live config is field-for-field identical to a preset — drives the
 * preset strip's selected-card treatment. */
export function presetMatchesConfig(preset: Preset, config: FenderConfig): boolean {
  return CONFIG_ORDER.every((key) => preset.config[key] === config[key]);
}
