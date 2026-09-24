# Fleet Board — how to use

## Quick start

1. Open the page (Chrome or Edge recommended).
2. Click **Choose file** (or drop a workbook on the drop zone).
3. Use `sample-fleet.xlsx` to practice, or open the real fleet workbook on this computer.
4. Confirm column mapping if needed, then **Show dashboard**.

## Refresh (Chrome / Edge)

Fleet Board uses the File System Access API when available:

- After you pick a file, the page keeps a **file handle**.
- **Refresh** re-reads the same path via `handle.getFile()` → SheetJS parse → redraw.
- The handle is stored in IndexedDB when the browser allows, so a later visit can ask permission again without re-browsing the folder.

**Auto-check** (default ON): while the tab is visible, the page polls `file.lastModified` about every 4 seconds. If the workbook changed on disk, it reloads and shows a brief “Updated — refreshed” toast. Polling pauses when the tab is hidden.

## Safari / Firefox (no live handle)

These browsers do not keep a reusable file handle the same way. Refresh must **re-choose** the workbook (picker or drop). The yellow banner explains: *This browser can’t keep a live file handle — choose the workbook again.*

## Excel lock (Windows)

If Excel has the `.xlsx` open, reading it can fail. Fleet Board shows a red **Workbook locked** banner:

1. **Retry** after closing the file in Excel (preferred — live workbook).
2. Or **Choose export copy**: Save As / export CSV or XLSX elsewhere and open that copy so you are not fighting the lock.

## Column mapper

Expected fields: Unit#, Year, MAKE/MODEL, license#, Vehicle ID#, Reg.Exp, 90 day (insp. Due), Driver, Notes.

Aliases auto-guess; your map is saved in `localStorage` under `fleetboard-map-v3`. Use **Match columns** from the menu or toolbar to remap.

## Privacy

Data stays in this browser. The workbook is never uploaded.
