# LedgerLine – Secure Money Transfer and Ledger Management System

[![Node.js](https://img.shields.io/badge/Node.js-v22+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-v4.21-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-v8.0+-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)

**LedgerLine** is an enterprise-grade financial transaction management and ledger auditing system built with Node.js, Express.js, MongoDB, Mongoose, and EJS. Designed specifically for financial integrity and concurrency safety, LedgerLine guarantees money conservation, strict idempotency, race condition prevention, and immutable audit trails.

---

## 1. System Features & Guarantees

- **Mathematical Money Conservation**: Internal transfers enforce that the debit on the source account strictly equals the credit on the destination account ($A_{\text{debit}} = B_{\text{credit}}$). System-wide total balances remain invariant.
- **Integer Paise Representation**: All balances, amounts, debits, and credits are strictly computed and stored as integer paise (1 INR = 100 paise), avoiding IEEE 754 floating-point drift.
- **Race Condition & Overdraft Protection**: Concurrent withdrawals targeting the same available balance are guarded using atomic conditional database queries (`{ balance: { $gte: amountPaise } }`). Account balances can never drop below zero.
- **UUIDv4 Request Idempotency**: Financial mutations require an idempotency key. Network retries or rapid re-clicks return the original response without duplicate charges. In-flight duplicates are safely rejected with HTTP 409 Conflict.
- **Append-Only Immutable Ledger**: Financial movements are recorded into a tamper-evident ledger collection where updates and deletions are strictly blocked via Mongoose model hooks. Refused transaction attempts are permanently recorded for audit analysis.
- **Three-Tier Role-Based Authorization (RBAC)**:
  - **Admin**: Full oversight over users, accounts, status moderation (freeze/unfreeze), and security audit logs.
  - **Account Holder**: Portfolio dashboard, account opening, deposits, withdrawals, transfers, and statements.
  - **Auditor**: Independent, read-only verification of accounts, transaction records, and the immutable ledger.
- **Optional Razorpay Gateway Integration**: Decoupled payment gateway module for simulated or production deposits with HMAC-SHA256 signature verification.
- **Bank-Grade Security**: CSRF protection on all mutating requests, brute-force rate limiters, session persistence with `connect-mongo`, password hashing via `passport-local-mongoose`, and server-side Joi schema validation.

---

## 2. Project Directory Structure

LedgerLine strictly separates backend and frontend layers:

```
LedgerLine/
│
├── backend/
│   ├── config/
│   │   ├── db.js                     # MongoDB connection & replica set detector
│   │   ├── passport.js               # Passport Local strategy & session serialization
│   │   ├── session.js                # Express-session & Connect-Mongo store
│   │   └── seed.js                   # Database seeder with demo accounts
│   │
│   ├── controllers/
│   │   ├── authController.js         # User registration, sign-in & sign-out
│   │   ├── userController.js         # Role-based dashboard router
│   │   ├── accountController.js      # Account opening, details & statements
│   │   ├── transactionController.js  # Deposits, withdrawals & transfers
│   │   ├── ledgerController.js       # Auditor dashboards & master ledger
│   │   ├── adminController.js        # User & account management, refusal logs
│   │   └── paymentController.js      # Razorpay payment orders & verification
│   │
│   ├── middleware/
│   │   ├── isAuthenticated.js        # Session authentication verification
│   │   ├── authorizeRole.js          # Role-based access control (RBAC)
│   │   ├── checkAccountOwnership.js  # Account ownership authorization
│   │   ├── csrfProtection.js         # Session-based CSRF protection
│   │   ├── errorHandler.js           # Centralized error handler & 404 handler
│   │   ├── rateLimiter.js            # Rate limiters for auth & financial routes
│   │   └── validateRequest.js        # Generic Joi request validator
│   │
│   ├── models/
│   │   ├── User.js                   # User credentials, roles & statuses
│   │   ├── Account.js                # Financial accounts with balance constraints
│   │   ├── Transaction.js            # Traceable transaction lifecycle records
│   │   ├── LedgerEntry.js            # Append-only immutable double-entry ledger
│   │   ├── IdempotencyRecord.js      # Idempotency lock records with TTL
│   │   └── Payment.js                # Razorpay payment gateway audit records
│   │
│   ├── routes/
│   │   ├── authRoutes.js             # /auth endpoints
│   │   ├── userRoutes.js             # /dashboard gateway
│   │   ├── accountRoutes.js          # /accounts endpoints
│   │   ├── transactionRoutes.js      # /transactions endpoints
│   │   ├── ledgerRoutes.js           # /auditor endpoints
│   │   ├── adminRoutes.js            # /admin endpoints
│   │   └── paymentRoutes.js          # /payments endpoints
│   │
│   ├── services/
│   │   ├── accountService.js         # Account creation, lookups & summaries
│   │   ├── transactionService.js     # Atomic deposits, withdrawals & transfers
│   │   ├── ledgerService.js          # Append-only recording & audit queries
│   │   ├── idempotencyService.js     # Locking, SHA-256 hash checks & responses
│   │   └── paymentService.js         # Razorpay orders & HMAC signature check
│   │
│   ├── utils/
│   │   ├── apiResponse.js            # Standardized API response formatters
│   │   ├── currencyHelper.js         # Integer paise conversions & formatting
│   │   ├── generateAccountNumber.js  # Cryptographic 12-digit account numbers
│   │   └── generateIdempotencyKey.js # UUIDv4 generator
│   │
│   ├── validators/
│   │   ├── authValidator.js          # Registration & login validation
│   │   ├── accountValidator.js       # Account creation validation
│   │   └── transactionValidator.js   # Financial operations validation
│   │
│   ├── tests/
│   │   ├── testHelper.js             # Test database setup & teardown
│   │   ├── auth.test.js              # Authentication test suite
│   │   ├── account.test.js           # Account schema & balance constraints
│   │   ├── deposit.test.js           # Deposit atomicity tests
│   │   ├── withdrawal.test.js        # Balance debits & overdraft rejection
│   │   ├── transfer.test.js          # Money conservation & complete rollback
│   │   ├── concurrency.test.js       # Parallel withdrawal race condition tests
│   │   ├── idempotency.test.js       # Duplicate request rejection tests
│   │   └── authorization.test.js     # Ownership, RBAC & ledger immutability
│   │
│   ├── app.js                        # Express application configuration
│   ├── server.js                     # HTTP server startup & graceful shutdown
│   ├── package.json                  # Backend package manifest
│   └── .env.example                  # Environment template
│
├── frontend/
│   ├── views/
│   │   ├── layouts/boilerplate.ejs   # Base layout with Bootstrap 5
│   │   ├── partials/navbar.ejs       # Role-aware navigation bar
│   │   ├── partials/footer.ejs       # Security & compliance footer
│   │   ├── partials/flash.ejs        # Dismissible notification banners
│   │   ├── partials/sidebar.ejs      # Responsive dashboard navigation
│   │   ├── auth/login.ejs            # Sign-in page
│   │   ├── auth/register.ejs         # User registration page
│   │   ├── admin/dashboard.ejs       # Admin control center
│   │   ├── admin/users.ejs           # User status & role moderation
│   │   ├── admin/accounts.ejs        # Account oversight & freezing
│   │   ├── admin/transactions.ejs    # Global transactions audit
│   │   ├── accountHolder/dashboard.ejs      # Portfolio overview
│   │   ├── accountHolder/createAccount.ejs  # Open new account
│   │   ├── accountHolder/accountDetails.ejs # Individual account metrics
│   │   ├── accountHolder/deposit.ejs        # Deposit & Razorpay form
│   │   ├── accountHolder/withdraw.ejs       # Withdrawal with live balance
│   │   ├── accountHolder/transfer.ejs       # Internal transfer form
│   │   ├── accountHolder/transactions.ejs   # Filterable transaction history
│   │   ├── accountHolder/statement.ejs      # Printable ledger statement
│   │   ├── auditor/dashboard.ejs     # Compliance & invariant review
│   │   ├── auditor/accounts.ejs      # Read-only accounts view
│   │   ├── auditor/ledger.ejs        # Master append-only ledger
│   │   ├── errors/403.ejs            # Access denied view
│   │   ├── errors/404.ejs            # Not found view
│   │   ├── errors/500.ejs            # Server error & rollback view
│   │   └── home.ejs                  # Landing page
│   │
│   └── public/
│       ├── css/                      # style.css, dashboard.css, responsive.css
│       ├── js/                       # main.js, account.js, transaction.js
│       └── images/                   # Static media assets
│
├── docs/
│   ├── README.md                     # Technical architecture documentation
│   ├── THREATS.md                    # Threat model & security mitigations
│   ├── PROMPTS.md                    # Development prompts log & AI history
│   ├── API_DOCUMENTATION.md          # REST API endpoints reference
│   └── DATABASE_SCHEMA.md            # Comprehensive database schema guide
│
├── .gitignore
└── package.json
```

---

## 3. Getting Started & Installation

### Prerequisites
- **Node.js**: v20 or higher (v22+ recommended)
- **MongoDB**: Community or Enterprise Server v6.0+ (running locally on port 27017 or remote cluster)

### Installation Steps

1. **Clone or Navigate to the Project:**
   ```bash
   cd LedgerLine
   ```

2. **Install Dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Copy the example environment configuration:
   ```bash
   cp backend/.env.example backend/.env
   ```
   Inspect `backend/.env` and update parameters as needed:
   ```env
   PORT=3000
   NODE_ENV=development
   MONGO_URL=mongodb://127.0.0.1:27017/ledgerline
   SESSION_SECRET=ledgerline_super_secure_session_secret_change_in_production
   RAZORPAY_KEY_ID=rzp_test_placeholder
   RAZORPAY_KEY_SECRET=placeholder_secret
   ```

4. **Seed Sample Demo Data:**
   Run the database seed script to populate sample accounts, users, and transactions:
   ```bash
   npm run seed
   ```

5. **Start the Application:**
   ```bash
   npm start
   ```
   Open your browser and navigate to: `http://localhost:3000`

---

## 4. Default Demo Accounts

The seed script creates ready-to-test accounts across all three security roles:

| Role | Username | Password | Notes / Seeded Portfolio |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin` | `Admin@12345` | Global oversight, freeze accounts, view security logs |
| **Auditor** | `auditor` | `Auditor@12345` | Read-only compliance review, append-only ledger audit |
| **Account Holder** | `alice` | `Alice@12345` | Savings A/C `100435985324` with ₹ 50,000.00 initial balance |
| **Account Holder** | `bob` | `Bob@12345` | Current A/C `100161576800` with ₹ 25,000.00 initial balance |

---

## 5. MongoDB Replica Set Configuration (ACID Transactions)

LedgerLine detects automatically whether your MongoDB instance is running as a single standalone node or a replica set. While standalone mode provides atomic updates and optimistic balance locks, multi-document ACID transactions (`session.startTransaction()`) require a MongoDB replica set.

### How to Enable a Local Single-Node Replica Set:

1. **Start MongoDB with the Replica Set parameter:**
   ```bash
   mongod --replSet rs0 --dbpath "C:\data\db"
   ```

2. **In a Mongo shell (`mongosh`), initiate the replica set:**
   ```javascript
   rs.initiate()
   ```

3. **Update `MONGO_URL` in `backend/.env`:**
   ```env
   MONGO_URL=mongodb://127.0.0.1:27017/ledgerline?replicaSet=rs0
   ```

When LedgerLine starts, it will log:
```
[LedgerLine DB] Replica set detected: rs0. Multi-document ACID transactions enabled.
```

---

## 6. Running the Automated Test Suite

LedgerLine includes **24 automated tests** across **8 test suites** testing financial integrity, concurrency, and security invariants:

```bash
npm test
```

### Verified Test Assertions:
1. **Money Conservation**: Source debit strictly equals destination credit; total system balance is unchanged.
2. **Insufficient Balance Rejection**: Withdrawals and transfers exceeding liquid funds are rejected and logged in the append-only ledger.
3. **Concurrency Protection**: Parallel simultaneous withdrawals are dispatched at the same millisecond; atomic database write locks ensure exactly one succeeds and the other is rejected, guaranteeing balances never drop below zero.
4. **Idempotency Protection**: Repeated transfer submissions with identical keys do not execute duplicate debits or credits.
5. **Account Ownership**: Non-admin users cannot read or execute transactions on accounts owned by other users.
6. **Role Authorization**: Non-privileged roles are strictly prevented from performing restricted administrative or audit tasks.
7. **Complete Rollback**: Failed multi-step operations roll back completely without leaving partial balance deductions.
8. **Append-Only Immutability**: `updateOne`, `findOneAndUpdate`, `deleteOne`, and `deleteMany` operations on ledger records are blocked by Mongoose hooks.

