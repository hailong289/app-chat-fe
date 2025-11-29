"use client";

import { Card, CardBody, Button, Form, Switch } from "@heroui/react";
import NotificationToggle from "@/components/notifications/NotificationToggle";

export default function SettingsChat() {
  return (
    <div className="bg-light min-h-screen w-full p-6 flex justify-center">
      <div className="w-full max-w-3xl">
        <Card className="rounded-2xl shadow-md">
          <CardBody className="p-6">
            {/* Header */}
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-2">Cài đặt trò chuyện</h2>
              <p className="text-sm text-default-500">
                Tuỳ chỉnh cách hệ thống gửi thông báo, sao lưu và hiển thị tin
                nhắn.
              </p>
            </div>

            <Form className="flex flex-col gap-6">
              {/* Thông báo trình duyệt */}
              <section>
                <h3 className="text-sm font-semibold text-default-600 mb-2">
                  Thông báo
                </h3>
                <div className="rounded-xl border border-default-200 bg-content1/60 p-4 space-y-3">
                  <NotificationToggle />

                  <Switch defaultSelected color="primary">
                    Hiển thị thông báo tin nhắn mới
                  </Switch>
                </div>
              </section>

              {/* Sao lưu & tệp */}
              <section>
                <h3 className="text-sm font-semibold text-default-600 mb-2">
                  Sao lưu & tệp
                </h3>
                <div className="rounded-xl border border-default-200 bg-content1/60 p-4 space-y-3">
                  <Switch defaultSelected>
                    Tự động backup dữ liệu trò chuyện
                  </Switch>
                  <Switch defaultSelected>Tự động lưu tài liệu về máy</Switch>
                </div>
              </section>

              {/* Hành động nguy hiểm */}
              <section className="pt-2">
                <h3 className="text-sm font-semibold text-danger mb-2">
                  Dữ liệu
                </h3>
                <p className="text-xs text-default-500 mb-3">
                  Thao tác này sẽ xoá toàn bộ lịch sử tin nhắn trên hệ thống của
                  bạn. Hành động không thể hoàn tác.
                </p>
                <Button
                  color="danger"
                  variant="flat"
                  className="w-full sm:w-auto"
                >
                  Xóa tất cả dữ liệu tin nhắn
                </Button>
              </section>
            </Form>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
