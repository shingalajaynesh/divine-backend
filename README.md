# divine-backend

The server-side GraphQL API server for the Divine Garbh Sanskar application. Built with Node.js, Express, Apollo Server, WebSockets (for GQL subscriptions), and Sequelize PostgreSQL.

## Core Features

- **Apollo GraphQL Core**: Federated API layer declaring type definitions and resolvers.
- **Authentication**: Secured via `authManager.js` verifying Clerk and Firebase ID tokens.
- **Connection Pooling**: Customized database connection pool limits and timeouts optimized for Neon Tech serverless pg poolers.
- **Database Observability**: Tracks query latency, replication lag, and manages database backup ZIP generation snapshot logs.

---

## Workspace Directory Map

```text
divine-backend/
├── src/
│   ├── index.js             # Server entry point
│   ├── config/              # Security and DB initialization configs
│   ├── gql/
│   │   ├── models/          # Domain managers (auth, content, devices, vitals)
│   │   └── schema/          # Resolvers and Type Definitions
│   └── modules/             # Business logic modules (timeline, store, support)
├── migrations/              # Database schema migrations
└── test/                    # Integration tests (132 test cases)
```

---

## Environment Setup

Create a `.env` file in the root of the `divine-backend` directory:

```env
PORT=4000
DB_NAME=divinegarbh_sanskar
DB_USER=postgres
DB_PASSWORD=your_strong_password
DB_HOST=127.0.0.1
DB_PORT=5432
DB_SSL=false

# Firebase Configurations
FIREBASE_PROJECT_ID=divinegarbhsanskar-fc35d
FIREBASE_CLIENT_EMAIL=your_service_account_email
FIREBASE_PRIVATE_KEY="your_private_key_string"

# Connection String (Local development / Production Neon Tech override)
DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"
```

---

## Available Scripts

- **`npm start`**: Launch the server in production mode.
- **`npm run dev`**: Launch the server in development mode with `nodemon` file watching.
- **`npm run db:migrate`**: Run all pending database migrations against the configured DB.
- **`npm run db:sync`**: Run migrations and database seeds (`src/scripts/sync-db.js`).
- **`npm test`**: Execute the 132 integration tests covering all GraphQL schemas.

---

## Business Logic Modules

The backend is structured into domain-driven modules inside `src/modules/`:
- **`timeline`**: Drives daily pregnancy activity schedules and catch-up lock rules.
- **`recommendation`**: Trimester-specific PQ/IQ/EQ/SQ recommendation feed generator.
- **`partner`**: Manages co-parenting activity logs and streak stats.
- **`store`**: Product catalogs, stock deductions, shipping tracking, and return cycles.
- **`support`**: Handles customer support tickets, SLA tracking, and WhatsApp handoff integrations.
- **`platform`**: Handles feature flags, localization, database failovers, and backup registry logs.
