import * as dashboard from "./pages/dashboard.js";
import * as accounts from "./pages/accounts.js";
import * as trades from "./pages/trades.js";
import * as plans from "./pages/plans.js";
import { makePlaceholder } from "./pages/placeholder.js";

// Route table. Patterns may include :params, e.g. "/accounts/:id".
// IMPORTANT: exact paths must precede their pattern siblings — the matcher
// walks the table in order and stops at the first hit.
const routes = [
  { path: "/",                  render: dashboard.render },
  { path: "/accounts",          render: accounts.renderList },
  { path: "/accounts/:id",      render: accounts.renderDetail },
  { path: "/trades",            render: trades.renderList },
  { path: "/trades/new",        render: trades.renderForm },
  { path: "/trades/:id/edit",   render: trades.renderForm },
  { path: "/trades/:id",        render: trades.renderDetail },
  { path: "/plans",             render: plans.renderList },
  { path: "/plans/new",         render: plans.renderForm },
  { path: "/plans/:id/edit",    render: plans.renderForm },
  { path: "/plans/:id",         render: plans.renderDetail },
  { path: "/analytics",         render: makePlaceholder("Analytics", "Phase 5") },
  { path: "/calendar",          render: makePlaceholder("Calendar",  "Phase 5") },
  { path: "/tags",              render: makePlaceholder("Tags",      "Phase 4") },
  { path: "/settings",          render: makePlaceholder("Settings",  "Phase 6") },
];

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
  // Strip leading "#" and any "?query" so route matching is path-only.
  const raw = location.hash.replace(/^#/, "") || "/";
  const q = raw.indexOf("?");
  return q >= 0 ? raw.slice(0, q) : raw;
}

function matchRoute(path) {
  for (const r of routes) {
    if (!r.path.includes(":")) {
      if (r.path === path) return { route: r, params: {} };
      continue;
    }
    const re = new RegExp(
      "^" + r.path.replace(/:(\w+)/g, "(?<$1>[^/]+)") + "$"
    );
    const m = path.match(re);
    if (m) return { route: r, params: m.groups || {} };
  }
  return { route: routes[0], params: {} };
}

function isActive(itemPath, path) {
  if (itemPath === "/") return path === "/";
  return path === itemPath || path.startsWith(itemPath + "/");
}

function shellHtml() {
  const path = currentPath();
  const links = navItems
    .map((item) => {
      const active = isActive(item.path, path) ? " active" : "";
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

// Re-render the page area without rebuilding the shell.
// Pages return either an HTML string OR { html, mount(pageEl) }.
export async function refreshPage() {
  const path = currentPath();
  const { route, params } = matchRoute(path);
  const pageEl = document.getElementById("page");
  try {
    const result = await route.render(params);
    if (typeof result === "string") {
      pageEl.innerHTML = result;
    } else {
      pageEl.innerHTML = result.html;
      if (typeof result.mount === "function") result.mount(pageEl);
    }
  } catch (err) {
    console.error(err);
    pageEl.innerHTML = `
      <div class="page-header"><h1>Error</h1></div>
      <div class="card">
        <p class="muted">Failed to render page.</p>
        <pre class="error-pre">${String((err && err.stack) || err)}</pre>
      </div>
    `;
  }
}

function mount() {
  document.getElementById("app").innerHTML = shellHtml();
  refreshPage();
}

window.addEventListener("hashchange", mount);
window.addEventListener("DOMContentLoaded", mount);
