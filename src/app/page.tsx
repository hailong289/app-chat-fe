"use client";

import Image from "next/image";
import { useTranslation } from "react-i18next";

export default function Page() {
  const { t } = useTranslation();

  return (
    <div className="w-full h-screen flex items-center justify-center bg-light">
      <div className="text-center max-w-2xl px-8">
        <div className="mb-8">
          <div className="flex justify-center mb-4">
            <Image src="/logo.png" alt="Chat Icon" width={100} height={100} />
          </div>
          <h1 className="text-4xl font-bold text-gray-800 mb-4">
            {t("home.welcome")}
          </h1>
          <p className="text-lg text-gray-600 mb-6">{t("home.description")}</p>
        </div>
      </div>
    </div>
  );
}
