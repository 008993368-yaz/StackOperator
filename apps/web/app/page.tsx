import { getViewer } from "@/lib/access";
import { overviewStats, recentActivity } from "@/lib/data";
import { redirect } from "next/navigation";
import Link from "next/link";

function formatMinutes(value: number): string {
  return value.toFixed(1);
}

function formatUsd(value: number): string {
  return `$${value.toFixed(2)}`;
}

export default async function OverviewPage() {
  const viewer = await getViewer();
  if (!viewer.openAccess && !viewer.session) {
    redirect("/login");
  }
  const stats = await overviewStats();
  const activity = await recentActivity();

  return (
    <main>
      <h1>Overview</h1>
      <p className="muted">
        All figures are <strong>estimated</strong>. StackOperator cancels controlled GitHub Actions
        runs; it cannot prevent them from being scheduled.
      </p>
      <section className="grid">
        <div className="card">
          <div className="stat-label">Estimated minutes avoided</div>
          <div className="stat-value">{formatMinutes(stats.estimatedMinutes)}</div>
        </div>
        <div className="card">
          <div className="stat-label">Estimated $ avoided</div>
          <div className="stat-value">{formatUsd(stats.estimatedCostUsd)}</div>
        </div>
        <div className="card">
          <div className="stat-label">Skipped (early cancel)</div>
          <div className="stat-value">{stats.skipped}</div>
        </div>
        <div className="card">
          <div className="stat-label">Cancelled (cascade)</div>
          <div className="stat-value">{stats.cancelled}</div>
        </div>
        <div className="card">
          <div className="stat-label">Stacks</div>
          <div className="stat-value">{stats.stacks}</div>
        </div>
      </section>
      <h2>Recent decisions</h2>
      {activity.length === 0 ? (
        <p className="muted">No decisions yet. Install the GitHub App and open a stacked PR.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>When</th>
              <th>Repo</th>
              <th>PR</th>
              <th>Action</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {activity.map((row) => (
              <tr key={row.id}>
                <td className="muted">{row.createdAt.toISOString()}</td>
                <td>{row.repository.fullName}</td>
                <td>{row.layer ? `#${row.layer.pullRequestNumber}` : "—"}</td>
                <td>
                  <span className={`badge ${row.action.toLowerCase()}`}>{row.action}</span>
                </td>
                <td>{row.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p>
        <Link href="/stacks">View stacks →</Link>
      </p>
    </main>
  );
}
