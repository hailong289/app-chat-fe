"use client";
import { Card, CardBody, Button, Form, Switch } from "@heroui/react";
import NotificationToggle from "@/components/notifications/NotificationToggle";

export default function SettingsChat() {
  return (
    <div className="bg-light h-screen w-full p-6">
      <div className="w-12/12 mx-auto">
        {/* Left side */}
        <div className="flex flex-col gap-6 md:col-span-1">
          {/* Profile Card */}
          <Card className="rounded-2xl">
            <CardBody className="p-6">
              <h2 className="text-xl font-semibold mb-6">Cài đặt trò chuyện</h2>
              <Form className="space-y-4">
                {/* Thông báo trình duyệt */}
                <NotificationToggle />

                <div className="border-t border-gray-200 dark:border-gray-700 my-6" />

                <Switch defaultSelected>Tự động backup</Switch>
                <Switch defaultSelected>Tự động lưu tài liệu về máy</Switch>
                <Switch defaultSelected>Hiển thị thông báo tin nhắn mới</Switch>

                <div className="border-t border-gray-200 dark:border-gray-700 my-6" />

                <Button color="danger" className="w-full sm:w-auto mt-4">
                  Xóa tất cả dữ liệu tin nhắn
                </Button>
              </Form>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
