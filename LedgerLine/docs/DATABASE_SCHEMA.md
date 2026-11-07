# LedgerLine – Database Architecture & Schema Reference

LedgerLine uses **MongoDB** with **Mongoose ODM** configured for financial integrity. All currency values are stored as 64-bit integer paise (1 INR = 100 paise) to prevent floating-point rounding errors.

---

## 1. User Collection (`users`)

Manages identities, role-based authorization, and authentication credentials powered by Passport.js and `passport-local-mongoose`.

| Field | Type | Attributes | Description |
| :--- | :--- | :--- | :--- |
| `_id` | ObjectId | Primary Key | Unique document identifier |
| `username` | String | Unique, Indexed, Trim, Lowercase | Unique handle for login |
| `email` | String | Unique, Indexed, Trim, Lowercase | Registered email address |
| `fullName` | String | Required, Trim | Legal name of user |
| `phone` | String | Optional, Trim | Contact telephone number |
| `role` | String | Enum: `['ADMIN', 'ACCOUNT_HOLDER', 'AUDITOR']` | Role-based authorization level |
| `status` | String | Enum: `['ACTIVE', 'SUSPENDED']`, Default: `ACTIVE` | Account moderation state |
| `hash` | String | Required | Salted password hash |
| `salt` | String | Required | Cryptographic salt |
| `failedLoginAttempts` | Number | Default: `0` | Brute-force tracking |
| `lastLoginAt` | Date | Optional | Timestamp of last successful session |
| `createdAt` / `updatedAt` | Date | Timestamps | Audit timestamps |

---

## 2. Account Collection (`accounts`)

Represents individual financial accounts owned by users. Enforces non-negative balance constraints.

| Field | Type | Attributes | Description |
| :--- | :--- | :--- | :--- |
| `_id` | ObjectId | Primary Key | Account document ID |
| `accountNumber` | String | Unique, Indexed (12 digits) | Bank-routed 12-digit account number (`100XXXXXXXXX`) |
| `userId` | ObjectId | Ref: `User`, Indexed, Required | Account owner |
| `accountType` | String | Enum: `['SAVINGS', 'CURRENT', 'BUSINESS']` | Portfolio classification |
| `balance` | Number | Integer, Minimum: `0`, Default: `0` | Current balance in **integer paise** |
| `currency` | String | Default: `'INR'` | ISO currency identifier |
| `status` | String | Enum: `['ACTIVE', 'FROZEN', 'CLOSED']` | Operational status of account |
| `createdAt` / `updatedAt` | Date | Timestamps | Creation and modification timestamps |

### Key Constraints:
- `balance: { min: 0 }`: Prevents negative balance at database validator level.
- Atomic balance modification: All balance mutations use `$inc` with `{ balance: { $gte: debitAmount } }`.

---

## 3. Transaction Collection (`transactions`)

High-level business transactions representing Deposits, Withdrawals, and Internal Transfers.

| Field | Type | Attributes | Description |
| :--- | :--- | :--- | :--- |
| `_id` | ObjectId | Primary Key | Transaction identifier |
| `transactionReference` | String | Unique, Indexed | Traceable reference (`TXN-YYYYMMDD-XXXXXXXX`) |
| `type` | String | Enum: `['DEPOSIT', 'WITHDRAWAL', 'TRANSFER']` | High-level transaction type |
| `status` | String | Enum: `['PENDING', 'SUCCESS', 'FAILED', 'REJECTED']` | Transaction lifecycle status |
| `sourceAccount` | ObjectId | Ref: `Account`, Nullable | Source account ID (null for deposits) |
| `destinationAccount` | ObjectId | Ref: `Account`, Nullable | Destination account ID (null for withdrawals) |
| `sourceAccountNumber` | String | Optional, Indexed | 12-digit source account string |
| `destinationAccountNumber` | String | Optional, Indexed | 12-digit destination account string |
| `amount` | Number | Integer, Minimum: `1` | Transaction amount in **integer paise** |
| `currency` | String | Default: `'INR'` | Currency denomination |
| `idempotencyKey` | String | Indexed | Client UUIDv4 key for duplicate protection |
| `initiatedBy` | ObjectId | Ref: `User`, Required | User who authorized the operation |
| `description` | String | Max: 255 chars | User remark or system note |
| `failureReason` | String | Optional | Error details if rejected or aborted |
| `metadata` | Mixed | Default: `{}` | IP address, User-Agent, gateway order IDs |
| `createdAt` / `updatedAt` | Date | Timestamps | Transaction timestamps |

---

## 4. LedgerEntry Collection (`ledgerentries`)

**Strictly append-only**, immutable double-entry ledger collection. Records every financial movement.

| Field | Type | Attributes | Description |
| :--- | :--- | :--- | :--- |
| `_id` | ObjectId | Primary Key | Ledger entry identifier |
| `entryReference` | String | Unique, Indexed | Entry reference (`ENT-YYYYMMDD-XXXXXXXX`) |
| `transactionId` | ObjectId | Ref: `Transaction`, Required | Parent transaction reference |
| `accountId` | ObjectId | Ref: `Account`, Required, Indexed | Impacted account ID |
| `accountNumber` | String | Required, Indexed | 12-digit account number |
| `transactionType` | String | Enum: `['DEPOSIT', 'WITHDRAWAL', 'TRANSFER_DEBIT', 'TRANSFER_CREDIT', 'REFUSED_ATTEMPT']` | Entry subtype |
| `debitAmount` | Number | Integer, Minimum: `0` | Deducted amount in paise (or 0) |
| `creditAmount` | Number | Integer, Minimum: `0` | Added amount in paise (or 0) |
| `balanceAfter` | Number | Integer, Minimum: `0`, Required | Resulting account balance in paise |
| `initiatedBy` | ObjectId | Ref: `User`, Required | Initiator user reference |
| `status` | String | Enum: `['POSTED', 'REFUSED', 'REJECTED']` | Ledger status |
| `description` | String | Required | Audit description |
| `metadata` | Mixed | Default: `{}` | Failure reasons, counterparty data |
| `timestamp` | Date | Default: `Date.now`, Indexed | Exact immutable timestamp of posting |

### Immutability Hooks:
The model implements Mongoose pre-hooks on `updateOne`, `updateMany`, `findOneAndUpdate`, `deleteOne`, `deleteMany`, `findOneAndDelete`, and `save` (when not isNew) to throw `IMMUTABILITY_VIOLATION` if modification is attempted.

---

## 5. IdempotencyRecord Collection (`idempotencyrecords`)

Guarantees exactly-once execution for all money movements.

| Field | Type | Attributes | Description |
| :--- | :--- | :--- | :--- |
| `_id` | ObjectId | Primary Key | Idempotency record ID |
| `key` | String | Unique, Indexed | UUIDv4 idempotency key |
| `userId` | ObjectId | Ref: `User`, Required | Originating user |
| `endpoint` | String | Required | Target API path (e.g., `/api/transactions/transfer`) |
| `requestHash` | String | Required | SHA-256 hash of endpoint + sorted payload |
| `status` | String | Enum: `['PENDING', 'COMPLETED', 'FAILED']` | In-flight status |
| `responseCode` | Number | Optional | Cached HTTP status code |
| `responseBody` | Mixed | Optional | Cached response payload returned on duplicate requests |
| `transactionReference` | String | Optional | Created transaction reference |
| `lockedAt` | Date | Default: `Date.now` | Lock acquisition time |
| `completedAt` | Date | Optional | Lock completion time |
| `expiresAt` | Date | TTL Index: 24 Hours | Automatic MongoDB document expiration |

---

## 6. Payment Collection (`payments`)

Stores Razorpay external payment gateway deposit sessions and signature verifications.

| Field | Type | Attributes | Description |
| :--- | :--- | :--- | :--- |
| `_id` | ObjectId | Primary Key | Payment document ID |
| `razorpayOrderId` | String | Unique, Indexed | Gateway order ID (`order_...`) |
| `razorpayPaymentId` | String | Indexed | Gateway payment ID (`pay_...`) |
| `razorpaySignature` | String | Optional | HMAC SHA-256 payment signature |
| `accountId` | ObjectId | Ref: `Account`, Required | Destination account |
| `userId` | ObjectId | Ref: `User`, Required | Depositor |
| `amount` | Number | Integer paise, Min: 100 | Amount in paise |
| `status` | String | Enum: `['CREATED', 'AUTHORIZED', 'CAPTURED', 'FAILED']` | Payment state |
| `transactionId` | ObjectId | Ref: `Transaction` | Linked ledger transaction |
| `idempotencyKey` | String | Optional | Duplicate credit guard |

