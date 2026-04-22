const PALETTE = {
  a: "#0f766e",
  b: "#e86f2d",
  c: "#1456a4",
  d: "#11a579",
  e: "#f5a623",
  f: "#6a4c93",
};

function fmtPct(v) {
  return `${Number(v || 0).toFixed(2)}%`;
}

function fmtNum(v) {
  return Number(v || 0).toLocaleString("es-ES");
}

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function relicSpritePath(relicId) {
  const raw = String(relicId ?? "");
  const token = raw.includes(".") ? raw.split(".")[1] : raw;
  const slug = token
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `sprites/relics/${slug}.png`;
}

function renderRelicNameCell(_value, row) {
  const name = escapeHtml(row.name || row.id || "-");
  const iconPath = relicSpritePath(row.id);
  return `<span class="relic-name-cell"><img class="relic-icon" src="${iconPath}" alt="${name}" loading="lazy" onerror="this.style.display='none'" /><span>${name}</span></span>`;
}

function compareValues(a, b) {
  const av = a ?? "";
  const bv = b ?? "";

  const aNum = Number(av);
  const bNum = Number(bv);
  const aIsNum = Number.isFinite(aNum) && av !== "";
  const bIsNum = Number.isFinite(bNum) && bv !== "";

  if (aIsNum && bIsNum) {
    return aNum - bNum;
  }

  return String(av).localeCompare(String(bv), "es", {
    numeric: true,
    sensitivity: "base",
  });
}

function createTable(
  elId,
  columns,
  rows,
  defaultSortIndex = null,
  defaultDirection = "desc",
  pageSize = 12
) {
  const table = document.getElementById(elId);
  const pagerId = `${elId}Pager`;
  let pager = document.getElementById(pagerId);
  if (!pager) {
    pager = document.createElement("div");
    pager.id = pagerId;
    pager.className = "table-pager";
    table.insertAdjacentElement("afterend", pager);
  }

  const sortState = {
    rules:
      defaultSortIndex === null || defaultSortIndex === undefined
        ? []
        : [{ index: defaultSortIndex, direction: defaultDirection }],
  };
  const pageState = {
    current: 1,
    size: Math.max(1, Number(pageSize) || 12),
  };

  const findRuleIndex = (idx) => sortState.rules.findIndex((r) => r.index === idx);

  const toggleRule = (idx, additive = true) => {
    const existing = findRuleIndex(idx);

    if (additive) {
      if (existing === -1) {
        sortState.rules.push({ index: idx, direction: "desc" });
      } else {
        const dir = sortState.rules[existing].direction;
        if (dir === "desc") {
          sortState.rules[existing].direction = "asc";
        } else {
          sortState.rules.splice(existing, 1);
        }
      }
      return;
    }

    if (sortState.rules.length === 1 && existing === 0) {
      const dir = sortState.rules[0].direction;
      if (dir === "desc") {
        sortState.rules[0].direction = "asc";
      } else {
        sortState.rules = [];
      }
      return;
    }

    if (existing !== -1) {
      const dir = sortState.rules[existing].direction;
      sortState.rules = [{ index: idx, direction: dir === "desc" ? "asc" : "desc" }];
    } else {
      sortState.rules = [{ index: idx, direction: "desc" }];
    }
  };

  const sortRows = () => {
    const sorted = [...rows];
    if (!sortState.rules.length) {
      return sorted;
    }

    sorted.sort((ra, rb) => {
      for (const rule of sortState.rules) {
        const col = columns[rule.index];
        const cmp = compareValues(col.value(ra), col.value(rb));
        if (cmp !== 0) {
          return rule.direction === "asc" ? cmp : -cmp;
        }
      }
      return 0;
    });
    return sorted;
  };

  const render = () => {
    const sortedRows = sortRows();
    const totalRows = sortedRows.length;
    const totalPages = Math.max(1, Math.ceil(totalRows / pageState.size));
    if (pageState.current > totalPages) {
      pageState.current = totalPages;
    }

    const start = (pageState.current - 1) * pageState.size;
    const pageRows = sortedRows.slice(start, start + pageState.size);

    const head = `
      <thead>
        <tr>
          ${columns
            .map((c, idx) => {
              const rulePos = findRuleIndex(idx);
              const active = rulePos !== -1;
              const marker = active ? (sortState.rules[rulePos].direction === "desc" ? " ▼" : " ▲") : "";
              const priority = active ? `<span class="sort-priority">${rulePos + 1}</span>` : "";
              return `<th class="sortable" data-col-index="${idx}">${c.label}${marker}${priority}</th>`;
            })
            .join("")}
        </tr>
      </thead>
    `;

    const bodyRows = pageRows
      .map(
        (row) =>
          `<tr>${columns
            .map((c) => `<td>${c.format ? c.format(c.value(row), row) : String(c.value(row) ?? "")}</td>`)
            .join("")}</tr>`
      )
      .join("");

    table.innerHTML = `${head}<tbody>${bodyRows}</tbody>`;
    const sortHint = sortState.rules.length
      ? sortState.rules
          .map((r, i) => `${i + 1}. ${columns[r.index].label} ${r.direction === "desc" ? "desc" : "asc"}`)
          .join(" | ")
      : "Sin orden activo";
    const sortUsage = "Click: combina criterios | Alt/Ctrl/Cmd+Click: solo esta columna";
    pager.innerHTML = `
      <div class="table-pager-meta">${fmtNum(totalRows)} filas | Pag ${pageState.current}/${totalPages}</div>
      <div class="table-sort-hint">Orden: ${sortHint} · ${sortUsage}</div>
      <div class="table-pager-controls">
        <button type="button" data-action="clear-sort" ${sortState.rules.length ? "" : "disabled"}>Limpiar orden</button>
        <button type="button" data-action="first" ${pageState.current === 1 ? "disabled" : ""}>«</button>
        <button type="button" data-action="prev" ${pageState.current === 1 ? "disabled" : ""}>‹</button>
        <button type="button" data-action="next" ${pageState.current === totalPages ? "disabled" : ""}>›</button>
        <button type="button" data-action="last" ${pageState.current === totalPages ? "disabled" : ""}>»</button>
      </div>
    `;

    table.querySelectorAll("th.sortable").forEach((th) => {
      th.addEventListener("click", (event) => {
        const idx = Number(th.dataset.colIndex);
        const useSingleSort = event.altKey || event.ctrlKey || event.metaKey;
        toggleRule(idx, !useSingleSort);
        pageState.current = 1;
        render();
      });
    });

    pager.querySelectorAll("button[data-action]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const action = btn.dataset.action;
        if (action === "clear-sort") {
          sortState.rules = [];
        }
        if (action === "first") pageState.current = 1;
        if (action === "prev") pageState.current = Math.max(1, pageState.current - 1);
        if (action === "next") pageState.current = Math.min(totalPages, pageState.current + 1);
        if (action === "last") pageState.current = totalPages;
        render();
      });
    });
  };

  render();
}

function mountKpis(overview) {
  const kpis = [
    { label: "Total Runs", value: fmtNum(overview.total_runs) },
    { label: "Win Rate", value: fmtPct(overview.win_rate) },
    { label: "Wins", value: fmtNum(overview.total_wins) },
    { label: "Avg Min/Run", value: Number(overview.avg_run_minutes || 0).toFixed(2) },
    { label: "Avg Floor", value: Number(overview.avg_floor_reached || 0).toFixed(2) },
  ];

  const host = document.getElementById("kpis");
  host.innerHTML = kpis
    .map(
      (k) =>
        `<article class="kpi"><div class="kpi-label">${k.label}</div><div class="kpi-value">${k.value}</div></article>`
    )
    .join("");
}

function buildWinrateChart(data) {
  const select = document.getElementById("characterSelect");
  const labels = ["OVERALL", ...Object.keys(data.winrate_over_time.by_character).sort()];
  select.innerHTML = labels.map((l) => `<option value="${l}">${l}</option>`).join("");

  const ctx = document.getElementById("winrateChart");
  let chart;

  const render = (key) => {
    const points = key === "OVERALL" ? data.winrate_over_time.overall : data.winrate_over_time.by_character[key] || [];
    const chartData = {
      labels: points.map((p) => p.runs),
      datasets: [
        {
          label: `Winrate ${key}`,
          data: points.map((p) => p.win_rate),
          borderColor: PALETTE.a,
          backgroundColor: "rgba(15,118,110,0.18)",
          tension: 0.25,
          pointRadius: 0,
          fill: true,
        },
      ],
    };

    if (chart) chart.destroy();
    chart = new Chart(ctx, {
      type: "line",
      data: chartData,
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
        },
        scales: {
          y: { min: 0, max: 100, ticks: { callback: (v) => `${v}%` } },
          x: { title: { display: true, text: "Numero de partida acumulada" } },
        },
      },
    });
  };

  select.addEventListener("change", (e) => render(e.target.value));
  render("OVERALL");
}

function buildCharacterChart(data) {
  const ctx = document.getElementById("characterChart");
  const rows = data.overview.by_character;
  new Chart(ctx, {
    type: "bar",
    data: {
      labels: rows.map((r) => r.character),
      datasets: [
        {
          label: "Win Rate",
          data: rows.map((r) => r.win_rate),
          backgroundColor: [PALETTE.a, PALETTE.b, PALETTE.c, PALETTE.d, PALETTE.e],
        },
      ],
    },
    options: {
      plugins: { legend: { display: false } },
      scales: { y: { min: 0, max: 100 } },
    },
  });
}

function buildAscensionChart(data) {
  const ctx = document.getElementById("ascensionChart");
  const rows = data.overview.by_ascension;
  new Chart(ctx, {
    type: "bar",
    data: {
      labels: rows.map((r) => `A${r.ascension}`),
      datasets: [
        {
          label: "Runs",
          data: rows.map((r) => r.runs),
          backgroundColor: PALETTE.c,
        },
      ],
    },
    options: {
      plugins: { legend: { display: false } },
    },
  });
}

function buildFloorChart(data) {
  const ctx = document.getElementById("floorChart");
  const floorStats = data.floor_stats;
  new Chart(ctx, {
    type: "line",
    data: {
      labels: floorStats.map((r) => r.floor),
      datasets: [
        {
          label: "Win Rate desde ese piso",
          data: floorStats.map((r) => r.win_rate_from_here),
          borderColor: PALETTE.b,
          pointRadius: 0,
          tension: 0.25,
          yAxisID: "y",
        },
        {
          label: "Survival Rate",
          data: floorStats.map((r) => r.survival_rate),
          borderColor: PALETTE.a,
          pointRadius: 0,
          tension: 0.25,
          yAxisID: "y",
        },
      ],
    },
    options: {
      responsive: true,
      scales: {
        y: { min: 0, max: 100, ticks: { callback: (v) => `${v}%` } },
      },
    },
  });
}

function mountTables(data) {
  const detailCharacterSelect = document.getElementById("detailCharacterSelect");
  const characterOptions = [
    { key: "ALL", label: "ALL CHARACTERS" },
    ...data.overview.by_character.map((c) => ({ key: c.character, label: c.character_name || c.character })),
  ];

  detailCharacterSelect.innerHTML = characterOptions
    .map((c) => `<option value="${c.key}">${c.label}</option>`)
    .join("");

  const renderDetailTables = (selectedCharacter) => {
    const encounterRows =
      selectedCharacter === "ALL"
        ? data.encounter_stats
        : data.encounter_stats_by_character[selectedCharacter] || [];

    const cardRows =
      selectedCharacter === "ALL"
        ? data.card_stats
        : data.card_stats_by_character[selectedCharacter] || [];

    const relicRows =
      selectedCharacter === "ALL"
        ? data.relic_stats
        : data.relic_stats_by_character[selectedCharacter] || [];

    createTable(
      "encounterTable",
      [
        { label: "Encounter", value: (r) => r.encounter_name, format: (v) => v },
        { label: "Visitas", value: (r) => r.visits, format: (v) => fmtNum(v) },
        { label: "Winrate", value: (r) => r.win_rate, format: (v) => fmtPct(v) },
      ],
      encounterRows,
      1,
      "desc",
      12
    );

    createTable(
      "cardTable",
      [
        { label: "Carta", value: (r) => r.name, format: (v) => v },
        { label: "Ofrecida", value: (r) => r.offered, format: (v) => fmtNum(v) },
        { label: "Elegida", value: (r) => r.picked, format: (v) => fmtNum(v) },
        { label: "Pick Rate", value: (r) => r.pick_rate, format: (v) => fmtPct(v) },
        { label: "Runs", value: (r) => r.runs_with, format: (v) => fmtNum(v) },
        { label: "Winrate", value: (r) => r.win_rate, format: (v) => fmtPct(v) },
        { label: "Copias avg", value: (r) => r.avg_copies, format: (v) => Number(v).toFixed(2) },
      ],
      cardRows,
      3,
      "desc",
      12
    );

    createTable(
      "relicTable",
      [
        { label: "Reliquia", value: (r) => r.name, format: renderRelicNameCell },
        { label: "Ofrecida", value: (r) => r.offered, format: (v) => fmtNum(v) },
        { label: "Elegida", value: (r) => r.picked, format: (v) => fmtNum(v) },
        { label: "Pick Rate", value: (r) => r.pick_rate, format: (v) => fmtPct(v) },
        { label: "Runs", value: (r) => r.runs_with, format: (v) => fmtNum(v) },
        { label: "Winrate", value: (r) => r.win_rate, format: (v) => fmtPct(v) },
        { label: "Copias avg", value: (r) => r.avg_copies, format: (v) => Number(v).toFixed(2) },
      ],
      relicRows,
      3,
      "desc",
      12
    );
  };

  createTable(
    "roomTypeTable",
    [
      { label: "Tipo", value: (r) => r.room_type_name, format: (v) => v },
      { label: "Visitas", value: (r) => r.visits, format: (v) => fmtNum(v) },
      { label: "Winrate", value: (r) => r.win_rate, format: (v) => fmtPct(v) },
    ],
    data.room_type_stats,
    1,
    "desc",
    8
  );

  renderDetailTables("ALL");

  detailCharacterSelect.addEventListener("change", (e) => {
    renderDetailTables(e.target.value);
  });

  createTable(
    "runsTable",
    [
      { label: "Run ID", value: (r) => r.run_id, format: (v) => v },
      { label: "Character", value: (r) => r.character_name || r.character, format: (v) => v },
      { label: "Asc", value: (r) => r.ascension, format: (v) => v },
      { label: "Floor", value: (r) => r.floor_reached, format: (v) => v },
      { label: "Win", value: (r) => (r.win ? 1 : 0), format: (v) => (v ? "YES" : "NO") },
      { label: "Killed By", value: (r) => r.killed_by_encounter_name || "-", format: (v) => v },
    ],
    [...data.runs].reverse(),
    0,
    "desc",
    15
  );
}

async function init() {
  const res = await fetch("data/dashboard_data.json", { cache: "no-store" });
  const data = await res.json();

  const metaLine = document.getElementById("metaLine");
  metaLine.textContent = `Build: ${data.meta.generated_at} | Runs: ${data.meta.total_runs}`;

  mountKpis(data.overview);
  buildWinrateChart(data);
  buildCharacterChart(data);
  buildAscensionChart(data);
  buildFloorChart(data);
  mountTables(data);
}

init().catch((err) => {
  const metaLine = document.getElementById("metaLine");
  metaLine.textContent = `Error cargando dashboard_data.json: ${err.message}`;
});
