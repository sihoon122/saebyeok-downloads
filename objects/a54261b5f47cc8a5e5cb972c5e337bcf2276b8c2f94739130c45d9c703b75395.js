(() => {
  let prompt;
  const el = id => document.getElementById(id);
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault(); prompt = event; el('install').textContent = '홈 화면에 설치';
    el('install-status').textContent = '버튼을 누르면 Chrome 설치 화면이 열립니다.';
  });
  window.addEventListener('appinstalled', () => { el('install-status').textContent = '홈 화면에 설치했습니다.'; });
  el('install').addEventListener('click', async () => {
    if (prompt) { await prompt.prompt(); await prompt.userChoice; prompt = null; }
    else el('install-status').textContent = 'Android Chrome: 메뉴 ⋮ → 홈 화면에 추가 → 설치. iPhone Safari: 공유 → 홈 화면에 추가.';
  });
  const readApk = async () => {
    try { const m = await window.saebyeokUpdateMetadata?.(); if (m?.apk?.ready) return {release:m.release, saveVersion:m.saveVersion, version:m.apk.version, url:m.apk.url, ready:true, apk:m.apk}; } catch {}
    const r = await fetch('./downloads/android.json', {cache:'no-store'}); if (!r.ok) throw Error('Download unavailable'); return r.json();
  };
  readApk().then(info => {
    if (!info.ready || !info.url) return;
    const a = el('apk'); a.href = info.url; a.classList.remove('disabled'); a.removeAttribute('aria-disabled');
    a.textContent = 'APK 내려받기'; a.rel = 'noopener';
    el('apk-status').textContent = `Version ${info.release ?? info.version} · 앱 ${info.apk.versionCode} · SAVE ${info.saveVersion} · ${(info.apk.bytes / 1048576).toFixed(1)} MB. Galaxy의 내 파일 앱에서 설치하세요.`;
  }).catch(() => {});
  el('offline').addEventListener('click', async () => {
    const button = el('offline'); const status = el('offline-status'); const progress = el('progress');
    if (!('serviceWorker' in navigator)) { status.textContent = '이 브라우저에서는 오프라인 설치를 지원하지 않습니다. Chrome으로 열어 주세요.'; return; }
    button.disabled = true; status.textContent = '오프라인 기능 준비 중…';
    try {
      const registration = await Promise.race([navigator.serviceWorker.ready, new Promise((_, reject) => setTimeout(() => reject(new Error('브라우저의 오프라인 설치를 사용할 수 없습니다. Chrome으로 다시 열어 주세요.')), 20000))]);
      const worker = registration.active;
      if (!worker) throw new Error('게임을 다시 열고 시도해 주세요.');
      const channel = new MessageChannel(); progress.hidden = false;
      channel.port1.onmessage = event => {
        const message = event.data;
        if (message.type === 'PROGRESS') { progress.max = message.total; progress.value = message.count; status.textContent = `게임 파일 받는 중 ${message.count} / ${message.total}`; }
        if (message.type === 'COMPLETE') { status.textContent = '모든 파일을 받았습니다. 인터넷 없이 게임을 열 수 있습니다.'; button.disabled = false; channel.port1.close(); }
        if (message.type === 'ERROR') { status.textContent = '파일 받기에 실패했습니다. 인터넷 연결 후 다시 시도하세요.'; button.disabled = false; channel.port1.close(); }
      };
      worker.postMessage({ type: 'CACHE_ALL' }, [channel.port2]);
    } catch (error) { status.textContent = error.message; button.disabled = false; }
  });
})();
