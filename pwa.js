/* TEEVI — couche application (PWA). Ne modifie pas le code existant. */
(function () {
  // 1. Service worker (hors-ligne + installation)
  if ('serviceWorker' in navigator) {
    // Mise à jour automatique : recharge une fois quand une nouvelle version prend le relais
    const hadController = !!navigator.serviceWorker.controller; let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !reloaded) { reloaded = true; location.reload(); } });
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').then(reg => {
      document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
    }).catch(() => {}));
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

/* ===== TEEVI+ : modifier, notes, tags perso, statuts, miniatures, sauvegarde, thèmes, hasard ===== */
(function () {
  const BASE = ['Tendance', 'Humour', 'Storytime', 'Beauté', 'Autre'];
  const STATUS = { todo: 'À voir', progress: 'En cours', inspired: 'Inspirée', made: 'Réalisée' };
  const INPUT = 'w-full bg-black/40 border border-white/10 rounded-2xl py-3 px-4 text-white focus:outline-none focus:border-white';
  const BTN = 'py-3 rounded-2xl bg-white/10 font-bold active:scale-95 transition-transform';
  const $ = id => document.getElementById(id);
  const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const custom = () => (appData.settings.customTags = appData.settings.customTags || []);
  const allTags = () => BASE.concat(custom());
  const tagsOf = v => (v.tags && v.tags.length ? v.tags : [v.tag || 'Autre']);
  const cleanTag = s => (s || '').replace(/['"<>&\\]/g, '').trim().slice(0, 20);
  const findTag = t => allTags().find(x => x.toLowerCase() === t.toLowerCase()) || t;

  const css = el('style'); css.textContent = 'body.t-forest{--bg-color-1:#052e16;--bg-color-2:#010a04}body.t-violet{--bg-color-1:#2e1065;--bg-color-2:#0f0525}';
  document.head.appendChild(css);

  // ---- Surcharges (filtre multi-tags, recherche, fond miniature, carte) ----
  window.getSortedVideos = function (activeOnly) {
    const f = appData.settings.activeFilter;
    let list = appData.videos.filter(v => activeOnly ? !appData.state[v.id]?.done : !!appData.state[v.id]?.done);
    if (f !== 'Tous' && activeOnly) list = list.filter(v => tagsOf(v).includes(f));
    return list.sort((a, b) => b.date - a.date);
  };
  window.handleSearch = function (val) {
    const q = val.toLowerCase().trim(), cb = $('clearSearchBtn');
    cb.classList.toggle('hidden', !q); cb.classList.toggle('flex', !!q);
    const res = appData.videos.filter(v => (v.title || '').toLowerCase().includes(q) || tagsOf(v).some(t => t.toLowerCase().includes(q)) || (v.note || '').toLowerCase().includes(q));
    const g = $('search-grid');
    if (!res.length) { g.innerHTML = '<p class="col-span-2 text-gray-400 text-sm py-4">Aucun résultat trouvé.</p>'; return; }
    g.innerHTML = res.map(v => renderCardHTML(v, appData.state[v.id]?.done, false, true)).join(''); lucide.createIcons();
  };
  const _bg = window.getBgStyle;
  window.getBgStyle = function (id) {
    const v = appData.videos.find(x => x.id === id);
    if (v && v.thumb) return "background: url('" + encodeURI(v.thumb).replace(/'/g, '%27') + "') center/cover no-repeat, linear-gradient(145deg,#222,#0a0a0a);";
    return _bg(id);
  };
  const _card = window.renderCardHTML;
  window.renderCardHTML = function (v, isDone, sp, ig) {
    let h = _card(v, isDone, sp, ig);
    const st = isDone ? 'made' : (v.pstatus || 'todo');
    const lab = st !== 'todo' ? STATUS[st] : '';
    const badge = (lab || v.note) ? '<div class="absolute bottom-14 left-0 right-0 z-20 flex justify-center gap-1 pointer-events-none">' +
      (lab ? '<span class="text-[9px] font-bold px-2 py-0.5 rounded-full bg-black/50 backdrop-blur">' + lab + '</span>' : '') +
      (v.note ? '<span class="text-[9px] px-1.5 py-0.5 rounded-full bg-black/50 backdrop-blur">📝</span>' : '') + '</div>' : '';
    h = h.replace(/<div class="absolute top-2 right-2 z-20 flex gap-1">[\s\S]*?<\/div>/,
      '<div class="absolute top-2 right-2 z-20"><button onclick="openEdit(event,' + v.id + ')" class="w-8 h-8 rounded-full glass-effect flex items-center justify-center active:scale-90 hover:bg-white/20" title="Modifier">✏️</button></div>');
    return h.replace('<!-- Le titre est échappé -->', badge);
  };

  // ---- Ajout rapide : colle le lien du presse-papiers ----
  const _open = window.openModal;
  window.openModal = function (id) {
    _open(id);
    if (id === 'addModal' && navigator.clipboard && navigator.clipboard.readText) {
      navigator.clipboard.readText().then(t => {
        const m = (t || '').match(/https?:\/\/\S+/), u = $('newUrl');
        if (m && u && !u.value && /tiktok|instagram|youtu/i.test(m[0])) u.value = m[0];
      }).catch(() => {});
    }
  };

  // ---- Sauvegarde : partage iOS + rappel ----
  const LB = 'teevi_lastBackup';
  function bkText() {
    const s = $('bk-status'); if (!s) return; const t = +localStorage.getItem(LB);
    if (!t) { s.textContent = '⚠️ Aucune sauvegarde faite'; s.className = 'text-sm text-center font-bold text-red-400'; return; }
    const d = Math.floor((Date.now() - t) / 864e5);
    s.textContent = 'Dernière sauvegarde : ' + (d < 1 ? "aujourd'hui" : 'il y a ' + d + ' jour' + (d > 1 ? 's' : ''));
    s.className = 'text-sm text-center font-bold ' + (d > 7 ? 'text-red-400' : 'text-green-400');
  }
  const markBackup = () => { localStorage.setItem(LB, Date.now()); bkText(); };
  const _exp = window.exportData;
  window.exportData = async function () {
    const name = 'MaBibliotheque_Sauvegarde_' + new Date().toISOString().split('T')[0] + '.json';
    const file = new File([JSON.stringify(appData)], name, { type: 'application/json' });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); markBackup(); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    _exp(); markBackup();
  };

  // ---- Miniatures automatiques (TikTok oEmbed, selon autorisation du navigateur) ----
  async function fetchThumbs(force) {
    let ok = 0, tried = 0;
    for (const v of appData.videos) {
      if (!/^https?:/.test(v.url || '') || appData.state[v.id]?.photo || (!force && v.thumb)) continue;
      if (!force && v.thumbTry && Date.now() - v.thumbTry < 6048e5) continue;
      if (++tried > 60) break;
      v.thumbTry = Date.now();
      try { const j = await (await fetch('https://www.tiktok.com/oembed?url=' + encodeURIComponent(v.url))).json(); if (j.thumbnail_url) { v.thumb = j.thumbnail_url; ok++; } } catch (e) {}
    }
    if (tried) { saveData(); renderApp(); }
    return { ok, tried };
  }

  // ---- Tags : barre d'accueil + menu d'ajout ----
  function refreshTagUI() {
    const bar = $('tags-bar'); if (!bar) return;
    const names = ['Humour', 'Storytime', 'Tendance', 'Beauté'].concat(custom());
    if (appData.videos.some(v => tagsOf(v).includes('Autre'))) names.push('Autre');
    bar.innerHTML = '';
    [['Tous', 'Tout']].concat(names.map(n => [n, n])).forEach(([k, l]) => {
      const b = el('button', 'tag-pill glass-effect', l); b.id = 'tag-' + k; b.onclick = () => setFilter(k); bar.appendChild(b);
    });
    updateFilterUI();
    const sel = $('newTag');
    if (sel) { const cur = sel.value; sel.innerHTML = ''; allTags().forEach(n => { const o = el('option', '', n); o.value = n; sel.appendChild(o); }); if (allTags().includes(cur)) sel.value = cur; }
  }

  // ---- Fenêtre "Modifier" ----
  let editId = null, editTags = [], oldUrl = '';
  function chips() {
    const box = $('eTags'); box.innerHTML = '';
    allTags().forEach(n => {
      const on = editTags.includes(n);
      const b = el('button', 'px-3 py-1.5 rounded-full text-xs font-bold border ' + (on ? 'bg-white text-black border-white' : 'bg-white/10 text-white border-white/20'), n);
      b.onclick = () => { editTags = on ? editTags.filter(x => x !== n) : editTags.concat(n); chips(); };
      box.appendChild(b);
    });
  }
  function buildEdit() {
    if ($('editModal')) return;
    const m = el('div', 'fixed inset-0 bg-black/80 backdrop-blur-md z-[160] hidden flex-col items-center justify-center p-4'); m.id = 'editModal';
    m.innerHTML = '<div class="glass-effect rounded-3xl w-full max-w-[340px] max-h-[88vh] overflow-y-auto p-6 shadow-2xl modal-content">' +
      '<h2 class="text-xl font-bold mb-4 text-center">Modifier</h2><div class="space-y-3">' +
      '<input id="eTitle" type="text" placeholder="Titre" class="' + INPUT + '">' +
      '<input id="eUrl" type="url" placeholder="Lien" class="' + INPUT + '">' +
      '<select id="eStatus" class="' + INPUT + ' appearance-none">' + Object.keys(STATUS).map(k => '<option value="' + k + '">' + STATUS[k] + '</option>').join('') + '</select>' +
      '<div id="eTags" class="flex flex-wrap gap-2"></div>' +
      '<div class="flex gap-2"><input id="eNewTag" type="text" placeholder="Nouveau tag" class="' + INPUT + '"><button id="eAddTag" class="px-5 ' + BTN + '">+</button></div>' +
      '<textarea id="eNote" rows="3" placeholder="Note / idée…" class="' + INPUT + '"></textarea>' +
      '<textarea id="eTrans" rows="4" placeholder="Transcription (colle ici le texte de la vidéo)…" class="' + INPUT + '"></textarea>' +
      '<select id="eGal" class="' + INPUT + ' appearance-none"></select>' +
      '<button id="eViewGal" class="hidden w-full text-sm ' + BTN + '">Voir ma réalisation</button>' +
      '<div class="flex gap-2"><button id="eCover" class="flex-1 text-sm ' + BTN + '">🖼 Affiche</button><button id="eDel" class="flex-1 text-sm text-red-400 ' + BTN + '">🗑 Supprimer</button></div>' +
      '</div><div class="flex gap-3 mt-5"><button id="eCancel" class="flex-1 ' + BTN + '">Annuler</button><button id="eSave" class="flex-1 py-3 rounded-2xl bg-white text-black font-bold active:scale-95">Enregistrer</button></div></div>';
    document.body.appendChild(m);
    $('eAddTag').onclick = () => {
      const t = cleanTag($('eNewTag').value); if (!t) return; const n = findTag(t);
      if (!allTags().includes(n)) custom().push(n);
      if (!editTags.includes(n)) editTags.push(n);
      $('eNewTag').value = ''; chips(); refreshTagUI(); saveData();
    };
    $('eGal').onchange = () => $('eViewGal').classList.toggle('hidden', !$('eGal').value);
    $('eViewGal').onclick = () => { const g = Number($('eGal').value); closeModal('editModal'); switchView('studio'); setTimeout(() => openMedia(g), 400); };
    $('eCancel').onclick = () => closeModal('editModal');
    $('eCover').onclick = () => { closeModal('editModal'); triggerCoverUpload(null, editId); };
    $('eDel').onclick = () => { const id = editId; closeModal('editModal'); deleteVideo(null, id); };
    $('eSave').onclick = () => {
      const v = appData.videos.find(x => x.id === editId); if (!v) return;
      const t = $('eTitle').value.trim(); if (!t) { showToast('Titre requis !', true); return; }
      v.title = t; v.url = $('eUrl').value.trim() || '#';
      if (v.url !== oldUrl) { delete v.thumb; delete v.thumbTry; }
      v.tags = editTags.length ? editTags.slice() : ['Autre']; v.tag = v.tags[0];
      v.note = $('eNote').value.trim(); v.transcription = $('eTrans').value.trim();
      const s = $('eStatus').value; v.pstatus = s === 'made' ? 'todo' : s;
      v.galleryId = $('eGal').value ? Number($('eGal').value) : null;
      const st = appData.state[v.id] = appData.state[v.id] || {}, want = s === 'made';
      if (want !== !!st.done) { st.done = want; if (want) st.doneDate = Date.now(); }
      saveData(); refreshTagUI(); renderApp(); closeModal('editModal'); showToast('Modifié !');
    };
  }
  window.openEdit = function (event, id) {
    if (event) event.stopPropagation(); triggerHaptic();
    const v = appData.videos.find(x => x.id === id); if (!v) return;
    editId = id; editTags = tagsOf(v).slice(); oldUrl = v.url || '';
    $('eTitle').value = v.title || ''; $('eUrl').value = v.url === '#' ? '' : (v.url || ''); $('eNote').value = v.note || ''; $('eTrans').value = v.transcription || '';
    $('eStatus').value = appData.state[id]?.done ? 'made' : (v.pstatus || 'todo');
    const g = $('eGal'); g.innerHTML = '<option value="">Aucune réalisation liée</option>';
    appData.gallery.forEach(i => { const o = el('option', '', i.title || 'Réalisation'); o.value = i.id; g.appendChild(o); });
    g.value = v.galleryId || ''; $('eViewGal').classList.toggle('hidden', !g.value);
    chips(); openModal('editModal');
  };

  // ---- Carte "Outils" dans Options + thèmes ----
  function myTags() {
    const b = $('mytags'); if (!b) return; b.innerHTML = '';
    custom().forEach(t => {
      const x = el('button', 'px-3 py-1.5 rounded-full text-xs font-bold bg-white/10 border border-white/20', t + ' ✕');
      x.onclick = () => openConfirm('Supprimer le tag ?', '« ' + t + ' » sera retiré de tes vidéos.', () => {
        appData.settings.customTags = custom().filter(y => y !== t);
        appData.videos.forEach(v => { if (tagsOf(v).includes(t)) { v.tags = tagsOf(v).filter(y => y !== t); if (!v.tags.length) v.tags = ['Autre']; v.tag = v.tags[0]; } });
        if (appData.settings.activeFilter === t) appData.settings.activeFilter = 'Tous';
        saveData(); refreshTagUI(); myTags(); renderApp();
      });
      b.appendChild(x);
    });
  }
  function buildOptions() {
    const box = document.querySelector('#view-settings .space-y-8'); if (!box || $('teevi-plus')) return;
    const c = el('div'); c.id = 'teevi-plus';
    c.innerHTML = '<p class="text-xs text-gray-400 mb-3 font-bold uppercase tracking-widest pl-2">Outils</p><div class="glass-effect rounded-[32px] p-5 space-y-4">' +
      '<p id="bk-status"></p><button id="bk-btn" class="w-full ' + BTN + '">Sauvegarder maintenant</button>' +
      '<p class="text-xs text-gray-400 font-bold uppercase tracking-widest">Mes tags</p><div id="mytags" class="flex flex-wrap gap-2"></div>' +
      '<div class="flex gap-2"><input id="ntInput" type="text" placeholder="Créer un tag" class="' + INPUT + '"><button id="ntBtn" class="px-5 ' + BTN + '">+</button></div>' +
      '<button id="thBtn" class="w-full ' + BTN + '">Récupérer les miniatures</button></div>';
    box.insertBefore(c, box.lastElementChild);
    $('bk-btn').onclick = () => { triggerHaptic(); exportData(); };
    $('ntBtn').onclick = () => { const t = cleanTag($('ntInput').value); if (!t) return; const n = findTag(t); if (!allTags().includes(n)) custom().push(n); $('ntInput').value = ''; saveData(); refreshTagUI(); myTags(); };
    $('thBtn').onclick = async () => {
      const b = $('thBtn'); b.disabled = true; b.textContent = 'Recherche en cours…';
      const r = await fetchThumbs(true); b.disabled = false; b.textContent = 'Récupérer les miniatures';
      showToast(r.tried ? r.ok + ' miniature(s) trouvée(s) sur ' + r.tried : 'Rien à récupérer', r.tried > 0 && r.ok === 0);
    };
    myTags(); bkText();
  }
  function addThemes() {
    const a = document.querySelector('label[data-theme="t-custom"]'); if (!a || document.querySelector('[data-theme="t-forest"]')) return;
    [['t-ruby', '#3f000f'], ['t-forest', '#052e16'], ['t-violet', '#2e1065']].forEach(([t, col]) => {
      const b = el('button', 'w-12 h-12 rounded-full border-2 border-transparent theme-btn transition-transform shadow-lg');
      b.dataset.theme = t; b.style.background = col; b.onclick = () => { triggerHaptic(); setTheme(t); }; a.before(b);
    });
    applyTheme(appData.settings.theme);
  }

  // ---- Démarrage : après le chargement des données ----
  const _init = window.onload;
  window.onload = async function () {
    if (_init) await _init();
    refreshTagUI(); buildEdit(); buildOptions(); addThemes();
    const home = $('row-continue');
    if (home && !$('btn-surprise')) {
      const b = el('button', 'mx-6 mb-6 py-3.5 rounded-2xl glass-effect font-bold active:scale-95 transition-transform', '🎲 Surprends-moi'); b.id = 'btn-surprise';
      b.onclick = () => { triggerHaptic(); const l = appData.videos.filter(v => !appData.state[v.id]?.done); if (!l.length) { showToast('Liste vide'); return; } openFocus(l[Math.floor(Math.random() * l.length)].id); };
      home.before(b);
    }
    const t = +localStorage.getItem(LB), day = new Date().toDateString();
    if ((!t || Date.now() - t > 7 * 864e5) && localStorage.getItem('teevi_remind') !== day) {
      localStorage.setItem('teevi_remind', day); setTimeout(() => showToast('Pense à sauvegarder (Options)', true), 2500);
    }
    if (navigator.onLine) fetchThumbs(false);
  };
})();

/* ===== Fiche vidéo : un appui sur la carte ouvre la fiche (plus de crayon) ===== */
(function () {
  if (typeof openVideoDetail !== 'function') return;
  const $ = id => document.getElementById(id);
  const tagsOf = v => (v.tags && v.tags.length ? v.tags : [v.tag || 'Autre']);

  // 1. Cartes épurées : on retire le crayon
  const _card = window.renderCardHTML;
  window.renderCardHTML = function (v, isDone, sp, ig) {
    return _card(v, isDone, sp, ig).replace(/<div class="absolute top-2 right-2 z-20"><button onclick="openEdit[\s\S]*?<\/button><\/div>/, '');
  };

  // 2. La fenêtre Modifier n'a plus de doublon de statut (la fiche a le sien)
  const _edit = window.openEdit;
  window.openEdit = function (e, id) { _edit(e, id); const s = $('eStatus'); if (s) s.style.display = 'none'; };

  // 3. Fiche enrichie : miniature, tags, note, bouton Modifier
  const _ovd = window.openVideoDetail;
  window.openVideoDetail = function (id) {
    _ovd(id);
    const v = appData.videos.find(x => x.id === id); if (!v) return;
    if (!appData.state[id]?.photo && v.thumb) $('video-detail-cover').style.backgroundImage = "url('" + encodeURI(v.thumb).replace(/'/g, '%27') + "')";
    $('video-detail-duration').style.display = v.duration ? '' : 'none';
    $('video-detail-creator').style.display = v.creator ? '' : 'none';
    let x = $('vd-extra');
    if (!x) { x = document.createElement('div'); x.id = 'vd-extra'; x.className = 'mb-5 space-y-4'; $('video-detail-description-wrap').before(x); }
    x.innerHTML = '';
    const tags = document.createElement('div'); tags.className = 'flex flex-wrap gap-2';
    tagsOf(v).forEach(t => { const s = document.createElement('span'); s.className = 'px-3 py-1.5 rounded-full bg-white/10 border border-white/10 text-xs font-bold'; s.textContent = t; tags.appendChild(s); });
    x.appendChild(tags);
    const n = document.createElement('div');
    n.innerHTML = '<p class="text-[10px] uppercase tracking-[.18em] text-gray-500 font-bold mb-2">Note</p>';
    const np = document.createElement('p'); np.className = 'text-sm leading-6 whitespace-pre-line ' + (v.note ? 'text-gray-300' : 'text-gray-500');
    np.textContent = v.note || 'Aucune note pour le moment.'; n.appendChild(np); x.appendChild(n);
    const row = document.createElement('div'); row.className = 'flex gap-2';
    const mk = (label, fn) => { const b = document.createElement('button'); b.className = 'flex-1 py-3 rounded-2xl bg-white/10 border border-white/10 font-bold text-sm active:scale-95'; b.textContent = label; b.onclick = fn; row.appendChild(b); };
    mk('Modifier', () => { closeVideoDetail(); openEdit(null, id); });
    if (v.galleryId && appData.gallery.some(g => g.id === v.galleryId)) mk('Ma réalisation', () => { closeVideoDetail(); switchView('studio'); setTimeout(() => openMedia(v.galleryId), 400); });
    const cb = document.createElement('button'); cb.className = 'w-full py-3.5 rounded-2xl bg-white text-black font-bold text-sm active:scale-95 transition-transform';
    cb.textContent = '✨ Travailler avec Claude'; cb.onclick = () => workWithClaude(id); x.appendChild(cb);
    x.appendChild(row);
  };
})();

/* ===== Fiche vidéo : défilement correct sur iPhone ===== */
(function () {
  const st = document.createElement('style');
  st.textContent = '#videoDetailModal>.video-detail-panel{display:flex;flex-direction:column;max-height:92vh;max-height:92dvh}' +
    '#video-detail-cover{min-height:0;height:32vh;max-height:250px;flex:0 0 auto}' +
    '#videoDetailModal .overflow-y-auto{flex:1 1 auto;min-height:0;max-height:none!important;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;touch-action:pan-y;padding-bottom:calc(env(safe-area-inset-bottom,0px) + 28px)}';
  document.head.appendChild(st);
})();

/* ===== Workflow : de la fiche vers Claude (prompt prêt à l'emploi) ===== */
window.workWithClaude = function (id) {
  const v = appData.videos.find(x => x.id === id); if (!v) return;
  const tags = (v.tags && v.tags.length ? v.tags : [v.tag || 'Autre']).join(', ');
  const trans = (v.transcription || '').trim();
  const lines = [
    "Je veux créer ma propre vidéo à partir de cette idée vue sur TikTok.", "",
    "Titre : " + (v.title || 'Sans titre'),
    v.url && v.url !== '#' ? "Lien : " + v.url : null,
    "Catégorie : " + tags,
    v.note ? "Ma note : " + v.note : null, "",
    trans ? "Transcription :\n" + trans : "Je n'ai pas encore la transcription : dis-moi comment la récupérer, ou je te la colle juste après.", "",
    "Ce que j'attends de toi :",
    "1. Résume l'histoire et explique ce qui la rend accrocheuse.",
    "2. Propose-moi une version ORIGINALE (personnages, lieu et chute différents, sans copier l'original).",
    "3. Écris le script scène par scène, puis les prompts pour générer la vidéo avec l'IA.",
    "Si tu as besoin de précisions, pose-moi une question à la fois."
  ].filter(l => l !== null).join("\n");
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(lines).catch(() => {});
  const q = lines.length < 5000 ? lines : lines.slice(0, 4800) + "\n[…texte tronqué : le prompt complet est copié, colle-le ici]";
  closeVideoDetail();
  showToast('Prompt copié — ouverture de Claude…');
  window.open('https://claude.ai/new?q=' + encodeURIComponent(q), '_blank');
};
