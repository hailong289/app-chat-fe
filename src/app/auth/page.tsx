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
import { InboxIcon, PhoneIcon } from "@heroicons/react/24/solid";
import { PayloadLogin } from "@/types/auth.type";
import useAuthStore from "@/store/useAuthStore";
import useToast from "@/hooks/useToast";
import { useRouter } from "next/navigation";
import Joi from "joi";
import { useFirebase } from "@/components/providers/firebase.provider";
import { useTranslation } from "react-i18next";

export default function LoginPage() {
  const { t } = useTranslation();
  const loginSchema = Joi.object({
    username: Joi.string()
      .required()
      .messages({
        "any.required": t("auth.validation.required"),
        "string.empty": t("auth.validation.required"),
      })
      .custom((value, helpers) => {
        // Kiểm tra email
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (emailPattern.test(value)) return value;
        // Kiểm tra số điện thoại Việt Nam
        const phonePattern = /^(\+84|84|0)(3|5|7|8|9)\d{8}$/;
        if (phonePattern.test(value.replace(/\s/g, ""))) return value;
        return helpers.message({
          custom: t("auth.validation.usernameInvalid"),
        });
      }),
    password: Joi.string()
      .required()
      .messages({
        "any.required": t("auth.validation.required"),
        "string.empty": t("auth.validation.required"),
      }),
    fcmToken: Joi.string().optional().allow(null),
  });

  const firebase = useFirebase();
  const [mounted, setMounted] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState<PayloadLogin>({
    username: "",
    password: "",
    fcmToken: null,
  });
  const router = useRouter();
  const { success, error: showError } = useToast();
  const { isLoading: loading, login } = useAuthStore(); // Replace with actual loading state from your auth store

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Set FCM token when available
  useEffect(() => {
    if (firebase.token) {
      setForm((prev) => ({ ...prev, fcmToken: firebase.token }));
    }
  }, [firebase.token]);

  // Validate field on blur
  const validateField = (field: keyof PayloadLogin, value: string) => {
    const fieldSchema = loginSchema.extract(field);
    const { error } = fieldSchema.validate(value);
    setFieldErrors((prev) => ({
      ...prev,
      [field]: error ? error.details[0].message : "",
    }));
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    // Validate form with Zod
    const { error, value } = loginSchema.validate(form, { abortEarly: false });
    if (error) {
      const errors: Record<string, string> = {};
      error.details.forEach((detail) => {
        const field = detail.path[0] as string;
        errors[field] = detail.message;
      });
      setFieldErrors(errors);
      return;
    }

    await login({
      ...value,
      callback: (error) => {
        if (error) {
          console.error("Login failed:", error);
          showError(error.message || t("auth.login.failed"));
        } else {
          success(t("auth.login.success"));
          // Land directly on the chat UI (the actual main interface)
          // instead of `/` (welcome screen). Users expect a chat app
          // to open into their conversation list, not a marketing
          // splash. The ClientLayout auth-guard also bounces /auth →
          // /chat for already-authed users — this keeps both paths
          // pointing at the same destination.
          router.push("/chat");
        }
      },
    });
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
          <h1 className="text-2xl font-semibold">{t("auth.login.title")}</h1>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="text"
              label={t("auth.login.usernamePlaceholder")}
              placeholder={t("auth.login.usernamePlaceholder")}
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              onBlur={(e) => validateField("username", e.target.value)}
              isRequired
              isInvalid={!!fieldErrors.username}
              errorMessage={fieldErrors.username}
            />

            <Input
              type="password"
              label={t("auth.login.passwordPlaceholder")}
              placeholder={t("auth.login.passwordPlaceholder")}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              onBlur={(e) => validateField("password", e.target.value)}
              isRequired
              isInvalid={!!fieldErrors.password}
              errorMessage={fieldErrors.password}
            />

            <div className="flex items-center justify-between">
              <Checkbox
                isSelected={remember}
                onValueChange={setRemember}
                color="secondary"
              >
                {t("auth.login.rememberMe")}
              </Checkbox>
              <Link
                href="/auth/forgot"
                className="text-small hover:underline font-bold text-primary"
              >
                {t("auth.login.forgotPassword")}
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
                className="w-full"
                disabled={loading}
                color="primary"
              >
                {t("auth.login.submit")}
              </Button>
            </div>

            <Divider className="my-2" />

            <p className="text-small text-center">
              {t("auth.login.noAccount")}{" "}
              <Link
                href="/auth/register"
                className="text-primary hover:underline"
              >
                {t("auth.login.registerNow")}
              </Link>
            </p>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
