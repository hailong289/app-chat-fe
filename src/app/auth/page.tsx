"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  Checkbox,
  Divider,
} from "@heroui/react";
import Image from "next/image";
import { InboxIcon, PhoneIcon } from '@heroicons/react/24/solid'
import { PayloadLogin } from "@/types/auth.type";
import { z } from "zod";
import useAuthStore from "@/store/useAuthStore";
import useToast from "@/hooks/useToast";
import { useRouter } from "next/navigation";

// Zod validation schema
const loginSchema = z.object({
  username: z.string()
    .min(1, "Tên đăng nhập không được để trống")
    .refine((username) => {
      // Kiểm tra email
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (emailPattern.test(username)) return true;

      // Kiểm tra số điện thoại Việt Nam
      const phonePattern = /^(\+84|84|0)(3|5|7|8|9)\d{8}$/;
      if (phonePattern.test(username.replace(/\s/g, ""))) return true;

      return false;
    }, "Vui lòng nhập email hợp lệ hoặc số điện thoại"),
  password: z.string().min(1, "Mật khẩu không được để trống"),
});

export default function LoginPage() {
  const [mounted, setMounted] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState<PayloadLogin>({
    username: '',
    password: ''
  });
  const router = useRouter();

  const { success, error: showError } = useToast();

  const { isLoading: loading, login } = useAuthStore(); // Replace with actual loading state from your auth store

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Validate field on blur
  const validateField = (field: keyof PayloadLogin, value: string) => {
    try {
      const partialSchema = loginSchema.pick({ [field]: true });
      partialSchema.parse({ [field]: value });
      setFieldErrors(prev => ({ ...prev, [field]: '' }));
    } catch (err) {
      if (err instanceof z.ZodError) {
        const errorMessage = err.issues[0]?.message || 'Dữ liệu không hợp lệ';
        setFieldErrors(prev => ({ ...prev, [field]: errorMessage }));
      }
    }
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    // Validate form with Zod
    try {
      const validatedData = loginSchema.parse(form);
      await login({
        ...validatedData, callback: (error) => {
          if (error) {
            console.error("Login failed:", error);
            showError(error.message || "Đăng nhập thất bại. Vui lòng thử lại.");
          } else {
            success("Đăng nhập thành công!");
            router.push("/"); // Redirect to home page after successful login
          }
        }
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Handle validation errors
        const errors: Record<string, string> = {};
        error.issues.forEach(err => {
          if (err.path[0]) {
            errors[err.path[0] as string] = err.message;
          }
        });
        setFieldErrors(errors);
      } else {
        console.error("Login error:", error);
        setError("Đăng nhập thất bại. Vui lòng kiểm tra thông tin và thử lại.");
      }
    }
  }

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return (
      <div className="min-h-dvh grid place-items-center bg-content bg-light">
        <Card className="w-full max-w-md">
          <CardHeader className="flex-col gap-1">
            <div className="w-[100px] h-[100px] bg-gray-200 animate-pulse rounded" />
            <div className="h-8 w-32 bg-gray-200 animate-pulse rounded" />
          </CardHeader>
          <CardBody>
            <div className="space-y-4">
              <div className="h-14 bg-gray-200 animate-pulse rounded" />
              <div className="h-14 bg-gray-200 animate-pulse rounded" />
              <div className="h-10 bg-gray-200 animate-pulse rounded" />
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-dvh grid place-items-center bg-content bg-light">
      <Card className="w-full max-w-md">
        <CardHeader className="flex-col gap-1">
          <Image
            src="/logo.png"
            alt="Logo"
            width={100}
            height={100}
            className="object-contain"
            priority
          />
          <h1 className="text-2xl font-semibold">Đăng nhập</h1>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="text"
              label="Email hoặc Số điện thoại"
              placeholder="Nhập email hoặc số điện thoại"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              onBlur={(e) => validateField('username', e.target.value)}
              isRequired
              isInvalid={!!fieldErrors.username}
              errorMessage={fieldErrors.username}
            />

            <Input
              type="password"
              label="Mật khẩu"
              placeholder="Nhập mật khẩu"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              onBlur={(e) => validateField('password', e.target.value)}
              isRequired
              isInvalid={!!fieldErrors.password}
              errorMessage={fieldErrors.password}
            />

            <div className="flex items-center justify-between">
              <Checkbox isSelected={remember} onValueChange={setRemember} color="success">
                Ghi nhớ tôi
              </Checkbox>
              <Link
                href="/auth/forgot"
                className="text-small hover:underline font-bold text-primary"
              >
                Quên mật khẩu?
              </Link>
            </div>

            {error && <p className="text-small text-danger">{error}</p>}

            {/* Toggle icon trên nút đăng nhập */}
            <div className="relative">
              {/* <div className="w-full flex justify-center items-center mb-4">
                <Button
                  type="button"
                  isIconOnly
                  size="sm"
                  variant="ghost"
                  className="min-w-8 w-8 h-8 p-1 bg-white shadow-md border border-gray-200 hover:bg-gray-50 rounded-full"
                  onClick={toggleLoginType}
                  title={`Chuyển sang đăng nhập bằng ${form.type === 'email' ? 'số điện thoại' : 'email'}`}
                >
                  {form.type === 'email' ? (
                    <PhoneIcon className="w-4 h-4 text-green-400" />
                  ) : (
                    <InboxIcon className="w-4 h-4 text-green-400" />
                  )}
                </Button>
              </div> */}
              <Button
                type="submit"
                isLoading={loading}
                className="w-full btn-primary"
                disabled={loading}
              >
                Đăng nhập
              </Button>
            </div>

            <Divider className="my-2" />

            <p className="text-small text-center">
              Chưa có tài khoản?{" "}
              <Link href="/auth/register" className="text-primary hover:underline">
                Đăng ký
              </Link>
            </p>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
