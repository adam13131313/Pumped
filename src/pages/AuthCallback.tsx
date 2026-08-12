import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

// Landing target for the confirmation link Supabase Auth sends after signup,
// password reset, magic-link, and email-change flows. Its job is to give the
// user a clear "verified — signing you in" moment (vs. the previous silent
// redirect to `/` which left users unsure whether verification worked), and
// to surface a useful error state when the link has expired / been used.
//
// Supabase-js processes the URL fragment / `?code=` param automatically on
// client load, which is what causes `session` to flip in useAuth once the
// session gets established. This component just waits for that transition
// and then navigates the user into the app.

export default function AuthCallback() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    // Supabase surfaces failed verifications as query-string errors on the
    // redirect URL. Extract them so the user sees something useful instead
    // of an infinite spinner.
    const params = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const err = params.get("error_description") || hash.get("error_description")
      || params.get("error") || hash.get("error");
    if (err) setErrorMessage(err.replace(/\+/g, " "));
  }, []);

  useEffect(() => {
    if (session) {
      // Give the "verified" screen a beat to breathe before dropping the user
      // into the app. Feels more like a confirmation, less like a flicker.
      const t = setTimeout(() => navigate("/", { replace: true }), 900);
      return () => clearTimeout(t);
    }
  }, [session, navigate]);

  const state: "verifying" | "success" | "error" =
    errorMessage ? "error"
    : session ? "success"
    : "verifying";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6 text-center">
        <img src="/logo-navbar-dark.png" alt="Pumped" className="mx-auto h-10 w-auto object-contain" />

        {state === "verifying" && (
          <>
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
            <div>
              <h1 className="text-xl font-semibold">Confirming your email…</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {loading ? "One moment." : "Almost there — signing you in."}
              </p>
            </div>
          </>
        )}

        {state === "success" && (
          <>
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
            <div>
              <h1 className="text-xl font-semibold">You're in.</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Loading your workspace…
              </p>
            </div>
          </>
        )}

        {state === "error" && (
          <>
            <AlertCircle className="mx-auto h-10 w-10 text-destructive" />
            <div>
              <h1 className="text-xl font-semibold">Couldn't verify your email</h1>
              <p className="text-sm text-muted-foreground mt-1">{errorMessage}</p>
              <p className="text-xs text-muted-foreground mt-3">
                The link may have expired or already been used. Sign in below to request a new one.
              </p>
            </div>
            <Button asChild className="w-full">
              <Link to="/auth">Back to sign in</Link>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
