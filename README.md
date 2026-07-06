# divine-backend

The server-side GraphQL API container for the Divine Garbh Sanskar application. Built with Node.js, Express, Apollo Server, WebSockets (for subscriptions), and Sequelize PostgreSQL.

## Environment Setup

Create a `.env` file in the root of the `divine-backend` directory:

```env
PORT=4000
DATABASE_URL=postgres://user:password@localhost:5432/divine_db
JWT_SECRET=your_jwt_signing_key
CLERK_PEM_PUBLIC_KEY=your_clerk_pem_public_key
```

## Available Scripts

- **`npm start`**: Launch the production server.
- **`npm run dev`**: Launch the server in development mode with active `nodemon` watching.
- **`npm run db:migrate`**: Execute pending database structure migrations.
- **`npm run db:sync`**: Execute pending migrations and run the seed sync script (`src/scripts/sync-db.js`) to populate initialization data.

## Deployment Notes (Render)

When deploying to Render, the project uses the remote GitHub link for `divine-data-models` to avoid file-cloning path errors. Ensure the deploy uses the updated `package.json` referencing:
`"divine-data-models": "git+https://github.com/shingalajaynesh/divine-data-models.git"`
