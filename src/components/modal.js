// Single-instance modal. Body can be an HTML string or a DOM node.
// Returns the body element so callers can attach listeners.

let modalEl = null;
let onCloseCb = null;

function escHandler(e) {
  if (e.key === "Escape") closeModal();
}

export function openModal({ title, body, onClose, width }) {
  closeModal();
  modalEl = document.createElement("div");
  modalEl.className = "modal-backdrop";
  modalEl.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true"${
      width ? ` style="width:${width}px"` : ""
    }>
      <div class="modal-header">
        <h2></h2>
        <button class="modal-close" type="button" aria-label="Close">×</button>
      </div>
      <div class="modal-body"></div>
    </div>
  `;
  modalEl.querySelector(".modal-header h2").textContent = title;
  const bodyEl = modalEl.querySelector(".modal-body");
  if (typeof body === "string") {
    bodyEl.innerHTML = body;
  } else if (body instanceof Node) {
    bodyEl.appendChild(body);
  }

  document.body.appendChild(modalEl);
  modalEl
    .querySelector(".modal-close")
    .addEventListener("click", closeModal);
  modalEl.addEventListener("click", (e) => {
    if (e.target === modalEl) closeModal();
  });
  document.addEventListener("keydown", escHandler);

  onCloseCb = onClose || null;
  return bodyEl;
}

export function closeModal() {
  if (!modalEl) return;
  document.removeEventListener("keydown", escHandler);
  modalEl.remove();
  modalEl = null;
  if (onCloseCb) {
    const cb = onCloseCb;
    onCloseCb = null;
    cb();
  }
}

// Promise-based confirm dialog. Tauri 2 webviews silently suppress native
// window.confirm() AND window.alert() on macOS (returns true without
// showing UI), so we have to roll our own.
//
// Returns true if the user confirms, false otherwise.
//
// Pass cancelLabel: null to suppress the cancel button entirely — use
// for info/error notifications where there's nothing to cancel. The
// notify() helper below is the convenience wrapper for that case.
//
// Usage:
//   if (!(await confirmDialog({ message: "Delete this trade?" }))) return;
//   await notify({ title: "Error", message: "Save failed." });
export function confirmDialog({
  title = "Confirm",
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
} = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
      closeModal();
    };

    const wrap = document.createElement("div");
    wrap.className = "confirm-body";
    // Preserve newlines in the message.
    const p = document.createElement("p");
    p.style.whiteSpace = "pre-wrap";
    p.style.margin = "0 0 var(--sp-4) 0";
    p.textContent = message;
    wrap.appendChild(p);

    const actions = document.createElement("div");
    actions.className = "form-actions";
    actions.style.justifyContent = "flex-end";
    actions.style.gap = "var(--sp-2)";

    if (cancelLabel != null) {
      const cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.textContent = cancelLabel;
      cancelBtn.addEventListener("click", () => finish(false));
      actions.appendChild(cancelBtn);
    }

    const confirmBtn = document.createElement("button");
    confirmBtn.type = "button";
    confirmBtn.textContent = confirmLabel;
    confirmBtn.className = danger ? "btn-danger" : "primary";
    confirmBtn.addEventListener("click", () => finish(true));
    actions.appendChild(confirmBtn);
    wrap.appendChild(actions);

    openModal({
      title,
      body: wrap,
      width: 440,
      // If user closes via X or backdrop/Escape, treat as cancel.
      onClose: () => finish(false),
    });

    // Focus the safe button by default so Enter doesn't accidentally
    // confirm a destructive action. Without a cancel button, focus the
    // OK button so Enter dismisses the dialog cleanly.
    const focusTarget = wrap.querySelector(".form-actions button");
    focusTarget?.focus();
  });
}

// Single-button info / error dialog. Promise-based wrapper around
// confirmDialog with the cancel button suppressed. Use this in place of
// window.alert() — Tauri webviews suppress native alert() on macOS, so
// the user would otherwise see nothing when the call fires.
//
// Usage:
//   await notify({ title: "Error", message: "Could not save trade." });
export function notify({
  title = "Notice",
  message,
  okLabel = "OK",
} = {}) {
  return confirmDialog({
    title,
    message,
    confirmLabel: okLabel,
    cancelLabel: null,
  });
}
