"use client";

import { useTranslation } from "react-i18next";
import { DocumentIcon } from "@heroicons/react/24/outline";

export default function DocsPage() {
  const { t } = useTranslation();

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50 dark:bg-slate-900 text-gray-500 dark:text-gray-400 p-4">
      <div className="bg-white dark:bg-slate-800 p-8 rounded-full mb-6 shadow-sm">
        <DocumentIcon className="w-16 h-16 text-blue-500" />
      </div>
      <h1 className="text-2xl font-bold mb-2 text-gray-800 dark:text-gray-200">
        {t("documents.title")}
      </h1>
      <p className="text-center max-w-md text-gray-600 dark:text-gray-400">
        {t("documents.subtitle")}
      </p>
    </div>
  );
}
