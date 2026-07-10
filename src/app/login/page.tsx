"use client";

// Owner/staff sign-in (§3.6: email+password, no self-signup). Styled with
// design-system tokens/components only.
import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Card, Input } from "@/components/ds";
import { authClient } from "@/lib/auth/client";

export default function LoginPage() {
  return (
    <React.Suspense fallback={null}>
      <LoginForm />
    </React.Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  // "credentials" -> email+password; "totp" -> the second factor challenge
  // src/lib/auth/totp-login-gate.ts's after-hook returns instead of a
  // session when the account has 2FA enabled.
  const [stage, setStage] = React.useState<"credentials" | "totp">("credentials");

  const goToNext = () => {
    const next = searchParams.get("next") ?? "/admin";
    router.push(next);
    router.refresh();
  };

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { data, error: signInError } = await authClient.signIn.email({ email, password });
    setSubmitting(false);
    if (signInError) {
      setError(signInError.message ?? "Invalid email or password.");
      return;
    }
    // The credential sign-in succeeded, but src/lib/auth/totp-login-gate.ts's
    // after-hook intercepts the response for any account with 2FA enabled:
    // it deletes the session it would have granted and returns this flag
    // instead. The client SDK's response type doesn't know about that
    // custom shape, hence the cast.
    const twoFactorRequired = (data as unknown as { twoFactorRequired?: boolean } | null)?.twoFactorRequired;
    if (twoFactorRequired) {
      setStage("totp");
      return;
    }
    goToNext();
  };

  const handleTotpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const response = await fetch("/api/auth/rpm-2fa/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    setSubmitting(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.message ?? "Invalid code.");
      return;
    }
    goToNext();
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--sp-5)",
      }}
    >
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ textAlign: "center", marginBottom: "var(--sp-6)" }}>
          <span style={{ fontFamily: "var(--font-accent)", fontSize: 34, color: "var(--rpm-cream)" }}>
            <span style={{ color: "var(--accent-primary)" }}>R</span>PM
          </span>
          <div
            style={{
              fontFamily: "var(--font-heading)",
              textTransform: "uppercase",
              letterSpacing: "var(--ls-wide)",
              fontSize: 13,
              color: "var(--text-muted)",
              marginTop: "var(--sp-1)",
            }}
          >
            Menu Manager
          </div>
        </div>

        <Card>
          {stage === "credentials" ? (
            <form
              onSubmit={handleCredentialsSubmit}
              style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}
            >
              <Input
                label="Email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="owner@rpmpub.com"
                required
              />
              <Input
                label="Password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
              {error && (
                <p style={{ color: "var(--accent-primary)", fontFamily: "var(--font-body)", fontSize: "0.875rem", margin: 0 }}>
                  {error}
                </p>
              )}
              <Button type="submit" fullWidth disabled={submitting}>
                {submitting ? "Signing In…" : "Sign In"}
              </Button>
            </form>
          ) : (
            <form
              onSubmit={handleTotpSubmit}
              style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}
            >
              <p style={{ color: "var(--text-secondary)", fontFamily: "var(--font-body)", fontSize: "0.875rem", margin: 0 }}>
                Enter the 6-digit code from your authenticator app, or one of your backup codes.
              </p>
              <Input
                label="Verification Code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                autoFocus
                required
              />
              {error && (
                <p style={{ color: "var(--accent-primary)", fontFamily: "var(--font-body)", fontSize: "0.875rem", margin: 0 }}>
                  {error}
                </p>
              )}
              <Button type="submit" fullWidth disabled={submitting}>
                {submitting ? "Verifying…" : "Verify"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                fullWidth
                disabled={submitting}
                onClick={() => {
                  setStage("credentials");
                  setCode("");
                  setError(null);
                }}
              >
                Back to Sign In
              </Button>
            </form>
          )}
        </Card>

        <p
          style={{
            textAlign: "center",
            marginTop: "var(--sp-4)",
            color: "var(--text-faint)",
            fontFamily: "var(--font-body)",
            fontSize: "0.8125rem",
          }}
        >
          No self-signup — ask an owner to invite you.
        </p>
      </div>
    </div>
  );
}
