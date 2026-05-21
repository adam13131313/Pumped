import { useMemo, ClipboardEvent } from "react";
import { Textarea } from "@/components/ui/textarea";
import { ExternalLink, FileSpreadsheet, FileText, Presentation, Globe, Github, Figma, X } from "lucide-react";

// Notes field with passive URL extraction. URLs typed or pasted into the
// textarea are pulled out and rendered as chips below it for legibility.
// The explicit "Add link" button used to live here, but it duplicated the
// Documents section on the dialog — link-adding is now consolidated there.
// Pasted URLs still extract here so legacy notes keep working.

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

  const updateProse = (nextProse: string) => {
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

  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const text = e.clipboardData.getData("text");
    const found = text.match(URL_REGEX);
    if (found && found.length > 0 && !text.replace(URL_REGEX, "").trim()) {
      // The clipboard is *only* a URL (or a few). Skip default paste so the
      // URLs don't also end up inline in the textarea — they already get
      // hoisted into the chip row.
      e.preventDefault();
      const merged = Array.from(new Set([...urls, ...found]));
      onChange(combine(prose, merged));
    }
  };

  return (
    <div className="space-y-2">
      <Textarea
        value={prose}
        onChange={(e) => updateProse(e.target.value)}
        onPaste={onPaste}
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
    </div>
  );
}

function chipMeta(url: string): { Icon: typeof Globe; label: string } {
  const patterns: { re: RegExp; Icon: typeof Globe }[] = [
    { re: /docs\.google\.com\/spreadsheets/i, Icon: FileSpreadsheet },
    { re: /docs\.google\.com\/document/i, Icon: FileText },
    { re: /docs\.google\.com\/presentation/i, Icon: Presentation },
    { re: /drive\.google\.com/i, Icon: Globe },
    { re: /notion\.so/i, Icon: FileText },
    { re: /figma\.com/i, Icon: Figma },
    { re: /github\.com/i, Icon: Github },
  ];
  let host = "link";
  try { host = new URL(url).hostname.replace(/^www\./, ""); } catch { /* fall through */ }
  for (const p of patterns) {
    if (p.re.test(url)) return { Icon: p.Icon, label: host };
  }
  return { Icon: ExternalLink, label: host };
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
