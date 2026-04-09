# Attaching screenshots

How to attach chart screenshots to trades and plans — locally, sandboxed, never uploaded anywhere.

---

## Where the gallery shows up

The screenshot gallery appears in two places on each side of the plan → trade loop:

- On the **trade form** (new and edit) — as the **Screenshots** section below the tags and notes
- On the **plan form** (new and edit) — same section, same widget
- On the **trade detail page** — read/write, click to enlarge
- On the **plan detail page** — read/write, click to enlarge

Same component (`mountImageGallery` from `src/components/image-gallery.js`) everywhere, so the behavior is
consistent across all four contexts.

## Two ways to add an image

1. **Click "+ Add image"** — opens a native file picker. Pick one or more image files and they'll be
   uploaded.
2. **Drag and drop** — drop an image file anywhere onto the gallery zone. The zone highlights when you
   drag over it. This uses the Tauri window drag-drop event, so it works on real files from Finder /
   Explorer, not on drags within a browser tab.

Supported formats: `.png`, `.jpg` / `.jpeg`, `.gif`, `.webp`, `.bmp`. The drag-drop handler filters on
these extensions; the file picker lets you pick anything but the save command will reject non-images at
copy time.

## What happens when you add an image

1. The file is read from its source location on your disk
2. It's copied into `<app_data>/images/` via the sandboxed `save_image` Rust command, which canonicalizes
   the destination path and refuses anything outside the images directory
3. For an already-saved trade or plan, a row is inserted into the `trade_images` table pointing at the new
   file
4. The gallery re-renders and the new thumbnail appears

The file is **never uploaded anywhere**. It lives on your machine, in your app-data directory, alongside
your database file. This is part of the same local-only guarantee as the rest of the app.

## Pending mode for new trades and plans

When you're creating a new trade or plan that hasn't been saved yet, there's no row ID to attach images to.
The gallery handles this by running in **pending mode**: images you add are still copied to disk
immediately, but they're buffered in memory (not linked to any database row) until the parent form saves.

On a successful save, `commitPending()` runs and writes one `trade_images` row per pending image, linking
them to the new trade or plan. If you cancel the form or navigate away before saving, the pending images
are effectively orphaned on disk — the database rows were never written, so the app will never surface them
again, but the files themselves aren't automatically cleaned up. This is a rare enough case that it's
treated as acceptable leakage; if you want to clean up, the directory is `<app_data>/images/`.

## The lightbox

Click any thumbnail to open it in a lightbox (full-size modal view). The lightbox is a standard modal —
click outside the image or press Escape to close. There's no zoom or pan; it's just a large version of the
image for when you want to actually read the chart.

## Deleting an image

Hover a thumbnail and a small × button appears in the corner. Click it, confirm the delete dialog, and the
image is removed from the gallery, the `trade_images` row is deleted, and the file is removed from disk via
the sandboxed `delete_image` Rust command. The delete is permanent — there's no trash.

If you delete an image from the gallery in **pending mode** (before the parent form has been saved), the
buffered entry is dropped and the already-copied file on disk is best-effort deleted.

---

## What this actually records

Adding an image to a saved trade or plan writes a row to the `trade_images` table with:

- **`trade_id`** — set if the image is attached to a trade, otherwise `null`
- **`plan_id`** — set if the image is attached to a plan, otherwise `null`
- **`file_path`** — the absolute path to the copied file in `<app_data>/images/`
- **`created_at`** — the current timestamp

The table is **polymorphic**: each row carries either `trade_id` or `plan_id`, never both. The gallery
component picks the right column based on whether it's mounted with `{ tradeId }` or `{ planId }`. Deleting
the trade or plan cascades to delete the `trade_images` rows too.

The files themselves live in `<app_data>/images/`, written there by the `save_image` Rust command, which
enforces a canonicalized-path sandbox check — nothing in the app can read or write files outside that
directory by accident or design.

On macOS the full path looks like
`~/Library/Application Support/com.adamwickwire.futuresjournal/images/`.

## Related reading

- [Writing a plan](writing-a-plan.md) — where you typically attach charts showing your thesis
- [Reviewing a closed trade](reviewing-a-closed-trade.md) — the other natural moment to attach a screenshot
- [Logging a normal trade](logging-a-normal-trade.md) — trade creation flow
