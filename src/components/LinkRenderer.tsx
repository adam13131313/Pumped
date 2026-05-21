import { ExternalLink, FileSpreadsheet, FileText, Presentation, Globe, Github, Figma } from "lucide-react";

// Inline link rendering for free-text fields (waiting notes, comments).
// Detects URLs in arbitrary prose and replaces each occurrence with a
// labelled chip. The label is just the host (e.g. "docs.google.com") —
// short, scannable, no truncated UUIDs.

type Meta = { icon: typeof Globe; label: string };

const ICON_PATTERNS: { pattern: RegExp; icon: typeof Globe }[] = [
  { pattern: /docs\.google\.com\/spreadsheets/i, icon: FileSpreadsheet },
  { pattern: /docs\.google\.com\/document/i, icon: FileText },
  { pattern: /docs\.google\.com\/presentation/i, icon: Presentation },
  { pattern: /drive\.google\.com/i, icon: Globe },
  { pattern: /notion\.so/i, icon: FileText },
  { pattern: /figma\.com/i, icon: Figma },
  { pattern: /github\.com/i, icon: Github },
];

function getLinkMeta(url: string): Meta {
  let host = "link";
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    // fall through
  }
  for (const { pattern, icon } of ICON_PATTERNS) {
    if (pattern.test(url)) return { icon, label: host };
  }
  return { icon: ExternalLink, label: host };
}

const URL_REGEX = /(https?:\/\/[^\s<]+)/g;

interface LinkRendererProps {
  text: string;
  /** When true, render only chips (one per URL), ignoring surrounding text. */
  chipsOnly?: boolean;
}

export function LinkRenderer({ text, chipsOnly = false }: LinkRendererProps) {
  if (chipsOnly) {
    const urls = Array.from(new Set(text.match(URL_REGEX) ?? []));
    if (urls.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-1.5">
        {urls.map((url, i) => {
          const meta = getLinkMeta(url);
          const Icon = meta.icon;
          return (
            <a
              key={i}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              title={url}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 rounded-md bg-accent px-2 py-1 text-xs font-medium text-accent-foreground hover:bg-accent/80 transition-colors max-w-[260px]"
            >
              <Icon className="h-3 w-3 shrink-0" />
              <span className="truncate">{meta.label}</span>
              <ExternalLink className="h-2.5 w-2.5 shrink-0 opacity-60" />
            </a>
          );
        })}
      </div>
    );
  }

  const parts = text.split(URL_REGEX);
  if (parts.length === 1) return <span>{text}</span>;

  return (
    <span>
      {parts.map((part, i) => {
        if (URL_REGEX.test(part)) {
          URL_REGEX.lastIndex = 0;
          const meta = getLinkMeta(part);
          const Icon = meta.icon;
          return (
            <a
              key={i}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              title={part}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 rounded-md bg-accent px-1.5 py-0.5 text-xs font-medium text-accent-foreground hover:bg-accent/80 transition-colors mx-0.5"
            >
              <Icon className="h-3 w-3" />
              {meta.label}
            </a>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}
