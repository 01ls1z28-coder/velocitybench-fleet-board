# Dashboard — how to use (Fleet)

1. Open `index.html` in Chrome or Edge (best for live Refresh).
2. Click **Open file** and choose your fleet workbook (`.xlsx` / `.xls` / `.csv`).
3. Match columns if prompted (Unit#, Reg.Exp, 90-day inspection, etc.).
4. Use KPI cards or the status dropdown to filter the queue and table.
5. **Refresh** / **Auto-check** re-read the same file when the browser has a live file handle.

## KPI cards = filter lists

Each card count uses the **same rule** as its filter:

| Card | Rule |
|------|------|
| Units | All rows |
| 90-day overdue | Inspection date before today |
| Due in 7 days | Inspection due today through +7 days (inclusive) |
| Due in 30 days | Inspection due today through +30 days (inclusive) |

7-day units are also counted in 30-day (overlapping horizons). Overdue is separate.

## Privacy

Your workbook is read only in this browser. Nothing is uploaded.
