
"use client";
import { Card, CardBody, Button, Avatar, Form, Input } from '@heroui/react';
import { ArrowUpCircleIcon } from '@heroicons/react/24/outline';

export default function SettingsAccount() {
    return (
        <div className="bg-light h-screen w-full p-6">
            <div className="w-4/12 mx-auto">
                {/* Left side */}
                <div className="flex flex-col gap-6 md:col-span-1">
                    {/* Profile Card */}
                    <Card className="rounded-2xl">
                        <CardBody>
                            <div className="flex flex-col items-center py-6">
                                <Avatar src="https://avatar.iran.liara.run/public" size="lg" className="w-28 h-28 mb-2" />
                                <div className="text-2xl font-semibold text-primary mb-4">Lea</div>
                                <div className="flex gap-8 mt-2">
                                    <div className="flex flex-col items-center">
                                        <Button isIconOnly color='primary' className="mb-1">
                                            <ArrowUpCircleIcon className="w-6 h-6" />
                                        </Button>
                                        <span className="text-xs text-primary font-semibold">Cập nhật ảnh</span>
                                    </div>
                                </div>
                            </div>
                        </CardBody>
                    </Card>
                    <Card className="rounded-2xl">
                        <CardBody className="p-6">
                            <h2 className="text-xl font-semibold mb-4">Thông tin tài khoản</h2>
                            <Form>
                                <Input label="Tên đầy đủ" type="text" name="fullName" defaultValue="Lea" className="mb-4" />
                                <Input label="Email" type="email" name="email" defaultValue="lea@example.com" className="mb-4" />
                                <Input label="Số điện thoại" type="tel" name="phone" defaultValue="+1234567890" className="mb-4" />
                                <Input label="Địa chỉ" type="text" name="address" defaultValue="123 Main St, City, Country" className="mb-4" />
                                <Button type="submit" color="primary" className="w-full">Cập nhật thông tin</Button>
                            </Form>
                        </CardBody>
                    </Card>
                </div>
            </div>
        </div>
    );
}