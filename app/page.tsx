"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase";

type AuthMode = "login" | "signup" | "forgot";

export default function LoginPage() {
  const router = useRouter();
  const [authMode, setAuthMode] =
    useState<AuthMode>("login");
  const [signupName, setSignupName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");
  const [showPassword, setShowPassword] =
    useState(false);
  const [
    showConfirmPassword,
    setShowConfirmPassword,
  ] = useState(false);
  const [isPasswordRecovery, setIsPasswordRecovery] =
    useState(false);
  const [isLoggingIn, setIsLoggingIn] =
    useState(false);
  const [isGoogleLoading, setIsGoogleLoading] =
    useState(false);
  const [loginError, setLoginError] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [passwordUpdateMessage, setPasswordUpdateMessage] =
    useState("");

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
          setIsPasswordRecovery(true);
          setPasswordUpdateMessage("");
          setLoginError("");
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

  function redirectUrl() {
    return window.location.origin;
  }

  async function handleEmailAuth(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (isLoggingIn) {
      return;
    }

    const cleanEmail = email.trim();
    const cleanName = signupName.trim();

    if (!cleanEmail || !password) {
      setLoginError(
        "Bitte E-Mail-Adresse und Passwort eingeben.",
      );
      return;
    }

    if (authMode === "signup" && !cleanName) {
      setLoginError("Bitte gib deinen Namen ein.");
      return;
    }

    if (password.length < 8) {
      setLoginError(
        "Das Passwort muss mindestens 8 Zeichen lang sein.",
      );
      return;
    }

    setIsLoggingIn(true);
    setLoginError("");
    setAuthMessage("");

    try {
      if (authMode === "login") {
        const { error } =
          await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password,
          });

        if (error) {
          throw error;
        }

        router.replace("/dashboard");
      } else {
        const { data, error } =
          await supabase.auth.signUp({
            email: cleanEmail,
            password,
            options: {
              emailRedirectTo: redirectUrl(),
              data: {
                full_name: cleanName,
                name: cleanName,
              },
            },
          });

        if (error) {
          throw error;
        }

        if (!data.session) {
          setAuthMessage(
            "Öffne die Bestätigungs-Mail und bestätige deinen Account.",
          );
        }
      }
    } catch {
      setLoginError(
        "Anmeldung fehlgeschlagen. Prüfe E-Mail-Adresse, Passwort und E-Mail-Bestätigung.",
      );
    } finally {
      setIsLoggingIn(false);
    }
  }

  async function handleForgotPassword(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    const cleanEmail = email.trim();

    if (!cleanEmail) {
      setLoginError("Bitte E-Mail-Adresse eingeben.");
      return;
    }

    setIsLoggingIn(true);
    setLoginError("");
    setAuthMessage("");

    const { error } =
      await supabase.auth.resetPasswordForEmail(
        cleanEmail,
        { redirectTo: redirectUrl() },
      );

    if (error) {
      setLoginError(error.message);
    } else {
      setAuthMessage(
        "Wir haben dir einen Link zum Zurücksetzen geschickt.",
      );
    }

    setIsLoggingIn(false);
  }

  async function handlePasswordUpdate(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (password.length < 8) {
      setLoginError(
        "Das Passwort muss mindestens 8 Zeichen lang sein.",
      );
      return;
    }

    if (password !== confirmPassword) {
      setLoginError(
        "Die beiden Passwörter stimmen nicht überein.",
      );
      return;
    }

    setIsLoggingIn(true);
    setLoginError("");

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      setLoginError(error.message);
    } else {
      setPasswordUpdateMessage(
        "Das neue Passwort wurde gespeichert.",
      );
    }

    setIsLoggingIn(false);
  }

  async function handleGoogleLogin() {
    setIsGoogleLoading(true);
    setLoginError("");

    const { error } =
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: redirectUrl() },
      });

    if (error) {
      setLoginError(error.message);
      setIsGoogleLoading(false);
    }
  }

  async function resendConfirmationEmail() {
    const cleanEmail = email.trim();

    if (!cleanEmail) {
      setLoginError("Bitte E-Mail-Adresse eingeben.");
      return;
    }

    setIsLoggingIn(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: cleanEmail,
      options: { emailRedirectTo: redirectUrl() },
    });

    setIsLoggingIn(false);

    if (error) {
      setLoginError(error.message);
    } else {
      setAuthMessage(
        "Die Bestätigungs-Mail wurde erneut gesendet.",
      );
    }
  }

  if (isPasswordRecovery) {
    return (
      <main className="login-screen">
        <section className="login-card">
          <div className="login-brand">
            <div className="login-logo">
              Philamentix<span>Hub</span>
            </div>
            <p>FILAMENT MANAGEMENT</p>
          </div>

          <div className="login-heading">
            <span className="login-lock">●</span>
            <div>
              <h1>Neues Passwort</h1>
              <p>Lege ein neues Passwort für deinen Account fest.</p>
            </div>
          </div>

          <form
            className="login-form"
            onSubmit={handlePasswordUpdate}
          >
            <label>
              Neues Passwort
              <div className="password-field">
                <input
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  minLength={8}
                  value={password}
                  onChange={(event) =>
                    setPassword(
                      event.target.value,
                    )
                  }
                  placeholder="Mindestens 8 Zeichen"
                />
                <button
                  className="password-toggle"
                  type="button"
                  aria-pressed={showPassword}
                  onClick={() =>
                    setShowPassword(
                      (current) =>
                        !current,
                    )
                  }
                >
                  {showPassword
                    ? "Ausblenden"
                    : "Anzeigen"}
                </button>
              </div>
            </label>

            <label>
              Passwort wiederholen
              <div className="password-field">
                <input
                  type={
                    showConfirmPassword
                      ? "text"
                      : "password"
                  }
                  minLength={8}
                  value={confirmPassword}
                  onChange={(event) =>
                    setConfirmPassword(
                      event.target.value,
                    )
                  }
                  placeholder="Passwort erneut eingeben"
                />
                <button
                  className="password-toggle"
                  type="button"
                  aria-pressed={
                    showConfirmPassword
                  }
                  onClick={() =>
                    setShowConfirmPassword(
                      (current) =>
                        !current,
                    )
                  }
                >
                  {showConfirmPassword
                    ? "Ausblenden"
                    : "Anzeigen"}
                </button>
              </div>
            </label>

            {loginError && (
              <div className="login-error">{loginError}</div>
            )}

            {passwordUpdateMessage && (
              <div className="login-success">
                <strong>Erfolgreich</strong>
                <span>{passwordUpdateMessage}</span>
              </div>
            )}

            {!passwordUpdateMessage ? (
              <button
                className="login-button"
                type="submit"
                disabled={isLoggingIn}
              >
                {isLoggingIn
                  ? "Passwort wird geändert …"
                  : "Neues Passwort speichern"}
              </button>
            ) : (
              <button
                className="login-button"
                type="button"
                onClick={() =>
                  router.replace("/dashboard")
                }
              >
                Weiter zu Philamentix Hub
              </button>
            )}
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="login-screen">
      <section className="login-card">
        <div className="login-brand">
          <div className="login-logo">
            Philamentix<span>Hub</span>
          </div>
          <p>FILAMENT MANAGEMENT</p>
        </div>

        {authMode !== "forgot" ? (
          <div className="login-mode-switch">
            <button
              type="button"
              className={authMode === "login" ? "active" : ""}
              onClick={() => {
                setAuthMode("login");
                setLoginError("");
                setAuthMessage("");
              }}
            >
              Anmelden
            </button>
            <button
              type="button"
              className={authMode === "signup" ? "active" : ""}
              onClick={() => {
                setAuthMode("signup");
                setLoginError("");
                setAuthMessage("");
              }}
            >
              Account erstellen
            </button>
          </div>
        ) : (
          <button
            className="login-back-button"
            type="button"
            onClick={() => {
              setAuthMode("login");
              setLoginError("");
              setAuthMessage("");
            }}
          >
            ← Zurück zur Anmeldung
          </button>
        )}

        <div className="login-heading">
          <span className="login-lock">●</span>
          <div>
            <h1>
              {authMode === "login"
                ? "Willkommen zurück"
                : authMode === "signup"
                  ? "Neuen Account erstellen"
                  : "Passwort vergessen?"}
            </h1>
            <p>
              {authMode === "login"
                ? "Melde dich an, um auf das Filamentlager zuzugreifen."
                : authMode === "signup"
                  ? "Nach der Registrierung erhältst du eine E-Mail zur Bestätigung deines Accounts."
                  : "Gib deine E-Mail-Adresse ein. Du erhältst einen Link zum Zurücksetzen."}
            </p>
          </div>
        </div>

        {authMode !== "forgot" && (
          <>
            <button
              className="google-login-button"
              type="button"
              disabled={isGoogleLoading}
              onClick={() => void handleGoogleLogin()}
            >
              <span className="google-mark" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="20" height="20">
                  <path fill="#4285F4" d="M21.35 12.23c0-.71-.06-1.4-.2-2.07H12v3.91h5.23a4.48 4.48 0 0 1-1.94 2.94v2.54h3.14c1.84-1.69 2.92-4.18 2.92-7.32Z" />
                  <path fill="#34A853" d="M12 21.72c2.63 0 4.84-.87 6.45-2.37l-3.14-2.54c-.87.58-1.98.92-3.31.92-2.54 0-4.69-1.72-5.46-4.02H3.3v2.62A9.73 9.73 0 0 0 12 21.72Z" />
                  <path fill="#FBBC05" d="M6.54 13.71a5.85 5.85 0 0 1 0-3.74V7.35H3.3a9.73 9.73 0 0 0 0 8.98l3.24-2.62Z" />
                  <path fill="#EA4335" d="M12 5.95c1.43 0 2.71.49 3.72 1.45l2.79-2.79A9.35 9.35 0 0 0 12 2.28a9.73 9.73 0 0 0-8.7 5.07l3.24 2.62C7.31 7.67 9.46 5.95 12 5.95Z" />
                </svg>
              </span>
              {isGoogleLoading
                ? "Weiterleitung zu Google …"
                : "Mit Google fortfahren"}
            </button>
            <div className="login-divider">
              <span>oder mit E-Mail</span>
            </div>
          </>
        )}

        <form
          className="login-form"
          onSubmit={
            authMode === "forgot"
              ? handleForgotPassword
              : handleEmailAuth
          }
        >
          {authMode === "signup" && (
            <label>
              Name
              <input
                type="text"
                autoComplete="name"
                value={signupName}
                onChange={(event) =>
                  setSignupName(event.target.value)
                }
                placeholder="Dein Name"
                autoFocus
              />
            </label>
          )}

          <label>
            E-Mail-Adresse
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              placeholder="name@beispiel.de"
              autoFocus={authMode !== "signup"}
            />
          </label>

          {authMode !== "forgot" && (
            <label>
              Passwort
              <div className="password-field">
                <input
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  autoComplete={
                    authMode === "signup"
                      ? "new-password"
                      : "current-password"
                  }
                  value={password}
                  onChange={(event) =>
                    setPassword(
                      event.target.value,
                    )
                  }
                  placeholder="Mindestens 8 Zeichen"
                />
                <button
                  className="password-toggle"
                  type="button"
                  aria-label={
                    showPassword
                      ? "Passwort ausblenden"
                      : "Passwort anzeigen"
                  }
                  aria-pressed={showPassword}
                  onClick={() =>
                    setShowPassword(
                      (current) =>
                        !current,
                    )
                  }
                >
                  {showPassword
                    ? "Ausblenden"
                    : "Anzeigen"}
                </button>
              </div>
            </label>
          )}

          {authMode === "login" && (
            <button
              className="forgot-password-button"
              type="button"
              onClick={() => {
                setAuthMode("forgot");
                setLoginError("");
                setAuthMessage("");
              }}
            >
              Passwort vergessen?
            </button>
          )}

          {loginError && (
            <div className="login-error">{loginError}</div>
          )}

          {authMessage && (
            <div className="login-success">
              <strong>
                {authMode === "forgot"
                  ? "E-Mail gesendet"
                  : "Fast geschafft"}
              </strong>
              <span>{authMessage}</span>
              {authMode === "signup" && (
                <button
                  type="button"
                  onClick={() =>
                    void resendConfirmationEmail()
                  }
                  disabled={isLoggingIn}
                >
                  Bestätigungs-Mail erneut senden
                </button>
              )}
            </div>
          )}

          <button
            className="login-button"
            type="submit"
            disabled={isLoggingIn}
          >
            {isLoggingIn
              ? "Bitte warten …"
              : authMode === "login"
                ? "Bei Philamentix Hub anmelden"
                : authMode === "signup"
                  ? "Account erstellen"
                  : "Reset-Link senden"}
          </button>
        </form>

        <p className="login-security-note">
          {authMode === "signup"
            ? "Die E-Mail-Adresse muss vor dem ersten Login bestätigt werden."
            : authMode === "forgot"
              ? "Der Reset-Link ist nur für kurze Zeit gültig."
              : "Zugriff nur für angemeldete Benutzer"}
        </p>
      </section>
    </main>
  );
}
