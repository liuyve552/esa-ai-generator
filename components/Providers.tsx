"use client";

import { useEffect } from "react";
import { I18nextProvider } from "react-i18next";
import i18n from "@/lib/i18n/client";
import PwaRegister from "@/components/PwaRegister";

export default function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    void i18n.initPromise;
  }, []);

  return (
    <I18nextProvider i18n={i18n}>
      <PwaRegister />
      {children}
    </I18nextProvider>
  );
}

