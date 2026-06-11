import { useEffect, useState } from "react";

// Returns `true` when the browser thinks it has network connectivity,
// `false` when it doesn't. Backed by `navigator.onLine` plus the
// `online` / `offline` window events.
//
// Caveat: this only reflects the OS-level network interface. The browser
// can be "online" while Supabase itself is down or a corporate proxy is
// dropping requests. Surfacing failed writes (separate from offline
// detection) is the follow-on improvement.
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}
