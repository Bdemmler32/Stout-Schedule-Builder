# StoutPGH Schedule Builder

A standalone web app for building and exporting StoutPGH schedule flyers as Letter-size landscape PDFs.

---

## Getting Started

1. Open `index.html` in any modern browser (Chrome or Edge recommended for best PDF export).
2. No server or internet connection required after initial load — fonts and icons load from Google/Cloudflare CDN on first open.

---

## Logo

Place your logo file named **`stoutpgh-logo.png`** in the same folder as `index.html`.  
The header will automatically use it. If the file is missing, a text fallback is displayed.

---

## Saving Your Work

**This app stores nothing automatically.** There is no database, server, or localStorage used.

To save your schedule:
- Click **Save Schedule (.json)** in the sidebar footer.
- This downloads a `stoutpgh-schedule.json` file to your computer.
- Keep this file — it is your saved state.

To restore a saved schedule:
- Click **Load Schedule (.json)** and select your saved `.json` file.
- The editor will load all three schedule tabs from the file.

---

## Editing

### Modes
- **Edit Mode** — time ruler visible on the left, blocks are draggable, add/delete controls active.
- **Preview Mode** — exact 11" × 8.5" layout, no editing controls, ready to inspect before export.

### Adding Blocks
Use the **Add Block** form in the sidebar:
- Choose the day, time slot, level/label, primary discipline line, optional secondary line, and color type.
- Click **Add Block**.

### Editing a Block
- **Right-click** any block → Edit / Duplicate / Delete.
- Or click the **×** button that appears on hover.

### Moving Blocks
- **Drag** a block to a new day column or time row.
- Hold **Alt** (Windows/Linux) or **Option** (Mac) while dragging to **duplicate** instead of move.

### No Classes
- Select **No Classes** in the Type dropdown when adding a block.
- It appears as a "NO CLASSES" placeholder in the day column.

### Undo
- Click **Undo** in the sidebar, or press **Ctrl+Z** / **Cmd+Z**.
- Up to 100 steps of undo history per session.

---

## Exporting PDF

1. Switch to **Preview Mode** to confirm the layout looks correct.
2. Click **Export PDF (Letter Landscape)**.
3. A new tab opens showing the flyer.
4. Use your browser's **Print → Save as PDF** (set paper to Letter, landscape, no margins).

---

## File Structure

```
StoutPGH Schedule Builder/
├── index.html          ← Open this in your browser
├── styles.css          ← All visual styles
├── app.js              ← All application logic
├── stoutpgh-logo.png   ← Your logo (replace with actual file)
└── README.md           ← This file
```

---

## Browser Compatibility

Chrome or Edge are recommended for the most accurate PDF export via the system print dialog.  
Firefox works for editing but PDF color fidelity may vary.
