import { getViewer } from "@/lib/access";
import { getStack } from "@/lib/data";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

export default async function StackDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await getViewer();
  if (!viewer.openAccess && !viewer.session) {
    redirect("/login");
  }
  const { id } = await params;
  const stack = await getStack(id);
  if (!stack) {
    notFound();
  }

  return (
    <main>
      <p className="muted">
        <Link href="/stacks">← Stacks</Link>
      </p>
      <h1>
        {stack.repository.fullName} stack #{stack.githubStackNumber}
      </h1>
      <p className="muted">
        Provider {stack.provider} · status {stack.status}
      </p>
      <h2>Layer tree</h2>
      <ul className="tree">
        <li className="layer">
          <strong>{stack.baseBranch}</strong>
          <span className="badge">base</span>
          {renderLayers(stack.layers, stack.repository.fullName)}
        </li>
      </ul>
    </main>
  );
}

function renderLayers(
  layers: Awaited<ReturnType<typeof getStack>> extends infer T
    ? T extends { layers: infer L }
      ? L
      : never
    : never,
  fullName: string,
) {
  if (!layers || layers.length === 0) {
    return null;
  }
  return (
    <ul>
      {nest(layers).map((node) => (
        <LayerNode key={node.layer.id} node={node} fullName={fullName} />
      ))}
    </ul>
  );
}

type LayerRecord = NonNullable<Awaited<ReturnType<typeof getStack>>>["layers"][number];

type LayerNodeModel = {
  layer: LayerRecord;
  children: LayerNodeModel[];
};

function nest(layers: LayerRecord[]): LayerNodeModel[] {
  const byPr = new Map<number, LayerNodeModel>();
  for (const layer of layers) {
    byPr.set(layer.pullRequestNumber, { layer, children: [] });
  }
  const roots: LayerNodeModel[] = [];
  for (const node of byPr.values()) {
    const parent = node.layer.parentPullRequestNumber
      ? byPr.get(node.layer.parentPullRequestNumber)
      : undefined;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

function LayerNode({ node, fullName }: { node: LayerNodeModel; fullName: string }) {
  const snapshot = node.layer.snapshots[0];
  const latest = node.layer.decisions[0];
  const href = `https://github.com/${fullName}/pull/${node.layer.pullRequestNumber}`;
  return (
    <li className="layer">
      <a href={href} target="_blank" rel="noreferrer">
        PR #{node.layer.pullRequestNumber}
      </a>{" "}
      {node.layer.title}
      <span className="badge">{node.layer.prState}</span>
      {snapshot ? (
        <span className="badge">
          {snapshot.classes.length > 0 ? snapshot.classes.join(", ") : "unclassified"}
        </span>
      ) : (
        <span className="badge">status pending</span>
      )}
      {latest ? <span className={`badge ${latest.action.toLowerCase()}`}>{latest.action}</span> : null}
      <div className="muted">
        {node.layer.headRef} @ {node.layer.headSha.slice(0, 7)}
        {latest ? ` · ${latest.reason}` : ""}
      </div>
      {node.children.length > 0 ? (
        <ul>
          {node.children.map((child) => (
            <LayerNode key={child.layer.id} node={child} fullName={fullName} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
