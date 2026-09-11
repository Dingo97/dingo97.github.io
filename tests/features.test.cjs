const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");
const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const routes = [
  "index.html",
  "research/CVE-2026-20516/index.html",
  "research/linux-antimalware/index.html",
];
const normalize = (text) => text.replace(/\s+/g, " ").trim();

function setup(page = "index.html", nativeDialog = true) {
  const dom = new JSDOM(read(page), {
    url: "https://dingo97.github.io/" + page,
    runScripts: "outside-only",
  });
  if (nativeDialog) {
    dom.window.HTMLDialogElement.prototype.showModal = function () {
      this.open = true;
    };
    dom.window.HTMLDialogElement.prototype.close = function () {
      this.open = false;
      this.dispatchEvent(new dom.window.Event("close"));
    };
  }
  dom.window.eval(read("assets/site.js"));
  dom.window.eval(read("assets/features.js"));
  return dom;
}
function command(dom, value) {
  dom.window.document.getElementById("terminal-input").value = value;
  dom.window.document
    .querySelector(".terminal-form")
    .dispatchEvent(
      new dom.window.Event("submit", { bubbles: true, cancelable: true }),
    );
}

test("terminal opens with Ctrl/Cmd+K, focuses input, and restores focus on Escape", () => {
  const dom = setup();
  const doc = dom.window.document;
  const trigger = doc.querySelector(".terminal-trigger");
  assert.equal(trigger.hidden, false);
  trigger.focus();
  doc.dispatchEvent(
    new dom.window.KeyboardEvent("keydown", {
      key: "k",
      ctrlKey: true,
      cancelable: true,
    }),
  );
  const dialog = doc.querySelector("dialog");
  assert.equal(dialog.open, true);
  assert.equal(doc.activeElement.id, "terminal-input");
  dialog.dispatchEvent(new dom.window.Event("cancel", { cancelable: true }));
  assert.equal(dialog.open, false);
  assert.equal(doc.activeElement, trigger);
  doc.dispatchEvent(
    new dom.window.KeyboardEvent("keydown", {
      key: "k",
      metaKey: true,
      cancelable: true,
    }),
  );
  assert.equal(dialog.open, true);
  command(dom, "exit");
  assert.equal(dialog.open, false);
  assert.equal(doc.body.classList.contains("terminal-open"), false);
  dom.window.close();
});

test("terminal provides useful commands, completion and history without interpreting HTML", () => {
  const dom = setup();
  const doc = dom.window.document;
  const output = doc.querySelector(".terminal-output"),
    input = doc.getElementById("terminal-input");
  command(dom, "help");
  assert.match(output.textContent, /whoami.*research.*thesis.*cv/);
  command(dom, "whoami");
  assert.match(output.textContent, /Aeroporti di Roma/);
  command(dom, "<img src=x onerror=alert(1)>");
  assert.equal(output.querySelector("img"), null);
  assert.match(output.textContent, /Unknown command/);
  input.dispatchEvent(
    new dom.window.KeyboardEvent("keydown", {
      key: "ArrowUp",
      cancelable: true,
    }),
  );
  assert.equal(input.value, "<img src=x onerror=alert(1)>");
  input.dispatchEvent(
    new dom.window.KeyboardEvent("keydown", {
      key: "ArrowUp",
      cancelable: true,
    }),
  );
  assert.equal(input.value, "whoami");
  input.value = "pro";
  input.dispatchEvent(
    new dom.window.KeyboardEvent("keydown", { key: "Tab", cancelable: true }),
  );
  assert.equal(input.value, "projects");
  command(dom, "theme");
  assert.equal(doc.documentElement.dataset.theme, "amber");
  command(dom, "contact");
  assert.equal(
    output.querySelector("a").href,
    "mailto:davidedimatteo97@gmail.com",
  );
  for (let i = 0; i < 60; i++) command(dom, "help");
  assert.ok(output.children.length <= 50);
  command(dom, "clear");
  assert.equal(output.children.length, 1);
  dom.window.close();
});

test("navigation remains available when modal dialogs are unsupported", () => {
  const dom = setup("index.html", false);
  assert.equal(
    dom.window.document.querySelector(".terminal-trigger").hidden,
    true,
  );
  assert.ok(dom.window.document.querySelector("#main-nav a"));
  dom.window.close();
});

for (const page of [...routes, ...routes.map((p) => "it/" + p)]) {
  test(`${page}: terminal CV downloads resolve to the correct existing language file`, () => {
    const dom = setup(page);
    const urls = [];
    dom.window.HTMLAnchorElement.prototype.click = function () {
      urls.push(new URL(this.href).pathname);
    };
    command(dom, "cv");
    assert.deepEqual(urls, [
      page.startsWith("it/")
        ? "/CV_Davide_Di_Matteo_IT.pdf"
        : "/CV_Davide_Di_Matteo.pdf",
    ]);
    const home = new URL(
      dom.window.document.body.dataset.home,
      dom.window.location.href,
    );
    const expected = page.startsWith("it/") ? "/it/" : "/";
    assert.equal(home.pathname, expected);
    for (const target of [
      "#research",
      "#projects",
      "#htb",
      "research/linux-antimalware/",
      "research/CVE-2026-20516/",
    ]) {
      const url = new URL(target, home);
      const local = path.join(root, url.pathname.replace(/^\//, ""));
      assert.ok(fs.existsSync(path.join(local, "index.html")), url.href);
      if (url.hash)
        assert.ok(
          new JSDOM(
            read(path.relative(root, path.join(local, "index.html"))),
          ).window.document.getElementById(url.hash.slice(1)),
        );
    }
    dom.window.close();
  });
}

for (const prefix of ["", "it/"]) {
  test(`${prefix || "en/"}CVE explainer preserves readable content without JS and supports all three keyboard stages`, () => {
    const file = prefix + "research/CVE-2026-20516/index.html";
    const plain = new JSDOM(read(file)).window.document;
    assert.equal(
      plain.querySelectorAll("[data-explanation]:not([hidden])").length,
      3,
    );
    const dom = setup(file);
    const doc = dom.window.document;
    const buttons = [...doc.querySelectorAll("[data-step]")];
    assert.equal(
      doc.querySelectorAll("[data-explanation]:not([hidden])").length,
      1,
    );
    buttons[0].dispatchEvent(
      new dom.window.KeyboardEvent("keydown", {
        key: "ArrowRight",
        cancelable: true,
      }),
    );
    assert.equal(buttons[1].getAttribute("aria-pressed"), "true");
    assert.equal(doc.activeElement, buttons[1]);
    doc.getElementById("explainer-next").click();
    assert.equal(buttons[2].getAttribute("aria-pressed"), "true");
    assert.match(
      doc.querySelector('[data-explanation="2"]').textContent,
      /root/,
    );
    doc.getElementById("explainer-next").click();
    assert.equal(buttons[0].getAttribute("aria-pressed"), "true");
    buttons[0].dispatchEvent(
      new dom.window.KeyboardEvent("keydown", { key: "End", cancelable: true }),
    );
    assert.equal(buttons[2].getAttribute("aria-pressed"), "true");
    dom.window.close();
  });
}

for (const page of routes) {
  test(`${page}: reciprocal language links, localized metadata and unchanged code examples`, () => {
    const en = new JSDOM(read(page)).window.document;
    const it = new JSDOM(read("it/" + page)).window.document;
    assert.equal(it.documentElement.lang, "it");
    if (page.includes("CVE-")) assert.match(it.title, /CVE-2026-20516/);
    else assert.notEqual(en.title, it.title);
    assert.notEqual(
      en.querySelector('meta[name="description"]').content,
      it.querySelector('meta[name="description"]').content,
    );
    for (const doc of [en, it]) {
      const links = [...doc.querySelectorAll('link[rel="alternate"]')];
      assert.equal(links.length, 3);
      for (const lang of ["en", "it"]) {
        const url = new URL(links.find((l) => l.hreflang === lang).href);
        assert.equal(
          url.pathname,
          "/" + (lang === "it" ? "it/" : "") + page.replace("index.html", ""),
        );
      }
    }
    assert.deepEqual(
      [...it.querySelectorAll("pre")].map((e) => e.textContent),
      [...en.querySelectorAll("pre")].map((e) => e.textContent),
    );
    const italianUrl = new URL("it/" + page, "https://dingo97.github.io/");
    assert.equal(
      new URL(
        it.querySelector(".language-switch").getAttribute("href"),
        italianUrl,
      ).pathname,
      "/" + page.replace("index.html", ""),
    );
  });
}

test("Italian runtime labels stay in Italian after changing the accent", () => {
  const dom = setup("it/index.html");
  const doc = dom.window.document;
  command(dom, "whoami");
  assert.match(
    doc.querySelector(".terminal-output").textContent,
    /presso Aeroporti di Roma/,
  );
  doc.querySelector(".theme-toggle").click();
  assert.match(
    doc.querySelector(".theme-toggle").getAttribute("aria-label"),
    /Colore del tema/,
  );
  dom.window.close();
});

test("Italian labels use Italian word order across visual line breaks", () => {
  const doc = new JSDOM(read("it/index.html")).window.document;
  const phrase = doc.querySelector(".trust-proof > span").cloneNode(true);
  phrase.querySelectorAll("br").forEach((br) => br.replaceWith(" "));
  assert.equal(normalize(phrase.textContent), "CVE riconosciuta");
});

test("Italian prose preserves word boundaries and punctuation beside inline code", () => {
  for (const page of routes.slice(1)) {
    const doc = new JSDOM(read("it/" + page)).window.document;
    for (const code of doc.querySelectorAll("p code")) {
      const next = code.nextSibling;
      if (next?.nodeType !== 3 || !next.textContent.trim()) continue;
      if (/^[\p{L}\p{N}]/u.test(next.textContent.trim()))
        assert.match(
          next.textContent,
          /^\s/,
          `Missing space after ${code.textContent}`,
        );
      assert.doesNotMatch(
        next.textContent,
        /^\s+[,.;:!?]/,
        `Space before punctuation after ${code.textContent}`,
      );
    }
  }
});

test("thesis matrix preserves the seven products and the recorded Sophos/Avast exceptions", () => {
  const doc = new JSDOM(read("research/linux-antimalware/index.html")).window
    .document;
  const rows = [...doc.querySelectorAll(".result-matrix tbody tr")];
  assert.equal(rows.length, 7);
  for (const row of rows) {
    const name = row.querySelector("th").textContent;
    const values = [...row.querySelectorAll("td")].map(
      (td) => td.textContent === "Removed",
    );
    assert.deepEqual(values, [
      true,
      false,
      name === "Sophos",
      name === "Avast",
      name === "Avast",
      false,
    ]);
  }
  assert.match(
    normalize(doc.getElementById("limits").textContent),
    /2022.*versions.*configuration/,
  );
  assert.match(
    normalize(doc.getElementById("sources").textContent),
    /28 October 2022/,
  );
  assert.equal(doc.querySelector('a[href$=".zip"]'), null);
});
