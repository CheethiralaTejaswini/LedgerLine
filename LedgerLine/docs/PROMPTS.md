# Development Prompts & AI Engineering Log

This log documents the iterative engineering prompts, generated architectural results, real bugs/mistakes identified during implementation, and the corrections applied to build **LedgerLine**.

---

### Entry 1: Architecture Inception & Directory Scaffolding
- **Date:** 2026-11-07
- **AI Prompt:**
  > "Design the clean backend and frontend folder structure for LedgerLine separating models, services, controllers, middlewares, routes, views, public assets, and docs. Initialize the project with necessary dependencies."
- **Generated Result:**
  Initial directory layout and root package configurations.
- **Mistakes / Issues Identified:**
  1. On Windows PowerShell, running raw `npm` failed because PowerShell script execution policies blocked `npm.ps1`.
  2. A nested subshell loop in PowerShell failed because unescaped `$d` variables were evaluated before execution.
- **Corrections Made:**
  1. Switched CLI invocations on Windows to direct `cmd /c "npm ..."` or `.cmd` wrappers.
  2. Used PowerShell `New-Item -ItemType Directory -Force -Path ...` with direct comma-separated array literals, ensuring clean cross-platform directory creation.

---

### Entry 2: Financial Integrity Core & Concurrency Safe Services
- **Date:** 2026-11-07
- **AI Prompt:**
  > "Implement the TransactionService and LedgerService supporting Deposits, Withdrawals, and Internal Transfers. Enforce integer paise calculations, atomic session transactions, append-only immutable ledger records, and race condition prevention."
- **Generated Result:**
  `transactionService.js` and `ledgerService.js` implementing atomic MongoDB operations and paise conversions.
- **Mistakes / Issues Identified:**
  1. Relying exclusively on MongoDB replica set transactions would crash standard standalone local dev environments where replica sets are not configured.
  2. Naive withdrawal balance checks (`if (account.balance < amount)`) without conditional update clauses would allow two simultaneous requests to overdraw the account.
- **Corrections Made:**
  1. Implemented replica set detection (`hasReplicaSet()`) with dynamic multi-document session support when available, and atomic fallback with optimistic balance locks in standalone mode.
  2. Added `{ balance: { $gte: amountPaise }, status: 'ACTIVE' }` atomic conditional updates in `findOneAndUpdate` to eliminate Time-of-Check to Time-of-Use (TOCTOU) race conditions.

---

### Entry 3: Idempotency Engine & Request Locking
- **Date:** 2026-11-07
- **AI Prompt:**
  > "Implement an IdempotencyService with UUIDv4 tracking to prevent duplicate transactions, handle concurrent in-flight requests safely, and return cached responses on retries."
- **Generated Result:**
  `idempotencyService.js` and `IdempotencyRecord` Mongoose schema with SHA-256 payload hashing and TTL auto-expiration.
- **Mistakes / Issues Identified:**
  1. If a client retried a request with an identical idempotency key but changed the amount or destination, returning the original response would silently mask an invalid replay attack.
  2. If a second request arrived while the first was still processing in-flight, a basic find-then-update lock would suffer from duplicate processing.
- **Corrections Made:**
  1. Added deterministic SHA-256 request hashing (`endpoint + sortedPayload`). If a key is reused with mismatched parameters, an explicit HTTP 422 Unprocessable Entity error is returned.
  2. Leveraged MongoDB's unique key constraint on `key: { unique: true }`. Attempting to acquire an existing `PENDING` key triggers a duplicate key error (code 11000) that immediately returns an HTTP 409 Conflict ("In-flight request currently processing").

---

### Entry 4: Mongoose Schemas & Immutability Enforcement
- **Date:** 2026-11-07
- **AI Prompt:**
  > "Build the Mongoose models: User, Account, Transaction, LedgerEntry, IdempotencyRecord, and Payment (Razorpay). Ensure append-only protection for ledger entries and non-negative constraints for balances."
- **Generated Result:**
  Complete Mongoose schemas with indexes, enums, and validators.
- **Mistakes / Issues Identified:**
  1. Defining `unique: true` on fields while also calling `schema.index({ field: 1 })` caused Mongoose to issue runtime warnings: `[MONGOOSE] Warning: Duplicate schema index on {"email":1} found`.
  2. Standard Mongoose documents could still be edited by developers via `updateOne` or `findOneAndUpdate`.
- **Corrections Made:**
  1. Cleaned up duplicate index definitions in `User.js` to eliminate Mongoose schema warnings.
  2. Added pre-hooks on `updateOne`, `updateMany`, `findOneAndUpdate`, `deleteOne`, `deleteMany`, `findOneAndDelete`, and `save` (for existing documents) that throw an explicit `IMMUTABILITY_VIOLATION` error, enforcing an append-only invariant at the ORM layer.

---

### Entry 5: Automated Testing & Test Isolation
- **Date:** 2026-11-07
- **AI Prompt:**
  > "Write comprehensive automated tests in Node.js verifying money conservation, insufficient balance rejection, concurrent withdrawal safety, idempotency retries, account ownership, role authorization, rollback on failure, and ledger immutability."
- **Generated Result:**
  8 test suites covering 24 tests across all financial requirements.
- **Mistakes / Issues Identified:**
  1. When running `node --test backend/tests/*.test.js`, Node 22 ran test suites in parallel processes against the same shared database (`ledgerline_test`). Each suite's `clearTestDB()` hook erased data while other tests were executing, causing 4 tests to fail intermittently.
- **Corrections Made:**
  1. Configured `--test-concurrency=1` in `package.json` scripts (`"test": "node --test --test-concurrency=1 backend/tests/*.test.js"`).
  2. With sequential isolation, all 8 test suites passed with 100% success (24/24 passed), proving concurrent test cases within `concurrency.test.js` executed reliably without cross-file interference.

---

### Entry 6: Cryptographic Reconciliation, Dynamic Recipient Verification & CSV Statements
- **Date:** 2026-11-07
- **AI Prompt:**
  > "Add mathematical reconciliation services that aggregate ledger credits and debits to prove account balances, provide a live interactive recipient lookup on the transfer page, add CSV statement export, and expand automated tests."
- **Generated Result:**
  - Added `reconcileAccount(accountId)` and `reconcileSystem()` in `ledgerService.js`.
  - Added `/accounts/lookup?accountNumber=...` endpoint and interactive debounced AJAX lookup badge in `transaction.js`.
  - Added `/accounts/:id/statement/export` endpoint generating streaming CSV statements.
  - Added 9th test suite `tests/reconciliation.test.js`.
- **Mistakes / Issues Identified:**
  1. Transfer form recipient input could be mistyped, causing money to be sent to unintended accounts if numbers were valid.
  2. Account statement was only printable via CSS without structured data export.
- **Corrections Made:**
  1. Implemented real-time recipient verification displaying the recipient's verified name and account classification before execution.
  2. Implemented CSV statement export and added mathematical reconciliation tests verifying that `account.balance === sum(credits) - sum(debits)` with zero discrepancy across all portfolios (27/27 tests passing).

