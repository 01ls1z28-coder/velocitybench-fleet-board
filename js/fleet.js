/* Fleet layout preset - v1 KPIs / queue / drawer / mapper + Phase 3 click-to-filter */
(function (global) {
  "use strict";

  const FIELDS = [
    { key: "id", label: "Unit#", aliases: ["unit#", "unit #", "unit no", "unit number", "unit"] },
    { key: "year", label: "Year", aliases: ["year"] },
    { key: "make", label: "MAKE/MODEL", aliases: ["make/model", "make model", "make", "model", "description"] },
    { key: "plate", label: "license#", aliases: ["license#", "license #", "license", "plate", "tag"] },
    { key: "vid", label: "Vehicle ID#", aliases: ["vehicle id#", "vehicle id", "veh id", "vin"] },
    { key: "reg", label: "Reg.Exp", aliases: ["reg.exp", "reg exp", "registration", "reg"] },
    { key: "insp", label: "90 day (insp. Due)", aliases: ["90 day", "insp", "inspection", "90 day insp"] },
    { key: "driver", label: "Driver", aliases: ["driver", "assigned", "operator"] },
    { key: "notes", label: "Notes", aliases: ["notes", "note", "comments"] }
  ];
  const MAP_KEY = "fleetboard-map-v3";
  const VIEW_KEY_PREFIX = "dashboard-fleet-view-v1:";

  const $ = (id) => document.getElementById(id);

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  }
  function escapeAttr(s) {
    return escapeHtml(s);
  }
  function norm(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function headerMatchesAlias(h, aliases) {
    const n = norm(h);
    return aliases.some((a) => {
      if (n === a) return true;
      if (a.length <= 3) return false;
      return n.includes(a);
    });
  }

  function looksLikeFleet(headers) {
    if (!headers || !headers.length) return false;
    let hits = 0;
    const needed = [
      ["unit#", "unit #", "unit no", "unit number", "unit"],
      ["reg exp", "reg.exp", "registration", "reg"],
      ["90 day", "insp", "inspection", "90 day insp"]
    ];
    needed.forEach((group) => {
      if (headers.some((h) => headerMatchesAlias(h, group))) hits += 1;
    });
    return hits >= 2;
  }

  function csvEscape(v) {
    const s = v == null ? "" : String(v);
    if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function create(api) {
    const KPI_IDS = [
      "fleet",
      "insp-overdue",
      "insp-week",
      "insp-30",
      "insp-60",
      "insp-90",
      "reg-overdue",
      "reg-week",
      "reg-30",
      "reg-60",
      "reg-90"
    ];
    /* Units (fleet) is fixed on top; kpiSlots persists horizon card boxes. */
    const REORDERABLE_KPI_IDS = KPI_IDS.filter((id) => id !== "fleet");
    const DEFAULT_KPI_ORDER = REORDERABLE_KPI_IDS.slice();
    const THEME_IDS = [
      "dark",
      "dark-brass",
      "midnight",
      "graphite",
      "forest",
      "ocean",
      "ember",
      "copper",
      "plum",
      "high-contrast",
      "soft-light"
    ];
    const DEFAULT_THEME = "dark";
    const INSP_KPI_IDS = [
      "insp-overdue",
      "insp-week",
      "insp-30",
      "insp-60",
      "insp-90"
    ];
    const REG_KPI_IDS = [
      "reg-overdue",
      "reg-week",
      "reg-30",
      "reg-60",
      "reg-90"
    ];

    function defaultLayout() {
      const kpis = {};
      KPI_IDS.forEach((id) => {
        kpis[id] = true;
      });
      kpis.fleet = true; /* Units always shown */
      return {
        kpis: kpis,
        groups: { inspection: true, registration: true },
        columns: {},
        showQueue: true,
        kpiSlots: defaultKpiSlots(),
        theme: DEFAULT_THEME
      };
    }

    function normalizeTheme(theme) {
      if (typeof theme === "string" && THEME_IDS.indexOf(theme) >= 0) return theme;
      return DEFAULT_THEME;
    }

    function applyTheme(theme) {
      const id = normalizeTheme(theme);
      state.layout.theme = id;
      try {
        document.documentElement.setAttribute("data-theme", id);
      } catch (_) { /* ignore */ }
      const sel = $("themeSelect");
      if (sel && sel.value !== id) sel.value = id;
      const panel = $("layoutPanel");
      if (panel) {
        panel.querySelectorAll('input[name="layoutTheme"]').forEach((inp) => {
          inp.checked = inp.value === id;
          const lab = inp.closest(".theme-option");
          if (lab) lab.classList.toggle("active", inp.value === id);
        });
      }
    }

    function normalizeKpiOrder(order) {
      /* Packed visible order helper (legacy + Reset packing). */
      const seen = new Set();
      const out = [];
      if (Array.isArray(order)) {
        order.forEach((id) => {
          if (id === "fleet") return;
          if (REORDERABLE_KPI_IDS.indexOf(id) >= 0 && !seen.has(id)) {
            seen.add(id);
            out.push(id);
          }
        });
      }
      DEFAULT_KPI_ORDER.forEach((id) => {
        if (!seen.has(id)) {
          seen.add(id);
          out.push(id);
        }
      });
      return out;
    }

    const KPI_SLOT_COUNT = REORDERABLE_KPI_IDS.length;

    function defaultKpiSlots() {
      /* Default: packed default order into fixed slots (no empties). */
      return DEFAULT_KPI_ORDER.slice();
    }

    function normalizeKpiSlots(slots, legacyOrder) {
      /* Fixed-length slot map: kpiId or null. Allows empty slots; no auto-repack. */
      const n = KPI_SLOT_COUNT;
      const out = [];
      for (let i = 0; i < n; i++) out.push(null);
      const seen = new Set();

      function tryPlace(id, prefer) {
        if (!id || id === "fleet") return;
        if (REORDERABLE_KPI_IDS.indexOf(id) < 0) return;
        if (seen.has(id)) return;
        let idx = typeof prefer === "number" ? prefer : -1;
        if (idx < 0 || idx >= n || out[idx] != null) {
          idx = out.indexOf(null);
        }
        if (idx < 0) return;
        out[idx] = id;
        seen.add(id);
      }

      if (Array.isArray(slots)) {
        slots.forEach((id, i) => {
          if (id == null || id === "" || id === "empty") return;
          tryPlace(id, i < n ? i : -1);
        });
      } else if (Array.isArray(legacyOrder)) {
        legacyOrder.forEach((id) => tryPlace(id, -1));
      } else {
        DEFAULT_KPI_ORDER.forEach((id) => tryPlace(id, -1));
      }
      return out;
    }

    function syncSlotsWithVisibility() {
      /* Hidden cards free their slot (stable grid; empties stay). Newly shown
         cards take the first empty slot so toggling back prefers the same box
         when nothing else claimed it. */
      const slots = normalizeKpiSlots(state.layout.kpiSlots);
      REORDERABLE_KPI_IDS.forEach((id) => {
        const idx = slots.indexOf(id);
        if (!isKpiVisible(id)) {
          if (idx >= 0) slots[idx] = null;
        } else if (idx < 0) {
          const empty = slots.indexOf(null);
          if (empty >= 0) slots[empty] = id;
        }
      });
      state.layout.kpiSlots = slots;
      return slots;
    }

    function placeCardInSlot(dragId, targetSlotIndex) {
      if (!dragId || dragId === "fleet") return false;
      const slots = normalizeKpiSlots(state.layout.kpiSlots);
      const from = slots.indexOf(dragId);
      if (from < 0) return false;
      const to = targetSlotIndex | 0;
      if (to < 0 || to >= slots.length) return false;
      if (from === to) return false;
      const other = slots[to]; /* null = empty; else swap */
      slots[to] = dragId;
      slots[from] = other;
      state.layout.kpiSlots = slots;
      persistView();
      buildBoard();
      return true;
    }

    const state = {
      map: {},
      filter: "",
      search: "",
      selected: -1,
      sortKey: null,
      sortDir: "asc",
      layout: defaultLayout()
    };

    function headers() {
      return api.getHeaders();
    }
    function rows() {
      return api.getRows();
    }

    function val(row, key) {
      return state.map[key] ? row[state.map[key]] : "";
    }

    /* Workbook columns for table/export: all non-blank headers in file order.
       Duplicate header names collide on row object keys (last write wins at parse);
       display keeps first occurrence only to match usable keys. */
    function tableColumns() {
      const seen = new Set();
      const cols = [];
      headers().forEach((h) => {
        const name = String(h == null ? "" : h).trim();
        if (!name) return;
        if (seen.has(name)) return;
        seen.add(name);
        cols.push(name);
      });
      return cols;
    }

    function fieldKeyForHeader(headerName) {
      const keys = Object.keys(state.map);
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        if (state.map[k] === headerName) return k;
      }
      return null;
    }

    function parseDate(v) {
      if (!v) return null;
      if (v instanceof Date && !isNaN(v)) return v;
      const d = new Date(String(v));
      return isNaN(d) ? null : d;
    }

    function daysUntil(d) {
      const a = new Date();
      a.setHours(0, 0, 0, 0);
      const b = new Date(d);
      b.setHours(0, 0, 0, 0);
      return Math.round((b - a) / 86400000);
    }

    function inspInfo(row) {
      const d = parseDate(val(row, "insp"));
      return d ? { date: d, n: daysUntil(d) } : null;
    }

    function regInfo(row) {
      const d = parseDate(val(row, "reg"));
      return d ? { date: d, n: daysUntil(d) } : null;
    }

    function tone(n) {
      return n < 0 ? "bad" : n <= 7 ? "warn" : n <= 30 ? "warn" : "good";
    }

    function daysLabel(n) {
      if (n < 0) return `${-n} days overdue`;
      if (n === 0) return "Due today";
      if (n === 1) return "Due tomorrow";
      return `${n} days left`;
    }

    function viewKey() {
      const fp = api.getFingerprint ? api.getFingerprint() : "";
      return fp ? VIEW_KEY_PREFIX + fp : null;
    }

    function persistView() {
      const key = viewKey();
      if (!key) return;
      try {
        localStorage.setItem(
          key,
          JSON.stringify({
            layoutMode: "fleet",
            sheet: api.getSheet ? api.getSheet() : "",
            filter: state.filter,
            search: state.search,
            sortKey: state.sortKey,
            sortDir: state.sortDir,
            layout: {
              kpis: Object.assign({}, state.layout.kpis),
              groups: Object.assign({}, state.layout.groups),
              columns: Object.assign({}, state.layout.columns),
              showQueue: !!state.layout.showQueue,
              kpiSlots: normalizeKpiSlots(state.layout.kpiSlots),
              theme: normalizeTheme(state.layout.theme)
            }
          })
        );
      } catch (_) { /* ignore */ }
    }

    function applySavedLayout(savedLayout) {
      const base = defaultLayout();
      if (!savedLayout || typeof savedLayout !== "object") {
        state.layout = base;
        return;
      }
      if (savedLayout.kpis && typeof savedLayout.kpis === "object") {
        KPI_IDS.forEach((id) => {
          if (typeof savedLayout.kpis[id] === "boolean") {
            base.kpis[id] = savedLayout.kpis[id];
          }
        });
      }
      if (savedLayout.groups && typeof savedLayout.groups === "object") {
        if (typeof savedLayout.groups.inspection === "boolean") {
          base.groups.inspection = savedLayout.groups.inspection;
        }
        if (typeof savedLayout.groups.registration === "boolean") {
          base.groups.registration = savedLayout.groups.registration;
        }
      }
      if (savedLayout.columns && typeof savedLayout.columns === "object") {
        Object.keys(savedLayout.columns).forEach((h) => {
          if (typeof savedLayout.columns[h] === "boolean") {
            base.columns[h] = savedLayout.columns[h];
          }
        });
      }
      if (typeof savedLayout.showQueue === "boolean") {
        base.showQueue = savedLayout.showQueue;
      }
      if (Array.isArray(savedLayout.kpiSlots)) {
        base.kpiSlots = normalizeKpiSlots(savedLayout.kpiSlots);
      } else if (Array.isArray(savedLayout.kpiOrder)) {
        /* Migrate legacy packed kpiOrder into fixed slots. */
        base.kpiSlots = normalizeKpiSlots(null, savedLayout.kpiOrder);
      } else {
        base.kpiSlots = defaultKpiSlots();
      }
      base.theme = normalizeTheme(savedLayout.theme);
      base.kpis.fleet = true; /* Units always on top */
      state.layout = base;
    }

    function restoreView() {
      const key = viewKey();
      if (!key) return;
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return;
        const saved = JSON.parse(raw);
        if (typeof saved.filter === "string") state.filter = saved.filter;
        if (typeof saved.search === "string") {
          state.search = saved.search;
          if ($("search")) $("search").value = state.search;
        }
        if (typeof saved.sortKey === "string" && saved.sortKey) {
          state.sortKey = saved.sortKey;
        } else {
          state.sortKey = null;
        }
        if (saved.sortDir === "desc" || saved.sortDir === "asc") {
          state.sortDir = saved.sortDir;
        } else {
          state.sortDir = "asc";
        }
        applySavedLayout(saved.layout);
        applyTheme(state.layout.theme);
        if ($("statusFilter")) $("statusFilter").value = state.filter;
      } catch (_) { /* ignore */ }
    }

    function isKpiVisible(id) {
      if (id === "fleet") return true; /* Units always visible */
      if (!state.layout.kpis[id]) return false;
      if (INSP_KPI_IDS.indexOf(id) >= 0 && !state.layout.groups.inspection) return false;
      if (REG_KPI_IDS.indexOf(id) >= 0 && !state.layout.groups.registration) return false;
      return true;
    }

    function isColumnVisible(headerName) {
      if (Object.prototype.hasOwnProperty.call(state.layout.columns, headerName)) {
        return !!state.layout.columns[headerName];
      }
      return true;
    }

    function visibleTableColumns() {
      const cols = tableColumns().filter(isColumnVisible);
      if (cols.length) return cols;
      const all = tableColumns();
      return all.length ? [all[0]] : [];
    }

    function ensureOneColumnVisible() {
      const all = tableColumns();
      if (!all.length) return;
      if (visibleTableColumns().length) return;
      state.layout.columns[all[0]] = true;
    }

    function resetLayoutDefaults() {
      state.layout = defaultLayout();
      applyTheme(DEFAULT_THEME);
      persistView();
      applyLayoutToDom();
      buildBoard();
      syncLayoutPanel();
    }

    function guessMap() {
      const saved = JSON.parse(localStorage.getItem(MAP_KEY) || "{}");
      state.map = {};
      FIELDS.forEach((f) => {
        if (saved[f.key] && headers().includes(saved[f.key])) {
          state.map[f.key] = saved[f.key];
          return;
        }
        const exact = headers().find(
          (h) => norm(h) === norm(f.label) || f.aliases.includes(norm(h))
        );
        if (exact) {
          state.map[f.key] = exact;
          return;
        }
        state.map[f.key] =
          headers().find((h) => f.aliases.some((a) => norm(h).includes(a))) || "";
      });
    }

    function drawMapper() {
      $("mapGrid").innerHTML = FIELDS.map((f) => {
        const opts = [`<option value="">Not used</option>`]
          .concat(
            headers().map(
              (h) =>
                `<option value="${escapeAttr(h)}" ${
                  state.map[f.key] === h ? "selected" : ""
                }>${escapeHtml(h)}</option>`
            )
          )
          .join("");
        return `<label>${escapeHtml(f.label)}<select data-field="${f.key}">${opts}</select></label>`;
      }).join("");
      $("mapGrid").querySelectorAll("select").forEach((sel) => {
        sel.onchange = () => {
          state.map[sel.dataset.field] = sel.value;
        };
      });
    }

    function showMapper() {
      guessMap();
      drawMapper();
      $("setup").classList.remove("hidden");
      $("boardFleet").classList.add("hidden");
      document.querySelectorAll(".board-only").forEach((el) => el.classList.remove("hidden"));
      api.syncMenuMode("fleet");
    }

    function kpi(id, cat, horizon, value, color, hint, opts) {
      const active =
        (id === "fleet" && !state.filter) ||
        (id !== "fleet" && state.filter === id);
      const fixed = !!(opts && opts.fixed);
      const label = cat
        ? `<div class="lbl"><span class="lbl-cat">${cat}</span><span class="lbl-horizon">${horizon}</span></div>`
        : `<div class="lbl">${horizon}</div>`;
      const dragClass = fixed ? "kpi-fixed" : "kpi-draggable";
      const dragAttr = fixed ? 'draggable="false"' : 'draggable="true"';
      return `<div class="kpi clickable ${dragClass}${active ? " active" : ""}" data-kpi="${id}" ${dragAttr} role="button" tabindex="0" aria-label="${cat ? cat + " " : ""}${horizon}">
      ${label}
      <div class="num" style="color:${color}">${value}</div>
      <div class="hint">${hint || ""}</div>
    </div>`;
    }

    function filterTitle(filter) {
      const map = {
        "insp-overdue": "Inspection - Overdue",
        "insp-week": "Inspection - 7 days",
        "insp-30": "Inspection - 30 days",
        "insp-60": "Inspection - 60 days",
        "insp-90": "Inspection - 90 days",
        "reg-overdue": "Registration - Overdue",
        "reg-week": "Registration - 7 days",
        "reg-30": "Registration - 30 days",
        "reg-60": "Registration - 60 days",
        "reg-90": "Registration - 90 days",
        missing: "Missing 90-day date"
      };
      return map[filter] || filter;
    }

    function isRegFilter(filter) {
      return REG_KPI_IDS.indexOf(filter) >= 0;
    }

    function isInspFilter(filter) {
      return INSP_KPI_IDS.indexOf(filter) >= 0;
    }

    function matchesFilter(r, filter) {
      const insp = inspInfo(r);
      const reg = regInfo(r);
      if (!filter || filter === "fleet") return true;
      if (filter === "insp-overdue") return !!(insp && insp.n < 0);
      if (filter === "insp-week") return !!(insp && insp.n >= 0 && insp.n <= 7);
      if (filter === "insp-30") return !!(insp && insp.n >= 0 && insp.n <= 30);
      if (filter === "insp-60") return !!(insp && insp.n >= 0 && insp.n <= 60);
      if (filter === "insp-90") return !!(insp && insp.n >= 0 && insp.n <= 90);
      if (filter === "reg-overdue") return !!(reg && reg.n < 0);
      if (filter === "reg-week") return !!(reg && reg.n >= 0 && reg.n <= 7);
      if (filter === "reg-30") return !!(reg && reg.n >= 0 && reg.n <= 30);
      if (filter === "reg-60") return !!(reg && reg.n >= 0 && reg.n <= 60);
      if (filter === "reg-90") return !!(reg && reg.n >= 0 && reg.n <= 90);
      if (filter === "missing") return !insp;
      return true;
    }

    function setFilter(next) {
      /* click again clears */
      if (state.filter === next || (next === "" && !state.filter)) {
        state.filter = "";
      } else {
        state.filter = next || "";
      }
      if ($("statusFilter")) $("statusFilter").value = state.filter;
      persistView();
      renderQueue();
      renderTable();
      syncKpiActive();
    }

    function syncKpiActive() {
      $("kpis").querySelectorAll(".kpi").forEach((k) => {
        const id = k.dataset.kpi;
        const on =
          (id === "fleet" && !state.filter) ||
          (id !== "fleet" && state.filter === id);
        k.classList.toggle("active", on);
      });
    }

    function renderQueue() {
      const useReg = isRegFilter(state.filter);
      const queue = [];
      rows().forEach((r, idx) => {
        if (!matchesFilter(r, state.filter)) return;
        const insp = inspInfo(r);
        const reg = regInfo(r);
        const info = useReg ? reg : insp;
        if (!info) return;
        /* default queue: inspections in next 45 days; filtered: matching horizon */
        if (!state.filter && info.n > 45) return;
        queue.push({ idx, r, info, kind: useReg ? "reg" : "insp" });
      });
      queue.sort((a, b) => a.info.n - b.info.n);

      const h3 = $("dueList").parentElement.querySelector("h3");
      if (h3) {
        let title;
        if (!state.filter) {
          title = "90-day inspection queue";
        } else if (useReg) {
          title = "Registration queue - filtered: " + filterTitle(state.filter);
        } else if (isInspFilter(state.filter)) {
          title = "Inspection queue - filtered: " + filterTitle(state.filter);
        } else {
          title = "Queue - filtered: " + filterTitle(state.filter);
        }
        if (queue.length) title += " - Showing " + queue.length;
        h3.textContent = title;
      }

      $("dueList").innerHTML =
        queue
          .map(
            ({ idx, r, info }) => `
        <div class="q-item" data-idx="${idx}">
          <div class="days ${tone(info.n)}">${
            info.n < 0 ? "OVERDUE" : info.n + "d"
          }</div>
          <div>
            <b>Unit ${escapeHtml(String(val(r, "id") || "-"))}</b>
            <div class="meta">${escapeHtml(String(val(r, "make") || ""))}</div>
          </div>
          <div class="meta">${escapeHtml(String(val(r, "driver") || "No driver"))}</div>
          <div class="meta">${info.date.toLocaleDateString()}<br>${daysLabel(
              info.n
            )}</div>
        </div>`
          )
          .join("") ||
        `<div class="meta" style="padding:8px 0">${
          state.filter
            ? "No units match this filter."
            : "No inspections due in the next 45 days."
        }</div>`;
      $("dueList").querySelectorAll(".q-item").forEach((el) => {
        el.onclick = () => openRow(+el.dataset.idx);
      });
    }

    function buildBoard() {
      localStorage.setItem(MAP_KEY, JSON.stringify(state.map));
      restoreView();
      $("setup").classList.add("hidden");
      $("boardFleet").classList.remove("hidden");
      document.querySelectorAll(".board-only").forEach((el) => el.classList.remove("hidden"));
      api.updateLiveMeta("fleet");
      api.syncMenuMode("fleet");

      /* KPI counts MUST match matchesFilter / statusFilter predicates so card
         numbers equal the filtered list length. Future horizons are inclusive
         and overlapping (7 subset of 30 subset of 60 subset of 90); overdue separate. */
      const counts = {
        "insp-overdue": 0,
        "insp-week": 0,
        "insp-30": 0,
        "insp-60": 0,
        "insp-90": 0,
        "reg-overdue": 0,
        "reg-week": 0,
        "reg-30": 0,
        "reg-60": 0,
        "reg-90": 0,
        missing: 0
      };
      rows().forEach((r) => {
        if (!inspInfo(r)) counts.missing += 1;
        Object.keys(counts).forEach((k) => {
          if (k === "missing") return;
          if (matchesFilter(r, k)) counts[k] += 1;
        });
      });

      const clickHint = "Click to filter - drop onto a slot";
      function toneColor(id, n) {
        if (id.indexOf("overdue") >= 0) return n ? "var(--red)" : "var(--good)";
        return n ? "var(--warn)" : "var(--good)";
      }
      const defById = {
        fleet: {
          cat: "",
          horizon: "Units",
          value: rows().length,
          color: "var(--accent)",
          hint:
            counts["reg-overdue"] +
            " registration" +
            (counts["reg-overdue"] === 1 ? "" : "s") +
            " overdue - click = all"
        },
        "insp-overdue": {
          cat: "Inspection",
          horizon: "Overdue",
          value: counts["insp-overdue"],
          color: toneColor("insp-overdue", counts["insp-overdue"]),
          hint: clickHint
        },
        "insp-week": {
          cat: "Inspection",
          horizon: "7 days",
          value: counts["insp-week"],
          color: toneColor("insp-week", counts["insp-week"]),
          hint: clickHint
        },
        "insp-30": {
          cat: "Inspection",
          horizon: "30 days",
          value: counts["insp-30"],
          color: toneColor("insp-30", counts["insp-30"]),
          hint: clickHint
        },
        "insp-60": {
          cat: "Inspection",
          horizon: "60 days",
          value: counts["insp-60"],
          color: toneColor("insp-60", counts["insp-60"]),
          hint: clickHint
        },
        "insp-90": {
          cat: "Inspection",
          horizon: "90 days",
          value: counts["insp-90"],
          color: toneColor("insp-90", counts["insp-90"]),
          hint: clickHint
        },
        "reg-overdue": {
          cat: "Registration",
          horizon: "Overdue",
          value: counts["reg-overdue"],
          color: toneColor("reg-overdue", counts["reg-overdue"]),
          hint: clickHint
        },
        "reg-week": {
          cat: "Registration",
          horizon: "7 days",
          value: counts["reg-week"],
          color: toneColor("reg-week", counts["reg-week"]),
          hint: clickHint
        },
        "reg-30": {
          cat: "Registration",
          horizon: "30 days",
          value: counts["reg-30"],
          color: toneColor("reg-30", counts["reg-30"]),
          hint: clickHint
        },
        "reg-60": {
          cat: "Registration",
          horizon: "60 days",
          value: counts["reg-60"],
          color: toneColor("reg-60", counts["reg-60"]),
          hint: clickHint
        },
        "reg-90": {
          cat: "Registration",
          horizon: "90 days",
          value: counts["reg-90"],
          color: toneColor("reg-90", counts["reg-90"]),
          hint: clickHint
        }
      };

      applyTheme(state.layout.theme);
      const slots = syncSlotsWithVisibility();

      const unitsDef = defById.fleet;
      const unitsHtml = kpi(
        "fleet",
        unitsDef.cat,
        unitsDef.horizon,
        unitsDef.value,
        unitsDef.color,
        unitsDef.hint,
        { fixed: true }
      );

      const slotsHtml = slots
        .map((id, slotIndex) => {
          const d = id ? defById[id] : null;
          const showCard = !!(d && isKpiVisible(id));
          const inner = showCard
            ? kpi(id, d.cat, d.horizon, d.value, d.color, d.hint, { fixed: false })
            : '<div class="kpi-slot-empty" aria-hidden="true"><div class="lbl">Empty slot</div></div>';
          return (
            '<div class="kpi-slot' +
            (showCard ? "" : " kpi-slot-vacant") +
            '" data-slot="' +
            slotIndex +
            '" data-kpi-slot="' +
            (showCard ? id : "") +
            '">' +
            inner +
            "</div>"
          );
        })
        .join("");

      $("kpis").innerHTML =
        '<div class="kpi-row-units" id="kpiUnitsRow" aria-label="Units">' +
        unitsHtml +
        "</div>" +
        '<hr class="kpi-divider" aria-hidden="true" />' +
        '<div class="kpi-strip" id="kpiStrip" aria-label="Horizon KPI slots - drop a card into a box">' +
        slotsHtml +
        "</div>";

      wireKpiInteractions();
      wireUnitsClick();

      applyLayoutToDom();
      renderQueue();
      renderTable();
      persistView();
    }

    function wireUnitsClick() {
      const row = $("kpiUnitsRow");
      if (!row) return;
      row.querySelectorAll(".kpi").forEach((el) => {
        el.onclick = () => {
          setFilter("");
        };
        el.onkeydown = (ev) => {
          if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            setFilter("");
          }
        };
      });
    }

    function wireKpiInteractions() {
      const strip = $("kpiStrip");
      if (!strip) return;
      let dragId = null;
      let didDrag = false;

      function clearSlotHighlight() {
        strip.querySelectorAll(".kpi-slot.drag-over").forEach((el) => {
          el.classList.remove("drag-over");
        });
      }

      function slotElFromEvent(ev) {
        const t = ev.target;
        if (!t || !t.closest) return null;
        return t.closest(".kpi-slot");
      }

      function highlightSlot(ev) {
        clearSlotHighlight();
        const slot = slotElFromEvent(ev);
        if (slot) slot.classList.add("drag-over");
      }

      strip.querySelectorAll(".kpi.kpi-draggable").forEach((el) => {
        el.addEventListener("dragstart", (ev) => {
          dragId = el.dataset.kpi;
          didDrag = false;
          el.classList.add("dragging");
          strip.classList.add("is-dragging");
          try {
            ev.dataTransfer.effectAllowed = "move";
            ev.dataTransfer.setData("text/plain", dragId);
          } catch (_) {
            /* Edge file:// */
          }
          setTimeout(() => {
            didDrag = true;
            el.classList.add("drag-ghost");
          }, 0);
        });
        el.addEventListener("dragend", () => {
          el.classList.remove("dragging", "drag-ghost");
          strip.classList.remove("is-dragging");
          clearSlotHighlight();
          dragId = null;
          setTimeout(() => {
            didDrag = false;
          }, 50);
        });
        el.onclick = (ev) => {
          if (didDrag || el.classList.contains("dragging")) {
            ev.preventDefault();
            ev.stopPropagation();
            return;
          }
          const id = el.dataset.kpi;
          setFilter(id === "fleet" ? "" : id);
        };
        el.onkeydown = (ev) => {
          if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            if (!didDrag) {
              const id = el.dataset.kpi;
              setFilter(id === "fleet" ? "" : id);
            }
          }
        };
      });

      strip.querySelectorAll(".kpi-slot").forEach((slot) => {
        slot.addEventListener("dragover", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          try {
            ev.dataTransfer.dropEffect = "move";
          } catch (_) {
            /* ignore */
          }
          if (!dragId) return;
          highlightSlot(ev);
        });
        slot.addEventListener("dragenter", (ev) => {
          ev.preventDefault();
          if (!dragId) return;
          highlightSlot(ev);
        });
        slot.addEventListener("dragleave", (ev) => {
          const related = ev.relatedTarget;
          if (related && slot.contains(related)) return;
          slot.classList.remove("drag-over");
        });
        slot.addEventListener("drop", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          let id = dragId;
          try {
            if (!id && ev.dataTransfer) id = ev.dataTransfer.getData("text/plain");
          } catch (_) {
            /* ignore */
          }
          clearSlotHighlight();
          strip.classList.remove("is-dragging");
          const idx = parseInt(slot.getAttribute("data-slot"), 10);
          if (!id || isNaN(idx)) return;
          placeCardInSlot(id, idx);
        });
      });
    }


    function applyLayoutToDom() {
      const q = $("queueSection");
      if (q) {
        if (state.layout.showQueue) q.classList.remove("hidden");
        else q.classList.add("hidden");
      }
      ensureOneColumnVisible();
    }

    function isPureNumber(v) {
      if (v == null || v === "") return false;
      if (typeof v === "number" && isFinite(v)) return true;
      const s = String(v).trim();
      if (!s) return false;
      return /^-?\d+(\.\d+)?$/.test(s);
    }

    function sortValueForColumn(r, headerName) {
      const fieldKey = fieldKeyForHeader(headerName);
      if (fieldKey === "insp") {
        const info = inspInfo(r);
        return info ? { kind: "num", n: info.n } : { kind: "empty" };
      }
      if (fieldKey === "reg") {
        const info = regInfo(r);
        return info ? { kind: "num", n: info.n } : { kind: "empty" };
      }
      const raw = r[headerName];
      if (raw == null || String(raw).trim() === "") return { kind: "empty" };
      if (fieldKey === "year" || isPureNumber(raw)) {
        const n = typeof raw === "number" ? raw : parseFloat(String(raw).trim());
        if (isFinite(n)) return { kind: "num", n: n };
      }
      const d = parseDate(raw);
      if (d) return { kind: "num", n: daysUntil(d) };
      return { kind: "str", s: String(raw) };
    }

    function compareSortValues(va, vb, dir) {
      const mul = dir === "desc" ? -1 : 1;
      if (va.kind === "empty" && vb.kind === "empty") return 0;
      if (va.kind === "empty") return 1;
      if (vb.kind === "empty") return -1;
      if (va.kind === "num" && vb.kind === "num") {
        if (va.n < vb.n) return -1 * mul;
        if (va.n > vb.n) return 1 * mul;
        return 0;
      }
      const sa = va.kind === "str" ? va.s : String(va.n);
      const sb = vb.kind === "str" ? vb.s : String(vb.n);
      return mul * sa.localeCompare(sb, undefined, { sensitivity: "base" });
    }

    function defaultInspSort(a, b) {
      const an = inspInfo(a.r),
        bn = inspInfo(b.r);
      if (!an && !bn) return 0;
      if (!an) return 1;
      if (!bn) return -1;
      return an.n - bn.n;
    }

    function visibleRows() {
      const q = norm(state.search);
      const list = rows()
        .map((r, idx) => ({ r, idx }))
        .filter(({ r }) => {
          if (!matchesFilter(r, state.filter)) return false;
          if (!q) return true;
          return tableColumns().some((h) => norm(r[h]).includes(q));
        });
      if (!state.sortKey) {
        return list.sort(defaultInspSort);
      }
      const key = state.sortKey;
      const dir = state.sortDir === "desc" ? "desc" : "asc";
      return list.sort((a, b) => {
        const cmp = compareSortValues(
          sortValueForColumn(a.r, key),
          sortValueForColumn(b.r, key),
          dir
        );
        if (cmp !== 0) return cmp;
        return defaultInspSort(a, b);
      });
    }

    function setSort(headerName) {
      if (state.sortKey === headerName) {
        state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
      } else {
        state.sortKey = headerName;
        state.sortDir = "asc";
      }
      persistView();
      renderTable();
    }

    function renderTable() {
      const cols = visibleTableColumns();
      const list = visibleRows();
      if (!cols.length) {
        $("thead").innerHTML = "";
        $("tbody").innerHTML =
          '<tr><td class="meta" style="padding:12px">No columns visible. Open Customize and enable at least one column.</td></tr>';
        return;
      }
      $("thead").innerHTML =
        "<tr>" +
        cols
          .map((h) => {
            const active = state.sortKey === h;
            const ind = active
              ? state.sortDir === "desc"
                ? ' <span class="sort-ind" aria-hidden="true">v</span>'
                : ' <span class="sort-ind" aria-hidden="true">^</span>'
              : "";
            const ariaSort = active
              ? state.sortDir === "desc"
                ? "descending"
                : "ascending"
              : "none";
            const cls = "sortable" + (active ? " sorted sorted-" + state.sortDir : "");
            return `<th class="${cls}" data-col="${escapeAttr(h)}" title="${escapeAttr(
              h
            )}" role="button" tabindex="0" aria-sort="${ariaSort}">${escapeHtml(h)}${ind}</th>`;
          })
          .join("") +
        "</tr>";
      $("thead").querySelectorAll("th.sortable").forEach((th) => {
        th.onclick = (ev) => {
          ev.stopPropagation();
          setSort(th.dataset.col);
        };
        th.onkeydown = (ev) => {
          if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            setSort(th.dataset.col);
          }
        };
      });
      $("tbody").innerHTML = list
        .map(({ r, idx }) => {
          const cells = cols
            .map((h) => {
              const fieldKey = fieldKeyForHeader(h);
              if (fieldKey === "insp" || fieldKey === "reg") {
                const info = fieldKey === "insp" ? inspInfo(r) : regInfo(r);
                if (!info)
                  return `<td><span class="chip muted">No date</span></td>`;
                return `<td><span class="chip ${tone(
                  info.n
                )}">${info.date.toLocaleDateString()}</span><div class="meta">${daysLabel(
                  info.n
                )}</div></td>`;
              }
              const raw = r[h] == null ? "" : r[h];
              const s = String(raw);
              const display = s.trim() === "" ? "-" : s;
              if (fieldKey === "make")
                return `<td class="wrap">${escapeHtml(display)}</td>`;
              if (fieldKey === "notes")
                return `<td class="notes">${escapeHtml(display)}</td>`;
              return `<td>${escapeHtml(display)}</td>`;
            })
            .join("");
          return `<tr data-idx="${idx}" class="${
            state.selected === idx ? "active" : ""
          }">${cells}</tr>`;
        })
        .join("");
      $("tbody").querySelectorAll("tr").forEach((tr) => {
        tr.onclick = () => openRow(+tr.dataset.idx);
      });
    }

    function openRow(idx) {
      const r = rows()[idx];
      if (!r) return;
      state.selected = idx;
      renderTable();
      const insp = inspInfo(r);
      const badge = !insp
        ? ["muted", "No 90-day date"]
        : [tone(insp.n), daysLabel(insp.n)];
      const fields = [
        ["Year", val(r, "year")],
        ["MAKE/MODEL", val(r, "make")],
        ["License#", val(r, "plate")],
        ["Vehicle ID#", val(r, "vid")],
        [
          "90 Day Insp.",
          insp ? `${insp.date.toLocaleDateString()} - ${daysLabel(insp.n)}` : ""
        ],
        ["Reg. Exp", (() => {
          const d = parseDate(val(r, "reg"));
          return d ? d.toLocaleDateString() : val(r, "reg");
        })()],
        ["Driver", val(r, "driver") || "Unassigned"],
        ["Notes", val(r, "notes")]
      ].filter(([, v]) => v);
      $("drawer").innerHTML = `
      <button class="icon-btn" id="closeDrawer" type="button" style="float:right" aria-label="Close">X</button>
      <div class="chip ${badge[0]}">${badge[1]}</div>
      <h2>Unit ${escapeHtml(String(val(r, "id") || ""))}</h2>
      <div class="kv">${fields
        .map(([k, v]) => `<span>${k}</span><b>${escapeHtml(String(v))}</b>`)
        .join("")}</div>`;
      $("drawer").classList.add("open");
      $("backdrop").classList.remove("hidden");
      $("closeDrawer").onclick = closeDrawer;
    }

    function closeDrawer() {
      $("drawer").classList.remove("open");
      $("backdrop").classList.add("hidden");
    }

    function exportCurrentView() {
      const cols = visibleTableColumns();
      const list = visibleRows();
      const lines = [];
      lines.push(cols.map((h) => csvEscape(h)).join(","));
      list.forEach(({ r }) => {
        lines.push(
          cols
            .map((h) => {
              const fieldKey = fieldKeyForHeader(h);
              if (fieldKey === "insp" || fieldKey === "reg") {
                const info = fieldKey === "insp" ? inspInfo(r) : regInfo(r);
                return csvEscape(info ? info.date.toISOString().slice(0, 10) : "");
              }
              return csvEscape(r[h] == null ? "" : r[h]);
            })
            .join(",")
        );
      });
      const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a");
      const base = (api.getFileName && api.getFileName()) || "fleet-view";
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = URL.createObjectURL(blob);
      a.download = base.replace(/\.[^.]+$/, "") + `-view-${stamp}.csv`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(a.href);
        a.remove();
      }, 500);
    }


    function syncLayoutPanel() {
      const panel = $("layoutPanel");
      if (!panel) return;
      applyTheme(state.layout.theme);
      panel.querySelectorAll("[data-layout-kpi]").forEach((inp) => {
        const id = inp.getAttribute("data-layout-kpi");
        if (id === "fleet") {
          inp.checked = true;
          inp.disabled = true;
          return;
        }
        inp.checked = !!state.layout.kpis[id];
      });
      panel.querySelectorAll("[data-layout-group]").forEach((inp) => {
        const g = inp.getAttribute("data-layout-group");
        inp.checked = !!state.layout.groups[g];
      });
      const q = $("layoutShowQueue");
      if (q) q.checked = !!state.layout.showQueue;
      const host = $("layoutColChecks");
      if (host) {
        const cols = tableColumns();
        host.innerHTML = cols.length
          ? cols
              .map((h) => {
                const on = isColumnVisible(h);
                return `<label class="layout-check"><input type="checkbox" data-layout-col="${escapeAttr(
                  h
                )}" ${on ? "checked" : ""} /> ${escapeHtml(h)}</label>`;
              })
              .join("")
          : `<div class="layout-hint">Open a workbook to choose columns.</div>`;
        host.querySelectorAll("[data-layout-col]").forEach((inp) => {
          inp.onchange = () => {
            const name = inp.getAttribute("data-layout-col");
            if (!inp.checked) {
              const wouldRemain = tableColumns().filter(
                (h) => h !== name && isColumnVisible(h)
              );
              if (!wouldRemain.length) {
                inp.checked = true;
                return;
              }
            }
            state.layout.columns[name] = !!inp.checked;
            if (!inp.checked && state.sortKey === name) {
              state.sortKey = null;
              state.sortDir = "asc";
            }
            persistView();
            renderTable();
          };
        });
      }
      /* disable individual KPIs when group master off */
      INSP_KPI_IDS.forEach((id) => {
        const el = panel.querySelector(`[data-layout-kpi="${id}"]`);
        if (el) el.disabled = !state.layout.groups.inspection;
      });
      REG_KPI_IDS.forEach((id) => {
        const el = panel.querySelector(`[data-layout-kpi="${id}"]`);
        if (el) el.disabled = !state.layout.groups.registration;
      });
    }

    function openLayoutPanel() {
      const panel = $("layoutPanel");
      const bd = $("layoutBackdrop");
      if (!panel) return;
      syncLayoutPanel();
      panel.classList.remove("hidden");
      panel.removeAttribute("hidden");
      if (bd) {
        bd.classList.remove("hidden");
        bd.removeAttribute("hidden");
      }
      const done = $("layoutDoneBtn");
      if (done) done.focus();
    }

    function closeLayoutPanel() {
      const panel = $("layoutPanel");
      const bd = $("layoutBackdrop");
      if (panel) {
        panel.classList.add("hidden");
        panel.setAttribute("hidden", "");
      }
      if (bd) {
        bd.classList.add("hidden");
        bd.setAttribute("hidden", "");
      }
    }

    function onLayoutPanelChange(ev) {
      const t = ev.target;
      if (!t) return;
      if (t.name === "layoutTheme" && t.checked) {
        applyTheme(t.value);
        persistView();
        syncLayoutPanel();
        return;
      }
      if (t.hasAttribute("data-layout-kpi")) {
        const id = t.getAttribute("data-layout-kpi");
        if (id === "fleet") {
          t.checked = true;
          return;
        }
        state.layout.kpis[id] = !!t.checked;
        persistView();
        buildBoard();
        syncLayoutPanel();
        return;
      }
      if (t.hasAttribute("data-layout-group")) {
        const g = t.getAttribute("data-layout-group");
        state.layout.groups[g] = !!t.checked;
        persistView();
        buildBoard();
        syncLayoutPanel();
        return;
      }
      if (t.id === "layoutShowQueue") {
        state.layout.showQueue = !!t.checked;
        persistView();
        applyLayoutToDom();
        return;
      }
    }

    function wire() {
      $("applyMap").onclick = () => {
        buildBoard();
      };
      $("remapBtn").onclick = () => {
        showMapper();
      };
      $("search").oninput = () => {
        state.search = $("search").value;
        persistView();
        renderTable();
      };
      $("statusFilter").onchange = () => {
        state.filter = $("statusFilter").value;
        persistView();
        renderQueue();
        renderTable();
        syncKpiActive();
      };
      $("backdrop").onclick = closeDrawer;
      $("sheetSelectFleet").onchange = () => {
        api.useSheet($("sheetSelectFleet").value);
        guessMap();
        drawMapper();
      };
      if ($("customizeBtn")) {
        $("customizeBtn").onclick = () => openLayoutPanel();
      }
      if ($("themeSelect")) {
        $("themeSelect").onchange = () => {
          applyTheme($("themeSelect").value);
          persistView();
          syncLayoutPanel();
        };
      }
      applyTheme(state.layout.theme || DEFAULT_THEME);
      if ($("layoutDoneBtn")) {
        $("layoutDoneBtn").onclick = () => closeLayoutPanel();
      }
      if ($("layoutCloseBtn")) {
        $("layoutCloseBtn").onclick = () => closeLayoutPanel();
      }
      if ($("layoutResetBtn")) {
        $("layoutResetBtn").onclick = () => resetLayoutDefaults();
      }
      if ($("layoutBackdrop")) {
        $("layoutBackdrop").onclick = () => closeLayoutPanel();
      }
      if ($("layoutPanel")) {
        $("layoutPanel").addEventListener("change", onLayoutPanelChange);
      }
      document.addEventListener("keydown", (ev) => {
        if (ev.key !== "Escape") return;
        const panel = $("layoutPanel");
        if (panel && !panel.classList.contains("hidden")) {
          closeLayoutPanel();
          ev.preventDefault();
        }
      });
    }

    function activate({ skipMapper }) {
      guessMap();
      if (skipMapper) {
        buildBoard();
      } else {
        drawMapper();
        showMapper();
      }
    }

    function refresh() {
      if ($("boardFleet").classList.contains("hidden") && $("setup").classList.contains("hidden"))
        return;
      if (!$("setup").classList.contains("hidden")) {
        guessMap();
        drawMapper();
        return;
      }
      buildBoard();
    }

    wire();

    return {
      FIELDS,
      looksLikeFleet,
      activate,
      refresh,
      showMapper,
      buildBoard,
      guessMap,
      closeDrawer,
      exportCurrentView,
      persistView,
      openLayoutPanel,
      closeLayoutPanel,
      resetLayoutDefaults
    };
  }

  global.FleetBoardFleet = { FIELDS, looksLikeFleet, create, MAP_KEY };
})(window);
