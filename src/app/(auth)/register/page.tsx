"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Zap, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}

function RegisterForm() {
  const params = useSearchParams();
  const redirect = params.get("redirect") ?? "/dashboard";
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signUpWithEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback?next=${redirect}` },
    });
    if (error) setError(error.message);
    else setSent(true);
    setLoading(false);
  }

  async function signUpWithGoogle() {
    setLoading(true);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback?next=${redirect}` },
    });
  }

  return (
    <div className="container flex min-h-screen items-center justify-center py-12">
      <Card className="w-full max-w-md p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-value text-black">
            <Zap className="h-6 w-6" strokeWidth={3} />
          </div>
          <h1 className="font-display text-2xl font-bold">Crea tu cuenta gratis</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Accede a value bets matemáticas y parlays de alto valor.
          </p>
        </div>

        {sent ? (
          <div className="rounded-lg border border-value/40 bg-value/5 p-4 text-center text-sm">
            <Mail className="mx-auto mb-2 h-6 w-6 text-value" />
            Revisa tu correo. Te enviamos un link para activar tu cuenta.
          </div>
        ) : (
          <>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-full"
              onClick={signUpWithGoogle}
              disabled={loading}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M12.48 10.92v3.28h7.84c-.24 1.84-.85 3.18-1.73 4.1-1.08 1.08-2.77 2.27-5.71 2.27-4.55 0-8.11-3.67-8.11-8.22s3.56-8.22 8.11-8.22c2.45 0 4.24.96 5.56 2.21l2.32-2.32C18.93 1.69 16.5.5 12.48.5 5.93.5.5 5.93.5 12.5s5.43 12 11.98 12c4.04 0 7.07-1.34 9.45-3.79 2.43-2.43 3.19-5.85 3.19-8.61 0-.85-.06-1.65-.21-2.31H12.48z"
                />
              </svg>
              Registrarse con Google
            </Button>

            <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
              <div className="h-px flex-1 bg-border" />
              o con email
              <div className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={signUpWithEmail} className="space-y-3">
              <input
                type="email"
                required
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-value/40"
              />
              {error && <p className="text-xs text-destructive">{error}</p>}
              <Button type="submit" size="lg" className="w-full" disabled={loading}>
                {loading ? "Enviando..." : "Crear cuenta gratis"}
              </Button>
            </form>
          </>
        )}

        <p className="mt-6 text-center text-xs text-muted-foreground">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="underline hover:text-foreground">
            Entra aquí
          </Link>
        </p>
      </Card>
    </div>
  );
}
