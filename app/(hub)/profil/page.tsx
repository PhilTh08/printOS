"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import { useHub } from "@/components/philamentix/hub-provider";
import { supabase } from "@/lib/supabase";

import styles from "./page.module.css";

export default function ProfilePage() {
  const router = useRouter();
  const {
    user,
    displayName,
    updateProfileName,
    updatePassword,
    signOut,
  } = useHub();
  const [profileName, setProfileName] =
    useState(displayName);
  const [profilePassword, setProfilePassword] =
    useState("");
  const [profilePasswordConfirm, setProfilePasswordConfirm] =
    useState("");
  const [
    showProfilePassword,
    setShowProfilePassword,
  ] = useState(false);
  const [
    showProfilePasswordConfirm,
    setShowProfilePasswordConfirm,
  ] = useState(false);
  const [
    deleteEmail,
    setDeleteEmail,
  ] = useState("");
  const [
    deleteConfirmation,
    setDeleteConfirmation,
  ] = useState("");
  const [
    deletingAccount,
    setDeletingAccount,
  ] = useState(false);
  const [profileMessage, setProfileMessage] =
    useState("");
  const [profileError, setProfileError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setProfileName(displayName);
  }, [displayName]);

  async function saveName(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setSaving(true);
    setProfileMessage("");
    setProfileError("");

    try {
      await updateProfileName(profileName);
      setProfileMessage("Der Anzeigename wurde gespeichert.");
    } catch (caughtError) {
      setProfileError(
        caughtError instanceof Error
          ? caughtError.message
          : "Name konnte nicht gespeichert werden.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function savePassword(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setProfileMessage("");
    setProfileError("");

    if (profilePassword !== profilePasswordConfirm) {
      setProfileError(
        "Die beiden Passwörter stimmen nicht überein.",
      );
      return;
    }

    setSaving(true);

    try {
      await updatePassword(profilePassword);
      setProfilePassword("");
      setProfilePasswordConfirm("");
      setProfileMessage("Das Passwort wurde aktualisiert.");
    } catch (caughtError) {
      setProfileError(
        caughtError instanceof Error
          ? caughtError.message
          : "Passwort konnte nicht geändert werden.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    await signOut();
    router.replace("/");
  }

  async function deleteAccount(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setProfileMessage("");
    setProfileError("");

    if (
      deleteEmail.trim().toLowerCase() !==
      (user?.email ?? "").toLowerCase()
    ) {
      setProfileError(
        "Die eingegebene E-Mail-Adresse stimmt nicht mit deinem Konto überein.",
      );
      return;
    }

    if (
      deleteConfirmation.trim() !==
      "KONTO LÖSCHEN"
    ) {
      setProfileError(
        "Gib zur Bestätigung exakt „KONTO LÖSCHEN“ ein.",
      );
      return;
    }

    const confirmed = window.confirm(
      "Dein Konto und deine Philamentix-Daten werden dauerhaft gelöscht. Dieser Vorgang kann nicht rückgängig gemacht werden.",
    );

    if (!confirmed) {
      return;
    }

    setDeletingAccount(true);

    try {
      const {
        data: sessionData,
        error: sessionError,
      } =
        await supabase.auth.getSession();

      if (
        sessionError ||
        !sessionData.session
      ) {
        throw new Error(
          "Deine Sitzung ist nicht mehr gültig.",
        );
      }

      const response = await fetch(
        "/api/account/delete",
        {
          method: "DELETE",
          headers: {
            "Content-Type":
              "application/json",
            Authorization:
              `Bearer ${sessionData.session.access_token}`,
          },
          body: JSON.stringify({
            email:
              deleteEmail.trim(),
            confirmation:
              deleteConfirmation.trim(),
          }),
        },
      );

      const result = (await response.json()) as {
        deleted?: boolean;
        error?: string;
      };

      if (
        !response.ok ||
        !result.deleted
      ) {
        throw new Error(
          result.error ??
            "Konto konnte nicht gelöscht werden.",
        );
      }

      try {
        await supabase.auth.signOut({
          scope: "local",
        });
      } catch {
        // Der Account ist bereits gelöscht.
        // Die lokale Weiterleitung darf dadurch
        // nicht blockiert werden.
      }

      router.replace("/");
      router.refresh();
    } catch (caughtError) {
      setProfileError(
        caughtError instanceof Error
          ? caughtError.message
          : "Konto konnte nicht gelöscht werden.",
      );
      setDeletingAccount(false);
    }
  }

  return (
    <div className={styles.page}>
      <header className="topbar">
        <div>
          <span className="welcome-label">Konto</span>
          <h1>Profil & Sicherheit</h1>
          <p>
            Persönliche Daten und Zugangsdaten verwalten
          </p>
        </div>

        <div className="system-status">
          <span className="status-dot" />
          Konto geschützt
        </div>
      </header>

      {(profileMessage || profileError) && (
        <div
          className={`profile-feedback ${
            profileError
              ? "profile-feedback-error"
              : "profile-feedback-success"
          }`}
        >
          {profileError || profileMessage}
        </div>
      )}

      <section className="profile-grid">
        <article className="panel profile-card profile-overview-card">
          <div className="profile-avatar">
            {(displayName || user?.email || "P")
              .trim()
              .charAt(0)
              .toUpperCase()}
          </div>

          <div>
            <span className="profile-eyebrow">
              Philamentix Hub Account
            </span>
            <h2>{displayName}</h2>
            <p>{user?.email}</p>
          </div>

          <div className="profile-status-row">
            <span className="profile-status-dot" />
            Angemeldet und synchronisiert
          </div>
        </article>

        <article className="panel profile-card">
          <div className="profile-card-heading">
            <div>
              <span className="profile-section-number">01</span>
              <h2>Persönliche Daten</h2>
            </div>
            <p>
              Dieser Name wird im Dashboard und in deinem Konto angezeigt.
            </p>
          </div>

          <form className="profile-form" onSubmit={saveName}>
            <label>
              Anzeigename
              <input
                type="text"
                autoComplete="name"
                value={profileName}
                onChange={(event) =>
                  setProfileName(event.target.value)
                }
                placeholder="Dein Name"
              />
            </label>

            <label>
              E-Mail-Adresse
              <input
                type="email"
                value={user?.email ?? ""}
                disabled
              />
              <small>
                Die E-Mail-Adresse ist mit deinem Supabase-Konto verknüpft.
              </small>
            </label>

            <div className="profile-form-actions">
              <button
                className="primary-button"
                type="submit"
                disabled={saving}
              >
                {saving
                  ? "Wird gespeichert …"
                  : "Name speichern"}
              </button>
            </div>
          </form>
        </article>

        <article className="panel profile-card">
          <div className="profile-card-heading">
            <div>
              <span className="profile-section-number">02</span>
              <h2>Passwort ändern</h2>
            </div>
            <p>
              Verwende mindestens acht Zeichen und ein einzigartiges Passwort.
            </p>
          </div>

          <form
            className="profile-form"
            onSubmit={savePassword}
          >
            <label>
              Neues Passwort
              <div className="password-field">
                <input
                  type={
                    showProfilePassword
                      ? "text"
                      : "password"
                  }
                  minLength={8}
                  autoComplete="new-password"
                  value={profilePassword}
                  onChange={(event) =>
                    setProfilePassword(
                      event.target.value,
                    )
                  }
                  placeholder="Mindestens 8 Zeichen"
                />
                <button
                  className="password-toggle"
                  type="button"
                  aria-pressed={
                    showProfilePassword
                  }
                  onClick={() =>
                    setShowProfilePassword(
                      (current) =>
                        !current,
                    )
                  }
                >
                  {showProfilePassword
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
                    showProfilePasswordConfirm
                      ? "text"
                      : "password"
                  }
                  minLength={8}
                  autoComplete="new-password"
                  value={
                    profilePasswordConfirm
                  }
                  onChange={(event) =>
                    setProfilePasswordConfirm(
                      event.target.value,
                    )
                  }
                  placeholder="Passwort erneut eingeben"
                />
                <button
                  className="password-toggle"
                  type="button"
                  aria-pressed={
                    showProfilePasswordConfirm
                  }
                  onClick={() =>
                    setShowProfilePasswordConfirm(
                      (current) =>
                        !current,
                    )
                  }
                >
                  {showProfilePasswordConfirm
                    ? "Ausblenden"
                    : "Anzeigen"}
                </button>
              </div>
            </label>

            <div className="profile-form-actions">
              <button
                className="primary-button"
                type="submit"
                disabled={saving}
              >
                {saving
                  ? "Wird gespeichert …"
                  : "Passwort aktualisieren"}
              </button>
            </div>
          </form>
        </article>

        <article className="panel profile-card profile-session-card">
          <div className="profile-card-heading">
            <div>
              <span className="profile-section-number">03</span>
              <h2>Sitzung</h2>
            </div>
            <p>
              Beende deine aktuelle Sitzung auf diesem Gerät.
            </p>
          </div>

          <button
            className="delete-button profile-logout-action"
            type="button"
            onClick={() => void logout()}
          >
            Von Philamentix Hub abmelden
          </button>
        </article>

        <article
          className={`${styles.accountDeleteCard} panel profile-card`}
        >
          <div className="profile-card-heading">
            <div>
              <span className="profile-section-number">04</span>
              <h2>Konto dauerhaft löschen</h2>
            </div>
            <p>
              Löscht den Account sowie die zugehörigen
              Filamente, Protokolle, Einstellungen und
              Aufträge endgültig.
            </p>
          </div>

          <form
            className={styles.accountDeleteForm}
            onSubmit={(event) =>
              void deleteAccount(event)
            }
          >
            <div
              className={
                styles.accountDeleteWarning
              }
            >
              <strong>
                Nicht rückgängig zu machen
              </strong>
              <p>
                Erstelle vorher unter Einstellungen
                ein CSV-Backup. Für die Löschung
                müssen deine E-Mail-Adresse und der
                Text „KONTO LÖSCHEN“ bestätigt
                werden.
              </p>
            </div>

            <label>
              E-Mail-Adresse bestätigen
              <input
                type="email"
                autoComplete="email"
                value={deleteEmail}
                onChange={(event) =>
                  setDeleteEmail(
                    event.target.value,
                  )
                }
                placeholder={
                  user?.email ??
                  "name@beispiel.de"
                }
              />
            </label>

            <label>
              Sicherheitsbestätigung
              <input
                type="text"
                autoComplete="off"
                value={
                  deleteConfirmation
                }
                onChange={(event) =>
                  setDeleteConfirmation(
                    event.target.value,
                  )
                }
                placeholder="KONTO LÖSCHEN"
              />
            </label>

            <button
              className={
                styles.accountDeleteButton
              }
              type="submit"
              disabled={deletingAccount}
            >
              {deletingAccount
                ? "Konto wird gelöscht …"
                : "Konto endgültig löschen"}
            </button>
          </form>
        </article>
      </section>
    </div>
  );
}
