"use client";

import React from "react";
import { XMarkIcon, ArrowRightCircleIcon } from "@heroicons/react/24/outline";
import { Card, CardBody, Button, Tooltip } from "@heroui/react";
import { usePathname, useRouter } from "next/navigation";
import useCounterStore from "@/store/useCounterStore";

const Settings: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const isCollapsed = useCounterStore((state) => state.collapsedSidebar);

  const handleClose = () => {
    router.push(pathname || "/");
  };

  if (isCollapsed) {
    return (
      <Card className="w-full h-full shadow-none border-none rounded-none bg-background/80 text-foreground">
        <CardBody className="flex flex-col items-center gap-4 py-4">
          <Tooltip content="Cài đặt tài khoản" placement="right">
            <Button
              isIconOnly
              variant="light"
              onPress={() => router.push("/settings/account")}
            >
              <ArrowRightCircleIcon className="w-5 h-5" />
            </Button>
          </Tooltip>
          <Tooltip content="Cài đặt tin nhắn" placement="right">
            <Button
              isIconOnly
              variant="light"
              onPress={() => router.push("/settings/chat")}
            >
              <ArrowRightCircleIcon className="w-5 h-5" />
            </Button>
          </Tooltip>
          <Tooltip content="Tích hợp" placement="right">
            <Button
              isIconOnly
              variant="light"
              onPress={() => router.push("/settings/intergation")}
            >
              <ArrowRightCircleIcon className="w-5 h-5" />
            </Button>
          </Tooltip>
          <Tooltip content="Hỗ trợ" placement="right">
            <Button
              isIconOnly
              variant="light"
              onPress={() => router.push("/settings/support")}
            >
              <ArrowRightCircleIcon className="w-5 h-5" />
            </Button>
          </Tooltip>
          <Tooltip content="Đóng danh sách" placement="right">
            <Button
              isIconOnly
              variant="light"
              className="text-foreground-500"
              onPress={handleClose}
            >
              <XMarkIcon className="w-5 h-5" />
            </Button>
          </Tooltip>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="w-full h-full shadow-none border-none rounded-none bg-background text-foreground">
      <CardBody className="p-0 flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-default-200 bg-background">
          <div className="flex items-center">
            <div className="ml-1">
              <h2 className="text-lg font-semibold">Cài đặt</h2>
              <p className="text-sm text-foreground-500">
                Quản lý tài khoản và trải nghiệm chat của bạn
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              isIconOnly
              variant="light"
              className="text-foreground-500 hover:text-foreground hover:bg-default-100"
              onPress={handleClose}
            >
              <XMarkIcon className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 bg-background">
          {/* Cài đặt tài khoản */}
          <Card className="mb-0 shadow-none border-b border-default-200 rounded-none bg-background">
            <CardBody className="flex items-start justify-between px-4 py-4 flex-row">
              <div className="flex items-start gap-4 w-full">
                <div className="w-10/12 flex flex-col">
                  <span className="font-medium leading-tight">
                    Cài đặt tài khoản
                  </span>
                  <span className="text-sm text-foreground-500 leading-tight mt-1">
                    Cập nhật thông tin cá nhân và bảo mật
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    isIconOnly
                    variant="light"
                    className="text-foreground-500 hover:text-foreground hover:bg-default-100"
                    onPress={() => router.push("/settings/account")}
                  >
                    <ArrowRightCircleIcon className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Cài đặt tin nhắn */}
          <Card className="mb-0 shadow-none border-b border-default-200 rounded-none bg-background">
            <CardBody className="flex items-start justify-between px-4 py-4 flex-row">
              <div className="flex items-start gap-4 w-full">
                <div className="w-10/12 flex flex-col">
                  <span className="font-medium leading-tight">
                    Cài đặt tin nhắn
                  </span>
                  <span className="text-sm text-foreground-500 leading-tight mt-1">
                    Thiết lập thông báo, âm thanh, quyền riêng tư
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    isIconOnly
                    variant="light"
                    className="text-foreground-500 hover:text-foreground hover:bg-default-100"
                    onPress={() => router.push("/settings/chat")}
                  >
                    <ArrowRightCircleIcon className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Tích hợp */}
          <Card className="mb-0 shadow-none border-b border-default-200 rounded-none bg-background">
            <CardBody className="flex items-start justify-between px-4 py-4 flex-row">
              <div className="flex items-start gap-4 w-full">
                <div className="w-10/12 flex flex-col">
                  <span className="font-medium leading-tight">Tích hợp</span>
                  <span className="text-sm text-foreground-500 leading-tight mt-1">
                    Quản lý các dịch vụ và ứng dụng được kết nối
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    isIconOnly
                    variant="light"
                    className="text-foreground-500 hover:text-foreground hover:bg-default-100"
                    onPress={() => router.push("/settings/intergation")}
                  >
                    <ArrowRightCircleIcon className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Hỗ trợ */}
          <Card className="mb-0 shadow-none border-b border-default-200 rounded-none bg-background">
            <CardBody className="flex items-start justify-between px-4 py-4 flex-row">
              <div className="flex items-start gap-4 w-full">
                <div className="w-10/12 flex flex-col">
                  <span className="font-medium leading-tight">Hỗ trợ</span>
                  <span className="text-sm text-foreground-500 leading-tight mt-1">
                    Gửi phản hồi, báo lỗi hoặc cần trợ giúp
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    isIconOnly
                    variant="light"
                    className="text-foreground-500 hover:text-foreground hover:bg-default-100"
                    onPress={() => router.push("/settings/support")}
                  >
                    <ArrowRightCircleIcon className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      </CardBody>
    </Card>
  );
};

export default Settings;
