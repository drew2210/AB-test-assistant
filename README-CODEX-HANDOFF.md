# Algolia NextGen Academy

## Open This Project

Project folder:

`/Users/drewburton/Downloads/NextGenAcademy`

## Start The Dev Server

From the project root, run:

```bash
npm run dev -- --host 127.0.0.1 --port 4174
```

Then open:

`http://127.0.0.1:4174/`

If port `4174` is already taken, Vite will print the next available local URL.

## Build Check

To verify the app compiles:

```bash
npm run build
```

## What Is Implemented

- Onboarding flow with name, role, and industry
- Algolia-style academy homepage with featured widget and search-first flow
- Course experience with `Understand`, `Learn`, `Practice`, and `Show Me Everything`
- Simplified in-course Algolia AI Tutor
- Admin analytics dashboard with:
  - visual analytics
  - LMS-style reporting
  - top filters for role, industry, date range, course, and path
  - course duplication and editing in `Course Studio`

## Main Files

- `src/App.jsx`
- `src/styles.css`
- `index.html`
- `.env.example`

## Course Studio Notes

Duplicated courses are currently stored in local React state for this prototype.

Structured course fields include:

- `id`
- `courseId`
- `objectID`
- `slug`
- `title`
- `summary`
- `category`
- `path`
- `level`
- `runtime`
- `roles`
- `industries`
- `understand`
- `learn`
- `practice`

## Algolia Notes

Real Algolia search is used when these env vars are set:

- `VITE_ALGOLIA_APP_ID`
- `VITE_ALGOLIA_SEARCH_API_KEY`
- `VITE_ALGOLIA_INDEX_NAME`

Without them, the app falls back to a local in-memory search client so it still works for testing.

## Current Prototype Limitations

- Admin analytics data is partly seeded/mock and partly current-session event tracking
- Course Studio drafts are not yet persisted to a backend or external database
- New draft courses are not yet pushed to a real Algolia index automatically

## Best Next Steps

1. Persist Course Studio drafts to a backend or file-based source of truth.
2. Sync created/edited courses into Algolia records.
3. Persist learner analytics and LMS events outside local session state.
