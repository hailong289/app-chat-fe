"use client";

import Link from "next/link";
import { useState } from "react";
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

export default function LoginPage() {
  const [username, setUsername] = useState(""); // Email hoặc số điện thoại
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Helper functions để validate input
  const isEmail = (value: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  };

  const isPhoneNumber = (value: string) => {
    const phoneRegex = /^(\+84|84|0)[3578]\d{8}$/;
    return phoneRegex.test(value.replace(/\s/g, ""));
  };

  const validateUsername = (value: string) => {
    if (!value) return false;
    return isEmail(value) || isPhoneNumber(value);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!username || !password) {
      setError("Vui lòng nhập email/số điện thoại và mật khẩu.");
      return;
    }
    
    if (!validateUsername(username)) {
      setError("Vui lòng nhập email hợp lệ hoặc số điện thoại Việt Nam.");
      return;
    }
    try {
      setLoading(true);
      
      // Xác định loại đăng nhập
      const loginType = isEmail(username) ? "email" : "phone";
      console.log(`Đăng nhập bằng ${loginType}:`, username);
      
      // TODO: Replace with real API request
      // const response = await fetch('/api/auth/login', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ username, password, loginType })
      // });
      
      await new Promise((r) => setTimeout(r, 800));
      // Example redirect
      window.location.href = "/";
    } catch (error) {
      console.error("Login error:", error);
      setError("Đăng nhập thất bại. Vui lòng kiểm tra thông tin và thử lại.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh grid place-items-center bg-content">
      <Card className="w-full max-w-md">
        <CardHeader className="flex-col  gap-1">
         <Image
           src="/logo.ico"
           alt="Logo"
           width={100}
           height={100}
           className="object-contain"
         />
         <h1 className="text-2xl font-semibold">Đăng nhập</h1>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="text"
              label="Email hoặc Số điện thoại"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              isRequired
              description="Bạn có thể sử dụng email hoặc số điện thoại để đăng nhập"
            />
            <Input
              type="password"
              label="Mật khẩu"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              isRequired
            />

            <div className="flex items-center justify-between">
              <Checkbox isSelected={remember} onValueChange={setRemember}>
                Ghi nhớ tôi
              </Checkbox>
              <Link
                href="/forgot"
                className="text-small text-primary hover:underline"
              >
                Quên mật khẩu?
              </Link>
            </div>

            {error && <p className="text-small text-danger">{error}</p>}

            <Button
              color="primary"
              type="submit"
              isLoading={loading}
              className="w-full"
            >
              Đăng nhập
            </Button>

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
