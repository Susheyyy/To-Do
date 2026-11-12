# To-Do

To-Do is a modern, privacy-first desktop task and habit management application built with Tauri 2, React 19, and Rust. It pairs local-first SQLite persistence with an ultra-responsive native desktop experience—including global quick-capture, voice dictation, time blocking, habit streak tracking, productivity analytics, real-time Google Calendar sync, and cross-device relay synchronization.

### ⚝ Features
- **Local-First & Offline Ready**: All tasks, projects, notes, and habits are stored locally on your device in SQLite with WAL mode. Zero tracking, zero forced cloud dependencies.
- **Cross-Device Sync Engine**: Optional background authenticated relay sync engine (`sync-server`) with incremental delta replication and Last-Write-Wins (LWW) conflict resolution across desktop devices.
- **Google Calendar Real-Time Sync**: Direct OAuth integration with Google Calendar. Tasks created with due dates automatically create and synchronize events in a dedicated "Todo Desktop" Google calendar.
- **Productivity Analytics & Heatmap**: Built-in 365-day GitHub-style contribution activity heatmap, total completions, active streaks, and daily task completion statistics.
- **Floating Quick-Capture Capsule (`Ctrl + Alt + Space`)**: Summon an omnibar anywhere on your desktop to instantly capture ideas, paste links, or set due dates without interrupting your workflow.
- **Natural Language Due Dates**: Powered by `chrono-node`—type expressions like *"Submit tax report tomorrow 5pm"* or *"Review PR every Monday"* to automatically parse dates, times, and recurring rules.
- **Recurring Tasks**: Schedule tasks that repeat daily, weekly, on weekdays, or custom intervals with automatic recurring lease regeneration.
- **Habit Tracker & Streak Matrix**: Track consistency with an interactive habit matrix grid, visual streak counts, customizable frequencies, and color badges.
- **Interactive Calendar & Time Blocking**: Seamlessly switch between a full-month view, a 7-day grid, and a Google Calendar-style day schedule with drag-and-drop hourly time blocks (00:00–23:00).
- **Flexible Views (List & Kanban Board)**: Group and filter tasks by Priority (High, Medium, Low, None), Projects, or Labels in both linear and Kanban board layouts.
- **Subtasks & Checklists**: Break down complex objectives into manageable subtasks with immediate progress tracking.
- **Global Tray & Badging**: Native system tray integration with instant window toggling, configurable click behavior, overdue task badge counts, and launch-on-startup support.
- **Full Undo / Redo (`Ctrl + Z` / `Ctrl + Y`)**: Multi-level state history allowing instant recovery from accidental modifications or deletions.
- **Data Export & Automated Backups**: One-click JSON export, CSV export, RFC 5545 `.ics` export, and timestamped SQLite `.db` database snapshots directly from the settings panel.
- **Themes & Aesthetics**: Thoughtfully designed pastel and dark mode themes with zero distractions and custom SVG iconography.

### ⚝ Tech Stack
- **Frontend**: React 19, TypeScript, Vite, Zustand, `@dnd-kit` (Kanban drag & drop), `date-fns`, `chrono-node`
- **Desktop Runtime**: Tauri v2, Rust
- **Database & Storage**: SQLite (via `rusqlite` with WAL mode, online backup API, & automated migrations)
- **Sync & Feeds**: Node.js relay server (`sync-server/server.mjs`) supporting delta sync and live iCalendar `.ics` feeds
- **Desktop APIs**: Global Shortcuts, Native System Tray, Single Instance Lock, Autostart Plugin, Tauri Opener Plugin

### ⚝ Installation & Setup

Get To-Do running locally for development or build a native executable for Windows.

#### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)
- [Rust & Cargo](https://www.rust-lang.org/tools/install)
- [C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) (for Windows compilation)

---

#### 1. Clone the Repository
```bash
git clone https://github.com/Susheyyy/todo-desktop.git
cd todo-desktop
```

---

#### 2. Install Frontend Dependencies
```bash
npm install
```

---

#### 3. Run in Development Mode
Launch both the Vite frontend and the Tauri native Rust window concurrently:
```bash
npm run tauri dev
```
*(On initial launch, Cargo will compile the backend Rust crates and open the native desktop application window.)*

---

#### 4. Run Cross-Device Sync Server (Optional)
Run one relay instance per trusted group with Node.js 22.13 or newer. The relay imports an existing JSON store into a SQLite file with the same path plus a `.sqlite` suffix. It preserves the JSON file, relay identity, and download cursors. Back up the SQLite database after upgrading. Set the same relay URL and access token in Settings on each desktop. The relay defaults to loopback.

```powershell
$env:TODO_SYNC_TOKEN = node -p "require('node:crypto').randomBytes(32).toString('hex')"
node sync-server/server.mjs
```

Upgrade the relay and all desktop clients together. Keep the generated token for future starts. For other devices, put the relay behind an HTTPS reverse proxy. Separate groups need distinct tokens, separate `TODO_SYNC_STORE` files, and separate desktop databases. A desktop database stays bound to the same relay group, even if that relay changes URL. The relay prints a separate calendar subscription key at startup. Subscribe with `/calendar.ics?key=<calendar-key>` and treat the subscription URL as private.

---

#### 5. Build Production Executable
To package an optimized, standalone Windows installer (`.msi` / `.exe`):
```bash
npm run tauri build
```
The finished binary will be generated inside `src-tauri/target/release/bundle/`.

---

### ⚝ Setting Up Google Calendar Sync

To sync your tasks in real time with Google Calendar:

1. **Create your Google OAuth Client ID (One-time, ~2 minutes)**:
   - Open the [Google Cloud Console Credentials Page](https://console.cloud.google.com/apis/credentials).
   - Create a project (e.g. `Todo Desktop`).
   - Go to **Enabled APIs & Services** ➔ **+ Enable APIs and Services** ➔ Search for **Google Calendar API** and click **Enable**.
   - Go to **OAuth consent screen**:
     - Select **External**, fill in an app name and your email address, and proceed.
     - Under **Test users**, add your own Gmail address.
   - Go to **Credentials** ➔ **+ Create Credentials** ➔ **OAuth client ID**:
     - Application type: **Web application**.
     - Name: `Todo Desktop Client`.
     - **Authorized JavaScript origins**:
       - `http://localhost:1420`
       - `http://tauri.localhost`
       - `https://tauri.localhost`
     - Click **Create** and copy your **Client ID** (e.g. `xxxx.apps.googleusercontent.com`).

2. **Connect inside To-Do**:
   - Open the desktop app and go to **Settings** ➔ **Google Calendar Real-Time Sync**.
   - Paste your Client ID and click **Connect Google Calendar**.
   - Sign in via the popup window and allow calendar permissions.
   - Task saves create or update linked events in the *"Todo Desktop"* calendar. Completing or deleting a task removes its linked event. The desktop queues changes in its database and retries failed deliveries. Reconnect Google Calendar if your session expires.

---

### ⚝ How to Use
- **Quick Capture**: Press `Ctrl + Alt + Space` anywhere in Windows to trigger the floating capsule. Type your task with natural language dates (e.g. *"Buy groceries tomorrow at 6pm"*) or hit the microphone icon to speak.
- **Google Calendar Sync**: Go to **Settings** -> **Google Calendar Real-Time Sync**, enter your Google OAuth Client ID, and connect to sync tasks with your Google Calendar automatically.
- **Productivity Analytics**: Click your profile icon in the sidebar and choose **Productivity Analytics** to view your 365-day completion activity heatmap and streak metrics.
- **Organize with Projects & Sections**: Create projects in the sidebar, add sections to structure your deliverables, and drag tasks across Kanban columns.
- **Build Daily Habits**: Open the **Habits** tab to configure daily or weekday habits and click cells on the matrix to check off progress and build streaks.
- **Plan in Calendar**: Use the **Calendar** tab to view your workload in Month, Week, or Day mode, and click on hourly blocks to schedule time-sensitive tasks.
- **Manage Backups**: Navigate to **Settings** to trigger a SQLite database backup or export all tasks and projects to JSON, CSV, or iCal format.

---

If you have feedback or ideas, feel free to reach out! <br>
If you like this project, consider giving it a star!
