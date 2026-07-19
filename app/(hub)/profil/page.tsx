"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";

import { useHub } from "@/components/philamentix/hub-provider";
import { PageHeader } from "@/components/philamentix/page-header";

import styles from "./page.module.css";

export default function ProfilePage() {
  const {
    user,
    displayName,
    updateProfileName,
    updatePassword,
  } = useHub();
  const [name, setName] = useState(displayName);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] =
    useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setName(displayName);
  }, [displayName]);

  async function saveName(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setError("");
    setMessage("");

    try {
      await updateProfileName(name);
      setMessage("Name wurde gespeichert.");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Name konnte nicht gespeichert werden.",
      );
    }
  }

  async function savePassword(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (password !== confirmation) {
      setError(
        "Die beiden Passwörter stimmen nicht überein.",
      );
      return;
    }

    try {
      await updatePassword(password);
      setPassword("");
      setConfirmation("");
      setMessage("Passwort wurde geändert.");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Passwort konnte nicht geändert werden.",
      );
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Account"
        title="Profil"
        description="Profildaten und Sicherheit deines Accounts."
      />

      {(message || error) && (
        <div
          className={`${styles.feedback} ${
            error ? styles.error : styles.success
          }`}
        >
          {error || message}
        </div>
      )}

      <section className={styles.grid}>
        <form
          className={styles.panel}
          onSubmit={saveName}
        >
          <h2>Profildaten</h2>

          <label>
            Name
            <input
              value={name}
              onChange={(event) =>
                setName(event.target.value)
              }
            />
          </label>

          <label>
            E-Mail
            <input
              value={user?.email ?? ""}
              disabled
            />
          </label>

          <button type="submit">
            Namen speichern
          </button>
        </form>

        <form
          className={styles.panel}
          onSubmit={savePassword}
        >
          <h2>Passwort ändern</h2>

          <label>
            Neues Passwort
            <input
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              minLength={8}
            />
          </label>

          <label>
            Passwort bestätigen
            <input
              type="password"
              value={confirmation}
              onChange={(event) =>
                setConfirmation(event.target.value)
              }
              minLength={8}
            />
          </label>

          <button type="submit">
            Passwort ändern
          </button>
        </form>
      </section>
    </>
  );
}
