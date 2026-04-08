// Wrapper around the Tauri commands and the trade_images table.
// Image bytes live on disk under {appData}/images/. Only the path,
// caption, and parent IDs live in the DB.
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { query, exec } from "./db.js";

export async function pickImageFile() {
  return openDialog({
    multiple: false,
    filters: [
      {
        name: "Images",
        extensions: ["png", "jpg", "jpeg", "gif", "webp", "bmp"],
      },
    ],
  });
}

// Copies a source file into the app data dir and returns the stored path.
export async function saveImageFile(sourcePath) {
  return invoke("save_image", { sourcePath });
}

export async function deleteImageFile(path) {
  return invoke("delete_image", { path });
}

// trade_id and plan_id are mutually exclusive in practice but the schema
// allows either to be nullable so an image can belong to either side.
export async function listImages({ tradeId = null, planId = null }) {
  if (tradeId != null) {
    return query(
      "SELECT * FROM trade_images WHERE trade_id = ? ORDER BY created_at",
      [tradeId]
    );
  }
  if (planId != null) {
    return query(
      "SELECT * FROM trade_images WHERE plan_id = ? ORDER BY created_at",
      [planId]
    );
  }
  return [];
}

export async function addImageRecord({ tradeId, planId, filePath, caption }) {
  const now = new Date().toISOString();
  const result = await exec(
    `INSERT INTO trade_images (trade_id, plan_id, file_path, caption, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [tradeId ?? null, planId ?? null, filePath, caption || null, now]
  );
  return result.lastInsertId;
}

// Removes the file on disk and the DB row.
export async function removeImage(id) {
  const rows = await query(
    "SELECT file_path FROM trade_images WHERE id = ?",
    [id]
  );
  if (!rows[0]) return;
  try {
    await deleteImageFile(rows[0].file_path);
  } catch (err) {
    // File might have been deleted already; log but proceed with the DB.
    console.warn("delete_image failed:", err);
  }
  await exec("DELETE FROM trade_images WHERE id = ?", [id]);
}
