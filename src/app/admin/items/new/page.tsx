import Link from "next/link";
import { listCategories } from "@/lib/service/categories";
import { db } from "@/db";
import { getCurrentSession } from "@/lib/auth/session";
import { Button, Card } from "@/components/ds";
import { ItemForm } from "../ItemForm";

export default async function NewItemPage() {
  const session = await getCurrentSession();
  const categories = await listCategories(db);
  const isOwner = session?.user.role === "owner";

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            textTransform: "uppercase",
            color: "var(--accent-primary)",
            fontSize: "var(--fs-h3)",
            margin: 0,
          }}
        >
          New Item
        </h1>
        <Link href="/admin/items">
          <Button variant="ghost" size="sm">
            ← Items
          </Button>
        </Link>
      </div>

      {categories.length === 0 ? (
        <div style={{ marginTop: "var(--sp-5)" }}>
          <Card>
            <p style={{ color: "var(--text-secondary)", fontFamily: "var(--font-body)" }}>
              Create a category first —{" "}
              <Link href="/admin/categories" style={{ color: "var(--accent-primary)" }}>
                go to Categories
              </Link>
              .
            </p>
          </Card>
        </div>
      ) : (
        <div style={{ marginTop: "var(--sp-5)" }}>
          <ItemForm categories={categories} isOwner={isOwner} />
        </div>
      )}
    </div>
  );
}
