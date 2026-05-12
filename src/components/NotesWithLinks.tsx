import { useMemo, useState, KeyboardEvent, ClipboardEvent } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LinkRenderer } from "@/components/LinkRenderer";
import { Plus, X, Link as LinkIcon } from "lucide-react";

const URL_REGEX = /(https?:\/\/[^\s<]+)/g;

function splitNotes(value: string): { prose: string; urls: string[] } {
  const urls = Array.from(new Set(value.match(URL_REGEX) ?? []));
  const prose = value
    .replace(URL_REGEX, "")
    .split("\n")
    .map((l) => l.replace(/[ \t]+$/g, "").replace(/^[ \t]+/g, ""))
    .filter((l, i, arr) => !(l === "" && arr[i - 1] === ""))
    .join("\n")
    .trim();
  return { prose, urls };
}

function combine(prose: string, urls: string[]): string {
  const cleanProse = prose.trim();
  const linkBlock = urls.join("\n");
  if (cleanProse && linkBlock) return `${cleanProse}\n\n${linkBlock}`;
  return cleanProse || linkBlock;
}

interface NotesWithLinksProps {
  value: string;
  onChange: (next: string) => void;
  rows?: number;
  maxLength?: number;
  placeholder?: string;
}

export function NotesWithLinks({ value, onChange, rows = 2, maxLength = 1000, placeholder }: NotesWithLinksProps) {
  const { prose, urls } = useMemo(() => splitNotes(value), [value]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  const updateProse = (nextProse: string) => {
    // If user pasted/typed URLs into prose, extract them into urls
    const found = nextProse.match(URL_REGEX) ?? [];
    if (found.length) {
      const cleaned = nextProse.replace(URL_REGEX, "").replace(/[ \t]+\n/g, "\n");
      const merged = Array.from(new Set([...urls, ...found]));
      onChange(combine(cleaned, merged));
    } else {
      onChange(combine(nextProse, urls));
    }
  };

  const removeUrl = (url: string) => {
    onChange(combine(prose, urls.filter((u) => u !== url)));
  };

  const addUrl = () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      setAdding(false);
      return;
    }
    const valid = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    if (urls.includes(valid)) {
      setDraft("");
      setAdding(false);
      return;
    }
    onChange(combine(prose, [...urls, valid]));
    setDraft("");
    setAdding(false);
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addUrl();
    } else if (e.key === "Escape") {
      setDraft("");
      setAdding(false);
    }
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text");
    if (URL_REGEX.test(text)) {
      e.preventDefault();
      const found = Array.from(new Set(text.match(URL_REGEX) ?? []));
      const merged = Array.from(new Set([...urls, ...found]));
      onChange(combine(prose, merged));
      setDraft("");
      setAdding(false);
    }
  };

  return (
    <div className="space-y-2">
      <Textarea
        value={prose}
        onChange={(e) => updateProse(e.target.value)}
        rows={rows}
        maxLength={maxLength}
        placeholder={placeholder ?? "Add notes. Pasted links are extracted below."}
        className="mt-1"
      />
      {urls.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {urls.map((url) => (
            <RemovableLinkChip key={url} url={url} onRemove={() => removeUrl(url)} />
          ))}
        </div>
      )}
      {adding ? (
        <div className="flex items-center gap-1.5">
          <LinkIcon className="h-3.5 w-3.5 text-muted-foreground" />
          <Input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKey}
            onPaste={onPaste}
            onBlur={addUrl}
            placeholder="Paste a URL and press Enter"
            className="h-8 text-xs"
          />
        </div>
      ) : (
        <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground" onClick={() => setAdding(true)}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Add link
        </Button>
      )}
    </div>
  );
}

import { ExternalLink, FileSpreadsheet, FileText, Presentation, Globe, Github, Figma } from "lucide-react";

function chipMeta(url: string): { Icon: typeof Globe; label: string } {
  const patterns: { re: RegExp; Icon: typeof Globe; type: string }[] = [
    { re: /docs\.google\.com\/spreadsheets/i, Icon: FileSpreadsheet, type: "Sheet" },
    { re: /docs\.google\.com\/document/i, Icon: FileText, type: "Doc" },
    { re: /docs\.google\.com\/presentation/i, Icon: Presentation, type: "Slides" },
    { re: /drive\.google\.com/i, Icon: Globe, type: "Drive" },
    { re: /notion\.so/i, Icon: FileText, type: "Notion" },
    { re: /figma\.com/i, Icon: Figma, type: "Figma" },
    { re: /github\.com/i, Icon: Github, type: "GitHub" },
  ];
  const idMatch = url.match(/\/d\/([A-Za-z0-9_-]+)/);
  const tail = idMatch ? idMatch[1].slice(0, 6) : (() => {
    try {
      const u = new URL(url);
      const seg = u.pathname.split("/").filter(Boolean).pop() ?? u.hostname;
      return seg.length > 12 ? seg.slice(0, 10) + "…" : seg;
    } catch { return "link"; }
  })();
  for (const p of patterns) {
    if (p.re.test(url)) return { Icon: p.Icon, label: `${p.type} · ${tail}` };
  }
  try { return { Icon: ExternalLink, label: new URL(url).hostname.replace("www.", "") }; }
  catch { return { Icon: ExternalLink, label: "link" }; }
}

function RemovableLinkChip({ url, onRemove }: { url: string; onRemove: () => void }) {
  const { Icon, label } = chipMeta(url);
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-accent pl-2 pr-1 py-1 text-xs font-medium text-accent-foreground max-w-[260px]">
      <Icon className="h-3 w-3 shrink-0" />
      <a href={url} target="_blank" rel="noopener noreferrer" title={url} onClick={(e) => e.stopPropagation()} className="truncate hover:underline">
        {label}
      </a>
      <button type="button" onClick={onRemove} title="Remove" className="ml-0.5 rounded p-0.5 hover:bg-foreground/10">
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}
