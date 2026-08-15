import { getViewer } from "@/lib/access";
import { webEnv } from "@/lib/env";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  const viewer = await getViewer();
  if (viewer.openAccess || viewer.session) {
    redirect("/");
  }
  const env = webEnv();
  return (
    <main>
      <h1>Log in</h1>
      <p className="muted">Sign in with GitHub to see installations you can access.</p>
      {env.GITHUB_CLIENT_ID ? (
        <p>
          <Link className="btn" href="/api/auth/github">
            Continue with GitHub
          </Link>
        </p>
      ) : (
        <p className="muted">
          Set <code>GITHUB_CLIENT_ID</code> and <code>GITHUB_CLIENT_SECRET</code>, or enable{" "}
          <code>DASHBOARD_OPEN_ACCESS</code> for local development.
        </p>
      )}
    </main>
  );
}
