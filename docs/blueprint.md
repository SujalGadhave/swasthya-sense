# Swasthya Sense — Blueprint

> Hackathon execution blueprint for a follow-up and early-warning tool for authorized health workers.  
> **Safety boundary:** This is a prototype, not a diagnostic tool. All patient data is synthetic. Risk rules are illustrative and require clinician approval. Reminders are simulated and are not sent through real SMS/WhatsApp gateways.

## 1. Problem and scope

Build a follow-up and early-warning web app that answers three questions each morning:

1. Who is overdue for follow-up?
2. Who has reported something concerning?
3. Who needs clinician review?

Patients with chronic conditions, pregnancy risks, or post-illness complications can miss follow-ups. Frontline workers have limited time and fragmented records. The app should be fast, simple, and tolerant of poor connectivity.

### Target users and access

- **Community health worker (ASHA/ANM-type):** Today's call list, quick check-in entry, and a clear reason for each flag. Can access assigned patients only.
- **Clinician / medical officer:** Review escalated cases and their supporting evidence.
- **Supervisor / admin:** Aggregate overdue counts, escalation status, audit logs, and follow-up rule configuration. Clinical details are hidden by default.
- **Patient:** Simulated SMS/WhatsApp reminders only; no real messages are sent.

### Assumptions

- All patient data is synthetic. No real patient data is used.
- Risk rules are illustrative and need clinician approval before real use.
- Reminders are simulated in an in-app message log.
- Demo cohort: antenatal care plus hypertension/diabetes follow-up.

### Out of scope

- Diagnosis, prescribing, or treatment advice.
- Real patient data, real messaging, or real EHR integration.
- Machine-learning risk scoring. Rules must be transparent and explainable.

## 2. Product workflow

The core loop is:

1. Schedule a check-in.
2. Record the check-in.
3. Evaluate it against transparent rules.
4. Create a flag with the reason and triggering values.
5. Route clinical alerts to a clinician.
6. Track review and outcome.
7. Record every relevant action in the audit log.

## 3. Must-have features

1. **Synthetic patient registry:** 60–100 generated patients across three cohorts, including consent status.
2. **Configurable follow-up schedules:** Admin configures visit interval, grace period, and reminder lead time for each cohort.
3. **Health-worker dashboard:** Today's prioritized call list with overdue, concerning, and clinician-review views.
4. **Transparent risk flags:** Show rule ID, triggering values, and prototype label for each flag.
5. **Reminder/alert separation:** Grey administrative reminders and red clinical alerts.
6. **Simulated SMS/WhatsApp reminders:** In-app message log with template, language, send time, and delivery status; no actual gateway.
7. **Escalation/referral tracking:** `Flagged → Sent to clinician → Reviewed → Action taken → Closed`.
8. **Audit trail:** Record who viewed, edited, flagged, or escalated what and when.
9. **Role-based access and consent:** Workers see only assigned patients; no consent means no reminders.

### 24-hour MVP priorities

Implement features 1, 2, 3, 4, 5, 7, and 8 end-to-end. Implement feature 6 as a simulated message-log table. Implement feature 9 minimally with three demo roles, route checks, and a patient consent flag. Offline sync and bilingual labels are future scope.

## 4. Architecture and technology stack

Use a three-tier React and Node.js application with a separate rule-engine module.

### Stack

- **Frontend:** React, Vite, React Router, `react-i18next`.
- **Backend:** Node.js, Express, JWT login, role-check middleware.
- **Database:** SQLite for the sprint; PostgreSQL can be considered later. Seed demo data on startup.
- **Scheduler:** `node-cron` daily overdue-check job.
- **Rule engine:** Readable JSON rule files and a pure evaluation function with unit tests.
- **Messaging:** Simulated message table and log screen only.
- **Hosting:** Free-tier frontend host plus API/database host; choose services the team can deploy quickly.
- **Optional future offline support:** Service worker and IndexedDB queue, only after the core workflow works.

### Architecture flow

- Health worker → worker screens (call list/check-in) → Express API.
- Clinician → clinician queue (review/note/close) → Express API.
- Supervisor → supervisor screens (overdue/rules/audit) → Express API.
- Express API performs JWT authentication, role checks, audit logging, and calls the rule engine.
- Rule engine evaluates versioned JSON rules.
- Database stores patients, schedules, check-ins, flags, escalations, and audit logs.
- Scheduler runs daily overdue checks.
- Simulated messaging writes to the message log; it does not send real messages.

Every role uses the same API. Both reminder and clinical flags come from the rule engine, but only clinical alerts can be escalated.

## 5. Data model

Use six core entities/tables.

### Patient
- `id`
- `pseudonym` (or synthetic first name)
- `age_band`
- `village_or_ward`
- `cohort`
- `assigned_worker_id`
- `consent_status`
- `consent_updated_at`

**Minimization:** Do not store phone numbers, addresses, or national IDs. Use a synthetic contact token.

### Schedule
- `cohort`
- `interval_days`
- `grace_period_days`
- `reminder_lead_time_days`
- `version`

Admin-configurable and versioned.

### CheckIn
- `patient_id`
- `due_date`
- `completed_at`
- `channel`
- `symptoms` (checklist)
- `measurements` (only those needed by cohort rules: BP, weight, glucose, temperature)
- `notes`

### Flag
- `check_in_id`
- `type` (`reminder` or `clinical`)
- `rule_id`
- `triggering_values`
- `severity`
- `status`
- `rule_version`
- `created_at`

Store the explanation, not just a score.

### Escalation
- `flag_id`
- `from_worker_id`
- `to_clinician_id`
- `status`
- `clinician_note`
- `outcome`
- `created_at`
- `updated_at`

One row per hand-off.

### AuditLog
- `user_id`
- `role`
- `action`
- `entity_type`
- `entity_id`
- `timestamp`

Append-only: no edits or deletes.

## 6. Roles and permissions

- **Health worker:** View/update assigned patients, record check-ins, and escalate clinical alerts. Cannot view other workers' patients or edit rules.
- **Clinician:** View escalated cases, add review notes, close or return cases. Cannot edit schedules or view non-escalated patients.
- **Supervisor:** View aggregates, overdue counts, and audit log; edit schedules. Clinical notes are hidden by default.

### Consent behavior

- No consent means no reminders.
- A patient without consent has only a minimal registry record.
- Include a consent toggle on the patient profile.
- Record every consent change in the audit log.

## 7. Synthetic demo data

Create a deterministic seed script (for example, using Faker) so each demo run is reproducible. Seed 60–100 synthetic patients across three cohorts and include these deliberate edge cases:

- Three patients overdue by different amounts.
- Two patients with rising blood-pressure trends.
- One patient with a danger-sign symptom.
- One patient without consent.
- One case already escalated and reviewed.

State in the README that no real patient data exists anywhere in the project.

## 8. Transparent risk-flag rule engine

Store rules in readable JSON and evaluate them in a plain Node.js function. Every flag must show the matching rule and triggering values.

**Required UI/README label:** `Illustrative, requires clinician approval`

### Illustrative rules

| Rule | Type | Condition | Example worker-facing explanation |
|---|---|---|---|
| R1 | Reminder | Check-in due in 2 days | “Visit due soon” |
| R2 | Reminder | Check-in overdue beyond the grace period | “Overdue by N days” |
| R3 | Reminder / supervisor review | Overdue by more than 2× the interval, or 2 consecutive missed follow-ups | “Repeated missed follow-up; supervisor review” |
| R4 | Clinical | Blood pressure at/above the configured threshold | “BP 150/100 is above the configured limit of 140/90” |
| R5 | Clinical | Rising trend across the last 3 readings | “Systolic rose 128, 136, 145” |
| R6 | Clinical | A listed danger-sign symptom is reported (example: severe headache with visual changes during pregnancy) | “Danger-sign symptom reported; send to clinician” |
| R7 | Clinical / data quality | Value outside a plausible range | “Possible data-entry error; re-check” |
| R8 | Clinical | Glucose above or below configured limits for the diabetes cohort | “Glucose 260 mg/dL is above the configured limit” |

All numeric thresholds are illustrative placeholders, not validated clinical guidance. Before any real use, replace them with values from a named clinical guideline and/or obtain clinician review.

### Rule-engine requirements

- Each flag stores rule ID, inputs, timestamp, and rule version so it can be replayed in the audit trail.
- Never use diagnostic language such as “you have.” Use: “Flagged for clinician review because…”
- A health worker cannot dismiss a clinical alert; they can escalate it or mark it reviewed with a note.
- A reminder can be marked done. Snooze is future scope.
- R7 must help prevent a typo from creating a false emergency.

### Call-list priority

1. Clinical alerts.
2. Repeated missed follow-ups (R3).
3. Overdue follow-ups (R2).
4. Due soon (R1).

Break ties by number of days overdue.

## 9. Escalation workflow

1. Worker or system raises a clinical alert.
2. Worker confirms and sends it to a named clinician with the check-in attached.
3. Clinician reviews, adds a note, then returns it with an action or closes it.
4. Status and timestamps remain visible to the worker and supervisor.
5. If no clinician acts within a configured period (for example, 24 hours in the demo), show an “unacknowledged escalation” warning to the supervisor.

## 10. Team responsibilities

For a four-person team:

- **Lead / product:** Scope, README, slides, demo script, submission forms, problem statement, limitations, final package, and demo recording.
- **Frontend developer:** React screens—dashboard, check-in form, escalation view, clinician view.
- **Backend developer:** Node API, database, authentication, audit log, REST endpoints, role checks, schedule and flag jobs.
- **Rules and data developer:** Rule engine, synthetic data, clinician-review coordination, rule JSON, seed script, test cases, and simulated messaging screen.

Agree on API shapes in the first hour so frontend and backend can work in parallel.

## 11. 24-hour execution plan

- **H0–H1 — Lock scope:** Choose the antenatal plus hypertension/diabetes demo cohort; agree MVP, roles, repository, API contract examples, folders, and branch rules.
- **H1–H3 — Foundations in parallel:** Frontend creates Vite/React app, routes, and login. Backend creates Express, SQLite, three hardcoded demo users, and audit middleware. Rules/data developer writes JSON rules, evaluator, and seed script.
- **H3–H8 — Core loop:** Patient list, check-in form, overdue detection (R1–R3), prioritized health-worker call list. Frontend may use mock responses until API is ready.
- **H8–H9 — Deploy/checkpoint:** Deploy first working build and submit progress evidence (screenshots or short recording). Verify the deployment.
- **H9–H14 — Clinical alerts:** Implement R4–R8, “why flagged” panel, reminder/alert styling, and priority ordering. Lead starts slides at H12.
- **H14–H17 — Escalation:** Implement statuses, clinician queue, notes, close action, simulated message log, and—if time allows—unacknowledged-escalation warning.
- **H17 — Feature freeze:** Only bug fixes after this point.
- **H17–H20 — Safety pass:** Consent toggle, role-access checks, empty/error states, mobile layout, synthetic-data/prototype labels, and audit screen.
- **H17–H21 — Documents in parallel:** README with setup, limitations, privacy section; final slides and architecture diagram.
- **H20–H22 — Demo video:** Rehearse, record, finalize deployment, and test from a clean clone and on a phone.
- **H22–H23 — Submit:** Complete final form and check every link in a private/incognito window.
- **H23–H24 — Buffer:** Reserve for unexpected failures.

### Sprint rules

- Have a deployed build by H9 and freeze features at H17.
- Rotate sleep in shifts so someone is always available.
- Merge small changes frequently. Do not push to `main` in the final three hours without lead review.
- Use seeded synthetic data so every demo run is consistent.

## 12. Submission checklist

### Progress checkpoint

- Team ID and member details.
- Track 1, Problem 2: Swasthya Sense.
- Target users and problem understanding.
- Proposed solution.
- Progress: registry, schedules, overdue detection.
- Stack: React, Node/Express, database, hosting.
- Screenshots or short screen recording of working dashboard.
- Repository/prototype link.
- Remaining work for hours 9–24.

### Final submission

- Team details, project title, selected problem.
- Solution and impact explanation.
- Working prototype/deployment link tested on phone and a fresh browser.
- GitHub repository with clean-clone README/setup instructions.
- 2–5 minute demo video.
- 8–10 slide presentation PDF/PPT.
- Architecture and workflow diagram.
- Technology stack.
- Limitations, privacy/safety considerations, and future scope.

### README must include

- One-paragraph purpose.
- Clear “not a diagnostic tool” statement.
- Demo logins for every role.
- Setup commands.
- How to reseed data.
- Rule table.
- Synthetic-data statement.
- Known limitations.

## 13. Suggested 9-slide presentation

1. Title, team, and one-line problem.
2. Why follow-up gaps matter, citing references from the event brief.
3. Users and their daily workflow.
4. Solution overview.
5. Live demo/screenshots of the core loop.
6. Transparent rules and reminder-vs-alert distinction.
7. Privacy, consent, safety, and audit design.
8. Architecture, stack, and limitations.
9. Future scope and next steps.

## 14. Four-minute demo script

- **0:00–0:30:** Show title and one-line problem. State intended users and synthetic-data-only prototype.
- **0:30–1:15:** Health worker logs in and sees today's prioritized list. Point out that reminders and clinical alerts look different and the list is urgency-ordered.
- **1:15–2:00:** Open an overdue patient and show reminder log. Explain that R2 fired, messaging is simulated, and consent was checked.
- **2:00–2:45:** Enter a check-in with rising BP and a danger-sign symptom. Show the clinical alert and the exact rule/values.
- **2:45–3:20:** Escalate to a clinician, switch role, review, and close. Explain that the system does not diagnose.
- **3:20–3:45:** Show supervisor view and audit log; highlight role-based access and traceability.
- **3:45–4:00:** State limitations and future scope.

## 15. Risks, limitations, and future scope

### Risks and fallbacks

- **Scope creep:** Treat the nine must-have features as the contract; only add differentiators after they work.
- **Clinically unsound rules:** Label them illustrative, cite a guideline, or ask a clinician mentor to review them.
- **Deployment failure near deadline:** Deploy early, retain local-run instructions, and record the demo from a stable build.
- **Offline sync takes too long:** Move it to documented future scope instead of half-building it.
- **Concern about real data:** State the synthetic-data policy in the README, UI footer, and slides.

### Limitations to state honestly

- Rules are illustrative and not clinically validated.
- Messaging is simulated; no real SMS/WhatsApp gateway is connected.
- No integration with real health records or national health systems.
- Tested only with synthetic data and a small number of users.

### Future scope

- Clinician-validated rules for named conditions and a pilot with a real health facility, with proper authorization and ethics review.
- Real messaging through an approved gateway, with opt-in and opt-out.
- Offline-first sync, voice entry, and more local languages.
- Interoperability with standard health-record formats.

---

## Definition of done

The MVP is ready when a clean clone can be seeded and run, demo users can log in with role restrictions, synthetic patients and schedules load, overdue and clinical rules generate explainable flags, the worker can record a check-in and escalate an alert, a clinician can review/close it, simulated reminders appear in the message log, and actions appear in the audit log. The deployed demo must be tested on a phone and in a fresh browser session.
