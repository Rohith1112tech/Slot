# JACK SPARROW // Free Fire 12-Slot Tournament System

An esports tournament registration web application built for the **JACK SPARROW** community with Free Fire slot booking, real-time Google Sheets backend syncing, and a password-protected admin portal.

---

## 🌟 Architecture & URLs

- **🎮 Player View**: [`https://freefireslot.netlify.app/player`](https://freefireslot.netlify.app/player)
  - Clean 12-slot Free Fire squad registration grid.
  - No admin access buttons or tabs visible.
  - Race condition validation preventing double-claims.

- **⚙️ Admin Panel**: [`https://freefireslot.netlify.app/admin`](https://freefireslot.netlify.app/admin)
  - **Password Protected**: Requires password `Suzie_zoro_1211` to unlock.
  - Live lobby dashboard of all 12 slots with status pills (`BOOKED` vs `OPEN`).
  - Edit team/IGL typos, clear slots, or manually assign teams.
  - Master reset button for new tournaments.

- **☁️ Google Sheets & Google Apps Script Backend**:
  - Automatically loads slots on start and auto-saves all claims, edits, and clears in real time.
