import jsPDF from "jspdf";
import { Action, WaitingItem } from "./types";

interface ScheduledEntry {
  kind: "action" | "waiting";
  label: string;
  project?: string;
  priority?: string;
  slot: number;
  duration: number;
}

const START_HOUR = 7;
const SLOT_MINUTES = 30;

function slotToTime(slot: number): string {
  const totalMinutes = START_HOUR * 60 + slot * SLOT_MINUTES;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

function durationLabel(slots: number): string {
  const mins = slots * SLOT_MINUTES;
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function exportSchedulePDF(
  actions: Action[],
  waitingItems: WaitingItem[],
  todayIds: Set<string>,
  scheduleMap: Record<string, number>,
  durationMap: Record<string, number>,
) {
  const DEFAULT_DURATION = 2;

  // Build scheduled entries sorted by slot
  const scheduled: ScheduledEntry[] = [];
  const unscheduled: ScheduledEntry[] = [];

  actions.filter((a) => todayIds.has(a.id)).forEach((a) => {
    const entry: ScheduledEntry = {
      kind: "action",
      label: a.task,
      project: a.project,
      priority: a.priority,
      slot: scheduleMap[a.id] ?? -1,
      duration: durationMap[a.id] ?? DEFAULT_DURATION,
    };
    if (scheduleMap[a.id] !== undefined) scheduled.push(entry);
    else unscheduled.push(entry);
  });

  waitingItems.filter((w) => todayIds.has(w.id)).forEach((w) => {
    const entry: ScheduledEntry = {
      kind: "waiting",
      label: w.description,
      project: w.fromWhom ? `From: ${w.fromWhom}` : undefined,
      slot: scheduleMap[w.id] ?? -1,
      duration: durationMap[w.id] ?? DEFAULT_DURATION,
    };
    if (scheduleMap[w.id] !== undefined) scheduled.push(entry);
    else unscheduled.push(entry);
  });

  scheduled.sort((a, b) => a.slot - b.slot);

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2 - 2; // account for indent
  let y = margin;

  // Title
  const today = new Date();
  const dateStr = today.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Today's Plan", margin, y);
  y += 7;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120, 120, 120);
  doc.text(dateStr, margin, y);
  y += 10;

  doc.setTextColor(0, 0, 0);

  // Scheduled section
  if (scheduled.length > 0) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Scheduled", margin, y);
    y += 7;

    scheduled.forEach((entry) => {
      if (y > 270) { doc.addPage(); y = margin; }

      const timeStr = `${slotToTime(entry.slot)} – ${slotToTime(entry.slot + entry.duration)}`;
      const dur = durationLabel(entry.duration);
      const typeIcon = entry.kind === "action" ? "●" : "◐";

      // Time
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(80, 80, 80);
      doc.text(`${timeStr}  (${dur})`, margin, y);
      y += 5;

      // Task name
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0, 0, 0);
      const label = `${typeIcon} ${entry.label}`;
      const lines = doc.splitTextToSize(label, contentWidth);
      doc.text(lines, margin + 2, y);
      y += lines.length * 4.5;

      // Meta
      const meta: string[] = [];
      if (entry.project) meta.push(entry.project);
      if (entry.priority) meta.push(entry.priority);
      if (meta.length) {
        doc.setFontSize(8);
        doc.setTextColor(140, 140, 140);
        doc.text(meta.join("  •  "), margin + 2, y);
        y += 4;
      }

      y += 3;
    });
  }

  // Unscheduled section
  if (unscheduled.length > 0) {
    if (y > 260) { doc.addPage(); y = margin; }
    y += 3;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("Unscheduled", margin, y);
    y += 7;

    unscheduled.forEach((entry) => {
      if (y > 270) { doc.addPage(); y = margin; }

      const typeIcon = entry.kind === "action" ? "●" : "◐";
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0, 0, 0);
      const label = `${typeIcon} ${entry.label}`;
      const lines = doc.splitTextToSize(label, contentWidth);
      doc.text(lines, margin + 2, y);
      y += lines.length * 4.5;

      const meta: string[] = [];
      if (entry.project) meta.push(entry.project);
      if (entry.priority) meta.push(entry.priority);
      if (meta.length) {
        doc.setFontSize(8);
        doc.setTextColor(140, 140, 140);
        doc.text(meta.join("  •  "), margin + 2, y);
        y += 4;
      }
      y += 3;
    });
  }

  if (scheduled.length === 0 && unscheduled.length === 0) {
    doc.setFontSize(11);
    doc.text("No tasks gathered for today.", margin, y);
  }

  doc.save(`daily-plan-${today.toISOString().slice(0, 10)}.pdf`);
}
