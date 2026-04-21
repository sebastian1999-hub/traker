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

function createTable(elId, columns, rows, defaultSortIndex = null, defaultDirection = "desc") {
  const table = document.getElementById(elId);
  const sortState = {
    index: defaultSortIndex,
    direction: defaultDirection,
  };

  const sortRows = () => {
    const sorted = [...rows];
    if (sortState.index === null || sortState.index === undefined) {
      return sorted;
    }

    const col = columns[sortState.index];
    sorted.sort((ra, rb) => {
      const cmp = compareValues(col.value(ra), col.value(rb));
      return sortState.direction === "asc" ? cmp : -cmp;
    });
    return sorted;
  };

  const render = () => {
    const sortedRows = sortRows();
    const head = `
      <thead>
        <tr>
          ${columns
            .map((c, idx) => {
              const active = sortState.index === idx;
              const marker = active ? (sortState.direction === "desc" ? " ▼" : " ▲") : "";
              return `<th class="sortable" data-col-index="${idx}">${c.label}${marker}</th>`;
            })
            .join("")}
        </tr>
      </thead>
    `;

    const bodyRows = sortedRows
      .map(
        (row) =>
          `<tr>${columns
            .map((c) => `<td>${c.format ? c.format(c.value(row), row) : String(c.value(row) ?? "")}</td>`)
            .join("")}</tr>`
      )
      .join("");

    table.innerHTML = `${head}<tbody>${bodyRows}</tbody>`;

    table.querySelectorAll("th.sortable").forEach((th) => {
      th.addEventListener("click", () => {
        const idx = Number(th.dataset.colIndex);
        if (sortState.index !== idx) {
          sortState.index = idx;
          sortState.direction = "desc";
        } else {
          sortState.direction = sortState.direction === "desc" ? "asc" : "desc";
        }
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
  createTable(
    "roomTypeTable",
    [
      { label: "Tipo", value: (r) => r.room_type, format: (v) => v },
      { label: "Visitas", value: (r) => r.visits, format: (v) => fmtNum(v) },
      { label: "Winrate", value: (r) => r.win_rate, format: (v) => fmtPct(v) },
    ],
    data.room_type_stats,
    1,
    "desc"
  );

  createTable(
    "encounterTable",
    [
      { label: "Encounter", value: (r) => r.encounter, format: (v) => v },
      { label: "Visitas", value: (r) => r.visits, format: (v) => fmtNum(v) },
      { label: "Winrate", value: (r) => r.win_rate, format: (v) => fmtPct(v) },
    ],
    data.encounter_stats.slice(0, 25),
    1,
    "desc"
  );

  createTable(
    "cardTable",
    [
      { label: "Carta", value: (r) => r.id, format: (v) => v },
      { label: "Runs", value: (r) => r.runs_with, format: (v) => fmtNum(v) },
      { label: "Winrate", value: (r) => r.win_rate, format: (v) => fmtPct(v) },
      { label: "Copias avg", value: (r) => r.avg_copies, format: (v) => Number(v).toFixed(2) },
    ],
    data.card_stats.slice(0, 25),
    1,
    "desc"
  );

  createTable(
    "relicTable",
    [
      { label: "Reliquia", value: (r) => r.id, format: (v) => v },
      { label: "Runs", value: (r) => r.runs_with, format: (v) => fmtNum(v) },
      { label: "Winrate", value: (r) => r.win_rate, format: (v) => fmtPct(v) },
      { label: "Copias avg", value: (r) => r.avg_copies, format: (v) => Number(v).toFixed(2) },
    ],
    data.relic_stats.slice(0, 25),
    1,
    "desc"
  );

  createTable(
    "runsTable",
    [
      { label: "Run ID", value: (r) => r.run_id, format: (v) => v },
      { label: "Character", value: (r) => r.character, format: (v) => v },
      { label: "Asc", value: (r) => r.ascension, format: (v) => v },
      { label: "Floor", value: (r) => r.floor_reached, format: (v) => v },
      { label: "Win", value: (r) => (r.win ? 1 : 0), format: (v) => (v ? "YES" : "NO") },
      { label: "Killed By", value: (r) => r.killed_by_encounter || "-", format: (v) => v },
    ],
    [...data.runs].reverse().slice(0, 40),
    0,
    "desc"
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
