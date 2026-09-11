(() => {
  "use strict";
  document.documentElement.classList.add("js");
  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();
  const themes = ["green", "amber", "blue", "red"];
  const italian = document.documentElement.lang === "it";
  const themeNames = {
    green: "verde",
    amber: "ambra",
    blue: "blu",
    red: "rosso",
  };
  const themeButton = document.querySelector(".theme-toggle");
  let theme = "green";
  try {
    const saved = localStorage.getItem("ddm-theme");
    if (themes.includes(saved)) theme = saved;
  } catch {
    /* Preferences are optional. */
  }
  function applyTheme() {
    document.documentElement.dataset.theme = theme;
    if (themeButton) {
      themeButton.setAttribute(
        "aria-label",
        italian
          ? `Colore di accento: ${themeNames[theme]}. Cambia colore`
          : `Accent colour: ${theme}. Change accent colour`,
      );
      themeButton.title = italian
        ? `Colore di accento: ${themeNames[theme]}. Clicca per cambiare`
        : `Accent colour: ${theme}. Click to change`;
    }
  }
  applyTheme();
  if (themeButton) {
    themeButton.hidden = false;
    themeButton.addEventListener("click", () => {
      theme = themes[(themes.indexOf(theme) + 1) % themes.length];
      applyTheme();
      try {
        localStorage.setItem("ddm-theme", theme);
      } catch {
        /* Continue without persistence. */
      }
    });
  }
  const menuButton = document.querySelector(".menu-toggle");
  const navigation = document.getElementById("main-nav");
  if (menuButton && navigation) {
    menuButton.hidden = false;
    function closeMenu(returnFocus = false) {
      navigation.classList.remove("is-open");
      menuButton.setAttribute("aria-expanded", "false");
      if (returnFocus) menuButton.focus();
    }
    menuButton.addEventListener("click", () => {
      const open = navigation.classList.toggle("is-open");
      menuButton.setAttribute("aria-expanded", String(open));
    });
    navigation.addEventListener("click", (event) => {
      if (event.target.closest("a")) closeMenu();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && navigation.classList.contains("is-open"))
        closeMenu(true);
    });
    document.addEventListener("click", (event) => {
      if (!event.target.closest(".site-header")) closeMenu();
    });
    if (typeof matchMedia === "function")
      matchMedia("(min-width: 761px)").addEventListener("change", (event) => {
        if (event.matches) closeMenu();
      });
    if ("IntersectionObserver" in window) {
      const links = [...navigation.querySelectorAll('a[href^="#"]')];
      const observer = new IntersectionObserver(
        (entries) => {
          const active = entries
            .filter((entry) => entry.isIntersecting)
            .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
          if (!active) return;
          links.forEach((link) => {
            if (link.hash === "#" + active.target.id)
              link.setAttribute("aria-current", "location");
            else link.removeAttribute("aria-current");
          });
        },
        { rootMargin: "-15% 0px -45% 0px", threshold: 0 },
      );
      links.forEach((link) => {
        const section = document.querySelector(link.hash);
        if (section) observer.observe(section);
      });
    }
  }
})();
