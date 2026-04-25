/* ============================================================
   StoutPGH Schedule Builder — app.js
   ============================================================ */
'use strict';

// ============================================================
// CONSTANTS
// ============================================================
const DAYS = ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];

// Half-hour slots 6:00 AM – 10:00 PM
const TIME_SLOTS = (() => {
  const s = [];
  for (let h = 6; h <= 22; h++) {
    s.push(fmtTime(h, 0));
    if (h < 22) s.push(fmtTime(h, 30));
  }
  return s;
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

// FIX #1: 'noc' is now just another block type with a real time.
// It renders as a grey "NO CLASSES" card in the timeline row for that time,
// exactly like any other block. No special row, no null time.
const TYPES = [
  { id: 'bjj',       label: 'BJJ (Gi / No Gi)',   cls: 'c-bjj',       color: '#ddeeff' },
  { id: 'mma',       label: 'MMA',                cls: 'c-mma',       color: '#ede8f8' },
  { id: 'striking',  label: 'Striking / Boxing',  cls: 'c-striking',  color: '#fce8ec' },
  { id: 'youth',     label: 'Youth BJJ',           cls: 'c-youth',     color: '#e4f5e4' },
  { id: 'selfdef',   label: 'Self Defense',        cls: 'c-selfdef',   color: '#fffbe6' },
  { id: 'noc',       label: 'No Classes',          cls: 'c-noc',       color: '#f0f0f0' },
];

// Each time-row in edit mode = SLOT_H * 2 px (one full hour block).
const SLOT_H = 68;

// localStorage key
const LS_KEY = 'stoutpgh_schedules';

// ============================================================
// HELPERS
// ============================================================
function uid() { return Math.random().toString(36).slice(2, 9); }

// All blocks (including noc) have a time now.
function mkBlock(time, level, disc, disc2, type) {
  return { id: uid(), time: time || TIME_SLOTS[0], level: level||'', disc: disc||'', disc2: disc2||'', type };
}

function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function toast(msg, kind='') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast ${kind} show`;
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.className = 'toast'; }, 2600);
}

// ============================================================
// EMPTY SCHEDULE FACTORY
// FIX #4: location, stype, addr, phone start blank (placeholder only).
//         rev and web auto-populate.
// ============================================================
const now = new Date();
const DEF_REV = `${now.getMonth()+1}/${now.getDate()}/${String(now.getFullYear()).slice(2)}`;

function makeEmptySchedules() {
  return [
    { id:0, tab:'Adult BJJ',  location:'', stype:'', rev:DEF_REV, addr:'', phone:'', web:'www.StoutPGH.com', days:[[],[],[],[],[],[],[]] },
    { id:1, tab:'Striking',   location:'', stype:'', rev:DEF_REV, addr:'', phone:'', web:'www.StoutPGH.com', days:[[],[],[],[],[],[],[]] },
    { id:2, tab:'Youth BJJ',  location:'', stype:'', rev:DEF_REV, addr:'', phone:'', web:'www.StoutPGH.com', days:[[],[],[],[],[],[],[]] },
  ];
}

// ============================================================
// STATE
// ============================================================
let schedules   = loadFromStorage() || makeEmptySchedules();
let activeTab   = 0;
let mode        = 'edit';

const HIST_MAX  = 100;
let history     = [];
let histIdx     = -1;

let drag        = null;
let ghostEl     = null;
let isDuplicate = false;

// Canvas zoom (visual only — does not affect PDF export)
let zoomLevel   = 1.0;
const ZOOM_MIN  = 0.4;
const ZOOM_MAX  = 1.0;
const ZOOM_STEP = 0.1;

// No longer needed — block editing now uses the modal
// editingBlockId / editingBlockDi removed

function sch() { return schedules[activeTab]; }

// ============================================================
// LOCAL STORAGE  (FIX #3)
// ============================================================
function saveToStorage() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(schedules)); } catch(e) {}
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!Array.isArray(data) || !data[0]?.days) return null;
    // Migrate any legacy noc blocks that have null time
    data.forEach(s => s.days.forEach(day => day.forEach(b => {
      if (b.type === 'noc' && !b.time) b.time = TIME_SLOTS[0];
    })));
    return data;
  } catch(e) { return null; }
}

// ============================================================
// HISTORY / UNDO
// ============================================================
function snapshot() {
  const snap = JSON.stringify(schedules);
  history = history.slice(0, histIdx + 1);
  history.push(snap);
  if (history.length > HIST_MAX) history.shift();
  histIdx = history.length - 1;
  updateUndoBtn();
  saveToStorage(); // persist every change
}

function undo() {
  if (histIdx <= 0) return;
  histIdx--;
  schedules = JSON.parse(history[histIdx]);
  saveToStorage();
  updateUndoBtn();
  renderSidebar();
  renderFlyer();
  toast('Undone', 'ok');
}

function updateUndoBtn() {
  const btn = document.getElementById('undoBtn');
  if (btn) btn.disabled = (histIdx <= 0);
}

// ============================================================
// ZOOM
// ============================================================
function zoomIn() {
  zoomLevel = Math.min(ZOOM_MAX, +(zoomLevel + ZOOM_STEP).toFixed(1));
  applyZoom();
}
function zoomOut() {
  zoomLevel = Math.max(ZOOM_MIN, +(zoomLevel - ZOOM_STEP).toFixed(1));
  applyZoom();
}
function applyZoom() {
  const wrap = document.getElementById('zoomWrap');
  if (!wrap) return;
  wrap.style.transform       = `scale(${zoomLevel})`;
  wrap.style.transformOrigin = 'top center';
  // Adjust the outer flyerWrap height so the canvas-area doesn't leave dead space
  // when zoomed out. zoomWrap still occupies its natural size in layout,
  // so we set flyerWrap height to the scaled visual height.
  const flyerWrap = document.getElementById('flyerWrap');
  if (flyerWrap) {
    const naturalH = wrap.scrollHeight || wrap.offsetHeight;
    flyerWrap.style.height  = Math.round(naturalH * zoomLevel) + 'px';
    flyerWrap.style.overflow = 'visible';
  }
  // Update zoom % label
  const lbl = document.getElementById('zoomLbl');
  if (lbl) lbl.textContent = Math.round(zoomLevel * 100) + '%';
  // Update button disabled states
  const btnIn  = document.getElementById('zoomInBtn');
  const btnOut = document.getElementById('zoomOutBtn');
  if (btnIn)  btnIn.disabled  = zoomLevel >= ZOOM_MAX;
  if (btnOut) btnOut.disabled = zoomLevel <= ZOOM_MIN;
}

function initHistory() {
  history = [JSON.stringify(schedules)];
  histIdx = 0;
  updateUndoBtn();
}

// ============================================================
// SAVE / LOAD DATA FILES
// ============================================================
function saveData() {
  const blob = new Blob([JSON.stringify(schedules, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'stoutpgh-schedule.json'; a.click();
  URL.revokeObjectURL(url);
  toast('Schedule saved', 'ok');
}

function loadData() {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.json,application/json';
  input.onchange = e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!Array.isArray(data) || !data[0]?.days) throw new Error('Invalid format');
        // Migrate legacy noc blocks
        data.forEach(s => s.days.forEach(day => day.forEach(b => {
          if (b.type === 'noc' && !b.time) b.time = TIME_SLOTS[0];
        })));
        schedules = data;
        activeTab = 0;
        snapshot();
        renderSidebar();
        renderFlyer();
        toast('Schedule loaded', 'ok');
      } catch(err) { toast('Load failed: ' + err.message, 'warn'); }
    };
    reader.readAsText(file);
  };
  input.click();
}

// ============================================================
// ROW COMPUTATION  (FIX #1)
// All blocks (including noc) have a real time and go in the
// normal timeline. One row per unique time, with duplicate rows
// for concurrent blocks (same time, multiple blocks in a day).
// NO special noc-row logic.
// ============================================================
function getRows(s) {
  const timeCount = {}; // time → max concurrent block count across all days

  s.days.forEach(day => {
    const byTime = {};
    day.forEach(b => {
      if (!b.time) return;
      byTime[b.time] = (byTime[b.time] || 0) + 1;
    });
    Object.entries(byTime).forEach(([t, count]) => {
      timeCount[t] = Math.max(timeCount[t] || 0, count);
    });
  });

  const times = Object.keys(timeCount).sort((a,b) => toMins(a) - toMins(b));
  const rows = [];
  times.forEach(t => {
    const n = timeCount[t];
    for (let idx = 0; idx < n; idx++) {
      rows.push({ time: t, idx });
    }
  });
  return rows;
}

// ============================================================
// SORT
// ============================================================
function sortDay(di) {
  sch().days[di].sort((a, b) => toMins(a.time) - toMins(b.time));
}

// ============================================================
// RENDER SIDEBAR
// ============================================================
function renderSidebar() {
  document.getElementById('tabRow').innerHTML = schedules.map((s,i) =>
    `<button class="tab-btn ${i===activeTab?'active':''}" onclick="setTab(${i})">${esc(s.tab)}</button>`
  ).join('');

  const s = sch();

  document.getElementById('sbBody').innerHTML = `
    <div class="mode-row">
      <button class="mode-btn ${mode==='edit'?'active':''}"    onclick="setMode('edit')"><i class="fas fa-pen"></i> Edit</button>
      <button class="mode-btn ${mode==='preview'?'active':''}" onclick="setMode('preview')"><i class="fas fa-eye"></i> Preview</button>
    </div>
    <div class="action-row">
      <button class="action-btn" id="undoBtn" onclick="undo()" disabled><i class="fas fa-undo"></i> Undo</button>
    </div>
    <div class="zoom-row">
      <button class="zoom-btn" id="zoomOutBtn" onclick="zoomOut()" title="Zoom out"><i class="fas fa-minus"></i></button>
      <span class="zoom-lbl" id="zoomLbl">100%</span>
      <button class="zoom-btn" id="zoomInBtn"  onclick="zoomIn()"  title="Zoom in"  disabled><i class="fas fa-plus"></i></button>
    </div>

    <hr class="hdiv">
    <div class="field-group"><span class="lbl">Location</span>
      <input class="finput" value="${esc(s.location)}" placeholder="e.g. MONROEVILLE/EAST"
        oninput="sch().location=this.value;saveToStorage();renderFlyer()"></div>
    <div class="field-group"><span class="lbl">Schedule Type</span>
      <input class="finput" value="${esc(s.stype)}" placeholder="e.g. ADULT BJJ SCHEDULE"
        oninput="sch().stype=this.value;saveToStorage();renderFlyer()"></div>
    <div class="field-group"><span class="lbl">Revision Date</span>
      <input class="finput" value="${esc(s.rev)}"
        oninput="sch().rev=this.value;saveToStorage();renderFlyer()"></div>
    <hr class="hdiv">
    <div class="field-group"><span class="lbl">Address</span>
      <input class="finput" value="${esc(s.addr)}" placeholder="e.g. 1 Racquet Lane | Monroeville, PA"
        oninput="sch().addr=this.value;saveToStorage();renderFlyer()"></div>
    <div class="field-group"><span class="lbl">Phone</span>
      <input class="finput" value="${esc(s.phone)}" placeholder="e.g. (412)-551-8119"
        oninput="sch().phone=this.value;saveToStorage();renderFlyer()"></div>
    <div class="field-group"><span class="lbl">Website</span>
      <input class="finput" value="${esc(s.web)}" placeholder="e.g. www.StoutPGH.com"
        oninput="sch().web=this.value;saveToStorage();renderFlyer()"></div>
    <hr class="hdiv">
    <button class="open-modal-btn ${mode==='preview' ? 'disabled' : ''}"
      onclick="${mode==='preview' ? "toast('Switch to Edit Mode to add blocks','warn')" : 'openModal()'}">
      <i class="fas fa-plus"></i> Add Block
    </button>`;
  updateUndoBtn();
}

// ============================================================
// RENDER FLYER
// ============================================================
function renderFlyer() {
  const s        = sch();
  const rows     = getRows(s);
  const isPreview = (mode === 'preview');

  let bodyHTML = '';

  rows.forEach((row, ri) => {
    const bg       = ri % 2 === 0 ? '#fff' : '#f5f5f5';
    const rowH     = SLOT_H * 2;
    const hAttr    = !isPreview ? `style="height:${rowH}px;background:${bg}"` : `style="background:${bg}"`;

    let cells = '';
    DAYS.forEach((_, di) => {
      // All blocks at this time for this day
      const atTime = s.days[di].filter(b => b.time === row.time);
      // Pick the block at this row's slot index
      let match = atTime[row.idx];

      // FIX: If this slot is empty but the day has a NOC block at this time,
      // show the NOC block in every concurrent row — it represents the full timeslot.
      if (!match) {
        const nocs = atTime.filter(b => b.type === 'noc');
        if (nocs.length > 0) match = nocs[0];
      }

      const blockH = match ? blockHTML(match, di, isPreview) : '';

      // Add-here button only on idx===0 to avoid duplicates
      const addBtn = (!isPreview && row.idx === 0)
        ? `<button class="add-here" onclick="openModal({di:${di},time:'${row.time}'})">+</button>`
        : '';
      const dropA  = !isPreview
        ? `ondragover="onDragOver(event)" ondragleave="onDragLeave(event)" ondrop="onDrop(event,${di},'${row.time}')"`
        : '';

      cells += `<div class="day-cell" ${dropA}>${blockH}${addBtn}</div>`;
    });

    bodyHTML += `<div class="time-row" ${hAttr}>${cells}</div>`;
  });

  if (!bodyHTML) {
    bodyHTML = `<div style="padding:40px;text-align:center;color:#aaa;font-size:13px;
      font-family:'Outfit',sans-serif;grid-column:1/-1">
      Load a schedule file or add blocks using the panel.</div>`;
  }

  const logoHTML = `<div class="logo-img-wrap">
    <img src="stoutpgh-logo.png" alt="StoutPGH"
      onerror="this.style.display='none';document.getElementById('logoFb').style.display='block'">
    <span id="logoFb" class="logo-fallback">STOUTPGH</span>
  </div>`;

  const flyerHTML = `
    <div class="flyer ${isPreview?'preview-mode':'edit-mode'}" id="flyerEl">
      <div class="flyer-header">
        <div class="hdr-main">
          ${logoHTML}
          <span class="hdr-loc">${esc(s.location)}</span>
          <span class="hdr-type">${s.location && s.stype ? '&nbsp;' : ''}${esc(s.stype)}</span>
        </div>
        <div class="hdr-rev">REVISION<br><strong>${esc(s.rev)}</strong></div>
      </div>
      <div class="day-headers">${DAYS.map(d=>`<div class="day-hdr-cell">${d}</div>`).join('')}</div>
      <div class="sched-body" id="schedBody">${bodyHTML}</div>
      <div class="flyer-footer">
        <div class="ftr-item"><i class="fas fa-map-marker-alt"></i><span>${esc(s.addr)}</span></div>
        <div class="ftr-item"><i class="fas fa-phone-square"></i><span>${esc(s.phone)}</span></div>
        <div class="ftr-item"><i class="fas fa-globe"></i><span>${esc(s.web)}</span></div>
      </div>
    </div>`;

  if (isPreview) {
    document.getElementById('flyerWrap').innerHTML =
      `<div id="zoomWrap">${flyerHTML}</div>`;
  } else {
    document.getElementById('flyerWrap').innerHTML =
      `<div id="zoomWrap"><div class="edit-wrap"><div class="time-ruler" id="timeRuler">${buildRuler(rows)}</div>${flyerHTML}</div></div>`;
  }
  // Re-apply zoom after re-render (zoomWrap gets recreated each time)
  requestAnimationFrame(applyZoom);
}

// ── Ruler ──
function buildRuler(rows) {
  let html = `<div class="ruler-hdr-spacer"></div><div class="ruler-day-spacer">TIME</div>`;
  rows.forEach(row => {
    const h     = SLOT_H * 2;
    const label = row.idx === 0 ? row.time : '·';
    const dim   = row.idx > 0 ? ' style="color:#2e2e2e"' : '';
    html += `<div class="ruler-cell" style="height:${h}px"${dim}>${label}</div>`;
  });
  return html;
}

// ── Single block HTML ──
function blockHTML(b, di, isPreview) {
  const T = TYPES.find(t => t.id === b.type) || TYPES[0];

  if (b.type === 'noc') {
    const del = !isPreview
      ? `<button class="cb-del" onclick="delBlock(event,'${b.id}',${di})"><i class="fas fa-times"></i></button>`
      : '';
    const editEvts = !isPreview
      ? `onclick="openModal({blockId:'${b.id}',di:${di}})"
         oncontextmenu="showCtx(event,'${b.id}',${di})"`
      : '';
    return `<div class="cb c-noc" data-id="${b.id}" ${editEvts}>
      ${del}
      <div class="cb-inner"><div class="noc-text">NO<br>CLASSES</div></div>
    </div>`;
  }

  const draggable = !isPreview ? 'draggable="true"' : '';
  const evts = !isPreview
    ? `ondragstart="onDragStart(event,'${b.id}',${di})"
       ondragend="onDragEnd(event)"
       oncontextmenu="showCtx(event,'${b.id}',${di})"
       onclick="openModal({blockId:'${b.id}',di:${di}})"`
    : '';
  const del = !isPreview
    ? `<button class="cb-del" onclick="delBlock(event,'${b.id}',${di})"><i class="fas fa-times"></i></button>`
    : '';

  return `<div class="cb ${T.cls}" ${draggable} ${evts} data-id="${b.id}">
    ${del}
    <div class="cb-inner">
      <div class="cb-time"><i class="far fa-clock"></i>&nbsp;${esc(b.time)}</div>
      ${b.level ? `<div class="cb-level">${esc(b.level)}</div>` : ''}
      <div class="cb-disc">${esc(b.disc)}</div>
      ${b.disc2 ? `<div class="cb-disc2">${esc(b.disc2)}</div>` : ''}
    </div>
  </div>`;
}

// ============================================================
// MODE / TAB
// ============================================================
function setMode(m) {
  closeModal();
  mode = m;
  updatePill(); renderSidebar(); renderFlyer();
}
function setTab(i) {
  closeModal();
  activeTab = i;
  renderSidebar(); renderFlyer();
}
function updatePill() {
  const pill = document.getElementById('modePill');
  if (mode === 'edit') {
    pill.className = 'mode-pill edit';
    pill.innerHTML = '<i class="fas fa-pen"></i>&nbsp; Edit Mode — click block to edit &nbsp;|&nbsp; drag to move &nbsp;|&nbsp; Alt+drag to duplicate &nbsp;|&nbsp; Ctrl+Z to undo';
  } else {
    pill.className = 'mode-pill';
    pill.innerHTML = '<i class="fas fa-eye"></i>&nbsp; Preview — exact 11&Prime; &times; 8.5&Prime; print output';
  }
}

// ============================================================
// MODAL — handles both Add and Edit
// openModal()                → blank Add form
// openModal({di, time})      → Add pre-filled to day/time
// openModal({blockId, di})   → Edit existing block
// ============================================================

// Track what the modal is editing (null = adding new)
let _modalBlockId = null;
let _modalDi      = null;

function openModal(opts = {}) {
  if (mode !== 'edit') return;

  const { blockId = null, di = 0, time = null } = opts;
  _modalBlockId = blockId;
  _modalDi      = blockId ? di : null; // for editing

  const isEdit  = !!blockId;
  const block   = isEdit ? sch().days[di].find(b => b.id === blockId) : null;

  // Build option lists
  const timeOpts = TIME_SLOTS.map(t =>
    `<option value="${t}" ${(block?.time || time || TIME_SLOTS[0]) === t ? 'selected' : ''}>${t}</option>`
  ).join('');
  const dayOpts = DAYS.map((d, i) =>
    `<option value="${i}" ${(block ? di : di) === i ? 'selected' : ''}>${d}</option>`
  ).join('');
  const typeOpts = TYPES.map(t =>
    `<option value="${t.id}" ${(block?.type || 'bjj') === t.id ? 'selected' : ''}>${t.label}</option>`
  ).join('');

  // Color strip based on current type
  const currentType = block?.type || 'bjj';
  const T = TYPES.find(t => t.id === currentType) || TYPES[0];

  const overlay = document.getElementById('blockModal');
  overlay.innerHTML = `
    <div class="bm-dialog" role="dialog" aria-modal="true">
      <div class="bm-header" id="bmHeader" style="background:${T.color}">
        <div class="bm-title">${isEdit ? 'Edit Block' : 'Add Block'}</div>
        <button class="bm-close" onclick="closeModal()" title="Close">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="bm-body">
        <div class="bm-row bm-row-2">
          <div class="bm-field">
            <label class="bm-lbl">Day</label>
            <select class="bm-select" id="bm-day">${dayOpts}</select>
          </div>
          <div class="bm-field">
            <label class="bm-lbl">Time</label>
            <select class="bm-select" id="bm-time">${timeOpts}</select>
          </div>
        </div>
        <div class="bm-field">
          <label class="bm-lbl">Type / Color</label>
          <select class="bm-select bm-type-select" id="bm-type" onchange="updateModalHeader(this.value)">${typeOpts}</select>
        </div>
        <div class="bm-field" id="bm-field-level">
          <label class="bm-lbl">Level / Label <span class="bm-opt">optional</span></label>
          <input class="bm-input" id="bm-level" placeholder="e.g. Fundamentals" value="${esc(block?.level || '')}">
        </div>
        <div class="bm-field" id="bm-field-disc">
          <label class="bm-lbl">Primary Line</label>
          <input class="bm-input" id="bm-disc" placeholder="e.g. Gi - Adult BJJ" value="${esc(block?.disc || '')}">
        </div>
        <div class="bm-field" id="bm-field-disc2">
          <label class="bm-lbl">Secondary Line <span class="bm-opt">optional</span></label>
          <input class="bm-input" id="bm-disc2" placeholder="e.g. Adult MMA" value="${esc(block?.disc2 || '')}">
        </div>
      </div>
      <div class="bm-footer">
        ${isEdit ? `<button class="bm-btn-danger" onclick="modalDelete('${blockId}',${di})"><i class="fas fa-trash"></i> Delete</button>` : '<div></div>'}
        <div class="bm-footer-right">
          <button class="bm-btn-cancel" onclick="closeModal()">Cancel</button>
          <button class="bm-btn-save"   onclick="modalSave(${di})">${isEdit ? 'Save Changes' : 'Add Block'}</button>
        </div>
      </div>
    </div>`;

  overlay.classList.add('open');
  // Focus first meaningful field
  setTimeout(() => {
    const firstInput = overlay.querySelector(block?.type === 'noc' ? '#bm-day' : '#bm-disc');
    firstInput?.focus();
    // Hide primary/secondary for noc type
    toggleNocFields(block?.type || 'bjj');
  }, 50);
}

function updateModalHeader(typeId) {
  const T = TYPES.find(t => t.id === typeId) || TYPES[0];
  const hdr = document.getElementById('bmHeader');
  if (hdr) hdr.style.background = T.color;
  toggleNocFields(typeId);
}

function toggleNocFields(typeId) {
  // For No Classes blocks, hide primary/secondary/level — just need day/time/type
  const hide = typeId === 'noc';
  ['bm-field-level','bm-field-disc','bm-field-disc2'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = hide ? 'none' : '';
  });
}

function closeModal() {
  const overlay = document.getElementById('blockModal');
  overlay.classList.remove('open');
  _modalBlockId = null;
  _modalDi      = null;
}

function handleModalBackdrop(e) {
  // Close only if clicking the dark overlay itself, not the dialog inside it
  if (e.target === document.getElementById('blockModal')) closeModal();
}

function modalSave(defaultDi) {
  const di    = +document.getElementById('bm-day').value;
  const time  =  document.getElementById('bm-time').value;
  const type  =  document.getElementById('bm-type').value;
  const level =  document.getElementById('bm-level')?.value.trim() || '';
  const disc  =  document.getElementById('bm-disc')?.value.trim()  || '';
  const disc2 =  document.getElementById('bm-disc2')?.value.trim() || '';

  if (_modalBlockId) {
    // Edit existing
    const srcDi = _modalDi;
    const block = sch().days[srcDi].find(b => b.id === _modalBlockId);
    if (block) {
      snapshot();
      if (srcDi !== di) {
        sch().days[srcDi] = sch().days[srcDi].filter(b => b.id !== _modalBlockId);
        block.time = time; block.level = level; block.disc = disc; block.disc2 = disc2; block.type = type;
        sch().days[di].push(block);
        sortDay(di);
      } else {
        block.time = time; block.level = level; block.disc = disc; block.disc2 = disc2; block.type = type;
        sortDay(di);
      }
      closeModal();
      renderFlyer();
      toast('Block updated', 'ok');
      return;
    }
  }

  // Add new
  snapshot();
  sch().days[di].push(mkBlock(time, level, disc, disc2, type));
  sortDay(di);
  closeModal();
  renderFlyer();
  toast('Block added', 'ok');
}

function modalDelete(blockId, di) {
  snapshot();
  sch().days[di] = sch().days[di].filter(b => b.id !== blockId);
  closeModal();
  renderFlyer();
  toast('Block deleted', '');
}

// ============================================================
// DELETE / DUPLICATE (non-modal paths)
// ============================================================
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
function dupBlock(blockId, di) {
  const orig = sch().days[di].find(b => b.id === blockId);
  if (!orig) return;
  snapshot();
  sch().days[di].push({ ...JSON.parse(JSON.stringify(orig)), id: uid() });
  sortDay(di);
  renderFlyer();
  toast('Block duplicated', 'ok');
}

// ============================================================
// DRAG & DROP (edit mode only)
// ============================================================
function onDragStart(e, blockId, di) {
  if (mode !== 'edit') { e.preventDefault(); return; }
  isDuplicate = e.altKey || e.metaKey;
  drag = { blockId, fromDi: di };
  e.dataTransfer.effectAllowed = isDuplicate ? 'copy' : 'move';

  const src = e.currentTarget;
  const g   = src.cloneNode(true);
  g.className = 'cb drag-ghost-el ' + src.className.replace('cb','').trim();
  g.style.cssText = `width:${src.offsetWidth}px;position:fixed;top:-9999px;left:-9999px;`;
  g.querySelector('.cb-del')?.remove();
  document.body.appendChild(g);
  ghostEl = g;
  e.dataTransfer.setDragImage(g, e.offsetX, e.offsetY);
  requestAnimationFrame(() => src.classList.add('dragging'));
}
function onDragEnd(e) {
  e.currentTarget.classList.remove('dragging');
  ghostEl?.remove(); ghostEl = null;
  document.querySelectorAll('.droptgt').forEach(el => el.classList.remove('droptgt'));
  drag = null;
}
function onDragOver(e) {
  if (!drag || mode !== 'edit') return;
  e.preventDefault(); e.dataTransfer.dropEffect = isDuplicate ? 'copy' : 'move';
  e.currentTarget.classList.add('droptgt');
}
function onDragLeave(e) { e.currentTarget.classList.remove('droptgt'); }
function onDrop(e, toDi, toTime) {
  e.preventDefault();
  e.currentTarget.classList.remove('droptgt');
  if (!drag || mode !== 'edit') return;
  const { blockId, fromDi } = drag; drag = null;
  const s   = sch();
  const idx = s.days[fromDi].findIndex(b => b.id === blockId);
  if (idx === -1) return;
  snapshot();
  if (isDuplicate) {
    const copy = { ...JSON.parse(JSON.stringify(s.days[fromDi][idx])), id: uid() };
    copy.time = toTime;
    s.days[toDi].push(copy);
    toast('Duplicated (Alt+drag)', 'ok');
  } else {
    const block = s.days[fromDi].splice(idx, 1)[0];
    block.time = toTime;
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
  e.preventDefault(); e.stopPropagation();
  const ctx = document.getElementById('ctxMenu');
  ctx.innerHTML = `
    <div class="ctx-item" onclick="openModal({blockId:'${blockId}',di:${di}});hideCtx()"><i class="fas fa-pen"></i> Edit</div>
    <div class="ctx-item ctx-sep" onclick="dupBlock('${blockId}',${di});hideCtx()"><i class="fas fa-copy"></i> Duplicate</div>
    <div class="ctx-item ctx-sep danger" onclick="delBlockById('${blockId}',${di});hideCtx()"><i class="fas fa-trash"></i> Delete</div>`;
  ctx.style.display = 'block';
  ctx.style.left = e.clientX + 'px';
  ctx.style.top  = e.clientY + 'px';
}
function hideCtx() { document.getElementById('ctxMenu').style.display = 'none'; }

// ============================================================
// EXPORT PDF  (FIX #2)
// Uses html2canvas + jsPDF to render the live DOM element
// directly to a PDF file download — no print dialog needed.
// The white border/outline IS captured because we render the
// outer wrapper div that includes it.
// ============================================================
// ============================================================
// PDF NAMING HELPERS
// ============================================================

// Map schedule type string → short label for filename
function shortType(stype) {
  const t = (stype || '').toUpperCase();
  if (t.includes('BJJ') && t.includes('YOUTH')) return 'Youth';
  if (t.includes('YOUTH'))       return 'Youth';
  if (t.includes('STRIKING'))    return 'Striking';
  if (t.includes('SELF'))        return 'SelfDefense';
  if (t.includes('BJJ'))         return 'BJJ';
  if (t.includes('MMA'))         return 'MMA';
  return (stype || 'Schedule').split(' ')[0];
}

// Normalise location for filename: swap / → -, collapse spaces
function cleanLocation(loc) {
  return (loc || 'StoutPGH')
    .replace(/\//g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// Parse revision "M/D/YY" or "MM/DD/YYYY" → "MMDDYYYY"
function revToDateStr(rev) {
  if (!rev) {
    const d = new Date();
    return String(d.getMonth()+1).padStart(2,'0')
         + String(d.getDate()).padStart(2,'0')
         + String(d.getFullYear());
  }
  const parts = rev.split('/');
  if (parts.length !== 3) return rev.replace(/\//g,'');
  const [m, d, y] = parts;
  const year = y.length === 2 ? '20' + y : y;
  return m.padStart(2,'0') + d.padStart(2,'0') + year;
}

// Build filename for a single schedule
function buildFilename(s) {
  return `StoutPGH-${shortType(s.stype)}-${cleanLocation(s.location)}-${revToDateStr(s.rev)}.pdf`;
}

// Build filename for the all-schedules export (use first schedule's rev date)
function buildAllFilename() {
  const rev = schedules[0]?.rev || '';
  return `StoutPGH-All-Schedules-${revToDateStr(rev)}.pdf`;
}

// ============================================================
// CAPTURE a single schedule as a canvas
// Temporarily renders that schedule's flyer in preview mode,
// captures it, then restores state.
// ============================================================
async function captureSchedule(tabIndex) {
  const prevTab  = activeTab;
  const prevMode = mode;

  activeTab = tabIndex;
  mode      = 'preview';
  renderFlyer();
  await new Promise(r => setTimeout(r, 150)); // let layout + fonts settle

  const flyer = document.getElementById('flyerEl');
  const canvas = await html2canvas(flyer, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
    logging: false,
  });

  // Restore
  activeTab = prevTab;
  mode      = prevMode;
  renderFlyer();
  updatePill();
  renderSidebar();

  return canvas;
}

// ============================================================
// EXPORT CURRENT PAGE
// Naming: StoutPGH-BJJ-MONROEVILLE-EAST-04242026.pdf
// ============================================================
async function exportPDF() {
  const prevMode = mode;
  if (mode !== 'preview') {
    mode = 'preview';
    renderFlyer();
    updatePill();
    renderSidebar();
    await new Promise(r => setTimeout(r, 150));
  }

  const flyer = document.getElementById('flyerEl');
  if (!flyer) { toast('No flyer to export', 'warn'); return; }

  toast('Generating PDF…', '');

  try {
    const canvas = await html2canvas(flyer, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
    });

    const { jsPDF } = window.jspdf;
    const pdf  = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const ratio = Math.min(pageW / canvas.width, pageH / canvas.height);
    const drawW = canvas.width  * ratio;
    const drawH = canvas.height * ratio;
    const offX  = (pageW - drawW) / 2;
    const offY  = (pageH - drawH) / 2;

    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', offX, offY, drawW, drawH);
    pdf.save(buildFilename(sch()));
    toast('PDF downloaded!', 'ok');
  } catch(err) {
    console.error(err);
    toast('Export failed: ' + err.message, 'warn');
  }

  if (prevMode !== 'preview') {
    mode = prevMode;
    renderFlyer(); updatePill(); renderSidebar();
  }
}

// ============================================================
// EXPORT ALL (3 pages, one per schedule tab)
// Naming: StoutPGH-All-Schedules-04242026.pdf
// ============================================================
async function exportAllPDF() {
  toast('Generating all pages…', '');

  try {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();

    for (let i = 0; i < schedules.length; i++) {
      if (i > 0) pdf.addPage();

      const canvas = await captureSchedule(i);
      const ratio  = Math.min(pageW / canvas.width, pageH / canvas.height);
      const drawW  = canvas.width  * ratio;
      const drawH  = canvas.height * ratio;
      const offX   = (pageW - drawW) / 2;
      const offY   = (pageH - drawH) / 2;

      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', offX, offY, drawW, drawH);
    }

    pdf.save(buildAllFilename());
    toast('All schedules exported!', 'ok');
  } catch(err) {
    console.error(err);
    toast('Export failed: ' + err.message, 'warn');
  }
}

// ============================================================
// KEYBOARD SHORTCUTS
// ============================================================
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
  if (e.key === 'Escape') closeModal();
  if (drag && (e.altKey || e.metaKey)) isDuplicate = true;
});
document.addEventListener('keyup', e => {
  if (!e.altKey && !e.metaKey) isDuplicate = false;
});
document.addEventListener('click', hideCtx);

// ============================================================
// INIT
// ============================================================
function init() {
  initHistory();
  renderSidebar();
  renderFlyer();
  updatePill();
  // zoom label initialised by renderSidebar + applyZoom inside renderFlyer
}
init();
