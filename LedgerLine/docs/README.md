# LedgerLine Technical Documentation

Welcome to the comprehensive technical documentation for **LedgerLine** – Secure Money Transfer and Ledger Management System.

---

## Architecture Overview

LedgerLine is structured with strict separation between Backend and Frontend layers following clean MVC principles:

```
Browser
   ↓
Frontend EJS Pages (Bootstrap 5)
   ↓
Express Routes (/auth, /accounts, /transactions, /admin, /auditor)
   ↓
Middleware (CSRF, Authentication, RBAC, Account Ownership, Rate Limiter)
   ↓
Controllers (HTTP orchestration & rendering)
   ↓
Services (Business logic, financial math, idempotency, atomic locks)
   ↓
Mongoose Models (Data schemas, immutability hooks, balance constraints)
   ↓
MongoDB Database (ACID Transactions & Atomic updates)
```

---

## Key Guarantees

1. **Money Conservation**: In all internal transfers, the source debit strictly equals the destination credit. Total balance across all accounts is constant.
2. **Integer Currency Arithmetic**: All values are processed and stored as 64-bit integer paise (1 INR = 100 paise). Zero floating-point rounding errors.
3. **Double-Spend & Overdraft Prevention**: Atomic conditional queries guarantee that two concurrent withdrawals cannot overdraw an account.
4. **Exactly-Once Idempotency**: Unique UUIDv4 idempotency keys prevent duplicate payments on retries and network drops.
5. **Append-Only Immutable Ledger**: Ledger records cannot be updated or deleted. Refused attempts are permanently logged for audit trails.
6. **Role-Based Authorization (RBAC)**: Enforces separation between Admin, Account Holder, and Auditor roles.

---

## Detailed Guides

- [Threat Model & Security Mitigations](THREATS.md)
- [Database Schema Reference](DATABASE_SCHEMA.md)
- [API Endpoints Documentation](API_DOCUMENTATION.md)
- [Development Prompts Log](PROMPTS.md)

