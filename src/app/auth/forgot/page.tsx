"use client";
import ForgotPasswordModal from "@/components/modals/forgot.modal";
import { Button, Card, CardBody, CardHeader, Image, Input } from "@heroui/react";
import Link from "next/link";
import { useState } from "react";



export default function ForgotPasswordPage() {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div className="min-h-dvh grid place-items-center bg-content">
            <Card className="w-full max-w-md">
                <CardHeader className="flex-col  gap-1">
                    <h1 className="text-2xl font-semibold">Quên Mật Khẩu</h1>
                </CardHeader>
                <CardBody>
                    <form className="space-y-4">
                        {/* Form fields for email or phone number */}
                        <Input
                            type="text"
                            label="Email"
                            placeholder="Nhập email"
                            isRequired
                        />
                        <Input
                            type="text"
                            label="Tên đăng nhập"
                            placeholder="Nhập tên đăng nhập"
                            isRequired
                        />
                        <div className="text-center my-3">
                            <Button type="submit" className="btn-primary mb-2" fullWidth onPress={() => setIsOpen(true)}>
                                Gửi Yêu Cầu
                            </Button>
                            <Link href="/auth" className="text-small hover:underline font-bold text-primary">
                                Trở lại
                            </Link>
                        </div>
                    </form>
                </CardBody>
            </Card>
            <ForgotPasswordModal
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                onAccept={() => setIsOpen(false)}
            />
        </div>
    );
}