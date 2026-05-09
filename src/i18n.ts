import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import commonEn from "../public/locales/en/common.json";
import commonVi from "../public/locales/vi/common.json";

const resources = {
  en: {
    common: commonEn,
  },
  vi: {
    common: commonVi,
  },
};

// SSR-safe init: force a deterministic language on both server and first
// client paint to avoid hydration mismatches. The user's persisted language
// is applied AFTER mount via syncLanguageFromStorage() — see providers.tsx.
const INITIAL_LNG = "vi";

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources,
    lng: INITIAL_LNG,
    fallbackLng: INITIAL_LNG,
    debug: false,
    ns: ["common"],
    defaultNS: "common",
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });
}

// Defensive: force initial language on every module load. Required because
// i18next is a singleton — under HMR / fast refresh the previous instance
// may be in a different language, and `init` is a no-op when already
// initialized. Synchronous because resources are bundled in.
if (i18n.language !== INITIAL_LNG) {
  void i18n.changeLanguage(INITIAL_LNG);
}

const STORAGE_KEY = "i18nextLng";

export function syncLanguageFromStorage() {
  if (typeof window === "undefined") return;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const fromBrowser = stored ?? window.navigator.language;
    const normalized = fromBrowser?.split("-")[0];
    if (normalized && normalized !== i18n.language && resources[normalized as keyof typeof resources]) {
      void i18n.changeLanguage(normalized);
    }
  } catch {
    // localStorage may be unavailable (private mode, etc.) — keep default.
  }
}

// Persist language preference explicitly. Don't use a `languageChanged`
// listener — it would also fire for the defensive reset on each module
// load, overwriting the user's saved preference with the initial language.
export function persistLanguage(lng: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, lng);
  } catch {
    // ignore
  }
}

export { default } from "i18next";
