/* TEEVI — couche application (PWA). Ne modifie pas le code existant. */
(function () {
  // 1. Service worker (hors-ligne + installation)
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
  // 2. Demande un stockage durable (évite que le navigateur efface tes données)
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

  // 3. Partage depuis TikTok : "Partager → TEEVI" ouvre "Nouvelle Idée" déjà remplie
  window.addEventListener('load', () => {
    const p = new URLSearchParams(location.search);
    const raw = [p.get('url'), p.get('text'), p.get('title')].filter(Boolean).join(' ');
    const link = (raw.match(/https?:\/\/\S+/) || [])[0];
    if (!link) return;
    const title = (p.get('title') || p.get('text') || '').replace(/https?:\/\/\S+/g, '').trim().slice(0, 60);
    history.replaceState(null, '', location.pathname);
    setTimeout(() => {
      openModal('addModal');
      document.getElementById('newUrl').value = link;
      document.getElementById('newTitle').value = title;
      document.getElementById('newTitle').focus();
    }, 700);
  });

  // 4. Anti-doublon à l'ajout
  const _add = window.addVideoIdea;
  window.addVideoIdea = function () {
    const clean = s => (s || '').trim().replace(/\/$/, '');
    const u = clean(document.getElementById('newUrl').value);
    if (u && u !== '#' && appData.videos.some(v => clean(v.url) === u)) { showToast('Déjà dans ta bibliothèque !', true); return; }
    _add();
  };

  // 5. Carte "Installer l'application" dans Options
  window.addEventListener('load', () => {
    if (matchMedia('(display-mode: standalone)').matches || navigator.standalone) return;
    const box = document.querySelector('#view-settings .space-y-8'); if (!box) return;
    const card = document.createElement('div');
    card.innerHTML = '<p class="text-xs text-gray-400 mb-3 font-bold uppercase tracking-widest pl-2">Application</p><div class="glass-effect rounded-[32px] p-5" id="install-card"></div>';
    box.prepend(card);
    const inner = card.querySelector('#install-card');
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (ios) {
      inner.innerHTML = '<p class="text-sm text-gray-200 text-center">Dans Safari : <b>Partager</b> puis <b>Sur l\'écran d\'accueil</b> pour installer TEEVI.</p>';
    } else {
      inner.innerHTML = '<p class="text-sm text-gray-300 text-center">Ouvre le menu ⋮ de ton navigateur puis « Installer l\'application ».</p>';
    }
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      inner.innerHTML = '<button class="w-full py-4 rounded-2xl bg-white text-black font-bold active:scale-95 transition-transform">Installer l\'application</button>';
      inner.firstChild.onclick = () => { e.prompt(); };
    });
  });
})();
