/**
 * ==============================================================================
 * VeerSeva - Unified REST API Client
 * Automatically handles HttpOnly credentials, 401 token refresh, and step-up auth
 * ==============================================================================
 */

const BASE_URL = '/api/v1';

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const config = {
    credentials: 'include', // sends and receives HttpOnly cookies
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  };

  // If body is FormData (file upload), delete Content-Type so browser sets boundary
  if (config.body instanceof FormData) {
    delete config.headers['Content-Type'];
  }

  try {
    let response = await fetch(url, config);

    // If 401 TOKEN_EXPIRED, attempt transparent token rotation
    if (response.status === 401) {
      const errData = await response.clone().json().catch(() => ({}));
      if (errData.error === 'TOKEN_EXPIRED') {
        console.log('[API] Access token expired. Attempting refresh token rotation...');
        const refreshRes = await fetch(`${BASE_URL}/auth/refresh-token`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' }
        });

        if (refreshRes.ok) {
          // Retry the original request
          response = await fetch(url, config);
        } else {
          window.dispatchEvent(new CustomEvent('session:expired'));
          return refreshRes.json();
        }
      } else if (errData.error === 'SESSION_IDLE_TIMEOUT') {
        window.dispatchEvent(new CustomEvent('session:idle-timeout'));
      }
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      data.statusCode = response.status;
      return Promise.reject(data);
    }

    return data;
  } catch (err) {
    console.error(`[API Error] ${options.method || 'GET'} ${endpoint}:`, err);
    throw err;
  }
}

export const api = {
  // Auth
  register: (body) => request('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body) => request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  verify2FA: (body) => request('/auth/verify-2fa', { method: 'POST', body: JSON.stringify(body) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  getMe: () => request('/auth/me'),
  mockAadhaarEkyc: (body) => request('/auth/mock-aadhaar-ekyc', { method: 'POST', body: JSON.stringify(body) }),

  // ESM Profile & Dependents
  getProfile: () => request('/esm/profile'),
  updateProfile: (body) => request('/esm/profile', { method: 'PUT', body: JSON.stringify(body) }),
  getDependents: () => request('/esm/dependents'),
  addDependent: (body) => request('/esm/dependents', { method: 'POST', body: JSON.stringify(body) }),
  deleteDependent: (id) => request(`/esm/dependents/${id}`, { method: 'DELETE' }),

  // Schemes & Applications
  getSchemes: () => request('/applications/schemes'),
  submitApplication: (body) => request('/applications', { method: 'POST', body: JSON.stringify(body) }),
  getMyApplications: () => request('/applications/my-applications'),
  getApplicationById: (id) => request(`/applications/${id}`),

  // Documents
  uploadDocument: (formData) => request('/documents/upload', { method: 'POST', body: formData }),
  downloadDocUrl: (docId) => `${BASE_URL}/documents/${docId}`,

  // Benefits Orchestrator
  getPension: () => request('/benefits/pension'),
  getHealthcare: (params = '') => request(`/benefits/echs${params}`),
  getCsdCatalog: (params = '') => request(`/benefits/csd${params}`),
  getResettlement: () => request('/benefits/resettlement'),

  // Admin Workflows
  getAdminApplications: (params = '') => request(`/admin/applications${params}`),
  updateAppStatus: (id, body) => request(`/admin/applications/${id}/status`, { method: 'PATCH', body: JSON.stringify(body) }),
  getAdminStats: () => request('/admin/stats'),
  getAdminUsers: () => request('/admin/users'),
  getAdminAuditLogs: () => request('/admin/audit-logs'),
  getScraperStatus: () => request('/admin/scraper-status'),
  refreshScrapers: (source = 'ALL') => request('/admin/refresh-scrapers', { method: 'POST', body: JSON.stringify({ source }) }),
  getSchemaInfo: () => request('/admin/schema-info'),
  getRbacMatrix: () => request('/admin/rbac-matrix'),
  exportCsvUrl: (status = 'APPROVED') => `${BASE_URL}/admin/export?status=${status}`,

  // Version
  getVersion: () => request('/version')
};
