/**
 * ==============================================================================
 * VeerSeva - Internationalization (i18n) Engine
 * Multi-Language Support (English / Hindi)
 * ==============================================================================
 */

let translations = {};
let currentLang = localStorage.getItem('veerseva_lang') || 'en';

export async function initI18n() {
  await loadLanguage(currentLang);

  const langSelect = document.getElementById('select-lang');
  if (langSelect) {
    langSelect.value = currentLang;
    langSelect.addEventListener('change', async (e) => {
      await setLanguage(e.target.value);
    });
  }
}

export async function setLanguage(lang) {
  currentLang = lang;
  localStorage.setItem('veerseva_lang', lang);
  await loadLanguage(lang);
  applyTranslations();
}

async function loadLanguage(lang) {
  try {
    const res = await fetch(`/i18n/${lang}.json`);
    translations = await res.json();
    applyTranslations();
  } catch (err) {
    console.warn(`[i18n] Failed to load ${lang}.json:`, err);
  }
}

export function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const value = getNestedTranslation(translations, key);
    if (value) {
      if (el.tagName === 'INPUT' && el.getAttribute('placeholder')) {
        el.setAttribute('placeholder', value);
      } else {
        el.textContent = value;
      }
    }
  });
}

function getNestedTranslation(obj, path) {
  return path.split('.').reduce((prev, curr) => (prev ? prev[curr] : null), obj);
}
