# LedgerLine – Threat Model & Financial Security Architecture

Financial applications face unique attack surfaces where bugs result directly in monetary loss or regulatory non-compliance. This document defines the threat model for LedgerLine and documents the architectural mitigations implemented.

---

## Threat Matrix

| Threat Code | Threat Category | Risk Level | Description | LedgerLine Architectural Mitigation |
| :--- | :--- | :--- | :--- | :--- |
| **THREAT-01** | Race Condition / Double-Spending | **CRITICAL** | An attacker issues parallel withdrawal/transfer requests at the same millisecond to spend a balance twice before it is decremented. | Atomic conditional query execution: `Account.findOneAndUpdate({ _id, balance: { $gte: amountPaise }, status: 'ACTIVE' }, { $inc: { balance: -amountPaise } })`. The database guarantees that only one transaction can claim the available balance. |
| **THREAT-02** | Money Creation / Conservation Failure | **CRITICAL** | During internal transfers, one account is credited while the other fails to debit, or amounts differ. | Atomic MongoDB multi-document sessions (`session.startTransaction()`). Strict assertion that `totalDebit === totalCredit`. If any operation fails, the entire transaction rolls back completely. |
| **THREAT-03** | Duplicate Payment Retries | **HIGH** | Network timeouts or user multi-clicks cause the client to retry an identical transaction, charging the user twice. | UUIDv4 request idempotency with `IdempotencyRecord`. Keys are locked with unique database constraints. In-flight duplicates are rejected with HTTP 409 Conflict; completed duplicates return original transaction responses without re-processing. |
| **THREAT-04** | Account Overdraft / Negative Balance | **HIGH** | Malformed requests or negative amounts bypass UI validation to create negative balances. | 1. Schema constraint: `balance: { min: [0, 'Account balance cannot be negative'] }`.<br>2. Currency helper: Integer paise validation ensuring `amount > 0`.<br>3. Server-side Joi validation rejecting non-positive numbers. |
| **THREAT-05** | Broken Object-Level Authorization (BOLA/IDOR) | **HIGH** | A logged-in user changes an `accountId` in a POST body to transfer money out of another customer's account. | Server-side `checkAccountOwnership` middleware verifies that `targetAccount.userId.toString() === req.user._id.toString()`. Admins have explicit oversight; normal users are blocked with HTTP 403 Forbidden. |
| **THREAT-06** | Audit Ledger Tampering | **CRITICAL** | A rogue insider or compromised account alters or deletes historical transaction records to hide embezzlement. | Append-only ledger architecture. Mongoose pre-hooks on `updateOne`, `updateMany`, `findOneAndUpdate`, `deleteOne`, `deleteMany`, and `save` raise `IMMUTABILITY_VIOLATION` errors if modification is attempted. Refused attempts are also permanently logged. |
| **THREAT-07** | Cross-Site Request Forgery (CSRF) | **HIGH** | A malicious site tricks an authenticated user's browser into submitting a transfer or withdrawal request. | Session-based CSRF protection middleware (`csrfProtection.js`). All state-changing methods (`POST`, `PUT`, `DELETE`) require a valid cryptographically random token matching `req.session.csrfToken`. |
| **THREAT-08** | Brute-Force & Credential Stuffing | **MEDIUM** | Automated bots guess credentials or flood transfer endpoints with rapid automated requests. | 1. `authLimiter`: 20 requests per 15 minutes.<br>2. `transactionLimiter`: 30 transactions per minute per IP.<br>3. `passport-local-mongoose` account locking after consecutive failed attempts. |
| **THREAT-09** | Payment Gateway Signature Spoofing | **HIGH** | An attacker creates a deposit request and posts fake payment IDs without actually sending money through Razorpay. | HMAC-SHA256 signature verification on server side using `crypto.createHmac('sha256', secret).update(order_id + "|" + payment_id).digest('hex')`. Credits are only applied after signature verification succeeds. |
| **THREAT-10** | Floating-Point Rounding Drift | **HIGH** | Standard JavaScript IEEE 754 floats (`0.1 + 0.2 === 0.30000000000000004`) lead to gradual fractional paise leakage. | All balances and amounts are strictly represented and calculated in **integer paise** (1 INR = 100 paise). Floating-point arithmetic is prohibited in business and accounting layers. |

---

## Detailed Threat Mitigations

### 1. Concurrency Safety: Atomic Balance Checks
In high-throughput distributed banking systems, a naive `find` followed by `save` creates a classic Time-of-Check to Time-of-Use (TOCTOU) race condition:
```
Thread A: Reads balance = ₹ 1,000
Thread B: Reads balance = ₹ 1,000
Thread A: Subtracts ₹ 800 -> Writes balance = ₹ 200
Thread B: Subtracts ₹ 800 -> Writes balance = -₹ 600 (OVERDRAWN!)
```

LedgerLine mitigates this via atomic conditional queries:
```javascript
const updatedAccount = await Account.findOneAndUpdate(
  {
    _id: accountId,
    balance: { $gte: amountPaise },
    status: 'ACTIVE'
  },
  { $inc: { balance: -amountPaise } },
  { session, new: true }
);
if (!updatedAccount) {
  // Throws insufficient funds / conflict error
  // Logs refused attempt in append-only ledger
}
```

Because MongoDB executes document-level write locks atomically, Thread A claims the balance and decrements it. When Thread B executes, the `{ balance: { $gte: 80000 } }` condition is no longer satisfied, and MongoDB returns `null`. Thread B fails safely without corrupting the balance.

### 2. Idempotency Lock Lifecycle
```
Client Request (with UUIDv4)
   │
   ├──> Look up IdempotencyRecord by key
   │      ├── Found & COMPLETED ──> Return cached response (No execution)
   │      ├── Found & PENDING   ──> Return HTTP 409 Conflict (In-flight lock)
   │      └── Not Found
   │            │
   │            └──> Atomically insert record with status: 'PENDING'
   │                   │
   │                   ├──> Execute Transaction & Ledger Entry
   │                   │
   │                   └──> Update record status to 'COMPLETED' with response body
```

### 3. Money Conservation Theorem
For any internal transfer $T$ between account $A$ and account $B$:
$$\Delta \text{Balance}(A) + \Delta \text{Balance}(B) = (-X) + (+X) = 0$$
$$\sum_{\text{all accounts}} \text{Balance}_{\text{after}} = \sum_{\text{all accounts}} \text{Balance}_{\text{before}}$$

The system tests this invariant explicitly in `transfer.test.js`, asserting that total system liquidity across all accounts remains identical before and after transfer execution.

