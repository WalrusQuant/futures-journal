// Tiny inline-validation helper for vanilla-JS forms.
//
// Usage:
//   const v = attachValidator(form, {
//     name: (v) => !v.trim() ? "Name is required." : null,
//     entry_price: (v, fd) => Number(v) <= 0 ? "Must be positive." : null,
//   });
//   // ...
//   const { ok, firstField } = v.runAll();
//   if (!ok) return;  // errors are already painted under each field
//
// Each validator is `(value, formData) => errorString | null`. The helper
// looks for a sibling `<div class="field-error" data-for="<name>">` element
// and writes the error there, toggling `.has-error` on the enclosing
// `.form-row`. On any subsequent `input` event for that field, the error
// is cleared until the next blur (so users see immediate relief when they
// start typing the fix).

export function attachValidator(form, validators) {
  const fieldNames = Object.keys(validators);

  function findErrorEl(name) {
    return form.querySelector(`.field-error[data-for="${name}"]`);
  }
  function findRow(name) {
    return findErrorEl(name)?.closest(".form-row") || null;
  }
  function setError(name, msg) {
    const errEl = findErrorEl(name);
    const row = findRow(name);
    if (errEl) errEl.textContent = msg || "";
    if (row) row.classList.toggle("has-error", !!msg);
  }
  function readValue(name) {
    const el = form.elements[name];
    if (!el) return "";
    // RadioNodeList for radios — value is the checked one
    if (el.value !== undefined) return el.value;
    return "";
  }

  // Validate one field on blur.
  form.addEventListener(
    "blur",
    (e) => {
      const name = e.target?.name;
      if (!name || !validators[name]) return;
      const fd = new FormData(form);
      const msg = validators[name](readValue(name), fd);
      setError(name, msg);
    },
    true // capture: blur doesn't bubble
  );

  // Clear the error for a field as soon as the user changes it.
  form.addEventListener("input", (e) => {
    const name = e.target?.name;
    if (!name || !validators[name]) return;
    const row = findRow(name);
    if (row?.classList.contains("has-error")) {
      setError(name, null);
    }
  });

  return {
    /**
     * Run every validator and paint errors. Returns { ok, firstField }
     * where firstField is the name of the first failing field (or null).
     */
    runAll() {
      const fd = new FormData(form);
      let firstField = null;
      for (const name of fieldNames) {
        const msg = validators[name](readValue(name), fd);
        setError(name, msg);
        if (msg && !firstField) firstField = name;
      }
      return { ok: !firstField, firstField };
    },
    /** Clear all errors (e.g. before re-validating after a fix). */
    clearAll() {
      for (const name of fieldNames) setError(name, null);
    },
    /** Manually set an error on a single field (e.g. server response). */
    setError,
  };
}
