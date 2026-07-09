import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "RPM Menu Manager",
  description: "Menu CMS + TV display platform for RPM Pub.",
};

// App is dark-only, matching the RPM Pub Design System (see
// src/app/globals.css / src/styles/**).
export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" data-theme="dark">
      <body>{children}</body>
    </html>
  );
}
