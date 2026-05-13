"use client";

import { ThemeProvider } from "next-themes";
import { NextIntlClientProvider } from "next-intl";
import { Toaster } from "sonner";

type Props = {
  children: React.ReactNode;
  locale: string;
  messages: Record<string, unknown>;
};

export function AppProviders({ children, locale, messages }: Props) {
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={messages}
      timeZone="Europe/Paris"
    >
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem
        disableTransitionOnChange
      >
        {children}
        <Toaster richColors position="top-center" closeButton />
      </ThemeProvider>
    </NextIntlClientProvider>
  );
}
