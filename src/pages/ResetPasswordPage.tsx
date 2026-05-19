import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Lock, ArrowRight, Loader2, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const navigate = useNavigate();

  const [verifying, setVerifying] = useState(true);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
        setVerifying(false);
      }
    });

    (async () => {
      const params = new URLSearchParams(window.location.search);
      const tokenHash = params.get("token_hash");
      const type = params.get("type");
      const errorDesc = params.get("error_description") ?? new URLSearchParams(window.location.hash.slice(1)).get("error_description");

      if (errorDesc) {
        setVerifyError(errorDesc);
        setVerifying(false);
        return;
      }

      // Modern PKCE / OTP flow: ?token_hash=...&type=recovery
      if (tokenHash && type === "recovery") {
        const { error } = await supabase.auth.verifyOtp({ type: "recovery", token_hash: tokenHash });
        if (error) setVerifyError(error.message);
        else setIsRecovery(true);
        setVerifying(false);
        return;
      }

      // Legacy implicit flow: #access_token=...&type=recovery (auto-handled by supabase-js)
      if (window.location.hash.includes("type=recovery")) {
        setIsRecovery(true);
        setVerifying(false);
        return;
      }

      // Already in a recovery session
      const { data: { session } } = await supabase.auth.getSession();
      if (session) setIsRecovery(true);
      setVerifying(false);
    })();

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast.error("Failed to reset password", { description: error.message });
    } else {
      setSuccess(true);
      toast.success("Password updated successfully");
      setTimeout(() => navigate("/"), 2000);
    }
    setLoading(false);
  };

  if (verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isRecovery) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md border-border shadow-lg">
          <CardHeader>
            <CardTitle>Link expired or already used</CardTitle>
            <CardDescription>
              {verifyError
                ? `${verifyError}. Reset links expire quickly and can only be used once — please request a new one.`
                : "This password reset link is invalid, expired, or was already used. Please request a new one."}
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={() => navigate("/auth")} className="w-full">
              Back to Sign In
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md border-border shadow-lg text-center">
          <CardHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <CheckCircle className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Password Updated</CardTitle>
            <CardDescription>Redirecting you to the app…</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-3">
          <img src="/logo-navbar-dark.png" alt="Pumped" className="mx-auto h-9 w-auto object-contain" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Set New Password</h1>
          <p className="text-muted-foreground text-sm">Choose a new password for your account</p>
        </div>
        <Card className="border-border shadow-lg">
          <form onSubmit={handleSubmit}>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Reset Password</CardTitle>
              <CardDescription>Enter your new password below</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    className="pl-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    className="pl-10"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                  <>Update Password <ArrowRight className="ml-2 h-4 w-4" /></>
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
