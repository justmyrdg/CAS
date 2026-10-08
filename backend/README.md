# CogniView AR — Backend API

Shared Express + TypeScript backend for `admin-web`, `instructor-web`, and `student-mobile`. This first slice implements authentication and admin/dean account management; instructor/student endpoints will be added on top of the same `User` table (see `role` enum in `prisma/schema.prisma`).

## Stack

- **Express 5** with an MVC-style layout: `routes/` → `controllers/` (thin, request/response only) → `services/` (business logic, the only layer that talks to Prisma). No raw SQL and no Prisma calls in routes/controllers.
- **PostgreSQL** via **Prisma** (chosen over Sequelize for its generated types — every query is type-checked against the schema, which is what keeps raw SQL out of the routes in the first place).
- **JWT** access tokens (short-lived, 15m default) + rotating **refresh tokens** (7d default, httpOnly cookie, hashed at rest, revocable — see "Auth model" below).
- **bcrypt** for password hashing (cost factor 12).
- **zod** for request validation.
- **helmet**, **cors** (explicit origin allowlist + credentials), and **express-rate-limit** (login endpoint) for baseline hardening.

## Setup

```bash
cp .env.example .env   # fill in DATABASE_URL, JWT secrets, SEED_ADMIN_* — see below
npm install
npm run prisma:migrate   # applies prisma/migrations against DATABASE_URL
npm run seed              # creates the bootstrap ADMIN (SEED_ADMIN_* env vars) + 3 instructors + 20 students; writes logins to ../DEFAULT_ACCOUNTS.txt
npm run dev                # tsx watch src/server.ts, http://localhost:4000
```

Other scripts: `npm run build` (tsc → `dist/`), `npm start` (run the build), `npm run typecheck`, `npm test` (node:test via tsx — `test/**/*.test.ts`, lesson blocks and image validation), `npm run prisma:studio`, `npm run prisma:deploy` (apply migrations without prompting — for CI/production).

`npm audit` reports a high-severity advisory in `deepmerge-ts`, pulled in transitively by the `prisma` CLI's own config loader (`@prisma/config`). It's a dev-time-only dependency of the migration/generate tooling, not of `@prisma/client` (what the running server uses), so it isn't reachable through the API.

## Auth model

- `POST /api/auth/login` accepts `{ identifier, password }` — `identifier` is an email or an `employeeId`, so admin-web's "Employee ID" field and a future email-based flow both work against the same endpoint. Returns `{ user, accessToken }` and sets an httpOnly `refreshToken` cookie scoped to `/api/auth`.
- `POST /api/auth/refresh` reads the refresh cookie, verifies + rotates it (the old one is revoked in the DB the moment a new one is issued — a stolen, replayed refresh token stops working as soon as the real client refreshes), and returns a new access/refresh pair.
- `POST /api/auth/logout` revokes the presented refresh token and clears the cookie.
- `GET /api/auth/me` (requires `Authorization: Bearer <accessToken>`) returns the current user.
- **Disabling an account takes effect immediately, not just at next login**: the `authenticate` middleware re-reads the user from the DB on every request and rejects if `isActive` is false, rather than trusting the JWT's claims for the account's current state.
- Passwords are never returned in any response — every endpoint serializes users through `utils/serializeUser.ts`, the one function allowed to turn a Prisma `User` row into an HTTP response body.

## Admin/dean account management

All routes under `/api/admin/accounts` require a valid access token for an **active ADMIN or DEAN** (`authenticate` + `authorize('ADMIN', 'DEAN')`).

- `GET /api/admin/accounts` — list ADMIN/DEAN accounts.
- `POST /api/admin/accounts` — create a new ADMIN or DEAN account (`{ name, email, password, role, employeeId }`; password must be ≥8 chars with an uppercase letter and a digit).
- `PATCH /api/admin/accounts/:id/status` — `{ isActive: boolean }`. This is the "turn an account off/on at any time" switch — a disabled account is rejected at login and at every subsequent authenticated request. An admin cannot disable their own account (guards against accidental lockout with no other admin left to re-enable it).

There's no self-service signup: the very first ADMIN comes from `npm run seed` (reads `SEED_ADMIN_EMAIL` / `SEED_ADMIN_NAME` / `SEED_ADMIN_EMPLOYEE_ID`; every seeded account uses the password `CogniView2026!`), and every account after that is created by an already-authenticated ADMIN/DEAN through the API above.

## File storage

Uploaded AR models, AR trigger pictures and lesson images go through `src/config/storage.ts`, chosen by `STORAGE_DRIVER` in `.env`:

- `local` (default): files are written to `backend/uploads/{ar,ar-triggers,images}`. Fine for development; a production host such as Render loses them on every deploy.
- `cloudinary`: files are uploaded to Cloudinary as raw resources under `<CLOUDINARY_FOLDER>/{ar,ar-triggers,images}/<stored name>`. Set `CLOUDINARY_URL` (the "API environment variable" from the Cloudinary dashboard). Downloads still go through this API (`/api/ar-models/:id/file` etc.), so the apps and URLs don't change.

Files are addressed by the stored name already in the database, so switching drivers needs no migration of rows. To move existing files up, set `CLOUDINARY_URL`, run `npm run storage:migrate -- --dry` to preview, then `npm run storage:migrate`, then set `STORAGE_DRIVER=cloudinary` in the production environment.

Cloudinary's plan limits apply to raw files (the free plan allows far less than this app's 50 MB model limit), so check your plan if a large model upload is rejected.

## CORS

`CORS_ORIGINS` in `.env` is a comma-separated allowlist. Requests with no `Origin` header (native mobile clients, curl) are allowed through; browser requests from an origin not on the list get a `403`. `credentials: true` is enabled so the refresh-token cookie works for the two web apps; update `CORS_ORIGINS` when a frontend's dev port or production domain changes.
