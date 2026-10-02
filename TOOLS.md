# CogniView AR — Tools and Technologies

This lists the tools, libraries and services CogniView AR is built with, split into **front end** (what users see and interact with) and **back end** (the server and database). The versions come from each app's `package.json`.

## At a glance

| Layer | Apps | Main tools |
|---|---|---|
| **Front end** | Admin Portal, Instructor Portal | TypeScript, React, React Router, Vite |
| **Front end** | Student App | TypeScript, Expo, React Native, React Navigation |
| **Front end** | AR viewer (inside the Student App and Admin Portal) | model-viewer, MindAR, three.js |
| **Back end** | API server | TypeScript, Node.js, Express, Prisma |
| **Back end** | Database | PostgreSQL |

TypeScript is used on both the front end and the back end.

---

# Front end

## Admin Portal and Instructor Portal (`admin-web/`, `instructor-web/`)

Websites, used on a desktop.

| Tool | Version | Purpose |
|---|---|---|
| React | 19 | User interface |
| React Router | 7 | Page routing |
| Vite | 8 | Dev server and production build |
| oxlint | 1.81 | Linting |
| qrcode (Admin Portal only) | 1.5 | QR codes on the printable AR cards |
| Playwright | 1.63 | Browser automation (development only) |

## Student App (`student-mobile/`)

Mobile app for Android and iOS. It also runs in a browser.

| Tool | Version | Purpose |
|---|---|---|
| Expo | 57 | Mobile app platform (Android and iOS) |
| React Native | 0.86 | Native user interface |
| react-native-web | 0.21 | Runs the same app in a browser |
| React Navigation (native stack, bottom tabs) | 7 | Screens and tab bar |
| expo-camera | 57 | Camera for AR and QR scanning |
| expo-secure-store | 57 | Stores the login session securely |
| react-native-webview | 13.16 | Hosts the AR viewer pages |
| react-native-svg | 15.15 | Charts and icons |
| expo-font, Google Fonts (Work Sans, Source Serif 4) | — | Typography |
| expo-splash-screen, expo-status-bar, react-native-safe-area-context, react-native-screens | — | App shell |

## AR and 3D (loaded from a CDN at runtime)

These run inside the apps, in the user's browser or phone.

| Tool | Version | Purpose |
|---|---|---|
| Google `<model-viewer>` | 4.0 | Interactive 3D preview and AR placement |
| MindAR | 1.2.5 | Image tracking: a model appears when the camera sees a trigger picture |
| three.js | 0.160 | 3D rendering used with MindAR |
| jsQR | 1.4 | Reads QR codes from the camera |

## External services

| Service | Purpose |
|---|---|
| YouTube | Video blocks in lessons are embedded YouTube videos |

---

# Back end

## API server (`backend/`)

| Tool | Version | Purpose |
|---|---|---|
| Node.js | — | Runs the server |
| Express | 5 | Web API framework |
| Prisma (ORM + CLI) | 6.19 | Database access, schema and migrations |
| zod | 4 | Request validation |
| jsonwebtoken | 9 | JWT access tokens |
| ms | 2 | Token expiry times |
| bcrypt | 6 | Password hashing |
| cookie-parser | 1.4 | Refresh-token cookies |
| helmet | 8 | Security headers |
| cors | 2.8 | Allowed origins |
| express-rate-limit | 8 | Login rate limit |
| morgan | 1.12 | Request logging |
| dotenv | 18 | Loads `.env` settings |
| glTF-Transform (core, extensions, functions) | 4.5 | Converting uploaded 3D models to self-contained GLB |
| draco3dgltf | 1.5 | Compressed (Draco) 3D model support |
| fflate | 0.8 | Unzipping `.zip` model uploads |
| @msgpack/msgpack | 3.1 | Encoding the tracking data for AR trigger pictures |
| tsx | 4 | Runs TypeScript directly (dev server, scripts, tests) |
| node:test | built-in | Unit tests |

## Database

| Tool | Purpose |
|---|---|
| PostgreSQL | Stores accounts, subjects, classes, progress and AR data |
