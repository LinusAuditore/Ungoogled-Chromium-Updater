// Popup: pure UI. Reads the local browser version here (needs navigator),
// asks the service worker for the latest release, and renders the comparison.

import { verGe } from './lib/version.js';

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

async function main() {
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
