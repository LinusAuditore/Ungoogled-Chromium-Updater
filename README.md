# Ungoogled Chromium Updater

A Manifest V3 browser extension that checks the [Ungoogled Chromium](https://github.com/ungoogled-software) GitHub release feed and surfaces a direct download link for the build matching the current platform and architecture.

The extension does **not** download, install, or modify any files on disk. It is strictly an informational tool: it compares the running browser's version against the latest published release and, when an update is available, presents the correct asset URL for the user to download manually.

## Features

- **Automatic platform routing.** `chrome.runtime.getPlatformInfo()` determines the host OS and routes to the corresponding upstream repository:
  - macOS → `ungoogled-software/ungoogled-chromium-macos`
  - Windows → `ungoogled-software/ungoogled-chromium-windows`
- **Precise asset matching** across architectures:

  | OS      | Architecture         | Asset pattern                                    |
  | ------- | -------------------- | ------------------------------------------------ |
  | macOS   | `arm` / `arm64`      | filename contains `arm64-macos`, ends `.dmg`     |
  | macOS   | `x86-64`             | filename contains `x86_64-macos`, ends `.dmg`    |
  | Windows | `arm` / `arm64`      | filename contains `arm64`, ends `.exe`           |
  | Windows | `x86-64`             | contains `x64`, excludes `arm64`, ends `.exe`    |
  | Windows | `x86-32`             | contains `x86`, excludes `x64`/`arm64`, ends `.exe` |

- **Tolerant version detection.** The local version is parsed from `navigator.userAgentData` when available, falling back to a regex over `navigator.userAgent` — the realistic path under Ungoogled Chromium, which disables UA-Client-Hints by default.
- **Version comparison** ported from the upstream Python updater: numeric-component tuples, zero-padded, with build-metadata suffixes (`-1.1`) stripped before comparison.
- **Clear failure modes.** If no asset matches the current architecture, the popup displays `No compatible installer found for the current architecture.` and hides the download button rather than offering a mismatched installer.

## Installation

The extension is distributed as an unpacked source tree. To load it:

1. Clone or download this repository to a local directory.
2. Open `chrome://extensions` (or the equivalent URL in any Chromium-based browser).
3. Enable **Developer mode** using the toggle in the top-right corner.
4. Click **Load unpacked** and select the repository root (the directory containing `manifest.json`).
5. Pin the extension icon to the toolbar and click it to open the popup.

The popup queries the GitHub Releases API on each open; no background polling or persistent state is used.

## Architecture

The codebase is split along a strict I/O boundary: the service worker owns all network access, the popup is a pure presentation layer, and the core algorithms live in dependency-free modules under `lib/`.

```
ChromiumUpdater_ext/
├── manifest.json        MV3 declaration
├── background.js        Service worker — message broker + GitHub fetch
├── popup.html           Popup markup
├── popup.css            Popup styles
├── popup.js             Popup controller — reads local UA, renders state
└── lib/
    ├── version.js       vtuple / verGe — numeric version comparison
    ├── platform.js      OS → repository routing
    └── assets.js        findMatchingAsset — (os, arch) → asset predicate
```

### Data flow

1. The popup opens and reads the local browser version via `navigator.userAgentData` (with a `navigator.userAgent` fallback).
2. The popup sends a `{type: 'fetchLatest'}` message to the service worker.
3. The service worker calls `chrome.runtime.getPlatformInfo()`, issues a single `fetch` to the correct `releases/latest` endpoint, runs `findMatchingAsset` against the asset list, and returns `{os, arch, version, tag, asset}`.
4. The popup compares versions with `verGe` and renders either an up-to-date notice or a direct download link.

All modules under `lib/` are pure functions with no side effects, which keeps version-comparison and asset-matching logic trivially testable in isolation.

## Permissions

The extension follows the principle of least privilege. `manifest.json` declares:

- **`host_permissions: ["https://api.github.com/*"]`** — required to call the GitHub Releases API from the service worker.

No other permissions are requested. The extension does **not** declare `tabs`, `activeTab`, `storage`, `scripting`, `downloads`, `cookies`, `webRequest`, or any content-script injection. It cannot read the pages you visit, track browsing activity, or persist data across sessions.

The only outbound request is `GET https://api.github.com/repos/ungoogled-software/ungoogled-chromium-{macos,windows}/releases/latest`, made on popup open.

## License

Released under the BSD 2-Clause License. See [`LICENSE`](LICENSE) for the full text.
