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
