/* ════════════════════════════════════════
   INDIAN HISTORY ARCHIVE — script.js
════════════════════════════════════════ */

const PREVIEW_PER_CAT = 3;

/* ── Type icons (#9) ── */
const TYPE_ICONS = {
  article:  '📰',
  document: '📄',
  video:    '🎥',
  audio:    '🎙',
  image:    '🖼',
};

/* ── Category accent colours (#6) ── */
const CAT_COLOURS = [
  '#2563eb','#7c3aed','#0891b2','#059669',
  '#d97706','#dc2626','#9333ea','#0284c7',
  '#65a30d','#c2410c','#0d9488','#be185d',
];
const catColourMap = {};
function getCatColour(cat) {
  if (!catColourMap[cat]) {
    const keys = Object.keys(catColourMap);
    catColourMap[cat] = CAT_COLOURS[keys.length % CAT_COLOURS.length];
  }
  return catColourMap[cat];
}

/* ── Era buckets ── */
const ERAS = [
  { label: 'Prehistoric / Proto-Historic (before 600 BCE)', test: y => y < -600 },
  { label: 'Ancient (600 BCE – 600 CE)',                    test: y => y >= -600 && y < 600  },
  { label: 'Early Medieval (600 – 1200 CE)',                test: y => y >= 600  && y < 1200 },
  { label: 'Medieval (1200 – 1526 CE)',                     test: y => y >= 1200 && y < 1526 },
  { label: 'Early Modern (1526 – 1757 CE)',                 test: y => y >= 1526 && y < 1757 },
  { label: 'Colonial Era (1757 – 1947 CE)',                 test: y => y >= 1757 && y < 1947 },
  { label: 'Post-Independence (1947 CE onwards)',           test: y => y >= 1947 },
];

function getEra(item) {
  const y = item.period?.start_year ?? 0;
  return ERAS.find(e => e.test(y))?.label ?? 'Unknown';
}

function yearLabel(y) {
  if (y === null || y === undefined) return '';
  return y < 0 ? `${Math.abs(y)} BCE` : `${y} CE`;
}

function periodLabel(item) {
  if (!item.period) return '';
  const s = item.period.start_year;
  const e = item.period.end_year;
  if (s === e) return yearLabel(s);
  return `${yearLabel(s)} – ${yearLabel(e)}`;
}

/* ════════════════════════════════════════
   STATE
════════════════════════════════════════ */
let allData      = [];
let totalRecords = 0;
let currentPage  = 1;
let perPage      = 20;
let sortMode     = 'default';
let searchScope  = 'all';

const AF = {
  search:        '',
  types:         new Set(),
  categories:    new Set(),
  subcategories: new Set(),
  eras:          new Set(),
  dynasties:     new Set(),
  regions:       new Set(),
  sourceTypes:   new Set(),
  languages:     new Set(),
  formats:       new Set(),
  tags:          new Set(),
};

/* ════════════════════════════════════════
   DOM REFS
════════════════════════════════════════ */
const $ = id => document.getElementById(id);

const searchEl        = $('search');
const searchClear     = $('searchClear');
const searchScopeEl   = $('searchScope');
const clearAllBtn     = $('clearAllBtn');
const activeFiltersEl = $('activeFilters');
const categoryView    = $('categoryView');
const flatView        = $('flatView');
const flatGrid        = $('flatGrid');
const paginationEl    = $('pagination');
const resultsCount    = $('resultsCount');
const resultsLabel    = $('resultsLabel');
const perPageSelect   = $('perPage');
const sortSelect      = $('sortSelect');
const tagSearchEl     = $('tagSearch');
const backToBrowse    = $('backToBrowse');
const sidebar         = $('sidebar');
const sidebarOverlay  = $('sidebarOverlay');

/* ════════════════════════════════════════
   INIT — two-phase loader
════════════════════════════════════════ */
let chunkMap   = {};
const chunkCache = {};
let useChunks  = false;

fetch('data/index.json')
  .then(r => { if (!r.ok) throw new Error('no index'); return r.json(); })
  .then(payload => {
    useChunks    = true;
    chunkMap     = payload._meta?.chunks ?? {};
    allData      = payload.records;
    totalRecords = payload._meta?.total ?? allData.length;
    init(allData);
  })
  .catch(() => {
    fetch('data.json')
      .then(r => r.json())
      .then(data => {
        allData      = data;
        totalRecords = data.length;
        init(data);
      });
  });

async function loadChunk(category) {
  if (!useChunks) return;
  const filename = chunkMap[category];
  if (!filename || chunkCache[filename]) return;
  try {
    const res  = await fetch(`data/${filename}`);
    const full = await res.json();
    chunkCache[filename] = full;
    const ids = new Set(full.map(r => r.id));
    allData = [...allData.filter(r => !ids.has(r.id)), ...full];
  } catch (e) { console.warn('Chunk load failed:', e); }
}

async function preloadActiveChunks() {
  if (!useChunks || !AF.categories.size) return;
  await Promise.all([...AF.categories].map(cat => loadChunk(cat)));
}

function init(data) {
  $('docCount').textContent      = totalRecords;
  $('categoryCount').textContent = [...new Set(data.flatMap(d => d.categories))].length;
  $('tagCount').textContent      = [...new Set(data.flatMap(d => d.tags))].length;

  // Assign colours to categories in alphabetical order so they're stable
  [...new Set(data.flatMap(d => d.categories))].sort().forEach(c => getCatColour(c));

  buildFilters(data);
  bindEvents();
  loadStateFromURL();
}

/* ════════════════════════════════════════
   URL STATE
════════════════════════════════════════ */
function pushURL() {
  const p = new URLSearchParams();
  if (AF.search)             p.set('q',    AF.search);
  if (searchScope !== 'all') p.set('scope', searchScope);
  if (AF.types.size)         p.set('type', [...AF.types].join(','));
  if (AF.categories.size)    p.set('cat',  [...AF.categories].join('||'));
  if (AF.subcategories.size) p.set('sub',  [...AF.subcategories].join('||'));
  if (AF.eras.size)          p.set('era',  [...AF.eras].join('||'));
  if (AF.dynasties.size)     p.set('dyn',  [...AF.dynasties].join('||'));
  if (AF.regions.size)       p.set('reg',  [...AF.regions].join('||'));
  if (AF.sourceTypes.size)   p.set('src',  [...AF.sourceTypes].join('||'));
  if (AF.languages.size)     p.set('lang', [...AF.languages].join(','));
  if (AF.formats.size)       p.set('fmt',  [...AF.formats].join(','));
  if (AF.tags.size)          p.set('tag',  [...AF.tags].join('||'));
  if (sortMode !== 'default') p.set('sort', sortMode);
  if (currentPage > 1)        p.set('page', currentPage);

  history.pushState(null, '', p.toString() ? `${location.pathname}?${p}` : location.pathname);
  updatePageTitle();
}

function updatePageTitle() {
  /* #12 — dynamic page title */
  const parts = [];
  if (AF.search)          parts.push(`"${AF.search}"`);
  if (AF.categories.size) parts.push([...AF.categories].join(', '));
  if (AF.eras.size)       parts.push([...AF.eras][0].split('(')[0].trim());
  document.title = parts.length
    ? `${parts.join(' · ')} — Indian History Archive`
    : 'Indian History Archive';
}

function loadStateFromURL() {
  const p = new URLSearchParams(location.search);
  const setMulti  = (param, set) => { const v = p.get(param); if (v) v.split('||').forEach(x => set.add(x)); };
  const setSimple = (param, set) => { const v = p.get(param); if (v) v.split(',').forEach(x => set.add(x)); };

  if (p.get('q'))     { AF.search = p.get('q'); searchEl.value = AF.search; searchClear.classList.add('visible'); }
  if (p.get('scope')) { searchScope = p.get('scope'); searchScopeEl.value = searchScope; }
  setSimple('type', AF.types);
  setMulti('cat',  AF.categories);
  setMulti('sub',  AF.subcategories);
  setMulti('era',  AF.eras);
  setMulti('dyn',  AF.dynasties);
  setMulti('reg',  AF.regions);
  setMulti('src',  AF.sourceTypes);
  setSimple('lang', AF.languages);
  setSimple('fmt',  AF.formats);
  setMulti('tag',  AF.tags);
  if (p.get('sort')) { sortMode = p.get('sort'); sortSelect.value = sortMode; }
  if (p.get('page')) currentPage = parseInt(p.get('page'));

  document.querySelectorAll('.checkbox-list input[type="checkbox"]').forEach(cb => {
    const set = getSet(cb.dataset.filterKey);
    if (set?.has(cb.value)) cb.checked = true;
  });

  render();
  renderChips();
  updatePageTitle();
}

window.addEventListener('popstate', () => {
  AF.search = ''; searchEl.value = ''; searchClear.classList.remove('visible');
  Object.values(AF).forEach(v => v instanceof Set && v.clear());
  document.querySelectorAll('.checkbox-list input[type="checkbox"]').forEach(cb => cb.checked = false);
  loadStateFromURL();
});

/* ════════════════════════════════════════
   BUILD SIDEBAR FILTERS
════════════════════════════════════════ */
function buildFilters(data) {
  const fill = (listEl, values, key, countFn) => {
    [...new Set(values)].filter(Boolean).sort().forEach(v =>
      listEl.appendChild(makeCheckbox(key, v, v, countFn(v))));
  };

  fill($('typeList'),    data.map(d => d.type),                        'type',
    v => data.filter(d => d.type === v).length);
  fill($('catList'),     data.flatMap(d => d.categories),              'category',
    v => data.filter(d => d.categories.includes(v)).length);
  fill($('subList'),     data.flatMap(d => d.subcategories),           'subcategory',
    v => data.filter(d => d.subcategories.includes(v)).length);

  ERAS.forEach(era => {
    const n = data.filter(d => getEra(d) === era.label).length;
    if (n > 0) $('eraList').appendChild(makeCheckbox('era', era.label, era.label, n));
  });

  fill($('dynastyList'), data.map(d => d.dynasty).filter(Boolean),    'dynasty',
    v => data.filter(d => d.dynasty === v).length);
  fill($('regionList'),  data.flatMap(d => d.region || []),           'region',
    v => data.filter(d => (d.region||[]).includes(v)).length);
  fill($('srcTypeList'), data.map(d => d.source_type).filter(Boolean),'source_type',
    v => data.filter(d => d.source_type === v).length);

  const allLangs = data.flatMap(d => [d.language, ...(d.alternate_urls||[]).map(a=>a.language)]);
  fill($('langList'), allLangs, 'language',
    v => data.filter(d => [d.language,...(d.alternate_urls||[]).map(a=>a.language)].includes(v)).length);

  const allFmts = data.flatMap(d => [d.file_format, ...(d.alternate_urls||[]).map(a=>a.format)]);
  fill($('formatList'), allFmts, 'file_format',
    v => data.filter(d => [d.file_format,...(d.alternate_urls||[]).map(a=>a.format)].includes(v)).length);

  [...new Set(data.flatMap(d => d.tags))].sort().forEach(t =>
    $('tagList').appendChild(makeCheckbox('tag', t, t, data.filter(d=>d.tags.includes(t)).length)));

  // Primary groups — collapsible, open by default
  ['fl-type','fl-cat','fl-era'].forEach(id => initCollapsible(id, true));
  // Advanced group bodies — collapsible, closed by default
  ['fl-sub','fl-dynasty','fl-region','fl-srctype','fl-lang','fl-format','fl-tags']
    .forEach(id => initCollapsible(id, false));

  // Advanced toggle
  const advBtn  = $('advancedToggleBtn');
  const advBody = $('advancedBody');
  const advArrow = $('advArrow');
  advBody.classList.add('collapsed');
  advBtn.addEventListener('click', () => {
    advBody.classList.toggle('collapsed');
    advArrow.classList.toggle('open');
  });
}

function makeCheckbox(filterKey, value, label, count) {
  const wrap = document.createElement('label');
  const cb   = document.createElement('input');
  cb.type  = 'checkbox';
  cb.value = value;
  cb.dataset.filterKey = filterKey;
  cb.addEventListener('change', () => {
    const set = getSet(filterKey);
    cb.checked ? set.add(value) : set.delete(value);
    currentPage = 1;
    render(); renderChips(); updateFilterCounts(); updateAdvancedCount(); pushURL();
  });
  const text = document.createElement('span');
  text.textContent = label;
  const cnt = document.createElement('span');
  cnt.className = 'checkbox-count';
  cnt.textContent = count;
  wrap.appendChild(cb); wrap.appendChild(text); wrap.appendChild(cnt);
  return wrap;
}

function getSet(key) {
  return ({ type:AF.types, category:AF.categories, subcategory:AF.subcategories,
    era:AF.eras, dynasty:AF.dynasties, region:AF.regions,
    source_type:AF.sourceTypes, language:AF.languages,
    file_format:AF.formats, tag:AF.tags })[key];
}

function initCollapsible(bodyId, open) {
  const body  = $(bodyId);
  const head  = body?.previousElementSibling;
  const arrow = head?.querySelector('.fg-arrow');
  if (!body || !head) return;
  if (!open) body.classList.add('collapsed');
  else arrow?.classList.add('open');
  head.addEventListener('click', () => {
    body.classList.toggle('collapsed');
    arrow?.classList.toggle('open');
  });
}

/* ── Update counts live ── */
function updateFilterCounts() {
  const visible = applyFilters(allData);
  document.querySelectorAll('.checkbox-list input[type="checkbox"]').forEach(cb => {
    const key = cb.dataset.filterKey;
    const val = cb.value;
    const set = getSet(key);
    const n   = visible.filter(item => matchesCheckbox(item, key, val)).length;
    const countEl = cb.parentElement.querySelector('.checkbox-count');
    if (countEl) countEl.textContent = n;
    cb.parentElement.style.opacity = (n === 0 && !set.has(val)) ? '0.38' : '';
    cb.parentElement.style.pointerEvents = (n === 0 && !set.has(val)) ? 'none' : '';
  });

  /* #13 — live header stat */
  const total   = allData.length;
  const showing = visible.length;
  $('docCount').textContent = isFiltered() ? showing : totalRecords;
  const ofEl = $('docTotal');
  if (isFiltered()) {
    ofEl.textContent = ` of ${totalRecords}`;
    ofEl.style.display = '';
  } else {
    ofEl.textContent = '';
    ofEl.style.display = 'none';
  }

  /* mobile badge */
  const activeCount = AF.types.size + AF.categories.size + AF.subcategories.size +
    AF.eras.size + AF.dynasties.size + AF.regions.size + AF.sourceTypes.size +
    AF.languages.size + AF.formats.size + AF.tags.size + (AF.search ? 1 : 0);
  const badge = $('mobileFilterCount');
  badge.textContent = activeCount;
  badge.style.display = activeCount > 0 ? '' : 'none';
}

function updateAdvancedCount() {
  const advKeys = [AF.subcategories, AF.dynasties, AF.regions, AF.sourceTypes, AF.languages, AF.formats, AF.tags];
  const n = advKeys.reduce((a, s) => a + s.size, 0);
  const el = $('advCount');
  el.textContent = n;
  el.style.display = n > 0 ? '' : 'none';
}

function matchesCheckbox(item, key, val) {
  switch(key) {
    case 'type':        return item.type === val;
    case 'category':    return item.categories.includes(val);
    case 'subcategory': return item.subcategories.includes(val);
    case 'era':         return getEra(item) === val;
    case 'dynasty':     return item.dynasty === val;
    case 'region':      return (item.region||[]).includes(val);
    case 'source_type': return item.source_type === val;
    case 'language':    return [item.language,...(item.alternate_urls||[]).map(a=>a.language)].includes(val);
    case 'file_format': return [item.file_format,...(item.alternate_urls||[]).map(a=>a.format)].includes(val);
    case 'tag':         return item.tags.includes(val);
    default:            return false;
  }
}

/* ════════════════════════════════════════
   ACTIVE CHIPS
════════════════════════════════════════ */
function renderChips() {
  activeFiltersEl.innerHTML = '';
  const add = (label, key, val) => {
    const chip = document.createElement('div');
    chip.className = 'active-chip';
    chip.innerHTML = `<span>${label}</span><button>✕</button>`;
    chip.querySelector('button').addEventListener('click', () => {
      getSet(key).delete(val);
      document.querySelectorAll(`input[data-filter-key="${key}"]`)
        .forEach(cb => { if (cb.value === val) cb.checked = false; });
      currentPage = 1;
      render(); renderChips(); updateFilterCounts(); updateAdvancedCount(); pushURL();
    });
    activeFiltersEl.appendChild(chip);
  };
  AF.types.forEach(v         => add(v,         'type',        v));
  AF.categories.forEach(v    => add(v,         'category',    v));
  AF.subcategories.forEach(v => add(v,         'subcategory', v));
  AF.eras.forEach(v          => add(v,         'era',         v));
  AF.dynasties.forEach(v     => add(`⚔ ${v}`,  'dynasty',     v));
  AF.regions.forEach(v       => add(`📍 ${v}`, 'region',      v));
  AF.sourceTypes.forEach(v   => add(v,         'source_type', v));
  AF.languages.forEach(v     => add(`🌐 ${v}`, 'language',    v));
  AF.formats.forEach(v       => add(v,         'file_format', v));
  AF.tags.forEach(v          => add(`# ${v}`,  'tag',         v));
}

/* ════════════════════════════════════════
   FILTERING + SORTING
════════════════════════════════════════ */
function isFiltered() {
  return AF.search || AF.types.size || AF.categories.size || AF.subcategories.size ||
    AF.eras.size || AF.dynasties.size || AF.regions.size || AF.sourceTypes.size ||
    AF.languages.size || AF.formats.size || AF.tags.size;
}

function applyFilters(data) {
  const q = AF.search.toLowerCase();
  return data.filter(item => {
    if (q) {
      let hay = '';
      /* #4 — scoped search */
      switch (searchScope) {
        case 'title':    hay = item.title; break;
        case 'tags':     hay = item.tags.join(' '); break;
        case 'author':   hay = (item.authors||[]).map(a=>a.name).join(' '); break;
        case 'keywords': hay = (item.keywords||[]).join(' '); break;
        default:
          hay = [
            item.title, item.description,
            ...(item.categories||[]), ...(item.subcategories||[]),
            ...(item.tags||[]), ...(item.keywords||[]), ...(item.themes_covered||[]),
            item.dynasty||'', item.subject||'', item.paper||'', item.module_id||'',
            ...(item.region||[]),
            item.source||'', item.source_type||'', item.language||'',
            item.file_format||'', item.period?.era||'',
            ...(item.authors||[]).flatMap(a=>[a.name, a.affiliation]),
            ...(item.alternate_urls||[]).flatMap(a=>[a.label, a.language, a.format]),
          ].join(' ');
      }
      if (!hay.toLowerCase().includes(q)) return false;
    }
    if (AF.types.size       && !AF.types.has(item.type))                                     return false;
    if (AF.categories.size  && ![...AF.categories].some(c=>item.categories.includes(c)))     return false;
    if (AF.subcategories.size&&![...AF.subcategories].some(s=>item.subcategories.includes(s)))return false;
    if (AF.eras.size        && !AF.eras.has(getEra(item)))                                   return false;
    if (AF.dynasties.size   && !AF.dynasties.has(item.dynasty))                              return false;
    if (AF.regions.size     && ![...AF.regions].some(r=>(item.region||[]).includes(r)))      return false;
    if (AF.sourceTypes.size && !AF.sourceTypes.has(item.source_type))                        return false;
    if (AF.languages.size) {
      const l = [item.language,...(item.alternate_urls||[]).map(a=>a.language)];
      if (![...AF.languages].some(v=>l.includes(v))) return false;
    }
    if (AF.formats.size) {
      const f = [item.file_format,...(item.alternate_urls||[]).map(a=>a.format)];
      if (![...AF.formats].some(v=>f.includes(v))) return false;
    }
    if (AF.tags.size && ![...AF.tags].every(t=>item.tags.includes(t))) return false;
    return true;
  });
}

function applySort(data) {
  const s  = [...data];
  const yr = d => d.period?.start_year ?? 0;
  switch (sortMode) {
    case 'year-asc':   return s.sort((a,b) => yr(a)-yr(b));
    case 'year-desc':  return s.sort((a,b) => yr(b)-yr(a));
    case 'title-asc':  return s.sort((a,b) => a.title.localeCompare(b.title));
    case 'title-desc': return s.sort((a,b) => b.title.localeCompare(a.title));
    default:           return s;
  }
}

/* ════════════════════════════════════════
   RENDER
════════════════════════════════════════ */
function render() {
  if (isFiltered()) showFlatView();
  else showCategoryView();
}

/* ════════════════════════════════════════
   CATEGORY BROWSE VIEW
════════════════════════════════════════ */
function showCategoryView() {
  flatView.style.display     = 'none';
  categoryView.style.display = '';
  categoryView.innerHTML     = '';
  backToBrowse.style.display = 'none';

  resultsLabel.textContent = 'Browse Archive';
  resultsCount.textContent = `${totalRecords} records`;

  const mainCats = [...new Set(allData.flatMap(d => d.categories))].sort();

  mainCats.forEach(cat => {
    const colour   = getCatColour(cat);
    const catItems = applySort(allData.filter(d => d.categories.includes(cat)));
    if (!catItems.length) return;

    const showMore = catItems.length > PREVIEW_PER_CAT;
    const preview  = catItems.slice(0, PREVIEW_PER_CAT);
    const rest     = catItems.slice(PREVIEW_PER_CAT);

    const block = document.createElement('div');
    block.className = 'main-cat';
    /* #6 — coloured left border per category */
    block.style.setProperty('--cat-colour', colour);

    block.innerHTML = `
      <div class="main-cat-head">
        <span class="main-cat-accent" style="background:${colour}"></span>
        <span class="main-cat-title">${cat}</span>
        <span class="main-cat-badge">${catItems.length} record${catItems.length!==1?'s':''}</span>
        <span class="main-cat-line"></span>
        <button class="cat-filter-btn" data-cat="${cat}">Filter ↗</button>
        ${showMore ? `<button class="view-all-btn" data-expanded="false">View All →</button>` : ''}
      </div>
      <div class="card-strip">
        ${preview.map((item,i) => cardHTML(item, i*0.05, false)).join('')}
        ${rest.map((item,i)    => cardHTML(item, i*0.05, false).replace('class="card','class="card hidden')).join('')}
      </div>`;

    block.querySelector('.cat-filter-btn').addEventListener('click', () => {
      AF.categories.add(cat);
      const cb = document.querySelector(`input[data-filter-key="category"][value="${CSS.escape(cat)}"]`);
      if (cb) cb.checked = true;
      currentPage = 1;
      render(); renderChips(); updateFilterCounts(); updateAdvancedCount(); pushURL();
    });

    const vBtn = block.querySelector('.view-all-btn');
    if (vBtn) vBtn.addEventListener('click', () => {
      const exp = vBtn.dataset.expanded === 'true';
      block.querySelectorAll('.card.hidden').forEach(c => c.classList.toggle('hidden', exp));
      vBtn.dataset.expanded = String(!exp);
      vBtn.textContent = exp ? 'View All →' : 'Show Less ↑';
    });

    categoryView.appendChild(block);
  });
}

/* ════════════════════════════════════════
   FLAT PAGINATED VIEW
════════════════════════════════════════ */
async function showFlatView() {
  await preloadActiveChunks();

  categoryView.style.display = 'none';
  flatView.style.display     = '';
  backToBrowse.style.display = '';   /* #10 */

  const filtered   = applySort(applyFilters(allData));
  const total      = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  if (currentPage > totalPages) currentPage = totalPages;

  const pageItems = filtered.slice((currentPage-1)*perPage, currentPage*perPage);

  const parts = [];
  if (AF.search)          parts.push(`"${AF.search}"`);
  if (AF.categories.size) parts.push([...AF.categories].join(', '));
  resultsLabel.textContent = parts.length ? `Results for ${parts.join(' · ')}` : 'Filtered Results';
  resultsCount.textContent = `${total} record${total!==1?'s':''} · Page ${currentPage} of ${totalPages}`;

  if (!pageItems.length) {
    const cats = [...new Set(allData.flatMap(d=>d.categories))].sort().slice(0,6);
    flatGrid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <circle cx="11" cy="11" r="7"/><path stroke-linecap="round" d="M21 21l-4.35-4.35"/>
          </svg>
        </div>
        <h3>No records found</h3>
        <p>Try adjusting your filters or search query.</p>
        <div class="empty-suggestions">
          <p class="empty-suggest-label">Browse a category:</p>
          ${cats.map(c=>`<button class="empty-cat-btn" data-cat="${c}">${c}</button>`).join('')}
        </div>
      </div>`;
    flatGrid.querySelectorAll('.empty-cat-btn').forEach(btn =>
      btn.addEventListener('click', () => {
        clearAll(false);
        AF.categories.add(btn.dataset.cat);
        const cb = document.querySelector(`input[data-filter-key="category"][value="${CSS.escape(btn.dataset.cat)}"]`);
        if (cb) cb.checked = true;
        currentPage = 1; render(); renderChips(); updateFilterCounts(); pushURL();
      }));
  } else {
    flatGrid.innerHTML = pageItems.map((item,i) => cardHTML(item, i*0.03, true)).join('');
  }

  renderPagination(totalPages);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ════════════════════════════════════════
   PAGINATION
════════════════════════════════════════ */
function renderPagination(totalPages) {
  paginationEl.innerHTML = '';
  if (totalPages <= 1) return;
  const mkBtn = (label, page, disabled, active) => {
    const b = document.createElement('button');
    b.className = 'page-btn' + (active ? ' active' : '');
    b.textContent = label; b.disabled = disabled;
    b.addEventListener('click', () => { currentPage = page; showFlatView(); pushURL(); });
    return b;
  };
  const dots = () => { const s=document.createElement('span'); s.className='page-dots'; s.textContent='…'; return s; };

  paginationEl.appendChild(mkBtn('← Prev', currentPage-1, currentPage===1, false));
  const pages = [];
  if (totalPages<=7) { for(let i=1;i<=totalPages;i++) pages.push(i); }
  else {
    pages.push(1);
    if (currentPage>3) pages.push('…');
    for(let i=Math.max(2,currentPage-1);i<=Math.min(totalPages-1,currentPage+1);i++) pages.push(i);
    if (currentPage<totalPages-2) pages.push('…');
    pages.push(totalPages);
  }
  pages.forEach(p => paginationEl.appendChild(p==='…' ? dots() : mkBtn(p,p,false,p===currentPage)));
  paginationEl.appendChild(mkBtn('Next →', currentPage+1, currentPage===totalPages, false));
}

/* ════════════════════════════════════════
   CARD HTML
════════════════════════════════════════ */
function cardHTML(item, delay=0, showBreadcrumb=false) {
  const period  = periodLabel(item);
  const authors = (item.authors||[]).map(a=>a.name).join(', ');
  /* #8 — meta only shows author, not source (source is less important on card) */
  const meta    = authors || item.source || '';
  const icon    = TYPE_ICONS[item.type] || '📋'; /* #9 */

  /* Breadcrumb */
  const breadcrumb = showBreadcrumb ? `
    <div class="card-breadcrumb-wrap">
      ${item.categories.map(c=>`<span class="card-breadcrumb" style="border-color:${getCatColour(c)};color:${getCatColour(c)}">${c}</span>`).join('')}
      ${item.subcategories.map(s=>`<span class="card-breadcrumb card-breadcrumb-sub">› ${s}</span>`).join('')}
    </div>` : '';

  /* Pills — kept minimal: dynasty + 1 region only */
  const pills = [
    item.dynasty     ? `<span class="card-pill pill-dynasty">⚔ ${item.dynasty}</span>` : '',
    (item.region||[]).slice(0,1).map(r=>`<span class="card-pill pill-region">📍 ${r}</span>`).join(''),
    item.period?.era ? `<span class="card-pill pill-era">${item.period.era}</span>` : '',
  ].filter(Boolean).join('');

  /* Alternate URLs */
  const altHTML = (item.alternate_urls||[]).length ? `
    <div class="card-alt-urls">
      <span class="card-alt-label">Also available:</span>
      <div class="card-alt-links">
        ${item.alternate_urls.map(a=>`
          <a class="card-alt-link" href="${a.url}" target="_blank" rel="noopener">
            <span class="alt-lang">${a.language}</span>
            <span class="alt-label">${a.label}</span>
            <span class="alt-fmt">${a.format||''}</span>
          </a>`).join('')}
      </div>
    </div>` : '';

  /* Paper */
  const paperInfo = item.paper ? `
    <div class="card-paper">
      ${item.paper}${item.module_id?` <span class="card-module">${item.module_id}</span>`:''}
    </div>` : '';

  return `
    <div class="card${item.featured?' card-featured':''}" style="animation-delay:${delay}s">
      ${item.featured ? '<span class="card-featured-badge">Featured</span>' : ''}
      <div class="card-top">
        <span class="card-type-badge">${icon} ${item.type}</span>
        <div class="card-top-right">
          ${item.language?`<span class="card-lang">${item.language}</span>`:''}
          ${period?`<span class="card-year">${period}</span>`:''}
        </div>
      </div>
      <h3>${item.title}</h3>
      <p class="card-desc">${item.description}</p>
      ${meta?`<div class="card-meta">${meta}</div>`:''}
      ${paperInfo}
      ${breadcrumb}
      ${pills?`<div class="card-pills">${pills}</div>`:''}
      <div class="card-tags">
        ${item.tags.slice(0,4).map(t=>`<span class="tag">${t}</span>`).join('')}
        ${item.tags.length>4?`<span class="tag tag-more">+${item.tags.length-4}</span>`:''}
      </div>
      ${altHTML}
      <a class="card-link" href="${item.url}" target="_blank" rel="noopener">Open Resource →</a>
    </div>`;
}

/* ════════════════════════════════════════
   EVENTS
════════════════════════════════════════ */
let searchDebounce = null;

function bindEvents() {
  searchEl.addEventListener('input', () => {
    searchClear.classList.toggle('visible', !!searchEl.value);
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      AF.search = searchEl.value.trim();
      currentPage = 1; render(); renderChips(); updateFilterCounts(); pushURL();
    }, 280);
  });

  searchClear.addEventListener('click', () => {
    searchEl.value=''; AF.search=''; searchClear.classList.remove('visible');
    currentPage=1; render(); renderChips(); updateFilterCounts(); pushURL();
  });

  searchScopeEl.addEventListener('change', () => {
    searchScope = searchScopeEl.value;
    if (AF.search) { currentPage=1; render(); pushURL(); }
  });

  clearAllBtn.addEventListener('click', () => clearAll(true));

  /* #10 — back to browse */
  backToBrowse.addEventListener('click', () => clearAll(true));

  perPageSelect.addEventListener('change', () => {
    perPage=parseInt(perPageSelect.value); currentPage=1; render(); pushURL();
  });

  sortSelect.addEventListener('change', () => {
    sortMode=sortSelect.value; currentPage=1; render(); pushURL();
  });

  tagSearchEl.addEventListener('input', () => {
    const q = tagSearchEl.value.toLowerCase();
    $('tagList').querySelectorAll('label').forEach(l =>
      l.style.display = l.querySelector('span')?.textContent.toLowerCase().includes(q) ? '' : 'none');
  });

  /* Mobile sidebar */
  $('mobileFilterBtn').addEventListener('click',  () => openSidebar());
  $('sidebarClose').addEventListener('click',     () => closeSidebar());
  sidebarOverlay.addEventListener('click',        () => closeSidebar());
}

function openSidebar() {
  sidebar.classList.add('open');
  sidebarOverlay.classList.add('visible');
  document.body.style.overflow = 'hidden';
}
function closeSidebar() {
  sidebar.classList.remove('open');
  sidebarOverlay.classList.remove('visible');
  document.body.style.overflow = '';
}

function clearAll(pushState=true) {
  AF.search=''; searchEl.value=''; searchClear.classList.remove('visible');
  Object.values(AF).forEach(v => v instanceof Set && v.clear());
  sortMode='default'; sortSelect.value='default'; currentPage=1;
  $('tagSearch').value='';
  $('tagList').querySelectorAll('label').forEach(l=>l.style.display='');
  document.querySelectorAll('.checkbox-list input[type="checkbox"]').forEach(cb=>cb.checked=false);
  render(); renderChips(); updateFilterCounts(); updateAdvancedCount();
  if (pushState) pushURL();
}
