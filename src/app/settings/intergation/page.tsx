"use client";

import { Card, CardBody, Button, Switch, Chip } from "@heroui/react";
import {
  LinkIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
} from "@heroicons/react/24/outline";

export default function SettingsIntegration() {
  // TODO: sau này map từ API: trạng thái đã liên kết / chưa liên kết
  const integrations = [
    {
      key: "google",
      name: "Google",
      description: "Đồng bộ lịch, tài liệu và tài khoản Google.",
      isConnected: false,
    },
    {
      key: "outlook",
      name: "Outlook",
      description: "Đồng bộ email và lịch từ Outlook / Microsoft 365.",
      isConnected: false,
    },
  ];

  return (
    <div className="bg-light min-h-screen w-full p-6 flex justify-center">
      <div className="w-full max-w-3xl">
        <Card className="rounded-2xl shadow-md">
          <CardBody className="p-6 space-y-6">
            {/* Header */}
            <div>
              <h2 className="text-xl font-semibold mb-2">Tích hợp</h2>
              <p className="text-sm text-default-500">
                Kết nối với các dịch vụ bên thứ ba để đồng bộ lịch, tài liệu và
                tài khoản của bạn.
              </p>
            </div>

            {/* Integrations list */}
            <div className="space-y-4">
              {integrations.map((item) => (
                <Card
                  key={item.key}
                  className="border border-default-200 rounded-xl bg-content1/60"
                  shadow="none"
                >
                  <CardBody className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-default-800">
                          {item.name}
                        </span>
                        {item.isConnected ? (
                          <Chip
                            size="sm"
                            color="success"
                            variant="flat"
                            startContent={
                              <CheckCircleIcon className="w-3 h-3" />
                            }
                          >
                            Đã liên kết
                          </Chip>
                        ) : (
                          <Chip
                            size="sm"
                            color="default"
                            variant="flat"
                            startContent={
                              <ExclamationCircleIcon className="w-3 h-3" />
                            }
                          >
                            Chưa liên kết
                          </Chip>
                        )}
                      </div>
                      <p className="text-xs text-default-500 max-w-md">
                        {item.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                      <Switch
                        size="sm"
                        color="primary"
                        isSelected={item.isConnected}
                        // onChange={() => ... call API / toggle state}
                      >
                        Kích hoạt
                      </Switch>
                      <Button
                        size="sm"
                        color="primary"
                        variant={item.isConnected ? "bordered" : "solid"}
                        startContent={<LinkIcon className="w-4 h-4" />}
                        // onPress={() => ... mở flow OAuth}
                      >
                        {item.isConnected
                          ? "Quản lý liên kết"
                          : "Liên kết ngay"}
                      </Button>
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>

            {/* Hint / note */}
            <p className="text-xs text-default-400">
              Lưu ý: Khi liên kết tài khoản, một số dữ liệu (tên, email, avatar
              cơ bản) có thể được đồng bộ để tối ưu trải nghiệm đăng nhập và
              thông báo.
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
