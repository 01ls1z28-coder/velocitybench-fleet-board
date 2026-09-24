# Dashboard — how to use

## Quick start

1. Open the page (**Chrome or Edge recommended**).
2. Click **Choose file** (or drop a workbook on the drop zone).
3. Open **any** `.xlsx` / `.xls` / `.csv` on this computer — or practice with `sample-fleet.xlsx` / `sample-orders.xlsx`.
4. The **generic** dashboard appears by default: sheet picker, auto KPIs from your header row, searchable/sortable table.

## Header actions

When a board is open, actions live in the top header strip (same row as **D / Dashboard**). There is no hamburger menu.

- **Open another file** — start over with a different workbook
- **Choose export copy** — pick a Save As / export copy when Excel has the live file locked
- **Columns** (generic) — show/hide columns
- **Match columns** (fleet) — open the fleet field mapper
- **Use Fleet layout** / **Use generic layout** — switch layouts (Fleet button only when fleet-like headers are detected)
- **Export view CSV** — download the currently filtered rows and visible columns only

Refresh and Auto-check stay in the file bar under the workbook name.

On narrow screens the button row wraps or scrolls — actions are never hidden behind a menu.

## Any workbook (generic layout — default)

- Row 1 (first non-empty row) becomes the column headers.
- Column types are inferred: `number`, `date`, `text`, or `category` (low-cardinality text).
- Auto KPIs: row count; sum / avg / min / max for up to ~4 strongest numeric columns; overdue / due-soon for date columns; top value chips for categories.
- **Click a KPI or category chip** to filter the table (click again to clear; multi-select chips where natural). The Rows KPI clears filters.
- **Date horizons:** each detected date column gets Overdue / Next 7d / Next 30d / All quick filters.
- Click a column header to sort. Use **Columns** in the header to show/hide fields.
- **Export view CSV** downloads only what you currently see (filtered rows × visible columns).
- No invented business labels — only types and stats from the cells.

## Fleet layout (optional preset)

If headers look like Unit# / Reg.Exp / 90-day inspection, a banner offers **Use Fleet layout**.

- That restores the fleet UX: column mapper, 90-day queue, status filters, unit drawer.
- Default stays **generic** until you accept (choice remembered in `localStorage`).
- Switch anytime from the header: **Use Fleet layout** / **Use generic layout**.
- Click a KPI card to filter the queue and table to that bucket (overdue / 7d / 30d / all units). Click again to clear.

## Remember last workbook + view

On return (same browser):

- If a File System Access handle can be restored, the workbook reopens automatically.
- Otherwise a gentle banner asks you to choose the previous file again.
- Per workbook (fingerprint: file name + size + lastModified), Dashboard restores layout mode (generic|fleet), sheet, column visibility, sort, and active filters. All local — never uploaded.

## Refresh (Chrome / Edge)

Dashboard uses the File System Access API when available:

- After you pick a file, the page keeps a **file handle**.
- **Refresh** re-reads the same path via `handle.getFile()` → SheetJS parse → redraw.
- After you **Save** in Excel, click Refresh (or wait for Auto-check) to pull the new data.
- The handle is stored in IndexedDB when the browser allows, so a later visit can ask permission again without re-browsing the folder.

**Auto-check** (default ON): while the tab is visible, the page polls `file.lastModified` about every 4 seconds. If the workbook changed on disk, it reloads and shows a brief “Updated — refreshed” toast. Polling pauses when the tab is hidden.

## Safari / Firefox (no live handle)

These browsers do not keep a reusable file handle the same way. Refresh must **re-choose** the workbook (picker or drop). The yellow banner explains: *This browser can’t keep a live file handle — choose the workbook again.*

## Excel lock (Windows)

If Excel has the `.xlsx` open, reading it can fail. Dashboard shows a red **Workbook locked** banner:

1. **Retry** after closing the file in Excel (preferred — live workbook).
2. Or **Choose export copy**: Save As / export CSV or XLSX elsewhere and open that copy so you are not fighting the lock.

## Column mapper (fleet preset only)

Expected fields: Unit#, Year, MAKE/MODEL, license#, Vehicle ID#, Reg.Exp, 90 day (insp. Due), Driver, Notes.

Aliases auto-guess; your map is saved in `localStorage` under `fleetboard-map-v3`. Use **Match columns** from the header to remap.

## Privacy

Data stays in this browser (IndexedDB / localStorage). The workbook is never uploaded.
