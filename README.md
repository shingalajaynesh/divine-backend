# divine-backend

The server-side GraphQL API container for the Divine Garbh Sanskar application. Built with Node.js, Express, Apollo Server, WebSockets (for subscriptions), and Sequelize PostgreSQL.

## Environment Setup

Create a `.env` file in the root of the `divine-backend` directory:

```env
PORT=4000
DATABASE_URL=postgres://user:password@localhost:5432/divine_db
JWT_SECRET=your_jwt_signing_key
CLERK_SECRET_KEY=your_clerk_secret_key
CLERK_JWT_KEY=your_optional_clerk_pem_public_key
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174,http://localhost:8081
```

## Available Scripts

- **`npm start`**: Launch the production server.
- **`npm run dev`**: Launch the server in development mode with active `nodemon` watching.
- **`npm run db:migrate`**: Execute pending database structure migrations.
- **`npm run db:sync`**: Execute pending migrations and run the seed sync script (`src/scripts/sync-db.js`) to populate initialization data.
- **`npm test`**: Run the Node test suite for authorization and domain validation.

## Security and model setup

- Clerk sessions are verified by the official Clerk backend middleware. The API never accepts client-supplied identity payloads.
- Keep `.env` untracked and configure production values through the deployment secret manager.
- `ALLOWED_ORIGINS` and `CLERK_AUTHORIZED_PARTIES` are comma-separated allowlists for the marketing site, member app, and mobile development origin.
- Publish the matching `divine-data-models` revision before deploying the backend, then run `npm run db:migrate`.

## Deployment Notes (Render)

When deploying to Render, the project uses the remote GitHub link for `divine-data-models` to avoid file-cloning path errors. Ensure the deploy uses the updated `package.json` referencing:
`"divine-data-models": "git+https://github.com/shingalajaynesh/divine-data-models.git"`
