/* ════════════════════════════════════════
   INDIAN HISTORY ARCHIVE — script.js
════════════════════════════════════════ */

const PREVIEW_PER_SUBCAT = 3; // cards shown in default category rows

/* ── Era definitions (based on year) ── */
const ERAS = [
  { label: 'Ancient (before 600 CE)',  test: y => y < 600  },
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
  search:       '',
  types:        new Set(),
  categories:   new Set(),
  subcategories:new Set(),
  eras:         new Set(),
  tags:         new Set(),
};

/* ════════════════════════════════════════
   DOM REFS
════════════════════════════════════════ */
const $ = id => document.getElementById(id);

const searchEl      = $('search');
const searchClear   = $('searchClear');
const clearAllBtn   = $('clearAllBtn');
const typeListEl    = $('typeList');
const catListEl     = $('catList');
const subListEl     = $('subList');
const eraListEl     = $('eraList');
const tagListEl     = $('tagList');
const tagSearchEl   = $('tagSearch');
const activeFiltersEl = $('activeFilters');
const categoryView  = $('categoryView');
const flatView      = $('flatView');
const flatGrid      = $('flatGrid');
const paginationEl  = $('pagination');
const resultsCount  = $('resultsCount');
const resultsLabel  = $('resultsLabel');
const perPageSelect = $('perPage');
const sortSelect    = $('sortSelect');

/* ════════════════════════════════════════
   INIT
════════════════════════════════════════ */
fetch('data.json')
  .then(r => r.json())
  .then(data => {
    allData = data;

    // Stats
    $('docCount').textContent      = data.length;
    const allCats = [...new Set(data.map(d => d.category))];
    const allTags = [...new Set(data.flatMap(d => d.tags))];
    $('categoryCount').textContent = allCats.length;
    $('tagCount').textContent      = allTags.length;

    buildFilters(data);
    bindEvents();
    render();
  });

/* ════════════════════════════════════════
   BUILD SIDEBAR FILTER LISTS
════════════════════════════════════════ */
function buildFilters(data) {

  // Types
  const types = [...new Set(data.map(d => d.type))].sort();
  types.forEach(t => {
    const count = data.filter(d => d.type === t).length;
    typeListEl.appendChild(makeCheckbox('type', t, t, count));
  });

  // Categories
  const cats = [...new Set(data.map(d => d.category))].sort();
  cats.forEach(c => {
    const count = data.filter(d => d.category === c).length;
    catListEl.appendChild(makeCheckbox('category', c, c, count));
  });

  // Subcategories
  const subs = [...new Set(data.map(d => d.subcategory))].sort();
  subs.forEach(s => {
    const count = data.filter(d => d.subcategory === s).length;
    subListEl.appendChild(makeCheckbox('subcategory', s, s, count));
  });

  // Eras (derived)
  ERAS.forEach(era => {
    const count = data.filter(d => getEra(d.year) === era.label).length;
    if (count > 0) eraListEl.appendChild(makeCheckbox('era', era.label, era.label, count));
  });

  // Tags
  const tags = [...new Set(data.flatMap(d => d.tags))].sort();
  tags.forEach(t => {
    const count = data.filter(d => d.tags.includes(t)).length;
    tagListEl.appendChild(makeCheckbox('tag', t, t, count));
  });

  // Collapsible groups — start tags collapsed
  initCollapsible('fl-tags',  false);
  initCollapsible('fl-sub',   true);
  initCollapsible('fl-cat',   true);
  initCollapsible('fl-type',  true);
  initCollapsible('fl-era',   true);
}

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
  cnt.className = 'checkbox-count';
  cnt.textContent = count;

  wrap.appendChild(cb);
  wrap.appendChild(text);
  wrap.appendChild(cnt);
  return wrap;
}

function getSetForKey(key) {
  const map = { type: 'types', category: 'categories', subcategory: 'subcategories', era: 'eras', tag: 'tags' };
  return activeFilters[map[key]];
}

function initCollapsible(bodyId, open = true) {
  const body = $(bodyId);
  const head = body?.previousElementSibling;
  const arrow = head?.querySelector('.fg-arrow');
  if (!body || !head) return;
  if (!open) {
    body.classList.add('collapsed');
  } else {
    arrow?.classList.add('open');
  }
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

  activeFilters.types.forEach(v =>
    addChip(v, () => removeFilter('type', v)));
  activeFilters.categories.forEach(v =>
    addChip(v, () => removeFilter('category', v)));
  activeFilters.subcategories.forEach(v =>
    addChip(v, () => removeFilter('subcategory', v)));
  activeFilters.eras.forEach(v =>
    addChip(v, () => removeFilter('era', v)));
  activeFilters.tags.forEach(v =>
    addChip(`#${v}`, () => removeFilter('tag', v)));
}

function removeFilter(key, value) {
  getSetForKey(key).delete(value);
  // uncheck the checkbox
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
    activeFilters.tags.size
  );
}

function applyFilters(data) {
  const q = activeFilters.search.toLowerCase();

  return data.filter(item => {
    // Search
    if (q) {
      const hay = [
        item.title, item.description,
        item.category, item.subcategory,
        ...item.tags,
        item.author || '', item.source || ''
      ].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    // Type
    if (activeFilters.types.size && !activeFilters.types.has(item.type)) return false;
    // Category
    if (activeFilters.categories.size && !activeFilters.categories.has(item.category)) return false;
    // Subcategory
    if (activeFilters.subcategories.size && !activeFilters.subcategories.has(item.subcategory)) return false;
    // Era
    if (activeFilters.eras.size && !activeFilters.eras.has(getEra(item.year))) return false;
    // Tags
    if (activeFilters.tags.size) {
      const hasAll = [...activeFilters.tags].every(t => item.tags.includes(t));
      if (!hasAll) return false;
    }
    return true;
  });
}

function applySort(data) {
  const sorted = [...data];
  switch (sortMode) {
    case 'year-asc':   return sorted.sort((a, b) => a.year - b.year);
    case 'year-desc':  return sorted.sort((a, b) => b.year - a.year);
    case 'title-asc':  return sorted.sort((a, b) => a.title.localeCompare(b.title));
    case 'title-desc': return sorted.sort((a, b) => b.title.localeCompare(a.title));
    default:           return sorted;
  }
}

/* ════════════════════════════════════════
   RENDER ORCHESTRATOR
════════════════════════════════════════ */
function render() {
  if (isFiltered()) {
    showFlatView();
  } else {
    showCategoryView();
  }
}

/* ════════════════════════════════════════
   CATEGORY ROW VIEW (default)
════════════════════════════════════════ */
function showCategoryView() {
  flatView.style.display     = 'none';
  categoryView.style.display = '';
  categoryView.innerHTML     = '';

  resultsLabel.textContent = 'Browse Archive';
  resultsCount.textContent = `${allData.length} records`;

  const mainCats = [...new Set(allData.map(d => d.category))].sort();

  mainCats.forEach(cat => {
    const catItems = applySort(allData.filter(d => d.category === cat));
    if (!catItems.length) return;

    const block = document.createElement('div');
    block.className = 'main-cat';

    const subCats = [...new Set(catItems.map(d => d.subcategory))];

    block.innerHTML = `
      <div class="main-cat-head">
        <span class="main-cat-title">${cat}</span>
        <span class="main-cat-badge">${catItems.length} records</span>
        <span class="main-cat-line"></span>
      </div>
      <div class="sub-rows"></div>`;

    const subRowsWrap = block.querySelector('.sub-rows');

    subCats.forEach(sub => {
      const subItems  = catItems.filter(d => d.subcategory === sub);
      const showMore  = subItems.length > PREVIEW_PER_SUBCAT;
      const preview   = subItems.slice(0, PREVIEW_PER_SUBCAT);
      const rest      = subItems.slice(PREVIEW_PER_SUBCAT);

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
          ${rest.map((item, i) => cardHTML(item, i * 0.05, false).replace('class="card"', 'class="card hidden"')).join('')}
        </div>`;

      const btn = subRow.querySelector('.view-all-btn');
      if (btn) {
        btn.addEventListener('click', () => {
          const expanded = btn.dataset.expanded === 'true';
          subRow.querySelectorAll('.card.hidden').forEach(c => c.classList.toggle('hidden', expanded));
          btn.dataset.expanded = String(!expanded);
          btn.textContent = expanded ? 'View All →' : 'Show Less ↑';
        });
      }

      subRowsWrap.appendChild(subRow);
    });

    categoryView.appendChild(block);
  });
}

/* ════════════════════════════════════════
   FLAT PAGINATED VIEW (when filters/search active)
════════════════════════════════════════ */
function showFlatView() {
  categoryView.style.display = 'none';
  flatView.style.display     = '';

  const filtered = applySort(applyFilters(allData));
  const total    = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  if (currentPage > totalPages) currentPage = totalPages;

  const start   = (currentPage - 1) * perPage;
  const pageItems = filtered.slice(start, start + perPage);

  // Update label
  const filterParts = [];
  if (activeFilters.search)           filterParts.push(`"${activeFilters.search}"`);
  if (activeFilters.categories.size)  filterParts.push([...activeFilters.categories].join(', '));
  resultsLabel.textContent = filterParts.length ? `Results for ${filterParts.join(' · ')}` : 'Filtered Results';
  resultsCount.textContent = `${total} record${total !== 1 ? 's' : ''} · Page ${currentPage} of ${totalPages}`;

  // Cards
  if (!pageItems.length) {
    flatGrid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" d="M21 21l-4.35-4.35"/><circle cx="11" cy="11" r="7"/>
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
    s.className = 'page-dots'; s.textContent = '…';
    return s;
  };

  // Prev
  paginationEl.appendChild(makeBtn('← Prev', currentPage - 1, currentPage === 1));

  // Page numbers with ellipsis
  const pages = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (currentPage > 3)       pages.push('…');
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) pages.push(i);
    if (currentPage < totalPages - 2) pages.push('…');
    pages.push(totalPages);
  }

  pages.forEach(p => {
    if (p === '…') { paginationEl.appendChild(makeDots()); }
    else paginationEl.appendChild(makeBtn(p, p, false, p === currentPage));
  });

  // Next
  paginationEl.appendChild(makeBtn('Next →', currentPage + 1, currentPage === totalPages));
}

/* ════════════════════════════════════════
   CARD HTML
════════════════════════════════════════ */
function yearLabel(y) { return y < 0 ? `${Math.abs(y)} BCE` : `${y} CE`; }

function cardHTML(item, delay = 0, showBreadcrumb = false) {
  const meta = [item.author, item.source].filter(Boolean).join(' · ');
  return `
    <div class="card" style="animation-delay:${delay}s">
      <div class="card-top">
        <span class="card-type-badge">${item.type}</span>
        <span class="card-year">${yearLabel(item.year)}</span>
      </div>
      <h3>${item.title}</h3>
      <p class="card-desc">${item.description}</p>
      ${meta ? `<div class="card-meta">${meta}</div>` : ''}
      ${showBreadcrumb ? `<span class="card-breadcrumb">${item.category} › ${item.subcategory}</span>` : ''}
      <div class="card-tags">${item.tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>
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
    searchEl.value = '';
    activeFilters.search = '';
    searchClear.classList.remove('visible');
    currentPage = 1;
    render();
    renderActiveChips();
  });

  // Clear all filters
  clearAllBtn.addEventListener('click', clearAll);

  // Per page
  perPageSelect.addEventListener('change', () => {
    perPage = parseInt(perPageSelect.value);
    currentPage = 1;
    render();
  });

  // Sort
  sortSelect.addEventListener('change', () => {
    sortMode = sortSelect.value;
    currentPage = 1;
    render();
  });

  // Tag search filter
  tagSearchEl.addEventListener('input', () => {
    const q = tagSearchEl.value.toLowerCase();
    tagListEl.querySelectorAll('label').forEach(label => {
      const text = label.querySelector('span')?.textContent.toLowerCase() ?? '';
      label.style.display = text.includes(q) ? '' : 'none';
    });
  });
}

function clearAll() {
  // Clear all state
  activeFilters.search = '';
  activeFilters.types.clear();
  activeFilters.categories.clear();
  activeFilters.subcategories.clear();
  activeFilters.eras.clear();
  activeFilters.tags.clear();
  currentPage = 1;

  // Reset UI
  searchEl.value = '';
  searchClear.classList.remove('visible');
  tagSearchEl.value = '';
  tagListEl.querySelectorAll('label').forEach(l => l.style.display = '');
  document.querySelectorAll('.checkbox-list input[type="checkbox"]').forEach(cb => cb.checked = false);

  render();
  renderActiveChips();
}
