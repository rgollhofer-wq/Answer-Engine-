# Answer Engine Backend (AE)

Backend-only Answer Engine implementation with Fastify, TypeScript, Prisma, and OpenAI.

## Features
- `/health` and `/answer` endpoints
- Intent + entity extraction via LLM
- Confidence gating rules
- Structured trace output (no chain-of-thought)
- SQLite dev logging + Postgres-ready schema
- Optional Redis cache (no-op when unset)
- Rate limiting and optional API key auth

## Repository Structure
```
.
├── Dockerfile
├── docker-compose.yml
├── package.json
├── tsconfig.json
├── .env.example
└── src
    ├── server.ts
    ├── routes
    │   ├── answer.ts
    │   └── health.ts
    ├── core
    │   ├── engine.ts
    │   ├── intent.ts
    │   ├── normalize.ts
    │   ├── rules.ts
    │   ├── trace.ts
    │   └── validators.ts
    ├── providers
    │   ├── llm.ts
    │   └── openai.ts
    ├── data
    │   ├── cache.ts
    │   ├── db.ts
    │   ├── repo.ts
    │   └── schema.prisma
    ├── config
    │   └── env.ts
    └── utils
        ├── hash.ts
        ├── logger.ts
        └── timing.ts
```

## Local Development

```bash
cp .env.example .env
npm install
npm run prisma:generate
npm run prisma:push
npm run dev
```

Example request:

```bash
curl -X POST http://localhost:3000/answer \
  -H "Content-Type: application/json" \
  -d '{"question":"Is a front brake pad available locally and eligible for a 2021 Hyundai Tucson?","context":{"location":{"postal_code":"80112","radius_miles":25}}}'
```

## Environment Variables
See `.env.example` for the full list.

## Postgres (Production)
Prisma uses SQLite for local development. To use Postgres in production:
1. Update `datasource db` provider in `src/data/schema.prisma` to `postgresql`.
2. Set `DATABASE_URL` to your Postgres connection string.
3. Run `npm run prisma:generate` and `npx prisma migrate deploy`.

## Tests
```bash
npm test
```

## Docker
```bash
docker build -t ae-backend .
docker run -p 3000:3000 --env-file .env ae-backend
```

## Deploy to Render
1. Create a new **Web Service** in Render.
2. Set Build Command:
   ```bash
   npm install && npm run prisma:generate && npm run build
   ```
3. Set Start Command:
   ```bash
   node dist/server.js
   ```
4. Add environment variables from `.env.example`.
5. Use a Postgres instance and update `DATABASE_URL` accordingly.

## Notes
- If `API_KEY` is set, `Authorization: Bearer <API_KEY>` is required on `/answer`.
- CORS defaults to `*` in development, or use `CORS_ORIGINS` for a comma-separated allowlist.
