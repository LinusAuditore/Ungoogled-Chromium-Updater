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

const i18n = chrome.i18n.getMessage.bind(chrome.i18n);
const $    = id => document.getElementById(id);

// Apply i18n strings to all elements carrying a data-i18n attribute.
function localiseDOM() {
  document.title = i18n('popupTitle');
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = i18n(el.dataset.i18n);
  });
}

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
      <div class="blocked-title">${i18n('blockedTitle')}</div>
      <div class="blocked-msg">${i18n('blockedMsg')}</div>
      <div class="blocked-brand">${brand}</div>
    </div>`;
}

async function main() {
  localiseDOM();

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
    setStatus(i18n('statusError', [err.message || String(err)]), 'err');
    return;
  }

  if (!resp?.ok) {
    setStatus(i18n('statusError', [resp?.error || 'unknown']), 'err');
    return;
  }

  const { os, arch, version, asset } = resp.data;
  $('latest').textContent = version;
  $('platform').textContent = `${os} / ${arch}`;

  if (!asset) {
    $('asset').textContent = '—';
    $('download').classList.add('hidden');
    setStatus(i18n('statusNoAsset'), 'err');
    return;
  }

  const size = fmtBytes(asset.size);
  $('asset').textContent = size ? `${asset.name} · ${size}` : asset.name;

  if (verGe(current, version)) {
    setStatus(i18n('statusUpToDate', [current, version]), 'ok');
    return;
  }

  setStatus(i18n('statusUpdateAvailable', [current, version]), 'update');
  const btn = $('download');
  btn.href = asset.browser_download_url;
  btn.textContent = i18n('downloadBtn', [asset.name]);
  btn.classList.remove('hidden');
}

main();
