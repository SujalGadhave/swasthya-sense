# Swasthya Sense — स्वास्थ्य सेंस

> **Frontline Follow-up and Early-Warning Web Platform for High-Risk Patients**  
> *Track 1: Healthcare For Every Individual — Problem 2: Swasthya Sense (WhyCode4u Hackathon 2026)*

---

## ⚠️ Safety Boundary & Regulatory Disclaimer

> **PROTOTYPE FOR AUTHORIZED HEALTH WORKERS ONLY — NOT A DIAGNOSTIC TOOL**
>
> 1. **No Medical Diagnosis or Prescription:** This platform does not diagnose conditions, prescribe medications, or give treatment advice. Every safety alert is framed as **"Flagged for clinician review"**.
> 2. **Synthetic Data Policy:** All patient records, contact tokens, pseudonyms, measurements, and visit histories in this repository are **100% synthetic**. No real patient data exists anywhere in the codebase.
> 3. **Illustrative Rules:** All risk rules, physiological ranges, and danger signs are illustrative placeholders requiring local clinician approval and institutional protocol authorization before real-world clinical use.
> 4. **Simulated Messaging:** Patient SMS and WhatsApp reminders are recorded in an in-app simulated message log; no live telecommunications gateways are connected.

---

## 1. Problem & Core Workflow

Frontline community health workers (ASHAs/ANMs) manage dozens of high-risk patients across Antenatal Care (ANC), Hypertension (HTN), and Diabetes Mellitus (DM) cohorts. Due to fragmented records and limited time, routine follow-ups are easily missed, and subtle clinical deteriorations go unnoticed.

**Swasthya Sense answers three crucial questions every morning:**
1. **Who is overdue for follow-up?** (Administrative tracking with configurable grace periods)
2. **Who has reported something concerning?** (Transparent risk flags for elevated vitals, rising trends, or danger signs)
3. **Who needs clinician review?** (Seamless hand-off to Medical Officers with complete contextual evidence)

---

## 2. Quick Demo Access (1-Click Personas)

The platform provides 1-click persona switching for evaluators and judges:

| Role | Username | Password | Persona & Responsibility |
|---|---|---|---|
| **Health Worker** | `worker1` | `Worker@123` | **Sunita Devi (ASHA):** Today's prioritized call list, quick check-in entry, clinical alert escalation. |
| **Clinician** | `dr_sharma` | `Doctor@123` | **Dr. Rajesh Sharma (Medical Officer):** Escalation review queue, clinical guidance notes, case resolution. |
| **Supervisor** | `admin_anita` | `Admin@123` | **Anita Verma (PHC Facility In-Charge):** Cohort schedules configuration, append-only audit trail, message log. |

---

## 3. Technology Stack

- **Frontend:** React 18, Vite 5, React Router v6, Plain High-Contrast CSS (Zero bloated UI libraries; optimized for frontline tablets & phones).
- **Backend:** Node.js, Express (ES Modules), JSON Web Tokens (JWT), `bcryptjs`, `node-cron` background scheduler.
- **Database:** MySQL 8.0+ via `mysql2` (Connection pooling with transactional audit logging).
- **Rule Engine:** Transparent, declarative `rules.json` evaluated via pure function `evaluator.js`.
- **Testing:** Vitest automated test suite + Supertest HTTP integration testing.

---

## 4. Transparent Risk Rules Table (Illustrative)

All rule thresholds live exclusively in `server/src/rules/rules.json` and are evaluated by a pure function showing exact input values that triggered the alert:

| Rule ID | Category | Type | Trigger Condition | Worker-Facing Explanation |
|---|---|---|---|---|
| **R1** | Administrative | Reminder (Grey) | Visit due within reminder lead time | *"Visit due soon in N day(s). Scheduled for routine follow-up."* |
| **R2** | Administrative | Reminder (Grey) | Overdue beyond cohort grace period | *"Check-in overdue by N day(s) (exceeded grace period). Contact patient."* |
| **R3** | Administrative | Supervisor Review | Overdue >2x interval or 2 consecutive missed visits | *"Repeated missed follow-up; flagged for supervisor review & outreach."* |
| **R4** | Clinical | Alert (Red) | Blood pressure at/above cohort threshold (≥140/90) | *"BP 148/94 mmHg is at or above configured threshold. Flagged for clinician review."* |
| **R5** | Clinical | Alert (Red) | Strictly rising systolic BP across 3 consecutive visits | *"Systolic BP rose consistently across last 3 check-ins (128, 136, 145 mmHg). Flagged for clinician review."* |
| **R6** | Clinical | Alert (Red) | Cohort danger sign reported (e.g. visual disturbance in pregnancy) | *"Danger-sign symptom reported: 'severe headache visual changes'. Flagged for clinician review."* |
| **R7** | Data Quality | Review (Yellow) | Physiological value outside plausible range | *"Recorded value is outside plausible range. Possible data-entry error; flagged for re-check."* |
| **R8** | Clinical | Alert (Red) | Blood glucose out of cohort target bounds | *"Blood glucose fasting 165 mg/dL is outside target limit. Flagged for clinician review."* |

---

## 5. Deliberate Edge Cases Seeded

The deterministic seeder (`server/src/seed.js`) instantiates 65 synthetic patients across 3 cohorts, embedding the 5 edge cases mandated by the blueprint:
1. **Overdue Interval Variation:** Patient `pat-htn-01` (3d overdue, within grace), `pat-htn-02` (10d overdue, R2 triggered), `pat-htn-03` (35d overdue, R3 supervisor alert).
2. **Rising Systolic BP Trends:** Patient `pat-htn-04` (128 -> 136 -> 145 mmHg) and `pat-htn-05` (122 -> 130 -> 138 mmHg) triggering R5.
3. **Acute Danger Sign:** Antenatal patient `pat-anc-01` presenting with `severe_headache_visual_changes` triggering R6.
4. **Consent Control & Suppression:** Patient `pat-db-01` has declined consent (`consent_status = 'declined'`); automated SMS reminders are strictly suppressed with audit entry `SIMULATED_MESSAGE_SUPPRESSED_NO_CONSENT`.
5. **Pre-Escalated & Reviewed Case:** Patient `pat-htn-06` with BP 162/104, escalated to `dr_sharma`, with clinical advice recorded.

---

## 6. Setup & Running Instructions

### Prerequisites
- Node.js ≥ 20 (Node 23.x verified)
- MySQL Server 8.0+ running locally (default port 3306)

### Installation
```bash
# 1. Clone repository
git clone <repo-url>
cd SwasthyaSense

# 2. Install dependencies across root, server, and client
npm install
npm install --prefix server
npm install --prefix client

# 3. Configure MySQL credentials
cp server/.env.example server/.env
# Open server/.env and verify DB_PASSWORD (e.g. Sujal@123), DB_USER, DB_NAME
```

### Seeding & Running
```bash
# Seed deterministic synthetic demo data
npm run seed

# Run automated test suites (23 tests covering rules, auth, & API workflows)
npm test

# Run API backend and React frontend concurrently
npm run dev
```

- **Client Application:** http://localhost:5173  
- **API Health Check:** http://localhost:5173/api/health (proxied to port 4000)

---

## 7. Submission Checklist & Project Artifacts

- [x] **Working Prototype:** Fully functional React + Express + MySQL application.
- [x] **Zero Diagnostic Wording:** Strictly uses *"Flagged for clinician review"*.
- [x] **Append-Only Audit Trail:** Every view, check-in, rule trigger, and consent update logged.
- [x] **Unit & Integration Tests:** 23 tests passing with Vitest (`tests/evaluator.test.js`, `tests/auth.test.js`, `tests/api.test.js`).
- [x] **Clean Clone Setup:** Verified clean build with `npm run build` and deterministic seeder.
