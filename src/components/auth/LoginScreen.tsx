"use client";

import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from "firebase/auth";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { auth } from "@/lib/firebase/client";
import { Button, Field, inputClass, Spinner } from "@/components/ui/primitives";

const ERRORS: Record<string, string> = {
  "auth/invalid-credential": "E-mail ou mot de passe incorrect.",
  "auth/wrong-password": "Mot de passe incorrect.",
  "auth/user-not-found": "Aucun compte avec cet e-mail.",
  "auth/email-already-in-use": "Un compte existe déjà avec cet e-mail.",
  "auth/weak-password": "Mot de passe trop court (6 caractères minimum).",
  "auth/invalid-email": "Adresse e-mail invalide.",
  "auth/popup-closed-by-user": "Connexion Google annulée.",
  "auth/unauthorized-domain": "Ce domaine n'est pas autorisé pour la connexion Google (console Firebase → Authentication → Domaines autorisés).",
  "auth/network-request-failed": "Pas de connexion réseau.",
};

function PasswordInput({
  value,
  onChange,
  visible,
  onToggle,
  autoComplete,
  invalid,
}: {
  value: string;
  onChange(v: string): void;
  visible: boolean;
  onToggle(): void;
  autoComplete: string;
  invalid?: boolean;
}) {
  return (
    <div className="relative">
      <input
        className={`${inputClass} pr-12 ${invalid ? "border-danger focus:border-danger" : ""}`}
        type={visible ? "text" : "password"}
        required
        minLength={6}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
      />
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          onToggle();
        }}
        className="absolute top-1/2 right-2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:bg-surface-3 hover:text-text"
        aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        title={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}

export function LoginScreen() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await fn();
    } catch (e) {
      const code = (e as { code?: string }).code ?? "";
      setError(ERRORS[code] ?? (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      if (mode === "signin") await signInWithEmailAndPassword(auth(), email.trim(), password);
      else {
        if (password !== confirm) throw new Error("Les mots de passe ne correspondent pas.");
        const cred = await createUserWithEmailAndPassword(auth(), email.trim(), password);
        if (name.trim()) await updateProfile(cred.user, { displayName: name.trim() });
      }
    });
  };

  return (
    <main className="flex min-h-full items-center justify-center p-6">
      <div className="w-full max-w-md animate-slide-up">
        <div className="mb-8 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon.svg" alt="" className="mx-auto mb-4 h-20 w-20 rounded-[1.4rem] shadow-card" />
          <h1 className="text-3xl font-semibold tracking-tight">HomeCal</h1>
          <p className="mt-1 text-muted">Le calendrier de la maison</p>
        </div>

        <div className="rounded-[1.75rem] border border-border bg-surface p-6 shadow-card">
          <div className="mb-5 grid grid-cols-2 rounded-full bg-surface-2 p-1">
            {(["signin", "signup"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`h-10 rounded-full text-sm font-medium transition ${mode === m ? "bg-surface shadow-sm" : "text-muted"}`}
              >
                {m === "signin" ? "Se connecter" : "Créer un compte"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-4">
            {mode === "signup" && (
              <Field label="Prénom">
                <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" />
              </Field>
            )}
            <Field label="E-mail">
              <input className={inputClass} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </Field>
            <Field label="Mot de passe">
              <PasswordInput
                value={password}
                onChange={setPassword}
                visible={showPassword}
                onToggle={() => setShowPassword((v) => !v)}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
              />
            </Field>
            {mode === "signup" && (
              <Field label="Confirmer le mot de passe">
                <PasswordInput
                  value={confirm}
                  onChange={setConfirm}
                  visible={showPassword}
                  onToggle={() => setShowPassword((v) => !v)}
                  autoComplete="new-password"
                  invalid={confirm.length > 0 && confirm !== password}
                />
                {confirm.length > 0 && (
                  <span className={`mt-1 block text-xs ${confirm === password ? "text-ok" : "text-danger"}`}>
                    {confirm === password ? "✓ Les mots de passe correspondent" : "Les mots de passe ne correspondent pas"}
                  </span>
                )}
              </Field>
            )}
            {error && <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
            {info && <p className="rounded-xl bg-ok/10 px-3 py-2 text-sm text-ok">{info}</p>}
            <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy || (mode === "signup" && confirm !== password)}>
              {busy && <Spinner />}
              {mode === "signin" ? "Se connecter" : "Créer mon compte"}
            </Button>
          </form>

          <div className="my-5 flex items-center gap-3 text-xs text-muted">
            <span className="h-px flex-1 bg-border" />
            ou
            <span className="h-px flex-1 bg-border" />
          </div>

          <Button
            size="lg"
            className="w-full"
            disabled={busy}
            onClick={() => run(() => signInWithPopup(auth(), new GoogleAuthProvider()))}
          >
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
              <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.4-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
            </svg>
            Continuer avec Google
          </Button>

          {mode === "signin" && (
            <button
              type="button"
              className="mt-4 w-full text-center text-sm text-muted hover:text-text"
              onClick={() =>
                run(async () => {
                  if (!email.trim()) throw new Error("Saisissez votre e-mail ci-dessus.");
                  const a = auth();
                  a.languageCode = "fr"; // e-mail and reset page in French
                  await sendPasswordResetEmail(a, email.trim());
                  setInfo("Si un compte existe pour cette adresse, un e-mail de réinitialisation vient d'être envoyé. Pensez à vérifier vos spams.");
                })
              }
            >
              Mot de passe oublié ?
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
