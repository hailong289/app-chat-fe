"use client";
import { useSearchParams } from "next/navigation";
import ContactProfile from "@/components/contact/contact-profile";
import { ContactType } from "@/store/types/contact.type";
import { useEffect, Suspense } from "react";
import useContactStore from "@/store/useContactStore";

function ContactPageContent() {
  const searchParams = useSearchParams();
  const profileId = searchParams.get("profileId");
  const contactState = useContactStore((state) => state);
  useEffect(() => {
    if (profileId) {
      contactState.setContact(profileId);
    }
  }, [profileId]);
  // Mock data - sau này thay bằng fetch từ API hoặc store

  if (!profileId || !contactState.contact) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <p className="text-gray-500">Chọn một liên hệ để xem thông tin</p>
      </div>
    );
  }

  return <ContactProfile contact={contactState.contact} />;
}

export default function ContactPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-full bg-gray-50">
          <p className="text-gray-500">Đang tải...</p>
        </div>
      }
    >
      <ContactPageContent />
    </Suspense>
  );
}
