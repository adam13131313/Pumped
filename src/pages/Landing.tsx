import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Inbox,
  Sparkles,
  Layers,
  Kanban,
  Users,
  Repeat,
  BookOpen,
  Plug,
  ShieldCheck,
  Filter,
  Search,
  BarChart2,
  X,
} from "lucide-react";

const logo = "/favicon.png";

const ACCENT = "#4a9eff";
const BG = "#08090c";
const TEXT = "#e2e4e9";
const TEXT_MUTED = "rgba(226,228,233,0.55)";
const SURFACE = "rgba(255,255,255,0.03)";
const BORDER = "rgba(255,255,255,0.07)";
const mono = "'JetBrains Mono', monospace";
const display = "'Space Grotesk', sans-serif";

const features = [
  {
    icon: BarChart2,
    title: "Pumped Pulse Dashboard",
    body: "A live health score, priority drift alerts, and drill-through navigation — scoped to any programme, project, or work package.",
    span: "md:col-span-2 md:row-span-2",
    accent: true,
  },
  {
    icon: Sparkles,
    title: "Rapid AI capture",
    body: "Brain-dump in plain text or voice — AI extracts actions, owners, and dates, slotted into the right project.",
    span: "md:col-span-2",
  },
  {
    icon: Layers,
    title: "Programme → Project → WP → Action",
    body: "A strict 3-tier hierarchy that keeps strategic work and execution in the same shape.",
    span: "md:col-span-2",
  },
  {
    icon: Kanban,
    title: "Kanban & list views",
    body: "Switch how you see work without losing context.",
    span: "md:col-span-1",
  },
  {
    icon: Inbox,
    title: "Inbox triage",
    body: "Everything captured lands in one place to sort, accept, or discard.",
    span: "md:col-span-1",
  },
  {
    icon: Users,
    title: "Waiting For",
    body: "Track delegated work and follow up before it slips.",
    span: "md:col-span-2",
  },
  {
    icon: Repeat,
    title: "Routines & SOPs",
    body: "Personal rhythms and team guidelines — versioned, editable, always at hand.",
    span: "md:col-span-2",
  },
  {
    icon: BookOpen,
    title: "Knowledgebase + AI chat",
    body: "Ask the assistant questions about your work and the way the system runs.",
    span: "md:col-span-2",
  },
  {
    icon: Plug,
    title: "Integrations",
    body: "Webhook ingest sources and Zapier paths — pipe tasks in from anywhere.",
    span: "md:col-span-1",
  },
  {
    icon: Filter,
    title: "Global filter",
    body: "One filter applied everywhere — context follows you across views.",
    span: "md:col-span-1",
  },
  {
    icon: Search,
    title: "Cmd+K search",
    body: "Jump to anything. Prevent duplicates as you type.",
    span: "md:col-span-2",
  },
  {
    icon: ShieldCheck,
    title: "Auto-archive & RAG health",
    body: "Completed actions tidy themselves; project health is visible at a glance.",
    span: "md:col-span-2",
  },
];

const steps = [
  {
    n: "01",
    t: "Capture without friction",
    d: "You walk out of a meeting. Brain-dump the whole thing in one text block — names, actions, dates, ambiguities. AI parses it and creates structured actions routed to the right work package.",
    s: "inbox → actions",
  },
  {
    n: "02",
    t: "Organise into the hierarchy",
    d: "Everything sits in a Programme → Project → Work Package → Action chain. No flat lists, no orphaned tasks. The WBS Planner generates the whole structure from a brief in under two minutes.",
    s: "structure maintained",
  },
  {
    n: "03",
    t: "Track what you've delegated",
    d: "Every action you hand off goes into Waiting For with a due date and a named owner. The dashboard flags overdue items before they become surprises.",
    s: "delegation tracked",
  },
  {
    n: "04",
    t: "See the health of your portfolio",
    d: "The Pumped Pulse dashboard shows your RAG trend, stalled high-priority actions, workload heatmap, and a composite health score — scoped to any level of the hierarchy.",
    s: "portfolio visible",
  },
  {
    n: "05",
    t: "Run your operating rhythm",
    d: "Personal routines, editable SOPs, and a built-in weekly review cadence keep the system alive between the big moments.",
    s: "rhythm maintained",
  },
];

const problems = [
  {
    p: "Actions captured in three different places, none of them complete",
    r: "One inbox. AI routes everything.",
  },
  {
    p: "No clear line from programme goal to daily action",
    r: "Programme → Project → WP → Action. Always traceable.",
  },
  {
    p: "Waiting For items that fall silent and become surprises",
    r: "Waiting For tracker with overdue flagging and risk matrix.",
  },
];

const stats = [
  { n: "3", l: "tiers" },
  { n: "12", l: "features" },
  { n: "∞", l: "work packages" },
  { n: "1", l: "inbox" },
];

export default function Landing() {
  const { session, loading } = useAuth();
  if (!loading && session) {
    return <Navigate to="/dashboard" replace />;
  }
  return (
    <div
      className="min-h-screen antialiased overflow-x-hidden"
      style={{
        background: BG,
        color: TEXT,
        fontFamily: "'DM Sans', sans-serif",
        backgroundImage: `linear-gradient(180deg, rgba(74,158,255,0.04) 0%, transparent 400px)`,
      }}
    >
      {/* Nav */}
      <header
        className="sticky top-0 z-30 backdrop-blur-xl"
        style={{ borderBottom: `1px solid ${BORDER}`, background: "rgba(8,9,12,0.7)" }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="Pumped" className="h-8 w-8" />
            <span style={{ fontFamily: display }} className="text-lg font-semibold tracking-tight">
              Pumped
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/auth">
              <Button
                variant="ghost"
                className="hover:bg-white/5"
                style={{ color: TEXT_MUTED }}
              >
                Sign in
              </Button>
            </Link>
            <Link to="/auth">
              <Button
                className="font-semibold hover:opacity-90"
                style={{ background: ACCENT, color: BG }}
              >
                Get started
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative mx-auto max-w-7xl px-4 pt-20 pb-16 sm:px-6 sm:pt-28 sm:pb-24">
        <div className="mx-auto max-w-3xl text-center">
          <span
            style={{ fontFamily: mono, color: ACCENT }}
            className="text-xs tracking-tight"
          >
            v1.0 — Now available
          </span>
          <h1
            style={{ fontFamily: display, color: TEXT }}
            className="mt-6 text-5xl font-bold leading-[1.05] tracking-tight sm:text-7xl"
          >
            Run programmes.
            <br />
            Not spreadsheets.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg sm:text-xl" style={{ color: TEXT_MUTED }}>
            Pumped is a P3M operating system for people who manage programmes, projects,
            and themselves. AI capture, clean hierarchy, no ceremony.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/auth">
              <Button
                size="lg"
                className="group font-semibold h-12 px-6 text-base hover:opacity-90"
                style={{ background: ACCENT, color: BG }}
              >
                Start free
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
            <a href="#how">
              <Button
                size="lg"
                variant="ghost"
                className="h-12 px-6 text-base hover:bg-white/5"
                style={{ color: TEXT_MUTED }}
              >
                See how it works
              </Button>
            </a>
          </div>
          <div
            className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs"
            style={{ fontFamily: mono, color: TEXT_MUTED }}
          >
            <span>// zero dropped delegations</span>
            <span>// one inbox, not five tools</span>
            <span>// your WBS in two minutes</span>
          </div>
        </div>
      </section>

      {/* Problem section */}
      <section
        style={{
          background: "rgba(255,255,255,0.02)",
          borderTop: `1px solid ${BORDER}`,
          borderBottom: `1px solid ${BORDER}`,
        }}
      >
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 grid grid-cols-1 md:grid-cols-5 gap-12">
          <div className="md:col-span-2">
            <p
              style={{ fontFamily: display, color: TEXT }}
              className="text-2xl sm:text-[28px] leading-snug"
            >
              "You leave a stakeholder meeting with twelve things to track,
              four things to delegate, and two projects that just turned amber.
              None of that fits in a task app."
            </p>
          </div>
          <div className="md:col-span-3 space-y-8">
            {problems.map((p) => (
              <div key={p.p}>
                <div className="flex items-start gap-3">
                  <X className="h-4 w-4 mt-1 flex-shrink-0" style={{ color: "rgba(220,90,90,0.85)" }} />
                  <p style={{ color: TEXT }} className="text-base sm:text-lg">{p.p}</p>
                </div>
                <p
                  style={{ color: ACCENT, fontFamily: mono }}
                  className="mt-2 ml-7 text-sm"
                >
                  → {p.r}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bento features */}
      <section id="features" className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
        <div className="mb-10">
          <p style={{ fontFamily: mono, color: ACCENT }} className="text-xs">
            // 12 features, 0 spreadsheets
          </p>
          <h2
            style={{ fontFamily: display, color: TEXT }}
            className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl"
          >
            Everything in one shape.
          </h2>
        </div>

        <div className="grid auto-rows-[minmax(140px,auto)] grid-cols-1 gap-3 md:grid-cols-4">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className={`group relative overflow-hidden rounded-2xl p-5 transition ${f.span ?? ""}`}
                style={{
                  background: SURFACE,
                  border: `1px solid ${BORDER}`,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(74,158,255,0.3)")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = BORDER)}
              >
                <div className="relative flex h-full flex-col">
                  <div
                    className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl"
                    style={
                      f.accent
                        ? { background: ACCENT, color: BG }
                        : { background: "rgba(255,255,255,0.05)", color: ACCENT }
                    }
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3
                    style={{ fontFamily: display, color: TEXT }}
                    className="text-lg font-semibold tracking-tight"
                  >
                    {f.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed" style={{ color: TEXT_MUTED }}>
                    {f.body}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* How it works */}
      <section
        id="how"
        style={{ borderTop: `1px solid ${BORDER}`, background: "rgba(255,255,255,0.02)" }}
      >
        <div className="mx-auto max-w-5xl px-4 py-20 sm:px-6">
          <p style={{ fontFamily: mono, color: ACCENT }} className="text-xs">
            // workflow
          </p>
          <h2
            style={{ fontFamily: display, color: TEXT }}
            className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl"
          >
            How it works.
          </h2>
          <div className="mt-12">
            {steps.map((s, i) => (
              <div
                key={s.n}
                className="py-8 grid grid-cols-12 gap-4 sm:gap-8 items-start"
                style={i > 0 ? { borderTop: `1px solid ${BORDER}` } : undefined}
              >
                <div
                  style={{ fontFamily: mono, color: ACCENT }}
                  className="col-span-2 sm:col-span-1 text-2xl sm:text-3xl"
                >
                  {s.n}
                </div>
                <div className="col-span-10 sm:col-span-8">
                  <h3
                    style={{ fontFamily: display, color: TEXT }}
                    className="text-xl font-semibold"
                  >
                    {s.t}
                  </h3>
                  <p className="mt-2 text-sm sm:text-base leading-relaxed" style={{ color: TEXT_MUTED }}>
                    {s.d}
                  </p>
                </div>
                <div
                  className="col-span-12 sm:col-span-3 sm:text-right"
                  style={{ fontFamily: mono, color: TEXT_MUTED }}
                >
                  <span className="text-xs">status: {s.s}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section
        style={{
          borderTop: `1px solid ${BORDER}`,
          borderBottom: `1px solid ${BORDER}`,
        }}
      >
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 grid grid-cols-2 sm:grid-cols-4">
          {stats.map((s, i) => (
            <div
              key={s.l}
              className="text-center px-4 py-3"
              style={i > 0 ? { borderLeft: `1px solid ${BORDER}` } : undefined}
            >
              <div
                style={{ fontFamily: mono, color: TEXT }}
                className="text-3xl sm:text-4xl"
              >
                {s.n}
              </div>
              <div className="mt-1 text-xs" style={{ color: TEXT_MUTED }}>
                {s.l}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
        <div
          className="rounded-3xl p-10 text-center sm:p-16"
          style={{ border: `1px solid rgba(74,158,255,0.2)` }}
        >
          <h2
            style={{ fontFamily: display, color: TEXT }}
            className="text-4xl font-bold tracking-tight sm:text-5xl"
          >
            Start with one project.
          </h2>
          <p className="mx-auto mt-4 max-w-xl" style={{ color: TEXT_MUTED }}>
            Free to use. Bring your programme, your chaos, your Monday morning —
            leave with a system.
          </p>
          <div className="mt-8 flex justify-center">
            <Link to="/auth">
              <Button
                size="lg"
                className="group font-semibold h-12 px-8 text-base hover:opacity-90"
                style={{ background: ACCENT, color: BG }}
              >
                Create your account
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <footer style={{ borderTop: `1px solid ${BORDER}` }}>
        <div
          className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-8 text-xs sm:flex-row sm:px-6"
          style={{ color: TEXT_MUTED }}
        >
          <div className="flex items-center gap-2">
            <img src={logo} alt="" className="h-5 w-5 opacity-80" />
            <span>Pumped — Work in Motion</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/auth" className="hover:text-white">Sign in</Link>
            <a
              href="https://github.com/adam13131313/Pumped"
              target="_blank"
              rel="noreferrer"
              className="hover:text-white"
            >
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
