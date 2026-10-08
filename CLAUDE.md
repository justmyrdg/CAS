# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

CogniView AR: a school learning platform with course content, class management, learning analytics and AR. There are four independent npm projects: one shared backend and three clients. There is no root package.json or workspace, so run every command inside the project's own folder. [FEATURES.md](FEATURES.md) lists every feature by user role.

| Folder | What | Dev port |
|---|---|---|
| `backend/` | Express 5 + Prisma (PostgreSQL) API | 4000 |
| `admin-web/` | Admin/Dean portal (React + Vite) | 1200 |
| `instructor-web/` | Instructor portal (React + Vite) | 1201 |
| `student-mobile/` | Student app (Expo / React Native, also runs on web) | 1202 |

The ports are fixed (`strictPort`) and are also listed in the backend's `CORS_ORIGINS`. If you change one, change the other.

## Commands

Backend (`cd backend`):
- `npm run dev`: runs `tsx watch src/server.ts`
- `npm run typecheck`, `npm run build`
- `npm test`: node:test through tsx on `test/**/*.test.ts`. To run a single file: `npx tsx --test test/predictive.test.ts`. Tests cover pure utils and services only (no DB).
- `npm run prisma:migrate` (dev migration), `npm run prisma:generate`, `npm run prisma:studio`
- `npm run seed`: creates the admin, 3 instructors and 20 students, and writes their logins to `../DEFAULT_ACCOUNTS.txt` (gitignored). Every account uses the same password.
- `npm run seed:demo -- --yes`: **wipes the local DB** except the AR library, re-seeds accounts, and builds a deterministic demo (subjects, classes, about 10 weeks of simulated progress).
- `npm run ar:convert`: re-converts stored AR models. `npm run create:account` creates one account.

Web portals (`cd admin-web` or `cd instructor-web`): `npm run dev`, `npm run build` (`tsc -b && vite build`, which is also the typecheck), `npm run lint` (oxlint).

Student app (`cd student-mobile`): `npm run web` / `npm start`. It has no scripts for typecheck or lint, so use `npx tsc --noEmit`. On a real phone, set `EXPO_PUBLIC_API_URL` to the PC's LAN address. The Android emulator defaults to `10.0.2.2:4000`.

Login is rate-limited, so repeated failed logins during testing will lock you out for a while.

First-time backend setup: `cp .env.example .env` (set `DATABASE_URL` and the two JWT secrets, which must differ), then `npm install`, `npm run prisma:migrate`, `npm run seed`. Env vars are validated by zod in `src/config/env.ts`. Production applies migrations with `npm run prisma:deploy`, not `prisma:migrate`. Production must set `STORAGE_DRIVER=cloudinary` and `CLOUDINARY_URL`, because the host's disk is wiped on every deploy.

## Deployment

The web portals and the student app's web export each have a `vercel.json` with an SPA rewrite. The student web build is `npx expo export --platform web`. `student-mobile/eas.json` has an Android `preview` APK profile that bakes in `EXPO_PUBLIC_API_URL` pointing at the hosted backend (Render). `student-mobile/app.json` declares the Android package and camera permission, which the AR image tracking needs.

## Backend architecture

- The layers are strict: `routes/` → `controllers/` (thin, request/response only) → `services/` (business logic and the **only** layer that calls Prisma). Validate requests with zod through `middlewares/validate.ts`. Throw `utils/ApiError` and wrap handlers in `asyncHandler`.
- Route prefixes are set in `src/routes/index.ts`: `/api/admin/*` (ADMIN/DEAN), `/api/instructor/*` (INSTRUCTOR), `/api/student/*`. Access control uses `authenticate` + `authorize(...roles)`. `authenticate` re-reads the user from the DB on each request, so a disabled account is locked out immediately.
- Every User response goes through `utils/serializeUser.ts`.
- Auth uses a short-lived JWT access token plus rotating, single-use refresh tokens that are hashed in the DB. Each web app sends an `X-Client-App` header and gets its own refresh cookie. The mobile app receives the refresh token in the response body and stores it itself. Each client's `apiClient`/`api.ts` shares one in-flight refresh across concurrent 401s. Keep that behavior, because two parallel refreshes would spend the same token and sign the user out.
- Data model (`prisma/schema.prisma`): Subject → Module → Chapter → ContentItem (lesson or chapter quiz). Lessons store an ordered JSON `blocks` array, validated in `utils/lessonBlocks.ts`. A Class is one instructor's run of a Subject for a term/school year, and students join it through Enrollment. Progress is tracked in LessonCompletion and QuizAttempt. Instructor-authored class quizzes and exams are Assessment/AssessmentAttempt, with question types and marking in `utils/assessmentQuestions.ts`.
- Analytics are layered:
  - `progress.service.ts` computes per-student completion and `assessRisk` (risk level plus reasons).
  - `utils/predictive.ts` holds an explainable statistical forecast (pace, expected score, 80% interval, P(fail) against `PASSING_SCORE`).
  - `utils/prescriptive.ts` turns those signals into ranked recommended actions.
  - `classAnalytics.service.ts` (instructor) and `adminOverview.service.ts` (admin dashboard) aggregate these.
  
  Keep the math in pure utils so it can be unit-tested.
- AR: uploaded models are converted to self-contained GLB (`utils/modelConversion.ts`) and kept, along with lesson images and trigger pictures, by the file storage in `config/storage.ts`. Services call `storage.save/read/remove/send` and never touch `uploads/` directly. `STORAGE_DRIVER=local` (default) uses `backend/uploads/`, `cloudinary` uses Cloudinary (needs `CLOUDINARY_URL`). Files are addressed by the stored name in the DB, so switching needs no DB change: `npm run storage:migrate` (`-- --dry` to preview) copies the existing files up. Points of interest are in `utils/arHotspots.ts`. Static AR marker files are served from `backend/assets/ar-marker`.

## Clients

- The three clients share **no code**. Types and helpers such as API types, lesson block renderers and charts are duplicated per app. When you change a backend response shape, update each consuming client by hand. For example, analytics changes usually touch `admin-web`, `instructor-web/src/data/classAnalytics.ts` and `student-mobile/src/lib/studentApi.ts`.
- Each web portal has `lib/apiClient.ts` (base URL from `VITE_API_URL`), `state/AuthContext.tsx` and hand-rolled UI in `components/ui.tsx` and `components/charts.tsx`.
- The student app is responsive (phone under 600px, tablet 600-1023, desktop 1024+). `src/lib/responsive.ts` has the breakpoints and the centred `widePage`/`narrowPage` content columns. `Column` (reading screens) and `Grid` (cards) are in `components/ui.tsx`, and `MainTabs` switches to a left sidebar on desktop. Use these on new screens instead of fixed widths.
- The student app's AR viewer runs HTML pages built as strings in `src/lib/arPages.ts` (model-viewer, and MindAR + three.js for image tracking) inside a WebView, or an iframe on web.

## UI conventions

- List pages only list. Create and edit each open their own page (small "add" dialogs are the exception, e.g. a new subject).
- The student app should look formal, like the portals. Don't add game-like touches such as streaks, cheerful greetings or colorful banners.
