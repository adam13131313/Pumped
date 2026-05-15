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
  Zap,
  Filter,
  Search,
  CheckCircle2,
} from "lucide-react";

const logo = "/favicon.png";

const features = [
  {
    icon: Sparkles,
    title: "Rapid AI capture",
    body: "Brain-dump in plain text or voice — AI extracts actions, owners, and dates, slotted into the right project.",
    span: "md:col-span-2 md:row-span-2",
    accent: true,
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

export default function Landing() {
  return (
    <div
      className="min-h-screen bg-[hsl(218_55%_8%)] text-[hsl(150_30%_94%)] font-['DM_Sans',sans-serif] antialiased overflow-x-hidden"
      style={{
        backgroundImage:
          "radial-gradient(1200px 600px at 80% -10%, hsl(165 80% 30% / 0.35), transparent 60%), radial-gradient(900px 500px at -10% 20%, hsl(155 70% 25% / 0.30), transparent 60%)",
      }}
    >
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-white/5 bg-[hsl(218_55%_8%/0.7)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="Pumped" className="h-8 w-8" />
            <span className="font-['Space_Grotesk',sans-serif] text-lg font-semibold tracking-tight">
              Pumped
            </span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-white/60 md:flex">
            <a href="#features" className="hover:text-white">Features</a>
            <a href="#how" className="hover:text-white">How it works</a>
            <a href="#stack" className="hover:text-white">Stack</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/auth">
              <Button variant="ghost" className="text-white/80 hover:text-white hover:bg-white/5">
                Sign in
              </Button>
            </Link>
            <Link to="/auth">
              <Button className="bg-[hsl(160_85%_45%)] text-[hsl(218_55%_8%)] hover:bg-[hsl(155_90%_55%)] font-semibold">
                Get started
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative mx-auto max-w-7xl px-4 pt-20 pb-16 sm:px-6 sm:pt-28 sm:pb-24">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-[hsl(160_85%_45%/0.3)] bg-[hsl(160_85%_45%/0.08)] px-3 py-1 text-xs font-medium text-[hsl(160_90%_70%)]">
            <Zap className="h-3 w-3" /> Work in Motion
          </span>
          <h1 className="mt-6 font-['Space_Grotesk',sans-serif] text-5xl font-bold leading-[1.05] tracking-tight sm:text-7xl">
            Capture fast.{" "}
            <span className="bg-gradient-to-r from-[hsl(160_85%_55%)] to-[hsl(140_85%_70%)] bg-clip-text text-transparent">
              Deliver bigger.
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-white/65 sm:text-xl">
            Pumped is a P3M operating system for people who run programmes, projects and themselves.
            AI capture, a clean hierarchy, and the ceremony stripped out.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/auth">
              <Button
                size="lg"
                className="group bg-[hsl(160_85%_45%)] text-[hsl(218_55%_8%)] hover:bg-[hsl(155_90%_55%)] font-semibold h-12 px-6 text-base"
              >
                Start free
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
            <a href="#features">
              <Button
                size="lg"
                variant="ghost"
                className="h-12 px-6 text-base text-white/80 hover:text-white hover:bg-white/5"
              >
                See features
              </Button>
            </a>
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-white/50">
            <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-[hsl(160_85%_55%)]" /> AI brain-dump</span>
            <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-[hsl(160_85%_55%)]" /> Webhooks & CSV</span>
            <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-[hsl(160_85%_55%)]" /> Mobile ready</span>
          </div>
        </div>
      </section>

      {/* Bento features */}
      <section id="features" className="mx-auto max-w-7xl px-4 pb-24 sm:px-6">
        <div className="mb-10 flex items-end justify-between gap-6">
          <div>
            <h2 className="font-['Space_Grotesk',sans-serif] text-3xl font-bold tracking-tight sm:text-4xl">
              Everything in one shape
            </h2>
            <p className="mt-2 max-w-xl text-white/60">
              From a fleeting idea to delivered outcome — without context-switching between five tools.
            </p>
          </div>
        </div>

        <div className="grid auto-rows-[minmax(140px,auto)] grid-cols-1 gap-3 md:grid-cols-4">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className={`group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 transition hover:border-[hsl(160_85%_45%/0.4)] hover:bg-white/[0.04] ${f.span ?? ""}`}
              >
                {f.accent && (
                  <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[hsl(160_85%_45%/0.18)] blur-3xl" />
                )}
                <div className="relative flex h-full flex-col">
                  <div
                    className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl ${
                      f.accent
                        ? "bg-[hsl(160_85%_45%)] text-[hsl(218_55%_8%)]"
                        : "bg-white/[0.05] text-[hsl(160_85%_55%)] group-hover:bg-[hsl(160_85%_45%/0.15)]"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-['Space_Grotesk',sans-serif] text-lg font-semibold tracking-tight">
                    {f.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-white/60">
                    {f.body}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-t border-white/5 bg-[hsl(165_50%_10%/0.4)]">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <h2 className="font-['Space_Grotesk',sans-serif] text-3xl font-bold tracking-tight sm:text-4xl">
            Three steps to in-motion
          </h2>
          <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
            {[
              { n: "01", t: "Capture", d: "Type, paste, upload, or pipe in via webhook. AI extracts actions and routes them to the right work package." },
              { n: "02", t: "Organise", d: "Programmes hold projects; projects hold work packages; work packages hold actions. Clean and traceable." },
              { n: "03", t: "Move", d: "Today's Focus, Kanban, Waiting For — work the system, not around it. Auto-archive keeps things calm." },
            ].map((s) => (
              <div key={s.n} className="rounded-2xl border border-white/5 bg-white/[0.02] p-6">
                <div className="font-['Space_Grotesk',sans-serif] text-3xl font-bold text-[hsl(160_85%_55%)]">{s.n}</div>
                <h3 className="mt-3 font-['Space_Grotesk',sans-serif] text-xl font-semibold">{s.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/60">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="stack" className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
        <div
          className="relative overflow-hidden rounded-3xl border border-[hsl(160_85%_45%/0.25)] p-10 text-center sm:p-16"
          style={{
            backgroundImage:
              "radial-gradient(600px 300px at 50% 0%, hsl(160 85% 45% / 0.25), transparent 70%)",
          }}
        >
          <h2 className="font-['Space_Grotesk',sans-serif] text-4xl font-bold tracking-tight sm:text-5xl">
            Get pumped.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-white/65">
            Free to start. Bring your programme, your projects, your weekly chaos — leave with a system.
          </p>
          <div className="mt-8 flex justify-center">
            <Link to="/auth">
              <Button
                size="lg"
                className="group bg-[hsl(160_85%_45%)] text-[hsl(218_55%_8%)] hover:bg-[hsl(155_90%_55%)] font-semibold h-12 px-8 text-base"
              >
                Create your account
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/5">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-8 text-xs text-white/40 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <img src={logo} alt="" className="h-5 w-5 opacity-80" />
            <span>Pumped — Work in Motion</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/auth" className="hover:text-white">Sign in</Link>
            <a href="#features" className="hover:text-white">Features</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
