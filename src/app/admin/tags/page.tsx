// Tags admin (PRD §3.1 "Tags"): CRUD with public/private visibility, an
// optional icon + color for public badges. Tag *definitions* (incl.
// visibility) are owner-managed per §3.1 ("editable by owner") — the
// service layer enforces this; staff see a read-only list plus a note about
// who to ask, rather than controls that would just 403.
import { getCurrentSession } from "@/lib/auth/session";
import { listTags } from "@/lib/service/tags";
import { db } from "@/db";
import { TagsManager } from "./TagsManager";

export default async function TagsPage() {
  const session = await getCurrentSession();
  const tags = await listTags(db);
  const isOwner = session?.user.role === "owner";

  return (
    <div>
      <h1
        style={{
          fontFamily: "var(--font-display)",
          textTransform: "uppercase",
          color: "var(--accent-primary)",
          fontSize: "var(--fs-h3)",
          margin: 0,
        }}
      >
        Tags
      </h1>
      <p style={{ color: "var(--text-muted)", fontFamily: "var(--font-body)", marginTop: "var(--sp-2)" }}>
        Public tags render as badges on the web menu and TV screens. Private tags are organizational only —
        they drive screen queries and bulk ops but never render publicly.
      </p>
      <div style={{ marginTop: "var(--sp-5)" }}>
        <TagsManager initialTags={tags} isOwner={isOwner} />
      </div>
    </div>
  );
}
