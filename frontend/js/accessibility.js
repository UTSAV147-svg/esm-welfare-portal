/**
 * ==============================================================================
 * VeerSeva - Accessibility Controller (WCAG 2.1 AA)
 * Text-resize toggle (A- / A / A+), High-Contrast Mode & Screen-Reader Helpers
 * ==============================================================================
 */

export function initAccessibility() {
  const fontSizes = ['sm', 'md', 'lg'];
  let currentFont = localStorage.getItem('veerseva_font_size') || 'md';
  let isHighContrast = localStorage.getItem('veerseva_high_contrast') === 'true';

  // Apply saved font size
  applyFontSize(currentFont);

  // Apply saved high contrast
  if (isHighContrast) {
    document.body.classList.add('high-contrast-mode');
  }

  // Bind buttons
  const btnFontSm = document.getElementById('btn-font-sm');
  const btnFontMd = document.getElementById('btn-font-md');
  const btnFontLg = document.getElementById('btn-font-lg');
  const btnContrast = document.getElementById('btn-high-contrast');

  if (btnFontSm) btnFontSm.addEventListener('click', () => applyFontSize('sm'));
  if (btnFontMd) btnFontMd.addEventListener('click', () => applyFontSize('md'));
  if (btnFontLg) btnFontLg.addEventListener('click', () => applyFontSize('lg'));

  if (btnContrast) {
    btnContrast.addEventListener('click', () => {
      isHighContrast = !isHighContrast;
      document.body.classList.toggle('high-contrast-mode', isHighContrast);
      localStorage.setItem('veerseva_high_contrast', String(isHighContrast));
      announceToScreenReader(isHighContrast ? 'High contrast mode enabled' : 'Standard contrast mode enabled');
    });
  }

  function applyFontSize(size) {
    fontSizes.forEach(s => document.body.classList.remove(`font-size-${s}`));
    document.body.classList.add(`font-size-${size}`);
    localStorage.setItem('veerseva_font_size', size);
    
    // Update active button state
    [btnFontSm, btnFontMd, btnFontLg].forEach(btn => btn?.classList.remove('active'));
    if (size === 'sm') btnFontSm?.classList.add('active');
    if (size === 'md') btnFontMd?.classList.add('active');
    if (size === 'lg') btnFontLg?.classList.add('active');

    announceToScreenReader(`Font size adjusted to ${size === 'lg' ? 'large' : size === 'sm' ? 'small' : 'standard'}`);
  }
}

export function announceToScreenReader(message) {
  let announcer = document.getElementById('a11y-announcer');
  if (!announcer) {
    announcer = document.createElement('div');
    announcer.id = 'a11y-announcer';
    announcer.setAttribute('aria-live', 'polite');
    announcer.setAttribute('aria-atomic', 'true');
    announcer.className = 'visually-hidden';
    document.body.appendChild(announcer);
  }
  announcer.textContent = message;
}
