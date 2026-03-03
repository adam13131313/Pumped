import { ExternalLink, FileSpreadsheet, FileText, Presentation, Globe } from "lucide-react";

const LINK_PATTERNS: { pattern: RegExp; icon: typeof Globe; label: string }[] = [
  { pattern: /docs\.google\.com\/spreadsheets/i, icon: FileSpreadsheet, label: "Google Sheet" },
  { pattern: /docs\.google\.com\/document/i, icon: FileText, label: "Google Doc" },
  { pattern: /docs\.google\.com\/presentation/i, icon: Presentation, label: "Google Slides" },
  { pattern: /drive\.google\.com/i, icon: Globe, label: "Google Drive" },
  { pattern: /notion\.so/i, icon: FileText, label: "Notion" },
  { pattern: /figma\.com/i, icon: Globe, label: "Figma" },
  { pattern: /github\.com/i, icon: Globe, label: "GitHub" },
  { pattern: /trello\.com/i, icon: Globe, label: "Trello" },
];

function getLinkMeta(url: string) {
  for (const { pattern, icon, label } of LINK_PATTERNS) {
    if (pattern.test(url)) return { icon, label };
  }
  return { icon: ExternalLink, label: new URL(url).hostname.replace("www.", "") };
}

const URL_REGEX = /(https?:\/\/[^\s<]+)/g;

interface LinkRendererProps {
  text: string;
}

export function LinkRenderer({ text }: LinkRendererProps) {
  const parts = text.split(URL_REGEX);
  if (parts.length === 1) return <span>{text}</span>;

  return (
    <span>
      {parts.map((part, i) => {
        if (URL_REGEX.test(part)) {
          URL_REGEX.lastIndex = 0;
          let meta: { icon: typeof Globe; label: string };
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
