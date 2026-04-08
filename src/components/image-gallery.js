// Image gallery for trades and plans.
//
// Two modes:
//   1) DB-backed: pass { tradeId } or { planId } — list/upload/delete are
//      persisted to trade_images on the spot.
//   2) Pending:   pass { pending: true } — files are still copied to disk
//      via save_image, but no DB rows are written. The form gets the list
//      via getPending() and links them after the parent record is saved.
//
// Both modes support: native file picker, drag-and-drop into the window,
// click-to-enlarge lightbox, hover-to-delete.
import { convertFileSrc } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import {
  listImages,
  addImageRecord,
  removeImage,
  pickImageFile,
  saveImageFile,
  deleteImageFile,
} from "../lib/images.js";
import { openModal } from "./modal.js";
import { esc } from "../lib/format.js";
import { registerPageCleanup } from "../main.js";

export async function mountImageGallery(
  container,
  { tradeId = null, planId = null, pending = false } = {}
) {
  // For pending mode we keep the list in JS until commitPending() is called.
  let pendingImages = []; // [{ filePath }]

  async function listCurrent() {
    if (pending) return pendingImages.map((p, i) => ({ ...p, _idx: i }));
    return listImages({ tradeId, planId });
  }

  async function persist(filePath) {
    if (pending) {
      pendingImages.push({ filePath });
    } else {
      await addImageRecord({ tradeId, planId, filePath });
    }
  }

  async function remove(image) {
    if (pending) {
      // Best-effort delete the on-disk file we just copied in.
      try {
        await deleteImageFile(image.file_path || image.filePath);
      } catch (err) {
        console.warn(err);
      }
      pendingImages.splice(image._idx, 1);
    } else {
      await removeImage(image.id);
    }
  }

  async function handleSourcePaths(paths) {
    for (const src of paths) {
      try {
        const stored = await saveImageFile(src);
        await persist(stored);
      } catch (err) {
        console.error("save_image failed:", err);
        alert("Failed to save image: " + (err.message || err));
      }
    }
    await render();
  }

  async function render() {
    const images = await listCurrent();
    container.innerHTML = `
      <div class="section-header">
        <h2>Screenshots</h2>
        <button type="button" id="btn-add-image">+ Add image</button>
      </div>
      <div class="image-zone" id="image-zone">
        ${
          images.length === 0
            ? `<div class="card empty-state image-empty">
                <p>Drop screenshots here, or click <strong>+ Add image</strong>.</p>
              </div>`
            : `<div class="image-gallery">
                ${images
                  .map((img) => {
                    const path = pending ? img.filePath : img.file_path;
                    const handle = pending
                      ? `data-pending-idx="${img._idx}"`
                      : `data-id="${img.id}"`;
                    return `
                      <div class="image-thumb" ${handle} data-path="${esc(path)}">
                        <img src="${esc(convertFileSrc(path))}" alt="">
                        <button type="button" class="image-thumb-delete" title="Delete">×</button>
                      </div>
                    `;
                  })
                  .join("")}
              </div>`
        }
      </div>
    `;

    container
      .querySelector("#btn-add-image")
      .addEventListener("click", async () => {
        try {
          const source = await pickImageFile();
          if (!source) return;
          const sources = Array.isArray(source) ? source : [source];
          await handleSourcePaths(sources);
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
      thumb
        .querySelector(".image-thumb-delete")
        .addEventListener("click", async (e) => {
          e.stopPropagation();
          if (!confirm("Delete this screenshot?")) return;
          if (pending) {
            const idx = Number(thumb.dataset.pendingIdx);
            await remove({ _idx: idx, filePath: thumb.dataset.path });
          } else {
            await remove({ id: Number(thumb.dataset.id) });
          }
          await render();
        });
    });
  }

  // Window-level drag-and-drop. We highlight the gallery zone on enter.
  let zoneEl = null;
  function getZone() {
    return container.querySelector("#image-zone");
  }
  let unlistenDragDrop = null;
  try {
    const webview = getCurrentWebview();
    unlistenDragDrop = await webview.onDragDropEvent((event) => {
      const z = getZone();
      if (!z) return;
      if (event.payload.type === "enter" || event.payload.type === "over") {
        z.classList.add("drop-over");
      } else if (event.payload.type === "leave") {
        z.classList.remove("drop-over");
      } else if (event.payload.type === "drop") {
        z.classList.remove("drop-over");
        const paths = event.payload.paths || [];
        const accepted = paths.filter((p) =>
          /\.(png|jpe?g|gif|webp|bmp)$/i.test(p)
        );
        if (accepted.length) handleSourcePaths(accepted);
      }
    });
  } catch (err) {
    console.warn("drag-drop unavailable:", err);
  }
  if (unlistenDragDrop) {
    registerPageCleanup(() => {
      try {
        unlistenDragDrop();
      } catch (e) {
        console.warn(e);
      }
    });
  }

  await render();

  return {
    // Pending-mode hook: form calls this after createTrade/createPlan to
    // attach the buffered images to the new record.
    commitPending: async ({ tradeId: tid = null, planId: pid = null } = {}) => {
      for (const img of pendingImages) {
        await addImageRecord({
          tradeId: tid,
          planId: pid,
          filePath: img.filePath,
        });
      }
      pendingImages = [];
    },
    getPendingCount: () => pendingImages.length,
  };
}

function openLightbox(filePath) {
  const wrap = document.createElement("div");
  wrap.className = "lightbox";
  wrap.innerHTML = `<img src="${esc(convertFileSrc(filePath))}" alt="">`;
  openModal({ title: "Screenshot", body: wrap, width: 1100 });
}
