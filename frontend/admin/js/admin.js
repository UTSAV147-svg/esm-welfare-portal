/**
 * ==============================================================================
 * VeerSeva - Admin & ZSB Officer Command Center Logic
 * Milestone 5: Verification Workflows, Aggregations, CSV Export & Milestones 1 & 2 Viewers
 * Strictly enforces RBAC: Normal users (ESM) are immediately redirected away!
 * ==============================================================================
 */

import { api } from '/js/api.js';
import { initAccessibility } from '/js/accessibility.js';
import { initSessionManager } from '/js/sessionManager.js';

initAccessibility();
initSessionManager();

let currentUser = null;
let currentStatusFilter = '';

async function initAdmin() {
  try {
    const res = await api.getMe();
    currentUser = res.data.user;

    // Strict Role Guard: normal ESM users must NEVER load admin portal!
    if (currentUser.role === 'ESM') {
      console.warn('[RBAC] Regular veteran user attempted to load admin portal. Redirecting to /app/');
      window.location.href = '/app/';
      return;
    }

    document.getElementById('admin-user-email').textContent = currentUser.email;
    document.getElementById('admin-user-role').textContent = currentUser.role;

    // Update Jurisdiction Badge
    const badge = document.getElementById('admin-jurisdiction-badge');
    const scopeDesc = document.getElementById('admin-app-scope-desc');

    if (currentUser.role === 'ZSB_OFFICER') {
      badge.innerHTML = `<i class="bi bi-geo-alt-fill me-1"></i> Jurisdiction: ${currentUser.district} District (ZSB)`;
      badge.className = 'badge bg-warning text-dark py-2 px-3 fw-bold';
      scopeDesc.textContent = `Showing applications within assigned jurisdiction: ${currentUser.district} District`;
    } else if (currentUser.role === 'ADMIN') {
      badge.innerHTML = `<i class="bi bi-globe-central-south-asia me-1"></i> Jurisdiction: Nationwide Purview (Super Admin)`;
      badge.className = 'badge bg-danger text-white py-2 px-3 fw-bold';
      scopeDesc.textContent = 'Showing applications across all districts nationwide';

      // Unhide Super-Admin specific tabs
      document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('d-none'));
    }

    // Load Data
    loadApplications();
    loadStats();
    loadScrapers();
    if (currentUser.role === 'ADMIN') {
      loadUsers();
      loadAuditLogs();
      loadMilestone1Schema();
      loadMilestone2Rbac();
    }
  } catch (err) {
    window.location.href = '/index.html';
  }
}

// Sidebar Navigation
const navBtns = document.querySelectorAll('#admin-nav-list .list-group-item');
const panes = document.querySelectorAll('.admin-pane');

navBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.getAttribute('data-admin-tab');
    navBtns.forEach(b => b.classList.remove('active'));
    panes.forEach(p => p.classList.add('d-none'));

    btn.classList.add('active');
    document.getElementById(`admin-tab-${target}`)?.classList.remove('d-none');
  });
});

// Status Filter Chips
document.querySelectorAll('.filter-status-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-status-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentStatusFilter = btn.getAttribute('data-status');
    loadApplications();
  });
});

// Load Applications
async function loadApplications() {
  try {
    let query = '';
    if (currentStatusFilter) query = `?status=${currentStatusFilter}`;
    const res = await api.getAdminApplications(query);
    const tbody = document.getElementById('admin-apps-tbody');

    if (!res.data.applications || res.data.applications.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-muted">No applications found in this view.</td></tr>';
      return;
    }

    tbody.innerHTML = res.data.applications.map(a => {
      let badgeClass = 'badge-pending';
      if (a.status === 'APPROVED') badgeClass = 'badge-approved';
      if (a.status === 'UNDER_REVIEW') badgeClass = 'badge-review';
      if (a.status === 'REJECTED') badgeClass = 'badge-rejected';

      return `
        <tr>
          <td><code>${a.application_id}</code></td>
          <td class="fw-bold">${a.applicant_name}</td>
          <td><span class="badge bg-secondary me-1">${a.rank}</span> ${a.service_number}</td>
          <td>${a.district}, ${a.state}</td>
          <td>${a.scheme_title}</td>
          <td class="fw-bold text-success">₹${a.requested_amount.toLocaleString('en-IN')}</td>
          <td><span class="badge-status ${badgeClass}">${a.status}</span></td>
          <td>
            <button class="btn btn-primary btn-sm btn-review-app" 
                    data-id="${a.application_id}" 
                    data-name="${a.applicant_name}" 
                    data-scheme="${a.scheme_title}" 
                    data-amount="${a.requested_amount}"
                    data-status="${a.status}">
              <i class="bi bi-pencil-square me-1"></i> Review
            </button>
          </td>
        </tr>
      `;
    }).join('');

    // Attach click handler to review button
    document.querySelectorAll('.btn-review-app').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const name = btn.getAttribute('data-name');
        const scheme = btn.getAttribute('data-scheme');
        const amount = btn.getAttribute('data-amount');
        const currentStatus = btn.getAttribute('data-status');

        document.getElementById('review-app-id').value = id;
        document.getElementById('reviewModalTitle').textContent = `Review: ${name} (${scheme})`;
        document.getElementById('review-disbursed-amount').value = amount;
        document.getElementById('review-status-select').value = currentStatus === 'PENDING' ? 'UNDER_REVIEW' : currentStatus;

        const modal = new bootstrap.Modal(document.getElementById('reviewModal'));
        modal.show();
      });
    });
  } catch (err) {
    console.error('Failed to load applications:', err);
  }
}

// Review Decision Form Submission
document.getElementById('form-review-app')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('review-app-id').value;
  const status = document.getElementById('review-status-select').value;
  const notes = document.getElementById('review-notes').value.trim();
  const disbursed = parseFloat(document.getElementById('review-disbursed-amount').value);

  try {
    const body = {
      status,
      review_notes: notes,
      rejection_reason: status === 'REJECTED' ? notes : null,
      disbursed_amount: status === 'APPROVED' ? disbursed : null
    };

    await api.updateAppStatus(id, body);
    const modal = bootstrap.Modal.getInstance(document.getElementById('reviewModal'));
    modal.hide();

    alert(`Application ${id} transitioned to ${status} via database transaction.`);
    loadApplications();
    loadStats();
  } catch (err) {
    alert(err.message || 'Status update failed.');
  }
});

// Load Metrics & Aggregations
async function loadStats() {
  try {
    const res = await api.getAdminStats();
    const s = res.data.summary;
    document.getElementById('stat-veterans').textContent = s.totalRegisteredVeterans;
    document.getElementById('stat-apps').textContent = s.totalApplications;
    document.getElementById('stat-funds').textContent = `₹${s.totalFundsDisbursed.toLocaleString('en-IN')}`;
    document.getElementById('stat-rate').textContent = `${s.approvalRatePercentage}%`;

    // District Table
    const tbody = document.getElementById('admin-district-tbody');
    tbody.innerHTML = Object.entries(res.data.districtBreakdown).map(([district, data]) => `
      <tr>
        <td class="fw-bold">${district}</td>
        <td>${data.total}</td>
        <td><span class="badge bg-success">${data.approved}</span></td>
        <td><span class="badge bg-warning text-dark">${data.pending}</span></td>
        <td class="fw-bold text-success">₹${data.disbursedFunds.toLocaleString('en-IN')}</td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Failed to load stats:', err);
  }
}

// Load Scraper Status
async function loadScrapers() {
  try {
    const res = await api.getScraperStatus();
    const container = document.getElementById('scrapers-container');
    container.innerHTML = Object.entries(res.data).map(([key, item]) => `
      <div class="card p-3 border mb-3">
        <div class="d-flex justify-content-between align-items-center mb-1">
          <h6 class="fw-bold text-dark mb-0">${item.name}</h6>
          <span class="badge bg-success"><i class="bi bi-check-circle-fill me-1"></i> ${item.status}</span>
        </div>
        <div class="small text-muted mb-2">Target Endpoint: <code>${item.targetEndpoint}</code> | Interval: ${item.interval}</div>
        <div class="small text-secondary">
          <i class="bi bi-clock me-1"></i> <strong>Last Synchronized:</strong> ${new Date(item.lastUpdated).toLocaleString()}
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Scrapers fetch error:', err);
  }
}

// Force Refresh Scrapers
document.getElementById('btn-refresh-all-scrapers')?.addEventListener('click', async () => {
  try {
    await api.refreshScrapers('ALL');
    alert('External scrapers pipeline manually refreshed!');
    loadScrapers();
  } catch (err) {
    alert(err.message || 'Scraper refresh failed.');
  }
});

// CSV Export
document.getElementById('btn-export-csv')?.addEventListener('click', () => {
  const status = document.getElementById('export-status-select').value;
  window.open(api.exportCsvUrl(status), '_blank');
});

// User Directory (ADMIN only)
async function loadUsers() {
  try {
    const res = await api.getAdminUsers();
    const tbody = document.getElementById('admin-users-tbody');
    tbody.innerHTML = res.data.map(u => `
      <tr>
        <td><code>${u.user_id}</code></td>
        <td class="fw-bold">${u.email}</td>
        <td><span class="badge bg-${u.role === 'ADMIN' ? 'danger' : u.role === 'ZSB_OFFICER' ? 'warning text-dark' : 'primary'}">${u.role}</span></td>
        <td>${u.service_number || 'N/A'}</td>
        <td>${u.assigned_district || 'All Districts'}</td>
        <td><span class="badge bg-success">2FA Active</span></td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Users load error:', err);
  }
}

// Audit Logs (ADMIN only)
async function loadAuditLogs() {
  try {
    const res = await api.getAdminAuditLogs();
    const tbody = document.getElementById('admin-audit-tbody');
    tbody.innerHTML = res.data.map(l => `
      <tr>
        <td><code>${l.log_id}</code></td>
        <td>${l.timestamp}</td>
        <td>${l.user_id || 'ANONYMOUS'}</td>
        <td><span class="badge bg-dark">${l.action}</span></td>
        <td><code>${l.ip_address}</code></td>
        <td><span class="badge bg-${l.status === 'SUCCESS' ? 'success' : 'danger'}">${l.status}</span></td>
        <td><pre class="mb-0 text-muted" style="max-width: 250px; font-size: 0.72rem;">${l.details_json || '{}'}</pre></td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Audit load error:', err);
  }
}

// Milestone 1 Schema Viewer (ADMIN only)
async function loadMilestone1Schema() {
  try {
    const res = await api.getSchemaInfo();
    const container = document.getElementById('schema-viewer-container');
    container.innerHTML = `
      <div class="alert alert-info py-2 small mb-4">
        <strong>Database Engine:</strong> ${res.data.database}
      </div>
      <div class="row g-4">
        ${res.data.tables.map(t => `
          <div class="col-lg-6">
            <div class="card h-100 border shadow-sm">
              <div class="card-header bg-light d-flex justify-content-between align-items-center">
                <span class="fw-bold text-primary font-monospace">${t.name}</span>
                <span class="badge bg-secondary">${t.columns.length} Columns</span>
              </div>
              <div class="card-body p-3">
                <p class="small text-muted mb-2">${t.description}</p>
                <div class="small fw-semibold mb-1">Columns:</div>
                <ul class="list-unstyled small font-monospace text-secondary mb-3">
                  ${t.columns.map(c => `<li><i class="bi bi-caret-right text-warning me-1"></i>${c}</li>`).join('')}
                </ul>
                <div class="small fw-semibold mb-1">Indexes & Keys:</div>
                <div class="d-flex flex-wrap gap-1">
                  ${t.indexes.map(idx => `<span class="badge bg-light text-dark border font-monospace">${idx}</span>`).join('')}
                </div>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  } catch (err) {
    console.error('Schema viewer error:', err);
  }
}

// Milestone 2 RBAC Matrix Viewer (ADMIN only)
async function loadMilestone2Rbac() {
  try {
    const res = await api.getRbacMatrix();
    const container = document.getElementById('rbac-viewer-container');
    container.innerHTML = `
      <div class="card border mb-4">
        <div class="card-header bg-light fw-bold">JWT Token Claims Structure</div>
        <div class="card-body p-3">
          <div class="row">
            <div class="col-md-6">
              <h6 class="fw-bold text-primary">Access Token (15-Minute Expiry)</h6>
              <ul class="small font-monospace text-muted">
                ${res.data.jwt_claims.access_token.map(c => `<li>${c}</li>`).join('')}
              </ul>
            </div>
            <div class="col-md-6">
              <h6 class="fw-bold text-success">Refresh Token (7-Day Rotation with Redis Revocation)</h6>
              <ul class="small font-monospace text-muted">
                ${res.data.jwt_claims.refresh_token.map(c => `<li>${c}</li>`).join('')}
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div class="card border">
        <div class="card-header bg-light fw-bold">API Route RBAC Authorization Matrix</div>
        <div class="table-responsive">
          <table class="table table-hover align-middle mb-0 font-monospace small">
            <thead class="table-light">
              <tr>
                <th>Route Path</th>
                <th>HTTP Methods</th>
                <th>Authorized Roles</th>
                <th>Step-Up 2FA Required</th>
                <th>District Scoped</th>
              </tr>
            </thead>
            <tbody>
              ${res.data.route_permissions.map(p => `
                <tr>
                  <td class="fw-bold">${p.path}</td>
                  <td>${p.methods.join(', ')}</td>
                  <td>${p.allowed_roles.map(r => `<span class="badge bg-${r === 'ADMIN' ? 'danger' : r === 'ZSB_OFFICER' ? 'warning text-dark' : 'primary'} me-1">${r}</span>`).join('')}</td>
                  <td>${p.step_up_required ? `<span class="badge bg-info text-dark">${p.step_up_required}</span>` : 'No'}</td>
                  <td>${p.district_scoped ? `<span class="badge bg-warning text-dark">${p.district_scoped}</span>` : 'No'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch (err) {
    console.error('RBAC viewer error:', err);
  }
}

// Sign Out
document.getElementById('btn-admin-logout')?.addEventListener('click', async () => {
  await api.logout();
  window.location.href = '/index.html';
});

// Run
initAdmin();
