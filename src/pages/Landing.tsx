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
  ArrowLeftRight,
  X,
} from "lucide-react";

const logo = "/favicon.png";

const ACCENT = "#6b8cae";
const ACCENT_STRONG = "rgba(107,140,174,0.9)";
const BG = "#070809";
const TEXT = "#d8dce6";
const TEXT_MUTED = "rgba(216,220,230,0.45)";
const SURFACE = "rgba(255,255,255,0.018)";
const BORDER = "rgba(255,255,255,0.055)";
const BORDER_STRONG = "rgba(255,255,255,0.06)";
const HOVER_BORDER = "rgba(107,140,174,0.2)";
const BTN_BORDER = "rgba(107,140,174,0.6)";
const BTN_HOVER_BG = "rgba(107,140,174,0.08)";
const mono = "'JetBrains Mono', monospace";
const display = "'Space Grotesk', sans-serif";

const features = [
  {
    icon: BarChart2,
    title: "Pumped Pulse Dashboard",
    body: "A live health score, priority drift alerts, and drill-through navigation — scoped to any programme, project, or work package. One view that tells you whether the work is on track.",
    span: "md:col-span-2 md:row-span-2",
    accent: true,
  },
  {
    icon: ArrowLeftRight,
    title: "Bi-directional sync",
    body: "Tasks arrive from any connected tool. Status updates travel back. The source never goes stale; your WBS never goes blind.",
    span: "md:col-span-2",
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
    body: "A strict hierarchy that keeps strategic work and execution in the same shape.",
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
    d: "You walk out of a meeting, off a call, or out of your inbox with a dozen loose threads. Brain-dump the whole thing — Pumped's AI parses it into structured actions and routes each one to the right work package automatically.",
    s: "inbox → actions",
  },
  {
    n: "02",
    t: "Structure it properly",
    d: "Every action lives inside a Work Package, inside a Project, inside a Programme. The WBS Planner generates that entire structure from a one-paragraph brief in under two minutes.",
    s: "wbs maintained",
  },
  {
    n: "03",
    t: "Track what you've handed off",
    d: "Everything you delegate enters Waiting For with an owner, a due date, and a link to the originating project's RAG status. The dashboard surfaces overdue items before they become surprises.",
    s: "delegation tracked",
  },
  {
    n: "04",
    t: "Stay connected to your tools",
    d: "Tasks from Slack, Linear, Gmail, and any webhook-capable system land in one inbox. When you act on them in Pumped, the update travels back to the source. One system of record — not a parallel universe.",
    s: "sync active",
  },
  {
    n: "05",
    t: "See the health of the portfolio",
    d: "The Pumped Pulse dashboard shows RAG trends, stalled priorities, workload distribution, and a composite health score — scoped to any level of the hierarchy. Click anything to drill straight through to the relevant tasks.",
    s: "portfolio visible",
  },
];

const problems = [
  {
    p: "Tasks scattered across Slack, email, Jira, and notebooks — no single view of what you actually own.",
    r: "One inbox. Every source pipes in via webhook or native connector. AI routes each task to the right work package.",
  },
  {
    p: "No visible line between a programme goal and the action someone is doing today.",
    r: "Programme → Project → Work Package → Action. The hierarchy is mandatory, not optional. Everything is traceable.",
  },
  {
    p: "A task marked complete in Pumped that the originating system still shows as open.",
    r: "Bi-directional sync. Updates in Pumped travel back to the source automatically via stored deep links and native connectors.",
  },
];

const stats = [
  { n: "3 tiers", l: "Programme, Project, Work Package" },
  { n: "1 inbox", l: "Every tool, one place" },
  { n: "∞ projects", l: "No limits on structure" },
  { n: "0 spreadsheets", l: "Required" },
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
        backgroundImage: `linear-gradient(180deg, rgba(107,140,174,0.025) 0%, transparent 300px)`,
      }}
    >
      {/* Nav */}
      <header
        className="sticky top-0 z-30 backdrop-blur-xl"
        style={{ borderBottom: `1px solid ${BORDER}`, background: "rgba(7,8,9,0.7)" }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center">
            <img src="/logo-horizontal-white.png" alt="Pumped" className="h-12 w-auto object-contain" />
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
                className="font-semibold"
                style={{
                  background: "transparent",
                  border: `1px solid ${BTN_BORDER}`,
                  color: TEXT,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = BTN_HOVER_BG)}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
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
            style={{ fontFamily: mono, color: ACCENT_STRONG }}
            className="text-xs tracking-tight"
          >
            // your WBS. your tools. one system.
          </span>
          <h1
            style={{ fontFamily: display, color: TEXT }}
            className="mt-6 text-5xl font-bold leading-[1.05] tracking-tight sm:text-7xl"
          >
            Every task. Every tool.
            <br />
            One structure.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg sm:text-xl" style={{ color: TEXT_MUTED }}>
            Pumped organises everything you need to do into your Work Breakdown Structure —
            Programme, Project, Work Package, Action — and keeps it current across every
            app you use. Tasks flow in from anywhere. Completions flow back to the source.
            Your WBS stays the single truth.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/auth">
              <Button
                size="lg"
                className="group font-semibold h-12 px-6 text-base"
                style={{
                  background: "transparent",
                  border: `1px solid ${BTN_BORDER}`,
                  color: TEXT,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = BTN_HOVER_BG)}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
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
            style={{ fontFamily: mono, color: ACCENT_STRONG }}
          >
            <span>// wbs-structured</span>
            <span>// bi-directional sync</span>
            <span>// ai-powered capture</span>
          </div>
        </div>
      </section>

      {/* Problem section */}
      <section
        style={{
          background: "rgba(255,255,255,0.015)",
          borderTop: `1px solid ${BORDER_STRONG}`,
          borderBottom: `1px solid ${BORDER_STRONG}`,
        }}
      >
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 grid grid-cols-1 md:grid-cols-5 gap-12">
          <div className="md:col-span-2">
            <p
              style={{ fontFamily: display, color: TEXT, lineHeight: 1.35 }}
              className="text-2xl sm:text-[26px]"
            >
              "You manage work across five tools, none of which know about each
              other. Tasks get captured in one place, tracked in another, and
              completed somewhere the original system never hears about."
            </p>
          </div>
          <div className="md:col-span-3 space-y-8">
            {problems.map((p) => (
              <div key={p.p}>
                <div className="flex items-start gap-3">
                  <X className="h-4 w-4 mt-1 flex-shrink-0" style={{ color: "rgba(216,220,230,0.3)" }} />
                  <p style={{ color: TEXT }} className="text-base sm:text-lg">{p.p}</p>
                </div>
                <div className="mt-2 ml-7 flex items-start gap-2">
                  <span style={{ color: "rgba(107,140,174,0.8)", fontFamily: mono }} className="text-sm">→</span>
                  <p style={{ color: TEXT_MUTED }} className="text-sm">
                    {p.r}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bento features */}
      <section id="features" className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
        <div className="mb-10">
          <p style={{ fontFamily: mono, color: ACCENT_STRONG }} className="text-xs">
            // 13 features, 0 spreadsheets
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
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = HOVER_BORDER)}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = BORDER)}
              >
                <div className="relative flex h-full flex-col">
                  <div
                    className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl"
                    style={{ background: "rgba(255,255,255,0.04)", color: ACCENT_STRONG }}
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
        style={{ borderTop: `1px solid ${BORDER_STRONG}`, background: "rgba(255,255,255,0.015)" }}
      >
        <div className="mx-auto max-w-5xl px-4 py-20 sm:px-6">
          <p style={{ fontFamily: mono, color: ACCENT_STRONG }} className="text-xs">
            // how it works
          </p>
          <h2
            style={{ fontFamily: display, color: TEXT }}
            className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl"
          >
            From capture to delivery.
          </h2>
          <div className="mt-12">
            {steps.map((s, i) => (
              <div
                key={s.n}
                className="py-8 grid grid-cols-12 gap-4 sm:gap-8 items-start"
                style={i > 0 ? { borderTop: `1px solid ${BORDER_STRONG}` } : undefined}
              >
                <div
                  style={{ fontFamily: mono, color: ACCENT_STRONG }}
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
                  style={{ fontFamily: mono, color: ACCENT_STRONG }}
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
          borderTop: `1px solid ${BORDER_STRONG}`,
          borderBottom: `1px solid ${BORDER_STRONG}`,
        }}
      >
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 grid grid-cols-2 sm:grid-cols-4">
          {stats.map((s, i) => (
            <div
              key={s.l}
              className="text-center px-4 py-3"
              style={i > 0 ? { borderLeft: `1px solid ${BORDER_STRONG}` } : undefined}
            >
              <div
                style={{ fontFamily: mono, color: TEXT }}
                className="text-2xl sm:text-3xl"
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
          style={{ border: `1px solid rgba(107,140,174,0.18)` }}
        >
          <h2
            style={{ fontFamily: display, color: TEXT }}
            className="text-4xl font-bold tracking-tight sm:text-5xl"
          >
            Start with one project.
          </h2>
          <p className="mx-auto mt-4 max-w-xl" style={{ color: TEXT_MUTED }}>
            Free to use. Bring your programme, your chaos, your stack of tools
            that don't talk to each other — and leave with a single system that does.
          </p>
          <div className="mt-8 flex justify-center">
            <Link to="/auth">
              <Button
                size="lg"
                className="group font-semibold h-12 px-8 text-base"
                style={{
                  background: "transparent",
                  border: `1px solid ${BTN_BORDER}`,
                  color: TEXT,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = BTN_HOVER_BG)}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                Create your account
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <footer style={{ borderTop: `1px solid ${BORDER_STRONG}` }}>
        <div
          className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-8 text-xs sm:flex-row sm:px-6"
          style={{ color: TEXT_MUTED }}
        >
          <div className="flex items-center gap-3">
            <img src="/logo-horizontal-white.png" alt="Pumped" className="h-6 w-auto object-contain opacity-70" />
            <span>Work in Motion</span>
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
