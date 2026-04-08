// Lightweight transient notification component. Use this when you need
// to surface an operation result to the user without interrupting them
// with a modal — primarily for failures of background-ish operations
// (export failed, backup failed, image upload failed, etc.) that the
// user initiated and is waiting on but can recover from.
//
// API:
//   import { toast } from "../components/toast.js";
//   toast({ message: "Backup created.", tone: "success" });
//   toast.success("Saved.");
//   toast.error("Failed to save trade: connection refused");
//   toast.info("Privacy mode on.");
//   toast.warn("This trade is unplanned.");
//
// Stacks if multiple toasts are fired in quick succession. Auto-dismisses
// after ~4 seconds. Click-to-dismiss earlier.

const DEFAULT_DURATION_MS = 4000;
const CONTAINER_ID = "toast-container";

function ensureContainer() {
  let el = document.getElementById(CONTAINER_ID);
  if (el) return el;
  el = document.createElement("div");
  el.id = CONTAINER_ID;
  el.className = "toast-container";
  document.body.appendChild(el);
  return el;
}

export function toast({
  message,
  tone = "info",
  duration = DEFAULT_DURATION_MS,
} = {}) {
  if (!message) return;
  const container = ensureContainer();

  const el = document.createElement("div");
  el.className = `toast toast-${tone}`;
  el.setAttribute("role", tone === "error" ? "alert" : "status");
  el.textContent = message;
  el.addEventListener("click", () => dismiss(el));
  container.appendChild(el);

  // Trigger CSS transition by toggling a class on the next frame.
  requestAnimationFrame(() => el.classList.add("toast-shown"));

  const timer = setTimeout(() => dismiss(el), duration);
  el._toastTimer = timer;
}

function dismiss(el) {
  if (!el || !el.parentNode) return;
  if (el._toastTimer) clearTimeout(el._toastTimer);
  el.classList.remove("toast-shown");
  el.classList.add("toast-leaving");
  // Remove after the leave animation. Match the CSS transition duration.
  setTimeout(() => {
    if (el.parentNode) el.parentNode.removeChild(el);
  }, 250);
}

toast.success = (message, opts = {}) =>
  toast({ ...opts, message, tone: "success" });
toast.error = (message, opts = {}) =>
  toast({ ...opts, message, tone: "error" });
toast.info = (message, opts = {}) =>
  toast({ ...opts, message, tone: "info" });
toast.warn = (message, opts = {}) =>
  toast({ ...opts, message, tone: "warn" });
