/* ════════════════════════════════════════
   INDIAN HISTORY ARCHIVE — script.js
════════════════════════════════════════ */

const PREVIEW_PER_CAT = 3;

const TYPE_ICONS = {
  article:'📰', document:'📄', video:'🎥', audio:'🎙', image:'🖼',
};

const CAT_COLOURS = [
  '#2563eb','#7c3aed','#0891b2','#059669','#d97706',
  '#dc2626','#9333ea','#0284c7','#65a30d','#c2410c',
  '#0d9488','#be185d',
];
const catColourMap = {};
function getCatColour(cat) {
  if (!catColourMap[cat])
    catColourMap[cat] = CAT_COLOURS[Object.keys(catColourMap).length % CAT_COLOURS.length];
  return catColourMap[cat];
}

const ERAS = [
  { label:'Prehistoric / Proto-Historic (before 600 BCE)', test:y => y < -600 },
  { label:'Ancient (600 BCE – 600 CE)',                    test:y => y >= -600 && y < 600  },
  { label:'Early Medieval (600 – 1200 CE)',                test:y => y >= 600  && y < 1200 },
  { label:'Medieval (1200 – 1526 CE)',                     test:y => y >= 1200 && y < 1526 },
  { label:'Early Modern (1526 – 1757 CE)',                 test:y => y >= 1526 && y < 1757 },
  { label:'Colonial Era (1757 – 1947 CE)',                 test:y => y >= 1757 && y < 1947 },
  { label:'Post-Independence (1947 CE onwards)',           test:y => y >= 1947 },
];

function getEra(item) {
  const y = item.period?.start_year ?? 0;
  return ERAS.find(e => e.test(y))?.label ?? 'Unknown';
}
function yearLabel(y) {
  if (y == null) return '';
  return y < 0 ? `${Math.abs(y)} BCE` : `${y} CE`;
}
function periodLabel(item) {
  if (!item.period) return '';
  const s = item.period.start_year, e = item.period.end_year;
  return s === e ? yearLabel(s) : `${yearLabel(s)} – ${yearLabel(e)}`;
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
let viewMode     = 'card';

const AF = {
  search:'', types:new Set(), categories:new Set(), subcategories:new Set(),
  eras:new Set(), dynasties:new Set(), regions:new Set(),
  sourceTypes:new Set(), languages:new Set(), formats:new Set(), tags:new Set(),
};

/* ════════════════════════════════════════
   DOM
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
const viewToggleCard  = $('viewToggleCard');
const viewToggleTable = $('viewToggleTable');

/* ════════════════════════════════════════
   LOADER
════════════════════════════════════════ */
let chunkMap = {}, chunkCache = {}, useChunks = false;

fetch('data/index.json')
  .then(r => { if (!r.ok) throw 0; return r.json(); })
  .then(p => {
    useChunks = true; chunkMap = p._meta?.chunks ?? {};
    allData = p.records; totalRecords = p._meta?.total ?? p.records.length;
    init(allData);
  })
  .catch(() =>
    fetch('data.json').then(r => r.json()).then(d => {
      allData = d; totalRecords = d.length; init(d);
    })
  );

async function loadChunk(cat) {
  const fn = chunkMap[cat];
  if (!useChunks || !fn || chunkCache[fn]) return;
  try {
    const full = await fetch(`data/${fn}`).then(r => r.json());
    chunkCache[fn] = full;
    const ids = new Set(full.map(r => r.id));
    allData = [...allData.filter(r => !ids.has(r.id)), ...full];
  } catch(e) {}
}

async function preloadActiveChunks() {
  if (!useChunks || !AF.categories.size) return;
  await Promise.all([...AF.categories].map(loadChunk));
}

function init(data) {
  $('docCount').textContent      = totalRecords;
  $('categoryCount').textContent = [...new Set(data.flatMap(d => d.categories))].length;
  $('tagCount').textContent      = [...new Set(data.flatMap(d => d.tags))].length;
  [...new Set(data.flatMap(d => d.categories))].sort().forEach(getCatColour);
  buildFilters(data);
  bindEvents();
  loadStateFromURL();
}

/* ════════════════════════════════════════
   URL STATE
════════════════════════════════════════ */
function pushURL() {
  const p = new URLSearchParams();
  if (AF.search)              p.set('q',     AF.search);
  if (searchScope !== 'all')  p.set('scope', searchScope);
  if (AF.types.size)          p.set('type',  [...AF.types].join(','));
  if (AF.categories.size)     p.set('cat',   [...AF.categories].join('||'));
  if (AF.subcategories.size)  p.set('sub',   [...AF.subcategories].join('||'));
  if (AF.eras.size)           p.set('era',   [...AF.eras].join('||'));
  if (AF.dynasties.size)      p.set('dyn',   [...AF.dynasties].join('||'));
  if (AF.regions.size)        p.set('reg',   [...AF.regions].join('||'));
  if (AF.sourceTypes.size)    p.set('src',   [...AF.sourceTypes].join('||'));
  if (AF.languages.size)      p.set('lang',  [...AF.languages].join(','));
  if (AF.formats.size)        p.set('fmt',   [...AF.formats].join(','));
  if (AF.tags.size)           p.set('tag',   [...AF.tags].join('||'));
  if (sortMode !== 'default') p.set('sort',  sortMode);
  if (viewMode !== 'card')    p.set('view',  viewMode);
  if (currentPage > 1)        p.set('page',  currentPage);
  history.pushState(null, '', p.toString() ? `${location.pathname}?${p}` : location.pathname);
  updatePageTitle();
}

function updatePageTitle() {
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
  const setM = (k,s) => { const v=p.get(k); if(v) v.split('||').forEach(x=>s.add(x)); };
  const setS = (k,s) => { const v=p.get(k); if(v) v.split(',').forEach(x=>s.add(x)); };

  if (p.get('q'))     { AF.search=p.get('q'); searchEl.value=AF.search; searchClear.classList.add('visible'); }
  if (p.get('scope')) { searchScope=p.get('scope'); searchScopeEl.value=searchScope; }
  setS('type',AF.types); setM('cat',AF.categories); setM('sub',AF.subcategories);
  setM('era',AF.eras);   setM('dyn',AF.dynasties);  setM('reg',AF.regions);
  setM('src',AF.sourceTypes); setS('lang',AF.languages); setS('fmt',AF.formats);
  setM('tag',AF.tags);
  if (p.get('sort')) { sortMode=p.get('sort'); sortSelect.value=sortMode; }
  if (p.get('view')) { viewMode=p.get('view'); setViewToggle(viewMode); }
  if (p.get('page')) currentPage=parseInt(p.get('page'));

  document.querySelectorAll('.checkbox-list input[type="checkbox"]').forEach(cb => {
    if (getSet(cb.dataset.filterKey)?.has(cb.value)) cb.checked = true;
  });
  render(); renderChips(); updatePageTitle();
}

window.addEventListener('popstate', () => {
  AF.search=''; searchEl.value=''; searchClear.classList.remove('visible');
  Object.values(AF).forEach(v => v instanceof Set && v.clear());
  document.querySelectorAll('.checkbox-list input[type="checkbox"]').forEach(cb => cb.checked=false);
  loadStateFromURL();
});

/* ════════════════════════════════════════
   BUILD FILTERS
════════════════════════════════════════ */
function buildFilters(data) {
  const fill = (el, vals, key, cnt) =>
    [...new Set(vals)].filter(Boolean).sort()
      .forEach(v => el.appendChild(makeCheckbox(key, v, v, cnt(v))));

  fill($('typeList'),    data.map(d=>d.type),                         'type',        v=>data.filter(d=>d.type===v).length);
  fill($('catList'),     data.flatMap(d=>d.categories),               'category',    v=>data.filter(d=>d.categories.includes(v)).length);
  fill($('subList'),     data.flatMap(d=>d.subcategories),            'subcategory', v=>data.filter(d=>d.subcategories.includes(v)).length);
  ERAS.forEach(era => {
    const n = data.filter(d=>getEra(d)===era.label).length;
    if (n>0) $('eraList').appendChild(makeCheckbox('era',era.label,era.label,n));
  });
  fill($('dynastyList'), data.map(d=>d.dynasty).filter(Boolean),      'dynasty',     v=>data.filter(d=>d.dynasty===v).length);
  fill($('regionList'),  data.flatMap(d=>d.region||[]),               'region',      v=>data.filter(d=>(d.region||[]).includes(v)).length);
  fill($('srcTypeList'), data.map(d=>d.source_type).filter(Boolean),  'source_type', v=>data.filter(d=>d.source_type===v).length);

  const langs = data.flatMap(d=>[d.language,...(d.alternate_urls||[]).map(a=>a.language)]);
  fill($('langList'), langs, 'language',
    v=>data.filter(d=>[d.language,...(d.alternate_urls||[]).map(a=>a.language)].includes(v)).length);

  const fmts = data.flatMap(d=>[d.file_format,...(d.alternate_urls||[]).map(a=>a.format)]);
  fill($('formatList'), fmts, 'file_format',
    v=>data.filter(d=>[d.file_format,...(d.alternate_urls||[]).map(a=>a.format)].includes(v)).length);

  [...new Set(data.flatMap(d=>d.tags))].sort()
    .forEach(t => $('tagList').appendChild(makeCheckbox('tag',t,t,data.filter(d=>d.tags.includes(t)).length)));

  ['fl-type','fl-cat','fl-era'].forEach(id => initCollapsible(id, true));
  ['fl-sub','fl-dynasty','fl-region','fl-srctype','fl-lang','fl-format','fl-tags']
    .forEach(id => initCollapsible(id, false));

  $('advancedToggleBtn').addEventListener('click', () => {
    $('advancedBody').classList.toggle('collapsed');
    $('advArrow').classList.toggle('open');
  });
}

function makeCheckbox(filterKey, value, label, count) {
  const wrap = document.createElement('label');
  const cb   = document.createElement('input');
  cb.type='checkbox'; cb.value=value; cb.dataset.filterKey=filterKey;
  cb.addEventListener('change', () => {
    const s = getSet(filterKey);
    cb.checked ? s.add(value) : s.delete(value);
    currentPage=1; render(); renderChips(); updateFilterCounts(); updateAdvancedCount(); pushURL();
  });
  const txt = document.createElement('span'); txt.textContent=label;
  const cnt = document.createElement('span'); cnt.className='checkbox-count'; cnt.textContent=count;
  wrap.appendChild(cb); wrap.appendChild(txt); wrap.appendChild(cnt);
  return wrap;
}

function getSet(key) {
  return ({
    type:AF.types, category:AF.categories, subcategory:AF.subcategories,
    era:AF.eras, dynasty:AF.dynasties, region:AF.regions,
    source_type:AF.sourceTypes, language:AF.languages,
    file_format:AF.formats, tag:AF.tags,
  })[key];
}

function initCollapsible(id, open) {
  const body=$(id), head=body?.previousElementSibling, arrow=head?.querySelector('.fg-arrow');
  if (!body||!head) return;
  if (!open) body.classList.add('collapsed'); else arrow?.classList.add('open');
  head.addEventListener('click', () => {
    body.classList.toggle('collapsed'); arrow?.classList.toggle('open');
  });
}

function updateFilterCounts() {
  const visible = applyFilters(allData);
  document.querySelectorAll('.checkbox-list input[type="checkbox"]').forEach(cb => {
    const n = visible.filter(item => matchesCheckbox(item, cb.dataset.filterKey, cb.value)).length;
    const countEl = cb.parentElement.querySelector('.checkbox-count');
    if (countEl) countEl.textContent = n;
    const dim = n===0 && !getSet(cb.dataset.filterKey)?.has(cb.value);
    cb.parentElement.style.opacity      = dim ? '0.38' : '';
    cb.parentElement.style.pointerEvents= dim ? 'none'  : '';
  });
  $('docCount').textContent = isFiltered() ? visible.length : totalRecords;
  const ofEl = $('docTotal');
  if (isFiltered()) { ofEl.textContent=` of ${totalRecords}`; ofEl.style.display=''; }
  else              { ofEl.textContent=''; ofEl.style.display='none'; }

  const activeCount = Object.values(AF).reduce((a,v) =>
    a + (v instanceof Set ? v.size : (v?1:0)), 0);
  const badge = $('mobileFilterCount');
  badge.textContent=activeCount; badge.style.display=activeCount>0?'':'none';
}

function updateAdvancedCount() {
  const n = [AF.subcategories,AF.dynasties,AF.regions,AF.sourceTypes,AF.languages,AF.formats,AF.tags]
    .reduce((a,s)=>a+s.size,0);
  const el=$('advCount'); el.textContent=n; el.style.display=n>0?'':'none';
}

function matchesCheckbox(item, key, val) {
  switch(key) {
    case 'type':        return item.type===val;
    case 'category':    return item.categories.includes(val);
    case 'subcategory': return item.subcategories.includes(val);
    case 'era':         return getEra(item)===val;
    case 'dynasty':     return item.dynasty===val;
    case 'region':      return (item.region||[]).includes(val);
    case 'source_type': return item.source_type===val;
    case 'language':    return [item.language,...(item.alternate_urls||[]).map(a=>a.language)].includes(val);
    case 'file_format': return [item.file_format,...(item.alternate_urls||[]).map(a=>a.format)].includes(val);
    case 'tag':         return item.tags.includes(val);
    default:            return false;
  }
}

/* ════════════════════════════════════════
   CHIPS
════════════════════════════════════════ */
function renderChips() {
  activeFiltersEl.innerHTML='';
  const add = (label, key, val) => {
    const chip=document.createElement('div'); chip.className='active-chip';
    chip.innerHTML=`<span>${label}</span><button>✕</button>`;
    chip.querySelector('button').addEventListener('click', () => {
      getSet(key).delete(val);
      document.querySelectorAll(`input[data-filter-key="${key}"]`)
        .forEach(cb=>{ if(cb.value===val) cb.checked=false; });
      currentPage=1; render(); renderChips(); updateFilterCounts(); updateAdvancedCount(); pushURL();
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
   FILTER + SORT
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
      let hay='';
      switch(searchScope) {
        case 'title':    hay=item.title; break;
        case 'tags':     hay=item.tags.join(' '); break;
        case 'author':   hay=(item.authors||[]).map(a=>a.name).join(' '); break;
        case 'keywords': hay=(item.keywords||[]).join(' '); break;
        default: hay=[
          item.title, item.description,
          ...(item.categories||[]), ...(item.subcategories||[]),
          ...(item.tags||[]), ...(item.keywords||[]), ...(item.themes_covered||[]),
          item.dynasty||'', item.subject||'', item.paper||'',
          ...(item.region||[]), item.source||'', item.source_type||'',
          item.language||'', item.file_format||'', item.period?.era||'',
          ...(item.authors||[]).flatMap(a=>[a.name,a.affiliation]),
          ...(item.alternate_urls||[]).flatMap(a=>[a.label,a.language,a.format]),
        ].join(' ');
      }
      if (!hay.toLowerCase().includes(q)) return false;
    }
    if (AF.types.size        && !AF.types.has(item.type))                                       return false;
    if (AF.categories.size   && ![...AF.categories].some(c=>item.categories.includes(c)))       return false;
    if (AF.subcategories.size&& ![...AF.subcategories].some(s=>item.subcategories.includes(s))) return false;
    if (AF.eras.size         && !AF.eras.has(getEra(item)))                                     return false;
    if (AF.dynasties.size    && !AF.dynasties.has(item.dynasty))                                return false;
    if (AF.regions.size      && ![...AF.regions].some(r=>(item.region||[]).includes(r)))        return false;
    if (AF.sourceTypes.size  && !AF.sourceTypes.has(item.source_type))                          return false;
    if (AF.languages.size) {
      const l=[item.language,...(item.alternate_urls||[]).map(a=>a.language)];
      if (![...AF.languages].some(v=>l.includes(v))) return false;
    }
    if (AF.formats.size) {
      const f=[item.file_format,...(item.alternate_urls||[]).map(a=>a.format)];
      if (![...AF.formats].some(v=>f.includes(v))) return false;
    }
    if (AF.tags.size && ![...AF.tags].every(t=>item.tags.includes(t))) return false;
    return true;
  });
}

function applySort(data) {
  const s=[...data], yr=d=>d.period?.start_year??0;
  switch(sortMode) {
    case 'year-asc':   return s.sort((a,b)=>yr(a)-yr(b));
    case 'year-desc':  return s.sort((a,b)=>yr(b)-yr(a));
    case 'title-asc':  return s.sort((a,b)=>a.title.localeCompare(b.title));
    case 'title-desc': return s.sort((a,b)=>b.title.localeCompare(a.title));
    default:           return s;
  }
}

/* ════════════════════════════════════════
   VIEW TOGGLE
════════════════════════════════════════ */
function setViewToggle(mode) {
  viewMode=mode;
  viewToggleCard.classList.toggle('active',  mode==='card');
  viewToggleTable.classList.toggle('active', mode==='table');
}

/* ════════════════════════════════════════
   RENDER
════════════════════════════════════════ */
function render() {
  isFiltered() ? showFlatView() : showCategoryView();
}

/* ════════════════════════════════════════
   CATEGORY BROWSE VIEW
   — renders card strips OR tables per category
     depending on viewMode
════════════════════════════════════════ */
function showCategoryView() {
  flatView.style.display='none';
  categoryView.style.display='';
  categoryView.innerHTML='';
  backToBrowse.style.display='none';
  resultsLabel.textContent='Browse Archive';
  resultsCount.textContent=`${totalRecords} records`;

  const cats = [...new Set(allData.flatMap(d=>d.categories))].sort();

  cats.forEach(cat => {
    const colour   = getCatColour(cat);
    const catItems = applySort(allData.filter(d=>d.categories.includes(cat)));
    if (!catItems.length) return;

    const showMore = catItems.length > PREVIEW_PER_CAT;
    const preview  = catItems.slice(0, PREVIEW_PER_CAT);
    const rest     = catItems.slice(PREVIEW_PER_CAT);

    const block = document.createElement('div');
    block.className = 'main-cat';

    /* ── header row (same for both modes) ── */
    const headHTML = `
      <div class="main-cat-head">
        <span class="main-cat-accent" style="background:${colour}"></span>
        <span class="main-cat-title">${cat}</span>
        <span class="main-cat-badge">${catItems.length} record${catItems.length!==1?'s':''}</span>
        <span class="main-cat-line"></span>
        <button class="cat-filter-btn" data-cat="${cat}">Filter ↗</button>
        ${showMore?`<button class="view-all-btn" data-expanded="false">View All →</button>`:''}
      </div>`;

    /* ── body: card strip OR table ── */
    let bodyHTML = '';
    if (viewMode === 'table') {
      const previewRows = preview.map(item => tableRowHTML(item)).join('');
      const restRows    = rest.map(item =>
        `<tr class="table-row${item.featured?' table-row-featured':''} extra-row" style="display:none">
          ${tableRowHTML(item).replace(/^<tr[^>]*>/,'').replace(/<\/tr>$/,'')}
        </tr>`
      ).join('');
      bodyHTML = `
        <div class="cat-table-wrap">
          <table class="flat-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Type</th>
                <th>Period</th>
                <th>Category</th>
                <th>Language</th>
                <th>Tags</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${previewRows}
              ${restRows}
            </tbody>
          </table>
        </div>`;
    } else {
      const previewCards = preview.map((item,i) => cardHTML(item, i*0.05, false)).join('');
      const restCards    = rest.map((item,i) =>
        cardHTML(item, i*0.05, false).replace('class="card', 'class="card hidden')
      ).join('');
      bodyHTML = `
        <div class="card-strip">
          ${previewCards}
          ${restCards}
        </div>`;
    }

    block.innerHTML = headHTML + bodyHTML;

    /* Filter ↗ button */
    block.querySelector('.cat-filter-btn').addEventListener('click', () => {
      AF.categories.add(cat);
      const cb=document.querySelector(`input[data-filter-key="category"][value="${CSS.escape(cat)}"]`);
      if (cb) cb.checked=true;
      currentPage=1; render(); renderChips(); updateFilterCounts(); updateAdvancedCount(); pushURL();
    });

    /* View All toggle */
    const vBtn = block.querySelector('.view-all-btn');
    if (vBtn) vBtn.addEventListener('click', () => {
      const exp = vBtn.dataset.expanded==='true';
      if (viewMode==='table') {
        block.querySelectorAll('.extra-row').forEach(r => r.style.display = exp ? 'none' : '');
      } else {
        block.querySelectorAll('.card.hidden').forEach(c => c.classList.toggle('hidden', exp));
      }
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
  categoryView.style.display='none';
  flatView.style.display='';
  backToBrowse.style.display='';

  const filtered   = applySort(applyFilters(allData));
  const total      = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total/perPage));
  if (currentPage>totalPages) currentPage=totalPages;
  const pageItems  = filtered.slice((currentPage-1)*perPage, currentPage*perPage);

  const parts=[];
  if (AF.search)          parts.push(`"${AF.search}"`);
  if (AF.categories.size) parts.push([...AF.categories].join(', '));
  resultsLabel.textContent = parts.length ? `Results for ${parts.join(' · ')}` : 'Filtered Results';
  resultsCount.textContent = `${total} record${total!==1?'s':''} · Page ${currentPage} of ${totalPages}`;

  if (!pageItems.length) {
    flatGrid.className='flat-grid';
    flatGrid.innerHTML=`
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
          ${[...new Set(allData.flatMap(d=>d.categories))].sort().slice(0,6)
            .map(c=>`<button class="empty-cat-btn" data-cat="${c}">${c}</button>`).join('')}
        </div>
      </div>`;
    flatGrid.querySelectorAll('.empty-cat-btn').forEach(btn =>
      btn.addEventListener('click', () => {
        clearAll(false);
        AF.categories.add(btn.dataset.cat);
        const cb=document.querySelector(`input[data-filter-key="category"][value="${CSS.escape(btn.dataset.cat)}"]`);
        if (cb) cb.checked=true;
        currentPage=1; render(); renderChips(); updateFilterCounts(); pushURL();
      }));

  } else if (viewMode==='table') {
    flatGrid.className='flat-table-wrap';
    flatGrid.innerHTML=`
      <table class="flat-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Type</th>
            <th>Period</th>
            <th>Category</th>
            <th>Language</th>
            <th>Tags</th>
            <th></th>
          </tr>
        </thead>
        <tbody>${pageItems.map(item=>tableRowHTML(item)).join('')}</tbody>
      </table>`;
  } else {
    flatGrid.className='flat-grid';
    flatGrid.innerHTML=pageItems.map((item,i)=>cardHTML(item,i*0.03,true)).join('');
  }

  renderPagination(totalPages);
  window.scrollTo({top:0,behavior:'smooth'});
}

/* ════════════════════════════════════════
   PAGINATION
════════════════════════════════════════ */
function renderPagination(totalPages) {
  paginationEl.innerHTML='';
  if (totalPages<=1) return;
  const mkBtn=(label,page,disabled,active)=>{
    const b=document.createElement('button');
    b.className='page-btn'+(active?' active':'');
    b.textContent=label; b.disabled=disabled;
    b.addEventListener('click',()=>{currentPage=page;showFlatView();pushURL();});
    return b;
  };
  const dots=()=>{const s=document.createElement('span');s.className='page-dots';s.textContent='…';return s;};
  paginationEl.appendChild(mkBtn('← Prev',currentPage-1,currentPage===1,false));
  const pages=[];
  if(totalPages<=7){for(let i=1;i<=totalPages;i++)pages.push(i);}
  else{
    pages.push(1);
    if(currentPage>3)pages.push('…');
    for(let i=Math.max(2,currentPage-1);i<=Math.min(totalPages-1,currentPage+1);i++)pages.push(i);
    if(currentPage<totalPages-2)pages.push('…');
    pages.push(totalPages);
  }
  pages.forEach(p=>paginationEl.appendChild(p==='…'?dots():mkBtn(p,p,false,p===currentPage)));
  paginationEl.appendChild(mkBtn('Next →',currentPage+1,currentPage===totalPages,false));
}

/* ════════════════════════════════════════
   CARD HTML — simplified
════════════════════════════════════════ */
function cardHTML(item, delay=0, showBreadcrumb=false) {
  const period = periodLabel(item);
  const icon   = TYPE_ICONS[item.type]||'📋';

  const breadcrumb = showBreadcrumb ? `
    <div class="card-breadcrumb-wrap">
      ${item.categories.map(c=>`
        <span class="card-breadcrumb" style="border-color:${getCatColour(c)};color:${getCatColour(c)}">${c}</span>
      `).join('')}
      ${item.subcategories.slice(0,3).map(s=>`
        <span class="card-breadcrumb card-breadcrumb-sub">› ${s}</span>
      `).join('')}
    </div>` : '';

  const altHTML = (item.alternate_urls||[]).length ? `
    <div class="card-alt-urls">
      ${item.alternate_urls.map(a=>`
        <a class="card-alt-link" href="${a.url}" target="_blank" rel="noopener">
          <span class="alt-lang">${a.language}</span>
          <span class="alt-label">${a.label}</span>
        </a>`).join('')}
    </div>` : '';

  return `
    <div class="card${item.featured?' card-featured':''}" style="animation-delay:${delay}s">
      ${item.featured?'<span class="card-star" title="Featured">★</span>':''}
      <div class="card-top">
        <span class="card-type-badge">${icon} ${item.type}</span>
        <div class="card-top-right">
          ${item.language?`<span class="card-lang">${item.language}</span>`:''}
          ${period?`<span class="card-year">${period}</span>`:''}
        </div>
      </div>
      <h3>${item.title}</h3>
      <p class="card-desc">${item.description}</p>
      ${breadcrumb}
      <div class="card-tags">
        ${item.tags.slice(0,3).map(t=>`<span class="tag">${t}</span>`).join('')}
        ${item.tags.length>3?`<span class="tag tag-more">+${item.tags.length-3}</span>`:''}
      </div>
      ${altHTML}
      <a class="card-link" href="${item.url}" target="_blank" rel="noopener">Open Resource →</a>
    </div>`;
}

/* ════════════════════════════════════════
   TABLE ROW HTML
════════════════════════════════════════ */
function tableRowHTML(item) {
  const period = periodLabel(item);
  const icon   = TYPE_ICONS[item.type]||'📋';
  const tags   = item.tags.slice(0,3).map(t=>`<span class="tag">${t}</span>`).join('')
               + (item.tags.length>3?`<span class="tag tag-more">+${item.tags.length-3}</span>`:'');
  const alts   = (item.alternate_urls||[]).length
    ? `<span class="table-alts" title="${item.alternate_urls.map(a=>a.language).join(', ')}">
        +${item.alternate_urls.length} lang
       </span>` : '';

  return `
    <tr class="table-row${item.featured?' table-row-featured':''}">
      <td class="td-title">
        ${item.featured?'<span class="table-star">★</span>':''}
        <a href="${item.url}" target="_blank" rel="noopener" class="table-title-link">${item.title}</a>
        ${alts}
      </td>
      <td class="td-type">${icon} ${item.type}</td>
      <td class="td-period">${period||'—'}</td>
      <td class="td-cat">
        <div class="td-cat-inner">
          ${item.categories.map(c=>`<span class="table-cat-dot" style="background:${getCatColour(c)}" title="${c}"></span>`).join('')}
          <span class="td-cat-text">${item.categories.join(', ')}</span>
        </div>
      </td>
      <td class="td-lang">${item.language||'—'}</td>
      <td class="td-tags">${tags}</td>
      <td class="td-link"><a href="${item.url}" target="_blank" rel="noopener" class="table-open-btn">Open →</a></td>
    </tr>`;
}

/* ════════════════════════════════════════
   EVENTS
════════════════════════════════════════ */
let searchDebounce=null;

function bindEvents() {
  searchEl.addEventListener('input', () => {
    searchClear.classList.toggle('visible', !!searchEl.value);
    clearTimeout(searchDebounce);
    searchDebounce=setTimeout(()=>{
      AF.search=searchEl.value.trim(); currentPage=1;
      render(); renderChips(); updateFilterCounts(); pushURL();
    }, 280);
  });

  searchClear.addEventListener('click', () => {
    searchEl.value=''; AF.search=''; searchClear.classList.remove('visible');
    currentPage=1; render(); renderChips(); updateFilterCounts(); pushURL();
  });

  searchScopeEl.addEventListener('change', () => {
    searchScope=searchScopeEl.value;
    if (AF.search){currentPage=1;render();pushURL();}
  });

  clearAllBtn.addEventListener('click', ()=>clearAll(true));
  backToBrowse.addEventListener('click', ()=>clearAll(true));

  perPageSelect.addEventListener('change', ()=>{
    perPage=parseInt(perPageSelect.value); currentPage=1; render(); pushURL();
  });
  sortSelect.addEventListener('change', ()=>{
    sortMode=sortSelect.value; currentPage=1; render(); pushURL();
  });

  tagSearchEl.addEventListener('input', ()=>{
    const q=tagSearchEl.value.toLowerCase();
    $('tagList').querySelectorAll('label').forEach(l=>
      l.style.display=l.querySelector('span')?.textContent.toLowerCase().includes(q)?'':'none');
  });

  /* View toggle */
  viewToggleCard.addEventListener('click', ()=>{
    setViewToggle('card'); render(); pushURL();
  });
  viewToggleTable.addEventListener('click', ()=>{
    setViewToggle('table'); render(); pushURL();
  });

  /* Mobile */
  $('mobileFilterBtn').addEventListener('click',  openSidebar);
  $('sidebarClose').addEventListener('click',     closeSidebar);
  sidebarOverlay.addEventListener('click',        closeSidebar);
}

function openSidebar()  { sidebar.classList.add('open'); sidebarOverlay.classList.add('visible'); document.body.style.overflow='hidden'; }
function closeSidebar() { sidebar.classList.remove('open'); sidebarOverlay.classList.remove('visible'); document.body.style.overflow=''; }

function clearAll(push=true) {
  AF.search=''; searchEl.value=''; searchClear.classList.remove('visible');
  Object.values(AF).forEach(v=>v instanceof Set&&v.clear());
  sortMode='default'; sortSelect.value='default'; currentPage=1;
  $('tagSearch').value='';
  $('tagList').querySelectorAll('label').forEach(l=>l.style.display='');
  document.querySelectorAll('.checkbox-list input[type="checkbox"]').forEach(cb=>cb.checked=false);
  render(); renderChips(); updateFilterCounts(); updateAdvancedCount();
  if (push) pushURL();
}
