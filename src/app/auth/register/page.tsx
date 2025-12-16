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
  SelectItem,
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
import { useTranslation } from "react-i18next";

export default function RegisterPage() {
  const { t } = useTranslation();
  const registerSchema = Joi.object({
    type: Joi.string()
      .valid("email", "phone")
      .required()
      .messages({
        "any.required": t("auth.validation.required"),
        "string.empty": t("auth.validation.required"),
        "any.only": t("auth.validation.required"),
      }),
    fullname: Joi.string()
      .required()
      .messages({
        "any.required": t("auth.validation.required"),
        "string.empty": t("auth.validation.required"),
      }),
    username: Joi.string()
      .required()
      .custom((value, helpers) => {
        const type = helpers.prefs.context?.type; // lấy type từ object cha

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
        "any.required": t("auth.validation.required"),
        "string.empty": t("auth.validation.required"),
        "string.email": t("auth.validation.emailInvalid"),
        "string.pattern.base": t("auth.validation.phoneInvalid"),
      }),
    password: Joi.string()
      .min(6)
      .required()
      .messages({
        "any.required": t("auth.validation.required"),
        "string.empty": t("auth.validation.required"),
        "string.min": t("auth.validation.passwordMin"),
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
        "any.required": t("auth.validation.required"),
        "string.empty": t("auth.validation.required"),
        "any.only": t("auth.validation.passwordMatch"),
      }),
    dateOfBirth: Joi.any(),
    gender: Joi.string()
      .valid("male", "female", "other")
      .required()
      .messages({
        "any.required": t("auth.validation.required"),
        "string.empty": t("auth.validation.required"),
        "any.only": t("auth.validation.required"),
      }),
    fcmToken: Joi.string().optional().allow(null),
  });
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
    const { error } = fieldSchema.validate(value, {
      context: { type: form.type, password: form.password },
    });
    setFieldErrors((prev) => ({
      ...prev,
      [field]: error ? error.details[0].message : "",
    }));
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const { error, value: parsedData } = registerSchema.validate(form);
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
          showError(err.message || t("auth.register.failed"));
        } else {
          success(t("auth.register.success"));
          router.push("/"); // Redirect to home page after successful registration
        }
      },
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
          <h1 className="text-2xl font-semibold">{t("auth.register.title")}</h1>
        </CardHeader>
        <CardBody>
          <Tabs
            fullWidth
            selectedKey={form.type}
            size="md"
            onSelectionChange={(key) =>
              setForm({ ...form, type: key as "email" | "phone", username: "" })
            }
            color="primary"
          >
            <Tab key="email" title={t("auth.register.emailTab")}>
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  type="text"
                  label={t("auth.register.fullnamePlaceholder")}
                  placeholder={t("auth.register.fullnamePlaceholder")}
                  value={form.fullname}
                  onChange={(e) =>
                    setForm({ ...form, fullname: e.target.value })
                  }
                  onBlur={(e) => validateField("fullname", e.target.value)}
                  isRequired
                  errorMessage={fieldErrors.fullname}
                  isInvalid={!!fieldErrors.fullname}
                />

                <Input
                  type="email"
                  label={t("auth.register.emailPlaceholder")}
                  placeholder={t("auth.register.emailPlaceholder")}
                  value={form.username}
                  onChange={(e) =>
                    setForm({ ...form, username: e.target.value })
                  }
                  onBlur={(e) => validateField("username", e.target.value)}
                  isRequired
                  errorMessage={fieldErrors.username}
                  isInvalid={!!fieldErrors.username}
                />

                <Input
                  type="password"
                  label={t("auth.register.passwordPlaceholder")}
                  placeholder={t("auth.register.passwordPlaceholder")}
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                  onBlur={(e) => validateField("password", e.target.value)}
                  isRequired
                  isInvalid={!!fieldErrors.password}
                  errorMessage={fieldErrors.password}
                />
                <Input
                  type="password"
                  label={t("auth.register.confirmPasswordPlaceholder")}
                  placeholder={t("auth.register.confirmPasswordPlaceholder")}
                  value={form.confirm}
                  onChange={(e) =>
                    setForm({ ...form, confirm: e.target.value })
                  }
                  onBlur={(e) => validateField("confirm", e.target.value)}
                  isRequired
                  isInvalid={!!fieldErrors.confirm}
                  errorMessage={fieldErrors.confirm}
                />

                <DatePicker
                  label={t("auth.register.dobLabel")}
                  onChange={(date) => setForm({ ...form, dateOfBirth: date })}
                  defaultValue={Helpers.getDefaultDate()}
                  isRequired
                  errorMessage={fieldErrors.dateOfBirth}
                  isInvalid={!!fieldErrors.dateOfBirth}
                />

                <Select
                  className="w-full"
                  label={t("auth.register.genderLabel")}
                  defaultSelectedKeys={new Set([form.gender])}
                  errorMessage={fieldErrors.gender}
                  isInvalid={!!fieldErrors.gender}
                  onSelectionChange={(key) =>
                    setForm({
                      ...form,
                      gender: key.currentKey as "male" | "female" | "other",
                    })
                  }
                >
                  <SelectItem key="male">
                    {t("auth.register.genderMale")}
                  </SelectItem>
                  <SelectItem key="female">
                    {t("auth.register.genderFemale")}
                  </SelectItem>
                </Select>

                <div className="text-center my-3">
                  <Button
                    type="submit"
                    className="btn-primary"
                    fullWidth
                    disabled={isLoading}
                    isLoading={isLoading}
                  >
                    {t("auth.register.submit")}
                  </Button>
                </div>

                <p className="text-center text-sm">
                  {t("auth.register.hasAccount")}{" "}
                  <Link
                    href="/auth"
                    className="text-primary font-semibold hover:underline"
                  >
                    {t("auth.register.loginNow")}
                  </Link>
                </p>
              </form>
            </Tab>
            <Tab key="phone" title={t("auth.register.phoneTab")}>
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  type="text"
                  label={t("auth.register.fullnamePlaceholder")}
                  placeholder={t("auth.register.fullnamePlaceholder")}
                  value={form.fullname}
                  onChange={(e) =>
                    setForm({ ...form, fullname: e.target.value })
                  }
                  onBlur={(e) => validateField("fullname", e.target.value)}
                  isRequired
                  errorMessage={fieldErrors.fullname}
                  isInvalid={!!fieldErrors.fullname}
                />

                <Input
                  type="tel"
                  label={t("auth.register.phonePlaceholder")}
                  placeholder={t("auth.register.phonePlaceholder")}
                  value={form.username}
                  onChange={(e) =>
                    setForm({ ...form, username: e.target.value })
                  }
                  onBlur={(e) => validateField("username", e.target.value)}
                  isRequired
                  errorMessage={fieldErrors.username}
                  isInvalid={!!fieldErrors.username}
                />

                <Input
                  type="password"
                  label={t("auth.register.passwordPlaceholder")}
                  placeholder={t("auth.register.passwordPlaceholder")}
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                  onBlur={(e) => validateField("password", e.target.value)}
                  isRequired
                  errorMessage={fieldErrors.password}
                  isInvalid={!!fieldErrors.password}
                />
                <Input
                  type="password"
                  label={t("auth.register.confirmPasswordPlaceholder")}
                  placeholder={t("auth.register.confirmPasswordPlaceholder")}
                  value={form.confirm}
                  onChange={(e) =>
                    setForm({ ...form, confirm: e.target.value })
                  }
                  onBlur={(e) => validateField("confirm", e.target.value)}
                  isRequired
                  errorMessage={fieldErrors.confirm}
                  isInvalid={!!fieldErrors.confirm}
                />

                <DatePicker
                  label={t("auth.register.dobLabel")}
                  onChange={(date) => setForm({ ...form, dateOfBirth: date })}
                  defaultValue={Helpers.getDefaultDate()}
                  isRequired
                  errorMessage={fieldErrors.dateOfBirth}
                  isInvalid={!!fieldErrors.dateOfBirth}
                />

                <Select
                  className="w-full"
                  label={t("auth.register.genderLabel")}
                  defaultSelectedKeys={new Set([form.gender])}
                  onSelectionChange={(key) =>
                    setForm({
                      ...form,
                      gender: key.currentKey as "male" | "female" | "other",
                    })
                  }
                >
                  <SelectItem key="male">
                    {t("auth.register.genderMale")}
                  </SelectItem>
                  <SelectItem key="female">
                    {t("auth.register.genderFemale")}
                  </SelectItem>
                </Select>

                <div className="text-center my-3">
                  <Button
                    type="submit"
                    className="btn-primary"
                    fullWidth
                    disabled={isLoading}
                    isLoading={isLoading}
                  >
                    {t("auth.register.submit")}
                  </Button>
                </div>

                <p className="text-center text-sm">
                  {t("auth.register.hasAccount")}{" "}
                  <Link
                    href="/auth"
                    className="text-primary font-semibold hover:underline"
                  >
                    {t("auth.register.loginNow")}
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
