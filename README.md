# Póca

Open-source personal finance app made for users in Ireland. Track spending, set budgets, and connect bank accounts via [Enable Banking](https://enablebanking.com/) (PSD2 Open Banking).

## Stack

- **Monorepo:** Turborepo + pnpm
- **Frontend:** Next.js 15 (`apps/web`)
- **Backend:** NestJS (`apps/api`)
- **Database:** PostgreSQL + Prisma (`packages/db`)
- **Bank sync:** Enable Banking via `@poca/bank-connect`
- **CI:** GitHub Actions

## Prerequisites

- Node.js 20+
- pnpm 10+
- Docker (for local Postgres & Redis)
- [Enable Banking](https://enablebanking.com/sign-in/) account

## Quick start

```bash
pnpm install
docker compose up -d
cp .env.example .env
pnpm db:generate
pnpm db:migrate
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Enable Banking setup

### 1. Register a Production application

1. Sign in at [enablebanking.com/sign-in](https://enablebanking.com/sign-in/)
2. Go to **Control Panel → API applications → Add new application**
3. Choose **Production** environment
4. Set redirect URL: `http://localhost:3000/bank/callback`
5. Click **Register** — your browser downloads a `.pem` file (filename = application ID)

### 2. Activate for personal use

Your app starts as **Inactive**. Click **Activate by linking accounts** and connect your own bank account(s). This enables free personal use in restricted mode.

See [linked accounts docs](https://enablebanking.com/docs/api/linked-accounts/).

### 3. Configure Póca

Move the `.pem` file somewhere safe (e.g. `keys/`) and add to `.env`:

```env
ENABLE_BANKING_APPLICATION_ID=your-app-uuid-from-filename
ENABLE_BANKING_PRIVATE_KEY_PATH=/absolute/path/to/your-app-uuid.pem
```

Never commit the `.pem` file.

### 4. Link a bank

```bash
# List Irish banks
curl http://localhost:3001/bank/institutions?country=IE

# Start connection (use institution id from the list, e.g. IE|Revolut)
curl -X POST http://localhost:3001/bank/link \
  -H "Content-Type: application/json" \
  -d '{
    "institutionId": "IE|Revolut",
    "redirectUrl": "http://localhost:3000/bank/callback"
  }'
```

Open the returned `link` URL in your browser. After authorising, you'll be redirected to `/bank/callback` which completes the connection.

### 5. Sync transactions

```bash
curl -X POST http://localhost:3001/bank/sync \
  -H "Content-Type: application/json" \
  -d '{ "bankConnectionId": "<connection-id-from-link-response>" }'
```

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/bank/institutions?country=IE` | List Irish banks |
| POST | `/bank/link` | Start bank connection |
| POST | `/bank/callback` | Complete OAuth (code + state) |
| GET | `/bank/connections/:id` | Connection status |
| POST | `/bank/sync` | Sync accounts & transactions |

## Project structure

```
apps/
  api/          NestJS REST API
  web/          Next.js frontend
packages/
  bank-connect/ Enable Banking provider adapter
  db/           Prisma schema & client
  shared/       Zod schemas & constants
```

## License

MIT — see [LICENSE](LICENSE).
