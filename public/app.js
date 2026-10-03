const API_BASE = window.location.origin;

let allPokemon = [];
let currentFilter = '';
let currentSearch = '';
let currentModalForms = [];
let currentModalFormIndex = 0;
let currentVisiblePokemon = [];
let shinyMode = false;
let cryMuted = localStorage.getItem('rotomCryMuted') === '1';

const pokemonGrid = document.getElementById('pokemonGrid');
const searchInput = document.getElementById('searchInput');
const weaknessModal = document.getElementById('weaknessModal');
const modalTitle = document.getElementById('modalTitle');
const modalSubtitle = document.getElementById('modalSubtitle');
const modalBody = document.getElementById('modalBody');
const progressContainer = document.getElementById('progressContainer');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const resultCount = document.getElementById('resultCount');
const loadStatusEl = document.getElementById('loadStatus');

const TYPES = ['Normal', 'Fire', 'Water', 'Grass', 'Electric', 'Ice', 'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy'];

function typeIcon(type) {
  const t = String(type || '').toLowerCase().trim();
  if (!t) return '';
  return `<img class="type-icon" src="icons/types/${t}.png" alt="${t}" loading="lazy" onerror="this.remove()">`;
}

function emptyState(icon, title, text) {
  return `<div class="empty-state"><span class="empty-icon">${icon}</span><span class="empty-title">${title}</span><span class="empty-text">${text}</span></div>`;
}

function debounce(fn, ms) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

async function init() {
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  runBootSplash();
  updateSoundBtn();
  restoreOwnerSession();
  showProgress(true);
  setStatusLoading();
  await pollUntilReady();
  await loadPokemon();
  showProgress(false);
  bindRouter();
  populateSearchFilters();
  populateMoveGenFilter();
  showViewForHash();
}

function runBootSplash() {
  const splash = document.getElementById('bootSplash');
  if (!splash) return;
  if (sessionStorage.getItem('rotomBooted')) {
    splash.remove();
    setTimeout(maybeShowOnboarding, 500);
    return;
  }
  sessionStorage.setItem('rotomBooted', '1');
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    clearTimeout(autoTimer);
    window.removeEventListener('keydown', onPress);
    splash.classList.add('boot-done');
    setTimeout(() => {
      splash.remove();
      maybeShowOnboarding();
    }, 420);
  };
  const autoTimer = setTimeout(finish, 2600);
  const onPress = (e) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'a' || e.key === 'A') {
      e.preventDefault();
      finish();
    }
  };
  splash.addEventListener('click', finish);
  window.addEventListener('keydown', onPress);
}

function maybeShowOnboarding() {
  if (localStorage.getItem('rotomOnboarded')) return;
  const tip = document.getElementById('onboardingTip');
  if (!tip) return;
  tip.hidden = false;
  requestAnimationFrame(() => requestAnimationFrame(() => tip.classList.add('show')));
  setTimeout(dismissOnboarding, 9000);
}

function dismissOnboarding() {
  localStorage.setItem('rotomOnboarded', '1');
  const tip = document.getElementById('onboardingTip');
  if (!tip) return;
  tip.classList.remove('show');
  setTimeout(() => { tip.hidden = true; }, 320);
}

/* ---------------- Router ---------------- */

function navigate(hash) {
  if (hash === '#/') {
    if (location.hash && window.history && window.history.replaceState) {
      history.replaceState(null, '', location.pathname + location.search);
    }
    showViewForHash();
    return;
  }
  if (location.hash === hash) {
    showViewForHash();
  } else {
    location.hash = hash;
  }
}

function bindRouter() {
  window.addEventListener('hashchange', showViewForHash);
}

function toggleMoreMenu(e) {
  e.stopPropagation();
  const menu = document.getElementById('navMoreMenu');
  const btn = document.getElementById('moreMenuBtn');
  if (!menu) return;
  const open = menu.classList.toggle('open');
  btn.classList.toggle('open', open);
  btn.setAttribute('aria-expanded', open ? 'true' : 'false');
}

function closeMoreMenu() {
  const menu = document.getElementById('navMoreMenu');
  const btn = document.getElementById('moreMenuBtn');
  if (menu) menu.classList.remove('open');
  if (btn) { btn.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); }
}

document.addEventListener('click', (e) => {
  const menu = document.getElementById('navMoreMenu');
  if (menu && menu.classList.contains('open') && !e.target.closest('#navMore')) {
    closeMoreMenu();
  }
});

const scrollTopBtn = document.getElementById('scrollTopBtn');
function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
if (scrollTopBtn) {
  window.addEventListener('scroll', () => {
    scrollTopBtn.classList.toggle('visible', window.scrollY > 300);
  }, { passive: true });
}

let currentViewId = null;

function showViewForHash() {
  const hash = location.hash || '#/';
  const views = {
    '#/': 'landingView',
    '#/scan': 'scanView',
    '#/pokemon': 'pokemonView',
    '#/search': 'searchView',
    '#/moves': 'movesView',
    '#/abilities': 'abilitiesView',
    '#/minigames': 'minigamesView',
    '#/dexduel': 'dexduelView',
    '#/guess': 'guessView',
  };
  const viewId = views[hash] || 'landingView';
  document.body.dataset.view = viewId;
  if (viewId !== currentViewId) {
    currentViewId = viewId;
    window.scrollTo(0, 0);
  }
  document.querySelectorAll('.view').forEach(v => { v.style.display = 'none'; });
  const target = document.getElementById(viewId);
  if (target) target.style.display = 'block';

  if (scanMediaActive && viewId !== 'scanView') stopScanCamera();

  document.querySelectorAll('.nav-link').forEach(l => {
    l.classList.toggle('active', l.getAttribute('href') === hash);
  });

  const moreBtn = document.getElementById('moreMenuBtn');
  if (moreBtn) moreBtn.classList.toggle('active', viewId === 'movesView' || viewId === 'abilitiesView' || viewId === 'minigamesView' || viewId === 'guessView' || viewId === 'dexduelView');
  closeMoreMenu();

  if (viewId === 'pokemonView') {
    filterPokemon();
  } else if (viewId === 'searchView') {
    runSearch();
  } else if (viewId === 'movesView') {
    loadMoves();
  } else if (viewId === 'abilitiesView') {
    loadAbilities();
  } else if (viewId === 'minigamesView') {
    // Hub — no setup needed; games launch on their own routes.
  } else if (viewId === 'dexduelView') {
    openDexDuel();
  } else if (viewId === 'guessView') {
    startGuessGame();
  }
}

/* ---------------- Scan view ---------------- */

let scanActive = false;

function runScan() {
  const btn = document.getElementById('scanButton');
  const readout = document.getElementById('scanReadout');
  const win = document.querySelector('.scan-window');
  if (!allPokemon.length || scanActive) return;

  scanActive = true;
  if (btn) btn.classList.add('disabled');
  if (win) win.classList.add('scanning');
  if (readout) readout.textContent = 'Scanning...';

  let pool = allPokemon.filter(p => p.isDefault);
  if (currentFilter) {
    const tl = currentFilter.toLowerCase();
    const filtered = pool.filter(p => p.types.some(t => t.type.toLowerCase() === tl));
    if (filtered.length) pool = filtered;
  } else if (currentSearch) {
    const q = currentSearch.toLowerCase();
    const filtered = pool.filter(p =>
      p.name.toLowerCase().includes(q) || p.displayName.toLowerCase().includes(q)
    );
    if (filtered.length) pool = filtered;
  }
  const target = pool[Math.floor(Math.random() * pool.length)];

  setTimeout(() => {
    const view = document.getElementById('scanView');
    const visible = view && view.style.display !== 'none';
    scanActive = false;
    if (win) win.classList.remove('scanning');
    if (btn) btn.classList.remove('disabled');
    if (!visible || !target) {
      if (readout) readout.textContent = 'Ready';
      return;
    }
    if (readout) readout.textContent = `${target.name} found!`;
    showPokemonDetail(target.speciesId, target.id);
  }, 1500);
}

/* ---------------- Camera / gallery scan ---------------- */

let scanCamStream = null;
let scanMediaActive = false;

function stopScanCamera() {
  if (scanCamStream) {
    scanCamStream.getTracks().forEach(t => t.stop());
    scanCamStream = null;
  }
  scanMediaActive = false;
  const win = document.querySelector('.scan-window');
  const video = document.getElementById('scanVideo');
  if (video) video.srcObject = null;
  if (win) win.classList.remove('camera');
  const cancelBtn = document.getElementById('cancelScanButton');
  if (cancelBtn) cancelBtn.style.display = 'none';
}

function cancelCameraScan() {
  stopScanCamera();
  const readout = document.getElementById('scanReadout');
  const win = document.querySelector('.scan-window');
  if (win) win.classList.remove('scanning');
  if (readout) readout.textContent = 'Scan cancelled';
}

async function startCameraScan() {
  const readout = document.getElementById('scanReadout');
  const win = document.querySelector('.scan-window');
  const video = document.getElementById('scanVideo');
  const cancelBtn = document.getElementById('cancelScanButton');
  if (scanMediaActive) return;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    if (readout) readout.textContent = 'Camera not supported on this device';
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 } },
      audio: false,
    });
    scanCamStream = stream;
    scanMediaActive = true;
    video.srcObject = stream;
    await video.play();
    if (win) win.classList.add('camera', 'scanning');
    if (cancelBtn) cancelBtn.style.display = 'inline-block';
    if (readout) readout.textContent = 'Point at the Pokémon...';
    await new Promise(r => setTimeout(r, 2600));
    captureCameraFrame();
  } catch (err) {
    if (readout) readout.textContent = 'Camera unavailable';
    stopScanCamera();
  }
}

function captureCameraFrame() {
  if (!scanMediaActive) return;
  const video = document.getElementById('scanVideo');
  const canvas = document.getElementById('scanCanvas');
  const readout = document.getElementById('scanReadout');
  const win = document.querySelector('.scan-window');
  if (!video || !video.videoWidth) {
    if (readout) readout.textContent = 'No camera frame available';
    stopScanCamera();
    return;
  }
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  stopScanCamera();
  if (win) win.classList.remove('scanning');
  if (readout) readout.textContent = 'Analyzing surroundings...';
  recognizePokemonFromCanvas(canvas);
}

function openGalleryScan() {
  const input = document.getElementById('scanFileInput');
  if (input) input.click();
}

function handleGalleryFile(e) {
  const file = e.target.files && e.target.files[0];
  const readout = document.getElementById('scanReadout');
  const win = document.querySelector('.scan-window');
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.getElementById('scanCanvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      canvas.getContext('2d').drawImage(img, 0, 0);
      if (win) win.classList.add('scanning');
      if (readout) readout.textContent = 'Analyzing photo...';
      setTimeout(() => {
        if (win) win.classList.remove('scanning');
        recognizePokemonFromCanvas(canvas);
      }, 900);
    };
    img.onerror = () => {
      if (win) win.classList.remove('scanning');
      if (readout) readout.textContent = 'Could not read that image';
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

const TYPE_COLOR_RGB = {
  Normal: [168, 167, 122], Fire: [238, 129, 48], Water: [99, 144, 240],
  Electric: [247, 208, 44], Grass: [122, 199, 76], Ice: [150, 217, 214],
  Fighting: [194, 46, 40], Poison: [163, 62, 161], Ground: [226, 191, 101],
  Flying: [169, 143, 243], Psychic: [249, 85, 135], Bug: [166, 185, 26],
  Rock: [182, 161, 54], Ghost: [115, 87, 151], Dragon: [111, 53, 252],
  Dark: [112, 87, 70], Steel: [183, 183, 206], Fairy: [214, 133, 173],
};

function imageAverageColor(canvas) {
  const w = 48;
  const h = 48;
  const small = document.createElement('canvas');
  small.width = w;
  small.height = h;
  const sctx = small.getContext('2d');
  sctx.drawImage(canvas, 0, 0, w, h);
  const data = sctx.getImageData(0, 0, w, h).data;
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3] / 255;
    r += data[i] * a;
    g += data[i + 1] * a;
    b += data[i + 2] * a;
    n += a;
  }
  if (!n) return [0, 0, 0];
  return [r / n, g / n, b / n];
}

function nearestTypes(rgb) {
  return TYPES.map(t => {
    const c = TYPE_COLOR_RGB[t];
    const dr = rgb[0] - c[0], dg = rgb[1] - c[1], db = rgb[2] - c[2];
    return { t, d: dr * dr + dg * dg + db * db };
  }).sort((a, b) => a.d - b.d);
}

function recognizePokemonFromCanvas(canvas) {
  const readout = document.getElementById('scanReadout');
  const rgb = imageAverageColor(canvas);
  const ranked = nearestTypes(rgb);
  const primary = ranked[0].t;
  const secondary = ranked[1].t;
  const defaults = allPokemon.filter(p => p.isDefault);
  let pool = defaults.filter(p => p.types[0] && p.types[0].type === primary);
  if (!pool.length) pool = defaults.filter(p => p.types[0] && p.types[0].type === secondary);
  if (!pool.length) pool = defaults;
  const target = pool[Math.floor(Math.random() * pool.length)];
  if (readout) readout.textContent = `Matched ${primary} type → ${target ? target.name : '...'}`;
  if (target) showPokemonDetail(target.speciesId, target.id);
}

/* ---------------- Loading / status ---------------- */

async function pollUntilReady() {
  while (true) {
    try {
      const res = await fetch(`${API_BASE}/status`);
      const status = await res.json();
      updateProgress(status);
      if (status.phase === 'ready') return;
      if (status.phase === 'error') {
        progressText.textContent = `Error: ${status.message}`;
        return;
      }
      await new Promise(r => setTimeout(r, 2000));
    } catch {
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}

function updateProgress(status) {
  if (!progressBar || !progressText) return;
  progressBar.style.width = `${status.percentComplete || 0}%`;
  const msgs = {
    'loading-species': `Fetching species: ${status.loadedSpecies}/${status.totalSpecies}`,
    'loading-pokemon': `Fetching Pokemon: ${status.loadedPokemon}/${status.totalPokemon}`,
    'merging': 'Processing data...',
    'saving': 'Saving to cache...',
  };
  progressText.textContent = msgs[status.phase] || status.message || 'Loading...';
  if (status.phase !== 'ready') {
    setStatusLoading(msgs[status.phase] || status.message || 'Loading...');
  }
}

function setStatusLoading(msg) {
  if (!loadStatusEl) return;
  const dot = loadStatusEl.querySelector('.status-dot');
  const text = loadStatusEl.querySelector('.status-text');
  if (dot) dot.className = 'status-dot loading';
  if (text) text.textContent = msg || 'Loading...';
}

function showProgress(show) {
  if (progressContainer) progressContainer.style.display = show ? 'block' : 'none';
}

async function loadPokemon() {
  pokemonGrid.innerHTML = '<div class="loading">Loading Pokédex data...</div>';
  try {
    const response = await fetch(`${API_BASE}/pokemon`);
    const data = await response.json();
    if (data.loading) {
      pokemonGrid.innerHTML = '<div class="loading">Server is still loading data. Please wait...</div>';
      return;
    }
    allPokemon = data;
    updateLoadStatus(true);
    filterPokemon();
    runSearch();
  } catch (error) {
    console.error('Error loading Pokemon:', error);
    pokemonGrid.innerHTML = '<div class="loading">Unable to connect to server. Make sure it is running at http://localhost:3000</div>';
    updateLoadStatus(false);
  }
}

function updateLoadStatus(loaded) {
  if (!loadStatusEl) return;
  const dot = loadStatusEl.querySelector('.status-dot');
  const text = loadStatusEl.querySelector('.status-text');
  if (loaded) {
    dot.className = 'status-dot ready';
    text.textContent = 'LIVE';
  } else {
    dot.className = 'status-dot error';
    text.textContent = 'Disconnected';
  }
}

/* ---------------- Pokemon list view ---------------- */

function filterByType(type) {
  currentFilter = type;
  currentSearch = '';
  if (searchInput) searchInput.value = '';
  updateTypeButtons(type);
  filterPokemon();
}

function resetTypeButtons() {
  document.querySelectorAll('.filter-btn.type-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelector('.filter-btn.type-btn[data-type=""]')?.classList.add('active');
}

function updateTypeButtons(activeType) {
  document.querySelectorAll('.filter-btn.type-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-type') === activeType);
  });
}

function filterPokemon() {
  let filtered = allPokemon.filter(p => p.isDefault);

  if (currentFilter) {
    const typeLower = currentFilter.toLowerCase();
    filtered = filtered.filter(p =>
      p.types.some(t => t.type.toLowerCase() === typeLower)
    );
  }

  if (currentSearch) {
    const q = currentSearch.toLowerCase();
    filtered = filtered.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.baseName.toLowerCase().includes(q) ||
      p.displayName.toLowerCase().includes(q) ||
      String(p.id) === q || String(p.speciesId) === q
    );
  }

  renderPokemon(filtered);
}

function renderPokemon(pokemonList) {
  if (!pokemonList || pokemonList.length === 0) {
    pokemonGrid.innerHTML = emptyState('🐾', 'No Pokémon found', 'Try a different type filter, or reset to All.');
    if (resultCount) resultCount.textContent = '';
    return;
  }
  if (resultCount) resultCount.textContent = `${pokemonList.length} Pokemon`;
  currentVisiblePokemon = pokemonList;
  pokemonGrid.innerHTML = pokemonList.map(p => createPokemonCard(p)).join('');
}

function updateShinyToggle() {
  document.querySelectorAll('.shiny-toggle').forEach(btn => {
    btn.classList.toggle('active', shinyMode);
    btn.setAttribute('aria-pressed', shinyMode ? 'true' : 'false');
    btn.textContent = shinyMode ? '✨ Off' : '✨ Shiny';
  });
}

function toggleShinyMode() {
  shinyMode = !shinyMode;
  updateShinyToggle();
  filterPokemon();
  runSearch();
  if (shinyMode && currentModalForms.length && weaknessModal.style.display === 'flex') {
    renderModal();
  }
}

function jumpToDex(start) {
  const grid = document.getElementById('pokemonGrid');
  if (!grid) return;
  const cards = grid.querySelectorAll('.pokemon-card');
  let target = null;
  for (const card of cards) {
    const sid = Number(card.getAttribute('data-species')) || 0;
    if (sid >= start) { target = card; break; }
  }
  if (!target && cards.length) target = cards[cards.length - 1];
  if (!target) return;
  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  target.classList.add('dex-jump-flash');
  setTimeout(() => target.classList.remove('dex-jump-flash'), 1600);
}

/* ---------------- Search view ---------------- */

function populateSearchFilters() {
  const typeContainer = document.getElementById('searchTypeFilters');
  if (typeContainer) {
    typeContainer.innerHTML = TYPES.map(t =>
      `<label class="type-checkbox"><input type="checkbox" value="${t}" onchange="runSearch()"> ${t}</label>`
    ).join('');
  }

  const regionSel = document.getElementById('searchRegionFilter');
  if (regionSel && allPokemon.length) {
    const order = ['Kanto', 'Johto', 'Hoenn', 'Sinnoh', 'Unova', 'Kalos', 'Alola', 'Galar', 'Hisui', 'Paldea'];
    const regionOrder = {};
    order.forEach((r, i) => regionOrder[r] = i);
    const regions = Array.from(new Set(allPokemon.map(p => p.region))).filter(Boolean).sort((a, b) => {
      const ia = regionOrder[a] !== undefined ? regionOrder[a] : order.length;
      const ib = regionOrder[b] !== undefined ? regionOrder[b] : order.length;
      if (ia !== ib) return ia - ib;
      return a.localeCompare(b);
    });
    regionSel.innerHTML = '<option value="">All Regions</option>' +
      regions.map(r => `<option value="${r}">${r}</option>`).join('');
  }

  const formSel = document.getElementById('searchFormFilter');
  if (formSel) {
    const forms = ['base', 'mega', 'primal', 'gigantamax', 'regional', 'cosplay'];
    formSel.innerHTML = '<option value="">All Forms</option>' +
      forms.map(f => `<option value="${f}">${fLabel(f)}</option>`).join('');
  }
}

function fLabel(f) {
  const map = { base: 'Base', mega: 'Mega', primal: 'Primal', gigantamax: 'Gigantamax', regional: 'Regional', cosplay: 'Cosplay' };
  return map[f] || f;
}

function getSelectedTypes() {
  const checks = document.querySelectorAll('#searchTypeFilters input:checked');
  return Array.from(checks).map(c => c.value.toLowerCase());
}

function runSearch() {
  const grid = document.getElementById('searchGrid');
  const countEl = document.getElementById('searchResultCount');
  if (!allPokemon.length) return;

  const q = (searchInput ? searchInput.value : '').trim().toLowerCase();
  const selTypes = getSelectedTypes();
  const region = document.getElementById('searchRegionFilter').value;
  const form = document.getElementById('searchFormFilter').value;
  const includeForms = document.getElementById('searchIncludeForms').checked;
  const stage = document.getElementById('searchStageFilter') ? document.getElementById('searchStageFilter').value : '';
  const starterOnly = document.getElementById('searchStarterOnly') ? document.getElementById('searchStarterOnly').checked : false;
  const rarity = document.getElementById('searchRarityFilter') ? document.getElementById('searchRarityFilter').value : '';
  const typing = document.getElementById('searchTypingFilter') ? document.getElementById('searchTypingFilter').value : '';

  let filtered = includeForms ? [...allPokemon] : allPokemon.filter(p => p.isDefault);

  if (q) {
    const numMatch = q.match(/\d+/);
    const num = numMatch ? numMatch[0].replace(/^0+/, '') : null;
    filtered = filtered.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.displayName.toLowerCase().includes(q) ||
      p.baseName.toLowerCase().includes(q) ||
      (num && (String(p.speciesId) === num || String(p.id) === num))
    );
  }

  if (selTypes.length) {
    filtered = filtered.filter(p =>
      selTypes.every(t => p.types.some(pt => pt.type.toLowerCase() === t))
    );
  }

  if (region) filtered = filtered.filter(p => p.region === region);
  if (form) filtered = filtered.filter(p => p.formType === form);

  if (stage === 'first') filtered = filtered.filter(p => p.isFirstStage);
  else if (stage === 'middle') filtered = filtered.filter(p => p.isMiddle);
  else if (stage === 'final') filtered = filtered.filter(p => p.isFinal);

  if (starterOnly) filtered = filtered.filter(p => p.isStarter);

  if (rarity === 'legendary') filtered = filtered.filter(p => p.legendaryStatus === 'legendary');
  else if (rarity === 'mythical') filtered = filtered.filter(p => p.legendaryStatus === 'mythical');
  else if (rarity === 'pseudo') filtered = filtered.filter(p => p.pseudoLegendaryStatus === 'pseudo-legendary');

  if (typing === 'mono') filtered = filtered.filter(p => (p.types || []).length === 1);
  else if (typing === 'dual') filtered = filtered.filter(p => (p.types || []).length === 2);

  filtered.sort((a, b) => {
    if (a.speciesId !== b.speciesId) return a.speciesId - b.speciesId;
    if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
    return a.id - b.id;
  });

  if (!filtered.length) {
    grid.innerHTML = emptyState('🔍', 'No Pokémon found', 'Loosen the filters or try another name or number.');
    if (countEl) countEl.textContent = '';
    currentVisiblePokemon = [];
    return;
  }
  if (countEl) countEl.textContent = `${filtered.length} Pokemon`;
  currentVisiblePokemon = filtered;
  grid.innerHTML = filtered.map(p => createPokemonCard(p)).join('');
}

/* ---------------- Moves view ---------------- */

let currentMoveType = '';
let currentMoveClass = '';
let currentMoveKind = '';

const moveListCache = {};

function populateMoveGenFilter() {
  const sel = document.getElementById('moveGenFilter');
  if (sel) {
    sel.innerHTML = '<option value="">All Generations</option>' +
      [1, 2, 3, 4, 5, 6, 7, 8, 9].map(g => `<option value="${g}">Gen ${g}</option>`).join('');
  }
}

function filterMovesByType(type) {
  currentMoveType = type;
  document.querySelectorAll('.filter-btn[data-movetype]').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-movetype') === type);
  });
  loadMoves();
}

function filterMovesByClass(cls) {
  currentMoveClass = cls;
  document.querySelectorAll('.class-filter').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-class') === cls);
  });
  loadMoves();
}

function filterMovesByKind(kind) {
  currentMoveKind = kind;
  const sigWrap = document.getElementById('moveSignatureFilter');
  const sigBox = document.getElementById('moveSignatureOnly');
  if (sigWrap) sigWrap.style.display = kind === 'z' ? '' : 'none';
  if (kind !== 'z' && sigBox) sigBox.checked = false;
  loadMoves();
}

async function loadMoves() {
  const listEl = document.getElementById('movesList');
  const countEl = document.getElementById('moveResultCount');
  if (!allPokemon.length) return;

  const q = (document.getElementById('moveSearchInput').value || '').trim();
  const gen = document.getElementById('moveGenFilter').value;

  const params = new URLSearchParams();
  if (currentMoveType) params.set('type', currentMoveType);
  if (currentMoveClass) params.set('class', currentMoveClass);
  if (currentMoveKind) params.set('kind', currentMoveKind);
  if (currentMoveKind === 'z' && document.getElementById('moveSignatureOnly')?.checked) params.set('signature', '1');
  if (gen) params.set('generation', gen);
  if (q) params.set('q', q);

  const key = params.toString() || 'all';
  if (moveListCache[key]) {
    renderMoves(sortMoves(moveListCache[key]), listEl, countEl);
    return;
  }

  listEl.innerHTML = '<div class="loading">Loading moves...</div>';
  try {
    const res = await fetch(`${API_BASE}/moves?${params.toString()}`);
    const data = await res.json();
    if (data.loading) {
      listEl.innerHTML = '<div class="loading">Server is still loading. Please wait...</div>';
      return;
    }
    const moves = sortMoves(data.moves || []);
    moveListCache[key] = moves;
    renderMoves(moves, listEl, countEl);
  } catch (err) {
    console.error('Error loading moves:', err);
    listEl.innerHTML = '<div class="loading">Failed to load moves.</div>';
  }
}

function sortMoves(moves) {
  const classOrder = { physical: 0, special: 1, status: 2 };
  return moves.slice().sort((a, b) => {
    if (a.type !== b.type) return a.type.localeCompare(b.type);
    if (a.generation !== b.generation) return a.generation - b.generation;
    return (classOrder[a.damageClass] ?? 3) - (classOrder[b.damageClass] ?? 3);
  });
}

function renderMoves(moves, listEl, countEl) {
  if (!moves.length) {
    listEl.innerHTML = emptyState('⚡', 'No moves found', 'Try a different type, kind, or search term.');
    if (countEl) countEl.textContent = '';
    return;
  }
  if (countEl) countEl.textContent = `${moves.length} Moves`;
  currentMoveList = moves;
  listEl.innerHTML = moves.map(m => createMoveCard(m)).join('');
}

/* ---------------- Abilities view ---------------- */

const abilityListCache = {};

async function loadAbilities() {
  const listEl = document.getElementById('abilitiesList');
  const countEl = document.getElementById('abilityResultCount');
  if (!listEl) return;

  const q = (document.getElementById('abilitySearchInput').value || '').trim();
  const hidden = document.getElementById('abilityHiddenOnly').checked;

  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (hidden) params.set('hidden', 'true');

  const key = params.toString() || 'all';
  if (abilityListCache[key]) {
    renderAbilities(abilityListCache[key], listEl, countEl);
    return;
  }

  listEl.innerHTML = '<div class="loading">Loading abilities...</div>';
  try {
    const res = await fetch(`${API_BASE}/abilities?${params.toString()}`);
    const data = await res.json();
    if (data.loading) {
      listEl.innerHTML = '<div class="loading">Server is still loading. Please wait...</div>';
      return;
    }
    const abilities = data.abilities || [];
    abilityListCache[key] = abilities;
    renderAbilities(abilities, listEl, countEl);
  } catch (err) {
    console.error('Error loading abilities:', err);
    listEl.innerHTML = '<div class="loading">Failed to load abilities.</div>';
  }
}

function renderAbilities(abilities, listEl, countEl) {
  if (!abilities.length) {
    listEl.innerHTML = emptyState('🧠', 'No abilities found', 'Try a different search term.');
    if (countEl) countEl.textContent = '';
    return;
  }
  if (countEl) countEl.textContent = `${abilities.length} Abilities`;
  listEl.innerHTML = abilities.map(a => createAbilityCard(a)).join('');
}

function createAbilityCard(a) {
  const hiddenBadge = a.hasHidden
    ? '<span class="hidden-badge" title="Can be a hidden ability">Hidden</span>'
    : '';
  return `
    <div class="ability-card">
      <div class="ability-card-main">
        <span class="ability-card-name">${a.name}${hiddenBadge}</span>
        <span class="ability-card-count">${a.count} Pokémon</span>
      </div>
      <div class="ability-card-desc">${a.description || 'No description available.'}</div>
    </div>
  `;
}

const MOVE_KIND_ICONS = {
  z: 'icons/z.png',
  max: 'icons/max.png',
  gigantamax: 'icons/gmax.png',
};

let activeCryAudio = null;
function updateSoundBtn() {
  const btn = document.getElementById('soundBtn');
  if (!btn) return;
  btn.textContent = cryMuted ? '🔇' : '🔊';
  btn.classList.toggle('off', cryMuted);
  btn.title = cryMuted ? 'Cry sounds muted — tap to unmute' : 'Cry sounds on — tap to mute';
}
function toggleCryMute() {
  cryMuted = !cryMuted;
  localStorage.setItem('rotomCryMuted', cryMuted ? '1' : '0');
  updateSoundBtn();
}
function playCry(url) {
  if (!url) return;
  if (cryMuted) return;
  try {
    if (activeCryAudio) {
      activeCryAudio.pause();
      activeCryAudio = null;
    }
    const audio = new Audio(url);
    audio.volume = 0.7;
    audio.onerror = () => { if (activeCryAudio === audio) activeCryAudio = null; };
    audio.onended = () => { if (activeCryAudio === audio) activeCryAudio = null; };
    activeCryAudio = audio;
    audio.play().catch(() => { if (activeCryAudio === audio) activeCryAudio = null; });
  } catch (err) {
    activeCryAudio = null;
  }
}

function cryButton(url) {
  if (!url) return '';
  return `<button class="cry-btn" title="Play cry" onclick="event.stopPropagation(); playCry('${url}')">🔊</button>`;
}

function createMoveCard(move) {
  const clsLabel = { physical: '💥 Physical', special: '✨ Special', status: '🛡 Status' }[move.damageClass] || move.damageClass;
  const power = move.power != null ? move.power : '—';
  const accuracy = move.accuracy != null ? `${move.accuracy}%` : '—';
  const kindIcon = MOVE_KIND_ICONS[move.kind] ? `<img class="move-kind-icon" src="${MOVE_KIND_ICONS[move.kind]}" alt="${move.kind}">` : '';
  return `
    <div class="move-card move-card-${move.type.toLowerCase()}" onclick="showMoveDetail(${move.id})">
      <div class="move-card-main">
        <span class="move-card-name">${kindIcon}${move.name}</span>
        ${typeIcon(move.type)}<span class="type-badge type-${move.type.toLowerCase()}">${move.type}</span>
        <span class="move-class-badge class-${move.damageClass}">${clsLabel}</span>
        ${move.requiresMove ? `<span class="move-requires-line" title="To use this, ${move.requiresMove.pokemon} must know ${move.requiresMove.requires}">Needs <b>${move.requiresMove.requires}</b></span>` : ''}
      </div>
      <div class="move-card-stats">
        <span class="move-stat" title="Power">PWR <b>${power}</b></span>
        <span class="move-stat" title="Accuracy">ACC <b>${accuracy}</b></span>
        <span class="move-stat" title="PP">PP <b>${move.pp != null ? move.pp : '—'}</b></span>
        <span class="move-gen">Gen ${move.generation}</span>
      </div>
    </div>
  `;
}

let currentMove = null;
let currentMoveList = [];

async function showMoveDetail(id) {
  try {
    const res = await fetch(`${API_BASE}/moves/${id}`);
    const move = await res.json();
    if (move.loading || move.error) return;
    currentMove = move;
    renderMoveModal(move);
    openModal();
  } catch (err) {
    console.error('Error loading move:', err);
  }
}

function renderMoveModal(move) {
  const kindIcon = MOVE_KIND_ICONS[move.kind] ? `<img class="move-kind-icon" src="${MOVE_KIND_ICONS[move.kind]}" alt=""> ` : '';
  modalTitle.innerHTML = `${kindIcon}${move.name}`;
  modalSubtitle.textContent = `${move.type} · ${move.damageClass} · Introduced in Generation ${move.generation}`;

  const clsLabel = { physical: '💥 Physical', special: '✨ Special', status: '🛡 Status' }[move.damageClass] || move.damageClass;
  const power = move.power != null ? move.power : '—';
  const accuracy = move.accuracy != null ? `${move.accuracy}%` : '—';
  const pp = move.pp != null ? move.pp : '—';

  const learners = (move.pokemon || []).slice(0, 60);
  const learnerHtml = learners.length
    ? learners.map(name => `<span class="move-learner">${name}</span>`).join('')
    : '<p class="modal-empty">No Pokémon found for this move.</p>';

  const effect = move.effect ? `<div class="flavor-text">${move.effect}</div>` : '';
  const description = move.description ? `<p class="move-desc">${move.description}</p>` : '';
  const requires = move.requiresMove
    ? `<div class="move-requires-note">⚡ To use this Z-Move, <b>${move.requiresMove.pokemon}</b> must have learned the move <b>${move.requiresMove.requires}</b>.</div>`
    : '';

  modalBody.innerHTML = `
    <div class="modal-detail move-detail">
      <div class="move-detail-header">
        ${typeIcon(move.type)}<span class="type-badge type-${move.type.toLowerCase()}">${move.type}</span>
        <span class="move-class-badge class-${move.damageClass}">${clsLabel}</span>
      </div>
      ${effect}
      ${requires}
      ${description ? `<div class="modal-section"><h4>Description</h4>${description}</div>` : ''}
      <div class="modal-section">
        <h4>Move Data</h4>
        <div class="move-data-grid">
          <div class="move-data-item"><span>Power</span><b>${power}</b></div>
          <div class="move-data-item"><span>Accuracy</span><b>${accuracy}</b></div>
          <div class="move-data-item"><span>PP</span><b>${pp}</b></div>
          <div class="move-data-item"><span>Priority</span><b>${move.priority != null ? move.priority : '—'}</b></div>
          <div class="move-data-item"><span>Category</span><b>${move.category || '—'}</b></div>
          <div class="move-data-item"><span>Target</span><b>${move.target || '—'}</b></div>
        </div>
      </div>
      <div class="modal-section">
        <h4>Learned By</h4>
        <div class="move-learners">${learnerHtml}</div>
      </div>
    </div>
  `;
}

/* ---------------- Shared: pokemon card + detail modal ---------------- */

function legendMark(pokemon) {
  if (!pokemon || !pokemon.legendaryStatus) return null;
  return pokemon.legendaryStatus === 'legendary'
    ? { glyph: '★', label: 'Legendary', cls: 'legendary' }
    : { glyph: '✦', label: 'Mythical', cls: 'mythical' };
}

function createPokemonCard(pokemon) {
  const types = (pokemon.types || []).map(t => t.type);
  const typeBadge = (t) => typeIcon(t);

  const sprite = pokemon.sprites?.official || pokemon.sprites?.default || '';
  const shinySprite = pokemon.sprites?.frontShiny;
  const useSprite = shinyMode && shinySprite ? shinySprite : sprite;
  const spriteHtml = useSprite
    ? `<img class="card-sprite" src="${useSprite}" alt="${pokemon.name}" loading="lazy">`
    : `<div class="card-sprite-placeholder">?</div>`;
  const shinyTagHtml = shinyMode && shinySprite
    ? `<span class="card-shiny-tag" title="Shiny sprite active">✨</span>`
    : '';

  const formCount = allPokemon.filter(p => p.speciesId === pokemon.speciesId).length;
  const formBadge = formCount > 1
    ? `<span class="card-form-count">${formCount} forms</span>`
    : '';

  const lg = legendMark(pokemon);
  const legendBadgeHtml = lg
    ? `<span class="card-legend-badge ${lg.cls}" title="${lg.label} Pokémon">${lg.glyph}</span>`
    : '';

  const weaknesses = pokemon.weaknesses || {};
  const weakTypes = Object.entries(weaknesses)
    .filter(([_, w]) => w.multiplier >= 2)
    .slice(0, 4)
    .map(([type, w]) => {
      const cls = w.multiplier >= 4 ? 'quad' : 'double';
      return `<span class="weak-tag ${cls}">${type} ×${w.multiplier}</span>`;
    })
    .join('');

  return `
    <div class="pokemon-card" onclick="showPokemonDetail(${pokemon.speciesId}, ${pokemon.id})" data-species="${pokemon.speciesId}">
      <div class="card-id">#${String(pokemon.speciesId || pokemon.id).padStart(3, '0')}</div>
      ${legendBadgeHtml}
      ${formBadge}
      ${spriteHtml}
      ${shinyTagHtml}
      <h3 class="card-name">${pokemon.name}</h3>
      <div class="card-types">${types.map(typeBadge).join('')}</div>
      ${weakTypes ? `<div class="card-weaknesses">${weakTypes}</div>` : ''}
    </div>
  `;
}

function showPokemonDetail(speciesId, formId) {
  // Select the right forms for this species from whichever dataset view is active
  currentModalForms = allPokemon.filter(p => p.speciesId === speciesId);
  if (currentModalForms.length && formId != null) {
    const idx = currentModalForms.findIndex(p => p.id === formId);
    currentModalFormIndex = idx !== -1 ? idx : currentModalForms.findIndex(p => p.isDefault);
  } else {
    currentModalFormIndex = currentModalForms.findIndex(p => p.isDefault);
  }
  if (currentModalFormIndex === -1) currentModalFormIndex = 0;
  renderModal();
  openModal();
}

function switchForm(index) {
  currentModalFormIndex = index;
  renderModal();
}

function navigatePokemon(delta) {
  if (!currentVisiblePokemon.length) return;
  const current = currentModalForms[currentModalFormIndex];
  if (!current) return;
  let idx = currentVisiblePokemon.findIndex(p => p.id === current.id);
  if (idx === -1) idx = currentVisiblePokemon.findIndex(p => p.speciesId === current.speciesId);
  if (idx === -1) idx = currentVisiblePokemon.findIndex(p => p.isDefault);
  if (idx === -1) return;
  const len = currentVisiblePokemon.length;
  const next = currentVisiblePokemon[(idx + delta + len) % len];
  showPokemonDetail(next.speciesId, next.id);
}

function navigateMove(delta) {
  if (!currentMove || !currentMoveList.length) return;
  const idx = currentMoveList.findIndex(m => m.id === currentMove.id);
  if (idx === -1) return;
  const len = currentMoveList.length;
  const next = currentMoveList[(idx + delta + len) % len];
  showMoveDetail(next.id);
}

function navigatePopup(delta) {
  if (document.querySelector('.modal-body .move-detail')) {
    navigateMove(delta);
  } else {
    navigatePokemon(delta);
  }
}

let weakRowsAll = [];
let weakRowsCore = [];
let weakShowAll = false;

function renderWeaknessTable(pokemon, tbodyId, toggleId) {
  const tbody = document.getElementById(tbodyId || 'weakTbody');
  const toggle = document.getElementById(toggleId || 'weakToggle');
  if (!tbody || !toggle) return;
  const coreEmpty = weakRowsCore.length === 0;
  const useAll = weakShowAll || coreEmpty;
  tbody.innerHTML = useAll ? weakRowsAll.join('') : weakRowsCore.join('');
  if (coreEmpty) {
    toggle.style.display = 'none';
  } else {
    toggle.style.display = '';
    toggle.textContent = useAll ? 'Show meaningful matchups only' : 'Show all 18 types';
  }
}

function toggleWeakRows() {
  weakShowAll = !weakShowAll;
  renderWeaknessTable();
}

function renderModal() {
  const pokemon = currentModalForms[currentModalFormIndex];
  if (!pokemon) return;

  modalTitle.textContent = pokemon.displayName || pokemon.name;
  modalSubtitle.textContent = `#${String(pokemon.speciesId || pokemon.id).padStart(3, '0')} · ${pokemon.genera || ''} · ${pokemon.region} Region`;

  const lg = legendMark(pokemon);
  const legendBadgeEl = document.getElementById('modalLegendBadge');
  if (legendBadgeEl) {
    if (lg) {
      legendBadgeEl.className = `modal-legend-badge ${lg.cls}`;
      legendBadgeEl.textContent = `${lg.glyph} ${lg.label}`;
      legendBadgeEl.style.display = '';
    } else {
      legendBadgeEl.style.display = 'none';
    }
  }

  const formTabs = currentModalForms.map((f, i) => {
    const label = f.form || 'Base';
    const active = i === currentModalFormIndex ? 'active' : '';
    return `<button class="form-tab ${active}" onclick="switchForm(${i})">${label}</button>`;
  }).join('');

  const sprite = pokemon.sprites?.official || pokemon.sprites?.default || '';
  const types = (pokemon.types || []).map(t => t.type);
  const typeBadges = types.map(t => `
    <span class="modal-type">
      ${typeIcon(t)}
      <span class="modal-type-name type-${t.toLowerCase()}">${t}</span>
    </span>
  `).join('');

  const stats = pokemon.stats || {};
  const maxStat = 255;
  const statBars = ['hp', 'attack', 'defense', 'spAtk', 'spDef', 'speed'].map(key => {
    const val = stats[key] || 0;
    const pct = Math.round((val / maxStat) * 100);
    const label = { hp: 'HP', attack: 'Atk', defense: 'Def', spAtk: 'SpA', spDef: 'SpD', speed: 'Spe' }[key];
    return `
      <div class="stat-row">
        <span class="stat-label">${label}</span>
        <span class="stat-value">${val}</span>
        <div class="stat-bar-bg"><div class="stat-bar" style="width: ${pct}%"></div></div>
      </div>
    `;
  }).join('');

  const totalStats = Object.values(stats).reduce((a, b) => a + b, 0);

  const abilities = (pokemon.abilities || []).map((a, ai) =>
    `<button class="ability-tag ${a.isHidden ? 'hidden-ability' : ''}" onclick="event.stopPropagation(); showAbilityDetails(event, ${currentModalFormIndex}, ${ai})">${a.name}${a.isHidden ? ' (Hidden)' : ''}</button>`
  ).join('');

  const attackerTypes = TYPES.map(t => t.toLowerCase());

  const weakRowHtml = at => {
    const w = (pokemon.weaknesses || {})[at];
    if (!w) return '';
    const times = getTimesOfWeakness(w.multiplier);
    const cls = getMultiplierClass(w.multiplier);
    const typeDisplay = at.charAt(0).toUpperCase() + at.slice(1);
    return `
      <tr class="${cls}">
        <td>${typeIcon(typeDisplay)}<span class="type-badge type-${at}">${typeDisplay}</span></td>
        <td class="multiplier">${w.multiplier}x</td>
        <td>${times}</td>
      </tr>
    `;
  };
  weakRowsAll = attackerTypes.map(weakRowHtml);
  weakRowsCore = attackerTypes
    .filter(at => { const w = (pokemon.weaknesses || {})[at]; return w && w.multiplier !== 1; })
    .map(weakRowHtml);

  const flavorText = pokemon.flavorText
    ? `<div class="flavor-text">"${pokemon.flavorText}"</div>`
    : '';

  const cry = cryButton(pokemon.cries?.latest || '');
  const spriteBox = sprite
    ? `<div class="modal-sprite-wrap">${cry}<img class="modal-sprite" src="${sprite}" alt="${pokemon.displayName || pokemon.name}"></div>`
    : '';

  modalBody.innerHTML = `
    <div class="modal-detail">
      ${currentModalForms.length > 1 ? `<div class="form-tabs">${formTabs}</div>` : ''}

      <div class="modal-sprite-section">
        <div class="modal-sprite-row">
          ${spriteBox}
          ${pokemon.sprites?.frontShiny ? `
            <div class="modal-sprite-wrap">
              <span class="shiny-badge">✨</span>
              <img class="modal-sprite modal-sprite-shiny" src="${pokemon.sprites.frontShiny}" alt="${pokemon.displayName || pokemon.name} (Shiny)">
            </div>` : ''}
        </div>
        <div class="modal-info-row">
          <div class="modal-types">${typeBadges}</div>
          <div class="modal-meta">
            <span>Height: ${pokemon.height}m</span>
            <span>Weight: ${pokemon.weight}kg</span>
          </div>
        </div>
      </div>

      ${flavorText}

      <div class="modal-section" id="evolutionSection"></div>

      <div class="modal-section">
        <h4>Base Stats <span class="stat-total">Total: ${totalStats}</span></h4>
        <div class="stats-container">${statBars}</div>
      </div>

      <div class="modal-section">
        <h4>Abilities</h4>
        <div class="abilities-container">${abilities}</div>
      </div>

      <div class="modal-section">
        <h4>Type Effectiveness</h4>
        <table class="weakness-table">
          <thead>
            <tr><th>Attack</th><th>Multiplier</th><th>Effectiveness</th></tr>
          </thead>
          <tbody id="weakTbody"></tbody>
        </table>
        <button class="weak-toggle" id="weakToggle" onclick="toggleWeakRows()"></button>
        <div class="weakness-note">Stellar isn't in the chart: Stellar-type moves hit <strong>×2 only versus Terastallized Pokémon</strong>, ×1 against everything else, and it has no defensive matchups.</div>
      </div>
    </div>
  `;

  renderWeaknessTable();
  renderEvolutionChart();
}

const evolutionCache = {};

async function renderEvolutionChart() {
  const section = document.getElementById('evolutionSection');
  if (!section) return;
  const pokemon = currentModalForms[currentModalFormIndex];
  if (!pokemon) return;
  const speciesId = pokemon.speciesId;

  if (evolutionCache[speciesId]) {
    renderEvolutionNodes(section, evolutionCache[speciesId], pokemon);
    return;
  }

  section.innerHTML = '<div class="evolution-loading">Loading evolution chart...</div>';
  try {
    const res = await fetch(`${API_BASE}/evolution/${speciesId}`);
    const data = await res.json();
    if (data.loading || data.error) {
      section.innerHTML = '';
      return;
    }
    const nodes = data.nodes || [];
    if (nodes.length <= 1) {
      section.innerHTML = '';
      return;
    }
    evolutionCache[speciesId] = nodes;
    renderEvolutionNodes(section, nodes, pokemon);
  } catch (err) {
    section.innerHTML = '';
  }
}

const REGIONAL_EVO_TARGET = {
  52:  { base: [53],  Alolan: [53],  Galarian: [863] },  // Meowth
  562: { base: [563], Galarian: [867] },                 // Yamask
  215: { base: [461], Hisuian: [903] },                  // Sneasel
  194: { base: [195], Paldea: [980] },                   // Wooper
  122: { base: [], Galarian: [866] },                    // Mr. Mime
  83:  { base: [], Galarian: [865] },                    // Farfetch'd
  222: { base: [], Galarian: [864] },                    // Corsola
  211: { base: [], Hisuian: [904] },                     // Qwilfish
  264: { base: [], Galarian: [862] },                    // Linoone
};

function renderEvolutionNodes(section, nodes, currentForm) {
  const byId = {};
  nodes.forEach(n => byId[n.speciesId] = n);
  const roots = nodes.filter(n => !nodes.some(o => (o.continuesTo || []).includes(n.speciesId)));

  const defaultOf = (speciesId) =>
    allPokemon.find(p => p.speciesId === speciesId && p.isDefault) ||
    allPokemon.find(p => p.speciesId === speciesId);
  const regionalOf = (speciesId) => allPokemon.filter(p =>
    p.speciesId === speciesId && p.isRegionalVariant
  );

  const isMatchingRegional = (rp, region) =>
    rp.isRegionalVariant && region != null &&
    (rp.form || '').trim().toLowerCase() === String(region).trim().toLowerCase();

  // Resolve the pokemon to display for a species on a given region track.
  const resolvePokemon = (speciesId, region) => {
    if (region) {
      const match = regionalOf(speciesId).find(rp => isMatchingRegional(rp, region)) ||
        regionalOf(speciesId).find(rp => (rp.form || '').toLowerCase() === region.toLowerCase());
      if (match) return match;
    }
    return defaultOf(speciesId);
  };

  const spriteFor = (speciesId, region) => {
    const m = resolvePokemon(speciesId, region);
    return (m && (m.sprites?.official || m.sprites?.default)) || '';
  };

  // Pick which child species a given form evolves into.
  const chooseChildren = (speciesId, region, children) => {
    const branch = REGIONAL_EVO_TARGET[speciesId];
    if (branch) {
      const key = region ? Object.keys(branch).find(k => k.toLowerCase() === region.toLowerCase()) : 'base';
      const targets = branch[key];
      if (targets) return targets.filter(id => children.includes(id));
    }
    if (region) {
      const matching = children.filter(id =>
        regionalOf(id).some(rp => isMatchingRegional(rp, region) ||
          (rp.form || '').toLowerCase() === region.toLowerCase())
      );
      if (matching.length) return matching;
    }
    return children;
  };

  const nodeHtml = (speciesId, region, active, trig) => {
    const pokemon = resolvePokemon(speciesId, region);
    const img = pokemon && (pokemon.sprites?.official || pokemon.sprites?.default);
    const nameDisplay = (pokemon && pokemon.name) || (byId[speciesId] && byId[speciesId].name) || '';
    const detailId = pokemon ? pokemon.id : speciesId;
    return `
      <div class="evo-node${active ? ' evo-active' : ''}" onclick="showPokemonDetail(${speciesId}, ${detailId})">
        ${trig || ''}
        ${img ? `<img class="evo-sprite" src="${img}" alt="${nameDisplay}" loading="lazy">` : `<div class="evo-sprite evo-sprite-placeholder">?</div>`}
        <div class="evo-name">${nameDisplay}</div>
        ${(region || (pokemon && pokemon.form)) ? `<span class="evo-region">${region || pokemon.form}</span>` : ''}
      </div>
    `;
  };

  // Build the ordered evolution stages for a single starting form.
  const resolveTrack = (startPokemon, region) => {
    const stages = [];
    let frontier = [{ sp: startPokemon.speciesId, trig: null }];
    const visited = new Set();
    while (frontier.length) {
      const stage = [];
      const next = [];
      for (const f of frontier) {
        if (visited.has(f.sp)) continue;
        visited.add(f.sp);
        const node = byId[f.sp];
        if (!node) continue;
        const active = currentForm && resolvePokemon(f.sp, region) &&
          resolvePokemon(f.sp, region).id === currentForm.id;
        stage.push({ sp: f.sp, active, trig: f.trig });
        const children = (node.continuesTo || []).filter(id => !visited.has(id) && byId[id]);
        const chosen = chooseChildren(f.sp, region, children);
        for (const cid of chosen) {
          const cnode = byId[cid];
          next.push({ sp: cid, trig: formatEvolutionTrigger(cnode) });
        }
      }
      if (stage.length) stages.push(stage);
      frontier = next;
    }
    return stages;
  };

  const buildTrack = (startPokemon, region) => {
    const stages = resolveTrack(startPokemon, region);
    if (!stages.length) return '';
    const label = region
      ? `<div class="evo-track-label">${region}</div>`
      : (startPokemon.form ? `<div class="evo-track-label">${startPokemon.form}</div>` : '');
    const parts = [];
    stages.forEach((stage, i) => {
      if (i > 0) parts.push('<span class="evo-level-arrow">→</span>');
      const cards = stage.map(f => nodeHtml(f.sp, region, f.active, f.trig)).join('');
      parts.push(`<div class="evo-level">${cards}</div>`);
    });
    return `<div class="evo-track">${label}<div class="evo-track-row">${parts.join('')}</div></div>`;
  };

  // Gather every region present anywhere in this family (base always first).
  const regions = [];
  const seenRegions = new Set();
  for (const n of nodes) {
    for (const rp of regionalOf(n.speciesId)) {
      const r = rp.form;
      if (r && !seenRegions.has(r)) { seenRegions.add(r); regions.push(r); }
    }
  }

  // Render one explicit evolution track per region, walking from the chain root.
  const chartHtml = roots.map(root => {
    const tracks = [buildTrack(defaultOf(root.speciesId), null)];
    for (const region of regions) {
      const html = buildTrack(defaultOf(root.speciesId), region);
      if (html) tracks.push(html);
    }
    return tracks.filter(Boolean).join('');
  }).join('');

  section.innerHTML = `<div class="evolution-chart">${chartHtml}</div>`;
}

function formatEvolutionTrigger(node) {
  const trig = node.trigger || 'level-up';
  const labels = {
    'level-up': `→ ${node.minLevel ? 'Lv.' + node.minLevel : 'Level up'}`,
    'use-item': `→ Use ${node.item || 'item'}`,
    'trade': '→ Trade',
    'shed': '→ Shed',
    'three-critical-hits': '→ 3 crits',
    'take-damage': '→ Take damage',
    'spin': '→ Spin',
    'tower-of-darkness': '→ ToD',
    'tower-of-water': '→ ToW',
    'use-move': `→ ${node.item || 'Use move'}`,
    'level-up-with-high-attack': `→ Lv.${node.minLevel || ''} high Atk`,
    'level-up-with-high-defense': `→ Lv.${node.minLevel || ''} high Def`,
    'level-extra-long': `→ Lv.${node.minLevel || ''} jump`,
    'level-up-in-rain': `→ Lv.${node.minLevel || ''} in rain`,
    'level-up-in-darkness': `→ Lv.${node.minLevel || ''} in dark`,
    'level-up-in-cloudy': `→ Lv.${node.minLevel || ''} cloudy`,
    'level-up-in-galarian-fields': '→ Lv. up Galar fields',
    'level-up-in-let-s-go-sunny': '→ Lv. up sunny LG',
    'level-up-in-let-s-go-rainy': '→ Lv. up rainy LG',
    'agile-style': '→ Agile style',
    'strong-style': '→ Strong style',
    'nighttime': '→ Night',
    'daytime': '→ Day',
    'counter-amount': '→ Counter',
    'use-item-var': `→ Use ${node.item || 'item'}`,
  };
  return `<span class="evo-arrow">${labels[trig] || `→ ${trig}`}</span>`;
}

function getMultiplierClass(multiplier) {
  if (multiplier === 0) return 'immunity';
  if (multiplier >= 4) return 'quad-weak';
  if (multiplier >= 2) return 'weak';
  if (multiplier > 0 && multiplier < 0.25) return 'quad-resist';
  if (multiplier > 0 && multiplier <= 0.5) return 'resist';
  return 'neutral';
}

function getTimesOfWeakness(multiplier) {
  if (multiplier === 0) return 'Immunity';
  if (multiplier === 0.25) return '4x Resist';
  if (multiplier === 0.5) return '2x Resist';
  if (multiplier === 1) return 'Neutral';
  if (multiplier === 2) return '2x Weak';
  if (multiplier === 4) return '4x Weak';
  return `${multiplier}x`;
}

function showAbilityDetails(event, formIndex, abilityIndex) {
  closeAbilityDetails();
  const pokemon = currentModalForms[formIndex];
  if (!pokemon) return;
  const ability = (pokemon.abilities || [])[abilityIndex];
  if (!ability) return;

  let box = document.getElementById('abilityDetailBox');
  if (!box) {
    box = document.createElement('div');
    box.id = 'abilityDetailBox';
    box.className = 'ability-detail-box';
    document.body.appendChild(box);
  }

  box.innerHTML = `
    <div class="ability-detail-header">
      <span class="ability-detail-name">${ability.name}</span>
      <button class="ability-detail-close" onclick="event.stopPropagation(); closeAbilityDetails()">&times;</button>
    </div>
    <div class="ability-detail-text">${ability.description || 'No description available.'}</div>
  `;
  box.style.display = 'flex';

  const rect = event.currentTarget.getBoundingClientRect();
  const boxWidth = 320;
  const boxHeight = box.offsetHeight;

  let left = rect.left + rect.width / 2 - boxWidth / 2;
  let top = rect.top - boxHeight - 12;

  if (top < 8) top = rect.bottom + 12;
  if (left < 8) left = 8;
  if (left + boxWidth > window.innerWidth - 8) left = window.innerWidth - boxWidth - 8;

  box.style.left = left + 'px';
  box.style.top = top + 'px';
}

function closeAbilityDetails() {
  const box = document.getElementById('abilityDetailBox');
  if (box) box.style.display = 'none';
}

let modalHistoryPushed = false;
let modalScrollPos = 0;

function openModal() {
  modalScrollPos = window.scrollY;
  weaknessModal.style.display = 'flex';
  document.documentElement.classList.add('modal-open');
  document.body.classList.add('modal-open');
  if (modalBody) modalBody.scrollTop = 0;
  if (window.history && window.history.pushState && !modalHistoryPushed) {
    history.pushState({ modalOpen: true }, '');
    modalHistoryPushed = true;
  }
}

function closeModal() {
  if (modalHistoryPushed) {
    modalHistoryPushed = false;
    if (window.history && window.history.state && window.history.state.modalOpen) {
      history.back();
    }
  }
  weaknessModal.style.display = 'none';
  document.documentElement.classList.remove('modal-open');
  document.body.classList.remove('modal-open');
  window.scrollTo(0, modalScrollPos);
  closeAbilityDetails();
}

window.addEventListener('popstate', () => {
  if (window.history && window.history.state && window.history.state.modalOpen) {
    modalHistoryPushed = true;
  }
  if (weaknessModal.style.display === 'flex') {
    if (window.history && window.history.pushState) {
      history.pushState({ modalOpen: true }, '');
      modalHistoryPushed = true;
    }
  }
});

document.addEventListener('DOMContentLoaded', init);

if (searchInput) {
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') runSearch();
  });
  const debouncedSearch = debounce(() => runSearch(), 300);
  searchInput.addEventListener('input', debouncedSearch);
}

const moveSearchInput = document.getElementById('moveSearchInput');
if (moveSearchInput) {
  moveSearchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') loadMoves();
  });
  const debouncedMoves = debounce(() => loadMoves(), 300);
  moveSearchInput.addEventListener('input', debouncedMoves);
}

const abilitySearchInput = document.getElementById('abilitySearchInput');
if (abilitySearchInput) {
  const debouncedAbilities = debounce(() => loadAbilities(), 300);
  abilitySearchInput.addEventListener('input', debouncedAbilities);
}

if (weaknessModal) {
  weaknessModal.addEventListener('click', (e) => {
    if (e.target === weaknessModal) closeModal();
  });
}

const infoModal = document.getElementById('infoModal');

function toggleInfo() {
  if (!infoModal) return;
  if (infoModal.getAttribute('aria-hidden') === 'true') {
    infoModal.setAttribute('aria-hidden', 'false');
    infoModal.style.display = 'flex';
  } else {
    closeInfo();
  }
}

function closeInfo() {
  if (!infoModal) return;
  infoModal.setAttribute('aria-hidden', 'true');
  infoModal.style.display = 'none';
}

let refreshPollTimer = null;

const OWNER_KEY_STORE = 'rotomOwnerKey';

function storedOwnerKey() {
  return localStorage.getItem(OWNER_KEY_STORE) || '';
}

function ownerHeaders() {
  const key = storedOwnerKey();
  return key ? { 'X-Owner-Key': key } : {};
}

function setOwnerActive(active) {
  const update = document.getElementById('ownerUpdate');
  if (update) update.hidden = !active;
  const lock = document.getElementById('ownerLockBtn');
  if (lock) {
    lock.classList.toggle('active', active);
    lock.title = active ? 'Owner unlocked — manage data' : 'Owner-only settings';
  }
}

function toggleOwnerPrompt() {
  if (storedOwnerKey()) {
    // Already unlocked: offer a way back to the prompt / lock.
    localStorage.removeItem(OWNER_KEY_STORE);
    setOwnerActive(false);
    const prompt = document.getElementById('ownerPrompt');
    if (prompt) prompt.hidden = true;
    return;
  }
  const prompt = document.getElementById('ownerPrompt');
  if (!prompt) return;
  prompt.hidden = !prompt.hidden;
  const input = document.getElementById('ownerKeyInput');
  if (!prompt.hidden && input) input.focus();
}

async function verifyOwner() {
  const input = document.getElementById('ownerKeyInput');
  const msg = document.getElementById('ownerMsg');
  const key = input ? input.value.trim() : '';
  if (!key) return;
  try {
    const res = await fetch('/api/owner/verify', { headers: { 'X-Owner-Key': key } });
    const data = await res.json();
    if (data.owner) {
      localStorage.setItem(OWNER_KEY_STORE, key);
      if (msg) msg.textContent = '';
      if (input) input.value = '';
      const prompt = document.getElementById('ownerPrompt');
      if (prompt) prompt.hidden = true;
      setOwnerActive(true);
    } else {
      if (msg) msg.textContent = 'Key rejected.';
    }
  } catch (e) {
    console.error('Owner verify failed:', e);
    if (msg) msg.textContent = 'Could not reach the server.';
  }
}

async function restoreOwnerSession() {
  if (!storedOwnerKey()) return;
  try {
    const res = await fetch('/api/owner/verify', { headers: ownerHeaders() });
    const data = await res.json();
    setOwnerActive(!!data.owner);
  } catch (e) {
    // ignore — leave hidden
  }
}

function refreshStatusEl(msg, state) {
  const el = document.getElementById('updateDataStatus');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('updating', 'done', 'error');
  if (state) el.classList.add(state);
}

async function requestDataRefresh() {
  const btn = document.getElementById('updateDataBtn');
  if (btn) btn.disabled = true;
  refreshStatusEl('Contacting server...');
  try {
    const res = await fetch('/api/refresh?force=1', { headers: ownerHeaders() });
    const data = await res.json();
    if (res.status === 401 || !data.ok) {
      localStorage.removeItem(OWNER_KEY_STORE);
      setOwnerActive(false);
      refreshStatusEl('Owner authentication rejected.', 'error');
      if (btn) btn.disabled = false;
      return;
    }
    if (data.started) {
      refreshStatusEl('Fetching the newest data from the PokéAPI. This takes a few minutes — the app stays usable meanwhile. Check back shortly!', 'updating');
      if (data && data.refreshing) startRefreshPolling();
    } else if (data.refreshing) {
      refreshStatusEl('An update is already running. Check back shortly!', 'updating');
      startRefreshPolling();
    } else {
      refreshStatusEl('Data is already up to date.', 'done');
    }
  } catch (e) {
    console.error('Refresh request failed:', e);
    refreshStatusEl('Could not reach the server.', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

function startRefreshPolling() {
  if (refreshPollTimer) clearInterval(refreshPollTimer);
  refreshPollTimer = setInterval(async () => {
    try {
      const res = await fetch('/status');
      const s = await res.json();
      if (s.phase === 'ready') {
        clearInterval(refreshPollTimer);
        refreshPollTimer = null;
        refreshStatusEl('Update complete! The Pokédex is running the newest data.', 'done');
        const btn = document.getElementById('updateDataBtn');
        if (btn) btn.disabled = false;
      } else if (s.phase === 'error') {
        clearInterval(refreshPollTimer);
        refreshPollTimer = null;
        refreshStatusEl('The update failed (likely a network hiccup). Try again in a moment.', 'error');
        const btn = document.getElementById('updateDataBtn');
        if (btn) btn.disabled = false;
      } else {
        refreshStatusEl(`Updating… ${s.message || ''}`, 'updating');
      }
    } catch (e) {
      clearInterval(refreshPollTimer);
      refreshPollTimer = null;
    }
  }, 4000);
}

if (infoModal) {
  infoModal.addEventListener('click', (e) => {
    if (e.target === infoModal) closeInfo();
  });
}

document.addEventListener('click', (e) => {
  const box = document.getElementById('abilityDetailBox');
  if (box && box.style.display !== 'none' && !box.contains(e.target)) {
    closeAbilityDetails();
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopScanCamera();
});

const scanWindowEl = document.getElementById('scanWindow');
if (scanWindowEl) {
  scanWindowEl.addEventListener('click', () => {
    if (scanMediaActive) captureCameraFrame();
  });
}

/* ---------------- Guess Game view ---------------- */

const GUESS_MAX_HINTS = 7;
let guessTarget = null;
let guessHintsShown = 0;
let guessFormHints = null;

// Which non-default forms count as a "meaningful alternate form" for the
// alternate-form hint. Everything derived from /pokemon is formType 'cosplay'
// except mega/gmax/primal/regional. We count visually/functionally distinct
// alternates but exclude cosmetic, size, season, pattern, colour-only, and
// anime-exclusive forms.
const ALT_FORM_EXCLUDE_BASE = new Set([
  'Unown', 'Vivillon', 'Minior', 'Burmy', 'Wormadam', 'Pumpkaboo', 'Gourgeist',
  'Deerling', 'Sawsbuck',
]);
function isExcludedAltForm(p) {
  if (p.isMega || p.isGmax || p.formType === 'primal' || p.isRegionalVariant) return true;
  if (/\btotem\b/i.test(p.displayName)) return true;
  if (/^Greninja \(Ash\)$/i.test(p.displayName)) return true;
  if (/^Greninja \(Battle.?bond\)$/i.test(p.displayName)) return true;
  if (/^Floette \(Eternal\)$/i.test(p.displayName)) return true;
  if (/\(Cosplay\)/i.test(p.displayName) || /\(Starter\)/i.test(p.displayName)) return true;
  if (ALT_FORM_EXCLUDE_BASE.has(p.baseName) && !p.isDefault) return true;
  return false;
}

function computeFormHintsFor(p) {
  const speciesId = p.speciesId ?? p.id;
  const forms = allPokemon.filter(f =>
    (f.speciesId ?? f.id) === speciesId ||
    (f.baseName && f.baseName === p.baseName)
  );
  let altCount = 0;
  let hasMega = false;
  let hasGmax = false;
  let hasPrimal = false;
  for (const f of forms) {
    if (f.isMega) hasMega = true;
    if (f.isGmax) hasGmax = true;
    if (f.formType === 'primal') hasPrimal = true;
    if (!f.isDefault && !isExcludedAltForm(f)) altCount++;
  }
  return { altCount, hasMega, hasGmax, hasPrimal };
}

function isGuessable(p) {
  return p.isDefault || p.isMega || p.isGmax;
}

function guessFormPool() {
  const pool = allPokemon.filter(isGuessable);
  const result = [];
  for (const p of pool) {
    result.push({ pokemon: p, hints: computeFormHintsFor(p) });
  }
  return result;
}

function guessHintPool() {
  const info = guessFormPool();
  // Skip species with no interesting data (e.g. no flavor text) so every hint
  // round has something useful to reveal.
  return info.filter(it => it.pokemon.flavorText && it.pokemon.flavorText.trim());
}

function pickGuessTarget() {
  const pool = guessHintPool();
  return pool[Math.floor(Math.random() * pool.length)];
}

function shuffleArray(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Craft a tricky evolution-family hint that gives useful info WITHOUT naming
// the target or its evolution partners (otherwise it'd give the answer away).
function buildEvoHint(p) {
  if (p.isFirstStage) {
    if (p.evoNextCount === 0) return null;
    if (p.evoNextCount > 1) return `It can evolve into one of ${p.evoNextCount} different forms.`;
    if (p.evoTrigger === 'level-up' && p.evoMinLevel) return `It evolves at level ${p.evoMinLevel}.`;
    if (p.evoTrigger === 'trade') return 'It evolves when it is traded.';
    if (p.evoItem) return `It evolves when exposed to a ${p.evoItem.replace(/-/g, ' ')}.`;
    if (p.evoTrigger === 'use-move') return 'It evolves after using a certain move.';
    if (p.evoTrigger) return `It evolves via ${p.evoTrigger.replace(/-/g, ' ')}.`;
    return 'It is the first stage of its evolution line.';
  }
  if (p.isMiddle) {
    let hint = 'It is the middle stage of its evolution line.';
    if (p.evoTrigger === 'level-up' && p.evoMinLevel) hint += ` It evolves at level ${p.evoMinLevel}.`;
    else if (p.evoItem) hint += ` It evolves when exposed to a ${p.evoItem.replace(/-/g, ' ')}.`;
    else if (p.evoTrigger) hint += ` It evolves via ${p.evoTrigger.replace(/-/g, ' ')}.`;
    return hint;
  }
  if (p.isFinal && p.evoPreCount > 0) {
    return 'It is the final form of its evolution line.';
  }
  return null;
}

function buildGuessHints(target) {
  const p = target.pokemon;
  const st = p.stats || {};
  const statKeys = ['hp', 'attack', 'defense', 'spAtk', 'spDef', 'speed'];
  const statNames = { hp: 'HP', attack: 'Attack', defense: 'Defense', spAtk: 'Sp. Atk', spDef: 'Sp. Def', speed: 'Speed' };
  const bst = statKeys.reduce((s, k) => s + (st[k] || 0), 0);

  const pool = [];
  const statHints = [];

  pool.push(`Type: ${p.types.map(t => t.type).join(' / ')}`);

  if (target.hints.altCount > 0) {
    pool.push(`It has ${target.hints.altCount} alternate form${target.hints.altCount === 1 ? '' : 's'}.`);
  }
  if (!p.isMega && target.hints.hasMega) pool.push('This Pokémon has a Mega Evolution.');
  if (!p.isGmax && target.hints.hasGmax) pool.push('This Pokémon has a Gigantamax form.');
  if (target.hints.hasPrimal) pool.push('This Pokémon has Primal forms.');
  if (p.isMega) pool.push('This Pokémon is a Mega Evolution.');
  if (p.isGmax) pool.push('This Pokémon is a Gigantamax form.');
  if (p.isMega) {
    const megaCount = allPokemon.filter(f => f.baseName === p.baseName && f.isMega).length;
    if (megaCount === 2) pool.push('It is one of two Mega Evolutions for its species.');
  }

  if (p.genera) pool.push(`It is known as the ${p.genera}.`);

  // Only ever reveal ONE stat hint so the game isn't guessable from numbers alone.
  for (const k of statKeys) {
    if (typeof st[k] === 'number') {
      statHints.push(`Its base ${statNames[k]} stat is ${st[k]}.`);
    }
  }
  statHints.push(`Its total base stats are ${bst}.`);
  pool.push(statHints[Math.floor(Math.random() * statHints.length)]);

  if (p.height) pool.push(`It is ${p.height} m tall.`);
  if (p.weight) pool.push(`It weighs ${p.weight} kg.`);

  // Region and Generation are near-identical, so include at most one: picking
  // one locks the other out for the whole round.
  const originHints = [];
  if (p.region) originHints.push(`It is from the ${p.region} region.`);
  if (p.generation) originHints.push(`It debuted in Generation ${p.generation}.`);
  if (originHints.length) {
    pool.push(originHints[Math.floor(Math.random() * originHints.length)]);
  }

  const usableAbils = (p.abilities || []).filter(a => a && a.name).map(a => a.name);
  if (usableAbils.length) pool.push(`Its abilities include ${usableAbils.join(', ')}.`);

  if (p.legendaryStatus) {
    pool.push(p.legendaryStatus === 'mythical'
      ? 'It is a Mythical Pokémon.'
      : 'It is a Legendary Pokémon.');
  }

  // Non-revealing evolution hint (may be absent for single-form Pokémon).
  const evoHint = buildEvoHint(p);
  if (evoHint) pool.push(evoHint);

  // The dex entry is always the final (7th) hint.
  let flavor = (p.flavorText || '').trim();
  let dexHint = null;
  if (flavor) {
    if (flavor.length > 120) flavor = flavor.slice(0, 117).trimEnd() + '...';
    dexHint = `Dex entry: "${flavor}"`;
  }

  // Pick up to 6 non-dex hints (shuffled), then append the dex entry last so
  // the sequence maxes out at 7 and always ends on the biggest giveaway.
  const chosen = [];
  for (const h of shuffleArray(pool)) {
    if (chosen.length >= GUESS_MAX_HINTS - 1) break;
    chosen.push(h);
  }
  if (dexHint) chosen.push(dexHint);

  // If there are fewer than 6 cues, we may end with fewer than 7 total hints;
  // that's fine. Shuffle only the non-dex portion to keep dex last.
  return chosen;
}

function startGuessGame() {
  const viewVisible = document.getElementById('guessView') && document.getElementById('guessView').style.display !== 'none';
  if (!viewVisible && currentViewId !== 'guessView') return;
  if (!allPokemon.length) return;

  const picked = pickGuessTarget();
  guessTarget = picked;
  guessHintsShown = 0;
  guessFormHints = picked.hints;
  const all = buildGuessHints(picked);

  const hintsEl = document.getElementById('guessHints');
  const stageEl = document.getElementById('guessStage');
  const answerEl = document.getElementById('guessAnswer');
  const attemptsEl = document.getElementById('guessAttempts');
  const hintBtn = document.getElementById('guessHintBtn');
  const revealBtn = document.getElementById('guessRevealBtn');
  const guessRow = document.getElementById('guessInputRow');

  if (hintsEl) {
    hintsEl.innerHTML = '';
    for (let i = 0; i < all.length; i++) {
      const li = document.createElement('li');
      li.textContent = all[i];
      li.style.display = 'none';
      hintsEl.appendChild(li);
    }
  }
  if (stageEl) stageEl.innerHTML = '<span class="guess-silhouette">❓</span>';
  if (answerEl) { answerEl.style.display = 'none'; answerEl.innerHTML = ''; }
  if (attemptsEl) attemptsEl.textContent = `Hint 0 / ${all.length}`;
  if (hintBtn) { hintBtn.style.display = 'inline-block'; hintBtn.disabled = false; }
  if (revealBtn) revealBtn.style.display = 'none';
  // Guess bar stays hidden until the player starts revealing hints.
  if (guessRow) guessRow.style.display = 'none';
  hideGuessSuggestions();
  const inputEl = document.getElementById('guessInput');
  const fbEl = document.getElementById('guessFeedback');
  if (inputEl) { inputEl.value = ''; inputEl.blur(); }
  if (fbEl) { fbEl.textContent = ''; fbEl.className = 'guess-feedback'; }
}

function normalizeGuess(s) {
  return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ').replace(/[^a-z0-9\-' ]/g, '');
}

let guessSuggestIndex = -1;

function guessSuggestMatch(query, allowIdMatch = true) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const isNum = /^\d+$/.test(q) && allowIdMatch;
  const max = 8;
  const results = [];
  for (const p of allPokemon) {
    if (!isGuessable(p)) continue;
    if (isNum) {
      if (String(p.speciesId ?? p.id).startsWith(q)) results.push(p);
    } else {
      const n = String(p.displayName || p.name || '').toLowerCase();
      if (n.startsWith(q) || n.includes(q)) results.push(p);
    }
    if (results.length >= max) break;
  }
  // Keep stable order (dex order) by filtering from the full list.
  return allPokemon.filter(p => {
    if (!isGuessable(p)) return false;
    const n = String(p.displayName || p.name || '').toLowerCase();
    return isNum ? String(p.speciesId ?? p.id).startsWith(q) : (n.startsWith(q) || n.includes(q));
  }).slice(0, max);
}

function clearSuggestions(boxEl) {
  guessSuggestIndex = -1;
  if (boxEl) { boxEl.style.display = 'none'; boxEl.innerHTML = ''; }
}

function selectSuggestion(inputEl, boxEl, name) {
  if (inputEl) { inputEl.value = name; inputEl.focus(); }
  clearSuggestions(boxEl);
}

function refreshSuggestions(inputEl, boxEl, onSubmit, isHidden, showDexId = true, allowIdMatch = true) {
  if (!inputEl || !boxEl) return;
  if (isHidden) { clearSuggestions(boxEl); return; }
  const items = guessSuggestMatch(inputEl.value || '', allowIdMatch);
  if (!items.length) { clearSuggestions(boxEl); return; }
  boxEl.innerHTML = '';
  items.forEach((p, i) => {
    const div = document.createElement('div');
    div.className = 'guess-suggestion' + (i === guessSuggestIndex ? ' active' : '');
    if (showDexId) {
      div.textContent = `${p.displayName}  ·  `;
      const num = document.createElement('span');
      num.className = 'guess-sugg-dex';
      num.textContent = `#${p.speciesId ?? p.id}`;
      div.appendChild(num);
    } else {
      div.textContent = p.displayName;
    }
    div.dataset.name = p.displayName;
    div.addEventListener('mousedown', (e) => {
      e.preventDefault();
      selectSuggestion(inputEl, boxEl, div.dataset.name);
    });
    div.addEventListener('mouseenter', () => {
      guessSuggestIndex = i;
      Array.prototype.forEach.call(boxEl.children, (c, ci) => c.classList.toggle('active', ci === guessSuggestIndex));
    });
    boxEl.appendChild(div);
  });
  boxEl.style.display = 'block';
}

function handleSuggestionsKey(e, inputEl, boxEl, onSubmit) {
  const visible = boxEl && boxEl.style.display === 'block';
  if (e.key === 'ArrowDown') {
    if (visible) {
      e.preventDefault();
      const count = boxEl.children.length;
      if (!count) return;
      guessSuggestIndex = (guessSuggestIndex + 1) % count;
      Array.prototype.forEach.call(boxEl.children, (c, i) => c.classList.toggle('active', i === guessSuggestIndex));
    }
  } else if (e.key === 'ArrowUp') {
    if (visible) {
      e.preventDefault();
      const count = boxEl.children.length;
      if (!count) return;
      guessSuggestIndex = (guessSuggestIndex - 1 + count) % count;
      Array.prototype.forEach.call(boxEl.children, (c, i) => c.classList.toggle('active', i === guessSuggestIndex));
    }
  } else if (e.key === 'Tab' || e.key === 'Enter') {
    if (visible && guessSuggestIndex >= 0) {
      const sel = boxEl.children[guessSuggestIndex];
      if (sel && (e.key === 'Tab' || e.key === 'Enter')) {
        e.preventDefault();
        selectSuggestion(inputEl, boxEl, sel.dataset.name);
        if (e.key === 'Enter') onSubmit();
      }
    } else if (e.key === 'Enter') {
      onSubmit();
    }
  } else if (e.key === 'Escape') {
    clearSuggestions(boxEl);
  }
}

function showGuessSuggestions() {
  const row = document.getElementById('guessInputRow');
  refreshSuggestions(
    document.getElementById('guessInput'),
    document.getElementById('guessSuggestions'),
    submitGuess,
    row ? row.style.display === 'none' : false
  );
}

function hideGuessSuggestions() {
  clearSuggestions(document.getElementById('guessSuggestions'));
}

function selectGuessSuggestion(name) {
  selectSuggestion(document.getElementById('guessInput'), document.getElementById('guessSuggestions'), name);
}

function handleGuessInputKey(e) {
  handleSuggestionsKey(e, document.getElementById('guessInput'), document.getElementById('guessSuggestions'), submitGuess);
}

function submitGuess() {
  if (!guessTarget) return;
  const inputEl = document.getElementById('guessInput');
  const fbEl = document.getElementById('guessFeedback');
  const val = normalizeGuess(inputEl && inputEl.value);
  if (!val) return;
  const p = guessTarget.pokemon;
  const targets = p.isMega || p.isGmax
    ? [p.displayName, p.name].filter(Boolean).map(normalizeGuess).filter(Boolean)
    : [p.displayName, p.name, p.baseName].filter(Boolean).map(normalizeGuess).filter(Boolean);
  const correct = targets.includes(val);

  if (fbEl) {
    if (correct) {
      fbEl.textContent = 'Correct! Well done.';
      fbEl.className = 'guess-feedback correct';
      revealAnswer();
    } else {
      const hintsEl = document.getElementById('guessHints');
      const total = hintsEl ? hintsEl.children.length : 0;
      // Clear the guess bar on every wrong guess.
      if (inputEl) { inputEl.value = ''; inputEl.focus(); }
      hideGuessSuggestions();
      if (guessHintsShown >= total) {
        // All hints already shown — a wrong guess reveals the answer.
        fbEl.textContent = 'Out of hints — revealing the answer.';
        fbEl.className = 'guess-feedback wrong';
        revealAnswer();
      } else {
        fbEl.textContent = 'Not that one — next hint revealed.';
        fbEl.className = 'guess-feedback wrong';
        revealHint();
      }
    }
  }
}

function revealHint(showGuessBar) {
  if (!guessTarget) return;
  const hintsEl = document.getElementById('guessHints');
  const attemptsEl = document.getElementById('guessAttempts');
  const revealBtn = document.getElementById('guessRevealBtn');
  const hintBtn = document.getElementById('guessHintBtn');
  const items = hintsEl ? hintsEl.children : [];

  // After the first hint is revealed, show the guess bar and autocomplete.
  const guessRow = document.getElementById('guessInputRow');
  if (guessRow && guessRow.style.display === 'none') {
    guessRow.style.display = 'flex';
    const inputEl = document.getElementById('guessInput');
    if (inputEl) inputEl.focus();
  }

  if (guessHintsShown >= items.length) {
    if (revealBtn) revealBtn.style.display = 'inline-block';
    if (hintBtn) hintBtn.style.display = 'none';
    return;
  }
  const item = items[guessHintsShown];
  if (item) item.style.display = 'list-item';
  guessHintsShown++;
  if (attemptsEl) attemptsEl.textContent = `Hint ${guessHintsShown} / ${items.length}`;
  if (guessHintsShown >= items.length) {
    if (revealBtn) revealBtn.style.display = 'inline-block';
    if (hintBtn) hintBtn.style.display = 'none';
  }
}

function revealAnswer() {
  if (!guessTarget) return;
  const p = guessTarget.pokemon;
  const stageEl = document.getElementById('guessStage');
  const answerEl = document.getElementById('guessAnswer');
  const revealBtn = document.getElementById('guessRevealBtn');

  const front = (p.sprites && (p.sprites.official || p.sprites.default)) || '';
  if (stageEl) {
    stageEl.innerHTML = front
      ? `<img class="guess-sprite" src="${front}" alt="${p.displayName}">`
      : `<span class="guess-silhouette">❓</span>`;
  }
  if (answerEl) {
    answerEl.style.display = 'block';
    const types = p.types.map(t => t.type).join(' / ');
    answerEl.innerHTML = `<strong>${p.displayName}</strong> — ${types} · Dex #${p.speciesId ?? p.id}`;
  }
  if (revealBtn) revealBtn.style.display = 'none';
  const hintBtn = document.getElementById('guessHintBtn');
  if (hintBtn) hintBtn.style.display = 'none';
  hideGuessSuggestions();
}

document.addEventListener('keydown', (e) => {
  const modalOpen = weaknessModal.style.display === 'flex';
  const tag = (e.target && e.target.tagName) || '';
  const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  if (e.key === 'Escape') {
    if (scanMediaActive) {
      cancelCameraScan();
      return;
    }
    closeModal();
    return;
  }
  if (modalOpen && !isTyping && (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === '[' || e.key === ']')) {
    const delta = (e.key === 'ArrowRight' || e.key === ']') ? 1 : -1;
    e.preventDefault();
    navigatePopup(delta);
  }
});

/* ================ Dex Duel ================ */

const dexDuel = {
  players: [],
  alive: [],
  target: null,
  round: 0,
  turnIdx: 0,
  guesses: [],
  tiebreak: null,
  phase: 'setup',
};

function dexDuelEscapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function openDexDuel() {
  dexDuel.players = [];
  dexDuel.alive = [];
  dexDuel.target = null;
  dexDuel.round = 0;
  dexDuel.guesses = [];
  dexDuel.tiebreak = null;
  dexDuel.phase = 'setup';
  renderDexDuelSetup(2);
}

function renderDexDuelSetup(count, prevNames) {
  const body = document.getElementById('dexduelBody');
  if (!body) return;
  const n = Math.min(Math.max(count || 2, 2), 8);
  const opts = [];
  for (let i = 2; i <= 8; i++) opts.push(`<option value="${i}"${i === n ? ' selected' : ''}>${i}</option>`);
  let nameRows = '';
  for (let i = 0; i < n; i++) {
    const saved = (prevNames && prevNames[i]) ? dexDuelEscapeHtml(prevNames[i]) : '';
    nameRows += `<div class="dexduel-name-row"><label>Player ${i + 1}</label><input id="dexDuelName${i}" class="guess-input" placeholder="Enter name..." value="${saved}"></div>`;
  }
  body.innerHTML = `
    <div class="dexduel-setup">
      <p class="dexduel-desc">Each round a Pokédex number is revealed. Players take turns guessing the Pokémon that matches it — the closer the guess, the safer. The worst guess is eliminated each round. Last one standing wins.</p>
      <div class="dexduel-count-row">
        <label>Players</label>
        <select id="dexDuelCount" class="guess-input" onchange="dexDuelCountChange()">${opts.join('')}</select>
      </div>
      <div id="dexDuelNames">${nameRows}</div>
      <button class="scan-btn" onclick="startDexDuel()">▶ Start Game</button>
    </div>`;
  const first = document.getElementById('dexDuelName0');
  if (first) first.focus();
}

function dexDuelCountChange() {
  const sel = document.getElementById('dexDuelCount');
  const count = sel ? parseInt(sel.value, 10) : 2;
  const names = [];
  for (let i = 0; i < 8; i++) {
    const el = document.getElementById('dexDuelName' + i);
    if (el) names.push(el.value);
  }
  renderDexDuelSetup(count, names);
}

function startDexDuel() {
  const count = parseInt((document.getElementById('dexDuelCount') || { value: '2' }).value, 10);
  const raw = [];
  for (let i = 0; i < count; i++) {
    const el = document.getElementById('dexDuelName' + i);
    let name = (el ? el.value : '').trim();
    if (!name) name = 'Player ' + (i + 1);
    raw.push(name);
  }
  // Ensure unique names so elimination chips stay unambiguous.
  const seen = {};
  raw.forEach((nm, i) => {
    let key = nm;
    let k = 1;
    while (seen[key]) { k++; key = nm + ' (' + k + ')'; }
    seen[key] = true;
    raw[i] = key;
  });
  dexDuel.players = raw.map(n => ({ name: n }));
  dexDuel.alive = raw.map(() => true);
  dexDuel.round = 0;
  dexDuel.guesses = [];
  dexDuel.tiebreak = null;
  dexDuelNextRound();
}

function pickDexTarget() {
  const pool = allPokemon.filter(p => p.isDefault);
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

function dexDuelAliveIndices() {
  const out = [];
  for (let i = 0; i < dexDuel.players.length; i++) if (dexDuel.alive[i]) out.push(i);
  return out;
}

function dexDuelRoundPlayers() {
  if (dexDuel.tiebreak && dexDuel.tiebreak.pool && dexDuel.tiebreak.pool.length) {
    return dexDuel.tiebreak.pool.slice();
  }
  return dexDuelAliveIndices();
}

function dexDuelNextRound() {
  dexDuel.round++;
  dexDuel.target = pickDexTarget();
  dexDuel.guesses = [];
  dexDuel.turnIdx = 0;
  dexDuel.phase = 'guessing';
  renderDexDuelTurn();
}

function dexDuelStartTiebreak(...indices) {
  const inds = indices.filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b);
  const aliveCount = dexDuelAliveIndices().length;
  dexDuel.tiebreak = {
    pool: inds,
    roundsUsed: 0,
    maxRounds: Math.max(inds.length - 1, 1),
    suddenDeath: aliveCount === 2,
  };
  dexDuelStartTiebreakRound();
}

function dexDuelStartTiebreakRound() {
  dexDuel.target = pickDexTarget();
  dexDuel.guesses = [];
  dexDuel.turnIdx = 0;
  dexDuel.phase = 'guessing';
  renderDexDuelTurn();
}

function renderDexDuelTurn() {
  const body = document.getElementById('dexduelBody');
  if (!body) return;
  const roundPlayers = dexDuelRoundPlayers();
  const cur = roundPlayers[dexDuel.turnIdx];
  const target = dexDuel.target;
  const tie = dexDuel.tiebreak;
  const prefix = tie ? '⚔️ Tiebreaker round' : 'Round ' + dexDuel.round;
  const aliveNames = dexDuelAliveIndices().map(i => dexDuel.players[i].name).join(' · ');
  const tieInfo = tie
    ? `<div class="dexduel-tie-note">Tiebreaker ${Math.min(tie.roundsUsed + 1, tie.maxRounds)}/${tie.maxRounds} between: ${tie.pool.map(i => dexDuelEscapeHtml(dexDuel.players[i].name)).join(', ')}${tie.suddenDeath ? ' — sudden death' : ''}</div>`
    : '';
  body.innerHTML = `
    <div class="dexduel-stage">
      <div class="dexduel-round">${prefix}</div>
      ${tieInfo}
      <div class="dexduel-alive">In game: ${dexDuelEscapeHtml(aliveNames)}</div>
      <div class="dexduel-clue">
        <span class="dexduel-clue-label">The Pokémon's dex number is</span>
        <span class="dexduel-clue-num">#${target.speciesId}</span>
      </div>
      <div class="dexduel-turn">${dexDuelEscapeHtml(dexDuel.players[cur].name)} — type your guess</div>
      <div class="guess-input-row">
        <div class="guess-input-wrap">
          <input type="text" id="dexDuelInput" class="guess-input" placeholder="Type a Pokémon name..." autocomplete="off" oninput="showDexSuggestions()" onkeydown="handleDexInputKey(event)">
          <div class="guess-suggestions" id="dexDuelSuggestions"></div>
        </div>
        <button class="scan-btn" id="dexSubmitBtn" onclick="submitDexGuess()">Guess</button>
      </div>
      <div class="guess-feedback dexduel-feedback" id="dexDuelFeedback"></div>
      <div class="dexduel-guessed">Guessed: ${dexDuel.guesses.length} / ${roundPlayers.length} players</div>
    </div>`;
  const inputEl = document.getElementById('dexDuelInput');
  if (inputEl) inputEl.focus();
}

function showDexSuggestions() {
  refreshSuggestions(document.getElementById('dexDuelInput'), document.getElementById('dexDuelSuggestions'), submitDexGuess, false, false, false);
}

function hideDexSuggestions() {
  clearSuggestions(document.getElementById('dexDuelSuggestions'));
}

function handleDexInputKey(e) {
  handleSuggestionsKey(e, document.getElementById('dexDuelInput'), document.getElementById('dexDuelSuggestions'), submitDexGuess);
}

function dexResolveGuess(raw) {
  const val = normalizeGuess(raw);
  if (!val) return null;
  return allPokemon.find(p => p.isDefault && normalizeGuess(p.displayName || p.name) === val) || null;
}

function submitDexGuess() {
  if (dexDuel.phase !== 'guessing') return;
  const inputEl = document.getElementById('dexDuelInput');
  const fbEl = document.getElementById('dexDuelFeedback');
  const guess = dexResolveGuess(inputEl ? inputEl.value : '');
  if (!guess) {
    const raw = (inputEl ? inputEl.value : '').trim();
    if (fbEl) {
      fbEl.textContent = /^\d+$/.test(raw) ? 'Names only — no dex number guesses.' : 'Not a recognized Pokémon name.';
      fbEl.className = 'guess-feedback wrong';
    }
    if (inputEl) { inputEl.value = ''; inputEl.focus(); }
    hideDexSuggestions();
    return;
  }
  const roundPlayers = dexDuelRoundPlayers();
  const cur = roundPlayers[dexDuel.turnIdx];
  dexDuel.guesses.push({
    playerIdx: cur,
    name: dexDuel.players[cur].name,
    displayName: guess.displayName || guess.name,
    dex: guess.speciesId,
    img: guess.sprites?.official || guess.sprites?.default || '',
    diff: Math.abs(guess.speciesId - dexDuel.target.speciesId),
  });
  hideDexSuggestions();
  if (dexDuel.guesses.length >= roundPlayers.length) {
    finishDexDuelRound();
  } else {
    dexDuel.turnIdx++;
    renderDexDuelTurn();
  }
}

function finishDexDuelRound() {
  const body = document.getElementById('dexduelBody');
  if (!body) return;
  const g = dexDuel.guesses;
  const correct = g.filter(x => x.diff === 0);
  const worst = Math.max.apply(null, g.map(x => x.diff));
  const worstPlayers = g.filter(x => x.diff === worst && worst > 0);
  const inTie = !!dexDuel.tiebreak;

  let rows = '';
  for (const x of g) {
    const cls = x.diff === 0 ? 'dexduel-correct' : (x.diff === worst && worst > 0 ? 'dexduel-worst' : '');
    const imgHtml = x.img
      ? `<img class="dexduel-img" src="${x.img}" alt="${dexDuelEscapeHtml(x.displayName)}">`
      : `<div class="dexduel-img dexduel-img-empty">?</div>`;
    rows += `<tr class="${cls}"><td>${imgHtml}</td><td>${dexDuelEscapeHtml(x.name)}</td><td>${dexDuelEscapeHtml(x.displayName)}</td><td>#${x.dex}</td></tr>`;
  }

  let actionHtml = '';

  if (correct.length > 0) {
    const candidates = dexDuelAliveIndices().filter(i => !correct.some(c => c.playerIdx === i));
    const winners = [...new Set(correct.map(c => c.name))];
    if (!candidates.length) {
      actionHtml = `<div class="dexduel-info">Everyone guessed correctly — no elimination this round.</div><button class="scan-btn" onclick="dexDuelNoElimAdvance()">Continue ▶</button>`;
    } else {
      const chips = candidates.map(i => `<span class="dexduel-chip" onclick="dexDuelEliminate(${i})">${dexDuelEscapeHtml(dexDuel.players[i].name)}</span>`).join('');
      actionHtml = `<div class="dexduel-info">🎯 <strong>${dexDuelEscapeHtml(winners.join(' + '))}</strong> guessed correctly! They agreed on one elimination — tap a player:</div><div class="dexduel-chips">${chips}</div>`;
    }
  } else if (!worstPlayers.length) {
    actionHtml = `<div class="dexduel-info">No elimination this round.</div><button class="scan-btn" onclick="dexDuelAdvance()">Continue ▶</button>`;
  } else if (worstPlayers.length === 1) {
    const idx = worstPlayers[0].playerIdx;
    actionHtml = `<div class="dexduel-info">❌ Worst guess — <strong>${dexDuelEscapeHtml(worstPlayers[0].name)}</strong> is eliminated.</div><button class="scan-btn" onclick="dexDuelEliminateAdvance(${idx})">Continue ▶</button>`;
  } else {
    // Tie for worst.
    const tiedIdx = worstPlayers.map(w => w.playerIdx);
    if (inTie) {
      const tb = dexDuel.tiebreak;
      if (tb.suddenDeath) {
        tb.pool = tiedIdx;
        tb.roundsUsed++;
        actionHtml = `<div class="dexduel-info">⚔️ Still a tie between <strong>${dexDuelEscapeHtml(tiedIdx.map(i => dexDuel.players[i].name).join(', '))}</strong> — sudden death continues.</div><button class="scan-btn" onclick="dexDuelStartTiebreakRound()">Continue ▶</button>`;
      } else if (tb.roundsUsed + 1 >= tb.maxRounds) {
        actionHtml = `<div class="dexduel-info">⚔️ Tie persists after all tiebreaker rounds — all tied players are eliminated.</div><button class="scan-btn" onclick="dexDuelEliminateAllAdvance(${tiedIdx.join(',')})">Continue ▶</button>`;
      } else {
        tb.pool = tiedIdx;
        tb.roundsUsed++;
        actionHtml = `<div class="dexduel-info">⚔️ Still tied between <strong>${dexDuelEscapeHtml(tiedIdx.map(i => dexDuel.players[i].name).join(', '))}</strong> — another tiebreaker round.</div><button class="scan-btn" onclick="dexDuelStartTiebreakRound()">Continue ▶</button>`;
      }
    } else {
      actionHtml = `<div class="dexduel-info">⚔️ Tie for worst between <strong>${dexDuelEscapeHtml(tiedIdx.map(i => dexDuel.players[i].name).join(', '))}</strong> — tiebreaker rounds start.</div><button class="scan-btn" onclick="dexDuelStartTiebreak(${tiedIdx.join(',')})">Continue ▶</button>`;
    }
  }

  const tieNote = inTie
    ? `<div class="dexduel-tie-note">⚔️ Tiebreaker ${Math.min(dexDuel.tiebreak.roundsUsed + 1, dexDuel.tiebreak.maxRounds)}/${dexDuel.tiebreak.maxRounds} (pool: ${dexDuel.tiebreak.pool.map(i => dexDuel.players[i].name).join(', ')})</div>`
    : '';

  const targetImg = dexDuel.target.sprites?.official || dexDuel.target.sprites?.default || '';
  const targetImgHtml = targetImg
    ? `<img class="dexduel-target-img" src="${targetImg}" alt="${dexDuelEscapeHtml(dexDuel.target.displayName)}">`
    : `<div class="dexduel-target-img dexduel-img-empty">?</div>`;

  body.innerHTML = `
    <div class="dexduel-stage">
      <div class="dexduel-round">${inTie ? '⚔️ Tiebreaker round' : 'Round ' + dexDuel.round} — reveal</div>
      ${tieNote}
      <div class="dexduel-clue">
        ${targetImgHtml}
        <div class="dexduel-clue-num">#${dexDuel.target.speciesId}</div>
        <div class="dexduel-clue-answer">it was <strong>${dexDuelEscapeHtml(dexDuel.target.displayName)}</strong></div>
      </div>
      <table class="dexduel-reveal">
        <thead><tr><th></th><th>Player</th><th>Guess</th><th>Dex</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      ${actionHtml}
    </div>`;
}

function dexDuelAdvance() {
  if (dexDuelAliveIndices().length <= 1) {
    dexDuel.tiebreak = null;
    renderDexDuelWinner();
    return;
  }
  dexDuel.tiebreak = null;
  dexDuelNextRound();
}

function dexDuelNoElimAdvance() {
  dexDuel.tiebreak = null;
  dexDuelAdvance();
}

function dexDuelEliminateAdvance(idx) {
  dexDuel.alive[idx] = false;
  hideDexSuggestions();
  dexDuelAdvance();
}

function dexDuelEliminateAllAdvance(...indices) {
  indices.forEach(i => { if (i != null) dexDuel.alive[i] = false; });
  hideDexSuggestions();
  dexDuelAdvance();
}

function dexDuelEliminate(idx) {
  dexDuel.alive[idx] = false;
  hideDexSuggestions();
  dexDuelAdvance();
}

function renderDexDuelWinner() {
  const body = document.getElementById('dexduelBody');
  if (!body) return;
  const alive = dexDuelAliveIndices();
  const winner = alive.length ? dexDuel.players[alive[0]].name : 'Nobody';
  body.innerHTML = `
    <div class="dexduel-stage dexduel-winner-stage">
      <div class="dexduel-winner">🏆 ${dexDuelEscapeHtml(winner)} is the champion!</div>
      <button class="scan-btn" onclick="openDexDuel()">Play again</button>
    </div>`;
}
