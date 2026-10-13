(() => { const UPDATE = {"protocol":1,"assetsBase":"https://sihoon122.github.io/saebyeok-downloads/","manifestUrl":"https://sihoon122.github.io/saebyeok-downloads/version.json","publicKey":"MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAufazj3TsFF5JP2Ug98mT//IdaokB/+N6vbuJwyx+6es13ResrO+FSDDM7o+wCCvKUmBKHtOGzgj2ZA4EcjhmZr70WV3bL5Y1AWMmRhB3RbUlSVJ3bwLSgcpFXcWk4uLd0wah1qOtd5Csf/ztG+Q0FtBasPwYMpCPF1bels7PidZ5ZdQHy/+STzcFdAz2urfQRnjoCL3+XI/Br1JJ0haJPksJir/SFp0wbyqSye9Ga3Ohibo5EIB9LGu4WZWwpViCWeYBPpYZuS6ezt1LoKOV6EkHQ0h+A8PxDn3SQmDnfPIwJ5e87DddPNfFXRrtU/TSfxVJFLNas7LPIS7sxk987QIDAQAB","installUrl":"https://saebyeok-game.limsihoon.chatgpt.site/install","minApkCode":3906};
/** Shared signed web-asset format; never reads/writes game saves. */
const UPDATE_LIMITS = Object.freeze({ manifestBytes: 1048576, files: 2048, fileBytes: 16777216, totalBytes: 536870912 });
function safePath(value) {
  return typeof value === 'string' && value.length <= 240 && !/[\\%?#\x00-\x20\x7f:]/.test(value)
    && !value.startsWith('/') && value.split('/').every(p => p && p !== '.' && p !== '..' && !p.startsWith('.'))
    && /\.(?:html|js|mjs|css|json|webmanifest|png|webp|jpg|jpeg|gif|svg|ico|woff2?|ttf|otf|mp3|mp4|ogg|wav|txt)$/i.test(value);
}
function assertManifest(m, config, floor = 0) {
  if (!m || m.schema !== 1 || m.protocol !== 1 || !Number.isSafeInteger(m.release) || m.release < floor
      || m.saveVersion !== 17 || !Number.isSafeInteger(m.minApkCode) || m.minApkCode < 3906
      || !/^[a-f0-9]{64}$/.test(m.gameFingerprint) || !/^[a-f0-9]{64}$/.test(m.bundleFingerprint)
      || !Array.isArray(m.files) || !m.files.length || m.files.length > UPDATE_LIMITS.files) throw Error('Invalid update manifest');
  const seen = new Set(); let total = 0;
  const origin = new URL(config.assetsBase);
  if (origin.protocol !== 'https:' && !config.testOnly) throw Error('HTTPS required');
  for (const f of m.files) {
    if (!safePath(f.path) || seen.has(f.path) || !/^[a-f0-9]{64}$/.test(f.sha256)
        || !Number.isSafeInteger(f.bytes) || f.bytes < 0 || f.bytes > UPDATE_LIMITS.fileBytes) throw Error('Invalid update file');
    seen.add(f.path); total += f.bytes;
    const ext = f.path.slice(f.path.lastIndexOf('.')).toLowerCase();
    // Content-addressed URLs are prescribed, not supplied arbitrary destinations.
    const expected = new URL(`objects/${f.sha256}${ext}`, config.assetsBase).href;
    if (f.url !== expected || new URL(f.url).origin !== origin.origin) throw Error('Untrusted update URL');
  }
  if (total > UPDATE_LIMITS.totalBytes || !seen.has('index.html') || !seen.has('pwa.js') || !seen.has('build-info.json')) throw Error('Incomplete update manifest');
  if (m.apk) {
    const apk = new URL(m.apk.url);
    if (apk.protocol !== 'https:' || apk.username || apk.password || apk.search || apk.hash || !apk.href.startsWith('https://github.com/sihoon122/saebyeok-downloads/releases/download/') || !apk.pathname.endsWith('.apk')) throw Error('Untrusted APK URL');
  }
  return m;
}
async function readBounded(response, max) {
  const declared = Number(response.headers.get('Content-Length'));
  if (declared > max) throw Error('Download size limit');
  const reader = response.body.getReader(), chunks = []; let size = 0;
  try {
    while (true) { const {done,value} = await reader.read(); if (done) break; size += value.length;
      if (size > max) throw Error('Download size limit'); chunks.push(value); }
  } catch (error) { await reader.cancel().catch(() => {}); throw error; }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}
function decode64(s) {
  if (typeof s !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(s) || s.length % 4) throw Error('Invalid base64');
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
}
async function sha256(bytes) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
}
async function verifyEnvelope(envelope, config, floor = 0) {
  if (!envelope || typeof envelope.payload !== 'string' || envelope.payload.length > UPDATE_LIMITS.manifestBytes * 1.4) throw Error('Oversized update manifest');
  const payload = decode64(envelope.payload), signature = decode64(envelope.signature);
  const key = await crypto.subtle.importKey('spki', decode64(config.publicKey), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  if (!await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, payload)) throw Error('Invalid update signature');
  const m = assertManifest(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(payload)), config, floor);
  const records = m.files.map(f => `${f.path}:${f.sha256}:${f.bytes}`).sort().join('\n');
  if (await sha256(new TextEncoder().encode(records)) !== m.bundleFingerprint) throw Error('Invalid bundle fingerprint');
  return m;
}

window.saebyeokUpdateMetadata = async () => { const r = await fetch(UPDATE.manifestUrl + '?check=' + Date.now(), {cache:'no-store',credentials:'omit',redirect:'error'}); if (!r.ok) throw Error('Update unavailable'); return verifyEnvelope(JSON.parse(new TextDecoder().decode(await readBounded(r, 1572864))), UPDATE, 47); }; })();
(() => {
  if (document.documentElement.dataset.nativeApp === 'true') return;
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
  const base = new URL('./', document.currentScript.src);
  const send = type => {
    const worker = navigator.serviceWorker.controller;
    if (!worker) return;
    const channel = new MessageChannel();
    channel.port1.onmessage = ({ data }) => {
      channel.port1.close();
      if (data?.type !== 'UPDATED') return;
      const note = document.createElement('div'); note.textContent = '새 버전으로 업데이트됐어요';
      note.setAttribute('role', 'status');
      Object.assign(note.style, { position:'fixed', left:'50%', top:'calc(env(safe-area-inset-top) + 12px)', transform:'translateX(-50%)',
        zIndex:'2147483647', padding:'10px 14px', borderRadius:'12px', background:'#192b36', color:'#fff', fontSize:'14px', whiteSpace:'nowrap', pointerEvents:'none' });
      document.body.appendChild(note); setTimeout(() => note.remove(), 3200);
    };
    worker.postMessage({ type }, [channel.port2]);
    setTimeout(() => channel.port1.close(), 120000);
  };
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(new URL('sw.js', base), { scope: base.href, updateViaCache: 'none' })
      .then(registration => {
        window.saebyeokRegistration = registration; void registration.update().catch(() => {});
        // Download in the background; the running page stays pinned to its own bundle.
        send('CHECK_UPDATE');
        const started = Date.now();
        const boot = setInterval(() => {
          if (!document.getElementById('boot') && document.getElementById('ui-root')?.childElementCount) { clearInterval(boot); send('BOOT_READY'); }
          else if (Date.now() - started > 120000) { clearInterval(boot); send('BOOT_FAILED'); }
        }, 500);
      }).catch(() => {});
  }, { once: true });
  navigator.serviceWorker.addEventListener('controllerchange', () => send('CHECK_UPDATE'));
  // A lobby check is cheap and does not reload or swap an ongoing battle.
  setInterval(() => {
    const lobby = document.querySelector('.lbr');
    if (!document.hidden && lobby && lobby.getClientRects().length) send('CHECK_UPDATE');
  }, 600000);
})();
