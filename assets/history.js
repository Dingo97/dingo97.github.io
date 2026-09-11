(() => {
  "use strict";
  function renderHistory(data, doc = document) {
    const container = doc.getElementById("history-content");
    if (!container) return;
    const it = doc.documentElement.lang === "it";
    const tr = (en, italian) => (it ? italian : en);
    const rows = (Array.isArray(data?.snapshots) ? data.snapshots : [])
      .filter((s) => s && /^\d{4}-\d{2}-\d{2}$/.test(s.date) && s.profile)
      .sort((a, b) => a.date.localeCompare(b.date));
    if (!rows.length) throw new Error("No recorded snapshots");
    const node = (tag, cls, text) => {
      const n = doc.createElement(tag);
      if (cls) n.className = cls;
      if (text != null) n.textContent = text;
      return n;
    };
    const fmt = (d) =>
      new Date(d + "T00:00:00Z").toLocaleDateString(it ? "it-IT" : "en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      });
    const safe = (v) =>
      typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;
    const first = rows[0],
      last = rows.at(-1);
    doc.getElementById("history-status").textContent = tr(
      `Recording since ${fmt(first.date)} · ${rows.length} snapshots`,
      `Rilevazioni dal ${fmt(first.date)} · ${rows.length} snapshot`,
    );
    container.replaceChildren();
    const summary = node("div", "history-summary");
    for (const [key, label] of [
      ["systemOwns", tr("system owns", "system owns")],
      ["userOwns", tr("user owns", "user owns")],
    ]) {
      const a = safe(first.profile[key]),
        b = safe(last.profile[key]);
      const p = node("p");
      p.append(
        node(
          "strong",
          "",
          a !== null && b !== null ? `${b - a >= 0 ? "+" : ""}${b - a}` : "—",
        ),
        doc.createTextNode(
          label + tr(" since first snapshot", " dalla prima rilevazione"),
        ),
      );
      summary.append(p);
    }
    container.append(summary);
    if (rows.length > 1) {
      const labels = {
        systemOwns: "System owns",
        userOwns: "User owns",
        ranking: tr(
          "Global rank (lower is better)",
          "Posizione globale (più bassa è meglio)",
        ),
      };
      const controls = node("div", "history-controls");
      controls.setAttribute("role", "group");
      controls.setAttribute(
        "aria-label",
        tr("Chart metric", "Metrica del grafico"),
      );
      const chart = node("div", "history-chart");
      chart.setAttribute("role", "group");
      chart.setAttribute(
        "aria-label",
        tr("Recorded profile statistics", "Statistiche del profilo registrate"),
      );
      const inspector = node("p", "history-inspector");
      inspector.setAttribute("aria-live", "polite");
      let metric = "systemOwns";
      const buttons = [];
      function draw() {
        chart.replaceChildren();
        buttons.forEach(([k, b]) =>
          b.setAttribute("aria-pressed", String(k === metric)),
        );
        const shown = rows.slice(-30);
        const max = Math.max(
          1,
          ...shown.map((r) => safe(r.profile[metric]) ?? 0),
        );
        shown.forEach((r, i) => {
          const value = safe(r.profile[metric]);
          const text = `${fmt(r.date)} · ${labels[metric]}: ${value ?? "—"}`;
          const b = node("button", "history-bar");
          b.type = "button";
          b.title = text;
          b.setAttribute("aria-label", text);
          b.setAttribute("aria-pressed", String(i === shown.length - 1));
          const fill = node("i");
          fill.style.height = (value === null ? 0 : (value / max) * 100) + "%";
          b.append(fill);
          b.addEventListener("click", () => {
            chart
              .querySelectorAll("button")
              .forEach((n) => n.setAttribute("aria-pressed", String(n === b)));
            inspector.textContent = text;
          });
          chart.append(b);
          if (i === shown.length - 1) inspector.textContent = text;
        });
      }
      for (const [key, label] of Object.entries(labels)) {
        const b = node("button", "", label);
        b.type = "button";
        b.addEventListener("click", () => {
          metric = key;
          draw();
        });
        buttons.push([key, b]);
        controls.append(b);
      }
      container.append(controls, chart, inspector);
      draw();
    }
    const details = node("details", "history-details");
    const summaryText = node(
      "summary",
      "text-link",
      tr("View recorded snapshots", "Vedi le rilevazioni registrate"),
    );
    details.append(summaryText);
    const wrap = node("div", "history-table-wrap");
    const table = node("table", "history-table");
    const caption = node(
      "caption",
      "sr-only",
      tr(
        "Recorded HTB profile snapshots",
        "Rilevazioni registrate del profilo HTB",
      ),
    );
    table.append(caption);
    const thead = node("thead");
    const heading = node("tr");
    for (const label of [
      tr("Date", "Data"),
      "Rank",
      "User owns",
      "System owns",
      tr("Global position", "Posizione globale"),
    ]) {
      const th = node("th", "", label);
      th.scope = "col";
      heading.append(th);
    }
    thead.append(heading);
    table.append(thead);
    const body = node("tbody");
    [...rows].reverse().forEach((r) => {
      const row = node("tr");
      [
        fmt(r.date),
        r.profile.rank || "—",
        safe(r.profile.userOwns) ?? "—",
        safe(r.profile.systemOwns) ?? "—",
        safe(r.profile.ranking) ?? "—",
      ].forEach((value) => row.append(node("td", "", String(value))));
      body.append(row);
    });
    table.append(body);
    wrap.append(table);
    details.append(wrap);
    container.append(details);
    if (rows.length === 1) details.open = true;
    const note =
      rows.length === 1
        ? tr(
            "The first snapshot is recorded. A trend will appear after the next daily update. Earlier activity has not been reconstructed.",
            "La prima rilevazione è registrata. Il grafico apparirà dopo il prossimo aggiornamento giornaliero. Le attività precedenti non sono state ricostruite.",
          )
        : tr(
            "The chart shows up to 30 recorded snapshots. Each bar is a recorded date; missing days are not estimated.",
            "Il grafico mostra fino a 30 rilevazioni. Ogni barra corrisponde a una data registrata; i giorni mancanti non sono stimati.",
          );
    container.append(node("p", "history-note", note));
  }
  async function loadHistory({
    doc = document,
    fetchImpl = fetch,
    timeoutMs = 8000,
  } = {}) {
    if (!doc.getElementById("history-content")) return;
    const it = doc.documentElement.lang === "it";
    const controller = new AbortController();
    let timer;
    try {
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error("timeout"));
        }, timeoutMs);
      });
      const request = (async () => {
        const r = await fetchImpl(
          (it ? "../" : "./") + "htb-history.json?v=" + Date.now(),
          { cache: "no-store", signal: controller.signal },
        );
        if (!r.ok) throw new Error("unavailable");
        return r.json();
      })();
      renderHistory(await Promise.race([request, timeout]), doc);
    } catch {
      doc.getElementById("history-status").textContent = it
        ? "Storico temporaneamente non disponibile"
        : "History temporarily unavailable";
      const p = doc.createElement("p");
      p.className = "htb-empty";
      p.textContent = it
        ? "Le statistiche e le attività recenti restano disponibili sopra."
        : "Profile statistics and recent activity remain available above.";
      doc.getElementById("history-content").replaceChildren(p);
    } finally {
      clearTimeout(timer);
    }
  }
  if (typeof module !== "undefined" && module.exports)
    module.exports = { renderHistory, loadHistory };
  else loadHistory();
})();
