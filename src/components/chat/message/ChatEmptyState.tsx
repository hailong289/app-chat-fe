import { FaceSmileIcon } from "@heroicons/react/16/solid";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";

export function ChatEmptyState() {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <div className="text-center text-gray-500 dark:text-gray-400 mt-10">
      <div className="mb-4">
        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3">
          <FaceSmileIcon className="w-8 h-8 text-gray-400 dark:text-gray-300" />
        </div>
      </div>
      <p className="text-lg font-medium text-gray-700 dark:text-gray-200">
        {t("chat.messages.empty.title")}
      </p>
      <p className="text-sm mt-1 text-gray-500 dark:text-gray-400">
        {t("chat.messages.empty.subtitle")}
      </p>
    </div>
  );
}
