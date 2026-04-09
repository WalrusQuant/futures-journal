# Install and first launch

How to get Futures Journal running on your machine from source.

The app is distributed as source code you build yourself. There's no prebuilt installer yet — you'll
clone the repo, install dependencies once, and run `npm run tauri dev` to launch the desktop window.
If you've built a Tauri app before, this will feel familiar.

---

## Prerequisites

You need these installed before you start:

- **Node.js** 18 or newer — for Vite and the frontend dependencies
- **Rust toolchain** via [rustup](https://rustup.rs/) — the Tauri backend compiles with stable Rust
- **Platform Tauri prerequisites** — follow the official
  [Tauri prerequisites guide](https://tauri.app/start/prerequisites/) for your OS. On macOS you also
  need the Xcode Command Line Tools (`xcode-select --install`). On Linux you'll need the WebKit,
  GTK, and related dev packages listed on that page. On Windows you'll need the Microsoft C++ Build
  Tools and WebView2.

Everything else is handled by `npm install` and `cargo` when you build.

---

## Build and launch

```sh
git clone <your-fork-or-upstream-url> futures-journal
cd futures-journal
npm install
npm run tauri dev
```

The first launch takes a minute or two because Rust compiles the backend from scratch. Subsequent
launches reuse the cached build and start in a few seconds.

Here's what happens when `npm run tauri dev` runs:

1. Vite starts the frontend dev server on port 1420
2. `cargo` builds the Rust backend (slow the first time, cached after)
3. The desktop window opens at 1280×800 (resizable down to 1024×640)
4. All pending migrations run against the SQLite database
5. On a fresh install, the database file is created and the `instruments` table is seeded with
   common futures contracts (ES, MES, NQ, MNQ, CL, GC, ZB, and so on)

If the window appears and the sidebar loads, you're good. Head to the quickstart.

---

## Where your data lives

The app keeps everything in a single app-data directory on your disk. Nothing is sent over the
network. On macOS this is:

```
~/Library/Application Support/com.adamwickwire.futuresjournal/
├── futures-journal.db        main SQLite database
├── backups/                  auto + manual JSON backups
└── images/                   trade and plan screenshots
```

On Windows and Linux, the app uses the platform-equivalent app data directory
(`%APPDATA%\com.adamwickwire.futuresjournal\` on Windows, `~/.local/share/com.adamwickwire.futuresjournal/`
on Linux). **Settings → Diagnostics** inside the app shows you the exact path for your machine.

Back up the whole directory and you have everything — trades, plans, transactions, images, and
settings. The app also writes an automatic daily backup into `backups/` on launch, keeping the 14
most recent copies.

---

## After installing a database migration

If you pull new code that adds a migration (a new file in `src-tauri/migrations/`), **quit and
relaunch `npm run tauri dev`**. Hot reload only refreshes the frontend — migrations run exactly once
at Rust backend startup, so a running dev session won't pick up a new migration until you restart it.

---

## Now what

- [Quickstart](quickstart.md) — five minutes from empty database to your first reviewed trade
- [Philosophy](philosophy.md) — why the app is opinionated and what that means for you
