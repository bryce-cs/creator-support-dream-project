import AdminLogin from "@/components/AdminLogin";
import AdminPage from "@/components/AdminPage";
import FluidNav from "@/components/FluidNav";
import { isAdminEnabled, isAdminRequest } from "@/lib/admin-auth";
import { readOverrides } from "@/lib/overrides-server";
import { loadAllSubmissions } from "@/lib/submissions-server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin - The Big Idea Fund",
  // Never let this surface into search results.
  robots: { index: false, follow: false },
};

export default async function Page() {
  if (!isAdminEnabled()) return <AdminDisabled />;
  if (!(await isAdminRequest())) return <AdminLogin />;

  const [submissions, overrides] = await Promise.all([loadAllSubmissions(), readOverrides()]);
  return <AdminPage submissions={submissions} overrides={overrides} />;
}

/** Shown when ADMIN_PASSWORD is unset — the admin surface stays off rather than open. */
function AdminDisabled() {
  return (
    <div className="min-h-screen bg-white">
      <FluidNav />
      <main className="px-5 pb-24" style={{ maxWidth: 560, margin: "60px auto 0" }}>
        <h1 className="font-medium" style={{ fontSize: 35, lineHeight: 1.2, color: "#000", margin: 0 }}>
          Admin is not configured
        </h1>
        <p style={{ fontSize: 18, color: "#555", marginTop: 16, lineHeight: 1.5 }}>
          Set an <code>ADMIN_PASSWORD</code> environment variable on the server and restart. Until
          then this page stays disabled, so it can never be reached without a password.
        </p>
      </main>
    </div>
  );
}
