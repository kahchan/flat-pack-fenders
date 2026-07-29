import { describe, expect, it } from 'vitest';
import { exportFilename } from '../download';

describe('exportFilename', () => {
  it('appends the extension', () => {
    expect(exportFilename('fender-rear-700c-1351x106mm', 'svg')).toBe(
      'fender-rear-700c-1351x106mm.svg'
    );
    expect(exportFilename('fender-rear-700c-1351x106mm', 'dxf')).toBe(
      'fender-rear-700c-1351x106mm.dxf'
    );
  });
});
