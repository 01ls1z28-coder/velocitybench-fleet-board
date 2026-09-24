/* VelocityBench Fleet Board — local Excel dashboard (browser-only) */
(function () {
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
  const IDB_NAME = "fleetboard-fsa-v1";
  const IDB_STORE = "handles";
  const IDB_KEY = "workbook";
  const POLL_MS = 4000;

  const state = {
    wb: null,
    rows: [],
    headers: [],
    map: {},
    sheet: "",
    filter: "",
    search: "",
    selected: -1,
    fileHandle: null,
    fileName: "",
    lastModified: 0,
    supportsFsa: typeof window.showOpenFilePicker === "function",
    autoCheck: true,
    pollTimer: null,
    locked: false
  };

  const $ = (id) => document.getElementById(id);

  /* ── IndexedDB handle persist (hand-roll) ── */
  function idbOpen() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function idbSetHandle(handle) {
    try {
      const db = await idbOpen();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, "readwrite");
        tx.objectStore(IDB_STORE).put(handle, IDB_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    } catch (_) { /* graceful */ }
  }

  async function idbGetHandle() {
    try {
      const db = await idbOpen();
      const handle = await new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, "readonly");
        const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
      db.close();
      return handle || null;
    } catch (_) {
      return null;
    }
  }

  async function idbClearHandle() {
    try {
      const db = await idbOpen();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, "readwrite");
        tx.objectStore(IDB_STORE).delete(IDB_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    } catch (_) { /* graceful */ }
  }

  async function ensurePermission(handle, mode) {
    if (!handle || !handle.queryPermission) return false;
    try {
      let status = await handle.queryPermission({ mode: mode || "read" });
      if (status === "granted") return true;
      status = await handle.requestPermission({ mode: mode || "read" });
      return status === "granted";
    } catch (_) {
      return false;
    }
  }

  /* ── UI helpers ── */
  function toast(msg) {
    const el = $("toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove("show"), 2200);
  }

  function setLockBanner(show) {
    state.locked = !!show;
    $("lockBanner").classList.toggle("hidden", !show);
  }

  function setFsaHint(show) {
    $("fsaHint").classList.toggle("hidden", !show);
  }

  function updateLiveMeta() {
    $("fileName").textContent = state.fileName || "Workbook";
    if (state.supportsFsa && state.fileHandle) {
      $("fileHint").textContent = "Live file handle · Chrome/Edge Refresh";
    } else if (state.fileName) {
      $("fileHint").textContent = "Fallback mode · re-choose file to refresh";
    } else {
      $("fileHint").textContent = "Local workbook";
    }
  }

  function showToastUpdated() {
    toast("Updated — refreshed");
  }

  /* ── File pick / load ── */
  async function pickWithFsa() {
    const [handle] = await window.showOpenFilePicker({
      multiple: false,
      types: [{
        description: "Excel / CSV",
        accept: {
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
          "application/vnd.ms-excel": [".xls", ".xlsm"],
          "text/csv": [".csv"]
        }
      }],
      excludeAcceptAllOption: false
    });
    state.fileHandle = handle;
    await idbSetHandle(handle);
    setFsaHint(false);
    await loadFromHandle(handle, { silent: false });
  }

  function pickWithInput() {
    $("file").value = "";
    $("file").click();
  }

  async function pickFile() {
    if (state.supportsFsa) {
      try {
        await pickWithFsa();
        return;
      } catch (err) {
        if (err && err.name === "AbortError") return;
        /* fall through to input */
      }
    }
    pickWithInput();
  }

  async function loadFromHandle(handle, opts) {
    opts = opts || {};
    try {
      const file = await handle.getFile();
      setLockBanner(false);
      state.fileName = file.name;
      state.lastModified = file.lastModified;
      updateLiveMeta();
      const buf = await file.arrayBuffer();
      await parseWorkbook(buf, { toastOnSuccess: !!opts.toastOnSuccess });
      startPoll();
      return true;
    } catch (err) {
      setLockBanner(true);
      if (!opts.silent) {
        /* banner already shown */
      }
      return false;
    }
  }

  function loadFileBlob(file) {
    state.fileHandle = null;
    state.fileName = file.name || "workbook";
    state.lastModified = file.lastModified || 0;
    updateLiveMeta();
    setFsaHint(!state.supportsFsa);
    const reader = new FileReader();
    reader.onload = (e) => {
      parseWorkbook(e.target.result, {}).catch((err) => {
        alert("Could not read that file.\n" + (err && err.message ? err.message : err));
      });
    };
    reader.onerror = () => {
      setLockBanner(true);
    };
    reader.readAsArrayBuffer(file);
  }

  async function parseWorkbook(buf, opts) {
    opts = opts || {};
    try {
      state.wb = XLSX.read(buf, { type: "array", cellDates: true });
      $("sheetSelect").innerHTML = state.wb.SheetNames.map((n) =>
        `<option>${escapeHtml(n)}</option>`
      ).join("");
      $("loader").classList.add("hidden");
      setLockBanner(false);
      useSheet(state.wb.SheetNames[0]);
      buildBoard();
      if (opts.toastOnSuccess) showToastUpdated();
    } catch (err) {
      alert("Could not read that file.\n" + (err && err.message ? err.message : err));
      throw err;
    }
  }

  async function refreshWorkbook() {
    if (state.fileHandle) {
      const okPerm = await ensurePermission(state.fileHandle, "read");
      if (!okPerm) {
        setFsaHint(true);
        toast("Permission needed — choose the workbook again");
        return;
      }
      const ok = await loadFromHandle(state.fileHandle, { toastOnSuccess: true, silent: false });
      if (!ok) return;
      return;
    }
    /* Fallback browsers: must re-prompt */
    setFsaHint(true);
    toast("This browser can’t keep a live file handle — choose the workbook again");
    pickWithInput();
  }

  function chooseExportCopy() {
    /* Same picker; user Save As / export CSV or XLSX without fighting Excel lock */
    pickFile();
  }

  /* ── Auto-check poll ── */
  function stopPoll() {
    if (state.pollTimer) {
      clearInterval(state.pollTimer);
      state.pollTimer = null;
    }
  }

  function startPoll() {
    stopPoll();
    if (!state.autoCheck || !state.fileHandle) return;
    state.pollTimer = setInterval(pollTick, POLL_MS);
  }

  async function pollTick() {
    if (!state.autoCheck || !state.fileHandle) return;
    if (document.visibilityState !== "visible") return;
    try {
      const file = await state.fileHandle.getFile();
      setLockBanner(false);
      if (file.lastModified !== state.lastModified) {
        state.lastModified = file.lastModified;
        state.fileName = file.name;
        updateLiveMeta();
        const buf = await file.arrayBuffer();
        await parseWorkbook(buf, { toastOnSuccess: true });
      }
    } catch (_) {
      setLockBanner(true);
    }
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      if (state.autoCheck && state.fileHandle) startPoll();
    } else {
      stopPoll();
    }
  });

  /* ── Sheet / mapper (1:1 from Jorge’s test) ── */
  function useSheet(name) {
    state.sheet = name;
    const data = XLSX.utils.sheet_to_json(state.wb.Sheets[name], {
      header: 1,
      defval: "",
      raw: false
    });
    const headerIdx = data.findIndex((r) => r.some((c) => String(c).trim() !== ""));
    state.headers = data[headerIdx].map((h) => String(h).trim());
    state.rows = data
      .slice(headerIdx + 1)
      .filter((r) => r.some((c) => String(c).trim() !== ""))
      .map((r) => {
        const o = {};
        state.headers.forEach((h, i) => {
          o[h] = r[i] == null ? "" : r[i];
        });
        return o;
      });
    guessMap();
    drawMapper();
  }

  function norm(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function guessMap() {
    const saved = JSON.parse(localStorage.getItem(MAP_KEY) || "{}");
    state.map = {};
    FIELDS.forEach((f) => {
      if (saved[f.key] && state.headers.includes(saved[f.key])) {
        state.map[f.key] = saved[f.key];
        return;
      }
      const exact = state.headers.find(
        (h) => norm(h) === norm(f.label) || f.aliases.includes(norm(h))
      );
      if (exact) {
        state.map[f.key] = exact;
        return;
      }
      state.map[f.key] =
        state.headers.find((h) => f.aliases.some((a) => norm(h).includes(a))) || "";
    });
  }

  function drawMapper() {
    $("mapGrid").innerHTML = FIELDS.map((f) => {
      const opts = [`<option value="">Not used</option>`]
        .concat(
          state.headers.map(
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

  function val(row, key) {
    return state.map[key] ? row[state.map[key]] : "";
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

  function buildBoard() {
    localStorage.setItem(MAP_KEY, JSON.stringify(state.map));
    $("setup").classList.add("hidden");
    $("board").classList.remove("hidden");
    $("menuBtn").classList.remove("hidden");
    updateLiveMeta();

    let overdue = 0,
      week = 0,
      thirty = 0,
      missing = 0,
      regOver = 0;
    const queue = [];
    state.rows.forEach((r, idx) => {
      const insp = inspInfo(r);
      const reg = regInfo(r);
      if (!insp) missing += 1;
      else {
        if (insp.n < 0) overdue += 1;
        else if (insp.n <= 7) week += 1;
        else if (insp.n <= 30) thirty += 1;
        if (insp.n <= 45) queue.push({ idx, r, insp });
      }
      if (reg && reg.n < 0) regOver += 1;
    });
    queue.sort((a, b) => a.insp.n - b.insp.n);

    $("kpis").innerHTML = [
      kpi(
        "fleet",
        "Units",
        state.rows.length,
        "var(--soft)",
        `${regOver} registration${regOver === 1 ? "" : "s"} overdue`
      ),
      kpi(
        "insp-overdue",
        "90-day overdue",
        overdue,
        overdue ? "var(--red)" : "var(--good)",
        "Inspection past due"
      ),
      kpi(
        "insp-week",
        "Due in 7 days",
        week,
        week ? "var(--warn)" : "var(--accent)",
        "Act this week"
      ),
      kpi(
        "insp-30",
        "Due in 30 days",
        thirty,
        thirty ? "var(--warn)" : "var(--accent)",
        "On the 90-day horizon"
      )
    ].join("");
    $("kpis").querySelectorAll(".kpi").forEach((el) => {
      el.onclick = () => {
        state.filter = el.dataset.kpi === "fleet" ? "" : el.dataset.kpi;
        $("statusFilter").value = state.filter;
        renderTable();
        $("kpis")
          .querySelectorAll(".kpi")
          .forEach((k) =>
            k.classList.toggle("active", k.dataset.kpi === el.dataset.kpi)
          );
      };
    });

    $("dueList").innerHTML =
      queue
        .slice(0, 8)
        .map(
          ({ idx, r, insp }) => `
        <div class="q-item" data-idx="${idx}">
          <div class="days ${tone(insp.n)}">${
            insp.n < 0 ? "OVERDUE" : insp.n + "d"
          }</div>
          <div>
            <b>Unit ${escapeHtml(String(val(r, "id") || "—"))}</b>
            <div class="meta">${escapeHtml(String(val(r, "make") || ""))}</div>
          </div>
          <div class="meta">${escapeHtml(String(val(r, "driver") || "No driver"))}</div>
          <div class="meta">${insp.date.toLocaleDateString()}<br>${daysLabel(
            insp.n
          )}</div>
        </div>`
        )
        .join("") ||
      `<div class="meta" style="padding:8px 0">No inspections due in the next 45 days.</div>`;
    $("dueList").querySelectorAll(".q-item").forEach((el) => {
      el.onclick = () => openRow(+el.dataset.idx);
    });
    renderTable();
  }

  function kpi(id, label, value, color, hint) {
    return `<div class="kpi" data-kpi="${id}">
      <div class="lbl">${label}</div>
      <div class="num" style="color:${color}">${value}</div>
      <div class="hint">${hint}</div>
    </div>`;
  }

  function visibleRows() {
    const q = norm(state.search);
    return state.rows
      .map((r, idx) => ({ r, idx }))
      .filter(({ r }) => {
        const insp = inspInfo(r);
        const reg = regInfo(r);
        if (state.filter === "insp-overdue" && !(insp && insp.n < 0)) return false;
        if (state.filter === "insp-week" && !(insp && insp.n >= 0 && insp.n <= 7))
          return false;
        if (state.filter === "insp-30" && !(insp && insp.n >= 0 && insp.n <= 30))
          return false;
        if (state.filter === "reg-overdue" && !(reg && reg.n < 0)) return false;
        if (state.filter === "missing" && insp) return false;
        if (!q) return true;
        return ["id", "year", "make", "plate", "vid", "driver", "notes"].some((k) =>
          norm(val(r, k)).includes(q)
        );
      })
      .sort((a, b) => {
        const an = inspInfo(a.r),
          bn = inspInfo(b.r);
        if (!an && !bn) return 0;
        if (!an) return 1;
        if (!bn) return -1;
        return an.n - bn.n;
      });
  }

  function renderTable() {
    const cols = ["id", "insp", "year", "make", "driver", "reg", "plate", "vid", "notes"].filter(
      (k) => state.map[k]
    );
    const labels = {
      id: "Unit#",
      year: "Year",
      make: "MAKE/MODEL",
      plate: "License#",
      vid: "Vehicle ID#",
      reg: "Reg. Exp",
      insp: "90 Day Insp.",
      driver: "Driver",
      notes: "Notes"
    };
    const rows = visibleRows();
    $("thead").innerHTML =
      "<tr>" + cols.map((k) => `<th>${labels[k]}</th>`).join("") + "</tr>";
    $("tbody").innerHTML = rows
      .map(({ r, idx }) => {
        const cells = cols
          .map((k) => {
            if (k === "insp" || k === "reg") {
              const info = k === "insp" ? inspInfo(r) : regInfo(r);
              if (!info)
                return `<td><span class="chip muted">No date</span></td>`;
              return `<td><span class="chip ${tone(
                info.n
              )}">${info.date.toLocaleDateString()}</span><div class="meta">${daysLabel(
                info.n
              )}</div></td>`;
            }
            if (k === "make")
              return `<td class="wrap">${escapeHtml(String(val(r, k) || "—"))}</td>`;
            if (k === "notes")
              return `<td class="notes">${escapeHtml(String(val(r, k) || "—"))}</td>`;
            return `<td>${escapeHtml(String(val(r, k) || "—"))}</td>`;
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
    const r = state.rows[idx];
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
        insp ? `${insp.date.toLocaleDateString()} · ${daysLabel(insp.n)}` : ""
      ],
      ["Reg. Exp", fmt(val(r, "reg"))],
      ["Driver", val(r, "driver") || "Unassigned"],
      ["Notes", val(r, "notes")]
    ].filter(([, v]) => v);
    $("drawer").innerHTML = `
      <button class="icon-btn" id="closeDrawer" type="button" style="float:right" aria-label="Close">✕</button>
      <div class="chip ${badge[0]}">${badge[1]}</div>
      <h2>Unit ${escapeHtml(String(val(r, "id") || ""))}</h2>
      <div class="kv">${fields
        .map(([k, v]) => `<span>${k}</span><b>${escapeHtml(String(v))}</b>`)
        .join("")}</div>`;
    $("drawer").classList.add("open");
    $("backdrop").classList.remove("hidden");
    $("closeDrawer").onclick = closeDrawer;
  }

  function fmt(v) {
    const d = parseDate(v);
    return d ? d.toLocaleDateString() : v;
  }

  function closeDrawer() {
    $("drawer").classList.remove("open");
    $("backdrop").classList.add("hidden");
  }

  function escapeHtml(s) {
    return String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;"
        }[c])
    );
  }

  function escapeAttr(s) {
    return escapeHtml(s);
  }

  /* ── Wire UI ── */
  $("pickBtn").onclick = () => pickFile();
  $("file").onchange = (e) => {
    if (e.target.files[0]) {
      state.fileHandle = null;
      loadFileBlob(e.target.files[0]);
    }
  };
  const drop = $("drop");
  ["dragenter", "dragover"].forEach((ev) =>
    drop.addEventListener(ev, (e) => {
      e.preventDefault();
      drop.classList.add("drag");
    })
  );
  ["dragleave", "drop"].forEach((ev) =>
    drop.addEventListener(ev, (e) => {
      e.preventDefault();
      drop.classList.remove("drag");
    })
  );
  drop.addEventListener("drop", (e) => {
    if (e.dataTransfer.files[0]) {
      state.fileHandle = null;
      loadFileBlob(e.dataTransfer.files[0]);
    }
  });

  $("menuBtn").onclick = () => $("menu").classList.toggle("hidden");
  $("chooseOtherBtn").onclick = async () => {
    $("menu").classList.add("hidden");
    await idbClearHandle();
    state.fileHandle = null;
    stopPoll();
    location.reload();
  };
  $("chooseExportBtn").onclick = () => {
    $("menu").classList.add("hidden");
    chooseExportCopy();
  };
  $("remapBtn").onclick = () => {
    $("menu").classList.add("hidden");
    $("board").classList.add("hidden");
    $("setup").classList.remove("hidden");
  };
  $("remapBoardBtn").onclick = () => {
    $("board").classList.add("hidden");
    $("setup").classList.remove("hidden");
  };
  $("applyMap").onclick = buildBoard;
  $("sheetSelect").onchange = () => useSheet($("sheetSelect").value);
  $("search").oninput = () => {
    state.search = $("search").value;
    renderTable();
  };
  $("statusFilter").onchange = () => {
    state.filter = $("statusFilter").value;
    renderTable();
  };
  $("backdrop").onclick = closeDrawer;
  $("refreshBtn").onclick = () => refreshWorkbook();
  $("lockRetryBtn").onclick = () => refreshWorkbook();
  $("lockExportBtn").onclick = () => chooseExportCopy();
  $("fsaRepickBtn").onclick = () => pickFile();
  $("autoCheck").onchange = (e) => {
    state.autoCheck = !!e.target.checked;
    if (state.autoCheck) startPoll();
    else stopPoll();
  };

  document.addEventListener("click", (e) => {
    if (!$("menu").contains(e.target) && e.target !== $("menuBtn")) {
      $("menu").classList.add("hidden");
    }
  });

  /* Restore FSA handle on load when possible */
  (async function restoreHandle() {
    if (!state.supportsFsa) return;
    const handle = await idbGetHandle();
    if (!handle) return;
    const ok = await ensurePermission(handle, "read");
    if (!ok) return;
    state.fileHandle = handle;
    await loadFromHandle(handle, { silent: true });
  })();
})();
