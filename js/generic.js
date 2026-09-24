/* Generic Excel dashboard — header-driven types + auto KPIs + Phase 3 filters */
(function (global) {
  "use strict";

  const COLS_KEY_PREFIX = "fleetboard-cols-v1:";
  const MODE_KEY_PREFIX = "fleetboard-mode-v1:";
  const VIEW_KEY_PREFIX = "dashboard-view-v1:";

  const $ = (id) => document.getElementById(id);

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  }

  function norm(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function headerHash(headers) {
    const s = headers.map((h) => norm(h)).join("|");
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(16);
  }

  function parseDate(v) {
    if (v == null || v === "") return null;
    if (v instanceof Date && !isNaN(v)) return v;
    const s = String(v).trim();
    if (!s) return null;
    if (/^\d+(\.\d+)?$/.test(s) && Number(s) < 100000) return null;
    const d = new Date(s);
    if (isNaN(d)) return null;
    const y = d.getFullYear();
    if (y < 1970 || y > 2100) return null;
    return d;
  }

  function parseNumber(v) {
    if (v == null || v === "") return null;
    if (typeof v === "number" && isFinite(v)) return v;
    const s = String(v).trim().replace(/[$,\s]/g, "");
    if (!s || !/^-?\d+(\.\d+)?$/.test(s)) return null;
    const n = Number(s);
    return isFinite(n) ? n : null;
  }

  function daysUntil(d) {
    const a = new Date();
    a.setHours(0, 0, 0, 0);
    const b = new Date(d);
    b.setHours(0, 0, 0, 0);
    return Math.round((b - a) / 86400000);
  }

  function headerLooksDate(h) {
    const n = norm(h);
    return /\b(date|due|expir|deadline|as of|asof|when|timestamp)\b/.test(n) ||
      n.includes("day insp") ||
      n === "reg exp" ||
      n.includes("reg exp");
  }

  function inferColumn(header, values) {
    const nonEmpty = values.filter((v) => v != null && String(v).trim() !== "");
    const total = values.length;
    const fill = total ? nonEmpty.length / total : 0;
    if (!nonEmpty.length) {
      return { header, type: "text", fill: 0, unique: 0 };
    }

    let dateHits = 0,
      numHits = 0;
    nonEmpty.forEach((v) => {
      if (parseDate(v)) dateHits += 1;
      else if (parseNumber(v) != null) numHits += 1;
    });
    const dateRate = dateHits / nonEmpty.length;
    const numRate = numHits / nonEmpty.length;

    const uniq = new Set(nonEmpty.map((v) => String(v).trim()));
    const unique = uniq.size;
    const catCap = Math.min(20, Math.max(2, Math.floor(total / 2)));

    let type = "text";
    if (dateRate >= 0.7 || (headerLooksDate(header) && dateRate >= 0.4)) {
      type = "date";
    } else if (numRate >= 0.8) {
      type = "number";
    } else if (
      unique <= catCap &&
      unique >= 2 &&
      numRate < 0.5 &&
      dateRate < 0.3
    ) {
      type = "category";
    }

    return { header, type, fill, unique, values: nonEmpty };
  }

  function fmtNum(n) {
    if (n == null || !isFinite(n)) return "—";
    const abs = Math.abs(n);
    if (abs >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
    if (Number.isInteger(n)) return String(n);
    return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  function csvEscape(v) {
    const s = v == null ? "" : String(v);
    if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function create(api) {
    const state = {
      cols: [],
      visible: {},
      search: "",
      sortKey: "",
      sortDir: 1,
      hash: "",
      /* category multi-select: { colHeader: Set(values) } */
      catFilters: {},
      /* date horizons: { colHeader: "overdue"|"7d"|"30d"|"all"|"" } */
      dateFilters: {},
      /* KPI filter id when active (e.g. date-Due date:overdue) */
      kpiFilter: "",
      fingerprint: ""
    };

    function loadVisiblePrefs(hash, headers) {
      try {
        const raw = localStorage.getItem(COLS_KEY_PREFIX + hash);
        if (raw) {
          const saved = JSON.parse(raw);
          const vis = {};
          headers.forEach((h) => {
            vis[h] = saved[h] !== false;
          });
          return vis;
        }
      } catch (_) { /* ignore */ }
      const vis = {};
      headers.forEach((h) => {
        vis[h] = true;
      });
      return vis;
    }

    function saveVisiblePrefs() {
      try {
        localStorage.setItem(COLS_KEY_PREFIX + state.hash, JSON.stringify(state.visible));
      } catch (_) { /* ignore */ }
      persistView();
    }

    function viewStorageKey() {
      const fp = state.fingerprint || state.hash;
      if (!fp) return null;
      return VIEW_KEY_PREFIX + fp;
    }

    function persistView() {
      const key = viewStorageKey();
      if (!key) return;
      const catObj = {};
      Object.keys(state.catFilters).forEach((col) => {
        const set = state.catFilters[col];
        if (set && set.size) catObj[col] = Array.from(set);
      });
      try {
        localStorage.setItem(
          key,
          JSON.stringify({
            layoutMode: "generic",
            sheet: api.getSheet ? api.getSheet() : "",
            visible: state.visible,
            sortKey: state.sortKey,
            sortDir: state.sortDir,
            search: state.search,
            catFilters: catObj,
            dateFilters: state.dateFilters,
            kpiFilter: state.kpiFilter
          })
        );
      } catch (_) { /* ignore */ }
    }

    function restoreViewPrefs() {
      const key = viewStorageKey();
      if (!key) return;
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return;
        const saved = JSON.parse(raw);
        if (saved.visible && typeof saved.visible === "object") {
          const headers = api.getHeaders();
          headers.forEach((h) => {
            if (saved.visible[h] === false) state.visible[h] = false;
            else if (saved.visible[h] === true) state.visible[h] = true;
          });
        }
        if (saved.sortKey) state.sortKey = saved.sortKey;
        if (saved.sortDir === 1 || saved.sortDir === -1) state.sortDir = saved.sortDir;
        if (typeof saved.search === "string") {
          state.search = saved.search;
          if ($("searchGeneric")) $("searchGeneric").value = state.search;
        }
        if (saved.catFilters && typeof saved.catFilters === "object") {
          state.catFilters = {};
          Object.keys(saved.catFilters).forEach((col) => {
            const arr = saved.catFilters[col];
            if (Array.isArray(arr) && arr.length) state.catFilters[col] = new Set(arr);
          });
        }
        if (saved.dateFilters && typeof saved.dateFilters === "object") {
          state.dateFilters = Object.assign({}, saved.dateFilters);
        }
        if (typeof saved.kpiFilter === "string") state.kpiFilter = saved.kpiFilter;
      } catch (_) { /* ignore */ }
    }

    function analyze() {
      const headers = api.getHeaders();
      const rows = api.getRows();
      state.hash = headerHash(headers);
      state.fingerprint = api.getFingerprint ? api.getFingerprint() : state.hash;
      state.visible = loadVisiblePrefs(state.hash, headers);
      state.cols = headers.map((h) => {
        const values = rows.map((r) => r[h]);
        return inferColumn(h, values);
      });
      restoreViewPrefs();
    }

    function visibleHeaders() {
      return api.getHeaders().filter((h) => state.visible[h] !== false);
    }

    function toggleCatFilter(col, val) {
      if (!state.catFilters[col]) state.catFilters[col] = new Set();
      const set = state.catFilters[col];
      if (set.has(val)) set.delete(val);
      else set.add(val);
      if (!set.size) delete state.catFilters[col];
      state.kpiFilter = "";
      persistView();
      renderAll();
    }

    function setDateFilter(col, horizon) {
      const cur = state.dateFilters[col] || "";
      if (horizon === "all" || horizon === cur) {
        delete state.dateFilters[col];
      } else {
        state.dateFilters[col] = horizon;
      }
      state.kpiFilter = "";
      persistView();
      renderAll();
    }

    function clearAllFilters() {
      state.catFilters = {};
      state.dateFilters = {};
      state.kpiFilter = "";
      state.search = "";
      if ($("searchGeneric")) $("searchGeneric").value = "";
      persistView();
      renderAll();
    }

    function toggleKpiFilter(id) {
      if (state.kpiFilter === id) {
        state.kpiFilter = "";
      } else {
        state.kpiFilter = id;
        /* map date KPI clicks onto that column's overdue horizon */
        if (id.startsWith("date-")) {
          const header = id.slice(5);
          state.dateFilters[header] = "overdue";
        }
        if (id === "rows") {
          clearAllFilters();
          return;
        }
      }
      persistView();
      renderAll();
    }

    function rowPassesDateFilter(r, col, horizon) {
      const d = parseDate(r[col]);
      if (!d) return false;
      const n = daysUntil(d);
      if (horizon === "overdue") return n < 0;
      if (horizon === "7d") return n >= 0 && n <= 7;
      if (horizon === "30d") return n >= 0 && n <= 30;
      return true;
    }

    function filteredRows() {
      const q = norm(state.search);
      const vis = visibleHeaders();
      let list = api.getRows().map((r, idx) => ({ r, idx }));

      /* category multi-select: within a column OR of selected values; across columns AND */
      Object.keys(state.catFilters).forEach((col) => {
        const set = state.catFilters[col];
        if (!set || !set.size) return;
        list = list.filter(({ r }) => set.has(String(r[col] == null ? "" : r[col]).trim()));
      });

      Object.keys(state.dateFilters).forEach((col) => {
        const horizon = state.dateFilters[col];
        if (!horizon || horizon === "all") return;
        list = list.filter(({ r }) => rowPassesDateFilter(r, col, horizon));
      });

      if (q) {
        list = list.filter(({ r }) =>
          vis.some((h) => norm(r[h]).includes(q))
        );
      }

      if (state.sortKey) {
        const col = state.cols.find((c) => c.header === state.sortKey);
        const type = col ? col.type : "text";
        const dir = state.sortDir;
        const key = state.sortKey;
        list.sort((a, b) => {
          const av = cellSortValue(key, a.r[key], type);
          const bv = cellSortValue(key, b.r[key], type);
          if (av < bv) return -1 * dir;
          if (av > bv) return 1 * dir;
          return 0;
        });
      }
      return list;
    }

    function buildKpis() {
      const rows = api.getRows();
      const cards = [];
      cards.push({
        id: "rows",
        label: "Rows",
        value: rows.length,
        color: "var(--soft)",
        hint: `${state.cols.length} columns · click to clear filters`
      });

      const numeric = state.cols
        .filter((c) => c.type === "number")
        .slice()
        .sort((a, b) => b.fill - a.fill)
        .slice(0, 4);

      numeric.forEach((c) => {
        const nums = api
          .getRows()
          .map((r) => parseNumber(r[c.header]))
          .filter((n) => n != null);
        if (!nums.length) return;
        const sum = nums.reduce((a, b) => a + b, 0);
        const avg = sum / nums.length;
        const min = Math.min(...nums);
        const max = Math.max(...nums);
        cards.push({
          id: "num-" + c.header,
          label: c.header,
          value: fmtNum(sum),
          color: "var(--accent)",
          hint: `avg ${fmtNum(avg)} · min ${fmtNum(min)} · max ${fmtNum(max)}`
        });
      });

      const dateCols = state.cols.filter((c) => c.type === "date");
      dateCols.forEach((c) => {
        let overdue = 0,
          soon7 = 0,
          soon30 = 0,
          parsed = 0;
        api.getRows().forEach((r) => {
          const d = parseDate(r[c.header]);
          if (!d) return;
          parsed += 1;
          const n = daysUntil(d);
          if (n < 0) overdue += 1;
          else if (n <= 7) soon7 += 1;
          else if (n <= 30) soon30 += 1;
        });
        if (!parsed) return;
        cards.push({
          id: "date-" + c.header,
          label: c.header,
          value: overdue,
          color: overdue ? "var(--red)" : "var(--good)",
          hint: `overdue · ${soon7} ≤7d · ${soon30} ≤30d · click to filter`
        });
      });

      $("kpisGeneric").innerHTML = cards
        .map(
          (k) => `<div class="kpi clickable${
            state.kpiFilter === k.id ||
            (k.id.startsWith("date-") &&
              state.dateFilters[k.id.slice(5)] === "overdue")
              ? " active"
              : ""
          }" data-kpi="${escapeHtml(k.id)}" role="button" tabindex="0">
        <div class="lbl">${escapeHtml(k.label)}</div>
        <div class="num" style="color:${k.color}">${escapeHtml(String(k.value))}</div>
        <div class="hint">${escapeHtml(k.hint)}</div>
      </div>`
        )
        .join("");

      $("kpisGeneric").querySelectorAll(".kpi").forEach((el) => {
        el.onclick = () => toggleKpiFilter(el.dataset.kpi);
      });

      /* Category top-value chips — multi-select toggle */
      const cats = state.cols.filter((c) => c.type === "category").slice(0, 4);
      const chipHtml = [];
      cats.forEach((c) => {
        const counts = {};
        api.getRows().forEach((r) => {
          const v = String(r[c.header] == null ? "" : r[c.header]).trim();
          if (!v) return;
          counts[v] = (counts[v] || 0) + 1;
        });
        const top = Object.keys(counts)
          .sort((a, b) => counts[b] - counts[a])
          .slice(0, 8);
        if (!top.length) return;
        const activeSet = state.catFilters[c.header];
        chipHtml.push(
          `<div class="cat-group"><span class="cat-label">${escapeHtml(
            c.header
          )}</span>${top
            .map((v) => {
              const on = activeSet && activeSet.has(v);
              return `<span class="chip muted cat-chip${on ? " active" : ""}" data-col="${escapeHtml(
                c.header
              )}" data-val="${escapeHtml(v)}" role="button" tabindex="0">${escapeHtml(v)} · ${
                counts[v]
              }</span>`;
            })
            .join("")}</div>`
        );
      });
      $("catChips").innerHTML = chipHtml.join("");
      $("catChips").querySelectorAll(".cat-chip").forEach((el) => {
        el.onclick = () => toggleCatFilter(el.dataset.col, el.dataset.val);
      });
    }

    function buildDateHorizons() {
      const dateCols = state.cols.filter((c) => c.type === "date");
      if (!dateCols.length) {
        $("dateHorizons").innerHTML = "";
        return;
      }
      const parts = dateCols.map((c) => {
        const cur = state.dateFilters[c.header] || "all";
        const opts = [
          { id: "overdue", label: "Overdue" },
          { id: "7d", label: "Next 7d" },
          { id: "30d", label: "Next 30d" },
          { id: "all", label: "All" }
        ];
        return `<div class="horizon-group" data-col="${escapeHtml(c.header)}">
          <span class="horizon-label" title="${escapeHtml(c.header)}">${escapeHtml(c.header)}</span>
          ${opts
            .map((o) => {
              const on = cur === o.id || (o.id === "all" && !state.dateFilters[c.header]);
              return `<span class="chip muted horizon-chip${on ? " active" : ""}" data-horizon="${o.id}" role="button" tabindex="0">${o.label}</span>`;
            })
            .join("")}
        </div>`;
      });
      $("dateHorizons").innerHTML = parts.join("");
      $("dateHorizons").querySelectorAll(".horizon-group").forEach((group) => {
        const col = group.dataset.col;
        group.querySelectorAll(".horizon-chip").forEach((chip) => {
          chip.onclick = () => setDateFilter(col, chip.dataset.horizon);
        });
      });
    }

    function cellSortValue(header, raw, type) {
      if (type === "number") {
        const n = parseNumber(raw);
        return n == null ? Number.NEGATIVE_INFINITY : n;
      }
      if (type === "date") {
        const d = parseDate(raw);
        return d ? d.getTime() : 0;
      }
      return norm(raw);
    }

    function renderCell(header, raw, type) {
      if (raw == null || String(raw).trim() === "") {
        return `<td><span class="chip muted">—</span></td>`;
      }
      if (type === "date") {
        const d = parseDate(raw);
        if (!d) return `<td>${escapeHtml(String(raw))}</td>`;
        const n = daysUntil(d);
        const tone = n < 0 ? "bad" : n <= 7 ? "warn" : n <= 30 ? "warn" : "good";
        const hint =
          n < 0
            ? `${-n}d overdue`
            : n === 0
              ? "today"
              : n <= 30
                ? `${n}d left`
                : "";
        return `<td><span class="chip ${tone}">${d.toLocaleDateString()}</span>${
          hint ? `<div class="meta">${hint}</div>` : ""
        }</td>`;
      }
      if (type === "number") {
        const n = parseNumber(raw);
        return `<td class="num-cell">${escapeHtml(
          n == null ? String(raw) : fmtNum(n)
        )}</td>`;
      }
      return `<td>${escapeHtml(String(raw))}</td>`;
    }

    function typeBadge(t) {
      return `<span class="type-badge">${t}</span>`;
    }

    function renderTable() {
      const vis = visibleHeaders();
      const typeMap = {};
      state.cols.forEach((c) => {
        typeMap[c.header] = c.type;
      });
      $("theadGeneric").innerHTML =
        "<tr>" +
        vis
          .map((h) => {
            const arrow =
              state.sortKey === h ? (state.sortDir > 0 ? " ▲" : " ▼") : "";
            return `<th class="sortable" data-col="${escapeHtml(h)}">${escapeHtml(
              h
            )}${typeBadge(typeMap[h] || "text")}${arrow}</th>`;
          })
          .join("") +
        "</tr>";
      $("theadGeneric").querySelectorAll("th.sortable").forEach((th) => {
        th.onclick = () => {
          const col = th.dataset.col;
          if (state.sortKey === col) state.sortDir *= -1;
          else {
            state.sortKey = col;
            state.sortDir = 1;
          }
          persistView();
          renderTable();
        };
      });

      const list = filteredRows();
      $("tbodyGeneric").innerHTML = list
        .map(({ r }) => {
          return (
            "<tr>" +
            vis
              .map((h) => renderCell(h, r[h], typeMap[h] || "text"))
              .join("") +
            "</tr>"
          );
        })
        .join("");

      const filterBits = [];
      Object.keys(state.catFilters).forEach((col) => {
        const set = state.catFilters[col];
        if (set && set.size) filterBits.push(`${col}: ${Array.from(set).join(", ")}`);
      });
      Object.keys(state.dateFilters).forEach((col) => {
        const h = state.dateFilters[col];
        if (h && h !== "all") filterBits.push(`${col}: ${h}`);
      });
      const filterNote = filterBits.length
        ? ` · filtered (${filterBits.join(" · ")})`
        : "";
      $("tableFootGeneric").textContent = `Showing ${list.length} of ${
        api.getRows().length
      } rows${filterNote}`;
    }

    function renderAll() {
      buildKpis();
      buildDateHorizons();
      renderTable();
    }

    function drawColPanel() {
      const headers = api.getHeaders();
      $("colChecks").innerHTML = headers
        .map((h) => {
          const col = state.cols.find((c) => c.header === h);
          const checked = state.visible[h] !== false ? "checked" : "";
          return `<label class="col-check"><input type="checkbox" data-col="${escapeHtml(
            h
          )}" ${checked} /> ${escapeHtml(h)} <span class="type-badge">${
            col ? col.type : "text"
          }</span></label>`;
        })
        .join("");
      $("colChecks").querySelectorAll("input").forEach((inp) => {
        inp.onchange = () => {
          state.visible[inp.dataset.col] = !!inp.checked;
          saveVisiblePrefs();
          renderTable();
        };
      });
    }

    function toggleColPanel() {
      const panel = $("colPanel");
      panel.classList.toggle("hidden");
      if (!panel.classList.contains("hidden")) drawColPanel();
    }

    function exportCurrentView() {
      const vis = visibleHeaders();
      const list = filteredRows();
      const lines = [];
      lines.push(vis.map(csvEscape).join(","));
      list.forEach(({ r }) => {
        lines.push(
          vis
            .map((h) => {
              const raw = r[h];
              if (raw instanceof Date && !isNaN(raw)) return csvEscape(raw.toISOString().slice(0, 10));
              return csvEscape(raw);
            })
            .join(",")
        );
      });
      const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a");
      const base = (api.getFileName && api.getFileName()) || "dashboard-view";
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

    function build() {
      analyze();
      $("setup").classList.add("hidden");
      $("boardFleet").classList.add("hidden");
      $("boardGeneric").classList.remove("hidden");
      document.querySelectorAll(".board-only").forEach((el) => el.classList.remove("hidden"));
      api.updateLiveMeta("generic");
      api.syncMenuMode("generic");

      const types = state.cols.map((c) => c.type);
      const summary = ["number", "date", "category", "text"]
        .map((t) => {
          const n = types.filter((x) => x === t).length;
          return n ? `${n} ${t}` : null;
        })
        .filter(Boolean)
        .join(" · ");
      $("genericHint").textContent = summary || "Dashboard from header row";

      renderAll();
      $("colPanel").classList.add("hidden");
      persistView();
    }

    function wire() {
      $("searchGeneric").oninput = () => {
        state.search = $("searchGeneric").value;
        persistView();
        renderTable();
      };
      $("colsBtn").onclick = () => {
        if ($("colPanel").classList.contains("hidden")) toggleColPanel();
        else $("colPanel").classList.add("hidden");
      };
      $("sheetSelectGeneric").onchange = () => {
        api.useSheet($("sheetSelectGeneric").value);
        build();
        api.afterSheetChange && api.afterSheetChange();
      };
      document.addEventListener("click", (e) => {
        const panel = $("colPanel");
        if (
          panel &&
          !panel.classList.contains("hidden") &&
          !panel.contains(e.target) &&
          e.target !== $("colsBtn") &&
          !($("colsBtn") && $("colsBtn").contains(e.target))
        ) {
          panel.classList.add("hidden");
        }
      });
    }

    wire();

    return {
      build,
      refresh: build,
      headerHash,
      analyze,
      toggleColPanel,
      exportCurrentView,
      persistView,
      getViewState: () => ({
        sortKey: state.sortKey,
        sortDir: state.sortDir,
        visible: state.visible,
        catFilters: state.catFilters,
        dateFilters: state.dateFilters,
        search: state.search
      })
    };
  }

  global.FleetBoardGeneric = {
    create,
    headerHash,
    inferColumn,
    MODE_KEY_PREFIX,
    COLS_KEY_PREFIX,
    VIEW_KEY_PREFIX
  };
})(window);
