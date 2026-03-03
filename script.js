/* ════════════════════════════════════════
   INDIAN HISTORY ARCHIVE — script.js
════════════════════════════════════════ */

const PREVIEW_PER_SUBCAT = 3;

/* ── Era definitions ── */
const ERAS = [
  { label: 'Ancient (before 600 CE)',   test: y => y < 600 },
  { label: 'Early Medieval (600–1200)', test: y => y >= 600  && y < 1200 },
  { label: 'Medieval (1200–1526)',      test: y => y >= 1200 && y < 1526 },
  { label: 'Early Modern (1526–1757)',  test: y => y >= 1526 && y < 1757 },
  { label: 'Colonial Era (1757–1947)',  test: y => y >= 1757 && y < 1947 },
  { label: 'Post-Independence (1947+)', test: y => y >= 1947 },
];

function getEra(year) {
  return ERAS.find(e => e.test(year))?.label ?? 'Unknown';
}

/* ════════════════════════════════════════
   STATE
════════════════════════════════════════ */
let allData     = [];
let currentPage = 1;
let perPage     = 20;
let sortMode    = 'default';

const activeFilters = {
  search:        '',
  types:         new Set(),
  categories:    new Set(),
  subcategories: new Set(),
  eras:          new Set(),
  tags:          new Set(),
  languages:     new Set(),
};

/* ════════════════════════════════════════
   DOM REFS
════════════════════════════════════════ */
const $  = id => document.getElementById(id);

const searchEl       = $('search');
const searchClear    = $('searchClear');
const clearAllBtn    = $('clearAllBtn');
const typeListEl     = $('typeList');
const catListEl      = $('catList');
const subListEl      = $('subList');
const eraListEl      = $('eraList');
const tagListEl      = $('tagList');
const langListEl     = $('langList');
const tagSearchEl    = $('tagSearch');
const activeFiltersEl = $('activeFilters');
const categoryView   = $('categoryView');
const flatView       = $('flatView');
const flatGrid       = $('flatGrid');
const paginationEl   = $('pagination');
const resultsCount   = $('resultsCount');
const resultsLabel   = $('resultsLabel');
const perPageSelect  = $('perPage');
const sortSelect     = $('sortSelect');

/* ════════════════════════════════════════
   INIT
════════════════════════════════════════ */
fetch('data.json')
  .then(r => r.json())
  .then(data => {
    allData = data;

    // Stats
    $('docCount').textContent      = data.length;
    const allCats = [...new Set(data.flatMap(d => d.categories))];
    const allTags = [...new Set(data.flatMap(d => d.tags))];
    $('categoryCount').textContent = allCats.length;
    $('tagCount').textContent      = allTags.length;

    buildFilters(data);
    bindEvents();
    render();
  });

/* ════════════════════════════════════════
   BUILD SIDEBAR FILTERS
════════════════════════════════════════ */
function buildFilters(data) {

  // Resource Type
  [...new Set(data.map(d => d.type))].sort().forEach(t => {
    const count = data.filter(d => d.type === t).length;
    typeListEl.appendChild(makeCheckbox('type', t, t, count));
  });

  // Category (multi-value — count records that include this category)
  [...new Set(data.flatMap(d => d.categories))].sort().forEach(c => {
    const count = data.filter(d => d.categories.includes(c)).length;
    catListEl.appendChild(makeCheckbox('category', c, c, count));
  });

  // Subcategory (multi-value)
  [...new Set(data.flatMap(d => d.subcategories))].sort().forEach(s => {
    const count = data.filter(d => d.subcategories.includes(s)).length;
    subListEl.appendChild(makeCheckbox('subcategory', s, s, count));
  });

  // Era
  ERAS.forEach(era => {
    const count = data.filter(d => getEra(d.year) === era.label).length;
    if (count > 0) eraListEl.appendChild(makeCheckbox('era', era.label, era.label, count));
  });

  // Tags
  [...new Set(data.flatMap(d => d.tags))].sort().forEach(t => {
    const count = data.filter(d => d.tags.includes(t)).length;
    tagListEl.appendChild(makeCheckbox('tag', t, t, count));
  });

  // Language (primary + alternate combined)
  const allLangs = [...new Set(data.flatMap(d => {
    const langs = [d.language];
    if (d.alternate_urls) d.alternate_urls.forEach(a => langs.push(a.language));
    return langs.filter(Boolean);
  }))].sort();

  allLangs.forEach(l => {
    const count = data.filter(d => {
      const langs = [d.language, ...(d.alternate_urls || []).map(a => a.language)];
      return langs.includes(l);
    }).length;
    langListEl.appendChild(makeCheckbox('language', l, l, count));
  });

  // Collapsible init
  initCollapsible('fl-type',  true);
  initCollapsible('fl-cat',   true);
  initCollapsible('fl-sub',   true);
  initCollapsible('fl-era',   true);
  initCollapsible('fl-lang',  true);
  initCollapsible('fl-tags',  false); // collapsed by default (long list)
}

/* ── Checkbox factory ── */
function makeCheckbox(filterKey, value, label, count) {
  const wrap = document.createElement('label');
  const cb   = document.createElement('input');
  cb.type  = 'checkbox';
  cb.value = value;
  cb.dataset.filterKey = filterKey;

  cb.addEventListener('change', () => {
    const set = getSetForKey(filterKey);
    cb.checked ? set.add(value) : set.delete(value);
    currentPage = 1;
    render();
    renderActiveChips();
  });

  const text = document.createElement('span');
  text.textContent = label;

  const cnt = document.createElement('span');
  cnt.className   = 'checkbox-count';
  cnt.textContent = count;

  wrap.appendChild(cb);
  wrap.appendChild(text);
  wrap.appendChild(cnt);
  return wrap;
}

function getSetForKey(key) {
  const map = {
    type: 'types', category: 'categories', subcategory: 'subcategories',
    era: 'eras', tag: 'tags', language: 'languages'
  };
  return activeFilters[map[key]];
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
function renderActiveChips() {
  activeFiltersEl.innerHTML = '';

  const addChip = (label, onRemove) => {
    const chip = document.createElement('div');
    chip.className = 'active-chip';
    chip.innerHTML = `<span>${label}</span><button title="Remove">✕</button>`;
    chip.querySelector('button').addEventListener('click', onRemove);
    activeFiltersEl.appendChild(chip);
  };

  activeFilters.types.forEach(v         => addChip(v,        () => removeFilter('type',        v)));
  activeFilters.categories.forEach(v    => addChip(v,        () => removeFilter('category',    v)));
  activeFilters.subcategories.forEach(v => addChip(v,        () => removeFilter('subcategory', v)));
  activeFilters.eras.forEach(v          => addChip(v,        () => removeFilter('era',         v)));
  activeFilters.languages.forEach(v     => addChip(`🌐 ${v}`,() => removeFilter('language',    v)));
  activeFilters.tags.forEach(v          => addChip(`#${v}`,  () => removeFilter('tag',         v)));
}

function removeFilter(key, value) {
  getSetForKey(key).delete(value);
  document.querySelectorAll(`input[data-filter-key="${key}"]`).forEach(cb => {
    if (cb.value === value) cb.checked = false;
  });
  currentPage = 1;
  render();
  renderActiveChips();
}

/* ════════════════════════════════════════
   FILTERING + SORTING
════════════════════════════════════════ */
function isFiltered() {
  return (
    activeFilters.search ||
    activeFilters.types.size ||
    activeFilters.categories.size ||
    activeFilters.subcategories.size ||
    activeFilters.eras.size ||
    activeFilters.tags.size ||
    activeFilters.languages.size
  );
}

function applyFilters(data) {
  const q = activeFilters.search.toLowerCase();

  return data.filter(item => {

    // ── Text search ──
    if (q) {
      const hay = [
        item.title,
        item.description,
        ...item.categories,
        ...item.subcategories,
        ...item.tags,
        item.language     || '',
        item.author       || '',
        item.source       || '',
        ...(item.alternate_urls || []).map(a => a.language),
        ...(item.alternate_urls || []).map(a => a.label),
      ].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }

    // ── Type ──
    if (activeFilters.types.size && !activeFilters.types.has(item.type)) return false;

    // ── Category (ANY selected category must match at least one of item's categories) ──
    if (activeFilters.categories.size) {
      const match = [...activeFilters.categories].some(c => item.categories.includes(c));
      if (!match) return false;
    }

    // ── Subcategory (ANY selected subcategory must match at least one of item's subcategories) ──
    if (activeFilters.subcategories.size) {
      const match = [...activeFilters.subcategories].some(s => item.subcategories.includes(s));
      if (!match) return false;
    }

    // ── Era ──
    if (activeFilters.eras.size && !activeFilters.eras.has(getEra(item.year))) return false;

    // ── Tags (ALL selected tags must be present) ──
    if (activeFilters.tags.size) {
      if (![...activeFilters.tags].every(t => item.tags.includes(t))) return false;
    }

    // ── Language (match primary OR any alternate URL language) ──
    if (activeFilters.languages.size) {
      const itemLangs = [item.language, ...(item.alternate_urls || []).map(a => a.language)];
      const match = [...activeFilters.languages].some(l => itemLangs.includes(l));
      if (!match) return false;
    }

    return true;
  });
}

function applySort(data) {
  const s = [...data];
  switch (sortMode) {
    case 'year-asc':   return s.sort((a, b) => a.year - b.year);
    case 'year-desc':  return s.sort((a, b) => b.year - a.year);
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
   CATEGORY ROW VIEW (default, no filters)
════════════════════════════════════════ */
function showCategoryView() {
  flatView.style.display     = 'none';
  categoryView.style.display = '';
  categoryView.innerHTML     = '';

  resultsLabel.textContent = 'Browse Archive';
  resultsCount.textContent = `${allData.length} records`;

  // Collect all unique main categories preserving sort
  const mainCats = [...new Set(allData.flatMap(d => d.categories))].sort();

  mainCats.forEach(cat => {
    // Items that have this category
    const catItems = applySort(allData.filter(d => d.categories.includes(cat)));
    if (!catItems.length) return;

    // All subcategories that appear in this category's items
    const subCats = [...new Set(catItems.flatMap(d => d.subcategories))];

    const block = document.createElement('div');
    block.className = 'main-cat';

    block.innerHTML = `
      <div class="main-cat-head">
        <span class="main-cat-title">${cat}</span>
        <span class="main-cat-badge">${catItems.length} record${catItems.length !== 1 ? 's' : ''}</span>
        <span class="main-cat-line"></span>
      </div>
      <div class="sub-rows"></div>`;

    const subRowsWrap = block.querySelector('.sub-rows');

    subCats.forEach(sub => {
      // Items in this category that also have this subcategory
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
            <span class="sub-row-meta">${subItems.length} record${subItems.length !== 1 ? 's' : ''}</span>
          </div>
          ${showMore ? `<button class="view-all-btn" data-expanded="false">View All →</button>` : ''}
        </div>
        <div class="card-strip">
          ${preview.map((item, i) => cardHTML(item, i * 0.05, false)).join('')}
          ${rest.map((item, i)    => cardHTML(item, i * 0.05, false).replace('class="card"', 'class="card hidden"')).join('')}
        </div>`;

      const btn = subRow.querySelector('.view-all-btn');
      if (btn) {
        btn.addEventListener('click', () => {
          const expanded = btn.dataset.expanded === 'true';
          subRow.querySelectorAll('.card.hidden').forEach(c => c.classList.toggle('hidden', expanded));
          btn.dataset.expanded = String(!expanded);
          btn.textContent      = expanded ? 'View All →' : 'Show Less ↑';
        });
      }

      subRowsWrap.appendChild(subRow);
    });

    categoryView.appendChild(block);
  });
}

/* ════════════════════════════════════════
   FLAT PAGINATED VIEW (filters/search active)
════════════════════════════════════════ */
function showFlatView() {
  categoryView.style.display = 'none';
  flatView.style.display     = '';

  const filtered   = applySort(applyFilters(allData));
  const total      = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  if (currentPage > totalPages) currentPage = totalPages;

  const start     = (currentPage - 1) * perPage;
  const pageItems = filtered.slice(start, start + perPage);

  // Results label
  const parts = [];
  if (activeFilters.search)            parts.push(`"${activeFilters.search}"`);
  if (activeFilters.categories.size)   parts.push([...activeFilters.categories].join(', '));
  resultsLabel.textContent = parts.length ? `Results for ${parts.join(' · ')}` : 'Filtered Results';
  resultsCount.textContent = `${total} record${total !== 1 ? 's' : ''} · Page ${currentPage} of ${totalPages}`;

  // Cards
  if (!pageItems.length) {
    flatGrid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <circle cx="11" cy="11" r="7"/><path stroke-linecap="round" d="M21 21l-4.35-4.35"/>
          </svg>
        </div>
        <h3>No records found</h3>
        <p>Try adjusting your filters or search query.</p>
      </div>`;
  } else {
    flatGrid.innerHTML = pageItems.map((item, i) => cardHTML(item, i * 0.03, true)).join('');
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

  const makeBtn = (label, page, disabled = false, active = false) => {
    const btn = document.createElement('button');
    btn.className = 'page-btn' + (active ? ' active' : '');
    btn.textContent = label;
    btn.disabled = disabled;
    btn.addEventListener('click', () => { currentPage = page; showFlatView(); });
    return btn;
  };

  const makeDots = () => {
    const s = document.createElement('span');
    s.className = 'page-dots';
    s.textContent = '…';
    return s;
  };

  paginationEl.appendChild(makeBtn('← Prev', currentPage - 1, currentPage === 1));

  const pages = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (currentPage > 3) pages.push('…');
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) pages.push(i);
    if (currentPage < totalPages - 2) pages.push('…');
    pages.push(totalPages);
  }

  pages.forEach(p => {
    if (p === '…') paginationEl.appendChild(makeDots());
    else paginationEl.appendChild(makeBtn(p, p, false, p === currentPage));
  });

  paginationEl.appendChild(makeBtn('Next →', currentPage + 1, currentPage === totalPages));
}

/* ════════════════════════════════════════
   CARD HTML
════════════════════════════════════════ */
function yearLabel(y) { return y < 0 ? `${Math.abs(y)} BCE` : `${y} CE`; }

function cardHTML(item, delay = 0, showBreadcrumb = false) {
  const meta = [item.author, item.source].filter(Boolean).join(' · ');

  // Alternate URLs — show as compact links if present
  const altLinks = (item.alternate_urls || []).filter(a => a.url && a.label);
  const altHTML  = altLinks.length
    ? `<div class="card-alt-urls">
        <span class="card-alt-label">Also available in:</span>
        ${altLinks.map(a => `<a class="card-alt-link" href="${a.url}" target="_blank" rel="noopener" title="${a.language}">${a.label}</a>`).join('')}
       </div>`
    : '';

  // Breadcrumb: all categories × subcategories
  const breadcrumb = showBreadcrumb
    ? `<div class="card-breadcrumb-wrap">
        ${item.categories.map(c => `<span class="card-breadcrumb">${c}</span>`).join('')}
        ${item.subcategories.map(s => `<span class="card-breadcrumb card-breadcrumb-sub">› ${s}</span>`).join('')}
       </div>`
    : '';

  // Language badge
  const langBadge = item.language
    ? `<span class="card-lang">${item.language}</span>`
    : '';

  return `
    <div class="card" style="animation-delay:${delay}s">
      <div class="card-top">
        <span class="card-type-badge">${item.type}</span>
        <div class="card-top-right">
          ${langBadge}
          <span class="card-year">${yearLabel(item.year)}</span>
        </div>
      </div>
      <h3>${item.title}</h3>
      <p class="card-desc">${item.description}</p>
      ${meta ? `<div class="card-meta">${meta}</div>` : ''}
      ${breadcrumb}
      <div class="card-tags">${item.tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>
      ${altHTML}
      <a class="card-link" href="${item.url}" target="_blank" rel="noopener">Open Resource →</a>
    </div>`;
}

/* ════════════════════════════════════════
   BIND EVENTS
════════════════════════════════════════ */
function bindEvents() {

  // Search
  searchEl.addEventListener('input', () => {
    activeFilters.search = searchEl.value.trim();
    searchClear.classList.toggle('visible', !!activeFilters.search);
    currentPage = 1;
    render();
    renderActiveChips();
  });

  searchClear.addEventListener('click', () => {
    searchEl.value       = '';
    activeFilters.search = '';
    searchClear.classList.remove('visible');
    currentPage = 1;
    render();
    renderActiveChips();
  });

  clearAllBtn.addEventListener('click', clearAll);

  perPageSelect.addEventListener('change', () => {
    perPage     = parseInt(perPageSelect.value);
    currentPage = 1;
    render();
  });

  sortSelect.addEventListener('change', () => {
    sortMode    = sortSelect.value;
    currentPage = 1;
    render();
  });

  // Tag search within sidebar
  tagSearchEl.addEventListener('input', () => {
    const q = tagSearchEl.value.toLowerCase();
    tagListEl.querySelectorAll('label').forEach(label => {
      const text = label.querySelector('span')?.textContent.toLowerCase() ?? '';
      label.style.display = text.includes(q) ? '' : 'none';
    });
  });
}

function clearAll() {
  activeFilters.search = '';
  activeFilters.types.clear();
  activeFilters.categories.clear();
  activeFilters.subcategories.clear();
  activeFilters.eras.clear();
  activeFilters.tags.clear();
  activeFilters.languages.clear();
  currentPage = 1;

  searchEl.value = '';
  searchClear.classList.remove('visible');
  tagSearchEl.value = '';
  tagListEl.querySelectorAll('label').forEach(l => l.style.display = '');
  document.querySelectorAll('.checkbox-list input[type="checkbox"]').forEach(cb => cb.checked = false);

  render();
  renderActiveChips();
}
