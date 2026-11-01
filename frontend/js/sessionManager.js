/**
 * ==============================================================================
 * VeerSeva - Session Manager & Idle Timeout Guardian
 * Enforces 10-min Idle Inactivity Timeout, 2-Min Live Countdown Modal,
 * and 15-Minute Step-Up Task Sessions
 * ==============================================================================
 */

import { api } from './api.js';

let idleTimer = null;
let warningTimer = null;
let countdownInterval = null;
let secondsRemaining = 120; // 2 minutes

const IDLE_LIMIT_MS = 8 * 60 * 1000; // 8 minutes before warning modal appears
const WARNING_DURATION_MS = 2 * 60 * 1000; // 2 minutes warning countdown

export function initSessionManager() {
  resetIdleTimers();

  // Activity listeners
  const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
  events.forEach(evt => {
    window.addEventListener(evt, () => {
      // If warning modal is not visible, activity resets the timer
      const modal = document.getElementById('sessionWarningModal');
      if (!modal || !modal.classList.contains('show')) {
        resetIdleTimers();
      }
    }, { passive: true });
  });

  // Listen to session expired events from API client
  window.addEventListener('session:expired', () => handleForcedLogout('Your 15-minute access token has expired.'));
  window.addEventListener('session:idle-timeout', () => handleForcedLogout('Session expired due to 10 minutes of inactivity.'));

  createWarningModal();
}

function resetIdleTimers() {
  clearTimeout(idleTimer);
  clearTimeout(warningTimer);
  clearInterval(countdownInterval);

  // Set warning modal trigger at 8 minutes
  idleTimer = setTimeout(showWarningModal, IDLE_LIMIT_MS);
}

function showWarningModal() {
  const modalEl = document.getElementById('sessionWarningModal');
  if (!modalEl) return;

  const bsModal = new bootstrap.Modal(modalEl, { backdrop: 'static', keyboard: false });
  bsModal.show();

  secondsRemaining = 120;
  updateCountdownDisplay(secondsRemaining);

  clearInterval(countdownInterval);
  countdownInterval = setInterval(() => {
    secondsRemaining -= 1;
    updateCountdownDisplay(secondsRemaining);

    if (secondsRemaining <= 0) {
      clearInterval(countdownInterval);
      bsModal.hide();
      handleForcedLogout('Session ended due to inactivity.');
    }
  }, 1000);
}

function updateCountdownDisplay(sec) {
  const display = document.getElementById('session-countdown-seconds');
  if (display) {
    const mins = Math.floor(sec / 60);
    const remainingSecs = sec % 60;
    display.textContent = `${mins}:${remainingSecs < 10 ? '0' : ''}${remainingSecs}`;
  }
}

async function stayLoggedIn() {
  clearInterval(countdownInterval);
  const modalEl = document.getElementById('sessionWarningModal');
  if (modalEl) {
    const bsModal = bootstrap.Modal.getInstance(modalEl);
    if (bsModal) bsModal.hide();
  }

  try {
    // Ping me endpoint to refresh activity & rotate token if needed
    await api.getMe();
    resetIdleTimers();
  } catch {
    handleForcedLogout('Session could not be extended. Please sign in again.');
  }
}

async function handleForcedLogout(reason = 'Signed out') {
  clearTimeout(idleTimer);
  clearTimeout(warningTimer);
  clearInterval(countdownInterval);

  try {
    await api.logout();
  } catch {}

  alert(`Security Notice: ${reason}`);
  window.location.href = '/index.html';
}

function createWarningModal() {
  if (document.getElementById('sessionWarningModal')) return;

  const modalHtml = `
    <div class="modal fade" id="sessionWarningModal" tabindex="-1" aria-labelledby="sessionWarningTitle" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content shadow-lg border-warning">
          <div class="modal-header bg-warning text-dark">
            <h5 class="modal-title font-weight-bold" id="sessionWarningTitle">
              <i class="bi bi-clock-history me-2"></i> Session Inactivity Warning
            </h5>
          </div>
          <div class="modal-body text-center p-4">
            <div class="mb-3">
              <span class="badge bg-warning text-dark px-3 py-2 fs-6">10-Minute Security Timebox</span>
            </div>
            <p class="fs-5 mb-2">You have been inactive for 8 minutes.</p>
            <p class="text-muted">For your security and CERT-In defense compliance, you will be automatically logged out in:</p>
            <div class="display-4 fw-bold text-danger my-3" id="session-countdown-seconds">02:00</div>
          </div>
          <div class="modal-footer justify-content-center">
            <button type="button" class="btn btn-outline-secondary px-4" id="btn-session-logout">Sign Out Now</button>
            <button type="button" class="btn btn-gold px-4" id="btn-session-extend">Stay Logged In</button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  document.getElementById('btn-session-extend')?.addEventListener('click', stayLoggedIn);
  document.getElementById('btn-session-logout')?.addEventListener('click', () => handleForcedLogout('Signed out by user request.'));
}

/**
 * Trigger Step-Up Verification Modal for Sensitive Tasks
 */
export function promptStepUpAuth(taskName = 'SENSITIVE_TASK') {
  return new Promise((resolve) => {
    let modalEl = document.getElementById('stepUpAuthModal');
    if (!modalEl) {
      const stepUpHtml = `
        <div class="modal fade" id="stepUpAuthModal" tabindex="-1" aria-hidden="true">
          <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content shadow-lg">
              <div class="modal-header bg-primary text-white">
                <h5 class="modal-title"><i class="bi bi-shield-lock me-2"></i> Step-Up 2FA Verification</h5>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
              </div>
              <div class="modal-body p-4">
                <div class="alert alert-info py-2" id="step-up-task-desc">
                  This sensitive operation requires fresh 2FA re-verification.
                </div>
                <div class="mb-3">
                  <label class="form-label fw-bold">Enter 6-Digit OTP / Authenticator Token</label>
                  <input type="text" id="step-up-otp-input" class="form-control form-control-lg text-center letter-spacing-lg" maxlength="6" placeholder="------" autocomplete="one-time-code">
                  <div class="form-text text-muted">A verification code has been dispatched to your registered credentials.</div>
                </div>
                <div id="step-up-error-alert" class="alert alert-danger d-none py-2"></div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="button" class="btn btn-primary" id="btn-verify-step-up">Verify & Continue</button>
              </div>
            </div>
          </div>
        </div>
      `;
      document.body.insertAdjacentHTML('beforeend', stepUpHtml);
      modalEl = document.getElementById('stepUpAuthModal');
    }

    const descEl = document.getElementById('step-up-task-desc');
    if (descEl) descEl.textContent = `Action "${taskName}" requires 15-minute task re-verification.`;

    const bsModal = new bootstrap.Modal(modalEl);
    bsModal.show();

    const verifyBtn = document.getElementById('btn-verify-step-up');
    const inputOtp = document.getElementById('step-up-otp-input');
    const errAlert = document.getElementById('step-up-error-alert');

    verifyBtn.onclick = async () => {
      const code = inputOtp.value.trim();
      if (code.length !== 6) {
        errAlert.textContent = 'Please enter a valid 6-digit code.';
        errAlert.classList.remove('d-none');
        return;
      }

      try {
        const userState = JSON.parse(sessionStorage.getItem('veerseva_user') || '{}');
        const res = await api.verify2FA({
          identifier: userState.email || userState.service_number || 'subedar.sharma@gmail.com',
          method: 'OTP',
          otp: code,
          isTaskSession: true,
          taskName
        });

        bsModal.hide();
        resolve(true);
      } catch (err) {
        errAlert.textContent = err.message || 'Verification failed. Please retry.';
        errAlert.classList.remove('d-none');
      }
    };
  });
}
