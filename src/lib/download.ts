/** Filename for an export, e.g. `exportFilename('fender-rear-700c-1351x106mm', 'svg')`. */
export function exportFilename(baseName: string, ext: 'svg' | 'dxf'): string {
  return `${baseName}.${ext}`;
}

/**
 * Blob + object-URL download, ported from the design source's `download()` helper
 * (fender.html:493-500). DOM-dependent — not unit-testable under plain `node`, so it
 * stays a thin wrapper around `exportFilename` (which is).
 */
export function downloadText(filename: string, text: string, mime: string): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
