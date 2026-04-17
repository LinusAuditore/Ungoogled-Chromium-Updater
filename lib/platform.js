// Platform detection + API routing.
//
// chrome.runtime.getPlatformInfo() returns { os, arch, nacl_arch }.
//   os:   "mac" | "win" | "linux" | "android" | "cros" | "openbsd" | "fuchsia"
//   arch: "arm" | "arm64" | "x86-32" | "x86-64" | "mips" | "mips64"
//
// Ungoogled Chromium ships separate repos per OS; we route to the one that
// matches the host and use only its "releases/latest" endpoint.
const REPOS = {
  mac: 'ungoogled-software/ungoogled-chromium-macos',
  win: 'ungoogled-software/ungoogled-chromium-windows',
};

export async function getPlatform() {
  const info = await chrome.runtime.getPlatformInfo();
  const repo = REPOS[info.os];
  if (!repo) {
    throw new Error(`Unsupported platform: ${info.os} (only macOS and Windows are supported)`);
  }
  return { os: info.os, arch: info.arch, repo };
}

export function releaseApi(repo) {
  return `https://api.github.com/repos/${repo}/releases/latest`;
}
