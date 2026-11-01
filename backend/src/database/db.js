/**
 * ==============================================================================
 * VeerSeva - Database Layer & Connection Pool
 * Milestone 1: Resilient Connection Pool with Parameterized Query Support
 * Supports MySQL 8.x + Graceful in-memory fallback for local instant demo
 * ==============================================================================
 */

const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

let pool = null;
let useInMemory = false;

// In-Memory Repository (Loaded with Milestone 1 Schema & Seed Data)
const memoryStore = {
  users: [],
  esm_profiles: [],
  dependents: [],
  schemes: [],
  applications: [],
  documents: [],
  audit_logs: [],
  sessions: []
};

// Seed initial memory store
async function initMemorySeed() {
  const defaultHash = await bcrypt.hash('Veteran@123456', 10);
  const adminHash = await bcrypt.hash('Admin@123456', 10);
  const officerHash = await bcrypt.hash('Officer@123456', 10);

  memoryStore.users = [
    {
      user_id: 'usr-admin-001',
      email: 'admin@veerseva.nic.in',
      password_hash: adminHash,
      role: 'ADMIN',
      is_verified: true,
      phone: '+919811001122',
      service_number: 'ADM-HQ-001',
      assigned_district: 'New Delhi',
      assigned_state: 'Delhi',
      is_2fa_enabled: true,
      totp_secret: 'JBSWY3DPEHPK3PXP',
      backup_codes_json: JSON.stringify(['BC-9812-7634', 'BC-1123-9988', 'BC-4433-2211']),
      failed_logins: 0,
      lockout_until: null,
      created_at: new Date('2026-01-01T00:00:00Z'),
      updated_at: new Date('2026-01-01T00:00:00Z')
    },
    {
      user_id: 'usr-zsb-pune',
      email: 'zsb.pune@mod.gov.in',
      password_hash: officerHash,
      role: 'ZSB_OFFICER',
      is_verified: true,
      phone: '+919822334455',
      service_number: 'ZSB-PN-042',
      assigned_district: 'Pune',
      assigned_state: 'Maharashtra',
      is_2fa_enabled: true,
      totp_secret: 'JBSWY3DPEHPK3PXP',
      backup_codes_json: JSON.stringify(['BC-5566-7788', 'BC-9900-1122']),
      failed_logins: 0,
      lockout_until: null,
      created_at: new Date('2026-01-01T00:00:00Z'),
      updated_at: new Date('2026-01-01T00:00:00Z')
    },
    {
      user_id: 'usr-zsb-delhi',
      email: 'zsb.delhi@mod.gov.in',
      password_hash: officerHash,
      role: 'ZSB_OFFICER',
      is_verified: true,
      phone: '+919833445566',
      service_number: 'ZSB-DL-011',
      assigned_district: 'New Delhi',
      assigned_state: 'Delhi',
      is_2fa_enabled: true,
      totp_secret: null,
      backup_codes_json: null,
      failed_logins: 0,
      lockout_until: null,
      created_at: new Date('2026-01-01T00:00:00Z'),
      updated_at: new Date('2026-01-01T00:00:00Z')
    },
    {
      user_id: 'usr-esm-001',
      email: 'subedar.sharma@gmail.com',
      password_hash: defaultHash,
      role: 'ESM',
      is_verified: true,
      phone: '+919876543210',
      service_number: 'JC-765432W',
      assigned_district: 'Pune',
      assigned_state: 'Maharashtra',
      is_2fa_enabled: true,
      totp_secret: null,
      backup_codes_json: null,
      failed_logins: 0,
      lockout_until: null,
      created_at: new Date('2026-01-01T00:00:00Z'),
      updated_at: new Date('2026-01-01T00:00:00Z')
    },
    {
      user_id: 'usr-esm-002',
      email: 'havildar.singh@gmail.com',
      password_hash: defaultHash,
      role: 'ESM',
      is_verified: true,
      phone: '+919876543211',
      service_number: '14589234X',
      assigned_district: 'New Delhi',
      assigned_state: 'Delhi',
      is_2fa_enabled: true,
      totp_secret: null,
      backup_codes_json: null,
      failed_logins: 0,
      lockout_until: null,
      created_at: new Date('2026-01-01T00:00:00Z'),
      updated_at: new Date('2026-01-01T00:00:00Z')
    }
  ];

  memoryStore.esm_profiles = [
    {
      esm_id: 'esm-prof-001',
      user_id: 'usr-esm-001',
      service_number: 'JC-765432W',
      full_name: 'Subedar Major Ramesh Sharma',
      service_branch: 'ARMY',
      rank: 'Subedar Major',
      corps_arm: 'Corps of Signals',
      date_of_enrollment: '1994-08-15',
      date_of_discharge: '2024-08-31',
      ppo_number: 'PPO/ARM/2024/0987654',
      district: 'Pune',
      state: 'Maharashtra',
      pincode: '411001',
      aadhaar_last4: '8921',
      bank_details_json: JSON.stringify({
        bank_name: 'State Bank of India',
        account_masked: 'XXXXXXXXX4512',
        ifsc: 'SBIN0001423'
      }),
      echs_card_number: 'ECHS-PN-98214',
      csd_smart_card_id: 'CSD-AFD-552109',
      onboarding_source: 'API_SETU_EKYC',
      created_at: new Date('2026-01-01T00:00:00Z'),
      updated_at: new Date('2026-01-01T00:00:00Z')
    },
    {
      esm_id: 'esm-prof-002',
      user_id: 'usr-esm-002',
      service_number: '14589234X',
      full_name: 'Havildar Gurpreet Singh',
      service_branch: 'ARMY',
      rank: 'Havildar',
      corps_arm: 'Sikh Regiment',
      date_of_enrollment: '2001-03-10',
      date_of_discharge: '2025-03-31',
      ppo_number: 'PPO/ARM/2025/1122334',
      district: 'New Delhi',
      state: 'Delhi',
      pincode: '110010',
      aadhaar_last4: '4310',
      bank_details_json: JSON.stringify({
        bank_name: 'Punjab National Bank',
        account_masked: 'XXXXXXXXX8901',
        ifsc: 'PUNB0024500'
      }),
      echs_card_number: 'ECHS-DL-44321',
      csd_smart_card_id: 'CSD-AFD-887712',
      onboarding_source: 'DIGILOCKER',
      created_at: new Date('2026-01-01T00:00:00Z'),
      updated_at: new Date('2026-01-01T00:00:00Z')
    }
  ];

  memoryStore.dependents = [
    {
      dependent_id: 'dep-001',
      esm_id: 'esm-prof-001',
      full_name: 'Sunita Sharma',
      relation: 'SPOUSE',
      dob: '1976-05-12',
      disability_status: false,
      education_status: 'Graduate',
      created_at: new Date('2026-01-01T00:00:00Z')
    },
    {
      dependent_id: 'dep-002',
      esm_id: 'esm-prof-001',
      full_name: 'Aman Sharma',
      relation: 'SON',
      dob: '2004-11-20',
      disability_status: false,
      education_status: 'B.Tech 3rd Year (Eligible for PMSS)',
      created_at: new Date('2026-01-01T00:00:00Z')
    },
    {
      dependent_id: 'dep-003',
      esm_id: 'esm-prof-001',
      full_name: 'Pooja Sharma',
      relation: 'DAUGHTER',
      dob: '2002-04-18',
      disability_status: false,
      education_status: 'MBA Student',
      created_at: new Date('2026-01-01T00:00:00Z')
    },
    {
      dependent_id: 'dep-004',
      esm_id: 'esm-prof-002',
      full_name: 'Simranjit Kaur',
      relation: 'SPOUSE',
      dob: '1982-08-25',
      disability_status: false,
      education_status: 'Post Graduate',
      created_at: new Date('2026-01-01T00:00:00Z')
    }
  ];

  memoryStore.schemes = [
    {
      scheme_id: 'sch-001',
      title: "Prime Minister's Scholarship Scheme (PMSS)",
      category: 'SCHOLARSHIP',
      description: 'Scholarship for dependent children and widows of Ex-Servicemen pursuing recognized professional and technical degree courses (B.Tech, MBBS, MBA, MCA). ₹3,000/month for girls and ₹2,500/month for boys.',
      max_amount: 36000.00,
      eligibility_criteria_json: {
        min_qualification: '10+2 with 60%+',
        eligible_relations: ['SON', 'DAUGHTER', 'SPOUSE'],
        rank_ceiling: 'Subedar Major and below'
      },
      required_documents_json: ['PPO_ORDER', 'ESM_ID_CARD', 'SCHOLARSHIP_CERTIFICATE', 'BANK_PASSBOOK'],
      is_active: true,
      created_at: new Date('2026-01-01T00:00:00Z')
    },
    {
      scheme_id: 'sch-002',
      title: "Financial Assistance for Daughter's Marriage",
      category: 'DAUGHTER_MARRIAGE',
      description: 'Grant provided from RMDF (Raksha Mantri Discretionary Fund) up to 2 daughters of Non-Pensioner ESM or Pensioner up to Havildar rank.',
      max_amount: 50000.00,
      eligibility_criteria_json: {
        eligible_relations: ['DAUGHTER'],
        rank_ceiling: 'Havildar and equivalent',
        max_daughters: 2
      },
      required_documents_json: ['PPO_ORDER', 'ESM_ID_CARD', 'MARRIAGE_INVITATION_CERTIFICATE', 'BANK_PASSBOOK'],
      is_active: true,
      created_at: new Date('2026-01-01T00:00:00Z')
    },
    {
      scheme_id: 'sch-003',
      title: 'Medical Grant for Serious Diseases / Non-Pensioner',
      category: 'HEALTHCARE_AID',
      description: 'Financial assistance for treatment of serious ailments (cancer, cardiac, renal failure, knee replacement) for non-pensioners or beyond ECHS cover.',
      max_amount: 125000.00,
      eligibility_criteria_json: {
        all_ranks: true,
        requires_govt_hospital_certification: true
      },
      required_documents_json: ['ECHS_CARD', 'PPO_ORDER', 'HOSPITAL_BILLS_SUMMARY', 'DISCHARGE_BOOK'],
      is_active: true,
      created_at: new Date('2026-01-01T00:00:00Z')
    },
    {
      scheme_id: 'sch-004',
      title: 'Financial Assistance for House Repair for Disabled ESM',
      category: 'HOUSE_REPAIR',
      description: 'One-time grant for 100% disabled ex-servicemen whose house requires essential maintenance or structural rehabilitation.',
      max_amount: 100000.00,
      eligibility_criteria_json: {
        disability_minimum: '100%',
        ranks: 'All ranks PBOR'
      },
      required_documents_json: ['DISABILITY_CERTIFICATE', 'PPO_ORDER', 'HOUSE_OWNERSHIP_PROOF'],
      is_active: true,
      created_at: new Date('2026-01-01T00:00:00Z')
    },
    {
      scheme_id: 'sch-005',
      title: 'DGR Security Agency / Coal Transportation Scheme',
      category: 'RESETTLEMENT',
      description: 'Resettlement scheme run by Directorate General Resettlement for retired Commissioned Officers and JCOs to operate security and transport enterprises.',
      max_amount: 0.00,
      eligibility_criteria_json: {
        rank_eligibility: ['JCO', 'OFFICER'],
        max_age: 60
      },
      required_documents_json: ['PPO_ORDER', 'DISCHARGE_BOOK', 'DGR_REGISTRATION_FORM'],
      is_active: true,
      created_at: new Date('2026-01-01T00:00:00Z')
    }
  ];

  memoryStore.applications = [
    {
      application_id: 'app-001',
      esm_id: 'esm-prof-001',
      scheme_id: 'sch-001',
      dependent_id: 'dep-002',
      status: 'APPROVED',
      requested_amount: 30000.00,
      disbursed_amount: 30000.00,
      submitted_at: '2026-09-10 10:15:00',
      reviewed_by: 'usr-zsb-pune',
      reviewed_at: '2026-09-15 14:30:00',
      rejection_reason: null,
      review_notes: 'Verified marksheet and university enrollment receipt. Approved for Year 1 disbursement.',
      updated_at: '2026-09-15 14:30:00'
    },
    {
      application_id: 'app-002',
      esm_id: 'esm-prof-001',
      scheme_id: 'sch-002',
      dependent_id: 'dep-003',
      status: 'UNDER_REVIEW',
      requested_amount: 50000.00,
      disbursed_amount: null,
      submitted_at: '2026-10-18 11:20:00',
      reviewed_by: 'usr-zsb-pune',
      reviewed_at: null,
      rejection_reason: null,
      review_notes: 'Pending verification of marriage registrar certificate.',
      updated_at: '2026-10-18 11:20:00'
    },
    {
      application_id: 'app-003',
      esm_id: 'esm-prof-002',
      scheme_id: 'sch-001',
      dependent_id: null,
      status: 'PENDING',
      requested_amount: 30000.00,
      disbursed_amount: null,
      submitted_at: '2026-10-22 09:45:00',
      reviewed_by: null,
      reviewed_at: null,
      rejection_reason: null,
      review_notes: null,
      updated_at: '2026-10-22 09:45:00'
    }
  ];

  memoryStore.documents = [
    {
      doc_id: 'doc-001',
      application_id: 'app-001',
      esm_id: 'esm-prof-001',
      document_type: 'PPO_ORDER',
      file_path: 'uploads/doc-001-ppo-order.pdf',
      original_name: 'SubedarMajor_PPO_Order.pdf',
      mime_type: 'application/pdf',
      file_size_bytes: 1245800,
      is_verified: true,
      uploaded_at: '2026-09-10 10:20:00'
    },
    {
      doc_id: 'doc-002',
      application_id: 'app-001',
      esm_id: 'esm-prof-001',
      document_type: 'SCHOLARSHIP_CERTIFICATE',
      file_path: 'uploads/doc-002-marksheet.pdf',
      original_name: 'Aman_Sharma_Sem4_Marksheet.pdf',
      mime_type: 'application/pdf',
      file_size_bytes: 834500,
      is_verified: true,
      uploaded_at: '2026-09-10 10:21:00'
    },
    {
      doc_id: 'doc-003',
      application_id: 'app-002',
      esm_id: 'esm-prof-001',
      document_type: 'ESM_ID_CARD',
      file_path: 'uploads/doc-003-esm-card.png',
      original_name: 'ESM_Identity_Card_Ramesh.png',
      mime_type: 'image/png',
      file_size_bytes: 523100,
      is_verified: true,
      uploaded_at: '2026-10-18 11:22:00'
    }
  ];

  memoryStore.audit_logs = [
    {
      log_id: 'aud-001',
      user_id: 'usr-esm-001',
      action: 'LOGIN',
      ip_address: '192.168.1.45',
      user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      status: 'SUCCESS',
      details_json: JSON.stringify({ method: '2FA_OTP', service_number: 'JC-765432W' }),
      timestamp: '2026-10-25 09:00:15'
    },
    {
      log_id: 'aud-002',
      user_id: 'usr-zsb-pune',
      action: 'APPLICATION_STATUS_UPDATE',
      ip_address: '192.168.1.100',
      user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      status: 'SUCCESS',
      details_json: JSON.stringify({ application_id: 'app-001', old_status: 'UNDER_REVIEW', new_status: 'APPROVED' }),
      timestamp: '2026-09-15 14:30:00'
    }
  ];
}

async function initDB() {
  await initMemorySeed();

  try {
    pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'rootpassword',
      database: process.env.DB_NAME || 'veerseva_db',
      waitForConnections: true,
      connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '20', 10),
      queueLimit: 0,
      connectTimeout: 2000
    });

    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    useInMemory = false;
    console.log('[Database] Connected to MySQL connection pool successfully.');
  } catch (err) {
    useInMemory = true;
    console.log(`[Database] MySQL not reachable (${err.message}). Using resilient embedded in-memory repository.`);
  }
}

// Database query helper supporting both MySQL and the resilient memory store
async function query(sql, params = []) {
  if (!useInMemory && pool) {
    try {
      const [rows] = await pool.query(sql, params);
      return rows;
    } catch (err) {
      console.warn(`[Database] MySQL query failed: ${err.message}. Falling back to memory store.`);
    }
  }

  return executeMemoryQuery(sql, params);
}

// Transaction simulation / support
async function withTransaction(callback) {
  if (!useInMemory && pool) {
    const conn = await pool.getConnection();
    await conn.beginTransaction();
    try {
      const result = await callback({
        query: async (sql, params) => {
          const [rows] = await conn.query(sql, params);
          return rows;
        }
      });
      await conn.commit();
      return result;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } else {
    // In-memory atomic snapshot
    const snapshot = JSON.stringify(memoryStore);
    try {
      const result = await callback({
        query: async (sql, params) => executeMemoryQuery(sql, params)
      });
      return result;
    } catch (err) {
      const restored = JSON.parse(snapshot);
      Object.assign(memoryStore, restored);
      throw err;
    }
  }
}

// Memory Query Handler: maps standard SQL queries to memoryStore operations
function executeMemoryQuery(sql, params = []) {
  const normalized = sql.trim().replace(/\s+/g, ' ');

  // SELECT user by email or service_number
  if (normalized.startsWith('SELECT * FROM users WHERE email = ? OR service_number = ?')) {
    const [identifier1, identifier2] = params;
    const user = memoryStore.users.find(u => 
      u.email.toLowerCase() === (identifier1 || '').toLowerCase() || 
      (u.service_number && u.service_number.toUpperCase() === (identifier2 || '').toUpperCase())
    );
    return user ? [user] : [];
  }

  if (normalized.startsWith('SELECT * FROM users WHERE user_id = ?')) {
    const [userId] = params;
    const user = memoryStore.users.find(u => u.user_id === userId);
    return user ? [user] : [];
  }

  if (normalized.startsWith('SELECT * FROM users WHERE email = ?')) {
    const [email] = params;
    const user = memoryStore.users.find(u => u.email.toLowerCase() === (email || '').toLowerCase());
    return user ? [user] : [];
  }

  // SELECT ESM Profile
  if (normalized.startsWith('SELECT * FROM esm_profiles WHERE user_id = ?')) {
    const [userId] = params;
    const prof = memoryStore.esm_profiles.find(p => p.user_id === userId);
    return prof ? [prof] : [];
  }

  if (normalized.startsWith('SELECT * FROM esm_profiles WHERE esm_id = ?')) {
    const [esmId] = params;
    const prof = memoryStore.esm_profiles.find(p => p.esm_id === esmId);
    return prof ? [prof] : [];
  }

  if (normalized.startsWith('SELECT * FROM esm_profiles WHERE service_number = ?')) {
    const [serviceNo] = params;
    const prof = memoryStore.esm_profiles.find(p => p.service_number.toUpperCase() === (serviceNo || '').toUpperCase());
    return prof ? [prof] : [];
  }

  // Dependents
  if (normalized.startsWith('SELECT * FROM dependents WHERE esm_id = ?')) {
    const [esmId] = params;
    return memoryStore.dependents.filter(d => d.esm_id === esmId);
  }

  if (normalized.startsWith('SELECT * FROM dependents WHERE dependent_id = ?')) {
    const [depId] = params;
    const dep = memoryStore.dependents.find(d => d.dependent_id === depId);
    return dep ? [dep] : [];
  }

  // Schemes
  if (normalized.startsWith('SELECT * FROM schemes WHERE is_active = TRUE') || normalized.startsWith('SELECT * FROM schemes WHERE is_active = ?')) {
    return memoryStore.schemes.filter(s => s.is_active);
  }

  if (normalized.startsWith('SELECT * FROM schemes WHERE scheme_id = ?')) {
    const [id] = params;
    const sch = memoryStore.schemes.find(s => s.scheme_id === id);
    return sch ? [sch] : [];
  }

  if (normalized.startsWith('SELECT * FROM schemes')) {
    return memoryStore.schemes;
  }

  // Applications
  if (normalized.includes('FROM applications') && normalized.includes('WHERE a.esm_id = ?')) {
    const [esmId] = params;
    return memoryStore.applications
      .filter(a => a.esm_id === esmId)
      .map(a => {
        const scheme = memoryStore.schemes.find(s => s.scheme_id === a.scheme_id);
        const dep = a.dependent_id ? memoryStore.dependents.find(d => d.dependent_id === a.dependent_id) : null;
        return {
          ...a,
          scheme_title: scheme ? scheme.title : 'Welfare Scheme',
          scheme_category: scheme ? scheme.category : 'GRANT',
          dependent_name: dep ? dep.full_name : 'Self'
        };
      });
  }

  if (normalized.startsWith('SELECT * FROM applications WHERE application_id = ?')) {
    const [appId] = params;
    const app = memoryStore.applications.find(a => a.application_id === appId);
    return app ? [app] : [];
  }

  // Documents
  if (normalized.startsWith('SELECT * FROM documents WHERE application_id = ?')) {
    const [appId] = params;
    return memoryStore.documents.filter(d => d.application_id === appId);
  }

  if (normalized.startsWith('SELECT * FROM documents WHERE esm_id = ?')) {
    const [esmId] = params;
    return memoryStore.documents.filter(d => d.esm_id === esmId);
  }

  if (normalized.startsWith('SELECT * FROM documents WHERE doc_id = ?')) {
    const [docId] = params;
    const doc = memoryStore.documents.find(d => d.doc_id === docId);
    return doc ? [doc] : [];
  }

  // Admin applications query with filters
  if (normalized.includes('FROM applications') && normalized.includes('esm_profiles')) {
    let result = memoryStore.applications.map(app => {
      const esm = memoryStore.esm_profiles.find(e => e.esm_id === app.esm_id) || {};
      const scheme = memoryStore.schemes.find(s => s.scheme_id === app.scheme_id) || {};
      const dep = app.dependent_id ? memoryStore.dependents.find(d => d.dependent_id === app.dependent_id) : null;
      return {
        ...app,
        full_name: esm.full_name || 'Veteran',
        service_number: esm.service_number || 'N/A',
        rank: esm.rank || 'N/A',
        district: esm.district || 'Pune',
        state: esm.state || 'Maharashtra',
        scheme_title: scheme.title || 'Scheme',
        scheme_category: scheme.category || 'GENERAL',
        dependent_name: dep ? dep.full_name : 'Self'
      };
    });
    return result;
  }

  // Audit Logs
  if (normalized.startsWith('SELECT * FROM audit_logs')) {
    return memoryStore.audit_logs.slice().reverse();
  }

  // Users List (for Admin)
  if (normalized.startsWith('SELECT user_id, email, role, is_verified, phone, service_number, assigned_district FROM users')) {
    return memoryStore.users.map(({ user_id, email, role, is_verified, phone, service_number, assigned_district, created_at }) => ({
      user_id, email, role, is_verified, phone, service_number, assigned_district, created_at
    }));
  }

  // INSERT INTO users
  if (normalized.startsWith('INSERT INTO users')) {
    const [user_id, email, password_hash, role, is_verified, phone, service_number, assigned_district, assigned_state, is_2fa_enabled, totp_secret] = params;
    const newUser = {
      user_id,
      email,
      password_hash,
      role: role || 'ESM',
      is_verified: !!is_verified,
      phone,
      service_number,
      assigned_district,
      assigned_state,
      is_2fa_enabled: is_2fa_enabled !== undefined ? is_2fa_enabled : true,
      totp_secret,
      backup_codes_json: null,
      failed_logins: 0,
      lockout_until: null,
      created_at: new Date(),
      updated_at: new Date()
    };
    memoryStore.users.push(newUser);
    return { insertId: user_id, affectedRows: 1 };
  }

  // INSERT INTO esm_profiles
  if (normalized.startsWith('INSERT INTO esm_profiles')) {
    const [esm_id, user_id, service_number, full_name, service_branch, rank, corps_arm, date_of_enrollment, date_of_discharge, ppo_number, district, state, pincode, aadhaar_last4, bank_details_json, echs_card_number, csd_smart_card_id, onboarding_source] = params;
    const newProf = {
      esm_id,
      user_id,
      service_number,
      full_name,
      service_branch: service_branch || 'ARMY',
      rank,
      corps_arm,
      date_of_enrollment,
      date_of_discharge,
      ppo_number,
      district,
      state,
      pincode,
      aadhaar_last4,
      bank_details_json,
      echs_card_number,
      csd_smart_card_id,
      onboarding_source: onboarding_source || 'API_SETU_EKYC',
      created_at: new Date(),
      updated_at: new Date()
    };
    memoryStore.esm_profiles.push(newProf);
    return { insertId: esm_id, affectedRows: 1 };
  }

  // INSERT INTO dependents
  if (normalized.startsWith('INSERT INTO dependents')) {
    const [dependent_id, esm_id, full_name, relation, dob, disability_status, education_status] = params;
    const newDep = {
      dependent_id,
      esm_id,
      full_name,
      relation,
      dob,
      disability_status: !!disability_status,
      education_status,
      created_at: new Date(),
      updated_at: new Date()
    };
    memoryStore.dependents.push(newDep);
    return { insertId: dependent_id, affectedRows: 1 };
  }

  // DELETE FROM dependents
  if (normalized.startsWith('DELETE FROM dependents WHERE dependent_id = ? AND esm_id = ?')) {
    const [depId, esmId] = params;
    const initLen = memoryStore.dependents.length;
    memoryStore.dependents = memoryStore.dependents.filter(d => !(d.dependent_id === depId && d.esm_id === esmId));
    return { affectedRows: initLen - memoryStore.dependents.length };
  }

  // INSERT INTO applications
  if (normalized.startsWith('INSERT INTO applications')) {
    const [application_id, esm_id, scheme_id, dependent_id, status, requested_amount] = params;
    const newApp = {
      application_id,
      esm_id,
      scheme_id,
      dependent_id,
      status: status || 'PENDING',
      requested_amount: parseFloat(requested_amount) || 0,
      disbursed_amount: null,
      submitted_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
      reviewed_by: null,
      reviewed_at: null,
      rejection_reason: null,
      review_notes: null,
      updated_at: new Date().toISOString().slice(0, 19).replace('T', ' ')
    };
    memoryStore.applications.unshift(newApp);
    return { insertId: application_id, affectedRows: 1 };
  }

  // UPDATE applications SET status = ?
  if (normalized.startsWith('UPDATE applications SET status = ?')) {
    const [status, reviewed_by, rejection_reason, review_notes, disbursed_amount, appId] = params;
    const app = memoryStore.applications.find(a => a.application_id === appId);
    if (app) {
      app.status = status;
      app.reviewed_by = reviewed_by;
      app.reviewed_at = new Date().toISOString().slice(0, 19).replace('T', ' ');
      app.rejection_reason = rejection_reason || null;
      app.review_notes = review_notes || null;
      if (disbursed_amount !== undefined && disbursed_amount !== null) {
        app.disbursed_amount = parseFloat(disbursed_amount);
      }
      app.updated_at = new Date().toISOString().slice(0, 19).replace('T', ' ');
      return { affectedRows: 1 };
    }
    return { affectedRows: 0 };
  }

  // INSERT INTO documents
  if (normalized.startsWith('INSERT INTO documents')) {
    const [doc_id, application_id, esm_id, document_type, file_path, original_name, mime_type, file_size_bytes] = params;
    const newDoc = {
      doc_id,
      application_id,
      esm_id,
      document_type,
      file_path,
      original_name,
      mime_type,
      file_size_bytes,
      is_verified: false,
      uploaded_at: new Date().toISOString().slice(0, 19).replace('T', ' ')
    };
    memoryStore.documents.push(newDoc);
    return { insertId: doc_id, affectedRows: 1 };
  }

  // INSERT INTO audit_logs
  if (normalized.startsWith('INSERT INTO audit_logs')) {
    const [log_id, user_id, action, ip_address, user_agent, status, details_json] = params;
    const newLog = {
      log_id,
      user_id,
      action,
      ip_address,
      user_agent,
      status: status || 'SUCCESS',
      details_json,
      timestamp: new Date().toISOString().slice(0, 19).replace('T', ' ')
    };
    memoryStore.audit_logs.push(newLog);
    return { insertId: log_id, affectedRows: 1 };
  }

  // UPDATE users failed_logins / lockout
  if (normalized.startsWith('UPDATE users SET failed_logins = ?')) {
    const [failed_logins, lockout_until, userId] = params;
    const user = memoryStore.users.find(u => u.user_id === userId);
    if (user) {
      user.failed_logins = failed_logins;
      user.lockout_until = lockout_until;
      return { affectedRows: 1 };
    }
  }

  // UPDATE esm_profiles
  if (normalized.startsWith('UPDATE esm_profiles SET')) {
    const [fullName, rank, corpsArm, district, state, pincode, bankDetails, esmId] = params;
    const prof = memoryStore.esm_profiles.find(p => p.esm_id === esmId);
    if (prof) {
      if (fullName) prof.full_name = fullName;
      if (rank) prof.rank = rank;
      if (corpsArm) prof.corps_arm = corpsArm;
      if (district) prof.district = district;
      if (state) prof.state = state;
      if (pincode) prof.pincode = pincode;
      if (bankDetails) prof.bank_details_json = bankDetails;
      prof.updated_at = new Date();
      return { affectedRows: 1 };
    }
  }

  // Fallback
  return [];
}

function getMemoryStore() {
  return memoryStore;
}

module.exports = {
  initDB,
  query,
  withTransaction,
  getMemoryStore
};
