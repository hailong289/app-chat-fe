"use client";
import useContactStore from "@/store/useContactStore";
import { useEffect } from "react";

export const InitApp = () => {
  const contactState = useContactStore((state) => state);
  useEffect(() => {
    contactState.getFriends();
    contactState.getAllContacts();
  }, []);
  return <></>;
};
