# divine-backend

The server-side GraphQL API server for the Divine Garbh Sanskar application. Built with Node.js, Express, Apollo Server, WebSockets (for GQL subscriptions), and Sequelize PostgreSQL.

## Core Features

- **Apollo GraphQL Core**: Federated API layer declaring type definitions and resolvers.
- **Authentication**: Secured via `authManager.js` verifying Firebase ID tokens and mapping them to local users, sessions, devices, roles, and permissions.
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
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174,http://localhost:8081
DB_NAME=divine_garbh_sanskar
DB_USER=postgres
DB_PASSWORD=<replace_with_local_database_password>
DB_HOST=localhost
DB_PORT=5432
DB_SSL=false

# Firebase Admin
FIREBASE_PROJECT_ID=<firebase_project_id>
FIREBASE_CLIENT_EMAIL=<firebase_service_account_email>
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n<firebase_private_key>\n-----END PRIVATE KEY-----\n"

# Optional PostgreSQL connection string override
DATABASE_URL=postgresql://<db_user>:<db_password>@<db_host>:5432/<db_name>?sslmode=require

# Razorpay, Cloudinary, and WhatsApp provider credentials
RAZORPAY_KEY_ID=<razorpay_key_id>
RAZORPAY_KEY_SECRET=<razorpay_key_secret>
RAZORPAY_WEBHOOK_SECRET=<razorpay_webhook_secret>
CLOUDINARY_CLOUD_NAME=<cloudinary_cloud_name>
CLOUDINARY_API_KEY=<cloudinary_api_key>
CLOUDINARY_API_SECRET=<cloudinary_api_secret>
WP_FALLBACK_ACCESS_TOKEN=<whatsapp_access_token>
WP_FALLBACK_PHONE_NUMBER_ID=<whatsapp_phone_number_id>
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
- **`subscription`**: Creates trusted Razorpay subscription checkout intents, verifies checkout signatures against the stored intent, and finalizes subscription, invoice, coupon redemption, and finance records atomically.
- **`support`**: Handles customer support tickets, SLA tracking, and WhatsApp handoff integrations.
- **`platform`**: Handles feature flags, localization, database failovers, and backup registry logs.

---

## Payment Checkout Notes

Razorpay is the canonical payment gateway for subscription checkout. The backend calculates plan price, coupon discount, currency, and amount in paise, then stores those values in `payment_checkout_intents` before creating the Razorpay order.

Normal users cannot activate paid subscriptions through `subscribeToPlan`; they must use `createRazorpayOrder` followed by `verifyRazorpayPayment`. Verification ignores frontend-supplied plan data and finalizes from the trusted checkout intent only.

Razorpay webhook reconciliation is handled by `POST /webhooks/razorpay`. This route is mounted before the global JSON parser and uses `express.raw()` so signature verification uses the exact raw request bytes. The route verifies `X-Razorpay-Signature`, stores a provider-event ledger entry, and dispatches supported events idempotently.

Frontend checkout verification remains supported for immediate UX, but it now performs a server-side Razorpay payment fetch and activates the subscription only when the provider reports a captured payment. Webhooks remain the independent reconciliation source and converge on the same checkout-intent finalizer.

Supported webhook events:

- `payment.authorized`
- `payment.captured`
- `payment.failed`
- `order.paid`
- `refund.created`
- `refund.processed`
- `refund.failed`

Refund requests are admin/staff-only. A refund mutation creates a provider refund request and a pending finance transaction; payment/refund records are marked processed only after provider confirmation through webhook or manual reconciliation.

Manual reconciliation is exposed through authorized GraphQL operations:

- `reconcilePaymentCheckout(checkoutIntentId: ID!)`
- `reconcilePaymentRefund(refundId: ID!)`

Store order payments remain deferred. The Phase 2 payment infrastructure is shared where safe, but only subscription checkout is finalized by the Razorpay subscription payment flow.

## Store Checkout Notes

Payment Remediation Phase 3 moves store checkout to a trusted Razorpay flow. Normal users must use `createStoreCheckout` followed by `verifyStorePayment`; the legacy `placeOrder` mutation is retained only as a compatibility surface and rejects direct unpaid order placement.

Store checkout now creates:

- `store_checkout_intents` for trusted backend totals and provider references.
- `store_checkout_items` for immutable cart snapshots.
- `inventory_reservations` for reserved stock before payment capture.

The backend calculates product prices, quantities, currency, and totals from database records only. Inventory is reserved during checkout creation and permanently deducted only after provider-confirmed Razorpay capture. Store finalization creates the `StoreOrder`, `StoreOrderItem`, `Payment`, `Invoice`, and `FinancialTransaction` records idempotently.

Web checkout opens Razorpay using the backend-created order. Mobile store payment is blocked until a complete approved mobile Razorpay flow is implemented.

Store refunds use the Phase 2 `PaymentRefund` provider-confirmed lifecycle. Refunds update the linked store order payment status after Razorpay confirms refund processing. Money refunds and physical returns remain separate workflows; inventory is not automatically restocked by a refund alone.

---

## ⚠️ Security Warning: Rotate Credentials

> [!WARNING]
> If any secrets, API keys, passwords, database connection strings, or tokens were previously hardcoded in the source code files, those values remain visible in the repository's git commit history. 
> 
> **You must immediately rotate all previously hardcoded keys and credentials before deploying this application to production.**
