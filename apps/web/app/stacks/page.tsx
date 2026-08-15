import { getViewer } from "@/lib/access";
import { listStacks } from "@/lib/data";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function StacksPage() {
  const viewer = await getViewer();
  if (!viewer.openAccess && !viewer.session) {
    redirect("/login");
  }
  const stacks = await listStacks();
  return (
    <main>
      <h1>Stacks</h1>
      <p className="muted">GitHub native stacks detected from webhooks and the Stacks API.</p>
      {stacks.length === 0 ? (
        <p className="muted">No stacks yet.</p>
      ) : (
        <div className="stack-list">
          {stacks.map((stack) => (
            <div className="card stack-row" key={stack.id}>
              <div>
                <Link href={`/stacks/${stack.id}`}>
                  {stack.repository.fullName} #{stack.githubStackNumber}
                </Link>
                <div className="muted">
                  {stack.baseBranch} · {stack.layers.length} layers · {stack.status}
                </div>
              </div>
              <span className="badge">{stack.provider}</span>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
