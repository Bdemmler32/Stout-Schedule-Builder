/* ============================================================
   StoutPGH Schedule Editor — app.js
   ============================================================ */
'use strict';

// ============================================================
// CONSTANTS
// ============================================================

const DAYS = ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];

// Full 6:00 AM – 10:00 PM in 30-min increments
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

const TYPES = [
  { id: 'bjj',      label: 'BJJ (Gi / No Gi)',  cls: 'c-bjj',      color: '#ddeeff' },
  { id: 'mma',      label: 'MMA',               cls: 'c-mma',      color: '#ede8f8' },
  { id: 'striking', label: 'Striking / Boxing', cls: 'c-striking', color: '#fce8ec' },
  { id: 'youth',    label: 'Youth BJJ',          cls: 'c-youth',    color: '#e4f5e4' },
  { id: 'noc',      label: 'No Classes',         cls: 'noc',        color: 'transparent' },
];

const LEVELS = ['All Levels','Fundamentals','Intermediate','Advanced','Competition','Open Mat','Ages 5-6','Ages 7-13',''];

// Edit mode: each time-row = SLOT_H * 2 px (one full hour).
// Ruler cells also use SLOT_H * 2 for time rows.
// NOC rows = SLOT_H px.
const SLOT_H = 68; // half-hour slot height in px

// ============================================================
// HELPERS
// ============================================================

function uid() { return Math.random().toString(36).slice(2, 9); }

function mkBlock(time, level, disc, disc2, type) {
  return { id: uid(), time, level: level||'', disc: disc||'', disc2: disc2||'', type };
}
function mkNoc() {
  return { id: uid(), time: null, level: '', disc: '', disc2: '', type: 'noc' };
}

function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function toast(msg, kind='') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast ${kind} show`;
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.className = 'toast'; }, 2400);
}

// ============================================================
// EMPTY SCHEDULE FACTORY (no pre-loaded data)
// ============================================================
const now = new Date();
const DEF_REV = `${now.getMonth()+1}/${now.getDate()}/${String(now.getFullYear()).slice(2)}`;

function makeEmptySchedules() {
  const base = {
    addr: '1 Racquet Lane | Monroeville, PA 15146',
    phone: '(412)-551-8119',
    web: 'www.StoutPGH.com',
  };
  return [
    { id:0, tab:'Adult BJJ',  location:'MONROEVILLE/EAST', stype:'ADULT BJJ SCHEDULE',      rev: DEF_REV, ...base, days: [[],[],[],[],[],[],[]] },
    { id:1, tab:'Striking',   location:'MONROEVILLE/EAST', stype:'ADULT STRIKING SCHEDULE', rev: DEF_REV, ...base, days: [[],[],[],[],[],[],[]] },
    { id:2, tab:'Youth BJJ',  location:'MONROEVILLE/EAST', stype:'YOUTH BJJ SCHEDULE',      rev: DEF_REV, ...base, days: [[],[],[],[],[],[],[]] },
  ];
}

// ============================================================
// STATE
// ============================================================

let schedules = makeEmptySchedules();
let activeTab = 0;
let mode = 'edit';

// Undo history
const HIST_MAX = 100;
let history = [];
let histIdx  = -1;

// Drag state
let drag        = null;
let ghostEl     = null;
let isDuplicate = false;

function sch() { return schedules[activeTab]; }

// ============================================================
// HISTORY
// ============================================================
function snapshot() {
  const snap = JSON.stringify(schedules);
  history = history.slice(0, histIdx + 1);
  history.push(snap);
  if (history.length > HIST_MAX) history.shift();
  histIdx = history.length - 1;
  updateUndoBtn();
}
function undo() {
  if (histIdx <= 0) return;
  histIdx--;
  schedules = JSON.parse(history[histIdx]);
  updateUndoBtn();
  renderSidebar();
  renderFlyer();
  toast('Undone','ok');
}
function updateUndoBtn() {
  const btn = document.getElementById('undoBtn');
  if (btn) btn.disabled = (histIdx <= 0);
}
function initHistory() {
  history = [JSON.stringify(schedules)];
  histIdx = 0;
  updateUndoBtn();
}

// ============================================================
// SAVE / LOAD DATA
// ============================================================
function saveData() {
  const blob = new Blob([JSON.stringify(schedules, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'stoutpgh-schedule.json';
  a.click();
  URL.revokeObjectURL(url);
  toast('Schedule saved','ok');
}

function loadData() {
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
        if (!Array.isArray(data) || !data[0]?.days) throw new Error('Invalid format');
        schedules = data;
        activeTab = 0;
        snapshot();
        renderSidebar();
        renderFlyer();
        toast('Schedule loaded','ok');
      } catch(err) {
        toast('Load failed: ' + err.message,'warn');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

// ============================================================
// ROW COMPUTATION
// getRows(s) → array of row descriptors, ordered noc-first then
// time ascending. Concurrent blocks (multiple blocks at the same
// time in any day) produce DUPLICATE rows, one per "slot index".
//
// Each entry is one of:
//   { noc: true }           — row for No-Classes blocks
//   { time: '9:00 AM', idx: 0 }  — 1st block slot at this time
//   { time: '9:00 AM', idx: 1 }  — 2nd block slot at same time
//
// In the cell renderer, day-cell at (time, idx) shows
// days[di].filter(time)[idx] — i.e. one block per row.
// The ruler shows the time label only on idx===0 rows.
// ============================================================
function getRows(s) {
  // For each unique time, find the max number of blocks across all days
  const timeCount = {}; // time → max concurrent count
  let hasNoc = false;

  s.days.forEach(day => {
    // Group non-noc blocks by time
    const byTime = {};
    day.forEach(b => {
      if (b.type === 'noc') { hasNoc = true; return; }
      if (!b.time) return;
      byTime[b.time] = (byTime[b.time] || 0) + 1;
    });
    Object.entries(byTime).forEach(([t, count]) => {
      timeCount[t] = Math.max(timeCount[t] || 0, count);
    });
  });

  const times = Object.keys(timeCount).sort((a,b) => toMins(a) - toMins(b));

  const rows = [];
  if (hasNoc) rows.push({ noc: true });
  times.forEach(t => {
    const n = timeCount[t];
    for (let idx = 0; idx < n; idx++) {
      rows.push({ time: t, idx });
    }
  });
  return rows;
}

// ============================================================
// SORT HELPER
// ============================================================
function sortDay(di) {
  sch().days[di].sort((a, b) => {
    // noc blocks go first (no time)
    if (a.type === 'noc' && b.type !== 'noc') return -1;
    if (a.type !== 'noc' && b.type === 'noc') return  1;
    return toMins(a.time) - toMins(b.time);
  });
}

// ============================================================
// RENDER SIDEBAR
// ============================================================
function renderSidebar() {
  document.getElementById('tabRow').innerHTML = schedules.map((s,i) =>
    `<button class="tab-btn ${i===activeTab?'active':''}" onclick="setTab(${i})">${esc(s.tab)}</button>`
  ).join('');

  const s = sch();
  const timeOpts = TIME_SLOTS.map(t => `<option value="${t}">${t}</option>`).join('');
  const typeOpts = TYPES.map(t => `<option value="${t.id}">${t.label}</option>`).join('');
  const dayOpts  = DAYS.map((d,i) => `<option value="${i}">${d}</option>`).join('');

  document.getElementById('sbBody').innerHTML = `
    <div class="mode-row">
      <button class="mode-btn ${mode==='edit'?'active':''}" onclick="setMode('edit')"><i class="fas fa-pen"></i> Edit</button>
      <button class="mode-btn ${mode==='preview'?'active':''}" onclick="setMode('preview')"><i class="fas fa-eye"></i> Preview</button>
    </div>
    <div class="action-row">
      <button class="action-btn" id="undoBtn" onclick="undo()" disabled><i class="fas fa-undo"></i> Undo</button>
    </div>

    <div class="field-group"><span class="lbl">Location</span>
      <input class="finput" value="${esc(s.location)}" oninput="sch().location=this.value;renderFlyer()"></div>
    <div class="field-group"><span class="lbl">Schedule Type</span>
      <input class="finput" value="${esc(s.stype)}" oninput="sch().stype=this.value;renderFlyer()"></div>
    <div class="field-group"><span class="lbl">Revision Date</span>
      <input class="finput" value="${esc(s.rev)}" oninput="sch().rev=this.value;renderFlyer()"></div>
    <hr class="hdiv">
    <div class="field-group"><span class="lbl">Address</span>
      <input class="finput" value="${esc(s.addr)}" oninput="sch().addr=this.value;renderFlyer()"></div>
    <div class="field-group"><span class="lbl">Phone</span>
      <input class="finput" value="${esc(s.phone)}" oninput="sch().phone=this.value;renderFlyer()"></div>
    <div class="field-group"><span class="lbl">Website</span>
      <input class="finput" value="${esc(s.web)}" oninput="sch().web=this.value;renderFlyer()"></div>
    <hr class="hdiv">
    <span class="lbl" id="add-form-title" style="margin-bottom:7px;display:block">Add Block</span>
    <div class="add-form" id="add-form-wrap">
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
      <button class="add-btn" id="add-form-btn" onclick="addBlock()"><i class="fas fa-plus"></i> Add Block</button>
      <button class="cancel-btn" id="cancel-edit-btn" onclick="cancelEdit()" style="display:none">✕ Cancel Edit</button>
    </div>`;
  updateUndoBtn();
}

// ============================================================
// RENDER FLYER
// ============================================================
function renderFlyer() {
  const s   = sch();
  const rows = getRows(s);
  const isPreview = (mode === 'preview');

  // Build schedule rows HTML
  let bodyHTML = '';
  rows.forEach((row, ri) => {
    const isNoc = !!row.noc;
    const bg    = ri % 2 === 0 ? '#fff' : '#f5f5f5';
    const rowH  = isNoc ? SLOT_H : SLOT_H * 2;
    const heightAttr = !isPreview ? `style="height:${rowH}px;background:${bg}"` : `style="background:${bg}"`;
    const rowCls = isNoc ? 'time-row noc-row' : 'time-row';

    let cells = '';
    DAYS.forEach((_, di) => {
      let matches;
      if (isNoc) {
        matches = s.days[di].filter(b => b.type === 'noc');
      } else {
        // All blocks at this time, sorted consistently; pick the one at row.idx
        const atTime = s.days[di].filter(b => b.type !== 'noc' && b.time === row.time);
        matches = atTime[row.idx] ? [atTime[row.idx]] : [];
      }

      const blocksHTML = matches.map(b => blockHTML(b, di, isPreview)).join('');
      // Add-here only on first concurrent row (idx===0) or noc, to avoid duplicate buttons
      const showAdd = !isPreview && (isNoc || row.idx === 0);
      const addBtn  = showAdd
        ? `<button class="add-here" onclick="quickAdd(${di},'${isNoc?'':row.time}')" title="Add here">+</button>`
        : '';
      const dropAttrs = !isPreview
        ? `ondragover="onDragOver(event)" ondragleave="onDragLeave(event)" ondrop="onDrop(event,${di},'${isNoc?'':row.time}')"`
        : '';

      cells += `<div class="day-cell" ${dropAttrs}>${blocksHTML}${addBtn}</div>`;
    });

    bodyHTML += `<div class="${rowCls}" ${heightAttr}>${cells}</div>`;
  });

  if (!bodyHTML) {
    bodyHTML = `<div style="padding:40px;text-align:center;color:#aaa;font-size:13px;font-family:'Outfit',sans-serif;grid-column:1/-1">
      Load a schedule file or add blocks using the panel.</div>`;
  }

  // Logo
  const logoHTML = `<div class="logo-img-wrap">
    <img src="stoutpgh-logo.png" alt="StoutPGH"
      onerror="this.style.display='none';document.getElementById('logoFb').style.display='block'">
    <span id="logoFb" class="logo-fallback">STOUTPGH</span>
  </div>`;

  const flyerHTML = `
    <div class="flyer ${isPreview?'preview-mode':'edit-mode'}" id="flyerEl" style="--slot-h:${SLOT_H}px">
      <div class="flyer-header">
        <div class="hdr-main">
          ${logoHTML}
          <span class="hdr-loc">${esc(s.location)}</span>
          <span class="hdr-type">&nbsp;${esc(s.stype)}</span>
        </div>
        <div class="hdr-rev">REVISION<br><strong>${esc(s.rev)}</strong></div>
      </div>
      <div class="day-headers">${DAYS.map(d=>`<div class="day-hdr-cell">${d}</div>`).join('')}</div>
      <div class="sched-body">${bodyHTML}</div>
      <div class="flyer-footer">
        <div class="ftr-item"><i class="fas fa-map-marker-alt"></i><span>${esc(s.addr)}</span></div>
        <div class="ftr-item"><i class="fas fa-phone-square"></i><span>${esc(s.phone)}</span></div>
        <div class="ftr-item"><i class="fas fa-globe"></i><span>${esc(s.web)}</span></div>
      </div>
    </div>`;

  if (isPreview) {
    document.getElementById('flyerWrap').innerHTML = flyerHTML;
  } else {
    // Build ruler — must mirror flyer structure exactly
    const rulerHTML = buildRuler(rows);
    document.getElementById('flyerWrap').innerHTML =
      `<div class="edit-wrap"><div class="time-ruler">${rulerHTML}</div>${flyerHTML}</div>`;
  }
}

// ── Ruler: mirrors .flyer-header(62) + .day-headers(34) + one cell per row ──
// Shows time label only on first row of each time group (idx===0 or noc).
function buildRuler(rows) {
  let html = `<div class="ruler-hdr-spacer"></div><div class="ruler-day-spacer">TIME</div>`;
  rows.forEach(row => {
    const isNoc  = !!row.noc;
    const h      = isNoc ? SLOT_H : SLOT_H * 2;
    const cls    = isNoc ? 'ruler-cell noc-cell' : 'ruler-cell';
    // Show label only on first row of this time (idx===0); continuation rows are blank
    const label  = isNoc ? '' : (row.idx === 0 ? row.time : '·');
    const dimmed = (!isNoc && row.idx > 0) ? ' style="color:#2a2a2a"' : '';
    html += `<div class="${cls}" style="height:${h}px"${dimmed}>${label}</div>`;
  });
  return html;
}

// ── Single block HTML ──
function blockHTML(b, di, isPreview) {
  if (b.type === 'noc') {
    const del = !isPreview
      ? `<button class="cb-del" onclick="delBlock(event,'${b.id}',${di})"><i class="fas fa-times"></i></button>`
      : '';
    return `<div class="cb noc" data-id="${b.id}">
      ${del}<div class="noc-text">NO<br>CLASSES</div>
    </div>`;
  }
  const T = TYPES.find(t => t.id === b.type) || TYPES[0];
  const draggable = !isPreview ? 'draggable="true"' : '';
  const evts = !isPreview
    ? `ondragstart="onDragStart(event,'${b.id}',${di})"
       ondragend="onDragEnd(event)"
       oncontextmenu="showCtx(event,'${b.id}',${di})"
       onclick="loadBlockToPanel('${b.id}',${di},event)"`
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

function cancelEdit() {
  clearEditingState();
  renderFlyer();
  // Reset form fields
  document.getElementById('nb-level').value = '';
  document.getElementById('nb-disc').value  = '';
  document.getElementById('nb-disc2').value = '';
  const cancelBtn = document.getElementById('cancel-edit-btn');
  if (cancelBtn) cancelBtn.style.display = 'none';
}

// ============================================================
// MODE / TAB
// ============================================================
function setMode(m) {
  editingBlockId = null;
  editingBlockDi = null;
  mode = m;
  updatePill();
  renderSidebar();
  renderFlyer();
}
function setTab(i) {
  editingBlockId = null;
  editingBlockDi = null;
  activeTab = i;
  renderSidebar();
  renderFlyer();
}
function updatePill() {
  const pill = document.getElementById('modePill');
  if (mode === 'edit') {
    pill.className = 'mode-pill edit';
    pill.innerHTML = '<i class="fas fa-pen"></i>&nbsp; Edit Mode — drag to move &nbsp;|&nbsp; Alt+drag to duplicate &nbsp;|&nbsp; Ctrl+Z to undo';
  } else {
    pill.className = 'mode-pill';
    pill.innerHTML = '<i class="fas fa-eye"></i>&nbsp; Preview — exact 11&Prime; × 8.5&Prime; print output';
  }
}

// ============================================================
// ADD / DELETE BLOCKS
// ============================================================
function addBlock() {
  const di    = +document.getElementById('nb-day').value;
  const time  =  document.getElementById('nb-time').value;
  const level =  document.getElementById('nb-level').value.trim();
  const disc  =  document.getElementById('nb-disc').value.trim() || 'Class';
  const disc2 =  document.getElementById('nb-disc2').value.trim();
  const type  =  document.getElementById('nb-type').value;

  // If we're editing an existing block, update it in place
  if (editingBlockId) {
    const block = sch().days[editingBlockDi].find(b => b.id === editingBlockId);
    if (block) {
      snapshot();
      // If day changed, move the block
      if (editingBlockDi !== di) {
        sch().days[editingBlockDi] = sch().days[editingBlockDi].filter(b => b.id !== editingBlockId);
        block.time  = time;
        block.level = level;
        block.disc  = disc;
        block.disc2 = disc2;
        block.type  = type;
        sch().days[di].push(block);
        sortDay(di);
      } else {
        block.time  = time;
        block.level = level;
        block.disc  = disc;
        block.disc2 = disc2;
        block.type  = type;
        sortDay(di);
      }
      clearEditingState();
      renderFlyer();
      toast('Block updated', 'ok');
      return;
    }
  }

  // Otherwise add a new block
  const block = (type === 'noc') ? mkNoc() : mkBlock(time, level, disc, disc2, type);
  snapshot();
  sch().days[di].push(block);
  sortDay(di);
  renderFlyer();
  toast('Block added', 'ok');
}

function quickAdd(di, time) {
  const dayEl  = document.getElementById('nb-day');
  const timeEl = document.getElementById('nb-time');
  if (dayEl)  dayEl.value  = di;
  if (timeEl && time) timeEl.value = time;
  document.getElementById('nb-disc')?.focus();
}

// Click a block in edit mode → pre-fill the sidebar form with its data.
// The form title changes to "Editing" and the button becomes "Save Changes".
// This edits the block in-place when submitted (no new block created).
let editingBlockId = null;
let editingBlockDi = null;

function loadBlockToPanel(blockId, di, e) {
  // Don't fire if the delete button was clicked
  if (e && e.target.closest('.cb-del')) return;

  const block = sch().days[di].find(b => b.id === blockId);
  if (!block || block.type === 'noc') return;

  editingBlockId = blockId;
  editingBlockDi = di;

  // Populate form fields
  const dayEl   = document.getElementById('nb-day');
  const timeEl  = document.getElementById('nb-time');
  const levelEl = document.getElementById('nb-level');
  const discEl  = document.getElementById('nb-disc');
  const disc2El = document.getElementById('nb-disc2');
  const typeEl  = document.getElementById('nb-type');
  if (!dayEl) return; // sidebar not rendered yet

  dayEl.value   = di;
  timeEl.value  = block.time;
  levelEl.value = block.level  || '';
  discEl.value  = block.disc   || '';
  disc2El.value = block.disc2  || '';
  typeEl.value  = block.type;

  // Update form title + button to reflect "edit" state
  const titleEl  = document.getElementById('add-form-title');
  const btnEl    = document.getElementById('add-form-btn');
  const cancelEl = document.getElementById('cancel-edit-btn');
  if (titleEl)  titleEl.textContent = 'Editing Block';
  if (btnEl)    { btnEl.innerHTML = '✓ Save Changes'; btnEl.style.background = '#2a7a2a'; }
  if (cancelEl) cancelEl.style.display = 'block';

  // Highlight all blocks, dim others, highlight this one
  document.querySelectorAll('.cb').forEach(el => el.style.opacity = '0.45');
  const target = document.querySelector(`.cb[data-id="${blockId}"]`);
  if (target) { target.style.opacity = '1'; target.style.outline = '2px solid #f0b429'; }

  // Scroll sidebar to the form
  const form = document.getElementById('add-form-wrap');
  if (form) form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  toast('Block loaded — edit and click Save Changes', 'ok');
}

function clearEditingState() {
  editingBlockId = null;
  editingBlockDi = null;
  // Reset all block highlights
  document.querySelectorAll('.cb').forEach(el => { el.style.opacity = ''; el.style.outline = ''; });
  const titleEl = document.getElementById('add-form-title');
  const btnEl   = document.getElementById('add-form-btn');
  if (titleEl) titleEl.textContent = 'Add Block';
  if (btnEl)   { btnEl.innerHTML = '<i class="fas fa-plus"></i> Add Block'; btnEl.style.background = ''; }
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
function dupBlock(blockId, di) {
  const orig = sch().days[di].find(b => b.id === blockId);
  if (!orig) return;
  const copy = { ...JSON.parse(JSON.stringify(orig)), id: uid() };
  snapshot();
  sch().days[di].push(copy);
  sortDay(di);
  renderFlyer();
  toast('Block duplicated','ok');
}

// ============================================================
// DRAG & DROP (edit mode only)
// ============================================================
function onDragStart(e, blockId, di) {
  if (mode !== 'edit') { e.preventDefault(); return; }
  isDuplicate = e.altKey || e.metaKey;
  drag = { blockId, fromDi: di };
  e.dataTransfer.effectAllowed = isDuplicate ? 'copy' : 'move';

  // Ghost
  const src = e.currentTarget;
  const g = src.cloneNode(true);
  g.className = 'cb drag-ghost-el ' + (TYPES.find(t => t.id === src.dataset.type)?.cls || '');
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
  e.preventDefault();
  e.dataTransfer.dropEffect = isDuplicate ? 'copy' : 'move';
  e.currentTarget.classList.add('droptgt');
}
function onDragLeave(e) { e.currentTarget.classList.remove('droptgt'); }
function onDrop(e, toDi, toTime) {
  e.preventDefault();
  e.currentTarget.classList.remove('droptgt');
  if (!drag || mode !== 'edit') return;
  const { blockId, fromDi } = drag;
  drag = null;

  const s = sch();
  const idx = s.days[fromDi].findIndex(b => b.id === blockId);
  if (idx === -1) return;

  snapshot();
  if (isDuplicate) {
    const copy = { ...JSON.parse(JSON.stringify(s.days[fromDi][idx])), id: uid() };
    if (toTime && copy.type !== 'noc') copy.time = toTime;
    s.days[toDi].push(copy);
    toast('Duplicated (Alt+drag)','ok');
  } else {
    const block = s.days[fromDi].splice(idx, 1)[0];
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
  e.preventDefault(); e.stopPropagation();
  const ctx = document.getElementById('ctxMenu');
  ctx.innerHTML = `
    <div class="ctx-item" onclick="openEditModal('${blockId}',${di});hideCtx()"><i class="fas fa-pen"></i> Edit</div>
    <div class="ctx-item ctx-sep" onclick="dupBlock('${blockId}',${di});hideCtx()"><i class="fas fa-copy"></i> Duplicate</div>
    <div class="ctx-item ctx-sep danger" onclick="delBlockById('${blockId}',${di});hideCtx()"><i class="fas fa-trash"></i> Delete</div>`;
  ctx.style.display = 'block';
  ctx.style.left = e.clientX + 'px';
  ctx.style.top  = e.clientY + 'px';
}
function hideCtx() { document.getElementById('ctxMenu').style.display = 'none'; }

// ============================================================
// EDIT MODAL
// ============================================================
function openEditModal(blockId, di) {
  const block = sch().days[di].find(b => b.id === blockId);
  if (!block || block.type === 'noc') return;

  const timeOpts = TIME_SLOTS.map(t =>
    `<option value="${t}" ${t===block.time?'selected':''}>${t}</option>`).join('');
  const typeOpts = TYPES.filter(t => t.id !== 'noc').map(t =>
    `<option value="${t.id}" ${t.id===block.type?'selected':''}>${t.label}</option>`).join('');

  const overlay = document.createElement('div');
  overlay.className = 'modal-bg';
  overlay.innerHTML = `<div class="modal">
    <div class="modal-title">Edit Block</div>
    <span class="lbl">Time</span><select id="eb-time">${timeOpts}</select>
    <span class="lbl">Level / Label</span><input id="eb-level" value="${esc(block.level||'')}">
    <span class="lbl">Primary Line</span><input id="eb-disc" value="${esc(block.disc||'')}">
    <span class="lbl">Secondary Line</span><input id="eb-disc2" value="${esc(block.disc2||'')}">
    <span class="lbl">Type / Color</span><select id="eb-type">${typeOpts}</select>
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
  toast('Saved','ok');
}

// ============================================================
// EXPORT PDF
// ============================================================
function exportPDF() {
  const s    = sch();
  const rows = getRows(s);

  function bHTML(b) {
    if (b.type === 'noc') return `<div class="cb noc"><div class="noc-text">NO<br>CLASSES</div></div>`;
    const T = TYPES.find(t => t.id === b.type) || TYPES[0];
    return `<div class="cb ${T.cls}">
      <div class="cb-inner">
        <div class="cb-time"><i class="far fa-clock"></i>&nbsp;${esc(b.time)}</div>
        ${b.level ? `<div class="cb-level">${esc(b.level)}</div>` : ''}
        <div class="cb-disc">${esc(b.disc)}</div>
        ${b.disc2 ? `<div class="cb-disc2">${esc(b.disc2)}</div>` : ''}
      </div>
    </div>`;
  }

  let bodyRows = '';
  rows.forEach((row, ri) => {
    const isNoc = !!row.noc;
    const bg    = ri % 2 === 0 ? '#fff' : '#f5f5f5';
    const cls   = isNoc ? 'time-row noc-row' : 'time-row';
    const cells = DAYS.map((_,di) => {
      const matches = isNoc
        ? s.days[di].filter(b => b.type === 'noc')
        : s.days[di].filter(b => b.type !== 'noc' && b.time === row.time);
      return `<div class="day-cell">${matches.map(bHTML).join('')}</div>`;
    }).join('');
    bodyRows += `<div class="${cls}" style="background:${bg}">${cells}</div>`;
  });

  const dayHdrs = DAYS.map(d => `<div class="day-hdr-cell">${d}</div>`).join('');

  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>${esc(s.stype)}</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
<link href="https://fonts.googleapis.com/css2?family=Russo+One&family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:11in;height:8.5in;overflow:hidden;font-family:'Outfit',sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.flyer{width:11in;height:8.5in;background:#fff;display:flex;flex-direction:column;overflow:hidden;outline:8px solid #fff;border-radius:6px}
.flyer-header{background:#1e1e1e;padding:0 20px;display:flex;align-items:center;justify-content:space-between;height:62px;flex-shrink:0}
.hdr-main{display:flex;align-items:center;flex:1;justify-content:center}
.logo-img-wrap{height:44px;display:flex;align-items:center;margin-right:16px}
.logo-img-wrap img{height:44px;width:auto;object-fit:contain}
.logo-fallback{font-family:'Russo One',sans-serif;font-size:22px;color:#f0b429;letter-spacing:0.06em;white-space:nowrap;display:none}
.hdr-loc{font-family:'Russo One',sans-serif;font-size:24px;color:#fff;text-transform:uppercase;letter-spacing:0.04em;margin-right:8px;white-space:nowrap}
.hdr-type{font-family:'Russo One',sans-serif;font-size:24px;color:#f0b429;text-transform:uppercase;letter-spacing:0.04em;white-space:nowrap}
.hdr-rev{font-family:'Outfit',sans-serif;font-size:10px;color:#888;text-align:right;line-height:1.5;text-transform:uppercase;letter-spacing:0.08em;flex-shrink:0}
.hdr-rev strong{display:block;font-size:12px;color:#ccc;font-weight:600}
.day-headers{display:grid;grid-template-columns:repeat(7,1fr);background:#f0b429;flex-shrink:0;height:34px}
.day-hdr-cell{display:flex;align-items:center;justify-content:center;font-family:'Russo One',sans-serif;font-size:13px;letter-spacing:0.1em;text-transform:uppercase;color:#1e1e1e;border-right:1px solid rgba(0,0,0,0.12)}
.day-hdr-cell:last-child{border-right:none}
.sched-body{flex:1;display:flex;flex-direction:column;overflow:hidden;min-height:0}
.time-row{display:grid;grid-template-columns:repeat(7,1fr);border-bottom:1px solid #e8e8e8;flex:1;min-height:0}
.time-row.noc-row{flex:0 0 auto;min-height:44px;max-height:70px}
.time-row:last-child{border-bottom:none}
.day-cell{border-right:1px solid #e0e0e0;padding:5px 4px;display:flex;flex-direction:row;flex-wrap:wrap;gap:3px;align-content:stretch;align-items:stretch;overflow:hidden;min-height:0}
.day-cell:last-child{border-right:none}
.cb{border-radius:8px;padding:6px 6px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;flex:1 1 0;min-width:0;align-self:stretch}
.cb.noc{background:transparent;border-radius:0;padding:0;display:flex;align-items:center;justify-content:center;flex:1 1 100%;align-self:stretch}
.noc-text{font-family:'Outfit',sans-serif;font-weight:500;font-size:11px;color:#bbb;text-align:center;letter-spacing:0.06em;text-transform:uppercase;line-height:1.6}
.cb-inner{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;width:100%}
.cb-time{font-family:'Russo One',sans-serif;font-size:13px;display:flex;align-items:center;justify-content:center;gap:4px;line-height:1.15;white-space:nowrap}
.cb-time i{font-size:10px}
.cb-level{font-size:11.5px;font-weight:400;line-height:1.3;font-family:'Outfit',sans-serif}
.cb-disc{font-family:'Outfit',sans-serif;font-size:13px;font-weight:600;line-height:1.25}
.cb-disc2{font-family:'Outfit',sans-serif;font-size:11.5px;font-weight:400;line-height:1.2;opacity:0.82}
.c-bjj{background:#ddeeff}.c-bjj .cb-time{color:#1a4a8a}.c-bjj .cb-level{color:#3366aa}.c-bjj .cb-disc{color:#1a3a6a}.c-bjj .cb-disc2{color:#2a5080}
.c-mma{background:#ede8f8}.c-mma .cb-time{color:#5520aa}.c-mma .cb-level{color:#6635bb}.c-mma .cb-disc{color:#441890}.c-mma .cb-disc2{color:#5528a0}
.c-striking{background:#fce8ec}.c-striking .cb-time{color:#c0163a}.c-striking .cb-level{color:#cc2244}.c-striking .cb-disc{color:#a00e2e}.c-striking .cb-disc2{color:#b01832}
.c-youth{background:#e4f5e4}.c-youth .cb-time{color:#1a6a2a}.c-youth .cb-level{color:#227832}.c-youth .cb-disc{color:#145520}.c-youth .cb-disc2{color:#1c6228}
.flyer-footer{background:#fff;border-top:1.5px solid #e0e0e0;padding:0 20px;display:flex;align-items:center;justify-content:center;gap:28px;flex-shrink:0;height:44px}
.ftr-item{display:flex;align-items:center;gap:6px;font-family:'Outfit',sans-serif;font-size:13px;font-weight:500;color:#222}
.ftr-item i{color:#777;font-size:13px}
@media print{@page{size:11in 8.5in landscape;margin:0}html,body{width:11in;height:8.5in}}
</style></head><body>
<div class="flyer">
  <div class="flyer-header">
    <div class="hdr-main">
      <div class="logo-img-wrap">
        <img src="stoutpgh-logo.png" alt="StoutPGH"
          onerror="this.style.display='none';document.getElementById('pdfLogoFb').style.display='block'">
        <span id="pdfLogoFb" class="logo-fallback">STOUTPGH</span>
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
<script>window.addEventListener('load',function(){setTimeout(function(){window.print();},800);})<\/script>
</body></html>`);
  win.document.close();
}

// ============================================================
// KEYBOARD SHORTCUTS
// ============================================================
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
  if (drag && (e.altKey || e.metaKey)) isDuplicate = true;
});
document.addEventListener('keyup', (e) => {
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
}
init();
