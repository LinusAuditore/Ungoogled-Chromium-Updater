// Popup: pure UI. Reads the local browser version here (needs navigator),
// asks the service worker for the latest release, and renders the comparison.

import { verGe } from './lib/version.js';

const BLOCKED_BRANDS = ['Google Chrome', 'Microsoft Edge', 'Brave', 'Opera', 'Vivaldi'];
// UA-string tokens present in commercial forks but not in plain Chromium.
const BLOCKED_UA_RE = /Edg\/|OPR\/|Vivaldi\/|YaBrowser\/|BraveBrowser\//;

// Returns the offending brand name if the environment is a known commercial
// fork, or null if the browser appears to be plain / Ungoogled Chromium.
function verifyBrowserEnvironment() {
  const uad = navigator.userAgentData;
  if (uad?.brands) {
    const hit = uad.brands.find(b => BLOCKED_BRANDS.includes(b.brand));
    if (hit) return hit.brand;
  }
  // Fallback: UA string heuristics (covers browsers that omit userAgentData).
  const ua = navigator.userAgent;
  const m = ua.match(BLOCKED_UA_RE);
  if (m) return m[0].replace('/', '');
  return null;
}

// Parse the Chromium version the browser itself is running.
// Prefer navigator.userAgentData (structured, high-entropy), fall back to the
// UA string. Ungoogled Chromium disables UA-Client-Hints by default, so the
// regex path is the realistic one — but try the modern API first anyway.
async function getLocalVersion() {
  const uad = navigator.userAgentData;
  if (uad && typeof uad.getHighEntropyValues === 'function') {
    try {
      const hev = await uad.getHighEntropyValues(['fullVersionList']);
      const list = hev.fullVersionList || uad.brands || [];
      const pick = list.find(b => /chromium/i.test(b.brand))
                || list.find(b => !/not.*a.*brand/i.test(b.brand));
      if (pick?.version) return pick.version;
    } catch {
      /* fall through */
    }
  }
  const m = navigator.userAgent.match(/Chrome\/([\d.]+)/);
  return m ? m[1] : '0.0.0';
}

const $ = id => document.getElementById(id);

function fmtBytes(n) {
  return n ? `${(n / 1048576).toFixed(1)} MB` : '';
}

function setStatus(text, kind) {
  const el = $('status');
  el.textContent = text;
  el.className = 'status' + (kind ? ' ' + kind : '');
}

function renderBlocked(brand) {
  document.body.innerHTML = `
    <div class="blocked">
      <div class="blocked-icon">⛔</div>
      <div class="blocked-title">Access Denied</div>
      <div class="blocked-msg">This updater only supports Ungoogled Chromium (or plain Chromium). The current browser has been identified as an unsupported commercial fork.</div>
      <div class="blocked-brand">${brand}</div>
    </div>`;
}

async function main() {
  const blockedBrand = verifyBrowserEnvironment();
  if (blockedBrand) {
    renderBlocked(blockedBrand);
    return;
  }

  const current = await getLocalVersion();
  $('current').textContent = current;

  let resp;
  try {
    resp = await chrome.runtime.sendMessage({ type: 'fetchLatest' });
  } catch (err) {
    setStatus(`Error: ${err.message || err}`, 'err');
    return;
  }

  if (!resp?.ok) {
    setStatus(`Error: ${resp?.error || 'unknown'}`, 'err');
    return;
  }

  const { os, arch, version, asset } = resp.data;
  $('latest').textContent = version;
  $('platform').textContent = `${os} / ${arch}`;

  if (!asset) {
    $('asset').textContent = '—';
    $('download').classList.add('hidden');
    setStatus('No compatible installer found for the current architecture.', 'err');
    return;
  }

  const size = fmtBytes(asset.size);
  $('asset').textContent = size ? `${asset.name} · ${size}` : asset.name;

  if (verGe(current, version)) {
    setStatus(`Up to date (${current} ≥ ${version}).`, 'ok');
    return;
  }

  setStatus(`Update available: ${current} → ${version}`, 'update');
  const btn = $('download');
  btn.href = asset.browser_download_url;
  btn.textContent = `Download ${asset.name}`;
  btn.classList.remove('hidden');
}

main();
