import * as dashboard from "./pages/dashboard.js";
import { makePlaceholder } from "./pages/placeholder.js";

const routes = {
  "/":          { title: "Dashboard", render: dashboard.render },
  "/accounts":  { title: "Accounts",  render: makePlaceholder("Accounts",  "Phase 1") },
  "/trades":    { title: "Trades",    render: makePlaceholder("Trades",    "Phase 2") },
  "/plans":     { title: "Plans",     render: makePlaceholder("Plans",     "Phase 3") },
  "/analytics": { title: "Analytics", render: makePlaceholder("Analytics", "Phase 5") },
  "/calendar":  { title: "Calendar",  render: makePlaceholder("Calendar",  "Phase 5") },
  "/tags":      { title: "Tags",      render: makePlaceholder("Tags",      "Phase 4") },
  "/settings":  { title: "Settings",  render: makePlaceholder("Settings",  "Phase 6") },
};

const navItems = [
  { path: "/",          label: "Dashboard" },
  { path: "/accounts",  label: "Accounts"  },
  { path: "/trades",    label: "Trades"    },
  { path: "/plans",     label: "Plans"     },
  { path: "/analytics", label: "Analytics" },
  { path: "/calendar",  label: "Calendar"  },
  { path: "/tags",      label: "Tags"      },
  { path: "/settings",  label: "Settings"  },
];

function currentPath() {
  return location.hash.replace(/^#/, "") || "/";
}

function shellHtml() {
  const path = currentPath();
  const links = navItems
    .map((item) => {
      const active = item.path === path ? " active" : "";
      return `<a class="nav-link${active}" href="#${item.path}">${item.label}</a>`;
    })
    .join("");

  return `
    <div class="app">
      <aside class="sidebar">
        <div class="sidebar-brand">
          FUTURES JOURNAL
          <small>v0.1 — opinionated</small>
        </div>
        <nav class="sidebar-nav">${links}</nav>
        <div class="sidebar-footer">local · sqlite · futures only</div>
      </aside>
      <main class="main" id="page"></main>
    </div>
  `;
}

async function renderPage() {
  const path = currentPath();
  const route = routes[path] || routes["/"];
  const pageEl = document.getElementById("page");
  try {
    pageEl.innerHTML = await route.render();
  } catch (err) {
    console.error(err);
    pageEl.innerHTML = `
      <div class="page-header"><h1>Error</h1></div>
      <div class="card">
        <p class="muted">Failed to render page.</p>
        <pre style="white-space:pre-wrap;color:var(--loss);font-size:var(--fs-sm)">${String(err && err.stack || err)}</pre>
      </div>
    `;
  }
}

function mount() {
  document.getElementById("app").innerHTML = shellHtml();
  renderPage();
}

window.addEventListener("hashchange", mount);
window.addEventListener("DOMContentLoaded", mount);
