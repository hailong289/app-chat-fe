import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
// import Backend from "i18next-http-backend";

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

i18n
  // .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "vi", // Ngôn ngữ dự phòng nếu không tìm thấy ngôn ngữ trình duyệt
    debug: process.env.NODE_ENV === "development",

    // --- QUAN TRỌNG: Cấu hình namespace ---
    // Khai báo tên file ông đang dùng (common.json)
    ns: ["common"],
    // Đặt common làm mặc định, nếu không nó sẽ tìm translation.json
    defaultNS: "common",

    interpolation: {
      escapeValue: false, // React đã tự xử lý XSS an toàn rồi
    },

    // backend: {
    //   // Đường dẫn trỏ tới public/locales/...
    //   loadPath: "/locales/{{lng}}/{{ns}}.json",
    // },

    react: {
      useSuspense: false, // Ông đang tắt suspense, nhớ tự handle trạng thái loading nhé
    },
  });

export { default } from "i18next";
