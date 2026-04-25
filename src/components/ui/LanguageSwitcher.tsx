"use client";

import {
  Button,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
} from "@heroui/react";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (i18n.language) {
      document.documentElement.lang = i18n.language;
    }
  }, [i18n.language]);

  if (!mounted) return null;

  // i18n.language might be 'en-US' or 'vi-VN', so we might need to normalize or check startsWith
  const currentLang = i18n.language?.split("-")[0] || "vi";

  const languages = [
    { code: "vi", label: "Tiếng Việt", flag: "🇻🇳" },
    { code: "en", label: "English", flag: "🇺🇸" },
  ];

  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang);
  };

  const currentFlag =
    languages.find((l) => l.code === currentLang)?.flag || "🇻🇳";

  return (
    <Dropdown>
      <DropdownTrigger>
        <Button isIconOnly variant="light" size="sm">
          <span className="text-lg">{currentFlag}</span>
        </Button>
      </DropdownTrigger>
      <DropdownMenu
        aria-label="Language Selection"
        onAction={(key) => handleLanguageChange(key as string)}
        selectedKeys={new Set([currentLang])}
        selectionMode="single"
      >
        {languages.map((lang) => (
          <DropdownItem
            key={lang.code}
            startContent={<span className="text-lg">{lang.flag}</span>}
          >
            {lang.label}
          </DropdownItem>
        ))}
      </DropdownMenu>
    </Dropdown>
  );
}
