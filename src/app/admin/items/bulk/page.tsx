import { redirect } from "next/navigation";

// The standalone Bulk Ops page was replaced by the inline wp-admin-style bulk
// bar on the Items list (src/app/admin/items/ItemsBrowser.tsx). Its server
// actions (./actions.ts) still back that bar. This route redirects so old
// links/bookmarks land on the Items list where bulk ops now live.
export default function LegacyBulkOpsPage() {
  redirect("/admin/items");
}
