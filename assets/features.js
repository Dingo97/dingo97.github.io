(() => {
  "use strict";
  const it = document.documentElement.lang === "it";
  const tr = (en, italian) => (it ? italian : en);
  const trigger = document.querySelector(".terminal-trigger");
  if (trigger) {
    const home = document.body.dataset.home || "./";
    const commands = [
      "help",
      "whoami",
      "research",
      "thesis",
      "cve",
      "projects",
      "htb",
      "cv",
      "contact",
      "theme",
      "clear",
      "exit",
    ];
    const dialog = document.createElement("dialog");
    dialog.className = "navigation-terminal";
    dialog.setAttribute("aria-labelledby", "terminal-title");
    dialog.innerHTML = `<div class="terminal-titlebar"><h2 id="terminal-title">ddm / ${tr("navigation", "navigazione")}</h2><button type="button" class="terminal-close" aria-label="${tr("Close terminal", "Chiudi terminale")}">Esc <span aria-hidden="true">×</span></button></div><div class="terminal-output" role="log" aria-live="polite" aria-relevant="additions"></div><form class="terminal-form"><label for="terminal-input"><span aria-hidden="true">ddm:~$</span><span class="sr-only">${tr("Navigation command", "Comando di navigazione")}</span></label><input id="terminal-input" name="command" type="text" maxlength="120" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${tr("Try research, thesis or cv", "Prova research, thesis o cv")}"><button type="submit" aria-label="${tr("Run navigation command", "Esegui comando di navigazione")}">↵</button></form><div class="terminal-shortcuts"><span>${tr("Quick commands", "Comandi rapidi")}</span></div>`;
    document.body.append(dialog);
    const input = dialog.querySelector("input");
    const output = dialog.querySelector(".terminal-output");
    const history = [];
    let historyIndex = 0;
    let returnFocus = trigger;
    function line(text, className = "") {
      const p = document.createElement("p");
      p.className = className;
      p.textContent = text;
      output.append(p);
      while (output.children.length > 50) output.firstElementChild.remove();
      output.scrollTop = output.scrollHeight;
      return p;
    }
    const welcome = () =>
      line(
        tr(
          "Explore the portfolio. Type help to see all commands.",
          "Naviga nel portfolio con i comandi del terminale. Digita help per vedere quelli disponibili.",
        ),
      );
    welcome();
    function close() {
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
      document.body.classList.remove("terminal-open");
      if (returnFocus && returnFocus.isConnected) returnFocus.focus();
    }
    function open() {
      if (dialog.open) {
        close();
        return;
      }
      returnFocus = document.activeElement;
      if (typeof dialog.showModal !== "function") return;
      dialog.showModal();
      document.body.classList.add("terminal-open");
      input.focus();
    }
    function go(relative) {
      close();
      window.location.assign(home + relative);
    }
    function run(raw) {
      const command = raw.trim().toLowerCase();
      if (!command) return;
      history.push(raw);
      if (history.length > 30) history.shift();
      historyIndex = history.length;
      line("ddm:~$ " + raw, "terminal-command");
      input.value = "";
      switch (command) {
        case "help":
          line(commands.join("  /  "));
          line(
            tr(
              "Use ↑ / ↓ for command history and Tab to complete a command.",
              "Usa ↑ / ↓ per richiamare i comandi precedenti e Tab per completarli.",
            ),
          );
          break;
        case "whoami":
          line(
            tr(
              "Davide Di Matteo · Cyber Security Specialist at Aeroporti di Roma. Vulnerability management, VAPT and independent research. Based in Rome.",
              "Sono Davide Di Matteo, Cyber Security Specialist presso Aeroporti di Roma. Mi occupo di gestione delle vulnerabilità, VAPT e ricerca indipendente sulla sicurezza.",
            ),
          );
          break;
        case "research":
          go("#research");
          break;
        case "thesis":
          go("research/linux-antimalware/");
          break;
        case "cve":
          go("research/CVE-2026-20516/");
          break;
        case "projects":
          go("#projects");
          break;
        case "htb":
          go("#htb");
          break;
        case "cv": {
          const download = document.querySelector("a[download]");
          const a = document.createElement("a");
          a.href =
            download?.href ||
            home +
              (it
                ? "../CV_Davide_Di_Matteo_IT.pdf"
                : "CV_Davide_Di_Matteo.pdf");
          a.download = download?.getAttribute("download") || "";
          document.body.append(a);
          a.click();
          a.remove();
          line(
            tr(
              "Your CV download is ready.",
              "Download del CV italiano avviato.",
            ),
          );
          break;
        }
        case "contact": {
          const p = line(tr("Get in touch: ", "Contattami: "));
          const a = document.createElement("a");
          a.href = "mailto:davidedimatteo97@gmail.com";
          a.textContent = "davidedimatteo97@gmail.com";
          p.append(a);
          break;
        }
        case "theme":
          document.querySelector(".theme-toggle")?.click();
          line(tr("Accent colour updated.", "Colore del tema cambiato."));
          break;
        case "clear":
          output.replaceChildren();
          welcome();
          break;
        case "exit":
          close();
          break;
        default:
          line(
            tr(
              "Unknown command. Type help to see available commands.",
              "Comando sconosciuto. Scrivi help per vedere i comandi disponibili.",
            ),
          );
      }
    }
    for (const command of ["research", "thesis", "projects", "cv"]) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = command;
      b.addEventListener("click", () => run(command));
      dialog.querySelector(".terminal-shortcuts").append(b);
    }
    // The trigger only appears where native modal focus management is supported.
    trigger.hidden = typeof dialog.showModal !== "function";
    trigger.addEventListener("click", open);
    dialog.querySelector(".terminal-close").addEventListener("click", close);
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      close();
    });
    dialog.addEventListener("close", () => {
      document.body.classList.remove("terminal-open");
      if (returnFocus?.isConnected) returnFocus.focus();
    });
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) {
        const r = dialog.getBoundingClientRect();
        if (
          event.clientX < r.left ||
          event.clientX > r.right ||
          event.clientY < r.top ||
          event.clientY > r.bottom
        )
          close();
      }
    });
    dialog.querySelector("form").addEventListener("submit", (event) => {
      event.preventDefault();
      run(input.value);
    });
    document.addEventListener("keydown", (event) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "k" &&
        typeof dialog.showModal === "function"
      ) {
        event.preventDefault();
        open();
      }
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault();
        historyIndex = Math.max(
          0,
          Math.min(
            history.length,
            historyIndex + (event.key === "ArrowUp" ? -1 : 1),
          ),
        );
        input.value = history[historyIndex] || "";
      }
      if (event.key === "Tab" && input.value.trim()) {
        const matches = commands.filter((c) =>
          c.startsWith(input.value.trim().toLowerCase()),
        );
        if (matches.length === 1) {
          event.preventDefault();
          input.value = matches[0];
        }
      }
    });
  }
  const explainer = document.querySelector(".cve-explainer");
  if (explainer) {
    const buttons = [...explainer.querySelectorAll("[data-step]")];
    const next = explainer.querySelector("#explainer-next");
    let active = 0;
    function show(index) {
      active = index;
      buttons.forEach((b, i) =>
        b.setAttribute("aria-pressed", String(i === index)),
      );
      explainer
        .querySelectorAll("[data-node]")
        .forEach((n, i) => n.classList.toggle("is-active", i === index));
      explainer
        .querySelectorAll("[data-explanation]")
        .forEach((p, i) => (p.hidden = i !== index));
      explainer.querySelector("#explainer-progress").textContent = tr(
        `Step ${index + 1} of 3`,
        `Passaggio ${index + 1} di 3`,
      );
      next.textContent =
        index === 2
          ? tr("Start again ↺", "Ricomincia ↺")
          : tr("Next stage →", "Avanti →");
    }
    buttons.forEach((b, i) => {
      b.addEventListener("click", () => show(i));
      b.addEventListener("keydown", (event) => {
        let n;
        if (event.key === "ArrowRight") n = (i + 1) % 3;
        if (event.key === "ArrowLeft") n = (i + 2) % 3;
        if (event.key === "Home") n = 0;
        if (event.key === "End") n = 2;
        if (n !== undefined) {
          event.preventDefault();
          show(n);
          buttons[n].focus();
        }
      });
    });
    next.hidden = false;
    next.addEventListener("click", () => show((active + 1) % 3));
    explainer.classList.add("enhanced");
    show(0);
  }
})();
