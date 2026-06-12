# Fullstack Starter — React + Vite + Node.js

## Stack
| Layer    | Tech                                      |
|----------|-------------------------------------------|
| Frontend | React 18, Vite, React Router v6, i18next  |
| Backend  | Node.js (ESM), Express 4, Helmet, Morgan  |
| i18n     | EN 🇬🇧 · FR 🇫🇷 · AR 🇸🇦 · ES 🇪🇸 (auto-detect, fallback → EN) |

---

## Quick Start

```bash
# 1 – Install everything
npm run install:all

# 2 – Copy backend env (optional – defaults work)
cp backend/.env.example backend/.env

# 3 – Run both servers concurrently
npm run dev
```

- Frontend → http://localhost:5173  
- Backend  → http://localhost:4000  
- API proxy `/api/*` is forwarded automatically by Vite.

---

## Language Detection

`i18next-browser-languagedetector` checks in order:

1. `?lng=fr` query-string  
2. `localStorage` (persisted from last visit)  
3. Browser `navigator.language`

If the detected language isn't `en | fr | ar | es`, it falls back to **English**.

Switch language at runtime with the buttons in the nav bar; the choice is saved to `localStorage`.

---

## Project Structure

```
├── backend/
│   ├── src/
│   │   ├── index.js          # Express app
│   │   └── routes/
│   │       ├── api.js        # /api router
│   │       └── users.js      # /api/users CRUD
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── main.jsx          # Entry point
│   │   ├── App.jsx           # RouterProvider
│   │   ├── i18n.js           # i18next config
│   │   ├── router/index.jsx  # Route definitions
│   │   ├── components/
│   │   │   └── Layout.jsx    # Shell + Nav + Lang switcher
│   │   ├── pages/
│   │   │   ├── HomePage.jsx
│   │   │   ├── AboutPage.jsx
│   │   │   ├── UsersPage.jsx
│   │   │   └── NotFoundPage.jsx
│   │   └── locales/
│   │       ├── en/translation.json
│   │       ├── fr/translation.json
│   │       ├── ar/translation.json
│   │       └── es/translation.json
│   └── package.json
│
└── package.json              # Root scripts (concurrently)
```

---

## Adding a New Language

1. Create `frontend/src/locales/<code>/translation.json`  
2. Import it in `frontend/src/i18n.js` and add to `resources`  
3. Add a button in `frontend/src/components/Layout.jsx` → `LANGUAGES` array

## Adding a New Route

1. Create `frontend/src/pages/MyPage.jsx`  
2. Add the route in `frontend/src/router/index.jsx`  
3. Add translations under `nav.myPage` in each locale file
