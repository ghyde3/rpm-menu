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
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error: signInError } = await authClient.signIn.email({ email, password });
    setSubmitting(false);
    if (signInError) {
      setError(signInError.message ?? "Invalid email or password.");
      return;
    }
    const next = searchParams.get("next") ?? "/admin";
    router.push(next);
    router.refresh();
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
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
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
