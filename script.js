/* ════════════════════════════════════════
   INDIAN HISTORY ARCHIVE — script.js
════════════════════════════════════════ */

const PREVIEW_PER_SUBCAT = 3;

/* ── Era buckets — auto-derived from period.start_year ── */
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
  // Prefer period.era string if provided, otherwise derive from start_year
  const y = item.period?.start_year ?? item.year ?? 0;
  return ERAS.find(e => e.test(y))?.label ?? 'Unknown';
}

/* ── Year display helper ── */
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
let allData     = [];
let currentPage = 1;
let perPage     = 20;
let sortMode    = 'default';

const AF = {               // activeFilters
  search:       '',
  types:        new Set(),
  categories:   new Set(),
  subcategories:new Set(),
  eras:         new Set(),
  dynasties:    new Set(),
  regions:      new Set(),
  sourceTypes:  new Set(),
  languages:    new Set(),
  formats:      new Set(),
  tags:         new Set(),
};

/* ════════════════════════════════════════
   DOM REFS
════════════════════════════════════════ */
const $  = id => document.getElementById(id);

const searchEl        = $('search');
const searchClear     = $('searchClear');
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

/* ════════════════════════════════════════
   INIT
════════════════════════════════════════ */
fetch('data.json')
  .then(r => r.json())
  .then(data => {
    allData = data;

    $('docCount').textContent      = data.length;
    $('categoryCount').textContent = [...new Set(data.flatMap(d => d.categories))].length;
    $('tagCount').textContent      = [...new Set(data.flatMap(d => d.tags))].length;

    buildFilters(data);
    bindEvents();
    render();
  });

/* ════════════════════════════════════════
   BUILD ALL SIDEBAR FILTERS
════════════════════════════════════════ */
function buildFilters(data) {

  const fill = (listEl, values, key, countFn) => {
    [...new Set(values)].filter(Boolean).sort().forEach(v => {
      listEl.appendChild(makeCheckbox(key, v, v, countFn(v)));
    });
  };

  // Resource Type
  fill($('typeList'),    data.map(d => d.type),                           'type',
    v => data.filter(d => d.type === v).length);

  // Category
  fill($('catList'),     data.flatMap(d => d.categories),                 'category',
    v => data.filter(d => d.categories.includes(v)).length);

  // Subcategory
  fill($('subList'),     data.flatMap(d => d.subcategories),              'subcategory',
    v => data.filter(d => d.subcategories.includes(v)).length);

  // Era (auto-derived)
  ERAS.forEach(era => {
    const count = data.filter(d => getEra(d) === era.label).length;
    if (count > 0) $('eraList').appendChild(makeCheckbox('era', era.label, era.label, count));
  });

  // Dynasty
  fill($('dynastyList'), data.map(d => d.dynasty).filter(Boolean),        'dynasty',
    v => data.filter(d => d.dynasty === v).length);

  // Region
  fill($('regionList'),  data.flatMap(d => d.region || []),               'region',
    v => data.filter(d => (d.region || []).includes(v)).length);

  // Source Type
  fill($('srcTypeList'), data.map(d => d.source_type).filter(Boolean),    'source_type',
    v => data.filter(d => d.source_type === v).length);

  // Language (primary + all alternate URL languages)
  const allLangs = data.flatMap(d => [
    d.language,
    ...(d.alternate_urls || []).map(a => a.language)
  ]);
  fill($('langList'), allLangs, 'language',
    v => data.filter(d => {
      const langs = [d.language, ...(d.alternate_urls||[]).map(a=>a.language)];
      return langs.includes(v);
    }).length);

  // File Format (primary + alternate formats)
  const allFormats = data.flatMap(d => [
    d.file_format,
    ...(d.alternate_urls || []).map(a => a.format)
  ]);
  fill($('formatList'), allFormats, 'file_format',
    v => data.filter(d => {
      const fmts = [d.file_format, ...(d.alternate_urls||[]).map(a=>a.format)];
      return fmts.includes(v);
    }).length);

  // Tags
  [...new Set(data.flatMap(d => d.tags))].sort().forEach(t => {
    $('tagList').appendChild(makeCheckbox('tag', t, t, data.filter(d=>d.tags.includes(t)).length));
  });

  // Init all collapsibles
  [
    ['fl-type',    true],
    ['fl-cat',     true],
    ['fl-sub',     false],
    ['fl-era',     true],
    ['fl-dynasty', false],
    ['fl-region',  false],
    ['fl-srctype', false],
    ['fl-lang',    false],
    ['fl-format',  false],
    ['fl-tags',    false],
  ].forEach(([id, open]) => initCollapsible(id, open));
}

/* ── Checkbox factory ── */
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
    render();
    renderChips();
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
  return ({
    type: AF.types, category: AF.categories, subcategory: AF.subcategories,
    era: AF.eras, dynasty: AF.dynasties, region: AF.regions,
    source_type: AF.sourceTypes, language: AF.languages,
    file_format: AF.formats, tag: AF.tags
  })[key];
}

function initCollapsible(bodyId, open = true) {
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

/* ════════════════════════════════════════
   ACTIVE FILTER CHIPS
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
      currentPage = 1; render(); renderChips();
    });
    activeFiltersEl.appendChild(chip);
  };

  AF.types.forEach(v        => add(v,           'type',        v));
  AF.categories.forEach(v   => add(v,           'category',    v));
  AF.subcategories.forEach(v=> add(v,           'subcategory', v));
  AF.eras.forEach(v         => add(v,           'era',         v));
  AF.dynasties.forEach(v    => add(`⚔ ${v}`,    'dynasty',     v));
  AF.regions.forEach(v      => add(`📍 ${v}`,   'region',      v));
  AF.sourceTypes.forEach(v  => add(v,           'source_type', v));
  AF.languages.forEach(v    => add(`🌐 ${v}`,   'language',    v));
  AF.formats.forEach(v      => add(v,           'file_format', v));
  AF.tags.forEach(v         => add(`#${v}`,     'tag',         v));
}

/* ════════════════════════════════════════
   FILTERING
════════════════════════════════════════ */
function isFiltered() {
  return AF.search || AF.types.size || AF.categories.size || AF.subcategories.size ||
    AF.eras.size || AF.dynasties.size || AF.regions.size || AF.sourceTypes.size ||
    AF.languages.size || AF.formats.size || AF.tags.size;
}

function applyFilters(data) {
  const q = AF.search.toLowerCase();

  return data.filter(item => {

    /* ── Text search across ALL fields ── */
    if (q) {
      const hay = [
        item.title, item.description,
        ...(item.categories || []), ...(item.subcategories || []),
        ...(item.tags || []), ...(item.keywords || []), ...(item.themes_covered || []),
        item.dynasty || '', item.subject || '', item.paper || '', item.module_id || '',
        ...(item.region || []),
        item.source || '', item.source_type || '', item.language || '',
        item.file_format || '', item.period?.era || '',
        ...(item.authors || []).flatMap(a => [a.name, a.affiliation]),
        ...(item.alternate_urls || []).flatMap(a => [a.label, a.language, a.format]),
      ].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }

    /* ── Checkbox filters — OR within same filter, all filters must pass ── */
    if (AF.types.size       && !AF.types.has(item.type))                                   return false;
    if (AF.categories.size  && ![...AF.categories].some(c => item.categories.includes(c))) return false;
    if (AF.subcategories.size && ![...AF.subcategories].some(s => item.subcategories.includes(s))) return false;
    if (AF.eras.size        && !AF.eras.has(getEra(item)))                                 return false;
    if (AF.dynasties.size   && !AF.dynasties.has(item.dynasty))                            return false;
    if (AF.regions.size     && ![...AF.regions].some(r => (item.region||[]).includes(r)))  return false;
    if (AF.sourceTypes.size && !AF.sourceTypes.has(item.source_type))                      return false;

    if (AF.languages.size) {
      const langs = [item.language, ...(item.alternate_urls||[]).map(a=>a.language)];
      if (![...AF.languages].some(l => langs.includes(l))) return false;
    }
    if (AF.formats.size) {
      const fmts = [item.file_format, ...(item.alternate_urls||[]).map(a=>a.format)];
      if (![...AF.formats].some(f => fmts.includes(f))) return false;
    }
    if (AF.tags.size && ![...AF.tags].every(t => item.tags.includes(t))) return false;

    return true;
  });
}

function applySort(data) {
  const s = [...data];
  const yr = item => item.period?.start_year ?? 0;
  switch (sortMode) {
    case 'year-asc':   return s.sort((a, b) => yr(a) - yr(b));
    case 'year-desc':  return s.sort((a, b) => yr(b) - yr(a));
    case 'title-asc':  return s.sort((a, b) => a.title.localeCompare(b.title));
    case 'title-desc': return s.sort((a, b) => b.title.localeCompare(a.title));
    default:           return s;
  }
}

/* ════════════════════════════════════════
   RENDER
════════════════════════════════════════ */
function render() {
  isFiltered() ? showFlatView() : showCategoryView();
}

/* ════════════════════════════════════════
   CATEGORY ROW VIEW
════════════════════════════════════════ */
function showCategoryView() {
  flatView.style.display     = 'none';
  categoryView.style.display = '';
  categoryView.innerHTML     = '';

  resultsLabel.textContent = 'Browse Archive';
  resultsCount.textContent = `${allData.length} records`;

  const mainCats = [...new Set(allData.flatMap(d => d.categories))].sort();

  mainCats.forEach(cat => {
    const catItems = applySort(allData.filter(d => d.categories.includes(cat)));
    if (!catItems.length) return;

    const subCats = [...new Set(catItems.flatMap(d => d.subcategories))];

    const block = document.createElement('div');
    block.className = 'main-cat';
    block.innerHTML = `
      <div class="main-cat-head">
        <span class="main-cat-title">${cat}</span>
        <span class="main-cat-badge">${catItems.length} record${catItems.length !== 1 ? 's':''}</span>
        <span class="main-cat-line"></span>
      </div>
      <div class="sub-rows"></div>`;

    const subRowsWrap = block.querySelector('.sub-rows');

    subCats.forEach(sub => {
      const subItems = catItems.filter(d => d.subcategories.includes(sub));
      const showMore = subItems.length > PREVIEW_PER_SUBCAT;
      const preview  = subItems.slice(0, PREVIEW_PER_SUBCAT);
      const rest     = subItems.slice(PREVIEW_PER_SUBCAT);

      const subRow = document.createElement('div');
      subRow.className = 'sub-row';
      subRow.innerHTML = `
        <div class="sub-row-head">
          <div class="sub-row-left">
            <span class="sub-row-title">${sub}</span>
            <span class="sub-row-meta">${subItems.length} record${subItems.length !== 1 ? 's':''}</span>
          </div>
          ${showMore ? `<button class="view-all-btn" data-expanded="false">View All →</button>` : ''}
        </div>
        <div class="card-strip">
          ${preview.map((item, i) => cardHTML(item, i * 0.05, false)).join('')}
          ${rest.map((item, i)    => cardHTML(item, i * 0.05, false).replace('class="card"','class="card hidden"')).join('')}
        </div>`;

      const btn = subRow.querySelector('.view-all-btn');
      if (btn) btn.addEventListener('click', () => {
        const exp = btn.dataset.expanded === 'true';
        subRow.querySelectorAll('.card.hidden').forEach(c => c.classList.toggle('hidden', exp));
        btn.dataset.expanded = String(!exp);
        btn.textContent = exp ? 'View All →' : 'Show Less ↑';
      });

      subRowsWrap.appendChild(subRow);
    });

    categoryView.appendChild(block);
  });
}

/* ════════════════════════════════════════
   FLAT PAGINATED VIEW
════════════════════════════════════════ */
function showFlatView() {
  categoryView.style.display = 'none';
  flatView.style.display     = '';

  const filtered   = applySort(applyFilters(allData));
  const total      = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  if (currentPage > totalPages) currentPage = totalPages;

  const pageItems = filtered.slice((currentPage - 1) * perPage, currentPage * perPage);

  const parts = [];
  if (AF.search)           parts.push(`"${AF.search}"`);
  if (AF.categories.size)  parts.push([...AF.categories].join(', '));
  resultsLabel.textContent = parts.length ? `Results for ${parts.join(' · ')}` : 'Filtered Results';
  resultsCount.textContent = `${total} record${total !== 1 ? 's':''} · Page ${currentPage} of ${totalPages}`;

  flatGrid.innerHTML = !pageItems.length
    ? `<div class="empty-state">
        <div class="empty-icon">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <circle cx="11" cy="11" r="7"/><path stroke-linecap="round" d="M21 21l-4.35-4.35"/>
          </svg>
        </div>
        <h3>No records found</h3>
        <p>Try adjusting your filters or search query.</p>
       </div>`
    : pageItems.map((item, i) => cardHTML(item, i * 0.03, true)).join('');

  renderPagination(totalPages);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ════════════════════════════════════════
   PAGINATION
════════════════════════════════════════ */
function renderPagination(totalPages) {
  paginationEl.innerHTML = '';
  if (totalPages <= 1) return;

  const btn = (label, page, disabled, active) => {
    const b = document.createElement('button');
    b.className = 'page-btn' + (active ? ' active' : '');
    b.textContent = label; b.disabled = disabled;
    b.addEventListener('click', () => { currentPage = page; showFlatView(); });
    return b;
  };
  const dots = () => { const s = document.createElement('span'); s.className='page-dots'; s.textContent='…'; return s; };

  paginationEl.appendChild(btn('← Prev', currentPage-1, currentPage===1, false));

  const pages = [];
  if (totalPages <= 7) { for (let i=1;i<=totalPages;i++) pages.push(i); }
  else {
    pages.push(1);
    if (currentPage > 3) pages.push('…');
    for (let i=Math.max(2,currentPage-1); i<=Math.min(totalPages-1,currentPage+1); i++) pages.push(i);
    if (currentPage < totalPages-2) pages.push('…');
    pages.push(totalPages);
  }
  pages.forEach(p => paginationEl.appendChild(p==='…' ? dots() : btn(p, p, false, p===currentPage)));
  paginationEl.appendChild(btn('Next →', currentPage+1, currentPage===totalPages, false));
}

/* ════════════════════════════════════════
   CARD HTML
════════════════════════════════════════ */
function cardHTML(item, delay = 0, showBreadcrumb = false) {
  const period  = periodLabel(item);
  const authors = (item.authors || []).map(a => a.name).join(', ');
  const meta    = [authors, item.source].filter(Boolean).join(' · ');

  /* ── Breadcrumb: categories + subcategories ── */
  const breadcrumb = showBreadcrumb ? `
    <div class="card-breadcrumb-wrap">
      ${item.categories.map(c=>`<span class="card-breadcrumb">${c}</span>`).join('')}
      ${item.subcategories.map(s=>`<span class="card-breadcrumb card-breadcrumb-sub">› ${s}</span>`).join('')}
    </div>` : '';

  /* ── Metadata pills row ── */
  const pills = [
    item.dynasty   ? `<span class="card-pill pill-dynasty">⚔ ${item.dynasty}</span>` : '',
    item.period?.era ? `<span class="card-pill pill-era">${item.period.era}</span>` : '',
    ...(item.region||[]).slice(0,2).map(r=>`<span class="card-pill pill-region">📍 ${r}</span>`),
    item.source_type ? `<span class="card-pill pill-src">${item.source_type}</span>` : '',
    item.document_pages ? `<span class="card-pill pill-pages">${item.document_pages} pp</span>` : '',
  ].filter(Boolean).join('');

  /* ── Alternate URLs ── */
  const altHTML = (item.alternate_urls || []).length ? `
    <div class="card-alt-urls">
      <span class="card-alt-label">Also available:</span>
      <div class="card-alt-links">
        ${item.alternate_urls.map(a => `
          <a class="card-alt-link" href="${a.url}" target="_blank" rel="noopener">
            <span class="alt-lang">${a.language}</span>
            <span class="alt-label">${a.label}</span>
            <span class="alt-fmt">${a.format || ''}</span>
          </a>`).join('')}
      </div>
    </div>` : '';

  /* ── Paper / module info ── */
  const paperInfo = item.paper ? `
    <div class="card-paper">
      ${item.paper}${item.module_id ? ` <span class="card-module">${item.module_id}</span>` : ''}
    </div>` : '';

  return `
    <div class="card" style="animation-delay:${delay}s">

      <div class="card-top">
        <span class="card-type-badge">${item.type}</span>
        <div class="card-top-right">
          ${item.language ? `<span class="card-lang">${item.language}</span>` : ''}
          ${item.file_format ? `<span class="card-fmt">${item.file_format}</span>` : ''}
          ${period ? `<span class="card-year">${period}</span>` : ''}
        </div>
      </div>

      <h3>${item.title}</h3>
      <p class="card-desc">${item.description}</p>

      ${meta      ? `<div class="card-meta">${meta}</div>` : ''}
      ${paperInfo}
      ${breadcrumb}

      ${pills     ? `<div class="card-pills">${pills}</div>` : ''}

      <div class="card-tags">
        ${item.tags.map(t=>`<span class="tag">${t}</span>`).join('')}
      </div>

      ${altHTML}

      <a class="card-link" href="${item.url}" target="_blank" rel="noopener">
        Open Resource →
      </a>
    </div>`;
}

/* ════════════════════════════════════════
   EVENTS
════════════════════════════════════════ */
function bindEvents() {
  searchEl.addEventListener('input', () => {
    AF.search = searchEl.value.trim();
    searchClear.classList.toggle('visible', !!AF.search);
    currentPage = 1; render(); renderChips();
  });

  searchClear.addEventListener('click', () => {
    searchEl.value = ''; AF.search = '';
    searchClear.classList.remove('visible');
    currentPage = 1; render(); renderChips();
  });

  clearAllBtn.addEventListener('click', clearAll);

  perPageSelect.addEventListener('change', () => {
    perPage = parseInt(perPageSelect.value); currentPage = 1; render();
  });

  sortSelect.addEventListener('change', () => {
    sortMode = sortSelect.value; currentPage = 1; render();
  });

  tagSearchEl.addEventListener('input', () => {
    const q = tagSearchEl.value.toLowerCase();
    $('tagList').querySelectorAll('label').forEach(l => {
      l.style.display = l.querySelector('span')?.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  });
}

function clearAll() {
  AF.search = ''; AF.types.clear(); AF.categories.clear(); AF.subcategories.clear();
  AF.eras.clear(); AF.dynasties.clear(); AF.regions.clear(); AF.sourceTypes.clear();
  AF.languages.clear(); AF.formats.clear(); AF.tags.clear();
  currentPage = 1;
  searchEl.value = ''; searchClear.classList.remove('visible');
  $('tagSearch').value = '';
  $('tagList').querySelectorAll('label').forEach(l => l.style.display = '');
  document.querySelectorAll('.checkbox-list input[type="checkbox"]').forEach(cb => cb.checked = false);
  render(); renderChips();
}
