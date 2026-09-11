const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");
const root = path.resolve(__dirname, "..");
const englishPages = [
  "index.html",
  "research/CVE-2026-20516/index.html",
  "research/linux-antimalware/index.html",
];
const pages = [...englishPages, ...englishPages.map((page) => "it/" + page)];
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

for (const page of pages) {
  test(`${page}: local files and anchor destinations exist`, () => {
    const doc = new JSDOM(read(page)).window.document;
    const ids = [...doc.querySelectorAll("[id]")].map((el) => el.id);
    assert.equal(new Set(ids).size, ids.length, "Duplicate IDs");
    assert.equal(doc.querySelectorAll("h1").length, 1);
    assert.ok(doc.querySelector("main"));
    for (const el of doc.querySelectorAll("[href], [src]")) {
      const ref = el.getAttribute("href") || el.getAttribute("src");
      if (!ref || /^(?:https?:|mailto:|tel:|data:)/.test(ref)) continue;
      const [filePart, hash] = ref.split("#");
      let target = filePart
        ? path.resolve(root, path.dirname(page), filePart)
        : path.join(root, page);
      assert.ok(fs.existsSync(target), `${page}: missing ${ref}`);
      if (fs.statSync(target).isDirectory())
        target = path.join(target, "index.html");
      if (hash) {
        const targetDoc = filePart
          ? new JSDOM(fs.readFileSync(target, "utf8")).window.document
          : doc;
        assert.ok(
          targetDoc.getElementById(hash),
          `${page}: missing anchor ${ref}`,
        );
      }
    }
  });

  test(`${page}: metadata and external links are complete`, () => {
    const doc = new JSDOM(read(page)).window.document;
    for (const selector of [
      "title",
      'meta[name="description"]',
      'meta[property="og:title"]',
      'meta[property="og:description"]',
      'meta[property="og:url"]',
      'meta[name="twitter:title"]',
      'meta[name="twitter:description"]',
      'link[rel="canonical"]',
    ])
      assert.ok(doc.querySelector(selector), `Missing ${selector}`);
    for (const el of doc.querySelectorAll('a[target="_blank"]'))
      assert.match(el.rel, /noopener/);
    assert.equal(
      doc.querySelectorAll("[onclick], [onload], [style], script:not([src])")
        .length,
      0,
    );
    assert.doesNotMatch(
      doc.querySelector('meta[http-equiv="Content-Security-Policy"]').content,
      /unsafe-inline/,
    );
  });
}

test("homepage content, projects and article links are present without JavaScript", () => {
  const doc = new JSDOM(read("index.html")).window.document;
  assert.equal(doc.querySelectorAll(".project-details").length, 3);
  assert.ok(doc.querySelector("#hero-title").textContent.includes("Davide"));
  assert.ok(doc.querySelector('#research a[href="research/CVE-2026-20516/"]'));
  for (const id of [
    "research",
    "experience",
    "projects",
    "certs",
    "education",
    "about",
    "htb",
    "contact",
  ])
    assert.ok(doc.getElementById(id));
  assert.doesNotMatch(
    doc.body.textContent,
    /AES-256|PING:|TOOLS MASTERED|BOOT SEQUENCE/,
  );
  assert.ok(
    [...doc.querySelectorAll("noscript")].some((el) =>
      el.textContent.includes("Hack The Box"),
    ),
  );
});

test("project details use native keyboard-operable disclosure rather than inaccessible modals", () => {
  const doc = new JSDOM(read("index.html")).window.document;
  for (const details of doc.querySelectorAll(".project-details")) {
    assert.equal(details.firstElementChild.tagName, "SUMMARY");
    assert.ok(
      details.querySelector(".project-detail-body").textContent.length > 100,
    );
  }
  assert.equal(doc.querySelectorAll(".modal, [onclick]").length, 0);
});

test("mobile menu opens, closes on selection, and Escape returns keyboard focus", () => {
  const dom = new JSDOM(read("index.html"), {
    url: "https://dingo97.github.io/",
    runScripts: "outside-only",
  });
  dom.window.eval(read("assets/site.js"));
  const doc = dom.window.document;
  const button = doc.querySelector(".menu-toggle");
  const nav = doc.getElementById("main-nav");
  assert.equal(button.hidden, false);
  button.click();
  assert.equal(button.getAttribute("aria-expanded"), "true");
  assert.ok(nav.classList.contains("is-open"));
  doc.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape" }));
  assert.equal(button.getAttribute("aria-expanded"), "false");
  assert.equal(doc.activeElement, button);
  button.click();
  nav.querySelector("a").click();
  assert.equal(button.getAttribute("aria-expanded"), "false");
  dom.window.close();
});

test("the existing theme preference is preserved and cycles with an accessible label", () => {
  const dom = new JSDOM(read("index.html"), {
    url: "https://dingo97.github.io/",
    runScripts: "outside-only",
  });
  dom.window.localStorage.setItem("ddm-theme", "blue");
  dom.window.eval(read("assets/site.js"));
  assert.equal(dom.window.document.documentElement.dataset.theme, "blue");
  const button = dom.window.document.querySelector(".theme-toggle");
  button.click();
  assert.equal(dom.window.localStorage.getItem("ddm-theme"), "red");
  assert.match(button.getAttribute("aria-label"), /red/);
  dom.window.close();
});

test("blocked storage cannot prevent navigation or content from initializing", () => {
  const dom = new JSDOM(read("index.html"), { runScripts: "outside-only" });
  assert.doesNotThrow(() => dom.window.eval(read("assets/site.js")));
  assert.equal(dom.window.document.querySelector(".menu-toggle").hidden, false);
  assert.doesNotThrow(() =>
    dom.window.document.querySelector(".theme-toggle").click(),
  );
  dom.window.close();
});

test("article-specific social metadata does not reuse the unrelated homepage cover", () => {
  const doc = new JSDOM(read("research/CVE-2026-20516/index.html")).window
    .document;
  assert.match(doc.title, /CVE-2026-20516/);
  assert.equal(
    doc.querySelector('meta[property="og:type"]').content,
    "article",
  );
  assert.equal(doc.querySelector('meta[property="og:image"]'), null);
});

test("reduced motion, focus visibility and mobile navigation styles are provided", () => {
  const css = read("assets/site.css");
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /focus-visible/);
  assert.match(css, /\.js \.navigation\.is-open/);
});
