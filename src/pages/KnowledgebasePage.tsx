import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { BookOpen, CheckSquare, Clock, FolderKanban, LayoutDashboard, Sparkles, FileText } from "lucide-react";

const sections = [
  {
    id: "dashboard",
    icon: LayoutDashboard,
    title: "Dashboard",
    content: `The Dashboard is your daily command centre. It shows today's focus items — the actions and waiting items you've flagged for immediate attention.\n\n**How to use it:**\n- Each morning, open the Dashboard and review your "Today" items.\n- Pick your top 3 priorities and work those first.\n- Items marked for today are pulled from My Actions and Waiting For.`,
  },
  {
    id: "actions",
    icon: CheckSquare,
    title: "My Actions",
    content: `My Actions is your personal task list — everything you need to do, all in one place.\n\n**Key features:**\n- Add new actions with a title, project, work package, due date, and priority.\n- Update status: Not Started → In Progress → Complete.\n- Delegate an action to someone else — it moves automatically to Waiting For.\n- Filter by project or priority to focus on what matters.`,
  },
  {
    id: "waiting",
    icon: Clock,
    title: "Waiting For",
    content: `Waiting For tracks everything you've asked others to deliver. Never chase from memory again.\n\n**Best practices:**\n- Every time you ask someone to do something, log it here immediately.\n- Include who you're waiting on, what for, and when it's due.\n- Review this list on Mondays and Wednesdays to send follow-ups.\n- If something comes back incomplete, use "Take Back" to move it to your own actions.`,
  },
  {
    id: "projects",
    icon: FolderKanban,
    title: "Projects & Work Packages",
    content: `Projects organise your work into logical groups. Each project can contain multiple Work Packages (WPs) — smaller deliverables with their own leads, due dates, and RAG statuses.\n\n**RAG statuses:**\n- 🟢 **Green** — On track, no issues.\n- 🟡 **Amber** — Some risk or delay, being managed.\n- 🔴 **Red** — Off track, needs escalation.\n\nProjects can also be grouped under a Programme for portfolio-level visibility.`,
  },
  {
    id: "planner",
    icon: Sparkles,
    title: "WBS Planner",
    content: `The WBS (Work Breakdown Structure) Planner uses AI to generate a structured breakdown of work packages from a project description.\n\n**How to use it:**\n1. Enter your project name and a brief description.\n2. Click "Generate WBS" to produce a suggested breakdown.\n3. Review, edit, and import the work packages into your project.\n\nThis saves hours of manual planning and ensures nothing is missed.`,
  },
  {
    id: "sop",
    icon: FileText,
    title: "SOP (Standard Operating Procedures)",
    content: `The SOP page contains your operating rhythm — the habits and rules that keep your work on track.\n\n**Default SOPs include:**\n- Daily 2-minute check-in.\n- Post-meeting and post-email task extraction.\n- Weekly review routine (Mondays).\n- Follow-up sweep (Wednesdays).\n- RAG status guidance and delegation rules.\n\nYou can customise, add, or remove SOP items to match your workflow.`,
  },
];

export default function KnowledgebasePage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Knowledgebase</h2>
        <p className="text-muted-foreground mt-1">
          Learn how to use every feature of Programme Tracker effectively.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Getting Started
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground leading-relaxed space-y-3">
          <p>
            Programme Tracker helps you manage projects, actions, and delegated tasks in one place.
            The workflow is simple:
          </p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Set up your <strong>Projects</strong> and <strong>Work Packages</strong>.</li>
            <li>Add tasks to <strong>My Actions</strong> — things <em>you</em> need to do.</li>
            <li>Track delegated items in <strong>Waiting For</strong> — things <em>others</em> owe you.</li>
            <li>Use the <strong>Dashboard</strong> each morning to pick your daily focus.</li>
            <li>Follow the <strong>SOP</strong> rhythm to stay consistent.</li>
          </ol>
        </CardContent>
      </Card>

      <Accordion type="multiple" className="space-y-2">
        {sections.map(({ id, icon: Icon, title, content }) => (
          <AccordionItem key={id} value={id} className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <Icon className="h-4 w-4 text-primary" />
                <span className="font-medium">{title}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line pl-7">
                {content}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
