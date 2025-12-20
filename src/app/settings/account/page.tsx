"use client";

import {
  Card,
  CardBody,
  Button,
  Avatar,
  Input,
  Form,
  Select,
  SelectItem,
} from "@heroui/react";
import { ArrowUpCircleIcon } from "@heroicons/react/24/outline";
import useAuthStore from "@/store/useAuthStore";
import { useEffect, useState, useRef } from "react";
import UploadService from "@/service/uploadfile.service";
import useToast from "@/hooks/useToast";

export default function SettingsAccount() {
  const { user, updateProfile, updateAvatar, updatePassword, isLoading } =
    useAuthStore();
  const toast = useToast();
  const [formData, setFormData] = useState({
    fullname: "",
    email: "",
    phone: "",
    address: "",
    gender: "other",
    dateOfBirth: "",
  });
  const [passwordData, setPasswordData] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      setFormData({
        fullname: user.fullname || "",
        email: user.email || "",
        phone: user.phone || "",
        address: user.address || "",
        gender: user.gender || "other",
        dateOfBirth: user.dateOfBirth
          ? new Date(user.dateOfBirth).toISOString().split("T")[0]
          : "",
      });
    }
  }, [user]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPasswordData({ ...passwordData, [e.target.name]: e.target.value });
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error("Mật khẩu mới không khớp");
      return;
    }
    updatePassword({
      oldPassword: passwordData.oldPassword,
      newPassword: passwordData.newPassword,
      confirmPassword: passwordData.confirmPassword,
      callback: (error) => {
        if (error) {
          toast.error(error.message || "Đổi mật khẩu thất bại");
        } else {
          toast.success("Đổi mật khẩu thành công");
          setPasswordData({
            oldPassword: "",
            newPassword: "",
            confirmPassword: "",
          });
        }
      },
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullname || !formData.gender || !formData.dateOfBirth) {
      toast.error("Vui lòng điền đầy đủ thông tin");
      return;
    }
    updateProfile({
      fullname: formData.fullname,
      gender: formData.gender as "male" | "female" | "other",
      dateOfBirth: formData.dateOfBirth,
      callback: (error) => {
        if (error) {
          console.error(error);
          toast.error("Cập nhật thông tin thất bại");
        } else {
          toast.success("Cập nhật thông tin thành công");
        }
      },
    });
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      toast.info("Đang tải ảnh lên...");
      const response = await UploadService.uploadSingle(file, "avatar");
      // response.data is UploadSingleResp
      const avatarUrl = response.data.metadata?.url || response.data.url;

      updateAvatar({
        avatarUrl,
        callback: (error) => {
          if (error) {
            toast.error("Cập nhật ảnh đại diện thất bại");
          } else {
            toast.success("Cập nhật ảnh đại diện thành công");
          }
        },
      });
    } catch (error) {
      console.error(error);
      toast.error("Tải ảnh lên thất bại");
    }
  };

  return (
    <div className="bg-light min-h-screen w-full p-6 flex justify-center">
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* LEFT PROFILE CARD */}
        <Card className="rounded-2xl md:col-span-1 shadow-md">
          <CardBody>
            <div className="flex flex-col items-center py-6">
              <Avatar
                src={user?.avatar || "https://avatar.iran.liara.run/public"}
                className="w-28 h-28 mb-3"
              />

              <div className="text-2xl font-semibold text-primary">
                {user?.fullname || "User"}
              </div>

              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleFileChange}
              />

              <Button
                isIconOnly
                color="primary"
                variant="flat"
                className="mt-4"
                onPress={handleAvatarClick}
                isLoading={isLoading}
              >
                <ArrowUpCircleIcon className="w-6 h-6" />
              </Button>
              <span className="text-xs text-primary mt-2 font-semibold">
                Cập nhật ảnh
              </span>
            </div>
          </CardBody>
        </Card>

        {/* RIGHT COLUMN */}
        <div className="md:col-span-2 flex flex-col gap-6">
          {/* ACCOUNT INFO CARD */}
          <Card className="rounded-2xl shadow-md">
            <CardBody className="p-6">
              <h2 className="text-xl font-semibold mb-6">
                Thông tin tài khoản
              </h2>

              <Form className="flex flex-col gap-4" onSubmit={handleSubmit}>
                <Input
                  label="Tên đầy đủ"
                  name="fullname"
                  value={formData.fullname}
                  onChange={handleChange}
                  variant="bordered"
                />

                <Input
                  label="Email"
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  variant="bordered"
                  isReadOnly // Email usually shouldn't be changed easily
                />

                <Input
                  label="Số điện thoại"
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  variant="bordered"
                  isReadOnly
                />

                <div className="flex w-full gap-4">
                  <Select
                    label="Giới tính"
                    name="gender"
                    selectedKeys={[formData.gender]}
                    onChange={handleChange}
                    variant="bordered"
                  >
                    <SelectItem key="male">Nam</SelectItem>
                    <SelectItem key="female">Nữ</SelectItem>
                    <SelectItem key="other">Khác</SelectItem>
                  </Select>

                  <Input
                    label="Ngày sinh"
                    type="date"
                    name="dateOfBirth"
                    value={formData.dateOfBirth}
                    onChange={handleChange}
                    variant="bordered"
                    placeholder=" "
                  />
                </div>

                <Input
                  label="Địa chỉ"
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  variant="bordered"
                />

                <Button
                  type="submit"
                  color="primary"
                  className="w-full mt-2"
                  isLoading={isLoading}
                >
                  Cập nhật thông tin
                </Button>
              </Form>
            </CardBody>
          </Card>

          {/* CHANGE PASSWORD CARD */}
          <Card className="rounded-2xl shadow-md">
            <CardBody className="p-6">
              <h2 className="text-xl font-semibold mb-6">Đổi mật khẩu</h2>
              <Form
                className="flex flex-col gap-4"
                onSubmit={handlePasswordSubmit}
              >
                <Input
                  label="Mật khẩu hiện tại"
                  type="password"
                  name="oldPassword"
                  value={passwordData.oldPassword}
                  onChange={handlePasswordChange}
                  variant="bordered"
                  isRequired
                />
                <Input
                  label="Mật khẩu mới"
                  type="password"
                  name="newPassword"
                  value={passwordData.newPassword}
                  onChange={handlePasswordChange}
                  variant="bordered"
                  isRequired
                />
                <Input
                  label="Xác nhận mật khẩu mới"
                  type="password"
                  name="confirmPassword"
                  value={passwordData.confirmPassword}
                  onChange={handlePasswordChange}
                  variant="bordered"
                  isRequired
                />
                <Button
                  type="submit"
                  color="secondary"
                  className="w-full mt-2"
                  isLoading={isLoading}
                >
                  Đổi mật khẩu
                </Button>
              </Form>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
