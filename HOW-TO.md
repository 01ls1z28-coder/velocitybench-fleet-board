# Dashboard — how to use (Fleet)

1. Open `index.html` in Chrome or Edge (best for live Refresh).
2. Click **Open file** and choose your fleet workbook (`.xlsx` / `.xls` / `.csv`).
3. Match columns if prompted (Unit#, Reg.Exp, 90-day inspection, etc.).
4. Use KPI cards or the status dropdown to filter the queue and table.
5. **Refresh** / **Auto-check** re-read the same file when the browser has a live file handle.

## KPI cards = filter lists

Each card count uses the **same rule** as its filter. Future horizons overlap (7 ⊂ 30 ⊂ 90). Overdue is separate.

| Card | Rule |
|------|------|
| Units | All rows |
| Needs attention | Unique units with inspection overdue OR registration overdue |
| Fleet OK | Has at least one parsed insp/reg date and neither overdue (disjoint from Needs attention and No dates) |
| No dates | Both mapped inspection and registration dates missing/unparseable (typical non-vehicle equipment) |
| Inspection - Overdue | Inspection date before today |
| Inspection - 7 / 30 / 60 / 90 days | Inspection due today through +N days (inclusive) |
| Registration - Overdue | Registration date before today |
| Registration - 7 / 30 / 60 / 90 days | Registration due today through +N days (inclusive) |

## Privacy

Your workbook is read only in this browser. Nothing is uploaded.

## Customize layout

Click **Customize** (next to Refresh) to show or hide KPI cards, table columns, and the due queue. Units / Needs attention / Fleet OK / No dates form the top slot row (drag/swap within that row; Needs attention, Fleet OK, and No dates are optional toggles, default on). Units = Needs attention + Fleet OK + No dates. Inspection and Registration each have their own horizontal slot row under Units (with dividers); drag/swap only within the same row. Use **Theme** (near Customize or inside the panel) to pick Dark, Brass trim, Midnight, Graphite, Forest, Ocean, Ember, Copper, Plum, High contrast, or Soft light. Choices (including row slots + theme) save on this browser with your view under `dashboard-fleet-view-v1:`. **Reset to defaults** restores Dark theme, full layout, and default card order.

