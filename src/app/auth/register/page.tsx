"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
import { PayloadRegister } from "@/types/auth.type";
import Helpers from "@/libs/helpers";
import useToast from "@/hooks/useToast";
import useAuthStore from "@/store/useAuthStore";
import { useRouter } from "next/navigation";
import Joi from "joi";
import { useFirebase } from "@/components/providers/firebase.provider";

const registerSchema = Joi.object({
  type: Joi.string().valid('email', 'phone').required().messages({
    'any.required': 'Loại đăng ký không được để trống',
    'string.empty': 'Loại đăng ký không được để trống',
    'any.only': 'Loại đăng ký không hợp lệ',
  }),
  fullname: Joi.string().required().messages({
    'any.required': 'Họ và tên không được để trống',
    'string.empty': 'Họ và tên không được để trống',
  }),
  username: Joi.string()
    .required()
    .custom((value, helpers) => {
      const type  = helpers.prefs.context?.type; // lấy type từ object cha

      if (type === "email") {
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailPattern.test(value)) {
          return helpers.error("string.email");
        }
      }

      if (type === "phone") {
        const phonePattern = /^(\+84|84|0)(3|5|7|8|9)\d{8}$/;
        if (!phonePattern.test(value.replace(/\s/g, ""))) {
          return helpers.error("string.pattern.base");
        }
      }

      return value;
    })
    .messages({
      "any.required": "Trường này không được để trống",
      "string.empty": "Trường này không được để trống",
      "string.email": "Vui lòng nhập email hợp lệ",
      "string.pattern.base": "Vui lòng nhập số điện thoại hợp lệ",
    }),
  password: Joi.string().min(6).required().messages({
    'any.required': 'Mật khẩu không được để trống',
    'string.empty': 'Mật khẩu không được để trống',
    'string.min': 'Mật khẩu phải có ít nhất 6 ký tự',
  }),
  confirm: Joi.string()
    .required()
    .custom((value, helpers) => {
      // Lấy password từ object cha (submit form)
      const root = helpers.state.ancestors?.[0] || {};
      const passwordFromRoot = root.password;

      // Lấy password từ context (validate field đơn lẻ)
      const passwordFromContext = helpers.prefs.context?.password;

      const password = passwordFromRoot ?? passwordFromContext;

      if (value !== password) {
        return helpers.error("any.only");
      }
      return value;
    })
    .messages({
      "any.required": "Xác nhận mật khẩu không được để trống",
      "string.empty": "Xác nhận mật khẩu không được để trống",
      "any.only": "Mật khẩu xác nhận không khớp",
    }),
  dateOfBirth: Joi.any(),
  gender: Joi.string().valid('male', 'female', 'other').required().messages({
    'any.required': 'Giới tính không được để trống',
    'string.empty': 'Giới tính không được để trống',
    'any.only': 'Giới tính không hợp lệ',
  }),
  fcmToken: Joi.string().optional().allow(null),
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
    fcmToken: null as string | null,
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const { success, error: showError } = useToast();
  const { isLoading, register } = useAuthStore();
  const router = useRouter();
  const firebase = useFirebase();

   useEffect(() => {
      if (firebase.token) {
        setForm((prev) => ({ ...prev, fcmToken: firebase.token }));
      }
    }, [firebase.token]);

  const validateField = (field: keyof PayloadRegister, value: string) => {
    const fieldSchema = registerSchema.extract(field);
    const { error } = fieldSchema.validate(value, { context: { type: form.type, password: form.password } });
    setFieldErrors((prev) => ({
      ...prev,
      [field]: error ? error.details[0].message : '',
    }));
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const { error, value: parsedData } = registerSchema.validate(form);
    console.log({ parsedData, error });
    if (error) {
      const errors: Record<string, string> = {};
      error.details.forEach((detail) => {
        const field = detail.path[0] as string;
        errors[field] = detail.message;
      });
      setFieldErrors(errors);
      return;
    }
    register({
      fullname: parsedData.fullname,
      username: parsedData.username,
      password: parsedData.password,
      confirm: parsedData.confirm,
      dateOfBirth: parsedData.dateOfBirth,
      gender: parsedData.gender as "male" | "female" | "other",
      type: parsedData.type,
      fcmToken: parsedData.fcmToken,
      callback: (err) => {
        if (err) {
          console.error("Registration failed:", err);
          showError(err.message || "Đăng ký thất bại. Vui lòng thử lại.");
        } else {
          success("Đăng ký thành công!");
          router.push("/"); // Redirect to home page after successful registration
        }
      }
    });
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
            color="primary"
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
