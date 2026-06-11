import { useEffect, useRef } from "react";
import { WifiOff } from "lucide-react";
import { toast } from "sonner";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

const OFFLINE_TOAST_ID = "pumped-offline-toast";
const BACK_ONLINE_TOAST_ID = "pumped-back-online-toast";

export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const prevOnlineRef = useRef<boolean | null>(null);

  useEffect(() => {
    const prev = prevOnlineRef.current;
    prevOnlineRef.current = isOnline;

    // First render — only show the offline toast if we *start* offline.
    // We don't show a "Back online" toast on initial load because nothing
    // had a chance to go wrong yet.
    if (prev === null) {
      if (!isOnline) {
        toast.error("You're offline", {
          id: OFFLINE_TOAST_ID,
          description: "Edits will appear to save locally but won't reach the server. Reconnect before editing tasks.",
          duration: Infinity,
        });
      }
      return;
    }

    if (prev && !isOnline) {
      toast.error("You went offline", {
        id: OFFLINE_TOAST_ID,
        description: "Edits will appear to save locally but won't reach the server. Reconnect before editing tasks.",
        duration: Infinity,
      });
    } else if (!prev && isOnline) {
      toast.dismiss(OFFLINE_TOAST_ID);
      toast.success("Back online", {
        id: BACK_ONLINE_TOAST_ID,
        description: "Refresh the page to make sure you have the latest data, then continue.",
      });
    }
  }, [isOnline]);

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="border-t border-amber-500/40 bg-amber-500/15 text-amber-900 dark:text-amber-100"
    >
      <div className="flex items-start gap-2 px-3 py-2 sm:px-6 text-sm">
        <WifiOff className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <div className="leading-snug">
          <strong>You're offline.</strong>{" "}
          Edits made now <em>will not save</em> when you reconnect — they only update the local view. Stop editing until this banner clears.
        </div>
      </div>
    </div>
  );
}
