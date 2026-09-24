/* Generic Excel dashboard — header-driven types + auto KPIs */
(function (global) {
  "use strict";

  const COLS_KEY_PREFIX = "fleetboard-cols-v1:";
  const MODE_KEY_PREFIX = "fleetboard-mode-v1:";

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
    /* Avoid treating bare numbers / years as dates */
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

  function create(api) {
    const state = {
      cols: [],
      visible: {},
      search: "",
      sortKey: "",
      sortDir: 1,
      hash: ""
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
    }

    function analyze() {
      const headers = api.getHeaders();
      const rows = api.getRows();
      state.hash = headerHash(headers);
      state.visible = loadVisiblePrefs(state.hash, headers);
      state.cols = headers.map((h) => {
        const values = rows.map((r) => r[h]);
        return inferColumn(h, values);
      });
    }

    function visibleHeaders() {
      return api.getHeaders().filter((h) => state.visible[h] !== false);
    }

    function buildKpis() {
      const rows = api.getRows();
      const cards = [];
      cards.push({
        id: "rows",
        label: "Rows",
        value: rows.length,
        color: "var(--soft)",
        hint: `${state.cols.length} columns`
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
      dateCols.slice(0, 2).forEach((c) => {
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
          hint: `overdue · ${soon7} ≤7d · ${soon30} ≤30d`
        });
      });

      $("kpisGeneric").innerHTML = cards
        .map(
          (k) => `<div class="kpi" data-kpi="${escapeHtml(k.id)}">
        <div class="lbl">${escapeHtml(k.label)}</div>
        <div class="num" style="color:${k.color}">${escapeHtml(String(k.value))}</div>
        <div class="hint">${escapeHtml(k.hint)}</div>
      </div>`
        )
        .join("");

      /* Category top-value chips */
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
          .slice(0, 5);
        if (!top.length) return;
        chipHtml.push(
          `<div class="cat-group"><span class="cat-label">${escapeHtml(
            c.header
          )}</span>${top
            .map(
              (v) =>
                `<span class="chip muted cat-chip" data-col="${escapeHtml(
                  c.header
                )}" data-val="${escapeHtml(v)}">${escapeHtml(v)} · ${
                  counts[v]
                }</span>`
            )
            .join("")}</div>`
        );
      });
      $("catChips").innerHTML = chipHtml.join("");
      $("catChips").querySelectorAll(".cat-chip").forEach((el) => {
        el.onclick = () => {
          state.search = el.dataset.val || "";
          $("searchGeneric").value = state.search;
          renderTable();
        };
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

    function filteredRows() {
      const q = norm(state.search);
      const vis = visibleHeaders();
      let list = api.getRows().map((r, idx) => ({ r, idx }));
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

    function typeBadge(t) {
      return `<span class="type-badge">${t}</span>`;
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

      $("tableFootGeneric").textContent = `Showing ${list.length} of ${
        api.getRows().length
      } rows`;
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

    function build() {
      analyze();
      $("setup").classList.add("hidden");
      $("boardFleet").classList.add("hidden");
      $("boardGeneric").classList.remove("hidden");
      $("menuBtn").classList.remove("hidden");
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

      buildKpis();
      renderTable();
      $("colPanel").classList.add("hidden");
    }

    function wire() {
      $("searchGeneric").oninput = () => {
        state.search = $("searchGeneric").value;
        renderTable();
      };
      $("colsBoardBtn").onclick = () => toggleColPanel();
      $("colsBtn").onclick = () => {
        $("menu").classList.add("hidden");
        if ($("colPanel").classList.contains("hidden")) toggleColPanel();
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
          e.target !== $("colsBoardBtn") &&
          e.target !== $("colsBtn")
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
      analyze
    };
  }

  global.FleetBoardGeneric = {
    create,
    headerHash,
    inferColumn,
    MODE_KEY_PREFIX,
    COLS_KEY_PREFIX
  };
})(window);
