// Image gallery for a trade or a plan.
// - Lists existing images as thumbnails
// - "Add image" opens native file picker, copies file to app data dir
// - Click thumbnail to open full size in a modal
// - Delete removes file + DB row
import { convertFileSrc } from "@tauri-apps/api/core";
import {
  listImages,
  addImageRecord,
  removeImage,
  pickImageFile,
  saveImageFile,
} from "../lib/images.js";
import { openModal, closeModal } from "./modal.js";
import { esc } from "../lib/format.js";

export async function mountImageGallery(container, { tradeId = null, planId = null }) {
  async function render() {
    const images = await listImages({ tradeId, planId });
    container.innerHTML = `
      <div class="section-header">
        <h2>Screenshots</h2>
        <button type="button" id="btn-add-image">+ Add image</button>
      </div>
      ${
        images.length === 0
          ? `<div class="card empty-state"><p>No screenshots attached.</p></div>`
          : `<div class="image-gallery">
              ${images
                .map(
                  (img) => `
                    <div class="image-thumb" data-id="${img.id}" data-path="${esc(
                    img.file_path
                  )}">
                      <img src="${esc(convertFileSrc(img.file_path))}" alt="">
                      <button type="button" class="image-thumb-delete" data-del="${
                        img.id
                      }" title="Delete">×</button>
                    </div>
                  `
                )
                .join("")}
            </div>`
      }
    `;

    container
      .querySelector("#btn-add-image")
      .addEventListener("click", async () => {
        try {
          const source = await pickImageFile();
          if (!source) return;
          const stored = await saveImageFile(source);
          await addImageRecord({ tradeId, planId, filePath: stored });
          await render();
        } catch (err) {
          console.error(err);
          alert("Failed to add image: " + (err.message || err));
        }
      });

    container.querySelectorAll(".image-thumb").forEach((thumb) => {
      thumb.addEventListener("click", (e) => {
        if (e.target.matches(".image-thumb-delete")) return;
        openLightbox(thumb.dataset.path);
      });
    });

    container.querySelectorAll(".image-thumb-delete").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (!confirm("Delete this screenshot?")) return;
        await removeImage(Number(btn.dataset.del));
        await render();
      });
    });
  }

  await render();
}

function openLightbox(filePath) {
  const wrap = document.createElement("div");
  wrap.className = "lightbox";
  wrap.innerHTML = `<img src="${esc(convertFileSrc(filePath))}" alt="">`;
  openModal({
    title: "Screenshot",
    body: wrap,
    width: 1100,
  });
}
