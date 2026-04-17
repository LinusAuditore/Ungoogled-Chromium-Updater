// Service worker: owns network I/O so the popup stays purely presentational.
// Popup → {type:'fetchLatest'} → service worker → GitHub → {ok, data|error}.

import { getPlatform, releaseApi } from './lib/platform.js';
import { findMatchingAsset } from './lib/assets.js';

async function fetchLatestRelease() {
  const { os, arch, repo } = await getPlatform();
  const resp = await fetch(releaseApi(repo), {
    headers: { 'Accept': 'application/vnd.github+json' },
  });
  if (!resp.ok) {
    throw new Error(`GitHub API HTTP ${resp.status} ${resp.statusText}`);
  }
  const data = await resp.json();
  const tag = data.tag_name || '';
  // Strip the "-1.1" style build suffix so the version compares cleanly
  // against what the browser reports in its UA string.
  const version = tag.split('-')[0].replace(/^v/, '') || '0.0.0';
  const asset = findMatchingAsset(data.assets || [], os, arch);
  return { os, arch, repo, version, tag, asset };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== 'fetchLatest') return false;
  fetchLatestRelease()
    .then(data => sendResponse({ ok: true, data }))
    .catch(err => sendResponse({ ok: false, error: String(err?.message || err) }));
  return true; // keep the channel open for the async response
});
