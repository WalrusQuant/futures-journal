// Cmd+K command palette. Modal-based; reuses openModal for the shell.
// Built around a flat command list — each entry has a label, an optional
// hint badge, and a `run()` function. Filtering is plain substring with
// prefix-match boost so typing the start of a command surfaces it first.
//
// Wire it up by importing { openCommandPalette } and binding a global
// keydown listener (see main.js bootstrap).

import { openModal, closeModal } from "./modal.js";
import { setSetting, getSetting, SETTING_KEYS } from "../lib/settings.js";
import { setPrivacyMode } from "../lib/format.js";

// Static command list. Order here is the default order shown when the
// search box is empty.
function buildCommands(refreshPage) {
  return [
    // Navigation
    { id: "nav-dashboard", label: "Go to Dashboard", hint: "nav", run: () => navigate("/") },
    { id: "nav-trades",    label: "Go to Trades",    hint: "nav", run: () => navigate("/trades") },
    { id: "nav-plans",     label: "Go to Plans",     hint: "nav", run: () => navigate("/plans") },
    { id: "nav-analytics", label: "Go to Analytics", hint: "nav", run: () => navigate("/analytics") },
    { id: "nav-calendar",  label: "Go to Calendar",  hint: "nav", run: () => navigate("/calendar") },
    { id: "nav-ledger",    label: "Go to Ledger",    hint: "nav", run: () => navigate("/ledger") },
    { id: "nav-accounts",  label: "Go to Accounts",  hint: "nav", run: () => navigate("/accounts") },
    { id: "nav-tags",      label: "Go to Tags",      hint: "nav", run: () => navigate("/tags") },
    { id: "nav-settings",  label: "Go to Settings",  hint: "nav", run: () => navigate("/settings") },
    // Actions
    { id: "new-trade", label: "New trade",   hint: "action", run: () => navigate("/trades/new") },
    { id: "new-plan",  label: "New plan",    hint: "action", run: () => navigate("/plans/new") },
    {
      id: "toggle-privacy",
      label: "Toggle privacy mode",
      hint: "action",
      run: async () => {
        const current = await getSetting(SETTING_KEYS.privacyMode, "0");
        const next = current === "1" ? "0" : "1";
        await setSetting(SETTING_KEYS.privacyMode, next);
        setPrivacyMode(next === "1");
        refreshPage();
      },
    },
  ];
}

function navigate(path) {
  location.hash = "#" + path;
}

// Substring filter with prefix-match boost. Returns the matching subset
// in score order. Empty query returns the full list unchanged.
function filterCommands(commands, query) {
  const q = query.trim().toLowerCase();
  if (!q) return commands;
  const scored = [];
  for (const cmd of commands) {
    const lower = cmd.label.toLowerCase();
    const idx = lower.indexOf(q);
    if (idx < 0) continue;
    // Lower score is better. Prefix matches first, then earlier matches.
    const score = idx === 0 ? 0 : idx + 10;
    scored.push({ cmd, score });
  }
  scored.sort((a, b) => a.score - b.score);
  return scored.map((s) => s.cmd);
}

// Lazily imported to avoid a circular import with main.js (main.js
// already imports this file's module to bind the keydown listener).
let _refreshPage = null;
async function getRefreshPage() {
  if (_refreshPage) return _refreshPage;
  const m = await import("../main.js");
  _refreshPage = m.refreshPage;
  return _refreshPage;
}

let _open = false;
export async function openCommandPalette() {
  if (_open) return;
  _open = true;

  const refreshPage = await getRefreshPage();
  const commands = buildCommands(refreshPage);

  const wrap = document.createElement("div");
  wrap.className = "cmdk-modal";
  wrap.innerHTML = `
    <input class="cmdk-input" type="text" placeholder="Type a command…" aria-label="Command palette" />
    <ul class="cmdk-list" role="listbox"></ul>
  `;
  const input = wrap.querySelector(".cmdk-input");
  const list = wrap.querySelector(".cmdk-list");

  let visible = commands;
  let activeIdx = 0;

  function render() {
    if (visible.length === 0) {
      list.innerHTML = `<li class="cmdk-empty">No matching commands.</li>`;
      return;
    }
    list.innerHTML = visible
      .map(
        (c, i) => `
          <li class="cmdk-item${i === activeIdx ? " active" : ""}"
              data-idx="${i}" role="option" aria-selected="${i === activeIdx}">
            <span class="cmdk-label">${escapeHtml(c.label)}</span>
            ${c.hint ? `<span class="cmdk-hint">${escapeHtml(c.hint)}</span>` : ""}
          </li>
        `
      )
      .join("");
  }

  function escapeHtml(s) {
    return String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        }[c])
    );
  }

  function runActive() {
    const cmd = visible[activeIdx];
    if (!cmd) return;
    closeModal();
    // Close finalizes _open via onClose; run after the close so the
    // modal is gone before any navigation/render kicks in.
    Promise.resolve().then(() => cmd.run());
  }

  input.addEventListener("input", () => {
    visible = filterCommands(commands, input.value);
    activeIdx = 0;
    render();
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeIdx = Math.min(activeIdx + 1, visible.length - 1);
      render();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeIdx = Math.max(activeIdx - 1, 0);
      render();
    } else if (e.key === "Enter") {
      e.preventDefault();
      runActive();
    }
  });

  list.addEventListener("click", (e) => {
    const li = e.target.closest("[data-idx]");
    if (!li) return;
    activeIdx = Number(li.dataset.idx);
    runActive();
  });

  openModal({
    title: "Commands",
    body: wrap,
    width: 520,
    onClose: () => {
      _open = false;
    },
  });

  render();
  // Focus the input after the modal is in the DOM. setTimeout 0 to clear
  // the microtask queue first.
  setTimeout(() => input.focus(), 0);
}
