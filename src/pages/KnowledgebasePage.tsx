import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { BookOpen, CheckSquare, Clock, FolderKanban, LayoutDashboard, Sparkles, FileText, Inbox, GanttChart } from "lucide-react";

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
    content: `Projects organise your work into logical groups. Each project can contain multiple Work Packages (WPs) — smaller deliverables with their own leads, due dates, and RAG statuses.\n\n**RAG statuses:**\n- 🟢 **Green** — On track, no issues.\n- 🟡 **Amber** — Some risk or delay, being managed.\n- 🔴 **Red** — Off track, needs escalation.\n\nProjects can also be grouped under a Programme for portfolio-level visibility.\n\n**Export:** Use the "Export CSV" button on the Projects page to download the entire WBS hierarchy as a spreadsheet (Programme → Project → Work Package → Action).`,
  },
  {
    id: "visual-planner",
    icon: GanttChart,
    title: "Visual Planner",
    content: `The Visual Planner is a Gantt chart view of your entire Work Breakdown Structure, letting you sequence and schedule work packages visually over time.\n\n**Key features:**\n- **Drag to move** — grab a work package bar and drag it horizontally to reschedule it.\n- **Resize edges** — drag the left or right edge of a bar to shorten or lengthen its duration.\n- **Four dependency types** — select the type before linking:\n  • **FS** (Finish→Start) — the default; target can't start until source finishes.\n  • **SS** (Start→Start) — both must start together.\n  • **FF** (Finish→Finish) — both must finish together.\n  • **SF** (Start→Finish) — target can't finish until source starts.\n  Choose the type from the dropdown next to "Link WPs", then click the source bar followed by the target bar. Non-FS arrows are labelled on the connector line.\n- **Zoom controls** — 6 zoom levels from a high-level month overview down to a detailed week view.\n- **Today line** — a vertical marker showing the current date.\n- **Collapsible hierarchy** — the left panel shows Programme → Project → Work Package; click to expand or collapse groups.\n- **Edit WPs** — click any work package name in the left panel to open the edit dialog (look for the pencil icon on hover).\n- **Add WPs** — use the "Add WP" button to create new work packages with a project dropdown and calendar date pickers.\n- **Global filter support** — the header filter applies to the Visual Planner, showing only matching programmes, projects, and work packages.\n\n**How to use it:**\n1. Navigate to Visual Planner from the sidebar.\n2. Your existing programmes, projects, and work packages appear automatically.\n3. Ensure work packages have start and due dates — bars without dates won't appear on the timeline.\n4. Drag bars to move them in time. Drag edges to adjust duration.\n5. Select a dependency type from the dropdown, click "Link WPs", then click source → target.\n6. All changes are saved to the database immediately.`,
  },
  {
    id: "inbox",
    icon: Inbox,
    title: "Rapid Capture (Inbox)",
    content: `Rapid Capture is your quick-entry inbox for capturing tasks from any source — meeting notes, emails, voice memos, or raw text.\n\n**AI-powered extraction:**\n- Paste or type raw text into the capture box and click "Extract Tasks".\n- The AI analyses the text and suggests structured tasks with project assignments, priorities, and due dates.\n- Tasks are matched to your existing projects from the WBS — the AI will never invent project names.\n\n**Inbox management:**\n- Review extracted tasks in the inbox list.\n- Use the project dropdown to assign or reassign tasks to the correct project.\n- **Bulk edit** — select multiple items and batch-update priority or project.\n- **Promote to Actions** — move selected inbox items to My Actions in one click.\n- **Bulk delete** — remove multiple items at once.`,
  },
  {
    id: "planner",
    icon: Sparkles,
    title: "WBS Planner",
    content: `The WBS (Work Breakdown Structure) Planner uses AI to automatically generate a full project management hierarchy — Programmes, Projects, Work Packages, and Actions — from documents you upload or context you type.

**What it generates:**
The AI produces a multi-level structure:
• **Programmes** — top-level groupings (e.g. "Digital Transformation Programme")
• **Projects** — individual projects within each programme
• **Work Packages** — deliverable chunks within each project, each with a suggested lead and due date
• **Actions** — specific tasks within each work package, with priority (High / Medium / Low) and due dates

**Supported inputs:**
• **Text documents** — .txt, .md, .csv, .json, .xml, .doc, .docx, .rtf, .pdf
• **Images** — .png, .jpg, .jpeg, .gif, .webp, .bmp (e.g. photos of whiteboards, screenshots of project plans)
• **Free-text context** — type or paste project descriptions, goals, constraints, team info, or rough ideas directly into the text box
• You can combine multiple files and text input in a single generation

**How to use it:**
1. Navigate to the WBS Planner page.
2. Upload one or more documents by dragging & dropping or clicking "Choose Files". Optionally add free-text context.
3. Click **"Generate WBS"** — the AI analyses your inputs and returns a suggested breakdown.
4. **Review & edit** the result inline: rename programmes, projects, work packages, or actions; change due dates, priorities, and WP leads; add or remove any item at any level.
5. **Refine with follow-up prompts** — use the "Refine this WBS" text box to give the AI further instructions (e.g. "split the first project into two", "add more detail to testing work packages", "add a data migration project"). The AI will adjust the existing structure accordingly.
6. When satisfied, click **"Accept & Create"** to import everything into your live project data — programmes, projects, work packages, and actions are all created automatically.
7. Use **"Start Over"** at any time to discard the suggestion and begin again.

**Key capabilities:**
• **Multimodal AI** — the planner can read both text and images, so you can photograph a handwritten plan or screenshot a spreadsheet and it will extract structure from it.
• **Iterative refinement** — you're not locked into the first suggestion. Refine as many times as needed before accepting.
• **Full inline editing** — every field in the generated structure is editable. Add new programmes, projects, work packages, or actions manually alongside the AI suggestions.
• **Bulk creation** — accepting the WBS creates all entities in one go, saving significant manual data entry.
• **Strict adherence** — the AI is prompted to use the names and structures you provide rather than inventing its own, reducing hallucination.

**Tips for best results:**
• Provide clear, specific project descriptions — the more detail you give, the better the breakdown.
• Upload existing project documentation (scope documents, plans, requirement lists) for the most accurate results.
• Use the refine prompt to iterate — treat it as a conversation with the AI about your project structure.
• Review suggested due dates and WP leads carefully — these are estimates and should be adjusted to your reality.`,
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
