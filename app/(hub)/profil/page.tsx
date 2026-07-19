"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import { useHub } from "@/components/philamentix/hub-provider";

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
              <input
                type="password"
                minLength={8}
                autoComplete="new-password"
                value={profilePassword}
                onChange={(event) =>
                  setProfilePassword(event.target.value)
                }
                placeholder="Mindestens 8 Zeichen"
              />
            </label>

            <label>
              Passwort wiederholen
              <input
                type="password"
                minLength={8}
                autoComplete="new-password"
                value={profilePasswordConfirm}
                onChange={(event) =>
                  setProfilePasswordConfirm(
                    event.target.value,
                  )
                }
                placeholder="Passwort erneut eingeben"
              />
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
      </section>
    </div>
  );
}
