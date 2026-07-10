// Shared admin shell (owned by foundation). Feature units add pages under
// src/app/admin/**/page.tsx — they never edit this file or AdminRail/
// admin-nav. Real session+role verification happens here (middleware.ts only
// does a cheap cookie-presence redirect).
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { AdminRail } from "@/components/nav/AdminRail";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login");
  }

  return (
    <AdminRail
      userName={session.user.name}
      userEmail={session.user.email}
      userRole={session.user.role}
    >
      {children}
    </AdminRail>
  );
}
