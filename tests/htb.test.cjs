const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");
const {
  HTB_FALLBACK,
  getActivity,
  normalizeDifficulty,
  timeAgo,
  renderHTBData,
  loadHTBData,
} = require("../assets/htb.js");
const root = path.resolve(__dirname, "..");
const realData = JSON.parse(
  fs.readFileSync(path.join(root, "htb-data.json"), "utf8"),
);
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const makeDocument = () => new JSDOM(html).window.document;

test("the existing workflow JSON renders profile and eight most recent machines", () => {
  const doc = makeDocument();
  renderHTBData(realData, doc);
  assert.equal(
    doc.getElementById("htb-rank").textContent,
    realData.profile.rank,
  );
  assert.equal(
    doc.getElementById("htb-user-owns").textContent,
    String(realData.profile.userOwns),
  );
  assert.equal(
    doc.getElementById("htb-system-owns").textContent,
    String(realData.profile.systemOwns),
  );
  assert.equal(
    doc.getElementById("htb-global-rank").textContent,
    "#" + realData.profile.ranking,
  );
  assert.equal(
    doc.getElementById("htb-username").textContent,
    "@" + realData.profile.username,
  );
  assert.deepEqual(
    [...doc.querySelectorAll("#htb-machines .htb-machine-title")].map(
      (el) => el.textContent,
    ),
    realData.recentMachines.slice(0, 8).map((item) => item.name),
  );
  assert.match(doc.getElementById("htb-last-update").textContent, /^Updated:/);
});

test("challenges and Sherlocks remain merged chronologically and limited to eight", () => {
  const data = {
    recentChallenges: Array.from({ length: 9 }, (_, i) => ({
      name: "Challenge " + i,
      date: `2026-09-${String(i + 1).padStart(2, "0")}`,
      difficulty: "medium",
    })),
    recentSherlocks: [
      { name: "Sherlock latest", date: "2026-09-10", difficulty: "insane" },
    ],
  };
  const rows = getActivity(data);
  assert.equal(rows.length, 8);
  assert.equal(rows[0].name, "Sherlock latest");
  assert.equal(rows[0].kind, "DFIR");
  assert.equal(rows[1].name, "Challenge 8");
  assert.equal(rows[1].kind, "CTF");
  assert.equal(rows[0].difficulty, "insane");
});

test("older JSON without recentSherlocks and optional profile fields still renders", () => {
  const doc = makeDocument();
  renderHTBData(
    {
      profile: { username: "Dingooo", userOwns: 0, systemOwns: 0 },
      recentChallenges: [
        { name: "Legacy challenge", user_difficulty: "Very Easy" },
      ],
    },
    doc,
  );
  assert.equal(doc.getElementById("htb-user-owns").textContent, "0");
  assert.equal(doc.getElementById("htb-system-owns").textContent, "0");
  assert.equal(
    doc.querySelector("#htb-challenges .htb-machine-diff").textContent,
    "Easy",
  );
  assert.equal(doc.querySelectorAll("#htb-challenges .htb-machine").length, 1);
  assert.match(
    doc.getElementById("htb-machines").textContent,
    /No recent machines/,
  );
});

test("empty updates clear previous rows rather than leaving stale data or a spinner", () => {
  const doc = makeDocument();
  renderHTBData(realData, doc);
  renderHTBData(
    {
      profile: {},
      recentMachines: [],
      recentChallenges: [],
      recentSherlocks: [],
    },
    doc,
  );
  assert.equal(doc.querySelectorAll(".htb-machine").length, 0);
  assert.match(
    doc.getElementById("htb-challenges").textContent,
    /No recent challenges/,
  );
  assert.doesNotMatch(doc.getElementById("htb").textContent, /Loading/);
});

test("data is text, never executable markup; difficulty and OS classes are restricted", () => {
  const doc = makeDocument();
  const malicious = "<img src=x onerror=alert(1)>";
  renderHTBData(
    {
      profile: { username: malicious },
      recentMachines: [
        {
          name: malicious,
          os: '\" onclick=alert(1)',
          difficulty: '\"><script>alert(1)</script>',
        },
      ],
      recentChallenges: [{ name: malicious, difficulty: "hard" }],
    },
    doc,
  );
  assert.equal(
    doc.querySelectorAll(
      "#htb img, #htb script, #htb [onclick], #htb [onerror]",
    ).length,
    0,
  );
  assert.equal(
    doc.querySelector("#htb-machines .htb-machine-title").textContent,
    malicious,
  );
  assert.equal(
    doc.querySelector("#htb-machines .htb-machine-diff").className,
    "htb-machine-diff htb-diff-easy",
  );
});

test("difficulty aliases and relative dates handle valid, invalid and future values", () => {
  assert.equal(normalizeDifficulty("very_easy"), "easy");
  assert.equal(normalizeDifficulty("HARD"), "hard");
  assert.equal(normalizeDifficulty("not-a-difficulty"), "easy");
  const now = Date.parse("2026-09-11T12:00:00Z");
  assert.equal(timeAgo("2026-09-10T12:00:00Z", now), "a day ago");
  assert.equal(timeAgo("2026-09-11T11:00:00Z", now), "an hour ago");
  assert.equal(timeAgo("2027-01-01", now), "just now");
  assert.equal(timeAgo("invalid", now), "");
  assert.equal(timeAgo(null, now), "");
});

test("fetch uses the original root JSON URL and cache-busting contract", async () => {
  const doc = makeDocument();
  let url;
  const result = await loadHTBData({
    doc,
    fetchImpl: async (input, options) => {
      url = input;
      assert.equal(options.cache, "no-store");
      return { ok: true, json: async () => realData };
    },
  });
  assert.match(url, /^htb-data\.json\?v=\d+$/);
  assert.equal(result.source, "fresh");
  assert.equal(
    doc.getElementById("htb-system-owns").textContent,
    String(realData.profile.systemOwns),
  );
});

for (const [label, fetchImpl] of [
  [
    "network error",
    async () => {
      throw new Error("offline");
    },
  ],
  ["HTTP 404", async () => ({ ok: false })],
  [
    "invalid JSON",
    async () => ({
      ok: true,
      json: async () => {
        throw new Error("invalid");
      },
    }),
  ],
  [
    "missing profile",
    async () => ({ ok: true, json: async () => ({ error: "unavailable" }) }),
  ],
  [
    "null profile",
    async () => ({ ok: true, json: async () => ({ profile: null }) }),
  ],
  [
    "array profile",
    async () => ({ ok: true, json: async () => ({ profile: [] }) }),
  ],
])
  test(`${label} falls back to a clearly labelled saved snapshot`, async () => {
    const doc = makeDocument();
    const result = await loadHTBData({ doc, fetchImpl });
    assert.equal(result.source, "fallback");
    assert.equal(
      doc.getElementById("htb-system-owns").textContent,
      String(HTB_FALLBACK.profile.systemOwns),
    );
    assert.match(
      doc.getElementById("htb-last-update").textContent,
      /Saved snapshot:.*Latest update unavailable/,
    );
    assert.ok(doc.querySelectorAll("#htb-challenges .htb-machine").length > 0);
  });

test("a stalled response times out and the saved snapshot remains usable", async () => {
  const doc = makeDocument();
  let signal;
  const result = await loadHTBData({
    doc,
    timeoutMs: 10,
    fetchImpl: async (_, options) => {
      signal = options.signal;
      return new Promise(() => {});
    },
  });
  assert.equal(result.source, "fallback");
  assert.equal(signal.aborted, true);
});

test("malformed optional arrays and undated activity do not stop rendering", () => {
  const doc = makeDocument();
  renderHTBData(
    {
      profile: {},
      recentMachines: "invalid",
      recentSherlocks: [null, { name: "No date", difficulty: "insane" }],
      recentChallenges: { unexpected: true },
    },
    doc,
  );
  assert.equal(
    doc.querySelector("#htb-challenges .htb-machine-title").textContent,
    "No date",
  );
  assert.equal(doc.querySelectorAll("#htb-challenges time").length, 0);
});
