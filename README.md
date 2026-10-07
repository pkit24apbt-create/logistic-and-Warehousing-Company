# SafeStack - Health & Safety Training Platform

Team Lightning McQueen - CET257, University of Sunderland.
Training platform for a warehousing company: modules, quizzes, safety puzzles, a 360 degree warehouse tour, reports and digital certificates.

**Stack:** React (Vite) - Node.js / Express - PostgreSQL

## Roles

| Role | What they can do |
|---|---|
| Employee | Take assigned modules, quizzes and puzzles, view certificates |
| Trainer | Build quizzes and puzzles for their modules, assign modules to employees |
| Supervisor | View team progress, compliance and reports |
| Administrator | Manage users, modules, certificates and settings |

## First-time setup

1. Install Node.js 18 or newer and PostgreSQL.
2. Create an empty database called `warehouse_safety`.
3. In pgAdmin, open the Query Tool on that database and run these files in order:
   1. `backend/database/database_setup.sql`
   2. `backend/database/sprint5_puzzles.sql`
   3. `backend/database/sprint5_puzzles_in_modules.sql`
   4. `backend/database/sprint5_notifications.sql`
4. Backend:
```
   cd backend
   copy .env.example .env      (then edit .env: database password and JWT_SECRET)
   npm install
   npm run dev
```
   `npm install` also installs the security packages (`helmet` and `express-rate-limit`), because they are listed in `package.json`.
5. Frontend (second terminal):
```
   cd frontend
   copy .env.example .env
   npm install
   npm run dev
```
6. Open http://localhost:5173. On a brand-new database the Setup page creates the first administrator.

## Creating an account from the terminal (optional)

Normal accounts are created by an Administrator on the **Users & Roles** page. If you ever need an account without the website (for example the very first administrator, or if you are locked out), run this from the `backend` folder:

```
node database/add-user.js "Full Name" email@company.com "A-Strong-Password1" administrator
```

- The last value is the role: `employee`, `trainer`, `supervisor` or `administrator`.
- The password must be at least 8 characters.
- The password is typed in the command, so it is never saved inside the code.
- Running the command with nothing after it prints the usage message.

## Project layout

```
backend/    Express API (routes/, middleware/, utils/, database/ SQL)
frontend/   React app (pages/, components/, utils/, styles/)
blender/    Script that builds the 3D warehouse scene (optional)
```

## Main features by sprint

- Sprint 1: login, roles, protected routes, dashboards
- Sprint 2: training modules, quizzes, automatic scoring
- Sprint 3: 360 degree warehouse tour, hazard puzzles, progress tracking
- Sprint 4: supervisor dashboard, 6 reports with CSV export, competency levels, PDF certificates, administration, module assignment
- Puzzles: photo hazard hunt, 360 hazard hunt, sequencing, matching (timed and attempt-limited options)

## Security notes

- Passwords are hashed with bcrypt; sign-in uses signed tokens.
- Sign-in is rate limited (20 failed tries per 15 minutes) and the API sends standard security headers.
- Puzzle answers are checked on the server and never sent to the browser before scoring.
- Keep `.env` out of Git.