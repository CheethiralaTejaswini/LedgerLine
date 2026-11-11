# LedgerLine API Reference

All requests and responses use JSON or standard URL-encoded form submissions. Financial inputs accept standard INR numbers (e.g. `150.50`), and all internal storage and ledger balances are strictly processed as integer paise (e.g. `15050`).

---

## Headers & Security

| Header | Description | Required |
| :--- | :--- | :--- |
| `Content-Type` | `application/json` or `application/x-www-form-urlencoded` | Yes |
| `x-csrf-token` | Session CSRF token (for JSON state-changing requests) | Yes |
| `Accept` | `application/json` for API responses | Optional |

---

## 1. Authentication Endpoints

### Register User
- **Method:** `POST /auth/register`
- **Access:** Public (Rate-limited: 20 req / 15 min)
- **Request Body:**
  ```json
  {
    "username": "alice",
    "email": "alice@example.com",
    "fullName": "Alice Johnson",
    "phone": "+91 9876543210",
    "role": "ACCOUNT_HOLDER",
    "password": "Password@123",
    "confirmPassword": "Password@123",
    "_csrf": "<csrf-token>"
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "success": true,
    "message": "Registration successful",
    "user": {
      "id": "6724a1b...",
      "username": "alice",
      "email": "alice@example.com",
      "role": "ACCOUNT_HOLDER"
    }
  }
  ```

### Sign In
- **Method:** `POST /auth/login`
- **Access:** Public (Rate-limited: 20 req / 15 min)
- **Request Body:**
  ```json
  {
    "username": "alice",
    "password": "Password@123",
    "_csrf": "<csrf-token>"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Login successful",
    "user": { ... }
  }
  ```

### Sign Out
- **Method:** `POST /auth/logout`
- **Access:** Authenticated

---

## 2. Account Endpoints

### Open New Account
- **Method:** `POST /accounts`
- **Access:** `ACCOUNT_HOLDER`
- **Request Body:**
  ```json
  {
    "accountType": "SAVINGS",
    "initialDeposit": 1000.00,
    "_csrf": "<csrf-token>"
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "success": true,
    "account": {
      "accountNumber": "100435985324",
      "accountType": "SAVINGS",
      "balance": 100000,
      "status": "ACTIVE"
    }
  }
  ```

### View Account Statement
- **Method:** `GET /accounts/:id/statement`
- **Access:** Account Owner, Admin, Auditor
- **Query Parameters:** `page`, `startDate`, `endDate`

---

## 3. Financial Transaction Endpoints

### Deposit Funds
- **Method:** `POST /transactions/deposit`
- **Access:** `ACCOUNT_HOLDER` (Owner only)
- **Rate Limit:** 30 req / min
- **Request Body:**
  ```json
  {
    "accountId": "6724a1b...",
    "amount": 5000.00,
    "idempotencyKey": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "description": "Salary deposit",
    "_csrf": "<csrf-token>"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Successfully deposited ₹ 5,000.00 into account 100435985324.",
    "transactionReference": "TXN-20261107-A1B2C3D4",
    "newBalance": 500000,
    "formattedNewBalance": "₹ 5,000.00",
    "accountNumber": "100435985324"
  }
  ```

### Withdraw Funds
- **Method:** `POST /transactions/withdraw`
- **Access:** `ACCOUNT_HOLDER` (Owner only)
- **Rate Limit:** 30 req / min
- **Request Body:**
  ```json
  {
    "accountId": "6724a1b...",
    "amount": 1500.00,
    "idempotencyKey": "4c8f5e12-8874-4b51-b844-3c6753198081",
    "description": "ATM cash",
    "_csrf": "<csrf-token>"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Successfully withdrew ₹ 1,500.00 from account 100435985324.",
    "transactionReference": "TXN-20261107-B2C3D4E5",
    "newBalance": 350000,
    "formattedNewBalance": "₹ 3,500.00",
    "accountNumber": "100435985324"
  }
  ```
- **Error Response (400 Bad Request / 409 Conflict):**
  ```json
  {
    "success": false,
    "message": "Insufficient funds: Available balance is ₹ 500.00, requested ₹ 1,500.00."
  }
  ```

### Internal Account-to-Account Transfer
- **Method:** `POST /transactions/transfer`
- **Access:** `ACCOUNT_HOLDER` (Source account owner)
- **Rate Limit:** 30 req / min
- **Request Body:**
  ```json
  {
    "sourceAccountId": "6724a1b...",
    "destinationAccountNumber": "100161576800",
    "amount": 2500.00,
    "idempotencyKey": "a90df123-1122-3344-5566-778899aabbcc",
    "description": "Invoice #402 payment",
    "_csrf": "<csrf-token>"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Successfully transferred ₹ 2,500.00 to account 100161576800.",
    "transactionReference": "TXN-20261107-C3D4E5F6",
    "sourceNewBalance": 100000,
    "formattedSourceBalance": "₹ 1,000.00",
    "sourceAccountNumber": "100435985324",
    "destinationAccountNumber": "100161576800"
  }
  ```

---

## 4. Payment Gateway (Razorpay Module)

### Create Payment Order
- **Method:** `POST /payments/create-order`
- **Access:** `ACCOUNT_HOLDER`
- **Request Body:**
  ```json
  {
    "accountId": "6724a1b...",
    "amount": 1000.00,
    "idempotencyKey": "e4f5a6b7-..."
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "order": {
      "orderId": "order_mock_1731000000000_a1b2c3d4",
      "amount": 100000,
      "currency": "INR",
      "keyId": "rzp_test_placeholder",
      "isMock": true
    }
  }
  ```

### Verify and Capture Payment
- **Method:** `POST /payments/verify`
- **Access:** `ACCOUNT_HOLDER`
- **Request Body:**
  ```json
  {
    "razorpayOrderId": "order_...",
    "razorpayPaymentId": "pay_...",
    "razorpaySignature": "...",
    "idempotencyKey": "..."
  }
  ```

---

## 5. Auditor & Compliance Endpoints

- `GET /auditor/dashboard`: System liquidity overview & invariant status.
- `GET /auditor/accounts`: Read-only accounts list.
- `GET /auditor/ledger`: Master append-only ledger entries with filters (`type`, `status`, `startDate`, `endDate`).

---

## 6. Admin Endpoints

- `GET /admin/dashboard`: Administrative overview & refusal logs.
- `GET /admin/users`: User list.
- `POST /admin/users/:userId/status`: Update status (`ACTIVE`/`SUSPENDED`) and role.
- `GET /admin/accounts`: Global accounts list.
- `POST /admin/accounts/:accountId/status`: Update account state (`ACTIVE`/`FROZEN`/`CLOSED`).
- `GET /admin/transactions`: Global transactions audit log.

---

## 7. System Diagnostics & Health Probes

### System Health Probe
- **Method:** `GET /health`
- **Access:** Public (exempt from CSRF for uptime monitors and load balancer health checks)
- **Response (200 OK / 503 Service Unavailable):**
  ```json
  {
    "service": "LedgerLine Financial Core",
    "status": "UP",
    "timestamp": "2026-11-11T16:15:00.000Z",
    "uptimeSeconds": 14200,
    "responseTimeMs": 12,
    "database": {
      "connected": true,
      "state": "connected",
      "replicaSet": {
        "enabled": true,
        "setName": "atlas-zscbd5-shard-0",
        "isMaster": true,
        "hostsCount": 3
      }
    },
    "system": {
      "nodeVersion": "v22.17.0",
      "memory": {
        "rssMB": 72,
        "heapUsedMB": 38,
        "heapTotalMB": 54
      }
    }
  }
  ```

---

## 8. Append-Only Security Audit Trail

All security, compliance, and authorization events are committed to an immutable append-only collection (`auditlogs`):

- **Severity Levels:** `INFO`, `WARN`, `CRITICAL`
- **Tracked Actions:** `LOGIN_SUCCESS`, `LOGIN_FAILED`, `LOGOUT`, `USER_REGISTERED`, `ACCOUNT_STATUS_CHANGED`, `HIGH_VALUE_TRANSFER`, `RECONCILIATION_RUN`, `SECURITY_ALERT`
- **Immutability Contract:** Database-level Mongoose pre-hooks forbid `updateOne`, `deleteOne`, and document edits.


