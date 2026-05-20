let currentLanguage = 'experiential';
const STORAGE_KEY = 'the-structure-language';

export function getLanguage() {
  return currentLanguage;
}

export function setLanguage(lang) {
  if (lang !== 'analytical' && lang !== 'experiential') return;
  currentLanguage = lang;
  localStorage.setItem(STORAGE_KEY, lang);
  document.dispatchEvent(
    new CustomEvent('languagechange', { detail: { language: lang } })
  );
}

export function initLanguage(defaultLang) {
  const stored = localStorage.getItem(STORAGE_KEY);
  currentLanguage = stored || defaultLang;
  return currentLanguage;
}
