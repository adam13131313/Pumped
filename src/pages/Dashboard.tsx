import { useAppStore } from "@/lib/store";
import { RAGBadge } from "@/components/RAGBadge";
import { RAGStatus } from "@/lib/types";

export default function Dashboard() {
  const workPackages = useAppStore((s) => s.workPackages);
  const actions = useAppStore((s) => s.actions);

  const ragCounts = workPackages.reduce(
    (acc, wp) => {
      acc[wp.ragStatus] = (acc[wp.ragStatus] || 0) + 1;
      return acc;
    },
    {} as Record<RAGStatus, number>
  );

  const overdueActions = actions.filter(
    (a) => a.dueDate && new Date(a.dueDate) < new Date() && a.status !== "Complete"
  );

  const projects = [...new Set(workPackages.map((wp) => wp.project))];

  return (
    <div className="space-y-8">
      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <SummaryCard label="Work Packages" value={workPackages.length} />
        <SummaryCard label="On Track" value={ragCounts.Green || 0} variant="green" />
        <SummaryCard label="At Risk" value={ragCounts.Amber || 0} variant="amber" />
        <SummaryCard label="Off Track" value={ragCounts.Red || 0} variant="red" />
      </div>

      {/* Programme overview by project */}
      <section>
        <h2 className="mb-4 text-lg font-semibold">Programme Overview</h2>
        <div className="space-y-6">
          {projects.map((project) => (
            <div key={project}>
              <h3 className="mb-2 text-sm font-medium text-muted-foreground">{project}</h3>
              <div className="overflow-hidden rounded-lg border bg-card">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Work Package</th>
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Lead</th>
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Due</th>
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Status</th>
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Blockers</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workPackages
                      .filter((wp) => wp.project === project)
                      .map((wp) => (
                        <tr key={wp.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 font-medium">{wp.workPackage}</td>
                          <td className="px-4 py-3 text-muted-foreground">{wp.wpLead}</td>
                          <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{wp.dueDate}</td>
                          <td className="px-4 py-3">
                            <RAGBadge status={wp.ragStatus} />
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">{wp.blockers || "—"}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Overdue actions */}
      {overdueActions.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-semibold text-rag-red">⚠ Overdue Actions ({overdueActions.length})</h2>
          <div className="space-y-2">
            {overdueActions.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-lg border border-rag-red/20 bg-rag-red-bg p-3">
                <span className="text-sm font-medium">{a.task}</span>
                <span className="text-xs text-muted-foreground font-mono">{a.dueDate}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function SummaryCard({ label, value, variant }: { label: string; value: number; variant?: "green" | "amber" | "red" }) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={`mt-1 text-3xl font-bold ${
          variant === "green" ? "text-rag-green" : variant === "amber" ? "text-rag-amber" : variant === "red" ? "text-rag-red" : "text-foreground"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
