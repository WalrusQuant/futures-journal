// Display formatters. All money is in USD for v1.

// Privacy mode: when on, fmtMoney returns a redacted placeholder so the
// user can take screenshots without showing dollar amounts. Toggled from
// settings; main.js applies it on app boot.
let _privacyMode = false;
export function setPrivacyMode(on) {
  _privacyMode = !!on;
}
export function isPrivacyMode() {
  return _privacyMode;
}

export function fmtMoney(n, { signed = false } = {}) {
  if (n == null || Number.isNaN(n)) return "—";
  if (_privacyMode) return "$•••";
  const sign = n < 0 ? "-" : signed ? "+" : "";
  const abs = Math.abs(n);
  return (
    sign +
    "$" +
    abs.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

export function fmtNumber(n, decimals = 0) {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function fmtDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Escape user-supplied strings before injecting into innerHTML.
export function esc(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
