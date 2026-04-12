
"use client";
import { Card, CardBody, Button, Avatar, Form, Input, Textarea } from '@heroui/react';
import { ArrowUpCircleIcon } from '@heroicons/react/24/outline';

export default function SettingsSupport() {
    return (
        <div className="bg-light h-screen w-full p-6">
            <div className="w-12/12 mx-auto">
                {/* Left side */}
                <div className="flex flex-col gap-6 md:col-span-1">
                    <Card className="rounded-2xl">
                        <CardBody className="p-6">
                            <h2 className="text-xl font-semibold mb-4">Gửi hỗ trợ</h2>
                            <Form>
                                <Input label="Tiêu đề" type="text" name="title" className="mb-4" />
                                <Input label="Email liên hệ" type="email" name="email" className="mb-4" />
                                <Textarea label="Nội dung" type="text" name="content" className="mb-4" />
                               
                                <Button type="submit" color="primary" className="w-2/12 ml-auto">Gửi yêu cầu</Button>
                            </Form>
                        </CardBody>
                    </Card>
                </div>
            </div>
        </div>
    );
}