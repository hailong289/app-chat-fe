"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  DatePicker,
  Input,
  InputOtp,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
} from "@heroui/react";
import Image from "next/image";
import {
  CalendarDate,
  CalendarDateTime,
  ZonedDateTime,
} from "@internationalized/date";
import Helpers from "@/libs/helpers";
import useToast from "@/hooks/useToast";
import useAuthStore from "@/store/useAuthStore";
import { useRouter } from "next/navigation";
import Joi from "joi";
import { useFirebase } from "@/components/providers/firebase.provider";
import { useTranslation } from "react-i18next";
import { getApiErrorMessage } from "@/utils/apiError";

const OTP_COUNTDOWN = 60;

const registerSchema = Joi.object({
  fullname: Joi.string().required().messages({
    "any.required": "Trường này không được để trống",
    "string.empty": "Trường này không được để trống",
  }),
  email: Joi.string()
    .email({ tlds: { allow: false } })
    .required()
    .messages({
      "any.required": "Trường này không được để trống",
      "string.empty": "Trường này không được để trống",
      "string.email": "Vui lòng nhập email hợp lệ",
    }),
  password: Joi.string().min(6).required().messages({
    "any.required": "Trường này không được để trống",
    "string.empty": "Trường này không được để trống",
    "string.min": "Mật khẩu phải có ít nhất 6 ký tự",
  }),
  confirm: Joi.string()
    .required()
    .valid(Joi.ref("password"))
    .messages({
      "any.required": "Trường này không được để trống",
      "string.empty": "Trường này không được để trống",
      "any.only": "Mật khẩu xác nhận không khớp",
    }),
  gender: Joi.string().valid("male", "female", "other").required().messages({
    "any.required": "Trường này không được để trống",
    "any.only": "Trường này không được để trống",
  }),
  dateOfBirth: Joi.any(),
  fcmToken: Joi.string().optional().allow(null),
});

export default function RegisterPage() {
  const { t } = useTranslation();
  const firebase = useFirebase();
  const router = useRouter();
  const { success, error: showError } = useToast();
  const { isLoading, sendOtp, verifyOtp, register } = useAuthStore();

  const [form, setForm] = useState({
    fullname: "",
    email: "",
    password: "",
    confirm: "",
    gender: "male" as "male" | "female" | "other",
    dateOfBirth: Helpers.getDefaultDate() as
      | CalendarDate
      | CalendarDateTime
      | ZonedDateTime
      | null,
    fcmToken: null as string | null,
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // OTP modal state
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState("");
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pending form data (held while OTP modal is open)
  const pendingFormRef = useRef<typeof form | null>(null);

  useEffect(() => {
    if (firebase.token) {
      setForm((prev) => ({ ...prev, fcmToken: firebase.token }));
    }
  }, [firebase.token]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function startCountdown() {
    setCountdown(OTP_COUNTDOWN);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  function validateField(field: string, value: any) {
    if (field === "confirm") {
      const { error } = Joi.string()
        .required()
        .valid(form.password)
        .messages({
          "any.required": "Trường này không được để trống",
          "string.empty": "Trường này không được để trống",
          "any.only": "Mật khẩu xác nhận không khớp",
        })
        .validate(value);
      setFieldErrors((prev) => ({
        ...prev,
        confirm: error ? error.details[0].message : "",
      }));
      return;
    }

    const fieldSchema = registerSchema.extract(field);
    const { error } = fieldSchema.validate(value);
    setFieldErrors((prev) => ({
      ...prev,
      [field]: error ? error.details[0].message : "",
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const { error, value: parsed } = registerSchema.validate(form, {
      abortEarly: false,
    });
    if (error) {
      const errs: Record<string, string> = {};
      error.details.forEach((d) => {
        errs[d.path[0] as string] = d.message;
      });
      setFieldErrors(errs);
      return;
    }
    // Save form data and send OTP
    pendingFormRef.current = parsed;
    sendOtp({
      email: parsed.email,
      type: "register",
      callback: (err) => {
        if (err) {
          showError(
            getApiErrorMessage(err, t("auth.register.otpSendFailed")),
          );
        } else {
          success(t("auth.register.otpSent"));
          setOtp("");
          setOtpError("");
          setOtpModalOpen(true);
          startCountdown();
        }
      },
    });
  }

  function handleResendOtp() {
    if (countdown > 0 || isLoading || !pendingFormRef.current) return;
    sendOtp({
      email: pendingFormRef.current.email,
      type: "register",
      callback: (err) => {
        if (err) {
          showError(
            getApiErrorMessage(err, t("auth.register.otpSendFailed")),
          );
        } else {
          success(t("auth.register.otpSent"));
          startCountdown();
        }
      },
    });
  }

  function handleOtpConfirm() {
    if (otp.length !== 6) {
      setOtpError(t("auth.register.otpLength"));
      return;
    }
    if (!pendingFormRef.current) return;
    const saved = pendingFormRef.current;

    verifyOtp({
      indicator: saved.email,
      otp,
      type: "register",
      callback: (result, err) => {
        if (err) {
          setOtpError(
            getApiErrorMessage(err, t("auth.register.otpInvalid")),
          );
          return;
        }
        const tempRegisterToken = result?.tempRegisterToken;
        const isVerified = !!result?.valid || !!tempRegisterToken;
        if (!isVerified) {
          setOtpError(t("auth.register.otpInvalid"));
          return;
        }

        // Immediately register with the token
        const dateOfBirth =
          saved.dateOfBirth instanceof CalendarDate ||
          saved.dateOfBirth instanceof CalendarDateTime ||
          saved.dateOfBirth instanceof ZonedDateTime
            ? `${(saved.dateOfBirth as CalendarDate).year}-${String(
                (saved.dateOfBirth as CalendarDate).month,
              ).padStart(2, "0")}-${String(
                (saved.dateOfBirth as CalendarDate).day,
              ).padStart(2, "0")}`
            : "";

        setOtpModalOpen(false);
        register({
          fullname: saved.fullname,
          email: saved.email,
          type: "email",
          phone: "",
          tempRegisterToken,
          password: saved.password,
          gender: saved.gender,
          dateOfBirth,
          fcmToken: saved.fcmToken,
          callback: (regErr) => {
            if (regErr) {
              const msg = getApiErrorMessage(regErr, t("auth.register.failed"));
              if (msg.includes("hết hạn") || msg.includes("expired")) {
                showError(t("auth.register.tokenExpired"));
              } else {
                showError(msg);
              }
            } else {
              success(t("auth.register.success"));
              router.push("/chat");
            }
          },
        });
      },
    });
  }

  return (
    <div className="min-h-dvh grid place-items-center bg-content">
      <Card className="w-full max-w-md">
        <CardHeader className="flex-col gap-1">
          <Image
            src="/logo.png"
            alt="Logo"
            width={100}
            height={100}
            className="object-contain"
          />
          <h1 className="text-2xl font-semibold">
            {t("auth.register.title")}
          </h1>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="text"
              label={t("auth.register.fullnamePlaceholder")}
              placeholder={t("auth.register.fullnamePlaceholder")}
              value={form.fullname}
              onChange={(e) => setForm({ ...form, fullname: e.target.value })}
              onBlur={(e) => validateField("fullname", e.target.value)}
              isRequired
              isInvalid={!!fieldErrors.fullname}
              errorMessage={fieldErrors.fullname}
            />

            <Input
              type="email"
              label={t("auth.login.emailPlaceholder")}
              placeholder={t("auth.login.emailPlaceholder")}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              onBlur={(e) => validateField("email", e.target.value)}
              isRequired
              isInvalid={!!fieldErrors.email}
              errorMessage={fieldErrors.email}
            />

            <Input
              type="password"
              label={t("auth.register.passwordPlaceholder")}
              placeholder={t("auth.register.passwordPlaceholder")}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
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
              onChange={(e) => setForm({ ...form, confirm: e.target.value })}
              onBlur={(e) => validateField("confirm", e.target.value)}
              isRequired
              isInvalid={!!fieldErrors.confirm}
              errorMessage={fieldErrors.confirm}
            />

            <DatePicker
              label={t("auth.register.dobLabel")}
              onChange={(date) => setForm({ ...form, dateOfBirth: date })}
              defaultValue={Helpers.getDefaultDate() as any}
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

            <Button
              type="submit"
              className="w-full"
              color="primary"
              isLoading={isLoading}
              disabled={isLoading}
            >
              {t("auth.register.submit")}
            </Button>

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
        </CardBody>
      </Card>

      {/* OTP Modal */}
      <Modal
        isOpen={otpModalOpen}
        onClose={() => setOtpModalOpen(false)}
        size="sm"
        isDismissable={false}
      >
        <ModalContent>
          {() => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                {t("auth.register.otpTitle")}
              </ModalHeader>
              <ModalBody className="flex flex-col items-center gap-3 pb-4">
                <p className="text-sm text-default-500 text-center">
                  {t("auth.register.otpHint", {
                    email: pendingFormRef.current?.email ?? "",
                  })}
                </p>
                <InputOtp
                  length={6}
                  value={otp}
                  onValueChange={(v) => {
                    setOtp(v);
                    setOtpError("");
                  }}
                  isInvalid={!!otpError}
                  errorMessage={otpError}
                  autoFocus
                />
                <div className="text-sm text-default-500">
                  {countdown > 0 ? (
                    <span>
                      {t("auth.register.resendIn", { seconds: countdown })}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={isLoading}
                      className="text-primary hover:underline disabled:opacity-50"
                    >
                      {t("auth.register.resendOtp")}
                    </button>
                  )}
                </div>
              </ModalBody>
              <ModalFooter>
                <Button
                  variant="flat"
                  onPress={() => setOtpModalOpen(false)}
                  disabled={isLoading}
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  color="primary"
                  onPress={handleOtpConfirm}
                  isLoading={isLoading}
                  disabled={isLoading}
                >
                  {t("common.confirm")}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
