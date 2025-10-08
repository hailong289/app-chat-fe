"use client";
import ForgotPasswordModal from "@/components/modals/forgot.modal";
import useToast from "@/hooks/useToast";
import useAuthStore from "@/store/useAuthStore";
import { Button, Card, CardBody, CardHeader, Image, Input } from "@heroui/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";



export default function ForgotPasswordPage() {
    const [form, setForm] = useState({
        email: "",
        username: "",
        newPassword: "",
        confirmPassword: "",
    });
    const { forgotPassword, resetPassword } = useAuthStore();
    const { error: showError, success: showSuccess } = useToast();
    const router = useRouter();
    const queryParams = useSearchParams();
    const token = queryParams.get("token") || "";
    const handleForgotPassword = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (token) {
            // Handle reset password
            if (form.newPassword !== form.confirmPassword) {
                showError("Mật khẩu xác nhận không khớp.");
                return;
            }
            resetPassword({
                token,
                newPassword: form.newPassword,
                confirmPassword: form.confirmPassword,
                callback: (error) => {
                    if (error) {
                        console.error("Reset password error:", error);
                        showError(error?.message || "Đã có lỗi xảy ra. Vui lòng thử lại.");
                    } else {
                        showSuccess("Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.");
                        router.push('/auth');
                        
                    }
                }
            });
            return;
        }

        forgotPassword({
            email: form.email,
            username: form.username,
            callback: (error) => {
                if (error) {
                    console.error("Forgot password error:", error);
                    showError(error?.message || "Đã có lỗi xảy ra. Vui lòng thử lại.");
                } else {
                    showSuccess("Yêu cầu đặt lại mật khẩu đã gửi đến bạn. Vui lòng kiểm tra email của bạn.");
                    setForm({ ...form, email: "", username: "" });
                }
            }
        });
    }

    return (
        <div className="min-h-dvh grid place-items-center bg-content">
            <Card className="w-full max-w-md">
                <CardHeader className="flex-col  gap-1">
                    <h1 className="text-2xl font-semibold">
                        {token ? "Đặt lại mật khẩu" : "Quên mật khẩu"}
                    </h1>
                </CardHeader>
                <CardBody>
                    <form className="space-y-4" onSubmit={handleForgotPassword}>
                        {/* Form fields for email or phone number */}
                        {token ? (
                            <>
                                <Input
                                    type="password"
                                    label="Mật khẩu mới"
                                    placeholder="Nhập mật khẩu mới"
                                    isRequired
                                    value={form.newPassword}
                                    onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
                                />
                                <Input
                                    type="password"
                                    label="Xác nhận mật khẩu"
                                    placeholder="Xác nhận mật khẩu"
                                    isRequired
                                    value={form.confirmPassword}
                                    onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                                />
                            </>
                        ) : (
                            <>
                                <Input
                                    type="text"
                                    label="Email"
                                    placeholder="Nhập email"
                                    isRequired
                                    value={form.email}
                                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                                />
                                <Input
                                    type="text"
                                    label="Tên đăng nhập"
                                    placeholder="Nhập tên đăng nhập"
                                    isRequired
                                    value={form.username}
                                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                                />
                            </>
                        )}

                        <div className="text-center my-3">
                            {token ? (
                                <>
                                    <Button type="submit" className="btn-primary mb-2" fullWidth>
                                        Đặt lại mật khẩu
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <Button type="submit" className="btn-primary mb-2" fullWidth>
                                        Gửi Yêu Cầu
                                    </Button>
                                    <Link href="/auth" className="text-small hover:underline font-bold text-primary">
                                        Trở lại
                                    </Link>
                                </>
                            )}
                        </div>
                    </form>
                </CardBody>
            </Card>
        </div>
    );
}