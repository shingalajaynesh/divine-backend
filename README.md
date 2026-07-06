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
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174,http://localhost:8081
```

## Available Scripts

- **`npm start`**: Launch the production server.
- **`npm run dev`**: Launch the server in development mode with active `nodemon` watching.
- **`npm run db:migrate`**: Execute pending database structure migrations.
- **`npm run db:sync`**: Execute pending migrations and run the seed sync script (`src/scripts/sync-db.js`) to populate initialization data.
- **`npm test`**: Run the Node test suite for authorization and domain validation.

## Security and model setup

- Firebase ID tokens are verified by the official Firebase Admin SDK. The API never accepts client-supplied identity payloads.
- Keep `.env` untracked and configure production values through the deployment secret manager.
- `ALLOWED_ORIGINS` is a comma-separated allowlist for the marketing site, member app, and mobile development origin.
- Publish the matching `divine-data-models` revision before deploying the backend, then run `npm run db:migrate`.

## Deployment Notes (Render)

The backend currently uses the sibling `divine-data-models` package. Deploy both directories from the same workspace or publish the matching model package revision before deployment.
