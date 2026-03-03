/* ════════════════════════════════════════
   INDIAN HISTORY ARCHIVE — script.js
════════════════════════════════════════ */

const PREVIEW_PER_CAT = 3;

const TYPE_ICONS = {
  article: '📰', document: '📄', video: '🎥',
  audio: '🎙', image: '🖼',
};

const CAT_COLOURS = [
  '#2563eb','#7c3aed','#0891b2','#059669','#d97706',
  '#dc2626','#9333ea','#0284c7','#65a30d','#c2410c',
  '#0d9488','#be185d',
];
const catColourMap = {};
function getCatColour(cat) {
  if (!catColourMap[cat]) {
    catColourMap[cat] = CAT_COLOURS[Object.keys(catColourMap).length % CAT_COLOURS.length];
  }
  return catColourMap[cat];
}

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
let viewMode     = 'card';   // 'card' | 'table'

const AF = {
  search:'', types:new Set(), categories:new Set(), subcategories:new Set(),
  eras:new Set(), dynasties:new Set(), regions:new Set(),
  sourceTypes:new Set(), languages:new Set(), formats:new Set(), tags:new Set(),
};

/* ════════════════════════════════════════
   DOM
════════════════════════════════════════ */
const $ = id => document.getElementById(id);

const searchEl       = $('search');
const searchClear    = $('searchClear');
const searchScopeEl  = $('searchScope');
const clearAllBtn    = $('clearAllBtn');
const activeFiltersEl= $('activeFilters');
const categoryView   = $('categoryView');
const flatView       = $('flatView');
const flatGrid       = $('flatGrid');
const paginationEl   = $('pagination');
const resultsCount   = $('resultsCount');
const resultsLabel   = $('resultsLabel');
const perPageSelect  = $('perPage');
const sortSelect     = $('sortSelect');
const tagSearchEl    = $('tagSearch');
const backToBrowse   = $('backToBrowse');
const sidebar        = $('sidebar');
const sidebarOverlay = $('sidebarOverlay');
const viewToggleCard = $('viewToggleCard');
const viewToggleTable= $('viewToggleTable');

/* ════════════════════════════════════════
   LOADER — index.json → data.json fallback
════════════════════════════════════════ */
let chunkMap = {}, chunkCache = {}, useChunks = false;

fetch('data/index.json')
  .then(r => { if (!r.ok) throw 0; return r.json(); })
  .then(p => {
    useChunks = true; chunkMap = p._meta?.chun
