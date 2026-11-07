# LedgerLine – Production Deployment Guide (Render + MongoDB Atlas)

This guide walks you through deploying **LedgerLine** live to the web using **Render** (free Web Service) and **MongoDB Atlas** (free cloud-hosted MongoDB replica set).

---

## Prerequisites
1. Your GitHub repository: [https://github.com/CheethiralaTejaswini/LedgerLine](https://github.com/CheethiralaTejaswini/LedgerLine)
2. A free account on [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
3. A free account on [Render](https://render.com) (sign up using your GitHub account)

---

## Step 1: Set Up MongoDB Atlas (Cloud Database with Replica Set)

MongoDB Atlas provides a free-tier M0 cluster that is configured as a replica set by default. This enables LedgerLine's multi-document ACID transactions out of the box.

1. **Sign in to MongoDB Atlas:**
   - Go to [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas) and sign in.
2. **Create a Free Cluster:**
   - Select **Deploy a database** -> Choose **M0 (Free)**.
   - Select any nearby provider and region (e.g. AWS / Mumbai or Frankfurt).
   - Click **Create Deployment**.
3. **Set Up Security & Credentials:**
   - **Database User**: Create a username (e.g., `ledgeradmin`) and a password (e.g., `MySecurePass2026!`). Note down the password.
   - **Network Access**: Click **Network Access** in the left menu -> **Add IP Address** -> Select **Allow Access from Anywhere** (`0.0.0.0/0`) -> Click **Confirm**. (This allows Render's cloud instances to connect).
4. **Copy the Connection String:**
   - In the **Database Deployments** tab, click **Connect**.
   - Select **Drivers** (Node.js).
   - Copy the connection URI string. It will look like:
     ```
     mongodb+srv://ledgeradmin:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
     ```
   - Replace `<password>` with your actual password, and add `/ledgerline` before the `?`:
     ```
     mongodb+srv://ledgeradmin:MySecurePass2026!@cluster0.xxxxx.mongodb.net/ledgerline?retryWrites=true&w=majority
     ```

---

## Step 2: Deploy to Render

1. **Sign in to Render:**
   - Go to [dashboard.render.com](https://dashboard.render.com/) and sign in with your GitHub account.
2. **Create a New Web Service:**
   - Click the **New +** button in the top navigation bar.
   - Select **Web Service**.
   - Choose **Build and deploy from a Git repository** -> Click **Next**.
   - Find and select your repository: **`CheethiralaTejaswini/LedgerLine`** (Click **Connect**).
3. **Configure the Service Settings:**
   - **Name**: `ledgerline` (or any custom name)
   - **Region**: Choose the region closest to you or your database (e.g. Singapore, Oregon, Frankfurt)
   - **Branch**: `main`
   - **Root Directory**: Leave blank (default root)
   - **Runtime**: `Node`
   - **Build Command**: `npm run build`
   - **Start Command**: `npm start`
   - **Instance Type**: Select **Free**
4. **Add Environment Variables:**
   Scroll down to the **Environment Variables** section and click **Add Environment Variable** for each:

   | Key | Value |
   | :--- | :--- |
   | `NODE_ENV` | `production` |
   | `MONGO_URL` | *Your MongoDB Atlas connection string from Step 1* |
   | `SESSION_SECRET` | *Any long random secret string (e.g., `ledgerline_prod_secret_998877`)* |
   | `CSRF_SECRET` | *Any long random string (e.g., `csrf_prod_secure_token_32chars`)* |

   *(Optional: If using Razorpay Test Mode, add `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`)*.

5. **Deploy:**
   - Click **Deploy Web Service** at the bottom of the page.
   - Render will automatically clone the repository, run `npm run build`, and launch the web server.
   - When the logs display `LedgerLine Financial Core Server Running`, your app is live!
   - Your live URL will appear at the top left of the dashboard: `https://ledgerline-xxxx.onrender.com`.

---

## Step 3: (Optional) Seed Initial Demo Users on Production

Once your service is live, you can populate the demo accounts (`admin`, `auditor`, `alice`, `bob`):

1. In your Render dashboard for `ledgerline`, click the **Shell** tab on the left menu.
2. In the terminal prompt, type:
   ```bash
   npm run seed
   ```
3. The script will connect to your MongoDB Atlas database and initialize:
   - Admin: `admin` / `Admin@12345`
   - Auditor: `auditor` / `Auditor@12345`
   - Alice: `alice` / `Alice@12345` (Savings A/C with ₹ 50,000.00)
   - Bob: `bob` / `Bob@12345` (Current A/C with ₹ 25,000.00)

---

## Step 4: Verify Deployment

1. Visit your live Render URL in your browser.
2. Sign in with `alice` / `Alice@12345`.
3. Perform a transfer, deposit, or withdrawal.
4. Download your account statement as CSV or check the auditor dashboard!

