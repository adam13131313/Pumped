import { useAppStore } from "@/lib/store";

export default function WaitingFor() {
  const items = useAppStore((s) => s.waitingItems);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Waiting For</h2>
        <p className="text-sm text-muted-foreground">Review every Wednesday · Send nudges for overdue items</p>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Description</th>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">From</th>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Project</th>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Asked</th>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Due</th>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                <td className="max-w-sm px-4 py-3">
                  <p className="font-medium">{item.description}</p>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{item.fromWhom || "—"}</td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{item.projectWP || "—"}</td>
                <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{item.askedOn || "—"}</td>
                <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{item.dueBy || "—"}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
                    item.status === "Pending" ? "bg-rag-amber-bg text-rag-amber" :
                    item.status === "Overdue" ? "bg-rag-red-bg text-rag-red" :
                    "bg-rag-green-bg text-rag-green"
                  }`}>
                    {item.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
