export const SCHEMA_SQL = [
  `CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('worker', 'clinician', 'supervisor') NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS patients (
    id VARCHAR(36) PRIMARY KEY,
    pseudonym VARCHAR(50) NOT NULL,
    age_band VARCHAR(20) NOT NULL,
    village_or_ward VARCHAR(100) NOT NULL,
    cohort ENUM('antenatal', 'hypertension', 'diabetes') NOT NULL,
    assigned_worker_id VARCHAR(36),
    consent_status ENUM('consented', 'declined') DEFAULT 'consented',
    consent_updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    abha_id VARCHAR(20) DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (assigned_worker_id) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS schedules (
    id VARCHAR(36) PRIMARY KEY,
    cohort ENUM('antenatal', 'hypertension', 'diabetes') UNIQUE NOT NULL,
    interval_days INT NOT NULL,
    grace_period_days INT NOT NULL,
    reminder_lead_time_days INT NOT NULL,
    version INT DEFAULT 1,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS check_ins (
    id VARCHAR(36) PRIMARY KEY,
    client_uuid VARCHAR(64) UNIQUE,
    patient_id VARCHAR(36) NOT NULL,
    worker_id VARCHAR(36) NOT NULL,
    due_date DATE NOT NULL,
    completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    channel ENUM('in_person', 'phone') DEFAULT 'in_person',
    symptoms JSON,
    measurements JSON,
    notes TEXT,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY (worker_id) REFERENCES users(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS flags (
    id VARCHAR(36) PRIMARY KEY,
    check_in_id VARCHAR(36),
    patient_id VARCHAR(36) NOT NULL,
    type ENUM('reminder', 'clinical') NOT NULL,
    rule_id VARCHAR(20) NOT NULL,
    triggering_values JSON NOT NULL,
    severity ENUM('info', 'warning', 'urgent') NOT NULL,
    status ENUM('active', 'acknowledged', 'escalated', 'resolved') DEFAULT 'active',
    rule_version INT DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (check_in_id) REFERENCES check_ins(id) ON DELETE SET NULL,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS escalations (
    id VARCHAR(36) PRIMARY KEY,
    flag_id VARCHAR(36) NOT NULL,
    from_worker_id VARCHAR(36) NOT NULL,
    to_clinician_id VARCHAR(36),
    status ENUM('pending', 'reviewed', 'action_taken', 'closed') DEFAULT 'pending',
    clinician_note TEXT,
    outcome VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (flag_id) REFERENCES flags(id) ON DELETE CASCADE,
    FOREIGN KEY (from_worker_id) REFERENCES users(id),
    FOREIGN KEY (to_clinician_id) REFERENCES users(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS audit_log (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36),
    role VARCHAR(50) NOT NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(36) NOT NULL,
    metadata JSON,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

  `CREATE TABLE IF NOT EXISTS simulated_messages (
    id VARCHAR(36) PRIMARY KEY,
    patient_id VARCHAR(36) NOT NULL,
    channel ENUM('sms', 'whatsapp') NOT NULL,
    template_id VARCHAR(50) NOT NULL,
    language VARCHAR(20) DEFAULT 'en',
    message_text TEXT NOT NULL,
    scheduled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status ENUM('scheduled', 'simulated_sent', 'failed_no_consent') DEFAULT 'simulated_sent',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`
];
