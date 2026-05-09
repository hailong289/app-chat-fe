"use client";

import { Card, CardBody } from "@heroui/react";
import NotificationToggle from "@/components/notifications/NotificationToggle";

/**
 * Chat-related preferences. Currently scoped to the browser-notification
 * permission toggle — the only piece that's actually wired up to a real
 * subsystem (Firebase Messaging via `firebase.provider`).
 *
 * Earlier drafts also rendered "Tự động backup", "Tự động lưu tài liệu",
 * and "Xóa toàn bộ dữ liệu" controls, but none of them had handlers or
 * backing APIs. They were removed to avoid presenting non-functional
 * settings to the user.
 */
export default function SettingsChat() {
  return (
    <div className="bg-light min-h-screen w-full p-6 flex justify-center">
      <div className="w-full max-w-3xl">
        <Card className="rounded-2xl shadow-md">
          <CardBody className="p-6">
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-2">Cài đặt trò chuyện</h2>
              <p className="text-sm text-default-500">
                Tuỳ chỉnh thông báo trình duyệt cho tin nhắn mới.
              </p>
            </div>

            <section>
              <h3 className="text-sm font-semibold text-default-600 mb-2">
                Thông báo
              </h3>
              <div className="rounded-xl border border-default-200 bg-content1/60 p-4">
                <NotificationToggle />
              </div>
            </section>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
