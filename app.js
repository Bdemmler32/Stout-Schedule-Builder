/* ============================================================
   StoutPGH Schedule Editor — app.js
   ============================================================ */

'use strict';

// ============================================================
// CONSTANTS
// ============================================================

const DAYS = ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];

// Half-hour slots 6:00 AM – 10:00 PM
const TIME_SLOTS = (() => {
  const slots = [];
  for (let h = 6; h <= 22; h++) {
    slots.push(fmtTime(h, 0));
    if (h < 22) slots.push(fmtTime(h, 30));
  }
  return slots;
})();

function fmtTime(h, m) {
  const ap = h < 12 ? 'AM' : 'PM';
  const hh = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hh}:${m === 0 ? '00' : '30'} ${ap}`;
}

function toMins(t) {
  if (!t) return -1;
  const [hm, ap] = t.split(' ');
  let [h, m] = hm.split(':').map(Number);
  if (ap === 'PM' && h !== 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  return h * 60 + m;
}

const TYPES = [
  { id: 'bjj',      label: 'BJJ (Gi / No Gi)', cls: 'c-bjj',      color: '#ddeeff' },
  { id: 'mma',      label: 'MMA',              cls: 'c-mma',      color: '#ede8f8' },
  { id: 'striking', label: 'Striking / Boxing', cls: 'c-striking', color: '#fce8ec' },
  { id: 'youth',    label: 'Youth BJJ',         cls: 'c-youth',    color: '#e4f5e4' },
  { id: 'noc',      label: 'No Classes',        cls: 'noc',        color: 'transparent' },
];

const LEVELS = [
  'All Levels','Fundamentals','Intermediate','Advanced',
  'Competition','Open Mat','Ages 5-6','Ages 7-13','',
];

// Edit mode: each half-hour slot is this many pixels tall
// Blocks span 2 slots = 1 full hour
const SLOT_H = 60; // px

// ============================================================
// HELPERS
// ============================================================

function uid() { return Math.random().toString(36).slice(2, 9); }

function mkBlock(time, level, disc, disc2, type) {
  return { id: uid(), time, level: level || '', disc: disc || '', disc2: disc2 || '', type };
}

function mkNoc() {
  return { id: uid(), time: null, level: '', disc: '', disc2: '', type: 'noc' };
}

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function toast(msg, kind = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast ${kind} show`;
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.className = 'toast'; }, 2400);
}

// ============================================================
// DEFAULT DATA
// ============================================================

const now = new Date();
const DEF_REV = `${now.getMonth()+1}/${now.getDate()}/${String(now.getFullYear()).slice(2)}`;

function makeDefaultSchedules() {
  return [
    {
      id: 0, tab: 'Adult BJJ',
      location: 'MONROEVILLE/EAST',
      stype: 'ADULT BJJ SCHEDULE',
      rev: DEF_REV,
      addr: '1 Racquet Lane | Monroeville, PA 15146',
      phone: '(412)-551-8119',
      web: 'www.StoutPGH.com',
      days: [
        // Sunday — no blocks
        [],
        // Monday
        [
          mkBlock('12:00 PM','All Levels','Gi - Adult BJJ','','bjj'),
          mkBlock('5:30 PM','Fundamentals','Gi - Adult BJJ','','bjj'),
          mkBlock('6:30 PM','Intermediate','NoGi - Adult BJJ','','bjj'),
          mkBlock('7:30 PM','Open Mat','Adult BJJ','','bjj'),
          mkBlock('7:30 PM','','MMA Techniques','Adult MMA','mma'),
        ],
        // Tuesday
        [
          mkBlock('5:30 PM','Fundamentals','NoGi - Adult BJJ','','bjj'),
          mkBlock('6:30 PM','Intermediate','NoGi - Adult BJJ','','bjj'),
          mkBlock('7:30 PM','Open Mat','Adult BJJ','','bjj'),
          mkBlock('7:30 PM','','MMA Techniques','Adult MMA','mma'),
        ],
        // Wednesday
        [
          mkBlock('12:00 PM','All Levels','No Gi - Adult BJJ','','bjj'),
          mkBlock('5:30 PM','Fundamentals','NoGi - Adult BJJ','','bjj'),
          mkBlock('6:30 PM','Advanced','NoGi - Adult BJJ','','bjj'),
          mkBlock('7:30 PM','Open Mat','Adult BJJ','','bjj'),
        ],
        // Thursday
        [
          mkBlock('5:30 PM','Intermediate','Gi - Adult BJJ','','bjj'),
          mkBlock('6:30 PM','Open Mat','Adult BJJ','','bjj'),
        ],
        // Friday
        [
          mkBlock('12:00 PM','All Levels','No Gi - Adult BJJ','','bjj'),
          mkBlock('5:30 PM','Fundamentals','Gi - Adult BJJ','','bjj'),
          mkBlock('6:30 PM','Comp. Practice','No Gi - Adult BJJ','','bjj'),
        ],
        // Saturday
        [
          mkBlock('9:00 AM','Open Mat','NoGi - Adult BJJ','','bjj'),
          mkBlock('10:00 AM','Fundamentals','NoGi - Adult BJJ','','bjj'),
        ],
      ],
    },
    {
      id: 1, tab: 'Striking',
      location: 'MONROEVILLE/EAST',
      stype: 'ADULT STRIKING SCHEDULE',
      rev: DEF_REV,
      addr: '1 Racquet Lane | Monroeville, PA 15146',
      phone: '(412)-551-8119',
      web: 'www.StoutPGH.com',
      days: [
        [], // Sunday
        [
          mkBlock('12:00 PM','All Levels','Adult Striking','','striking'),
          mkBlock('6:30 PM','Fundamentals','Adult Striking','','striking'),
          mkBlock('6:30 PM','Intermediate','Adult Striking','','striking'),
          mkBlock('7:30 PM','','MMA Techniques','Adult MMA','mma'),
        ],
        [
          mkBlock('5:30 PM','','Boxing','Adult Striking','striking'),
          mkBlock('6:30 PM','Intermediate','Adult Striking','','striking'),
          mkBlock('7:30 PM','','MMA Techniques','Adult MMA','mma'),
        ],
        [
          mkBlock('5:30 PM','','Boxing','Adult Striking','striking'),
          mkBlock('6:30 PM','Fundamentals','Adult Striking','','striking'),
        ],
        [
          mkBlock('6:30 PM','Intermediate','Adult Striking','','striking'),
        ],
        [
          mkBlock('12:00 PM','All Levels','Adult Striking','','striking'),
        ],
        [
          mkBlock('11:00 AM','All Levels','Adult Striking','','striking'),
        ],
      ],
    },
    {
      id: 2, tab: 'Youth BJJ',
      location: 'MONROEVILLE/EAST',
      stype: 'YOUTH BJJ SCHEDULE',
      rev: DEF_REV,
      addr: '1 Racquet Lane | Monroeville, PA 15146',
      phone: '(412)-551-8119',
      web: 'www.StoutPGH.com',
      days: [
        [], // Sunday
        [
          mkBlock('4:30 PM','Ages 5-6','Gi - Youth BJJ','','youth'),
          mkBlock('5:30 PM','Ages 7-13','Gi - Youth BJJ','','youth'),
        ],
        [], // Tuesday
        [
          mkBlock('4:30 PM','Ages 5-6','Gi - Youth BJJ','','youth'),
          mkBlock('5:30 PM','Ages 7-13','Striking/ Kickboxing','','striking'),
          mkBlock('5:30 PM','Ages 7-13','Gi - Youth BJJ','','youth'),
        ],
        [
          mkBlock('5:30 PM','Ages 7-13','Gi - Youth BJJ','','youth'),
          mkBlock('5:30 PM','Intermediate Ages 7-13','No Gi - Youth BJJ','','youth'),
        ],
        [], // Friday
        [
          mkBlock('10:00 AM','Ages 7-13','Gi - Youth BJJ','','youth'),
        ],
      ],
    },
  ];
}

// ============================================================
// STATE
// ============================================================

let schedules = makeDefaultSchedules();
let activeTab = 0;
let mode = 'edit'; // 'edit' | 'preview'

// Undo history: array of JSON snapshots
const HISTORY_LIMIT = 100;
let history = [];
let historyIdx = -1;

// Drag state
let drag = null;
let ghostEl = null;
let isDuplicate = false;

function sch() { return schedules[activeTab]; }

// ============================================================
// HISTORY (UNDO)
// ============================================================

function snapshot() {
  const snap = JSON.stringify(schedules);
  // Discard anything after current index (redo not supported)
  history = history.slice(0, historyIdx + 1);
  history.push(snap);
  if (history.length > HISTORY_LIMIT) history.shift();
  historyIdx = history.length - 1;
  updateUndoBtn();
}

function undo() {
  if (historyIdx <= 0) return;
  historyIdx--;
  schedules = JSON.parse(history[historyIdx]);
  updateUndoBtn();
  renderSidebar();
  renderFlyer();
}

function updateUndoBtn() {
  const btn = document.getElementById('undoBtn');
  if (btn) btn.disabled = historyIdx <= 0;
}

// Take initial snapshot
function initHistory() {
  history = [JSON.stringify(schedules)];
  historyIdx = 0;
  updateUndoBtn();
}

// ============================================================
// IMPORT / EXPORT DATA
// ============================================================

function exportData() {
  const blob = new Blob([JSON.stringify(schedules, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'stoutpgh-schedule.json';
  a.click();
  URL.revokeObjectURL(url);
  toast('Schedule data exported', 'ok');
}

function importData() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!Array.isArray(data) || !data[0].days) throw new Error('Invalid format');
        schedules = data;
        snapshot();
        renderSidebar();
        renderFlyer();
        toast('Schedule imported', 'ok');
      } catch (err) {
        toast('Import failed: ' + err.message, 'warn');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

// ============================================================
// ROW COMPUTATION
// ============================================================

// Returns sorted list of unique times used across all days.
// "No Classes" blocks (type noc, time null) are tracked separately.
// Each entry: { time: '9:00 AM' } or { noc: true }
function getRows(s) {
  const timeSet = new Set();
  let hasNoc = false;
  s.days.forEach(day => {
    day.forEach(b => {
      if (b.type === 'noc') hasNoc = true;
      else if (b.time) timeSet.add(b.time);
    });
  });
  const times = [...timeSet].sort((a, b) => toMins(a) - toMins(b));
  const rows = [];
  if (hasNoc) rows.push({ noc: true });
  times.forEach(t => rows.push({ time: t }));
  return rows;
}

// ============================================================
// RENDER SIDEBAR
// ============================================================

function renderSidebar() {
  // Tabs
  document.getElementById('tabRow').innerHTML = schedules.map((s, i) =>
    `<button class="tab-btn ${i === activeTab ? 'active' : ''}" onclick="setTab(${i})">${esc(s.tab)}</button>`
  ).join('');

  const s = sch();
  const timeOpts = TIME_SLOTS.map(t => `<option value="${t}">${t}</option>`).join('');
  const lvlOpts  = LEVELS.map(l => `<option value="${l}">${l || '(none)'}</option>`).join('');
  const typeOpts = TYPES.map(t => `<option value="${t.id}">${t.label}</option>`).join('');
  const dayOpts  = DAYS.map((d, i) => `<option value="${i}">${d}</option>`).join('');

  document.getElementById('sbBody').innerHTML = `
    <div class="mode-row">
      <button class="mode-btn ${mode === 'edit' ? 'active' : ''}" onclick="setMode('edit')">
        <i class="fas fa-pen"></i> Edit
      </button>
      <button class="mode-btn ${mode === 'preview' ? 'active' : ''}" onclick="setMode('preview')">
        <i class="fas fa-eye"></i> Preview
      </button>
    </div>

    <div class="action-row">
      <button class="action-btn" id="undoBtn" onclick="undo()" disabled>
        <i class="fas fa-undo"></i> Undo
      </button>
      <button class="action-btn" onclick="importData()">
        <i class="fas fa-upload"></i> Import
      </button>
      <button class="action-btn" onclick="exportData()">
        <i class="fas fa-download"></i> Export
      </button>
    </div>

    <div class="field-group">
      <span class="lbl">Location</span>
      <input class="finput" value="${esc(s.location)}"
        oninput="sch().location=this.value; renderFlyer()">
    </div>
    <div class="field-group">
      <span class="lbl">Schedule Type</span>
      <input class="finput" value="${esc(s.stype)}"
        oninput="sch().stype=this.value; renderFlyer()">
    </div>
    <div class="field-group">
      <span class="lbl">Revision Date</span>
      <input class="finput" value="${esc(s.rev)}"
        oninput="sch().rev=this.value; renderFlyer()">
    </div>

    <hr class="hdiv">

    <div class="field-group">
      <span class="lbl">Address</span>
      <input class="finput" value="${esc(s.addr)}"
        oninput="sch().addr=this.value; renderFlyer()">
    </div>
    <div class="field-group">
      <span class="lbl">Phone</span>
      <input class="finput" value="${esc(s.phone)}"
        oninput="sch().phone=this.value; renderFlyer()">
    </div>
    <div class="field-group">
      <span class="lbl">Website</span>
      <input class="finput" value="${esc(s.web)}"
        oninput="sch().web=this.value; renderFlyer()">
    </div>

    <hr class="hdiv">

    <span class="lbl" style="margin-bottom:7px;display:block">Add Block</span>
    <div class="add-form">
      <span class="lbl">Day</span>
      <select class="fselect" id="nb-day">${dayOpts}</select>

      <span class="lbl">Time</span>
      <select class="fselect" id="nb-time">${timeOpts}</select>

      <span class="lbl">Level / Label</span>
      <input class="fminput" id="nb-level" placeholder="e.g. Fundamentals">

      <span class="lbl">Primary Line</span>
      <input class="fminput" id="nb-disc" placeholder="e.g. Gi - Adult BJJ">

      <span class="lbl">Secondary Line (optional)</span>
      <input class="fminput" id="nb-disc2" placeholder="e.g. Adult MMA">

      <span class="lbl">Type / Color</span>
      <select class="fselect" id="nb-type">${typeOpts}</select>

      <button class="add-btn" onclick="addBlockFromPanel()">
        <i class="fas fa-plus"></i> Add Block
      </button>
    </div>
  `;
  updateUndoBtn();
}

// ============================================================
// RENDER FLYER
// ============================================================

function renderFlyer() {
  const s = sch();
  const rows = getRows(s);
  const isPreview = mode === 'preview';
  const modeCls = isPreview ? 'preview-mode' : 'edit-mode';

  // Build schedule body rows
  let bodyHTML = '';
  rows.forEach((row, ri) => {
    const isNocRow = !!row.noc;
    const bg = ri % 2 === 0 ? '#fff' : '#f5f5f5';
    let cells = '';

    DAYS.forEach((_, di) => {
      const dayBlocks = s.days[di];
      let matches;
      if (isNocRow) {
        matches = dayBlocks.filter(b => b.type === 'noc');
      } else {
        matches = dayBlocks.filter(b => b.type !== 'noc' && b.time === row.time);
      }

      const blocksHTML = matches.map(b => blockHTML(b, di, isPreview)).join('');
      const addBtn = !isPreview
        ? `<button class="add-here" onclick="quickAdd(${di},'${isNocRow ? '' : row.time}')" title="Add here">+</button>`
        : '';

      const dropAttrs = !isPreview
        ? `ondragover="onDragOver(event)" ondragleave="onDragLeave(event)" ondrop="onDrop(event,${di},'${isNocRow ? '' : row.time}')"`
        : '';

      cells += `<div class="day-cell" data-di="${di}" data-time="${isNocRow ? '' : row.time}" ${dropAttrs}>
        ${blocksHTML}${addBtn}
      </div>`;
    });

    bodyHTML += `<div class="time-row" style="background:${bg}">${cells}</div>`;
  });

  if (!bodyHTML) {
    bodyHTML = `<div style="padding:40px;text-align:center;color:#999;font-size:13px;font-family:'Outfit',sans-serif;grid-column:1/-1;">
      Use "Add Block" to build the schedule.</div>`;
  }

  // Logo
  const logoHTML = `
    <div class="logo-img-wrap">
      <img src="stoutpgh-logo.png" alt="StoutPGH"
        onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
      <div class="logo-fallback" style="display:none">
        ST<span class="logo-circle"><i class="fas fa-circle-notch"></i></span>UT
        <span style="color:#f0b429">&nbsp;PGH</span>
      </div>
    </div>`;

  const flyerHTML = `
    <div class="flyer ${modeCls}" id="flyerEl" style="--slot-h:${SLOT_H}px">
      <div class="flyer-header">
        <div class="hdr-main">
          ${logoHTML}
          <span class="hdr-loc">${esc(s.location)}</span>
          <span class="hdr-type">&nbsp;${esc(s.stype)}</span>
        </div>
        <div class="hdr-rev">REVISION<br><strong>${esc(s.rev)}</strong></div>
      </div>
      <div class="day-headers">
        ${DAYS.map(d => `<div class="day-hdr-cell">${d}</div>`).join('')}
      </div>
      <div class="sched-body" id="schedBody">${bodyHTML}</div>
      <div class="flyer-footer">
        <div class="ftr-item"><i class="fas fa-map-marker-alt"></i><span>${esc(s.addr)}</span></div>
        <div class="ftr-item"><i class="fas fa-phone-square"></i><span>${esc(s.phone)}</span></div>
        <div class="ftr-item"><i class="fas fa-globe"></i><span>${esc(s.web)}</span></div>
      </div>
    </div>`;

  if (isPreview) {
    // Preview: flyer centered, no ruler
    document.getElementById('flyerWrap').innerHTML = flyerHTML;
  } else {
    // Edit: time ruler + flyer side by side
    const rulerHTML = buildRuler(rows);
    document.getElementById('flyerWrap').innerHTML = `
      <div class="edit-wrap">
        <div class="time-ruler" id="timeRuler" style="--slot-h:${SLOT_H}px">${rulerHTML}</div>
        ${flyerHTML}
      </div>`;
  }
}

// ── Build time ruler ──────────────────────────────────────────
function buildRuler(rows) {
  // Ruler mirrors flyer structure:
  // header height (62px) + day-headers height (34px) + one slot per row
  let html = `
    <div class="ruler-header"></div>
    <div class="ruler-dayhdr">TIME</div>`;

  rows.forEach(row => {
    if (row.noc) {
      html += `<div class="ruler-slot" style="height:${SLOT_H}px;min-height:${SLOT_H}px"></div>`;
    } else {
      html += `<div class="ruler-slot" style="height:${SLOT_H * 2}px;min-height:${SLOT_H * 2}px">${row.time}</div>`;
    }
  });

  return html;
}

// ── Single block HTML ─────────────────────────────────────────
function blockHTML(b, di, isPreview) {
  if (b.type === 'noc') {
    const del = !isPreview
      ? `<button class="cb-del" onclick="delBlock(event,'${b.id}',${di})"><i class="fas fa-times"></i></button>`
      : '';
    return `<div class="cb noc" data-id="${b.id}" data-di="${di}">
      ${del}<div class="noc-text">NO<br>CLASSES</div>
    </div>`;
  }

  const T = TYPES.find(t => t.id === b.type) || TYPES[0];
  const draggable = !isPreview ? 'draggable="true"' : '';
  const dragEvts = !isPreview
    ? `ondragstart="onDragStart(event,'${b.id}',${di})" ondragend="onDragEnd(event)"`
    : '';
  const ctxEvt = !isPreview
    ? `oncontextmenu="showCtx(event,'${b.id}',${di})"`
    : '';
  const del = !isPreview
    ? `<button class="cb-del" onclick="delBlock(event,'${b.id}',${di})"><i class="fas fa-times"></i></button>`
    : '';

  return `<div class="cb ${T.cls}" ${draggable} ${dragEvts} ${ctxEvt}
    data-id="${b.id}" data-di="${di}" data-time="${b.time}" style="--slot-h:${SLOT_H}px">
    ${del}
    <div class="cb-time"><i class="far fa-clock"></i>&nbsp;${esc(b.time)}</div>
    ${b.level ? `<div class="cb-level">${esc(b.level)}</div>` : ''}
    <div class="cb-disc">${esc(b.disc)}</div>
    ${b.disc2 ? `<div class="cb-disc2">${esc(b.disc2)}</div>` : ''}
  </div>`;
}

// ============================================================
// MODE + TAB
// ============================================================

function setMode(m) {
  mode = m;
  updatePill();
  renderSidebar();
  renderFlyer();
}

function setTab(i) {
  activeTab = i;
  renderSidebar();
  renderFlyer();
}

function updatePill() {
  const pill = document.getElementById('modePill');
  if (mode === 'edit') {
    pill.className = 'mode-pill edit';
    pill.innerHTML = '<i class="fas fa-pen"></i>&nbsp; Edit Mode — drag to move &nbsp;|&nbsp; Alt+drag to duplicate';
  } else {
    pill.className = 'mode-pill';
    pill.innerHTML = '<i class="fas fa-eye"></i>&nbsp; Preview — exact 11" × 8.5" print output';
  }
}

// ============================================================
// ADD BLOCK
// ============================================================

function addBlockFromPanel() {
  const di    = +document.getElementById('nb-day').value;
  const time  = document.getElementById('nb-time').value;
  const level = document.getElementById('nb-level').value.trim();
  const disc  = document.getElementById('nb-disc').value.trim() || 'Class';
  const disc2 = document.getElementById('nb-disc2').value.trim();
  const type  = document.getElementById('nb-type').value;

  const block = type === 'noc'
    ? mkNoc()
    : mkBlock(time, level, disc, disc2, type);

  snapshot();
  sch().days[di].push(block);
  sortDay(di);
  renderFlyer();
  toast('Block added', 'ok');
}

function quickAdd(di, time) {
  // Pre-fill panel fields and focus
  const dayEl  = document.getElementById('nb-day');
  const timeEl = document.getElementById('nb-time');
  if (dayEl) dayEl.value = di;
  if (timeEl && time) timeEl.value = time;
  document.getElementById('nb-disc')?.focus();
}

function sortDay(di) {
  // Noc blocks to front (no time), then sort by time
  sch().days[di].sort((a, b) => {
    if (a.type === 'noc' && b.type !== 'noc') return -1;
    if (a.type !== 'noc' && b.type === 'noc') return 1;
    return toMins(a.time) - toMins(b.time);
  });
}

function delBlock(e, blockId, di) {
  e.stopPropagation();
  snapshot();
  sch().days[di] = sch().days[di].filter(b => b.id !== blockId);
  renderFlyer();
}

function delBlockById(blockId, di) {
  snapshot();
  sch().days[di] = sch().days[di].filter(b => b.id !== blockId);
  renderFlyer();
}

// ============================================================
// DRAG & DROP
// ============================================================

function onDragStart(e, blockId, di) {
  if (mode !== 'edit') { e.preventDefault(); return; }

  // Alt/Option key = duplicate
  isDuplicate = e.altKey || e.metaKey;
  drag = { blockId, fromDi: di };
  e.dataTransfer.effectAllowed = isDuplicate ? 'copy' : 'move';

  // Ghost
  const src = e.currentTarget;
  const g = src.cloneNode(true);
  g.className = 'cb ' + src.className.replace('cb','').trim() + ' drag-ghost-el';
  g.style.cssText = `width:${src.offsetWidth}px; position:fixed; top:-9999px; left:-9999px;`;
  g.querySelector('.cb-del')?.remove();
  document.body.appendChild(g);
  ghostEl = g;
  e.dataTransfer.setDragImage(g, e.offsetX, e.offsetY);

  requestAnimationFrame(() => {
    src.classList.add(isDuplicate ? 'dup-preview' : 'dragging');
  });
}

function onDragEnd(e) {
  const src = e.currentTarget;
  src.classList.remove('dragging', 'dup-preview');
  ghostEl?.remove();
  ghostEl = null;
  document.querySelectorAll('.droptgt').forEach(el => el.classList.remove('droptgt'));
  drag = null;
}

function onDragOver(e) {
  if (!drag || mode !== 'edit') return;
  e.preventDefault();
  e.dataTransfer.dropEffect = isDuplicate ? 'copy' : 'move';
  e.currentTarget.classList.add('droptgt');
}

function onDragLeave(e) {
  e.currentTarget.classList.remove('droptgt');
}

function onDrop(e, toDi, toTime) {
  e.preventDefault();
  e.currentTarget.classList.remove('droptgt');
  if (!drag || mode !== 'edit') return;

  const { blockId, fromDi } = drag;
  drag = null;

  const s = sch();
  const fromArr = s.days[fromDi];
  const idx = fromArr.findIndex(b => b.id === blockId);
  if (idx === -1) return;

  snapshot();

  if (isDuplicate) {
    // Deep copy with new id
    const orig = fromArr[idx];
    const copy = { ...JSON.parse(JSON.stringify(orig)), id: uid() };
    if (toTime && copy.type !== 'noc') copy.time = toTime;
    s.days[toDi].push(copy);
    toast('Block duplicated (Alt+drag)', 'ok');
  } else {
    const block = fromArr.splice(idx, 1)[0];
    if (toTime && block.type !== 'noc') block.time = toTime;
    s.days[toDi].push(block);
  }

  sortDay(toDi);
  renderFlyer();
}

// ============================================================
// CONTEXT MENU
// ============================================================

function showCtx(e, blockId, di) {
  if (mode !== 'edit') return;
  e.preventDefault();
  e.stopPropagation();
  const ctx = document.getElementById('ctxMenu');
  ctx.innerHTML = `
    <div class="ctx-item" onclick="openEditModal('${blockId}',${di});hideCtx()">
      <i class="fas fa-pen"></i> Edit block
    </div>
    <div class="ctx-item ctx-sep" onclick="dupBlock('${blockId}',${di});hideCtx()">
      <i class="fas fa-copy"></i> Duplicate
    </div>
    <div class="ctx-item ctx-sep danger" onclick="delBlockById('${blockId}',${di});hideCtx()">
      <i class="fas fa-trash"></i> Delete
    </div>`;
  ctx.style.display = 'block';
  ctx.style.left = e.clientX + 'px';
  ctx.style.top  = e.clientY + 'px';
}

function hideCtx() {
  document.getElementById('ctxMenu').style.display = 'none';
}

function dupBlock(blockId, di) {
  const s = sch();
  const orig = s.days[di].find(b => b.id === blockId);
  if (!orig) return;
  const copy = { ...JSON.parse(JSON.stringify(orig)), id: uid() };
  snapshot();
  s.days[di].push(copy);
  sortDay(di);
  renderFlyer();
  toast('Block duplicated', 'ok');
}

// ============================================================
// EDIT MODAL
// ============================================================

function openEditModal(blockId, di) {
  const block = sch().days[di].find(b => b.id === blockId);
  if (!block || block.type === 'noc') return;

  const timeOpts = TIME_SLOTS.map(t =>
    `<option value="${t}" ${t === block.time ? 'selected' : ''}>${t}</option>`
  ).join('');
  const typeOpts = TYPES.filter(t => t.id !== 'noc').map(t =>
    `<option value="${t.id}" ${t.id === block.type ? 'selected' : ''}>${t.label}</option>`
  ).join('');

  const overlay = document.createElement('div');
  overlay.className = 'modal-bg';
  overlay.innerHTML = `<div class="modal">
    <div class="modal-title">Edit Block</div>
    <span class="lbl">Time</span>
    <select id="eb-time">${timeOpts}</select>
    <span class="lbl">Level / Label</span>
    <input id="eb-level" value="${esc(block.level || '')}">
    <span class="lbl">Primary Line</span>
    <input id="eb-disc" value="${esc(block.disc || '')}">
    <span class="lbl">Secondary Line</span>
    <input id="eb-disc2" value="${esc(block.disc2 || '')}">
    <span class="lbl">Type / Color</span>
    <select id="eb-type">${typeOpts}</select>
    <div class="modal-btns">
      <button class="modal-cancel" onclick="this.closest('.modal-bg').remove()">Cancel</button>
      <button class="modal-save" onclick="saveEdit('${blockId}',${di},this)">Save</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
}

function saveEdit(blockId, di, btn) {
  const block = sch().days[di].find(b => b.id === blockId);
  if (!block) { btn.closest('.modal-bg').remove(); return; }

  snapshot();
  block.time  = document.getElementById('eb-time').value;
  block.level = document.getElementById('eb-level').value.trim();
  block.disc  = document.getElementById('eb-disc').value.trim();
  block.disc2 = document.getElementById('eb-disc2').value.trim();
  block.type  = document.getElementById('eb-type').value;
  sortDay(di);
  btn.closest('.modal-bg').remove();
  renderFlyer();
  toast('Block saved', 'ok');
}

// ============================================================
// EXPORT PDF
// ============================================================

function exportPDF() {
  const s = sch();
  const rows = getRows(s);

  function bHTML(b) {
    if (b.type === 'noc') {
      return `<div class="cb noc"><div class="noc-text">NO<br>CLASSES</div></div>`;
    }
    const T = TYPES.find(t => t.id === b.type) || TYPES[0];
    return `<div class="cb ${T.cls}">
      <div class="cb-time"><i class="far fa-clock"></i>&nbsp;${esc(b.time)}</div>
      ${b.level ? `<div class="cb-level">${esc(b.level)}</div>` : ''}
      <div class="cb-disc">${esc(b.disc)}</div>
      ${b.disc2 ? `<div class="cb-disc2">${esc(b.disc2)}</div>` : ''}
    </div>`;
  }

  let bodyRows = '';
  rows.forEach((row, ri) => {
    const isNoc = !!row.noc;
    const bg = ri % 2 === 0 ? '#fff' : '#f5f5f5';
    const cells = DAYS.map((_, di) => {
      const matches = isNoc
        ? s.days[di].filter(b => b.type === 'noc')
        : s.days[di].filter(b => b.type !== 'noc' && b.time === row.time);
      return `<div class="day-cell">${matches.map(bHTML).join('')}</div>`;
    }).join('');
    bodyRows += `<div class="time-row" style="background:${bg}">${cells}</div>`;
  });

  const dayHdrs = DAYS.map(d => `<div class="day-hdr-cell">${d}</div>`).join('');

  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<title>${esc(s.stype)}</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
<link href="https://fonts.googleapis.com/css2?family=Russo+One&family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0;}
html,body{width:11in;height:8.5in;overflow:hidden;font-family:'Outfit',sans-serif;
  -webkit-print-color-adjust:exact;print-color-adjust:exact;}
.flyer{width:11in;height:8.5in;background:#fff;display:flex;flex-direction:column;overflow:hidden;
  outline:8px solid #fff;border-radius:6px;}
.flyer-header{background:#1e1e1e;padding:0 20px;display:flex;align-items:center;
  justify-content:space-between;height:62px;flex-shrink:0;}
.hdr-main{display:flex;align-items:center;flex:1;justify-content:center;}
.logo-img-wrap{height:42px;display:flex;align-items:center;margin-right:14px;}
.logo-img-wrap img{height:42px;width:auto;object-fit:contain;}
.logo-fallback{font-family:'Russo One',sans-serif;font-size:26px;color:#f0b429;
  letter-spacing:0.04em;line-height:1;display:none;align-items:center;gap:2px;}
.logo-circle{width:22px;height:22px;background:#f0b429;border-radius:50%;
  display:inline-flex;align-items:center;justify-content:center;}
.logo-circle i{font-size:10px;color:#1e1e1e;}
.hdr-loc{font-family:'Russo One',sans-serif;font-size:25px;color:#fff;
  text-transform:uppercase;letter-spacing:0.04em;margin-right:8px;white-space:nowrap;}
.hdr-type{font-family:'Russo One',sans-serif;font-size:25px;color:#f0b429;
  text-transform:uppercase;letter-spacing:0.04em;white-space:nowrap;}
.hdr-rev{font-family:'Outfit',sans-serif;font-size:10px;color:#888;text-align:right;
  line-height:1.4;text-transform:uppercase;letter-spacing:0.08em;flex-shrink:0;}
.hdr-rev strong{display:block;font-size:12px;color:#ccc;font-weight:600;}
.day-headers{display:grid;grid-template-columns:repeat(7,1fr);background:#f0b429;
  flex-shrink:0;height:34px;}
.day-hdr-cell{display:flex;align-items:center;justify-content:center;
  font-family:'Russo One',sans-serif;font-size:13px;letter-spacing:0.1em;
  text-transform:uppercase;color:#1e1e1e;border-right:1px solid rgba(0,0,0,0.12);}
.day-hdr-cell:last-child{border-right:none;}
.sched-body{flex:1;display:flex;flex-direction:column;overflow:hidden;min-height:0;}
.time-row{display:grid;grid-template-columns:repeat(7,1fr);border-bottom:1px solid #e8e8e8;
  flex:1;min-height:0;}
.time-row:last-child{border-bottom:none;}
.day-cell{border-right:1px solid #e0e0e0;padding:3px;display:flex;flex-direction:column;gap:2px;min-height:0;}
.day-cell:last-child{border-right:none;}
.cb{border-radius:7px;padding:5px 7px;display:flex;flex-direction:column;gap:1px;flex-shrink:0;}
.cb.noc{background:transparent;border-radius:0;padding:0;display:flex;
  align-items:center;justify-content:center;flex:1;}
.noc-text{font-family:'Outfit',sans-serif;font-weight:500;font-size:11px;color:#bbb;
  text-align:center;letter-spacing:0.06em;text-transform:uppercase;line-height:1.6;}
.cb-time{font-family:'Russo One',sans-serif;font-size:12px;display:flex;align-items:center;
  gap:4px;line-height:1.2;white-space:nowrap;}
.cb-time i{font-size:9px;}
.cb-level{font-size:10px;font-weight:400;line-height:1.3;font-family:'Outfit',sans-serif;}
.cb-disc{font-family:'Russo One',sans-serif;font-size:11px;line-height:1.25;}
.cb-disc2{font-family:'Outfit',sans-serif;font-size:10px;font-weight:400;line-height:1.2;opacity:0.85;}
.c-bjj{background:#ddeeff;}
.c-bjj .cb-time{color:#1a4a8a;}.c-bjj .cb-level{color:#3366aa;}
.c-bjj .cb-disc{color:#1a3a6a;}.c-bjj .cb-disc2{color:#2a5080;}
.c-mma{background:#ede8f8;}
.c-mma .cb-time{color:#5520aa;}.c-mma .cb-level{color:#6635bb;}
.c-mma .cb-disc{color:#441890;}.c-mma .cb-disc2{color:#5528a0;}
.c-striking{background:#fce8ec;}
.c-striking .cb-time{color:#c0163a;}.c-striking .cb-level{color:#cc2244;}
.c-striking .cb-disc{color:#a00e2e;}.c-striking .cb-disc2{color:#b01832;}
.c-youth{background:#e4f5e4;}
.c-youth .cb-time{color:#1a6a2a;}.c-youth .cb-level{color:#227832;}
.c-youth .cb-disc{color:#145520;}.c-youth .cb-disc2{color:#1c6228;}
.flyer-footer{background:#fff;border-top:1.5px solid #e0e0e0;padding:9px 20px;
  display:flex;align-items:center;justify-content:center;gap:26px;flex-shrink:0;height:42px;}
.ftr-item{display:flex;align-items:center;gap:6px;font-family:'Outfit',sans-serif;
  font-size:13px;font-weight:500;color:#222;letter-spacing:0.01em;}
.ftr-item i{color:#777;font-size:13px;}
@media print{@page{size:11in 8.5in landscape;margin:0;}html,body{width:11in;height:8.5in;}}
</style>
</head>
<body>
<div class="flyer">
  <div class="flyer-header">
    <div class="hdr-main">
      <div class="logo-img-wrap">
        <img src="stoutpgh-logo.png" alt="StoutPGH"
          onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
        <div class="logo-fallback">
          ST<span class="logo-circle"><i class="fas fa-circle-notch"></i></span>UT
          <span style="color:#f0b429">&nbsp;PGH</span>
        </div>
      </div>
      <span class="hdr-loc">${esc(s.location)}</span>
      <span class="hdr-type">&nbsp;${esc(s.stype)}</span>
    </div>
    <div class="hdr-rev">REVISION<br><strong>${esc(s.rev)}</strong></div>
  </div>
  <div class="day-headers">${dayHdrs}</div>
  <div class="sched-body">${bodyRows}</div>
  <div class="flyer-footer">
    <div class="ftr-item"><i class="fas fa-map-marker-alt"></i><span>${esc(s.addr)}</span></div>
    <div class="ftr-item"><i class="fas fa-phone-square"></i><span>${esc(s.phone)}</span></div>
    <div class="ftr-item"><i class="fas fa-globe"></i><span>${esc(s.web)}</span></div>
  </div>
</div>
<script>
window.addEventListener('load', function() {
  setTimeout(function() { window.print(); }, 800);
});
<\/script>
</body></html>`);
  win.document.close();
}

// ============================================================
// KEYBOARD SHORTCUTS
// ============================================================

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
    e.preventDefault();
    undo();
  }
  // Update isDuplicate live while key is held during drag
  if (drag && (e.altKey || e.metaKey)) {
    isDuplicate = true;
  }
});

document.addEventListener('keyup', (e) => {
  if (!e.altKey && !e.metaKey) isDuplicate = false;
});

// Close ctx on any click
document.addEventListener('click', hideCtx);

// ============================================================
// INIT
// ============================================================

function init() {
  initHistory();
  renderSidebar();
  renderFlyer();
  updatePill();
}

init();
