"use client";

import {
  Card,
  CardBody,
  Button,
  Tabs,
  Tab,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Spinner,
  useDisclosure,
  Chip,
} from "@heroui/react";
import {
  ComputerDesktopIcon,
  DevicePhoneMobileIcon,
  DeviceTabletIcon,
  GlobeAltIcon,
  MapPinIcon,
} from "@heroicons/react/24/outline";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import AuthService, { type DeviceSession } from "@/service/auth.service";
import useToast from "@/hooks/useToast";

type RevokeReason = NonNullable<DeviceSession["revokedReason"]>;

/**
 * Render an ISO timestamp as a localised "n minutes ago" string. Uses
 * i18n keys (devices.relative.*) so the language tracks the global
 * locale switch without falling back to hard-coded Vietnamese.
 */
const formatRelative = (
  iso: string | null,
  locale: string,
  t: (key: string, opts?: Record<string, unknown>) => string,
) => {
  if (!iso) return "—";
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return "—";
  const diff = Date.now() - ts;
  const min = Math.round(diff / 60000);
  if (min < 1) return t("devices.relative.justNow");
  if (min < 60) return t("devices.relative.minute", { count: min });
  const hr = Math.round(min / 60);
  if (hr < 24) return t("devices.relative.hour", { count: hr });
  const day = Math.round(hr / 24);
  if (day < 30) return t("devices.relative.day", { count: day });
  return new Date(iso).toLocaleDateString(locale);
};

const formatDateTime = (iso: string | null, locale: string) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(locale);
};

const DeviceIcon = ({ deviceType }: { deviceType?: string | null }) => {
  // mediocre fallback — UA-parser populates `deviceType` as 'mobile' /
  // 'tablet' / 'desktop' / 'bot'; nulls land on the desktop icon.
  if (deviceType === "mobile") {
    return <DevicePhoneMobileIcon className="w-6 h-6 text-foreground-500" />;
  }
  if (deviceType === "tablet") {
    return <DeviceTabletIcon className="w-6 h-6 text-foreground-500" />;
  }
  return <ComputerDesktopIcon className="w-6 h-6 text-foreground-500" />;
};

/**
 * Lightweight User-Agent parser used as a fallback when the BE didn't
 * populate `deviceInfo` (current state — auth.service only stores raw
 * `tkn_userAgent`). Recognises the common cases (Chrome / Edge /
 * Firefox / Safari / Opera + Windows / macOS / Linux / Android / iOS)
 * and returns null for everything else so the UI shows
 * `t("devices.unknownDevice")` rather than a wrong guess.
 *
 * If/when BE gains ua-parser-js, switch to using `deviceInfo` directly
 * and treat this helper as belt-and-braces.
 */
function deriveDeviceFromUA(ua: string | null | undefined): {
  browser?: string;
  os?: string;
  deviceType?: string;
} {
  if (!ua) return {};
  const lower = ua.toLowerCase();

  // Order matters — Edge/Opera/Brave masquerade as Chrome in their UA,
  // so check them first. Detect against the original-case `ua` to keep
  // browser names cased correctly when displayed.
  let browser: string | undefined;
  if (/edg\//i.test(ua)) browser = "Edge";
  else if (/opr\//i.test(ua) || /opera/i.test(ua)) browser = "Opera";
  else if (/firefox\//i.test(ua)) browser = "Firefox";
  else if (/chrome\//i.test(ua)) browser = "Chrome";
  else if (/safari\//i.test(ua) && !/chrome\//i.test(ua)) browser = "Safari";

  let os: string | undefined;
  if (lower.includes("windows nt 10")) os = "Windows 10/11";
  else if (lower.includes("windows nt")) os = "Windows";
  else if (/mac os x/.test(lower)) os = "macOS";
  else if (lower.includes("android")) os = "Android";
  else if (/iphone|ipad|ipod/.test(lower)) os = "iOS";
  else if (lower.includes("linux")) os = "Linux";

  let deviceType: string | undefined;
  if (/iphone|ipod|android.*mobile/.test(lower)) deviceType = "mobile";
  else if (/ipad|android(?!.*mobile)/.test(lower)) deviceType = "tablet";
  else if (browser) deviceType = "desktop";

  return { browser, os, deviceType };
}

export default function SettingsDevices() {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingClient, setPendingClient] = useState<string | null>(null);
  const [pendingAll, setPendingAll] = useState(false);
  const confirmDevice = useDisclosure();
  const confirmAll = useDisclosure();
  const [targetDevice, setTargetDevice] = useState<DeviceSession | null>(null);

  const locale = i18n.language || "vi";

  const loadSessions = async () => {
    try {
      setLoading(true);
      const res = await AuthService.listSessions();
      // BE returns { status, data: { metadata: [...] } } via the wrapper —
      // axios unwrap nests data under .data.data.metadata. Normalise here.
      const list = (res as unknown as {
        data?: { data?: { metadata?: DeviceSession[] }; metadata?: DeviceSession[] };
      })?.data;
      const items: DeviceSession[] =
        list?.metadata ?? list?.data?.metadata ?? [];
      setSessions(items);
    } catch {
      toast.error(t("devices.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { active, history } = useMemo(() => {
    const a: DeviceSession[] = [];
    const h: DeviceSession[] = [];
    for (const s of sessions) {
      (s.revokedAt ? h : a).push(s);
    }
    return { active: a, history: h };
  }, [sessions]);

  const onRequestLogoutDevice = (s: DeviceSession) => {
    setTargetDevice(s);
    confirmDevice.onOpen();
  };

  const handleLogoutDevice = async () => {
    if (!targetDevice) return;
    try {
      setPendingClient(targetDevice.clientId);
      await AuthService.logoutDevice(targetDevice.clientId);
      toast.success(t("devices.logoutDeviceSuccess"));
      confirmDevice.onClose();
      setTargetDevice(null);
      await loadSessions();
    } catch {
      toast.error(t("devices.logoutDeviceFailed"));
    } finally {
      setPendingClient(null);
    }
  };

  const handleLogoutAll = async () => {
    try {
      setPendingAll(true);
      await AuthService.logoutAllDevices();
      toast.success(t("devices.logoutAllSuccess"));
      confirmAll.onClose();
      await loadSessions();
    } catch {
      toast.error(t("devices.logoutAllFailed"));
    } finally {
      setPendingAll(false);
    }
  };

  const renderSession = (s: DeviceSession, opts: { history?: boolean }) => {
    // Fall back to client-side UA parsing when BE didn't populate
    // deviceInfo (auth.service currently only persists the raw UA).
    // Server-derived deviceInfo wins when present so the heuristic
    // doesn't overwrite a more accurate parse.
    const ua = deriveDeviceFromUA(s.userAgent);
    const browser = s.deviceInfo?.browser ?? ua.browser;
    const os = s.deviceInfo?.os ?? ua.os;
    const deviceType = s.deviceInfo?.deviceType ?? ua.deviceType;

    const deviceLabel =
      [browser, os].filter(Boolean).join(" • ") ||
      t("devices.unknownDevice");
    const locationLabel =
      [s.location?.city, s.location?.country].filter(Boolean).join(", ") ||
      t("devices.unknownLocation");

    return (
      <Card
        key={s.clientId}
        className="mb-3 shadow-none border border-default-200 rounded-lg bg-background"
      >
        <CardBody className="px-4 py-3">
          <div className="flex items-start gap-3">
            <DeviceIcon deviceType={deviceType} />
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{deviceLabel}</span>
                {s.isCurrent && !opts.history && (
                  <Chip size="sm" color="success" variant="flat">
                    {t("devices.currentBadge")}
                  </Chip>
                )}
                {opts.history && s.revokedReason && (
                  <Chip size="sm" color="default" variant="flat">
                    {t(`devices.revokeReason.${s.revokedReason as RevokeReason}`)}
                  </Chip>
                )}
              </div>
              <div className="mt-1 text-sm text-foreground-500 flex items-center gap-1">
                <MapPinIcon className="w-4 h-4" />
                <span className="truncate">{locationLabel}</span>
                {s.ip && (
                  <span className="ml-2 text-xs">
                    ({t("devices.ipPrefix")}: {s.ip})
                  </span>
                )}
              </div>
              <div className="mt-1 text-xs text-foreground-500 flex flex-col">
                <span>
                  {t("devices.createdAt")}: {formatDateTime(s.createdAt, locale)}
                </span>
                {opts.history ? (
                  <span>
                    {t("devices.loggedOutAt")}:{" "}
                    {formatDateTime(s.revokedAt, locale)}
                  </span>
                ) : (
                  <span>
                    {t("devices.lastSeen")}:{" "}
                    {formatRelative(s.lastSeenAt, locale, t)}
                  </span>
                )}
              </div>
              {s.userAgent && (
                <div
                  className="mt-1 text-[11px] text-foreground-400 truncate"
                  title={s.userAgent}
                >
                  <GlobeAltIcon className="w-3 h-3 inline mr-1" />
                  {s.userAgent}
                </div>
              )}
            </div>
            {!opts.history && !s.isCurrent && (
              <Button
                size="sm"
                color="danger"
                variant="flat"
                isLoading={pendingClient === s.clientId}
                onPress={() => onRequestLogoutDevice(s)}
              >
                {t("devices.logoutDevice")}
              </Button>
            )}
          </div>
        </CardBody>
      </Card>
    );
  };

  return (
    <Card className="w-full h-full shadow-none border-none rounded-none bg-background text-foreground">
      <CardBody className="p-0 flex flex-col h-full">
        <div className="px-6 py-5 border-b border-default-200">
          <h2 className="text-lg font-semibold">{t("devices.title")}</h2>
          <p className="text-sm text-foreground-500">{t("devices.subtitle")}</p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Spinner label={t("devices.loading")} />
            </div>
          ) : (
            <Tabs aria-label="Device tabs" variant="underlined">
              <Tab key="active" title={t("devices.tabs.active")}>
                <div className="pt-3">
                  {active.length === 0 ? (
                    <div className="text-sm text-foreground-500 py-6 text-center">
                      {t("devices.empty")}
                    </div>
                  ) : (
                    <>
                      {active.map((s) => renderSession(s, {}))}
                      {active.some((s) => !s.isCurrent) && (
                        <div className="mt-4 flex justify-end">
                          <Button
                            color="danger"
                            variant="flat"
                            isLoading={pendingAll}
                            onPress={confirmAll.onOpen}
                          >
                            {t("devices.logoutAll")}
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </Tab>
              <Tab key="history" title={t("devices.tabs.history")}>
                <div className="pt-3">
                  {history.length === 0 ? (
                    <div className="text-sm text-foreground-500 py-6 text-center">
                      {t("devices.emptyHistory")}
                    </div>
                  ) : (
                    history.map((s) => renderSession(s, { history: true }))
                  )}
                </div>
              </Tab>
            </Tabs>
          )}
        </div>

        <Modal
          isOpen={confirmDevice.isOpen}
          onClose={confirmDevice.onClose}
          size="sm"
        >
          <ModalContent>
            <ModalHeader>{t("devices.confirmLogoutDevice.title")}</ModalHeader>
            <ModalBody>
              <p className="text-sm text-foreground-600">
                {t("devices.confirmLogoutDevice.description")}
              </p>
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={confirmDevice.onClose}>
                {t("common.cancel")}
              </Button>
              <Button
                color="danger"
                isLoading={!!pendingClient}
                onPress={handleLogoutDevice}
              >
                {t("devices.logoutDevice")}
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>

        <Modal
          isOpen={confirmAll.isOpen}
          onClose={confirmAll.onClose}
          size="sm"
        >
          <ModalContent>
            <ModalHeader>{t("devices.confirmLogoutAll.title")}</ModalHeader>
            <ModalBody>
              <p className="text-sm text-foreground-600">
                {t("devices.confirmLogoutAll.description")}
              </p>
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={confirmAll.onClose}>
                {t("common.cancel")}
              </Button>
              <Button
                color="danger"
                isLoading={pendingAll}
                onPress={handleLogoutAll}
              >
                {t("devices.logoutAll")}
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </CardBody>
    </Card>
  );
}
