// Version comparison — ported from ungoogled_chromium_updater.py.
//
// Upstream tags look like "130.0.6723.91-1.1": a Chromium version followed by
// an optional build-metadata suffix. We compare only the numeric segments
// before the first '-', padding shorter tuples with zeros.

// vtuple: '130.0.6723.91-1.1' -> [130, 0, 6723, 91]
// Strips build metadata after '-' and any leading 'v'. Non-numeric segments
// are silently dropped.
export function vtuple(versionStr) {
  const base = String(versionStr).split('-')[0].replace(/^v/, '');
  const parts = [];
  for (const seg of base.split('.')) {
    if (/^\d+$/.test(seg)) parts.push(parseInt(seg, 10));
  }
  return parts.length ? parts : [0];
}

// verGe: true iff version a >= version b (component-wise, zero-padded).
export function verGe(a, b) {
  const ta = vtuple(a);
  const tb = vtuple(b);
  const n = Math.max(ta.length, tb.length);
  while (ta.length < n) ta.push(0);
  while (tb.length < n) tb.push(0);
  for (let i = 0; i < n; i++) {
    if (ta[i] > tb[i]) return true;
    if (ta[i] < tb[i]) return false;
  }
  return true;
}
