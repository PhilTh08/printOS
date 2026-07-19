"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase";
import styles from "./page.module.css";

type AuthMode = "login" | "signup" | "forgot";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] =
    useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] =
    useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");
  const [recoveryMode, setRecoveryMode] =
    useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (active && data.session) {
        router.replace("/dashboard");
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!active) {
          return;
        }

        if (event === "PASSWORD_RECOVERY") {
          setRecoveryMode(true);
          setError("");
          setMessage(
            "Lege jetzt dein neues Passwort fest.",
          );
          return;
        }

        if (session) {
          router.replace("/dashboard");
        }
      },
    );

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [router]);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (busy) {
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");

    try {
      if (recoveryMode) {
        if (password.length < 8) {
          throw new Error(
            "Das Passwort muss mindestens 8 Zeichen lang sein.",
          );
        }

        if (password !== confirmPassword) {
          throw new Error(
            "Die Passwörter stimmen nicht überein.",
          );
        }

        const { error: updateError } =
          await supabase.auth.updateUser({
            password,
          });

        if (updateError) {
          throw updateError;
        }

        setMessage(
          "Passwort geändert. Du wirst weitergeleitet.",
        );
        router.replace("/dashboard");
        return;
      }

      if (mode === "forgot") {
        const { error: resetError } =
          await supabase.auth.resetPasswordForEmail(
            email.trim(),
            {
              redirectTo: window.location.origin,
            },
          );

        if (resetError) {
          throw resetError;
        }

        setMessage(
          "Wir haben dir einen Link zum Zurücksetzen geschickt.",
        );
        return;
      }

      if (mode === "signup") {
        if (!name.trim()) {
          throw new Error(
            "Bitte gib deinen Namen ein.",
          );
        }

        if (password.length < 8) {
          throw new Error(
            "Das Passwort muss mindestens 8 Zeichen lang sein.",
          );
        }

        const { data, error: signupError } =
          await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: {
              emailRedirectTo:
                window.location.origin,
              data: {
                full_name: name.trim(),
                name: name.trim(),
              },
            },
          });

        if (signupError) {
          throw signupError;
        }

        if (!data.session) {
          setMessage(
            "Account erstellt. Bitte bestätige deine E-Mail.",
          );
        }
        return;
      }

      const { error: loginError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (loginError) {
        throw loginError;
      }

      router.replace("/dashboard");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Anmeldung fehlgeschlagen.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogleLogin() {
    setBusy(true);
    setError("");

    const { error: googleError } =
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
        },
      });

    if (googleError) {
      setError(googleError.message);
      setBusy(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <div className={styles.brand}>
          <span>P</span>
          <div>
            <strong>Philamentix Hub</strong>
            <small>Filamentlager</small>
          </div>
        </div>

        <div className={styles.heading}>
          <span>
            {recoveryMode
              ? "Sicherheit"
              : mode === "signup"
                ? "Neuer Account"
                : mode === "forgot"
                  ? "Passwort zurücksetzen"
                  : "Willkommen zurück"}
          </span>
          <h1>
            {recoveryMode
              ? "Neues Passwort"
              : mode === "signup"
                ? "Account erstellen"
                : mode === "forgot"
                  ? "Zugang wiederherstellen"
                  : "Anmelden"}
          </h1>
        </div>

        {(message || error) && (
          <div
            className={`${styles.feedback} ${
              error ? styles.error : styles.success
            }`}
          >
            {error || message}
          </div>
        )}

        <form
          className={styles.form}
          onSubmit={handleSubmit}
        >
          {mode === "signup" && !recoveryMode && (
            <label>
              Name
              <input
                value={name}
                onChange={(event) =>
                  setName(event.target.value)
                }
                autoComplete="name"
              />
            </label>
          )}

          {!recoveryMode && (
            <label>
              E-Mail
              <input
                type="email"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                autoComplete="email"
                required
              />
            </label>
          )}

          {mode !== "forgot" && (
            <label>
              Passwort
              <input
                type="password"
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                autoComplete={
                  mode === "login"
                    ? "current-password"
                    : "new-password"
                }
                required
              />
            </label>
          )}

          {recoveryMode && (
            <label>
              Passwort bestätigen
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) =>
                  setConfirmPassword(
                    event.target.value,
                  )
                }
                autoComplete="new-password"
                required
              />
            </label>
          )}

          <button
            className={styles.primary}
            type="submit"
            disabled={busy}
          >
            {busy
              ? "Bitte warten …"
              : recoveryMode
                ? "Passwort speichern"
                : mode === "signup"
                  ? "Account erstellen"
                  : mode === "forgot"
                    ? "Link senden"
                    : "Anmelden"}
          </button>
        </form>

        {!recoveryMode && mode === "login" && (
          <button
            className={styles.google}
            type="button"
            disabled={busy}
            onClick={() => void handleGoogleLogin()}
          >
            Mit Google anmelden
          </button>
        )}

        {!recoveryMode && (
          <div className={styles.switches}>
            {mode !== "login" && (
              <button
                type="button"
                onClick={() => setMode("login")}
              >
                Zur Anmeldung
              </button>
            )}
            {mode === "login" && (
              <>
                <button
                  type="button"
                  onClick={() => setMode("signup")}
                >
                  Account erstellen
                </button>
                <button
                  type="button"
                  onClick={() => setMode("forgot")}
                >
                  Passwort vergessen?
                </button>
              </>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
