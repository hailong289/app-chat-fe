"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  Tabs,
  Tab,
  DatePicker,
  Select,
  SelectItem
} from "@heroui/react";
import Image from "next/image";
import { CalendarDate } from "@internationalized/date";
import z from "zod";
import { PayloadRegister } from "@/types/auth.type";
import Helpers from "@/libs/helpers";
import useToast from "@/hooks/useToast";
import useAuthStore from "@/store/useAuthStore";
import { useRouter } from "next/navigation";


const registerSchema = z.object({
  fullname: z.string().min(1, "Họ và tên không được để trống"),
  username: z.string().min(1, "Tên đăng nhập không được để trống"),
  password: z.string().min(6, "Mật khẩu phải có ít nhất 6 ký tự").nonempty('Mật khẩu không được để trống'),
  confirm: z.string().min(6, "Mật khẩu phải có ít nhất 6 ký tự").nonempty('Xác nhận mật khẩu không được để trống'),
  dateOfBirth: z.any(),
  gender: z.string().nonempty('Giới tính không được để trống'),
  type: z.enum(["email", "phone"]),
})
  .refine((data) => data.password === data.confirm, { message: "Mật khẩu xác nhận không khớp", path: ["confirm"] })
  .refine((data) => {
    if (data.type === "email") {
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      console.log(emailRegex.test(data.username));
      return emailRegex.test(data.username);
    }
    return true;
  }, {
    message: "Email không hợp lệ",
    path: ["username"],
  }).refine((data) => {
    if (data.type === "phone") {
      const phoneRegex = /^(\+84|84|0)(3|5|7|8|9)\d{8}$/;
      return phoneRegex.test(data.username.replace(/\s/g, ""));
    }
    return true;
  }, {
    message: "Số điện thoại không hợp lệ",
    path: ["username"],
  });

export default function RegisterPage() {
  const [form, setForm] = useState({
    fullname: "",
    username: "",
    password: "",
    confirm: "",
    gender: "male" as "male" | "female" | "other",
    dateOfBirth: Helpers.getDefaultDate() as CalendarDate | null,
    type: "email" as "email" | "phone",
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const { success, error } = useToast();
  const { isLoading, register } = useAuthStore();
  const router = useRouter();

  const validateField = (field: keyof PayloadRegister, value: string) => {
    try {
      const partialSchema = registerSchema.pick({ [field]: true });
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
    try {
      const parsedData = registerSchema.parse({
        ...form,
        dateOfBirth: form.dateOfBirth ? new Date(form.dateOfBirth.toString()) : undefined,
      });

      register({
        fullname: parsedData.fullname,
        username: parsedData.username,
        password: parsedData.password,
        confirm: parsedData.confirm,
        dateOfBirth: parsedData.dateOfBirth,
        gender: parsedData.gender as "male" | "female" | "other",
        type: parsedData.type,
        callback: (err) => {
          if (err) {
            console.error("Registration failed:", err);
            error(err.message || "Đăng ký thất bại. Vui lòng thử lại.");
          } else {
            success("Đăng ký thành công!");
            router.push("/"); // Redirect to home page after successful registration
          }
        }
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors: Record<string, string> = {};
        error.issues.forEach((err) => {
          if (err.path[0]) {
            errors[err.path[0] as string] = err.message;
          }
        });
        setFieldErrors(errors);
      }
    }
  }

  return (
    <div className="min-h-dvh grid place-items-center bg-content">
      <Card className="w-full max-w-md">
        <CardHeader className="flex-col  gap-1">
          <Image
            src="/logo.png"
            alt="Logo"
            width={100}
            height={100}
            className="object-contain"
          />
          <h1 className="text-2xl font-semibold">Đăng Ký</h1>
        </CardHeader>
        <CardBody>
          <Tabs
            fullWidth
            selectedKey={form.type}
            size="md"
            onSelectionChange={(key) => setForm({ ...form, type: key as 'email' | 'phone', username: '' })}
            color="success"
          >
            <Tab key="email" title="Email">
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  type="text"
                  label="Họ và tên"
                  placeholder="Nguyễn Văn A"
                  value={form.fullname}
                  onChange={(e) => setForm({ ...form, fullname: e.target.value })}
                  onBlur={(e) => validateField('fullname', e.target.value)}
                  isRequired
                  errorMessage={fieldErrors.fullname}
                  isInvalid={!!fieldErrors.fullname}
                />

                <Input
                  type="email"
                  label="Email"
                  placeholder="you@example.com"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  onBlur={(e) => validateField('username', e.target.value)}
                  isRequired
                  errorMessage={fieldErrors.username}
                  isInvalid={!!fieldErrors.username}
                />


                <Input
                  type="password"
                  label="Mật khẩu"
                  placeholder="Tối thiểu 8 ký tự"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  onBlur={(e) => validateField('password', e.target.value)}
                  isRequired
                  isInvalid={!!fieldErrors.password}
                  errorMessage={fieldErrors.password}
                />
                <Input
                  type="password"
                  label="Xác nhận mật khẩu"
                  placeholder="Nhập lại mật khẩu"
                  value={form.confirm}
                  onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                  onBlur={(e) => validateField('confirm', e.target.value)}
                  isRequired
                  isInvalid={!!fieldErrors.confirm}
                  errorMessage={fieldErrors.confirm}
                />

                <DatePicker
                  label="Ngày sinh"
                  onChange={(date) => setForm({ ...form, dateOfBirth: date })}
                  defaultValue={Helpers.getDefaultDate()}
                  isRequired
                  errorMessage={fieldErrors.dateOfBirth}
                  isInvalid={!!fieldErrors.dateOfBirth}
                />

                <Select
                  className="w-full"
                  label="Chọn giới tính"
                  defaultSelectedKeys={new Set([form.gender])}
                  errorMessage={fieldErrors.gender}
                  isInvalid={!!fieldErrors.gender}
                  onSelectionChange={(key) => setForm({ ...form, gender: key.currentKey as "male" | "female" | "other" })}
                >
                  <SelectItem key="male">Nam</SelectItem>
                  <SelectItem key="female">Nữ</SelectItem>
                </Select>


                <div className="text-center my-3">
                  <Button type="submit" className="btn-primary" fullWidth disabled={isLoading} isLoading={isLoading}>
                    Đăng Ký
                  </Button>
                </div>

                <p className="text-center text-sm">
                  Bạn đã có tài khoản?{" "}
                  <Link href="/auth" className="text-primary font-semibold hover:underline">
                    Đăng nhập
                  </Link>
                </p>
              </form>
            </Tab>
            <Tab key="phone" title="Số điện thoại">
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  type="text"
                  label="Họ và tên"
                  placeholder="Nguyễn Văn A"
                  value={form.fullname}
                  onChange={(e) => setForm({ ...form, fullname: e.target.value })}
                  onBlur={(e) => validateField('fullname', e.target.value)}
                  isRequired
                  errorMessage={fieldErrors.fullname}
                  isInvalid={!!fieldErrors.fullname}
                />

                <Input
                  type="tel"
                  label="Số điện thoại"
                  placeholder="0901234567"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  onBlur={(e) => validateField('username', e.target.value)}
                  isRequired
                  errorMessage={fieldErrors.username}
                  isInvalid={!!fieldErrors.username}
                />

                <Input
                  type="password"
                  label="Mật khẩu"
                  placeholder="Tối thiểu 8 ký tự"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  onBlur={(e) => validateField('password', e.target.value)}
                  isRequired
                  errorMessage={fieldErrors.password}
                  isInvalid={!!fieldErrors.password}
                />
                <Input
                  type="password"
                  label="Xác nhận mật khẩu"
                  placeholder="Nhập lại mật khẩu"
                  value={form.confirm}
                  onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                  onBlur={(e) => validateField('confirm', e.target.value)}
                  isRequired
                  errorMessage={fieldErrors.confirm}
                  isInvalid={!!fieldErrors.confirm}
                />

                <DatePicker
                  label="Ngày sinh"
                  onChange={(date) => setForm({ ...form, dateOfBirth: date })}
                  defaultValue={Helpers.getDefaultDate()}
                  isRequired
                  errorMessage={fieldErrors.dateOfBirth}
                  isInvalid={!!fieldErrors.dateOfBirth}
                />

                <Select
                  className="w-full" label="Chọn giới tính"
                  defaultSelectedKeys={new Set([form.gender])}
                  onSelectionChange={(key) => setForm({ ...form, gender: key.currentKey as "male" | "female" | "other" })}
                >
                  <SelectItem key="male">Nam</SelectItem>
                  <SelectItem key="female">Nữ</SelectItem>
                </Select>


                <div className="text-center my-3">
                  <Button type="submit" className="btn-primary" fullWidth disabled={isLoading} isLoading={isLoading}>
                    Đăng Ký
                  </Button>
                </div>

                <p className="text-center text-sm">
                  Bạn đã có tài khoản?{" "}
                  <Link href="/auth" className="text-primary font-semibold hover:underline">
                    Đăng nhập
                  </Link>
                </p>
              </form>
            </Tab>
          </Tabs>
        </CardBody>
      </Card>
    </div>
  );
}
