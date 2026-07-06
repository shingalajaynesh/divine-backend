# divine-backend

The server-side GraphQL API container for the Divine Garbh Sanskar application. Built with Node.js, Express, Apollo Server, WebSockets (for subscriptions), and Sequelize PostgreSQL.

## Environment Setup

Create a `.env` file in the root of the `divine-backend` directory:

```env
PORT=4000
DB_NAME=divine_garbh_sanskar
DB_USER=postgres
DB_PASSWORD=replace_with_a_strong_password
DB_HOST=localhost
DB_PORT=5432
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_CLIENT_EMAIL=your_service_account_email
FIREBASE_PRIVATE_KEY="your_service_account_private_key"
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,http://localhost:5174,http://localhost:8081

# Keep-Alive (Self-Ping) Settings
# BACKEND_SELF_PING_URL=https://your-backend-url.onrender.com/health
# SELF_PING_INTERVAL_MS=600000

# Database Pooling Settings (Optimized defaults for Neon Tech)
DB_POOL_MAX=5
DB_POOL_MIN=1
DB_POOL_ACQUIRE=30000
DB_POOL_IDLE=10000
```

## Available Scripts

- **`npm start`**: Launch the production server.
- **`npm run dev`**: Launch the server in development mode with active `nodemon` watching.
- **`npm run db:migrate`**: Execute pending database structure migrations.
- **`npm run db:sync`**: Execute pending migrations and run the seed sync script (`src/scripts/sync-db.js`) to populate initialization data.
- **`npm test`**: Run the Node test suite for authorization and domain validation.

## Keep-Alive / Ping-Pong Configuration

To prevent Render (free-tier container) and Neon Tech (free-tier Postgres) from sleeping:
1. **`/ping` Endpoint:** Returns `{"message": "pong"}` for quick health checks.
2. **`/health` Endpoint:** Authenticates the connection to the database. Running this queries the database and keeps the Neon connection warm.
3. **Internal Self-Ping:** Set `BACKEND_SELF_PING_URL` in your Render Environment variables to `https://<your-app>.onrender.com/health`. The backend will automatically ping itself every 10 minutes to prevent the container from sleeping.
4. **External Fail-safe:** Setting up a free uptime check on **Cron-Job.org** or **UptimeRobot** pointing to `/health` is highly recommended to wake the container up if it ever spins down (e.g. after redeployment).

## Security and model setup

- Firebase ID tokens are verified by the official Firebase Admin SDK. The API never accepts client-supplied identity payloads.
- Keep `.env` untracked and configure production values through the deployment secret manager.
- `ALLOWED_ORIGINS` is a comma-separated allowlist for the marketing site, member app, and mobile development origin.
- The backend refers to `divine-data-models` as a dependency.

## Deployment Notes (Render)

For smooth builds on Render:
* In `package.json`, `divine-data-models` is set to install directly from your public GitHub repository: `"divine-data-models": "git+https://github.com/shingalajaynesh/divine-data-models.git"`.
* When deploying to Render, the default `yarn install` or `npm install` command will automatically resolve and install the shared models package directly from GitHub.

