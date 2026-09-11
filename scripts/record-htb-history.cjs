const fs = require("node:fs");
const path = require("node:path");

function appendSnapshot(history, data) {
  if (history.schemaVersion !== 1 || !Array.isArray(history.snapshots))
    throw new Error(
      "Invalid history schema; existing history was not changed.",
    );
  const stamp = new Date(data.updated);
  if (!data.profile || !Number.isFinite(stamp.getTime()))
    throw new Error("Missing profile or valid snapshot timestamp.");
  const count = (value) =>
    typeof value === "number" && Number.isFinite(value) && value >= 0
      ? value
      : null;
  const snapshot = {
    date: stamp.toISOString().slice(0, 10),
    recordedAt: stamp.toISOString(),
    profile: {
      rank: String(data.profile.rank || ""),
      userOwns: count(data.profile.userOwns),
      systemOwns: count(data.profile.systemOwns),
      ranking: count(data.profile.ranking),
      points: count(data.profile.points),
    },
  };
  const daily = new Map();
  for (const item of [...history.snapshots, snapshot]) {
    if (
      !item ||
      !/^\d{4}-\d{2}-\d{2}$/.test(item.date) ||
      !item.profile ||
      !Number.isFinite(Date.parse(item.recordedAt))
    )
      throw new Error("Invalid stored snapshot; refusing to discard history.");
    const previous = daily.get(item.date);
    if (
      !previous ||
      Date.parse(item.recordedAt) >= Date.parse(previous.recordedAt)
    )
      daily.set(item.date, item);
  }
  return {
    schemaVersion: 1,
    snapshots: [...daily.values()].sort((a, b) => a.date.localeCompare(b.date)),
  };
}

if (require.main === module) {
  const root = path.resolve(__dirname, "..");
  const file = path.join(root, "htb-history.json");
  const data = JSON.parse(
    fs.readFileSync(path.join(root, "htb-data.json"), "utf8"),
  );
  const history = fs.existsSync(file)
    ? JSON.parse(fs.readFileSync(file, "utf8"))
    : { schemaVersion: 1, snapshots: [] };
  const next = appendSnapshot(history, data);
  fs.writeFileSync(file, JSON.stringify(next, null, 2) + "\n");
  console.log(`HTB history: ${next.snapshots.length} dated snapshots.`);
}
module.exports = { appendSnapshot };
