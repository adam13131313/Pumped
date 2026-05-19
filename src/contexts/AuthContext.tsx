import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/lib/store";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const loadAllData = useAppStore((s) => s.loadAllData);
  const resetTenancy = useAppStore((s) => s.resetTenancy);
  const loadedUserIdRef = useRef<string | null>(null);
  const loadingUserIdRef = useRef<string | null>(null);

  const loadSessionData = (nextSession: Session | null) => {
    const userId = nextSession?.user.id ?? null;
    if (!userId) {
      loadedUserIdRef.current = null;
      loadingUserIdRef.current = null;
      resetTenancy();
      return;
    }
    if (loadedUserIdRef.current === userId || loadingUserIdRef.current === userId) return;

    loadingUserIdRef.current = userId;
    loadAllData()
      .then(() => {
        loadedUserIdRef.current = userId;
      })
      .catch((err) => {
        console.error("loadAllData failed", err);
      })
      .finally(() => {
        if (loadingUserIdRef.current === userId) loadingUserIdRef.current = null;
      });
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
      loadSessionData(session);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      loadSessionData(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    resetTenancy();
    loadedUserIdRef.current = null;
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
