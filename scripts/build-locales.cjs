const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");
const root = path.resolve(__dirname, "..");
const pages = [
  ["home", "index.html"],
  ["cve", "research/CVE-2026-20516/index.html"],
  ["thesis", "research/linux-antimalware/index.html"],
];
const normalize = (text) => text.replace(/\s+/g, " ").trim();
const italianPhrases = JSON.parse(
  fs.readFileSync(
    path.join(root, "content/translations/it.phrases.json"),
    "utf8",
  ),
);
function segments(doc) {
  const entries = [];
  const walker = doc.createTreeWalker(doc.documentElement, 4);
  let n;
  while ((n = walker.nextNode())) {
    if (n.parentElement.closest("script, style, pre, code")) continue;
    const text = normalize(n.textContent);
    if (!/[A-Za-z]/.test(text)) continue;
    entries.push({
      text,
      apply: (value) => {
        n.textContent = value;
      },
      node: n,
    });
  }
  for (const el of doc.querySelectorAll(
    '[aria-label], [title], [alt], meta[name="description"], meta[property="og:title"], meta[property="og:description"], meta[property="og:image:alt"], meta[name="twitter:title"], meta[name="twitter:description"], meta[name="twitter:image:alt"]',
  )) {
    for (const attr of [
      "aria-label",
      "title",
      "alt",
      ...(el.tagName === "META" ? ["content"] : []),
    ]) {
      if (el.hasAttribute(attr))
        entries.push({
          text: normalize(el.getAttribute(attr)),
          element: el,
          attr,
        });
    }
  }
  return entries;
}
if (process.argv.includes("--extract")) {
  for (const [name, page] of pages) {
    const doc = new JSDOM(fs.readFileSync(path.join(root, page), "utf8")).window
      .document;
    const texts = [...new Set(segments(doc).map((e) => e.text))];
    fs.mkdirSync(path.join(root, "content/translations"), { recursive: true });
    fs.writeFileSync(
      path.join(root, `content/translations/en.${name}.json`),
      JSON.stringify(texts, null, 2) + "\n",
    );
    console.log(name, texts.length);
  }
} else {
  for (const [name, page] of pages) {
    const en = JSON.parse(
      fs.readFileSync(
        path.join(root, `content/translations/en.${name}.json`),
        "utf8",
      ),
    );
    const it = JSON.parse(
      fs.readFileSync(
        path.join(root, `content/translations/it.${name}.json`),
        "utf8",
      ),
    );
    if (en.length !== it.length)
      throw new Error(
        `Translation count differs for ${name}: ${en.length}/${it.length}`,
      );
    const map = new Map(en.map((text, i) => [text, it[i]]));
    const dom = new JSDOM(fs.readFileSync(path.join(root, page), "utf8"));
    const doc = dom.window.document;
    for (const entry of segments(doc)) {
      if (!map.has(entry.text))
        throw new Error(`Untranslated ${name} text: ${entry.text}`);
      if (entry.node) {
        const before = entry.node.textContent;
        const translated = map.get(entry.text);
        const previous = entry.node.previousSibling;
        const followsInlineText =
          previous?.nodeType === 1 &&
          /^(CODE|STRONG|EM|A|SPAN|SMALL|B|I)$/.test(previous.nodeName) &&
          previous.textContent.trim();
        const leadingSpace = /^[,.;:!?]/.test(translated)
          ? ""
          : /^\s/.test(before) ||
              (followsInlineText && /^[\p{L}\p{N}]/u.test(translated))
            ? " "
            : "";
        entry.node.textContent =
          leadingSpace + translated + (/\s$/.test(before) ? " " : "");
      } else entry.element.setAttribute(entry.attr, map.get(entry.text));
    }
    doc.documentElement.lang = "it";
    // Translate whole labels when Italian requires a different word order.
    for (const [selector, lines] of Object.entries(
      italianPhrases[name] || {},
    )) {
      const matches = doc.querySelectorAll(selector);
      if (matches.length !== 1 || !Array.isArray(lines) || !lines.length)
        throw new Error(`Invalid Italian phrase: ${name} ${selector}`);
      matches[0].replaceChildren();
      lines.forEach((line, index) => {
        if (index) matches[0].append(doc.createElement("br"));
        matches[0].append(doc.createTextNode(line));
      });
    }
    const enRoute = page.replace(/index\.html$/, "");
    const itRoute = "it/" + enRoute;
    doc.body.dataset.home =
      path.posix.relative(path.posix.dirname("it/" + page), "it") + "/";
    if (doc.body.dataset.home === "/") doc.body.dataset.home = "./";
    for (const el of doc.querySelectorAll("[href], [src]")) {
      const attr = el.hasAttribute("href") ? "href" : "src";
      const ref = el.getAttribute(attr);
      if (!ref || /^(https?:|mailto:|tel:|data:|#)/.test(ref)) continue;
      const [file, hash] = ref.split("#");
      const target = path.posix.normalize(
        path.posix.join(path.posix.dirname(page), file),
      );
      let destination = target;
      if (el.classList.contains("language-switch"))
        destination = enRoute || ".";
      else if (target.endsWith(".pdf"))
        destination =
          target === "CV_Davide_Di_Matteo.pdf"
            ? "CV_Davide_Di_Matteo_IT.pdf"
            : target;
      else if (!path.posix.extname(target) && !target.startsWith("assets"))
        destination = "it/" + (target === "." ? "" : target);
      else if (target.endsWith("index.html")) destination = "it/" + target;
      let relative =
        path.posix.relative(path.posix.dirname("it/" + page), destination) ||
        ".";
      if (!path.posix.extname(destination) && !relative.endsWith("/"))
        relative += "/";
      el.setAttribute(attr, relative + (hash ? "#" + hash : ""));
    }
    const switcher = doc.querySelector(".language-switch");
    switcher.textContent = "EN";
    switcher.lang = "en";
    switcher.hreflang = "en";
    switcher.setAttribute("aria-label", "Read in English");
    doc.querySelector('link[rel="canonical"]').href =
      "https://dingo97.github.io/" + itRoute;
    doc.querySelector('meta[property="og:url"]').content =
      "https://dingo97.github.io/" + itRoute;
    doc.querySelectorAll('link[rel="alternate"]').forEach((el) => el.remove());
    for (const [lang, route] of [
      ["en", enRoute],
      ["it", itRoute],
      ["x-default", enRoute],
    ]) {
      const link = doc.createElement("link");
      link.rel = "alternate";
      link.hreflang = lang;
      link.href = "https://dingo97.github.io/" + route;
      doc.head.append(link);
    }
    const out = path.join(root, "it", page);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, dom.serialize());
    console.log("Built " + path.relative(root, out));
    const original = new JSDOM(fs.readFileSync(path.join(root, page), "utf8"));
    const expected = [
      ["en", enRoute],
      ["it", itRoute],
      ["x-default", enRoute],
    ];
    if (
      expected.every(
        ([lang, route]) =>
          original.window.document.querySelector(
            `link[rel="alternate"][hreflang="${lang}"]`,
          )?.href ===
          "https://dingo97.github.io/" + route,
      )
    )
      continue;
    original.window.document
      .querySelectorAll('link[rel="alternate"]')
      .forEach((el) => el.remove());
    for (const [lang, route] of [
      ["en", enRoute],
      ["it", itRoute],
      ["x-default", enRoute],
    ]) {
      const link = original.window.document.createElement("link");
      link.rel = "alternate";
      link.hreflang = lang;
      link.href = "https://dingo97.github.io/" + route;
      original.window.document.head.append(link);
    }
    fs.writeFileSync(path.join(root, page), original.serialize());
  }
}
module.exports = { segments };
