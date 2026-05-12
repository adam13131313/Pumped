import { ExternalLink, FileSpreadsheet, FileText, Presentation, Globe, Github, Figma } from "lucide-react";

type Meta = { icon: typeof Globe; label: string; type: string };

const LINK_PATTERNS: { pattern: RegExp; icon: typeof Globe; type: string }[] = [
  { pattern: /docs\.google\.com\/spreadsheets/i, icon: FileSpreadsheet, type: "Sheet" },
  { pattern: /docs\.google\.com\/document/i, icon: FileText, type: "Doc" },
  { pattern: /docs\.google\.com\/presentation/i, icon: Presentation, type: "Slides" },
  { pattern: /drive\.google\.com/i, icon: Globe, type: "Drive" },
  { pattern: /notion\.so/i, icon: FileText, type: "Notion" },
  { pattern: /figma\.com/i, icon: Figma, type: "Figma" },
  { pattern: /github\.com/i, icon: Github, type: "GitHub" },
  { pattern: /trello\.com/i, icon: Globe, type: "Trello" },
];

function shortId(url: string): string {
  // Try to extract a meaningful identifier from common patterns
  // Google Docs/Sheets/Slides: /d/{id}/
  const gdoc = url.match(/\/d\/([A-Za-z0-9_-]+)/);
  if (gdoc) return gdoc[1].slice(0, 6);
  // Notion: -{id} at end
  const notion = url.match(/-([a-f0-9]{32})/);
  if (notion) return notion[1].slice(0, 6);
  // GitHub issue/PR: #number
  const ghIssue = url.match(/github\.com\/[^/]+\/[^/]+\/(?:issues|pull)\/(\d+)/);
  if (ghIssue) return `#${ghIssue[1]}`;
  // Figma: /file/{key}
  const figma = url.match(/figma\.com\/(?:file|design)\/([A-Za-z0-9]+)/);
  if (figma) return figma[1].slice(0, 6);
  // Fallback: last non-empty path segment, truncated
  try {
    const u = new URL(url);
    const seg = u.pathname.split("/").filter(Boolean).pop() ?? "";
    if (seg) return seg.length > 12 ? seg.slice(0, 10) + "…" : seg;
    return u.hostname.replace("www.", "");
  } catch {
    return "link";
  }
}

function getLinkMeta(url: string): Meta {
  for (const { pattern, icon, type } of LINK_PATTERNS) {
    if (pattern.test(url)) return { icon, type, label: `${type} · ${shortId(url)}` };
  }
  try {
    const host = new URL(url).hostname.replace("www.", "");
    return { icon: ExternalLink, type: host, label: host };
  } catch {
    return { icon: ExternalLink, type: "link", label: "link" };
  }
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
              className="inline-flex items-center gap-1 rounded-md bg-accent px-2 py-1 text-xs font-medium text-accent-foreground hover:bg-accent/80 transition-colors max-w-[220px]"
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
          let meta: Meta;
          try {
            meta = getLinkMeta(part);
          } catch {
            return <span key={i}>{part}</span>;
          }
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
