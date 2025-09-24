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
} from "@heroui/react";
import Image from "next/image";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [agree, setAgree] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function validate(): string | null {
    if (!name.trim()) return "Vui lòng nhập họ tên.";
    if (!email.includes("@")) return "Email không hợp lệ.";
    if (password.length < 8) return "Mật khẩu tối thiểu 8 ký tự.";
    if (password !== confirm) return "Mật khẩu xác nhận không khớp.";
    if (!agree) return "Bạn cần đồng ý với Điều khoản & Chính sách.";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validate();
    if (err) {
      setError(err);
      return;
    }

    try {
      setError(null);
      setLoading(true);
      // TODO: Replace with real API request
      await new Promise((r) => setTimeout(r, 800));
      window.location.href = "/home";
    } catch (e) {
      setError("Đăng ký thất bại. Vui lòng thử lại.");
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
                  <h1 className="text-2xl font-semibold">Đăng Ký</h1>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="text"
              label="Họ và tên"
              placeholder="Nguyễn Văn A"
              value={name}
              onChange={(e) => setName(e.target.value)}
              isRequired
            />
            <Input
              type="email"
              label="Email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              isRequired
            />
            <Input
              type="password"
              label="Mật khẩu"
              placeholder="Tối thiểu 8 ký tự"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              isRequired
            />
            <Input
              type="password"
              label="Xác nhận mật khẩu"
              placeholder="Nhập lại mật khẩu"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              isRequired
            />

            <Checkbox isSelected={agree} onValueChange={setAgree}>
              Tôi đồng ý với{" "}
              <Link href="/terms" className="text-primary hover:underline">
                Điều khoản
              </Link>{" "}
              &{" "}
              <Link href="/privacy" className="text-primary hover:underline">
                Chính sách
              </Link>
            </Checkbox>

            {error && <p className="text-small text-danger">{error}</p>}

            <Button
              color="primary"
              type="submit"
              isLoading={loading}
              className="w-full"
            >
              Đăng ký
            </Button>

            <p className="text-small text-center mt-1">
              Đã có tài khoản?{" "}
              <Link href="/auth/login" className="text-primary hover:underline">
                Đăng nhập
              </Link>
            </p>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
