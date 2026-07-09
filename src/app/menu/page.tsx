// Public web menu (PRD §3.4): single responsive page at the venue's
// domain/subdomain — categories, items, prices, descriptions, public-tag
// badges, and typed attributes, server-rendered and revalidated on menu
// mutation.
//
// Deliberately a plain `async` Server Component that reads the DB directly
// with no Next.js "Dynamic API" (no `cookies()`/`headers()`/`searchParams`)
// so the route stays statically cacheable ("Full Route Cache") — the ONLY
// thing that invalidates it is `bumpAffectedScreens`'s
// `revalidatePath("/menu")` (src/lib/service/base/bump-affected-screens.ts),
// fired by every admin-side mutation. That's the "ISR/revalidate-on-write"
// behavior docs/architecture.md and the PRD ask for: no time-based
// `revalidate` export here on purpose.
import { db } from "@/db";
import { getPublicMenu, buildMenuJsonLd } from "@/lib/menu/public-query";
import { MenuBoard } from "./MenuBoard";
import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function generateMetadata(): Promise<Metadata> {
  const data = await getPublicMenu(db);
  return {
    title: data.seo.title,
    description: data.seo.description ?? undefined,
    alternates: { canonical: "/menu" },
    openGraph: {
      title: data.seo.title,
      description: data.seo.description ?? undefined,
      type: "website",
      url: `${SITE_URL}/menu`,
    },
  };
}

export default async function PublicMenuPage() {
  const data = await getPublicMenu(db);
  const jsonLd = buildMenuJsonLd(data, `${SITE_URL}/menu`);

  return (
    <>
      {/* schema.org Menu markup (§3.4 SEO basics). Headings themselves come
          for free from @/components/ds: MenuSection -> <h2> per category,
          MenuItem -> <h3> per item title. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <MenuBoard data={data} />
    </>
  );
}
