# Canteen Workshop

A pre-canteen-pre-order Next.js app used as the starter repo for a 3.5-hour workshop on agentic development.

## Quickstart

```bash
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Then open http://localhost:3000 — you'll be redirected to `/menu`.

## Scripts

| Command                    | What it does                                                        |
| -------------------------- | ------------------------------------------------------------------- |
| `npm run dev`              | Start Next.js on http://localhost:3000                              |
| `npm run lint`             | Lint the codebase (includes the custom `require-auth-wrapper` rule) |
| `npm test`                 | Run unit tests with Vitest                                          |
| `npm run test:integration` | Run integration tests                                               |
| `npx tsc --noEmit`         | Type-check without emitting                                         |
| `npm run db:migrate`       | Apply Prisma migrations to the SQLite db                            |
| `npm run db:seed`          | Seed the db with menu items + sample orders                         |

## Codebase patterns

- API routes live in `src/app/api/*/route.ts` and **must** be wrapped in `withAuth`. The custom ESLint rule enforces this.
- Routes delegate to services in `src/lib/services/`. They never call Prisma directly.
- DB access goes through the singleton in `src/lib/prisma.ts`.

See `CLAUDE.md` for the full convention guide.

## Workshop materials

The `/workshop/` directory contains everything used in the live workshop:

- `workshop/inputs/feedback.md` — raw user feedback students synthesize
- `workshop/spec.md` — placeholder students fill in

If you're cloning to learn the codebase, ignore `/workshop/`.
