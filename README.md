# VeerSeva (वीरसेवा) - Smart Orchestrator Platform for Indian Ex-Servicemen (ESM)

> **Centralized Defense Benefits Platform & Orchestrator for Indian Armed Forces Veterans, Widows, and Dependents**  
> Built with Node.js, Express.js, MySQL 8.x, Redis, Bootstrap 5, and Vanilla ES6 JavaScript as a Progressive Web App (PWA).  
> Designed to **CERT-In compliance guidelines**, **WCAG 2.1 AA accessibility**, and **India Stack Digital Public Infrastructure**.

---

## 1. Project Architecture & Key Features

Because direct write-access APIs do not exist for public developers on defense portals, VeerSeva acts as a **Smart Orchestrator Dashboard** integrating five core domains:
1. **Onboarding & Verification Module**: API Setu Aadhaar e-KYC placeholder with PPO (Pension Payment Order) and ESM Identity Card digital retrieval from DigiLocker.
2. **Pension Tracker Module (SPARSH / PCDA)**: Real-time basic pension, Dearness Relief (DR 53%), commutation tracking, OROP-2 revision comparison, Jeevan Pramaan (Facial DLC) countdown, and monthly pension slips.
3. **Healthcare Hub (ECHS)**: 450+ ECHS Polyclinics and empaneled NABH super-speciality hospitals search by state, district, and medical speciality (Cardiology, Oncology, Orthopedics, Nephrology) with cashless bed indicators and direct booking links.
4. **CSD AFD Canteen Catalog**: Simulated scraped Against Firm Demand (AFD) vehicle and electronics catalog with live savings calculator and entitlement quotas by rank category.
5. **Grants & Resettlement Board (KSB & DGR)**: Corporate resettlement opportunities at top defense conglomerates (Tata Power, L&T Defense, Adani Ports) and KSB Prime Minister's Scholarship Scheme (PMSS) application stage tracking.

---

## 2. Directory & File Structure

```
esm-orchestrator-platform/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── database/
│   │   │   ├── schema.sql              # Normalized MySQL Relational Schema (Milestone 1)
│   │   │   ├── seed.sql                # Seed data with pre-hashed accounts & schemes
│   │   │   └── db.js                   # Resilient Connection Pool + Embedded Store
│   │   ├── middleware/
│   │   │   ├── auth.middleware.js      # verifyToken (Bearer/Cookie) & requireTaskAuth
│   │   │   ├── rbac.middleware.js      # checkRole & enforceDistrictScope (Milestone 2)
│   │   │   ├── rateLimiter.middleware.js# Brute-force & DOS protection
│   │   │   ├── validate.middleware.js  # Joi validation schemas (PPO, Service No, Phone)
│   │   │   └── upload.middleware.js    # Multer MIME filter & 5MB ceiling (Milestone 4)
│   │   ├── controllers/
│   │   │   ├── auth.controller.js      # Register, 2-Step Login, 2FA, Token Rotation
│   │   │   ├── esm.controller.js       # Profile, Dependents CRUD (Milestone 3)
│   │   │   ├── application.controller.js# Transactional Application Submission
│   │   │   ├── document.controller.js  # Authenticated Download Route (Milestone 4)
│   │   │   ├── benefits.controller.js  # Pension, ECHS, CSD, and DGR orchestrator
│   │   │   └── admin.controller.js     # Verification Workflows, Aggregations, CSV (Milestone 5)
│   │   ├── services/
│   │   │   ├── twoFactor.service.js    # 6-digit OTP, TOTP, and Backup Codes
│   │   │   ├── session.service.js      # 15m Token Rotation & 15m Step-Up Task Sessions
│   │   │   ├── encryption.service.js   # AES-256-GCM encryption & PII Aadhaar masking
│   │   │   ├── scrapers.service.js     # CSD, SPARSH, ECHS, DGR scrapers & cache
│   │   │   └── audit.service.js        # CERT-In 180-day compliant audit trail
│   │   ├── routes/
│   │   │   ├── auth.routes.js
│   │   │   ├── esm.routes.js
│   │   │   ├── application.routes.js
│   │   │   ├── document.routes.js
│   │   │   ├── benefits.routes.js
│   │   │   ├── admin.routes.js
│   │   │   ├── version.routes.js
│   │   │   └── index.js
│   │   ├── mocks/
│   │   │   ├── apiSetuMock.json        # Mock Aadhaar e-KYC & DigiLocker PPO
│   │   │   ├── sparshPensionMock.json  # Mock SPARSH & OROP-2 data
│   │   │   ├── echsPolyclinicsMock.json# Mock ECHS Polyclinics & Hospitals
│   │   │   ├── csdAfdMock.json         # Mock CSD AFD product catalog
│   │   │   └── dgrJobsMock.json        # Mock Corporate Jobs & PMSS stages
│   │   └── server.js                   # Master Express REST API Server
│   ├── test/
│   │   └── system.test.js              # Automated Security & 2FA Test Suite
│   ├── uploads/                        # Secure document storage outside web root
│   ├── package.json
│   ├── .env.example
│   └── .env
├── frontend/
│   ├── public/
│   │   ├── manifest.json               # PWA Manifest
│   │   └── sw.js                       # Versioned Cache Service Worker
│   ├── css/
│   │   └── style.css                   # Custom defense design system + WCAG AA
│   ├── i18n/
│   │   ├── en.json                     # English translations
│   │   └── hi.json                     # Hindi translations
│   ├── js/
│   │   ├── api.js                      # REST API client with auto token refresh
│   │   ├── accessibility.js            # A- / A / A+ font scale & High Contrast
│   │   ├── sessionManager.js           # 10m idle timeout, 2m countdown modal, step-up
│   │   ├── i18n.js                     # Multi-language toggle engine
│   │   └── pwa.js                      # Service Worker & version polling
│   ├── index.html                      # Landing page + 2-Step Login/Register
│   ├── app/
│   │   └── index.html                  # Veteran Dashboard (User Interface)
│   └── admin/
│       ├── index.html                  # Admin & ZSB Officer Command Center
│       └── js/admin.js                 # Approval workflows, charts, CSV, M1 & M2 viewers
├── docker/
│   ├── Dockerfile                      # Multi-stage production container
│   ├── docker-compose.yml              # Nginx + API Replicas + MySQL + Redis
│   └── nginx/
│       └── nginx.conf                  # Least-conn load balancer & rate limiting
├── load-testing/
│   ├── k6-load-test.js                 # k6 load testing script
│   ├── autocannon-test.js              # Node-based high-throughput benchmark
│   └── SCALING_100K_USERS.md           # Architecture blueprint for 100k+ users
└── .github/workflows/
    └── ci-cd.yml                       # GitHub Actions CI/CD pipeline
```

---

## 3. Quick Start & Setup Steps

### Option A: Direct Local Execution (Zero-Friction, Instant Demo)
VeerSeva includes an embedded in-memory database engine loaded with pre-seeded defense data, so you can test immediately even without local MySQL or Docker running!

1. **Install dependencies**:
   ```bash
   cd backend
   npm install
   ```
2. **Run tests**:
   ```bash
   npm test
   ```
3. **Start the server**:
   ```bash
   npm start
   ```
4. **Open in browser**:
   - Landing & Two-Step Sign In: `http://localhost:5000`
   - Veteran Dashboard: `http://localhost:5000/app/`
   - Officer & Admin Command Center: `http://localhost:5000/admin/`

---

### Option B: Docker Compose (Full Stack with Nginx & Replicas)
```bash
cd docker
docker-compose up --build
```
This launches:
- **Nginx Reverse Proxy / Load Balancer** on port `80`
- **VeerSeva API Instances** (horizontally scaled with 2 replicas)
- **MySQL 8.0** with `schema.sql` and `seed.sql` on port `3306`
- **Redis 7.0** on port `6379`

---

## 4. Default Demo Accounts & Credentials

| Role | Username / Identifier | Password | Jurisdiction / Purview |
| :--- | :--- | :--- | :--- |
| **ESM Veteran** | `subedar.sharma@gmail.com` *(or `JC-765432W`)* | `Veteran@123456` | Pune District, Maharashtra |
| **ZSB Officer (Pune)** | `zsb.pune@mod.gov.in` | `Officer@123456` | Pune District (Scoped) |
| **ZSB Officer (Delhi)** | `zsb.delhi@mod.gov.in` | `Officer@123456` | New Delhi (Scoped) |
| **Super Admin** | `admin@veerseva.nic.in` | `Admin@123456` | Nationwide Purview |

> **Two-Step Verification (2FA)**:
> In development mode, the 6-digit OTP is automatically displayed on the screen and in the server console for effortless instant evaluation.

---

## 5. REST API Endpoints Overview (`/api/v1`)

### Authentication & Sessions
- `POST /api/v1/auth/register`: User registration with bcrypt (10 rounds) and initial profile pipeline.
- `POST /api/v1/auth/login`: Step 1 - verifies credentials, checks lockout (max 3 attempts), issues 2FA challenge.
- `POST /api/v1/auth/verify-2fa`: Step 2 - verifies 6-digit OTP / TOTP / Backup Code and issues 15-minute access token + 7-day refresh token.
- `POST /api/v1/auth/refresh-token`: Rotates authentication tokens.
- `POST /api/v1/auth/logout`: Revokes server session and clears HttpOnly cookies.
- `GET /api/v1/auth/me`: Returns active session identity and task session status.
- `POST /api/v1/auth/mock-aadhaar-ekyc`: API Setu mock pulling PPO & ESM ID into profile.

### Veteran Services (`/api/v1/esm`)
- `GET /api/v1/esm/profile`: Retrieves personal, military, and masked bank details.
- `PUT /api/v1/esm/profile`: Updates profile details (*Step-up task auth required*).
- `GET /api/v1/esm/dependents`: Lists registered family dependents.
- `POST /api/v1/esm/dependents`: Adds a family member.
- `DELETE /api/v1/esm/dependents/:id`: Removes a dependent.

### Schemes & Applications (`/api/v1/applications`)
- `GET /api/v1/applications/schemes`: Lists active welfare schemes.
- `POST /api/v1/applications`: Submits a welfare application in an atomic database transaction.
- `GET /api/v1/applications/my-applications`: Tracks status and reviewer feedback for veteran.
- `GET /api/v1/applications/:id`: Application details.

### Documents (`/api/v1/documents`)
- `POST /api/v1/documents/upload`: Multer upload with strict MIME verification (PDF, JPEG, PNG) and 5MB limit.
- `GET /api/v1/documents/:id`: Authenticated download route with JWT verification and ownership check.

### Benefits Orchestrator (`/api/v1/benefits`)
- `GET /api/v1/benefits/pension`: SPARSH / PCDA pension status, OROP-2 revision, and pension slips.
- `GET /api/v1/benefits/echs`: ECHS Polyclinics and Empaneled Hospitals directory with live filters.
- `GET /api/v1/benefits/csd`: CSD AFD Portal items catalog and savings calculator.
- `GET /api/v1/benefits/resettlement`: DGR corporate jobs and KSB PMSS stage tracker.

### Admin & ZSB Officer Workflows (`/api/v1/admin`)
- `GET /api/v1/admin/applications`: Lists applications with status filters and district scoping.
- `PATCH /api/v1/admin/applications/:id/status`: Transitions status (`UNDER_REVIEW`, `APPROVED`, `REJECTED`) in a DB transaction with notes.
- `GET /api/v1/admin/stats`: Aggregates metrics (SQL `COUNT` and `GROUP BY`).
- `GET /api/v1/admin/export`: Generates and streams CSV dataset of verified applications.
- `GET /api/v1/admin/scraper-status`: Health and sync timestamps of external scrapers.
- `POST /api/v1/admin/refresh-scrapers`: Triggers manual scrape refresh.
- `GET /api/v1/admin/users`: User directory (*Super Admin only*).
- `GET /api/v1/admin/audit-logs`: 180-day CERT-In audit logs (*Super Admin only*).
- `GET /api/v1/admin/schema-info`: Milestone 1 DB Schema Viewer (*Super Admin only*).
- `GET /api/v1/admin/rbac-matrix`: Milestone 2 JWT/RBAC Viewer (*Super Admin only*).

---

## 6. Testing & Evaluation Checklist

- [x] **Two-Step Verification**: Sign in with `subedar.sharma@gmail.com` / `Veteran@123456`, verify OTP step 2.
- [x] **10-15 Min Session Timebox**: 15-minute access token lifetime, 10-minute idle inactivity timeout.
- [x] **Session Warning Modal**: Live countdown modal at 2 minutes remaining with "Stay Logged In" / "Sign Out".
- [x] **Step-Up Task Authentication**: Attempt downloading pension slip or updating profile -> prompts 2FA re-verification.
- [x] **Role Isolation & RBAC**: Veteran cannot load `/admin/` (redirects away). ZSB Officer only reviews records in their assigned district (`Pune`).
- [x] **Benefits Modules**: SPARSH pension slips, ECHS hospital search, CSD AFD vehicle calculator, and DGR corporate jobs.
- [x] **Milestone 1 Viewer**: Log in as Admin -> Open "Milestone 1: DB Schema" tab to inspect tables, PKs, FKs, and indexes.
- [x] **Milestone 2 Viewer**: Open "Milestone 2: JWT & RBAC" tab to inspect claims structure and route permissions.
- [x] **Accessibility (WCAG 2.1 AA)**: Click `A-`, `A`, `A+` font resize buttons and `High Contrast` mode toggle.
- [x] **Multi-Language (i18n)**: Switch language dropdown between English and हिन्दी.
- [x] **PWA & Auto-Update**: Service worker caches shell assets; client polls `/api/v1/version` and renders update prompt.
- [x] **Load Testing**: Run `npm test` or `node load-testing/autocannon-test.js` to benchmark throughput.
