const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");
const { appendSnapshot } = require("../scripts/record-htb-history.cjs");
const { renderHistory, loadHistory } = require("../assets/history.js");
const { loadHTBData } = require("../assets/htb.js");
const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const makeDoc = (it = false) =>
  new JSDOM(read(it ? "it/index.html" : "index.html")).window.document;
const data = (updated, owns = 10) => ({
  updated,
  profile: {
    rank: "Hacker",
    userOwns: owns,
    systemOwns: owns,
    ranking: 500,
    points: 0,
  },
});
const empty = () => ({ schemaVersion: 1, snapshots: [] });
const first = () => appendSnapshot(empty(), data("2026-09-11T06:00:00Z"));

test("daily history retains actual UTC dates, deduplicates reruns and keeps the latest same-day snapshot", () => {
  let history = first();
  assert.equal(history.snapshots.length, 1);
  assert.equal(history.snapshots[0].date, "2026-09-11");
  history = appendSnapshot(history, data("2026-09-11T10:00:00Z", 11));
  assert.equal(history.snapshots.length, 1);
  assert.equal(history.snapshots[0].profile.systemOwns, 11);
  history = appendSnapshot(history, data("2026-09-11T08:00:00Z", 9));
  assert.equal(history.snapshots[0].profile.systemOwns, 11);
  history = appendSnapshot(history, data("2026-09-13T06:00:00Z", 12));
  assert.deepEqual(
    history.snapshots.map((s) => s.date),
    ["2026-09-11", "2026-09-13"],
  );
  assert.equal(history.snapshots[0].profile.points, 0);
});

test("missing metrics remain unknown and corrupt history is rejected without mutating the input", () => {
  const history = first();
  const original = structuredClone(history);
  const next = data("2026-09-12T06:00:00Z");
  next.profile.systemOwns = "20";
  next.profile.points = -1;
  delete next.profile.userOwns;
  const result = appendSnapshot(history, next);
  assert.equal(result.snapshots[1].profile.systemOwns, null);
  assert.equal(result.snapshots[1].profile.userOwns, null);
  assert.equal(result.snapshots[1].profile.points, null);
  assert.deepEqual(history, original);
  assert.throws(() =>
    appendSnapshot({ schemaVersion: 1, snapshots: [null] }, next),
  );
  assert.throws(() => appendSnapshot(history, data("invalid")));
  assert.throws(() => appendSnapshot({ snapshots: [] }, next));
});

test("first historical snapshot is shown honestly without a fabricated trend", () => {
  const doc = makeDoc();
  renderHistory(first(), doc);
  assert.equal(doc.querySelectorAll(".history-table tbody tr").length, 1);
  assert.equal(doc.querySelector(".history-chart"), null);
  assert.equal(doc.querySelector(".history-details").open, true);
  assert.match(
    doc.querySelector(".history-note").textContent,
    /Earlier activity has not been reconstructed/,
  );
});

test("history metrics and individual dates update the chart inspection text", () => {
  const history = appendSnapshot(first(), data("2026-09-13T06:00:00Z", 12));
  const doc = makeDoc();
  renderHistory(history, doc);
  assert.equal(doc.querySelectorAll(".history-bar").length, 2);
  assert.match(
    doc.querySelector(".history-inspector").textContent,
    /13 Sept? 2026.*12/,
  );
  doc.querySelector(".history-bar").click();
  assert.match(
    doc.querySelector(".history-inspector").textContent,
    /11 Sept? 2026.*10/,
  );
  doc.querySelectorAll(".history-controls button")[2].click();
  assert.match(
    doc.querySelector(".history-inspector").textContent,
    /Global rank.*500/,
  );
  assert.equal(
    doc.querySelectorAll('.history-controls [aria-pressed="true"]').length,
    1,
  );
  assert.match(doc.querySelector(".history-summary").textContent, /\+2/);
});

test("history values render as text and missing values do not become zero progress", () => {
  const history = first();
  history.snapshots[0].profile.rank = "<img src=x onerror=alert(1)>";
  history.snapshots[0].profile.userOwns = null;
  const doc = makeDoc();
  renderHistory(history, doc);
  assert.equal(doc.querySelector("#history-content img"), null);
  assert.match(doc.querySelector(".history-summary").textContent, /—/);
});

for (const it of [false, true]) {
  test(`${it ? "Italian" : "English"} homepage loads current stats and history from the root JSON files`, async () => {
    const doc = makeDoc(it);
    const urls = [];
    const fetchImpl = async (url) => {
      urls.push(url);
      return {
        ok: true,
        json: async () =>
          url.includes("htb-history")
            ? first()
            : JSON.parse(read("htb-data.json")),
      };
    };
    const result = await loadHTBData({ doc, fetchImpl });
    await loadHistory({ doc, fetchImpl });
    assert.equal(result.source, "fresh");
    assert.equal(urls.length, 2);
    for (const url of urls)
      assert.equal(
        new URL(url, "https://dingo97.github.io/" + (it ? "it/" : "")).pathname,
        url.includes("htb-history") ? "/htb-history.json" : "/htb-data.json",
      );
    assert.match(
      doc.getElementById("htb-last-update").textContent,
      it ? /^Aggiornato:/ : /^Updated:/,
    );
    assert.match(
      doc.getElementById("history-status").textContent,
      it ? /Rilevazioni dal/ : /Recording since/,
    );
  });
}

test("history failure is independent of current HTB stats and has a bounded timeout", async () => {
  const doc = makeDoc(true);
  await loadHTBData({
    doc,
    fetchImpl: async () => ({
      ok: true,
      json: async () => JSON.parse(read("htb-data.json")),
    }),
  });
  const before = doc.getElementById("htb-machines").innerHTML;
  await loadHistory({
    doc,
    timeoutMs: 5,
    fetchImpl: () => new Promise(() => {}),
  });
  assert.match(
    doc.getElementById("history-status").textContent,
    /temporaneamente non disponibile/,
  );
  assert.equal(doc.getElementById("htb-machines").innerHTML, before);
  await loadHistory({
    doc,
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ snapshots: [] }),
    }),
  });
  assert.equal(doc.querySelectorAll("#history-content .htb-empty").length, 1);
});
