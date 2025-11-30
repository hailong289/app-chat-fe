"use client";

import { useSearchParams } from "next/navigation";
import ContactProfile from "@/components/contact/contact-profile";
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  if (!profileId || !contactState.contact) {
    return (
      <div className="flex items-center justify-center h-full bg-background">
        <p className="text-foreground-500 dark:text-foreground-400">
          Chọn một liên hệ để xem thông tin
        </p>
      </div>
    );
  }

  return <ContactProfile contact={contactState.contact} />;
}

export default function ContactPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-full bg-background">
          <p className="text-foreground-500 dark:text-foreground-400">
            Đang tải...
          </p>
        </div>
      }
    >
      <ContactPageContent />
    </Suspense>
  );
}
