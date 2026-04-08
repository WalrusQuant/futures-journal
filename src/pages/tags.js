import {
  listTags,
  createTag,
  updateTag,
  deleteTag,
  TAG_CATEGORIES,
  TAG_COLORS,
} from "../lib/tags.js";
import { openModal, closeModal } from "../components/modal.js";
import { esc } from "../lib/format.js";
import { refreshPage } from "../main.js";

export async function render() {
  const tags = await listTags();
  const grouped = {};
  for (const cat of TAG_CATEGORIES) grouped[cat.value] = [];
  for (const t of tags) (grouped[t.category] ||= []).push(t);

  const html = `
    <div class="page-header">
      <div>
        <div class="crumbs">Taxonomy</div>
        <h1>Tags</h1>
      </div>
      <button class="primary" id="btn-new-tag">+ New tag</button>
    </div>

    ${
      tags.length === 0
        ? `<div class="card empty-state">
            <h3>No tags yet</h3>
            <p>Create tags to label your trades by strategy, setup, market condition, or mistake.</p>
          </div>`
        : TAG_CATEGORIES.map((cat) => {
            const list = grouped[cat.value] || [];
            if (list.length === 0) return "";
            return `
              <div class="tag-group">
                <h3>${cat.label}</h3>
                ${list.map(tagRowHtml).join("")}
              </div>
            `;
          }).join("")
    }
  `;

  function mount(pageEl) {
    pageEl
      .querySelector("#btn-new-tag")
      .addEventListener("click", () => openTagModal());
    pageEl.querySelectorAll("[data-edit-tag]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = Number(btn.dataset.editTag);
        const t = tags.find((x) => x.id === id);
        if (t) openTagModal(t);
      });
    });
    pageEl.querySelectorAll("[data-del-tag]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = Number(btn.dataset.delTag);
        if (!confirm("Delete this tag? It will be removed from all trades.")) return;
        await deleteTag(id);
        refreshPage();
      });
    });
  }

  return { html, mount };
}

function tagRowHtml(t) {
  return `
    <div class="tag-row">
      <span class="tag-static" style="--tag-color:${t.color}">${esc(t.name)}</span>
      <div class="row-actions">
        <button class="btn-link" data-edit-tag="${t.id}">edit</button>
        <button class="btn-link btn-danger" data-del-tag="${t.id}">delete</button>
      </div>
    </div>
  `;
}

function openTagModal(tag = null) {
  const isEdit = !!tag;
  const initial = tag || {
    name: "",
    color: TAG_COLORS[0],
    category: "strategy",
  };

  const wrap = document.createElement("div");
  wrap.innerHTML = `
    <form id="tag-form" autocomplete="off">
      <div class="form-row">
        <label>Name</label>
        <input name="name" required value="${esc(initial.name)}" placeholder="Momentum, Pullback, FOMO...">
      </div>
      <div class="form-row">
        <label>Category</label>
        <select name="category">
          ${TAG_CATEGORIES.map(
            (c) =>
              `<option value="${c.value}"${
                initial.category === c.value ? " selected" : ""
              }>${c.label}</option>`
          ).join("")}
        </select>
      </div>
      <div class="form-row">
        <label>Color</label>
        <div class="color-picker">
          ${TAG_COLORS.map(
            (c) => `
              <button type="button" class="color-swatch"
                      data-color="${c}"
                      data-selected="${c === initial.color ? 1 : 0}"
                      style="background:${c}"
                      aria-label="${c}"></button>
            `
          ).join("")}
        </div>
        <input type="hidden" name="color" value="${initial.color}">
      </div>
      <div class="form-error"></div>
      <div class="form-actions">
        <button type="button" data-action="cancel">Cancel</button>
        <button type="submit" class="primary">${isEdit ? "Save changes" : "Create tag"}</button>
      </div>
    </form>
  `;

  const form = wrap.querySelector("#tag-form");
  const errEl = wrap.querySelector(".form-error");
  const colorInput = form.elements.color;

  wrap.querySelectorAll(".color-swatch").forEach((sw) => {
    sw.addEventListener("click", () => {
      wrap
        .querySelectorAll(".color-swatch")
        .forEach((s) => (s.dataset.selected = 0));
      sw.dataset.selected = 1;
      colorInput.value = sw.dataset.color;
    });
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errEl.textContent = "";
    const fd = new FormData(form);
    const data = {
      name: (fd.get("name") || "").trim(),
      color: fd.get("color"),
      category: fd.get("category"),
    };
    if (!data.name) {
      errEl.textContent = "Name is required.";
      return;
    }
    try {
      if (isEdit) await updateTag(tag.id, data);
      else await createTag(data);
      closeModal();
      refreshPage();
    } catch (err) {
      console.error(err);
      errEl.textContent = String(err.message || err);
    }
  });

  wrap
    .querySelector('[data-action="cancel"]')
    .addEventListener("click", closeModal);

  openModal({
    title: isEdit ? "Edit tag" : "New tag",
    body: wrap,
    width: 460,
  });
}
