"use client";

import { useEffect } from "react";
import { applyGuestCallTokenFromUrl } from "@/libs/guest-call-auth";
import { GuestNameModal } from "@/components/call/GuestNameModal";

export function GuestCallBootstrap() {
  useEffect(() => {
    applyGuestCallTokenFromUrl();
  }, []);
  return <GuestNameModal />;
}
