/**
 * Thay thế $NEXT_PUBLIC_APP_URL trong src-tauri/tauri.conf.json
 * trước khi chạy `tauri dev` / `tauri build`.
 *
 * Usage:
 *   node scripts/inject-tauri-env.mjs          # inject
 *   node scripts/inject-tauri-env.mjs --restore # khôi phục placeholder
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PLACEHOLDER = "$NEXT_PUBLIC_APP_URL";
const DEFAULT_APP_URL = "http://localhost:3000";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const TAURI_CONF = join(ROOT, "src-tauri", "tauri.conf.json");

const restore = process.argv.includes("--restore");

function parseEnvFile(filePath) {
  try {
    const content = readFileSync(filePath, "utf8");
    const vars = {};
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      vars[key] = value;
    }
    return vars;
  } catch {
    return {};
  }
}

function loadAppUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }

  const envFiles = [
    join(ROOT, ".env.local"),
    join(ROOT, ".env"),
    join(ROOT, ".env.production"),
  ];

  for (const file of envFiles) {
    const vars = parseEnvFile(file);
    if (vars.NEXT_PUBLIC_APP_URL) {
      return vars.NEXT_PUBLIC_APP_URL;
    }
  }

  return DEFAULT_APP_URL;
}

function inject(conf, appUrl) {
  if (!conf.includes(PLACEHOLDER)) {
    console.warn(
      `[inject-tauri-env] Không tìm thấy "${PLACEHOLDER}" trong tauri.conf.json — bỏ qua.`,
    );
    return conf;
  }
  return conf.split(PLACEHOLDER).join(appUrl);
}

function restorePlaceholders(conf, appUrl) {
  if (!conf.includes(appUrl)) {
    console.warn(
      `[inject-tauri-env] Không tìm thấy URL "${appUrl}" để khôi phục placeholder.`,
    );
    return conf;
  }
  return conf.split(appUrl).join(PLACEHOLDER);
}

const appUrl = loadAppUrl();
let conf = readFileSync(TAURI_CONF, "utf8");

if (restore) {
  conf = restorePlaceholders(conf, appUrl);
  writeFileSync(TAURI_CONF, conf, "utf8");
  console.log(`[inject-tauri-env] Đã khôi phục placeholder trong tauri.conf.json`);
} else {
  conf = inject(conf, appUrl);
  writeFileSync(TAURI_CONF, conf, "utf8");
  console.log(
    `[inject-tauri-env] Đã thay ${PLACEHOLDER} → ${appUrl} trong tauri.conf.json`,
  );
}
