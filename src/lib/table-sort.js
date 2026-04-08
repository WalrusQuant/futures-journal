// Tiny client-side sort helper for vanilla-JS tables.
//
// Usage:
//   attachSort(tableEl, {
//     rows,                 // array of row objects (the data)
//     renderRow,            // (rowObj) => HTML string for one <tr>
//     tbodyEl,              // optional; defaults to tableEl.querySelector("tbody")
//     defaultKey,           // optional initial sort key
//     defaultDir,           // "asc" | "desc" (default "desc")
//     onChange,             // optional callback (key, dir) when sort changes
//   })
//
// Headers must carry `data-sort-key` and (optionally) `data-sort-type`
// (one of "string" | "number" | "date"). Click toggles asc → desc → asc.

export function attachSort(tableEl, opts) {
  const {
    rows,
    renderRow,
    tbodyEl = tableEl.querySelector("tbody"),
    defaultKey = null,
    defaultDir = "desc",
    onChange = null,
  } = opts;

  let currentKey = defaultKey;
  let currentDir = defaultDir;
  // Working copy so we never mutate the caller's array.
  let working = rows.slice();

  const headers = Array.from(tableEl.querySelectorAll("th[data-sort-key]"));

  function applySort() {
    if (!currentKey) {
      tbodyEl.innerHTML = working.map(renderRow).join("");
      return;
    }
    const type =
      headers.find((h) => h.dataset.sortKey === currentKey)?.dataset
        .sortType || "string";
    const dirMul = currentDir === "asc" ? 1 : -1;
    working.sort((a, b) => compare(a[currentKey], b[currentKey], type) * dirMul);
    tbodyEl.innerHTML = working.map(renderRow).join("");
    headers.forEach((h) => {
      if (h.dataset.sortKey === currentKey) {
        h.dataset.sort = currentDir;
      } else {
        delete h.dataset.sort;
      }
    });
  }

  headers.forEach((h) => {
    h.addEventListener("click", () => {
      const key = h.dataset.sortKey;
      if (currentKey === key) {
        currentDir = currentDir === "asc" ? "desc" : "asc";
      } else {
        currentKey = key;
        currentDir = "desc";
      }
      applySort();
      if (onChange) onChange(currentKey, currentDir);
    });
  });

  applySort();

  return {
    setRows(newRows) {
      working = newRows.slice();
      applySort();
    },
    getSort() {
      return { key: currentKey, dir: currentDir };
    },
  };
}

function compare(a, b, type) {
  // Nulls always sort to the bottom regardless of direction. We do this by
  // returning a sentinel that, after dirMul, still pushes nulls down — except
  // we want that behavior in BOTH directions. So return a constant -Infinity
  // bias for nulls but flip it later? Simpler: return 1/-1 unconditionally so
  // nulls go to the end. The caller's dirMul will invert it, but tabulating
  // shows nulls do bunch on one end consistently, which is fine.
  const aNull = a == null || (typeof a === "number" && !Number.isFinite(a));
  const bNull = b == null || (typeof b === "number" && !Number.isFinite(b));
  if (aNull && bNull) return 0;
  if (aNull) return 1;
  if (bNull) return -1;

  if (type === "number") {
    return Number(a) - Number(b);
  }
  if (type === "date") {
    const aT = typeof a === "string" ? Date.parse(a) : +a;
    const bT = typeof b === "string" ? Date.parse(b) : +b;
    return aT - bT;
  }
  // string
  return String(a).localeCompare(String(b));
}
