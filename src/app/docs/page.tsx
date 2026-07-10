// Public user guide (not under /admin, so middleware doesn't gate it — no
// auth here on purpose). Plain server component, no client JS needed.
import type { Metadata } from "next";
import Image from "next/image";
import styles from "./docs.module.css";

export const metadata: Metadata = {
  title: "User Guide — RPM Menu CMS",
  description: "How to use RPM Menu Manager: signing in, the public menu, and admin tools.",
};

type Section = {
  id: string;
  title: string;
  image: string;
  alt: string;
  steps: string[];
};

const sections: Section[] = [
  {
    id: "signing-in",
    title: "Signing in",
    image: "login.png",
    alt: "Sign-in screen with email and password fields",
    steps: [
      "Go to /login.",
      "Enter your email address and password.",
      "Click Sign In.",
      "Accounts are invite-only — there is no self-signup. Ask an admin if you need access.",
    ],
  },
  {
    id: "public-menu",
    title: "Browsing the public menu",
    image: "menu.png",
    alt: "Public menu page showing categories and items",
    steps: [
      "Visit /menu — no login needed.",
      "Use the search bar to find a specific item.",
      "Use the section navigation to jump between menu categories.",
    ],
  },
  {
    id: "managing-items",
    title: "Managing menu items",
    image: "admin-items.png",
    alt: "Admin items list with toggles, search, and bulk actions",
    steps: [
      "Go to /admin/items.",
      "Toggle an item on or off to show or hide it on the public menu.",
      "Click Edit on an item to change its price, description, or other details.",
      "Use search and filters to narrow the list, and bulk actions to update several items at once.",
      "Click + New Item to add a new item, and use the Active / Archived tabs to archive or restore items.",
    ],
  },
  {
    id: "categories-tags",
    title: "Categories & tags",
    image: "admin-categories.png",
    alt: "Categories and Tags tabs on the Items page",
    steps: [
      "From /admin/items, open the Categories tab to organize items into menu sections.",
      "Open the Tags tab to manage labels (like \"New\" or dietary tags) that can be applied to items.",
    ],
  },
  {
    id: "displays",
    title: "Displays & TV screens",
    image: "admin-displays.png",
    alt: "Admin displays page listing TV screens and schedules",
    steps: [
      "Go to /admin/displays to manage the TVs showing your menu.",
      "Create or edit a display and set up its scheduling.",
      "On the TV itself, open /display and pair it to link it to a display configuration.",
    ],
  },
  {
    id: "settings",
    title: "Settings",
    image: "admin-settings.png",
    alt: "Admin settings page with venue info, users, and audit log",
    steps: [
      "Go to /admin/settings.",
      "Manage venue info, user accounts, and API keys.",
      "Review the audit log to see recent changes.",
      "Adjust menu behavior settings as needed.",
    ],
  },
  {
    id: "branding",
    title: "Branding",
    image: "admin-branding.png",
    alt: "Admin branding settings page",
    steps: [
      "Go to /admin/settings/branding.",
      "Update logo, colors, or other branding details used across the menu and displays.",
    ],
  },
  {
    id: "qr-code",
    title: "QR code",
    image: "admin-qr.png",
    alt: "Admin QR code page for the public menu",
    steps: [
      "Go to /admin/settings/qr.",
      "Print or download the QR code shown.",
      "Place it on tables or signage — scanning it takes guests straight to your public menu.",
    ],
  },
];

export default function DocsPage() {
  return (
    <main className={styles.page} id="top">
      <header className={styles.header}>
        <h1 className={styles.title}>RPM Menu CMS — User Guide</h1>
        <p className={styles.intro}>
          A quick guide to signing in, browsing the public menu, and managing your menu, displays, and settings.
        </p>
      </header>

      <nav className={styles.toc} aria-label="Table of contents">
        <p className={styles.tocLabel}>Index</p>
        <ol className={styles.tocList}>
          {sections.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`}>{s.title}</a>
            </li>
          ))}
        </ol>
      </nav>

      {sections.map((s) => (
        <section key={s.id} id={s.id} className={styles.section}>
          <h2 className={styles.sectionTitle}>{s.title}</h2>
          <ol className={styles.steps}>
            {s.steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
          <div className={styles.imageWrap}>
            <Image
              src={`/docs/${s.image}`}
              alt={s.alt}
              width={1440}
              height={900}
              style={{ width: "100%", height: "auto" }}
              className={styles.image}
            />
          </div>
          <a href="#top" className={styles.backToTop}>
            Back to top
          </a>
        </section>
      ))}
    </main>
  );
}
