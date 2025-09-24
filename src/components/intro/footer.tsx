"use client";

import { Button } from "@heroui/button";
import { Chip } from "@heroui/react";
import Link from "next/link";

export const Footer = () => {
  return (
    <footer id="contact" className="bg-foreground text-background py-12 mt-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h3 className="text-2xl font-bold mb-2">
          Bạn đã sẵn sàng để nâng tầm hiệu suất chưa?
        </h3>
        <p className="mb-6 opacity-80">
          Hãy liên hệ với chúng tôi để biết thêm chi tiết về sản phẩm.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <Button
            as={Link}
            href="mailto:contact@chatapp.com"
            color="secondary"
            size="md"
          >
            Liên hệ ngay
          </Button>
          <Button
            as={Link}
            href="#"
            variant="bordered"
            size="md"
            className="bg-background text-foreground"
          >
            Tìm hiểu thêm
          </Button>
        </div>
        <div className="mt-6">
          <Chip variant="flat" color="default">
            © {new Date().getFullYear()} ChatApp
          </Chip>
        </div>
      </div>
    </footer>
  );
};
