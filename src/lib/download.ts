/** Filename for an export, e.g. `exportFilename('fender-rear-700c-1351x106mm', 'svg')`. */
export function exportFilename(baseName: string, ext: 'svg' | 'dxf' | 'pdf'): string {
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

/**
 * Same as `downloadText`, but for a byte buffer rather than a JS string — needed for
 * `pdf.ts`'s output. `new Blob([text])` UTF-8-encodes a string, which would corrupt any
 * byte above 0x7F (the PDF's WinAnsiEncoded text, and potentially its own binary
 * structure); handing `Blob` the `Uint8Array` directly avoids any text transcoding.
 */
export function downloadBinary(filename: string, bytes: Uint8Array<ArrayBuffer>, mime: string): void {
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
