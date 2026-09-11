/* Reads the existing update-htb.yml output. Keep htb-data.json at the site root. */
(() => {
  "use strict";
  // A labelled snapshot is available even when the JSON request fails.
  const HTB_FALLBACK = {
    updated: "2026-09-10T10:17:32.332Z",
    profile: {
      username: "Dingooo",
      rank: "Hacker",
      nextRank: "Pro Hacker",
      rankProgress: 0,
      points: 7,
      ranking: 1021,
      userOwns: 35,
      systemOwns: 25,
      country: "IT",
      joinedDate: "2019-02-26",
    },
    recentMachines: [
      {
        name: "Connected",
        os: "linux",
        difficulty: "easy",
        date: "2026-06-16T19:47:56.000Z",
      },
      {
        name: "Reactor",
        os: "linux",
        difficulty: "easy",
        date: "2026-05-29T13:44:31.000Z",
      },
      {
        name: "Kobold",
        os: "linux",
        difficulty: "easy",
        date: "2026-03-24T21:07:11.000Z",
      },
      {
        name: "VariaType",
        os: "linux",
        difficulty: "medium",
        date: "2026-03-15T10:32:28.000Z",
      },
      {
        name: "CCTV",
        os: "linux",
        difficulty: "easy",
        date: "2026-03-08T16:44:22.000Z",
      },
      {
        name: "Eighteen",
        os: "windows",
        difficulty: "easy",
        date: "2026-02-26T17:27:58.000Z",
      },
      {
        name: "Interpreter",
        os: "linux",
        difficulty: "medium",
        date: "2026-02-23T13:02:26.000Z",
      },
      {
        name: "Pterodactyl",
        os: "linux",
        difficulty: "medium",
        date: "2026-02-18T22:33:53.000Z",
      },
      {
        name: "WingData",
        os: "linux",
        difficulty: "easy",
        date: "2026-02-17T13:52:50.000Z",
      },
      {
        name: "Facts",
        os: "linux",
        difficulty: "easy",
        date: "2026-02-03T11:30:20.000Z",
      },
    ],
    recentChallenges: [
      {
        name: "Bobby's Bistro",
        category: "Web",
        difficulty: "easy",
        date: "2026-06-25T15:16:16.000Z",
      },
      {
        name: "GameLoader",
        category: "Reversing",
        difficulty: "easy",
        date: "2026-06-25T14:03:50.000Z",
      },
      {
        name: "Plug & Pray",
        category: "Hardware",
        difficulty: "easy",
        date: "2026-06-25T13:42:41.000Z",
      },
      {
        name: "OpenSecret",
        category: "Web",
        difficulty: "easy",
        date: "2026-02-18T23:15:13.000Z",
      },
      {
        name: "Spookifier",
        category: "Web",
        difficulty: "easy",
        date: "2026-02-18T23:13:06.000Z",
      },
      {
        name: "Flag Command",
        category: "Web",
        difficulty: "easy",
        date: "2026-02-18T22:51:45.000Z",
      },
      {
        name: "Magical Palindrome",
        category: "Web",
        difficulty: "easy",
        date: "2026-01-25T18:43:22.000Z",
      },
      {
        name: "SpookyPass",
        category: "Reversing",
        difficulty: "easy",
        date: "2026-01-25T17:57:40.000Z",
      },
    ],
    recentSherlocks: [
      {
        name: "Stonks",
        category: "DFIR",
        difficulty: "insane",
        date: "2026-06-24T14:38:57.000Z",
      },
      {
        name: "JobApplicant",
        category: "DFIR",
        difficulty: "hard",
        date: "2026-06-24T10:11:52.000Z",
      },
      {
        name: "Antarctica",
        category: "Malware Analysis",
        difficulty: "medium",
        date: "2026-06-24T09:31:57.000Z",
      },
      {
        name: "Brutus",
        category: "DFIR",
        difficulty: "easy",
        date: "2026-06-24T08:53:56.000Z",
      },
    ],
  };

  function normalizeDifficulty(value) {
    const raw = String(value || "")
      .toLowerCase()
      .replace(/[_\s]+/g, "-");
    if (raw === "very-easy") return "easy";
    return ["easy", "medium", "hard", "insane"].includes(raw) ? raw : "easy";
  }

  function timeAgo(dateStr, now = Date.now()) {
    if (!dateStr) return "";
    const then = new Date(dateStr).getTime();
    if (!Number.isFinite(then)) return "";
    const hours = Math.floor(Math.max(0, now - then) / 3600000);
    if (hours < 1) return "just now";
    if (hours === 1) return "an hour ago";
    if (hours < 24) return hours + " hours ago";
    const days = Math.floor(hours / 24);
    if (days === 1) return "a day ago";
    if (days < 30) return days + " days ago";
    const months = Math.floor(days / 30);
    if (months === 1) return "a month ago";
    if (months < 12) return months + " months ago";
    const years = Math.floor(days / 365);
    return years <= 1 ? "a year ago" : years + " years ago";
  }

  const safeItems = (value) =>
    Array.isArray(value)
      ? value.filter(
          (item) =>
            item &&
            typeof item === "object" &&
            typeof item.name === "string" &&
            item.name.trim(),
        )
      : [];
  const timestamp = (value) => new Date(value || 0).getTime() || 0;

  function getActivity(data) {
    const challenges = safeItems(data.recentChallenges).map((item) => ({
      ...item,
      kind: "CTF",
      difficulty: normalizeDifficulty(
        item.difficulty ||
          item.user_difficulty ||
          item.difficultyText ||
          item.category,
      ),
    }));
    const sherlocks = safeItems(data.recentSherlocks).map((item) => ({
      ...item,
      kind: "DFIR",
      difficulty: normalizeDifficulty(
        item.difficulty || item.difficultyText || item.category,
      ),
    }));
    return challenges
      .concat(sherlocks)
      .sort((a, b) => timestamp(b.date) - timestamp(a.date))
      .slice(0, 8);
  }

  function renderHTBData(data, doc = document, source = "fresh") {
    const setText = (id, value) => {
      const element = doc.getElementById(id);
      if (element) element.textContent = String(value);
    };
    const profile = data.profile || {};
    setText("htb-rank", profile.rank || "—");
    setText("htb-user-owns", profile.userOwns ?? "—");
    setText("htb-system-owns", profile.systemOwns ?? "—");
    setText(
      "htb-global-rank",
      profile.ranking != null ? "#" + profile.ranking : "—",
    );
    setText("htb-username", "@" + (profile.username || "Dingooo"));

    function element(tag, className, text) {
      const node = doc.createElement(tag);
      if (className) node.className = className;
      if (text != null) node.textContent = String(text);
      return node;
    }

    function renderRows(id, items, emptyText) {
      const container = doc.getElementById(id);
      if (!container) return;
      const fragment = doc.createDocumentFragment();
      if (!items.length) fragment.append(element("p", "htb-empty", emptyText));
      items.forEach((item) => {
        const row = element("div", "htb-machine");
        const name = element("span", "htb-machine-name");
        const kind =
          item.kind ||
          (String(item.os).toLowerCase() === "windows" ? "WIN" : "LIN");
        const icon = element("span", "htb-os-icon", kind);
        icon.setAttribute(
          "aria-label",
          {
            WIN: "Windows machine",
            LIN: "Linux machine",
            CTF: "Challenge",
            DFIR: "Sherlock investigation",
          }[kind],
        );
        name.append(icon, element("span", "htb-machine-title", item.name));
        const meta = element("span", "htb-machine-meta");
        const ago = timeAgo(item.date);
        if (ago) {
          const time = element("time", "htb-machine-date", ago);
          time.dateTime = item.date;
          time.title = new Date(item.date).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          });
          meta.append(time);
        }
        const difficulty = normalizeDifficulty(item.difficulty);
        meta.append(
          element(
            "span",
            "htb-machine-diff htb-diff-" + difficulty,
            difficulty.charAt(0).toUpperCase() + difficulty.slice(1),
          ),
        );
        row.append(name, meta);
        fragment.append(row);
      });
      container.replaceChildren(fragment);
    }

    renderRows(
      "htb-machines",
      safeItems(data.recentMachines).slice(0, 8),
      "No recent machines in this update.",
    );
    renderRows(
      "htb-challenges",
      getActivity(data),
      "No recent challenges or Sherlocks in this update.",
    );
    const updated = new Date(data.updated);
    const date = Number.isFinite(updated.getTime())
      ? updated.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "date unavailable";
    setText(
      "htb-last-update",
      source === "fresh"
        ? "Updated: " + date
        : source === "loading"
          ? "Saved snapshot: " + date + " · Refreshing…"
          : "Saved snapshot: " + date + " · Latest update unavailable",
    );
  }

  async function loadHTBData({
    fetchImpl = fetch,
    doc = document,
    fallback = HTB_FALLBACK,
    timeoutMs = 8000,
  } = {}) {
    if (!doc.getElementById("htb-machines")) return;
    renderHTBData(fallback, doc, "loading");
    const controller = new AbortController();
    let timer;
    try {
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error("HTB request timed out"));
        }, timeoutMs);
      });
      const request = (async () => {
        const response = await fetchImpl("htb-data.json?v=" + Date.now(), {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) throw new Error("HTB JSON unavailable");
        const data = await response.json();
        if (
          !data ||
          typeof data.profile !== "object" ||
          !data.profile ||
          Array.isArray(data.profile)
        )
          throw new Error("Invalid HTB profile");
        return data;
      })();
      const data = await Promise.race([request, timeout]);
      renderHTBData(data, doc);
      return { source: "fresh", data };
    } catch {
      renderHTBData(fallback, doc, "fallback");
      return { source: "fallback", data: fallback };
    } finally {
      clearTimeout(timer);
    }
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      HTB_FALLBACK,
      normalizeDifficulty,
      timeAgo,
      getActivity,
      renderHTBData,
      loadHTBData,
    };
  } else {
    loadHTBData();
  }
})();
