# LedgerLine Frontend Architecture

The frontend for LedgerLine is structured cleanly using **Embedded JavaScript (EJS)**, **Bootstrap 5**, and custom responsive CSS.

## Directory Structure

```
frontend/
├── views/
│   ├── layouts/
│   │   └── boilerplate.ejs       # Main HTML layout, CDN imports, scripts
│   ├── partials/
│   │   ├── navbar.ejs            # Role-aware navigation header
│   │   ├── footer.ejs            # Security & compliance footer
│   │   ├── flash.ejs             # Dismissible alert toasts (success/error)
│   │   └── sidebar.ejs           # Role-based dashboard sidebar navigation
│   ├── auth/
│   │   ├── login.ejs             # Sign-in page with demo credentials
│   │   └── register.ejs          # Registration with role selection
│   ├── admin/
│   │   ├── dashboard.ejs         # System liquidity & metrics overview
│   │   ├── users.ejs             # User status & role moderation
│   │   ├── accounts.ejs          # Account oversight, freeze/unfreeze
│   │   └── transactions.ejs      # Global transactions audit
│   ├── accountHolder/
│   │   ├── dashboard.ejs         # Personal accounts, balances & activity
│   │   ├── createAccount.ejs     # Open new savings/current/business accounts
│   │   ├── accountDetails.ejs    # Detailed portfolio metrics & actions
│   │   ├── deposit.ejs           # Deposit form + Razorpay checkout
│   │   ├── withdraw.ejs          # Withdrawal form with live balance preview
│   │   ├── transfer.ejs          # Internal account-to-account transfer
│   │   ├── transactions.ejs      # Paginated transaction history with filters
│   │   └── statement.ejs         # Immutable running ledger statement
│   ├── auditor/
│   │   ├── dashboard.ejs         # Audit overview & invariant checks
│   │   ├── accounts.ejs          # Read-only accounts view
│   │   └── ledger.ejs            # Full append-only master ledger
│   ├── errors/
│   │   ├── 403.ejs               # Access denied
│   │   ├── 404.ejs               # Page not found
│   │   └── 500.ejs               # Server error & rollback notification
│   └── home.ejs                  # Landing presentation page
└── public/
    ├── css/
    │   ├── style.css             # Brand styling, colors & custom buttons
    │   ├── dashboard.css         # Sidebar, metric cards & table enhancements
    │   └── responsive.css        # Mobile & tablet responsiveness
    └── js/
        ├── main.js               # Flash dismissal & UI utilities
        ├── account.js            # Account number clipboard helper
        └── transaction.js        # Idempotency lock, live balance calculation, Razorpay
```

## Security Best Practices
- Every HTML form automatically includes a CSRF token (`<input type="hidden" name="_csrf" value="<%= csrfToken %>">`).
- Double-click protection disables transaction submit buttons instantly upon click.
- Live balance preview computes remaining balance in real time on client side, but server-side atomic checks remain the final authority.
- Sensitive credentials and secret keys are never exposed in frontend templates.

