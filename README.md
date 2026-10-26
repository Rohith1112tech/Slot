# NEXUS ARENA // 12-Slot Gaming Tournament Registration System

A modern esports gaming tournament registration web application built with React, Vite, and Lucide icons featuring a dark-mode glassmorphic aesthetic with neon accents. Integrated with a Google Apps Script & Google Sheets backend.

---

## 🌟 Key Features

- **🎮 Player View**:
  - Live 12-slot tournament grid with real-time status indicators.
  - Interactive claim form (`Team Name`, `IGL Name`) with instant optimistic updates.
  - Locked & greyed-out visual states for booked slots to prevent overwriting.
  - Race condition locking validation before submitting claims.

- **⚙️ Admin Panel** (`#/admin`):
  - Master lobby dashboard of all 12 slots with status badges (`BOOKED` vs `OPEN`).
  - Search & filter slots by status (`All`, `Booked`, `Open`).
  - **Inline Editor**: Fix typos in team names or IGL handles.
  - **Slot Clear / Delete**: Reset any slot back to open immediately.
  - **Manual Assignment**: Directly allocate teams to vacant slots.
  - **Master Reset**: Reset the entire 12-slot bracket with one click.
  - **Webhook Manager**: Live connection indicator & URL updater.

- **☁️ Google Apps Script & Google Sheets Backend**:
  - Auto-fetches all 12 slots on page load via `GET`.
  - Auto-saves all claims, edits, and clears via `POST` with action history.
  - Offline fallback to `localStorage` when disconnected.

---

## 🚀 Getting Started

### Local Development

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start the development server**:
   ```bash
   npm run dev
   ```

3. **Build for production**:
   ```bash
   npm run build
   ```

---

## 🌐 Netlify Deployment

This repository includes `netlify.toml` pre-configured for SPA routing:
- **Build command**: `npm run build`
- **Publish directory**: `dist`
- **Environment variables** (optional): Set `VITE_WEBHOOK_URL` in Netlify dashboard if using a custom backend.

---

## 📊 Google Apps Script Backend

The Google Apps Script code is available in [`google-apps-script/Code.gs`](google-apps-script/Code.gs).
See instructions inside the file to deploy your own instance to Google Sheets.
