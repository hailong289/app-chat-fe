
"use client";
import { Card, CardBody, Button, Form, Switch } from '@heroui/react';

export default function SettingsChat() {
    return (
        <div className="bg-light h-screen w-full p-6">
            <div className="w-12/12 mx-auto">
                {/* Left side */}
                <div className="flex flex-col gap-6 md:col-span-1">
                    {/* Profile Card */}
                    <Card className="rounded-2xl">
                        <CardBody className="p-6">
                            <h2 className="text-xl font-semibold mb-4">Cài đặt trò chuyện</h2>
                            <Form>
                               <Switch defaultSelected>Tự động backup</Switch>
                               <Switch defaultSelected>Tự động lưu tài liệu về máy</Switch>
                               <Switch defaultSelected>Hiển thị thông báo tin nhắn mới</Switch>
                               <Button color="danger" className="w-2/12 mt-4">Xóa tất cả dữ liệu tin nhắn</Button>
                            </Form>
                        </CardBody>
                    </Card>
                </div>
            </div>
        </div>
    );
}