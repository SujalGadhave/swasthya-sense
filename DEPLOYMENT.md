# 🚀 Swasthya Sense — Production Deployment Guide

This guide covers how to deploy the Swasthya Sense Frontline Early-Warning Prototype to **Railway** (cloud hosting with managed MySQL) or using **Docker / Docker Compose**.

---

## ⚡ Option 1: 1-Click Railway Deployment (Recommended)

Railway provides instant cloud hosting with automatic GitHub syncing and managed MySQL database support.

### Step 1: Push Repository to GitHub
Ensure your repository is pushed to GitHub:
```bash
git push origin main
```

### Step 2: Create a Project in Railway
1. Go to [railway.app](https://railway.app) and log in with your GitHub account.
2. Click **"New Project"** in the top-right corner.
3. Select **"Deploy from GitHub repo"** and choose `swasthya-sense`.

### Step 3: Add Managed MySQL Database
1. Inside your new Railway project canvas, click **"+ Create"** or **"New"**.
2. Select **"Database"** $\to$ **"Add MySQL"**.
3. Railway will provision an enterprise MySQL 8 instance.

### Step 4: Link Web Service to Database
1. Click on the `swasthya-sense` web service card.
2. Go to the **"Variables"** tab.
3. Click **"New Variable"** $\to$ **"Add Reference"** (or add raw variable):
   - Variable name: `MYSQL_URL`
   - Value: Select `${{MySQL.MYSQL_URL}}` (or `${{MySQL.MYSQLPRIVATEURL}}` for high-speed private networking).
4. Add the following additional environment variables:
   - `JWT_SECRET`: `swasthya_production_secure_jwt_secret_2026`
   - `NODE_ENV`: `production`

### Step 5: Generate Live Public Domain
1. In the `swasthya-sense` service card, go to the **"Settings"** tab.
2. Under the **"Networking"** section, click **"Generate Domain"**.
3. Railway will generate a live HTTPS URL (e.g., `https://swasthya-sense-production.up.railway.app`).

### Step 6: Instant Zero-Touch Bootstrapping
When the service boots up:
- Swasthya Sense automatically detects the MySQL connection.
- Creates all 8 relational tables and constraints (`users`, `patients`, `check_ins`, `flags`, `escalations`, `schedules`, `audit_log`, `simulated_messages`).
- Detects the fresh database and **automatically seeds 65 synthetic clinical patients, 3 role personas, danger signs, rising BP trends, and cohort schedules**.
- Serves the high-performance Vite frontend and Express API on the same domain.

---

## 🐳 Option 2: Local or Server Docker Compose Deployment

If deploying to a VPS, DigitalOcean droplet, AWS EC2, or running on local Docker:

### 1-Command Startup:
```bash
docker compose up --build -d
```

### Accessing the App:
- Open your browser at: `http://localhost:4000`
- Both the React frontend and REST API are served on port `4000`.

---

## 🔐 Pre-Configured Demo Personas

The application comes pre-loaded with synthetic demo accounts:

| Role | Username | Password | Purpose |
|---|---|---|---|
| **Frontline ASHA Worker** | `worker1` | `Worker@123` | Morning follow-up call list, offline check-in submission, triage danger signs |
| **Medical Officer (Doctor)** | `dr_sharma` | `Doctor@123` | Clinical escalation queue, review vitals & trends, prescribe in-clinic actions |
| **Facility In-Charge (Supervisor)**| `admin_anita` | `Admin@123` | Protocol adherence, overdue tracking, immutable audit trail, simulated SMS dispatch |

---

## ⚙️ Environment Variables Reference

| Variable | Description | Default (Local) |
|---|---|---|
| `PORT` | HTTP port the server listens on | `4000` |
| `NODE_ENV` | Environment mode (`production` or `development`) | `development` |
| `MYSQL_URL` / `MYSQLPRIVATEURL` | Cloud MySQL connection URI (Railway / PlanetScale / RDS) | *None* |
| `DB_HOST` | Database hostname | `localhost` |
| `DB_PORT` | Database port | `3306` |
| `DB_USER` | Database username | `root` |
| `DB_PASSWORD` | Database password | `""` |
| `DB_NAME` | Database schema name | `swasthya_sense` |
| `JWT_SECRET` | Secret key for signing session tokens | `swasthya_jwt_dev_secret_key` |

---

## 🩺 System Disclaimer
> **IMPORTANT CLINICAL NOTICE:** Swasthya Sense is a prototype early-warning decision-support tool built for hackathon evaluation with synthetic data. It assists authorized health workers in prioritizing follow-ups and does not diagnose, prescribe, or provide medical advice.
