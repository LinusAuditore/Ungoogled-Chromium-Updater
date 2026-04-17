// Asset matching — pure function, no I/O.
//
// Filename conventions in the ungoogled-chromium release feeds:
//   macOS:    ..._arm64-macos.dmg   /   ..._x86_64-macos.dmg
//   Windows:  ...arm64...exe        /   ...x64...exe        /   ...x86...exe
//
// Each (os, arch) pair maps to one predicate over the lowercased filename.
// The match is precise on purpose — returning a mismatched architecture is
// worse than returning nothing, because the popup falls back to a clear
// "incompatible" message rather than handing the user a wrong installer.

const MATCHERS = {
  'mac:arm':    n => n.includes('arm64-macos')  && n.endsWith('.dmg'),
  'mac:arm64':  n => n.includes('arm64-macos')  && n.endsWith('.dmg'),
  'mac:x86-64': n => n.includes('x86_64-macos') && n.endsWith('.dmg'),

  'win:arm':    n => n.includes('arm64')                             && n.endsWith('.exe'),
  'win:arm64':  n => n.includes('arm64')                             && n.endsWith('.exe'),
  'win:x86-64': n => n.includes('x64') && !n.includes('arm64')       && n.endsWith('.exe'),
  'win:x86-32': n => n.includes('x86') && !n.includes('x64')
                                       && !n.includes('arm64')       && n.endsWith('.exe'),
};

export function findMatchingAsset(assets, os, arch) {
  const pred = MATCHERS[`${os}:${arch}`];
  if (!pred) return null;
  return assets.find(a => pred((a.name || '').toLowerCase())) || null;
}
