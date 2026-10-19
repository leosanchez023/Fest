document.addEventListener("DOMContentLoaded", () => {
  const layout = document.getElementById("appLayout");
  const sidebar = document.getElementById("appSidebar");
  const sidebarToggle = document.getElementById("sidebarToggle");
  const sidebarOverlay = document.getElementById("sidebarOverlay");
  const accountToggle = document.getElementById("accountToggle");
  const accountMenu = document.getElementById("accountMenu");
  const mobileBreakpoint = window.matchMedia("(max-width: 900px)");

  if (!layout || !sidebar || !sidebarToggle) return;

  const setMobileOpen = (open) => {
    layout.classList.toggle("is-sidebar-open", open);
    sidebarOverlay.hidden = !open;
    sidebar.setAttribute("aria-hidden", String(!open));
    document.body.classList.toggle("app-sidebar-open", open);
    sidebarToggle.setAttribute("aria-expanded", String(open));
    sidebarToggle.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
  };

  const syncLayout = () => {
    if (mobileBreakpoint.matches) {
      layout.classList.remove("is-sidebar-collapsed");
      setMobileOpen(layout.classList.contains("is-sidebar-open"));
      return;
    }

    layout.classList.remove("is-sidebar-open");
    sidebarOverlay.hidden = true;
    sidebar.setAttribute("aria-hidden", "false");
    document.body.classList.remove("app-sidebar-open");
    const collapsed = layout.classList.contains("is-sidebar-collapsed");
    sidebarToggle.setAttribute("aria-expanded", String(!collapsed));
    sidebarToggle.setAttribute("aria-label", collapsed ? "Expandir menu" : "Recolher menu");
  };

  sidebarToggle.addEventListener("click", () => {
    if (mobileBreakpoint.matches) {
      setMobileOpen(!layout.classList.contains("is-sidebar-open"));
      return;
    }

    layout.classList.toggle("is-sidebar-collapsed");
    syncLayout();
  });

  sidebarOverlay.addEventListener("click", () => setMobileOpen(false));
  mobileBreakpoint.addEventListener("change", syncLayout);

  const groups = [...document.querySelectorAll("[data-sidebar-group]")];
  const setGroupOpen = (group, open) => {
    const button = group.querySelector(".app-sidebar__group-toggle");
    const submenu = group.querySelector(".app-sidebar__submenu");
    if (!button || !submenu) return;

    group.classList.toggle("is-open", open);
    button.setAttribute("aria-expanded", String(open));
    submenu.setAttribute("aria-hidden", String(!open));
    submenu.inert = !open;
    submenu.style.maxHeight = open ? `${submenu.scrollHeight}px` : "0px";
  };

  document.querySelectorAll("[data-nav-link]").forEach((link) => {
    const path = window.location.pathname.replace(/\/$/, "") || "/";
    const targetPath = new URL(link.href).pathname.replace(/\/$/, "") || "/";
    const requiredHashMatches = !link.dataset.navHash || window.location.hash === link.dataset.navHash;
    const excludedHashMatches = !link.dataset.navHashExclude || window.location.hash !== link.dataset.navHashExclude;
    if ((path === targetPath || path.startsWith(`${targetPath}/`)) && requiredHashMatches && excludedHashMatches) {
      link.classList.add("is-active");
      link.setAttribute("aria-current", "page");
      const group = link.closest("[data-sidebar-group]");
      if (group) {
        group.classList.add("is-current");
        groups.forEach((otherGroup) => setGroupOpen(otherGroup, otherGroup === group));
      }
    }

    link.addEventListener("click", () => {
      if (mobileBreakpoint.matches) setMobileOpen(false);
    });
  });

  groups.forEach((group) => {
    const button = group.querySelector(".app-sidebar__group-toggle");
    if (!button) return;

    button.addEventListener("click", () => {
      const wasCollapsed = !mobileBreakpoint.matches && layout.classList.contains("is-sidebar-collapsed");
      if (wasCollapsed) {
        layout.classList.remove("is-sidebar-collapsed");
        syncLayout();
        groups.forEach((otherGroup) => setGroupOpen(otherGroup, otherGroup === group));
        return;
      }

      const shouldOpen = button.getAttribute("aria-expanded") !== "true";
      groups.forEach((otherGroup) => setGroupOpen(otherGroup, otherGroup === group && shouldOpen));
    });
  });

  const pageMeta = document.querySelector(".page-meta");
  const title = pageMeta?.dataset.title;
  const subtitle = pageMeta?.dataset.subtitle;
  if (title) {
    document.querySelector(".app-header__page-title").textContent = title;
    document.title = `${title} | LOCAGEST`;
  }
  if (subtitle) {
    const subtitleNode = document.querySelector(".app-header__page-subtitle");
    subtitleNode.textContent = subtitle;
  }

  window.addEventListener("hashchange", () => {
    let activeGroup = null;

    document.querySelectorAll("[data-nav-link]").forEach((link) => {
      const path = window.location.pathname.replace(/\/$/, "") || "/";
      const targetPath = new URL(link.href).pathname.replace(/\/$/, "") || "/";
      const requiredHashMatches = !link.dataset.navHash || window.location.hash === link.dataset.navHash;
      const excludedHashMatches = !link.dataset.navHashExclude || window.location.hash !== link.dataset.navHashExclude;
      const isActive = (path === targetPath || path.startsWith(`${targetPath}/`)) && requiredHashMatches && excludedHashMatches;

      link.classList.toggle("is-active", isActive);
      if (isActive) {
        link.setAttribute("aria-current", "page");
        activeGroup = link.closest("[data-sidebar-group]");
      } else {
        link.removeAttribute("aria-current");
      }
    });

    groups.forEach((group) => {
      group.classList.toggle("is-current", group === activeGroup);
      if (activeGroup) setGroupOpen(group, group === activeGroup);
    });

    const updatedMeta = document.querySelector(".page-meta");
    if (updatedMeta?.dataset.title) {
      document.querySelector(".app-header__page-title").textContent = updatedMeta.dataset.title;
      document.querySelector(".app-header__page-subtitle").textContent = updatedMeta.dataset.subtitle || "";
      document.title = `${updatedMeta.dataset.title} | LOCAGEST`;
    }
  });

  const userName = document.querySelector(".app-header__account-name")?.textContent.trim();
  if (userName) {
    const words = userName.split(/\s+/).filter(Boolean);
    const initials = words.length > 1
      ? `${words[0][0]}${words[words.length - 1][0]}`
      : words[0].slice(0, 2);
    document.querySelectorAll("[data-user-initials]").forEach((avatar) => {
      avatar.textContent = initials.toLocaleUpperCase("pt-BR");
    });
  }

  if (accountToggle && accountMenu) {
    const setAccountMenuOpen = (open) => {
      accountMenu.hidden = !open;
      accountToggle.setAttribute("aria-expanded", String(open));
    };

    accountToggle.addEventListener("click", () => {
      setAccountMenuOpen(accountMenu.hidden);
    });

    document.addEventListener("click", (event) => {
      if (!event.target.closest(".app-header__account-wrap")) setAccountMenuOpen(false);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      setAccountMenuOpen(false);
      if (mobileBreakpoint.matches && layout.classList.contains("is-sidebar-open")) {
        setMobileOpen(false);
        sidebarToggle.focus();
      }
    });
  }

  syncLayout();
});