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
| Inspection · Overdue | Inspection date before today |
| Inspection · 7 / 30 / 90 days | Inspection due today through +N days (inclusive) |
| Registration · Overdue | Registration date before today |
| Registration · 7 / 30 / 90 days | Registration due today through +N days (inclusive) |

## Privacy

Your workbook is read only in this browser. Nothing is uploaded.
