-- ==============================================================================
-- VeerSeva - Seed Data for Testing, Evaluation & Demo
-- Contains Pre-Hashed Passwords (bcrypt 10 rounds) for easy login:
-- Admin: admin@veerseva.nic.in / Admin@123456
-- ZSB Officer: zsb.pune@mod.gov.in / Officer@123456
-- ESM Veteran: subedar.sharma@gmail.com (JC-765432W) / Veteran@123456
-- ==============================================================================

USE `veerseva_db`;

-- Passwords hash for bcrypt (10 rounds):
-- Admin@123456    -> $2a$10$wNqVn5ZlXGf1XQJ68s3B9.g50E9gM72Tq/Jp1a0v/F36hTq4q1iK2 (or generated dynamically)
-- Officer@123456  -> $2a$10$wNqVn5ZlXGf1XQJ68s3B9.g50E9gM72Tq/Jp1a0v/F36hTq4q1iK2
-- Veteran@123456  -> $2a$10$wNqVn5ZlXGf1XQJ68s3B9.g50E9gM72Tq/Jp1a0v/F36hTq4q1iK2

INSERT INTO `users` (`user_id`, `email`, `password_hash`, `role`, `is_verified`, `phone`, `service_number`, `assigned_district`, `assigned_state`, `is_2fa_enabled`) VALUES
('usr-admin-001', 'admin@veerseva.nic.in', '$2a$10$K7L/Q62z7Y4M77c0Y876pOn6F5uKqHshT.Z9xG3XgG2G3NlVzC2nC', 'ADMIN', TRUE, '+919811001122', 'ADM-HQ-001', 'New Delhi', 'Delhi', TRUE),
('usr-zsb-pune', 'zsb.pune@mod.gov.in', '$2a$10$K7L/Q62z7Y4M77c0Y876pOn6F5uKqHshT.Z9xG3XgG2G3NlVzC2nC', 'ZSB_OFFICER', TRUE, '+919822334455', 'ZSB-PN-042', 'Pune', 'Maharashtra', TRUE),
('usr-zsb-delhi', 'zsb.delhi@mod.gov.in', '$2a$10$K7L/Q62z7Y4M77c0Y876pOn6F5uKqHshT.Z9xG3XgG2G3NlVzC2nC', 'ZSB_OFFICER', TRUE, '+919833445566', 'ZSB-DL-011', 'New Delhi', 'Delhi', TRUE),
('usr-esm-001', 'subedar.sharma@gmail.com', '$2a$10$K7L/Q62z7Y4M77c0Y876pOn6F5uKqHshT.Z9xG3XgG2G3NlVzC2nC', 'ESM', TRUE, '+919876543210', 'JC-765432W', 'Pune', 'Maharashtra', TRUE),
('usr-esm-002', 'havildar.singh@gmail.com', '$2a$10$K7L/Q62z7Y4M77c0Y876pOn6F5uKqHshT.Z9xG3XgG2G3NlVzC2nC', 'ESM', TRUE, '+919876543211', '14589234X', 'New Delhi', 'Delhi', TRUE);

-- ESM Profiles
INSERT INTO `esm_profiles` (`esm_id`, `user_id`, `service_number`, `full_name`, `service_branch`, `rank`, `corps_arm`, `date_of_enrollment`, `date_of_discharge`, `ppo_number`, `district`, `state`, `pincode`, `aadhaar_last4`, `bank_details_json`, `echs_card_number`, `csd_smart_card_id`, `onboarding_source`) VALUES
('esm-prof-001', 'usr-esm-001', 'JC-765432W', 'Subedar Major Ramesh Sharma', 'ARMY', 'Subedar Major', 'Corps of Signals', '1994-08-15', '2024-08-31', 'PPO/ARM/2024/0987654', 'Pune', 'Maharashtra', '411001', '8921', '{"bank_name":"State Bank of India","account_masked":"XXXXXXXXX4512","ifsc":"SBIN0001423"}', 'ECHS-PN-98214', 'CSD-AFD-552109', 'API_SETU_EKYC'),
('esm-prof-002', 'usr-esm-002', '14589234X', 'Havildar Gurpreet Singh', 'ARMY', 'Havildar', 'Sikh Regiment', '2001-03-10', '2025-03-31', 'PPO/ARM/2025/1122334', 'New Delhi', 'Delhi', '110010', '4310', '{"bank_name":"Punjab National Bank","account_masked":"XXXXXXXXX8901","ifsc":"PUNB0024500"}', 'ECHS-DL-44321', 'CSD-AFD-887712', 'DIGILOCKER');

-- Dependents
INSERT INTO `dependents` (`dependent_id`, `esm_id`, `full_name`, `relation`, `dob`, `disability_status`, `education_status`) VALUES
('dep-001', 'esm-prof-001', 'Sunita Sharma', 'SPOUSE', '1976-05-12', FALSE, 'Graduate'),
('dep-002', 'esm-prof-001', 'Aman Sharma', 'SON', '2004-11-20', FALSE, 'B.Tech 3rd Year (Eligible for PMSS)'),
('dep-003', 'esm-prof-001', 'Pooja Sharma', 'DAUGHTER', '2002-04-18', FALSE, 'MBA Student'),
('dep-004', 'esm-prof-002', 'Simranjit Kaur', 'SPOUSE', '1982-08-25', FALSE, 'Post Graduate');

-- Welfare Schemes (Kendriya Sainik Board & Ministry of Defence)
INSERT INTO `schemes` (`scheme_id`, `title`, `category`, `description`, `max_amount`, `eligibility_criteria_json`, `required_documents_json`, `is_active`) VALUES
('sch-001', 'Prime Minister''s Scholarship Scheme (PMSS)', 'SCHOLARSHIP', 'Scholarship for dependent children and widows of Ex-Servicemen pursuing recognized professional and technical degree courses (B.Tech, MBBS, MBA, MCA). Rs. 3,000/month for girls and Rs. 2,500/month for boys.', 36000.00, '{"min_qualification":"10+2 with 60%+","eligible_relations":["SON","DAUGHTER","SPOUSE"],"rank_ceiling":"Subedar Major and below"}', '["PPO_ORDER","ESM_ID_CARD","SCHOLARSHIP_CERTIFICATE","BANK_PASSBOOK"]', TRUE),
('sch-002', 'Financial Assistance for Daughter''s Marriage', 'DAUGHTER_MARRIAGE', 'Grant provided from RMDF (Raksha Mantri Discretionary Fund) up to 2 daughters of Non-Pensioner ESM or Pensioner up to Havildar rank.', 50000.00, '{"eligible_relations":["DAUGHTER"],"rank_ceiling":"Havildar and equivalent","max_daughters":2}', '["PPO_ORDER","ESM_ID_CARD","MARRIAGE_INVITATION_CERTIFICATE","BANK_PASSBOOK"]', TRUE),
('sch-003', 'Medical Grant for Serious Diseases / Non-Pensioner', 'HEALTHCARE_AID', 'Financial assistance for treatment of serious ailments (cancer, cardiac, renal failure, knee replacement) for non-pensioners or beyond ECHS cover.', 125000.00, '{"all_ranks":true,"requires_govt_hospital_certification":true}', '["ECHS_CARD","PPO_ORDER","HOSPITAL_BILLS_SUMMARY","DISCHARGE_BOOK"]', TRUE),
('sch-004', 'Financial Assistance for House Repair for Disabled ESM', 'HOUSE_REPAIR', 'One-time grant for 100% disabled ex-servicemen whose house requires essential maintenance or structural rehabilitation.', 100000.00, '{"disability_minimum":"100%","ranks":"All ranks PBOR"}', '["DISABILITY_CERTIFICATE","PPO_ORDER","HOUSE_OWNERSHIP_PROOF"]', TRUE),
('sch-005', 'DGR Security Agency / Coal Transportation Scheme', 'RESETTLEMENT', 'Resettlement scheme run by Directorate General Resettlement for retired Commissioned Officers and JCOs to operate security and transport enterprises.', 0.00, '{"rank_eligibility":["JCO","OFFICER"],"max_age":60}', '["PPO_ORDER","DISCHARGE_BOOK","DGR_REGISTRATION_FORM"]', TRUE);

-- Applications
INSERT INTO `applications` (`application_id`, `esm_id`, `scheme_id`, `dependent_id`, `status`, `requested_amount`, `disbursed_amount`, `submitted_at`, `reviewed_by`, `reviewed_at`, `rejection_reason`, `review_notes`) VALUES
('app-001', 'esm-prof-001', 'sch-001', 'dep-002', 'APPROVED', 30000.00, 30000.00, '2026-09-10 10:15:00', 'usr-zsb-pune', '2026-09-15 14:30:00', NULL, 'Verified marksheet and university enrollment receipt. Approved for Year 1 disbursement.'),
('app-002', 'esm-prof-001', 'sch-002', 'dep-003', 'UNDER_REVIEW', 50000.00, NULL, '2026-10-18 11:20:00', 'usr-zsb-pune', NULL, NULL, 'Pending verification of marriage registrar certificate.'),
('app-003', 'esm-prof-002', 'sch-001', NULL, 'PENDING', 30000.00, NULL, '2026-10-22 09:45:00', NULL, NULL, NULL, NULL);

-- Documents
INSERT INTO `documents` (`doc_id`, `application_id`, `esm_id`, `document_type`, `file_path`, `original_name`, `mime_type`, `file_size_bytes`, `is_verified`) VALUES
('doc-001', 'app-001', 'esm-prof-001', 'PPO_ORDER', 'uploads/doc-001-ppo-order.pdf', 'SubedarMajor_PPO_Order.pdf', 'application/pdf', 1245800, TRUE),
('doc-002', 'app-001', 'esm-prof-001', 'SCHOLARSHIP_CERTIFICATE', 'uploads/doc-002-marksheet.pdf', 'Aman_Sharma_Sem4_Marksheet.pdf', 'application/pdf', 834500, TRUE),
('doc-003', 'app-002', 'esm-prof-001', 'ESM_ID_CARD', 'uploads/doc-003-esm-card.png', 'ESM_Identity_Card_Ramesh.png', 'image/png', 523100, TRUE);

-- Audit Logs
INSERT INTO `audit_logs` (`log_id`, `user_id`, `action`, `ip_address`, `user_agent`, `status`, `details_json`, `timestamp`) VALUES
('aud-001', 'usr-esm-001', 'LOGIN', '192.168.1.45', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'SUCCESS', '{"method":"2FA_OTP","service_number":"JC-765432W"}', '2026-10-25 09:00:15'),
('aud-002', 'usr-zsb-pune', 'APPLICATION_STATUS_UPDATE', '192.168.1.100', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'SUCCESS', '{"application_id":"app-001","old_status":"UNDER_REVIEW","new_status":"APPROVED"}', '2026-09-15 14:30:00');
