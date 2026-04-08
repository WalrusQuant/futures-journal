import { esc } from "../lib/format.js";

// Mounts a multi-select chip picker into `container`.
// Returns { getSelected, setSelected } so callers can read state on submit.
export function mountTagPicker(container, allTags, selectedIds = []) {
  const selected = new Set(selectedIds.map(Number));

  function render() {
    if (allTags.length === 0) {
      container.innerHTML = `<div class="dim">No tags yet. <a href="#/tags">Create some →</a></div>`;
      return;
    }
    container.innerHTML = `
      <div class="tag-picker">
        ${allTags
          .map(
            (t) => `
              <button type="button" class="tag-chip"
                      data-tag-id="${t.id}"
                      data-selected="${selected.has(t.id) ? 1 : 0}"
                      style="--tag-color:${t.color}">
                ${esc(t.name)}
              </button>
            `
          )
          .join("")}
      </div>
    `;
    container.querySelectorAll(".tag-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        const id = Number(chip.dataset.tagId);
        if (selected.has(id)) selected.delete(id);
        else selected.add(id);
        chip.dataset.selected = selected.has(id) ? 1 : 0;
      });
    });
  }

  render();

  return {
    getSelected: () => Array.from(selected),
    setSelected: (ids) => {
      selected.clear();
      for (const id of ids) selected.add(Number(id));
      render();
    },
  };
}
