"use client";

import { Card, CardBody, Button, Avatar, Input, Form } from "@heroui/react";
import { ArrowUpCircleIcon } from "@heroicons/react/24/outline";

export default function SettingsAccount() {
  return (
    <div className="bg-light min-h-screen w-full p-6 flex justify-center">
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* LEFT PROFILE CARD */}
        <Card className="rounded-2xl md:col-span-1 shadow-md">
          <CardBody>
            <div className="flex flex-col items-center py-6">
              <Avatar
                src="https://avatar.iran.liara.run/public"
                className="w-28 h-28 mb-3"
              />

              <div className="text-2xl font-semibold text-primary">Lea</div>

              <Button
                isIconOnly
                color="primary"
                variant="flat"
                className="mt-4"
              >
                <ArrowUpCircleIcon className="w-6 h-6" />
              </Button>
              <span className="text-xs text-primary mt-2 font-semibold">
                Cập nhật ảnh
              </span>
            </div>
          </CardBody>
        </Card>

        {/* RIGHT SETTINGS FORM */}
        <Card className="rounded-2xl md:col-span-2 shadow-md">
          <CardBody className="p-6">
            <h2 className="text-xl font-semibold mb-6">Thông tin tài khoản</h2>

            <Form className="flex flex-col gap-4">
              <Input
                label="Tên đầy đủ"
                name="fullName"
                defaultValue="Lea"
                variant="bordered"
              />

              <Input
                label="Email"
                type="email"
                name="email"
                defaultValue="lea@example.com"
                variant="bordered"
              />

              <Input
                label="Số điện thoại"
                type="tel"
                name="phone"
                defaultValue="+1234567890"
                variant="bordered"
              />

              <Input
                label="Địa chỉ"
                type="text"
                name="address"
                defaultValue="123 Main St, City, Country"
                variant="bordered"
              />

              <Button type="submit" color="primary" className="w-full mt-2">
                Cập nhật thông tin
              </Button>
            </Form>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
