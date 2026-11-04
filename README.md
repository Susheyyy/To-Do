# To-Do

To-Do is a modern, privacy-first desktop task and habit management application built with Tauri 2, React 19, and Rust. It pairs local-first SQLite persistence with an ultra-responsive native desktop experience—including global quick-capture, voice dictation, time blocking, and habit streak tracking.

### ⚝ Features
- **Local-First & Offline Ready**: All tasks, projects, notes, and habits are stored locally on your device in SQLite with WAL mode. Zero tracking, zero cloud dependencies.
- **Floating Quick-Capture Capsule (`Ctrl + Alt + Space`)**: Summon an omnibar anywhere on your desktop to instantly capture ideas, paste links, or set due dates without interrupting your workflow.
- **Voice Dictation**: Built-in voice input for natural, hands-free task capture directly from the quick-capture bar.
- **Natural Language Due Dates**: Powered by `chrono-node`—type expressions like *"Submit tax report tomorrow 5pm"* or *"Review PR every Monday"* to automatically parse dates, times, and recurring rules.
- **Recurring Tasks**: Schedule tasks that repeat daily, weekly, on weekdays, or custom intervals with automatic recurring lease regeneration.
- **Habit Tracker & Streak Matrix**: Track consistency with an interactive 28-day habit matrix grid, visual streak counts, customizable frequencies, and color badges.
- **Interactive Calendar & Time Blocking**: Seamlessly switch between a full-month view, a 7-day grid, and a Google Calendar-style day schedule with drag-and-drop hourly time blocks (00:00–23:00).
- **Flexible Views (List & Kanban Board)**: Group and filter tasks by Priority (High, Medium, Low, None), Projects, or Labels in both linear and Kanban board layouts.
- **Subtasks & Checklists**: Break down complex objectives into manageable subtasks with immediate progress tracking.
- **Global Tray & Badging**: Native system tray integration with instant window toggling, overdue task badge counts, and launch-on-startup support.
- **Full Undo / Redo (`Ctrl + Z` / `Ctrl + Y`)**: Multi-level state history allowing instant recovery from accidental modifications or deletions.
- **Data Export & Automated Backups**: One-click JSON export, CSV export, and timestamped SQLite `.db` database snapshots directly from the settings panel.
- **Themes & Aesthetics**: Thoughtfully designed pastel and dark mode themes with zero distractions and custom SVG iconography.

### ⚝ Tech Stack
- **Frontend**: React 19, TypeScript, Vite, Zustand, `@dnd-kit` (Kanban drag & drop), `date-fns`, `chrono-node`
- **Desktop Runtime**: Tauri v2, Rust
- **Database & Storage**: SQLite (via `rusqlite` with WAL mode & automated migrations)
- **Desktop APIs**: Global Shortcuts, Native System Tray, Single Instance Lock, Autostart Plugin

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

#### 4. Build Production Executable
To package an optimized, standalone Windows installer (`.msi` / `.exe`):
```bash
npm run tauri build
```
The finished binary will be generated inside `src-tauri/target/release/bundle/`.

---

### ⚝ How to Use
- **Quick Capture**: Press `Ctrl + Alt + Space` anywhere in Windows to trigger the floating capsule. Type your task with natural language dates (e.g. *"Buy groceries tomorrow at 6pm"*) or hit the microphone icon to speak.
- **Organize with Projects & Sections**: Create projects in the sidebar, add sections to structure your deliverables, and drag tasks across Kanban columns.
- **Build Daily Habits**: Open the **Habits** tab to configure daily or weekday habits and click cells on the 28-day matrix to check off progress and build streaks.
- **Plan in Calendar**: Use the **Calendar** tab to view your workload in Month, Week, or Day mode, and click on hourly blocks to schedule time-sensitive tasks.
- **Manage Backups**: Navigate to **Settings** to trigger a SQLite database backup or export all tasks and projects to JSON / CSV format.

### ⚝ Future Scope
- **Mobile Integration**: Companion mobile application with peer-to-peer end-to-end encrypted local sync, biometric lock, and home-screen quick add widgets.

---

If you have feedback or ideas, feel free to reach out! <br>
If you like this project, consider giving it a star!
