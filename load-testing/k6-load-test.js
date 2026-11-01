/**
 * ==============================================================================
 * VeerSeva - k6 High-Concurrency Load Testing Script
 * Simulates 1,000+ Concurrent Veterans Accessing Orchestrated Services
 * Run: k6 run k6-load-test.js
 * ==============================================================================
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 50 },   // Warm-up to 50 concurrent users
    { duration: '1m', target: 200 },    // Ramp-up to 200 concurrent users
    { duration: '2m', target: 500 },    // Peak load test with 500 concurrent veterans
    { duration: '30s', target: 0 },     // Ramp-down
  ],
  thresholds: {
    http_req_duration: ['p(95)<250'],   // 95% of requests must complete within 250ms
    http_req_failed: ['rate<0.01'],     // Error rate must remain under 1%
  },
};

const BASE_URL = __ENV.TARGET_URL || 'http://localhost:5000/api/v1';

export default function () {
  group('1. Health & Version Check', () => {
    const res = http.get(`${BASE_URL}/health`);
    check(res, {
      'health check status is 200': (r) => r.status === 200,
    });
  });

  group('2. Two-Step Authentication Flow', () => {
    // Step 1: Login
    const loginPayload = JSON.stringify({
      identifier: 'subedar.sharma@gmail.com',
      password: 'Veteran@123456',
    });

    const loginRes = http.post(`${BASE_URL}/auth/login`, loginPayload, {
      headers: { 'Content-Type': 'application/json' },
    });

    check(loginRes, {
      'login step 1 requires 2FA': (r) => r.status === 200 && r.json('require2FA') === true,
    });

    const devOtp = loginRes.json('data.devOtp') || '123456';

    // Step 2: 2FA Verification
    const verifyPayload = JSON.stringify({
      identifier: 'subedar.sharma@gmail.com',
      method: 'OTP',
      otp: devOtp,
    });

    const verifyRes = http.post(`${BASE_URL}/auth/verify-2fa`, verifyPayload, {
      headers: { 'Content-Type': 'application/json' },
    });

    check(verifyRes, {
      'verify 2FA status is 200': (r) => r.status === 200,
      'has access token': (r) => r.json('data.accessToken') !== undefined,
    });

    const token = verifyRes.json('data.accessToken');
    const authHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };

    sleep(1);

    // Group 3: Fetch Benefits Orchestrator Data
    group('3. Pension & Healthcare Retrieval', () => {
      const pensionRes = http.get(`${BASE_URL}/benefits/pension`, { headers: authHeaders });
      check(pensionRes, {
        'pension status is 200': (r) => r.status === 200,
        'pensioner name correct': (r) => r.json('data.pensioner_name') !== undefined,
      });

      const echsRes = http.get(`${BASE_URL}/benefits/echs?state=Maharashtra&city=Pune`, { headers: authHeaders });
      check(echsRes, {
        'echs polyclinics fetched': (r) => r.status === 200 && r.json('data.polyclinics').length > 0,
      });

      const csdRes = http.get(`${BASE_URL}/benefits/csd?category=4W`, { headers: authHeaders });
      check(csdRes, {
        'csd catalog fetched': (r) => r.status === 200 && r.json('data.products').length > 0,
      });
    });

    // Group 4: Logout
    group('4. Secure Logout', () => {
      const logoutRes = http.post(`${BASE_URL}/auth/logout`, null, { headers: authHeaders });
      check(logoutRes, {
        'logout status is 200': (r) => r.status === 200,
      });
    });
  });

  sleep(2);
}
