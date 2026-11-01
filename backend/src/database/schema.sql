-- ==============================================================================
-- VeerSeva - Smart Orchestrator Platform for Indian Ex-Servicemen (ESM)
-- Milestone 1: Database Architecture & Schema Design (MySQL Normalized Relational Schema)
-- Designed for High Concurrency, Fast Indexing, and CERT-In Compliance
-- ==============================================================================

CREATE DATABASE IF NOT EXISTS `veerseva_db` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `veerseva_db`;

-- 1. USERS: Primary authentication & identity table
CREATE TABLE IF NOT EXISTS `users` (
    `user_id` VARCHAR(36) NOT NULL,
    `email` VARCHAR(255) NOT NULL UNIQUE,
    `password_hash` VARCHAR(255) NOT NULL,
    `role` ENUM('ESM', 'ZSB_OFFICER', 'ADMIN') NOT NULL DEFAULT 'ESM',
    `is_verified` BOOLEAN NOT NULL DEFAULT FALSE,
    `phone` VARCHAR(15) NOT NULL,
    `service_number` VARCHAR(30) UNIQUE DEFAULT NULL,
    `assigned_district` VARCHAR(100) DEFAULT NULL, -- For ZSB Officers
    `assigned_state` VARCHAR(100) DEFAULT NULL,
    `is_2fa_enabled` BOOLEAN NOT NULL DEFAULT TRUE,
    `totp_secret` VARCHAR(255) DEFAULT NULL,
    `backup_codes_json` TEXT DEFAULT NULL,
    `failed_logins` INT NOT NULL DEFAULT 0,
    `lockout_until` DATETIME DEFAULT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`user_id`),
    INDEX `idx_users_role` (`role`),
    INDEX `idx_users_district` (`assigned_district`),
    INDEX `idx_users_service_no` (`service_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. ESM_PROFILES: Detailed military service and demographic records
CREATE TABLE IF NOT EXISTS `esm_profiles` (
    `esm_id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL UNIQUE,
    `service_number` VARCHAR(30) NOT NULL UNIQUE,
    `full_name` VARCHAR(150) NOT NULL,
    `service_branch` ENUM('ARMY', 'NAVY', 'AIR_FORCE', 'COAST_GUARD') NOT NULL DEFAULT 'ARMY',
    `rank` VARCHAR(100) NOT NULL,
    `corps_arm` VARCHAR(100) NOT NULL,
    `date_of_enrollment` DATE NOT NULL,
    `date_of_discharge` DATE NOT NULL,
    `ppo_number` VARCHAR(50) NOT NULL,
    `district` VARCHAR(100) NOT NULL,
    `state` VARCHAR(100) NOT NULL,
    `pincode` VARCHAR(10) NOT NULL,
    `aadhaar_last4` CHAR(4) NOT NULL,
    `bank_details_json` TEXT NOT NULL, -- Encrypted AES-256 (Account, IFSC, Bank Name)
    `echs_card_number` VARCHAR(50) DEFAULT NULL,
    `csd_smart_card_id` VARCHAR(50) DEFAULT NULL,
    `onboarding_source` ENUM('MANUAL', 'API_SETU_EKYC', 'DIGILOCKER') NOT NULL DEFAULT 'API_SETU_EKYC',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`esm_id`),
    CONSTRAINT `fk_esm_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE,
    INDEX `idx_esm_service_no` (`service_number`),
    INDEX `idx_esm_district` (`district`),
    INDEX `idx_esm_ppo` (`ppo_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. DEPENDENTS: Family members eligible for scholarships, healthcare & grants
CREATE TABLE IF NOT EXISTS `dependents` (
    `dependent_id` VARCHAR(36) NOT NULL,
    `esm_id` VARCHAR(36) NOT NULL,
    `full_name` VARCHAR(150) NOT NULL,
    `relation` ENUM('SPOUSE', 'SON', 'DAUGHTER', 'MOTHER', 'FATHER', 'OTHER') NOT NULL,
    `dob` DATE NOT NULL,
    `disability_status` BOOLEAN NOT NULL DEFAULT FALSE,
    `education_status` VARCHAR(100) DEFAULT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`dependent_id`),
    CONSTRAINT `fk_dependent_esm` FOREIGN KEY (`esm_id`) REFERENCES `esm_profiles` (`esm_id`) ON DELETE CASCADE,
    INDEX `idx_dependent_esm` (`esm_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. SCHEMES: Available government welfare programs (KSB, DGR, State Rajya Sainik Boards)
CREATE TABLE IF NOT EXISTS `schemes` (
    `scheme_id` VARCHAR(36) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `category` ENUM('SCHOLARSHIP', 'FINANCIAL_ASSISTANCE', 'HEALTHCARE_AID', 'DAUGHTER_MARRIAGE', 'HOUSE_REPAIR', 'RESETTLEMENT') NOT NULL,
    `description` TEXT NOT NULL,
    `max_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    `eligibility_criteria_json` JSON NOT NULL,
    `required_documents_json` JSON NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`scheme_id`),
    INDEX `idx_schemes_active` (`is_active`),
    INDEX `idx_schemes_category` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. APPLICATIONS: Operational table tracking benefits requested and approval workflows
CREATE TABLE IF NOT EXISTS `applications` (
    `application_id` VARCHAR(36) NOT NULL,
    `esm_id` VARCHAR(36) NOT NULL,
    `scheme_id` VARCHAR(36) NOT NULL,
    `dependent_id` VARCHAR(36) DEFAULT NULL,
    `status` ENUM('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `requested_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    `disbursed_amount` DECIMAL(12,2) DEFAULT NULL,
    `submitted_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `reviewed_by` VARCHAR(36) DEFAULT NULL,
    `reviewed_at` DATETIME DEFAULT NULL,
    `rejection_reason` TEXT DEFAULT NULL,
    `review_notes` TEXT DEFAULT NULL,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`application_id`),
    CONSTRAINT `fk_app_esm` FOREIGN KEY (`esm_id`) REFERENCES `esm_profiles` (`esm_id`) ON DELETE CASCADE,
    CONSTRAINT `fk_app_scheme` FOREIGN KEY (`scheme_id`) REFERENCES `schemes` (`scheme_id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_app_dependent` FOREIGN KEY (`dependent_id`) REFERENCES `dependents` (`dependent_id`) ON DELETE SET NULL,
    CONSTRAINT `fk_app_reviewer` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL,
    INDEX `idx_app_status` (`status`),
    INDEX `idx_app_esm` (`esm_id`),
    INDEX `idx_app_submitted` (`submitted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. DOCUMENTS: Metadata for uploaded verification proof
CREATE TABLE IF NOT EXISTS `documents` (
    `doc_id` VARCHAR(36) NOT NULL,
    `application_id` VARCHAR(36) DEFAULT NULL,
    `esm_id` VARCHAR(36) NOT NULL,
    `document_type` ENUM('PPO_ORDER', 'DISCHARGE_BOOK', 'ESM_ID_CARD', 'AADHAAR_CARD', 'ECHS_CARD', 'BANK_PASSBOOK', 'SCHOLARSHIP_CERTIFICATE', 'OTHER') NOT NULL,
    `file_path` VARCHAR(500) NOT NULL,
    `original_name` VARCHAR(255) NOT NULL,
    `mime_type` VARCHAR(100) NOT NULL,
    `file_size_bytes` BIGINT NOT NULL,
    `file_hash_sha256` VARCHAR(64) DEFAULT NULL,
    `is_verified` BOOLEAN NOT NULL DEFAULT FALSE,
    `uploaded_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`doc_id`),
    CONSTRAINT `fk_doc_app` FOREIGN KEY (`application_id`) REFERENCES `applications` (`application_id`) ON DELETE CASCADE,
    CONSTRAINT `fk_doc_esm` FOREIGN KEY (`esm_id`) REFERENCES `esm_profiles` (`esm_id`) ON DELETE CASCADE,
    INDEX `idx_doc_app` (`application_id`),
    INDEX `idx_doc_esm` (`esm_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. AUDIT_LOGS: CERT-In compliance 180-day audit trail
CREATE TABLE IF NOT EXISTS `audit_logs` (
    `log_id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) DEFAULT NULL,
    `action` VARCHAR(100) NOT NULL,
    `ip_address` VARCHAR(50) NOT NULL,
    `user_agent` VARCHAR(255) NOT NULL,
    `status` ENUM('SUCCESS', 'FAILURE', 'WARNING') NOT NULL DEFAULT 'SUCCESS',
    `details_json` TEXT DEFAULT NULL,
    `timestamp` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`log_id`),
    INDEX `idx_audit_user` (`user_id`),
    INDEX `idx_audit_action` (`action`),
    INDEX `idx_audit_timestamp` (`timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. SESSIONS: Session store with refresh token tracking & task sessions
CREATE TABLE IF NOT EXISTS `sessions` (
    `session_id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `refresh_token_hash` VARCHAR(255) NOT NULL,
    `device_fingerprint` VARCHAR(255) DEFAULT NULL,
    `ip_address` VARCHAR(50) NOT NULL,
    `is_revoked` BOOLEAN NOT NULL DEFAULT FALSE,
    `task_session_expires_at` DATETIME DEFAULT NULL,
    `last_activity_at` DATETIME NOT NULL,
    `expires_at` DATETIME NOT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`session_id`),
    CONSTRAINT `fk_session_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE,
    INDEX `idx_session_user` (`user_id`),
    INDEX `idx_session_token` (`refresh_token_hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
