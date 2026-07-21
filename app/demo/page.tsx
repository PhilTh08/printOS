"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import styles from "./page.module.css";

type DemoView =
  | "dashboard"
  | "filaments"
  | "orders"
  | "activity";

type DemoFilament = {
  id: number;
  manufacturer: string;
  material: string;
  color: string;
  location: string;
  stock: number;
  minimumStock: number;
  weightPerRoll: number;
};

type DemoOrderStatus =
  | "Offen"
  | "In Arbeit"
  | "Erledigt";

type DemoOrder = {
  id: string;
  title: string;
  customer: string;
  dueDate: string;
  status: DemoOrderStatus;
};

type DemoActivity = {
  id: string;
  time: string;
  text: string;
};

const INITIAL_FILAMENTS: DemoFilament[] = [
  {
    id: 1,
    manufacturer: "Bambu Lab",
    material: "PLA Basic",
    color: "Schwarz",
    location: "Regal A2",
    stock: 5,
    minimumStock: 2,
    weightPerRoll: 1000,
  },
  {
    id: 2,
    manufacturer: "Bambu Lab",
    material: "PETG HF",
    color: "Weiß",
    location: "Regal B1",
    stock: 2,
    minimumStock: 2,
    weightPerRoll: 1000,
  },
  {
    id: 3,
    manufacturer: "Polymaker",
    material: "ASA",
    color: "Grau",
    location: "Regal C3",
    stock: 3,
    minimumStock: 1,
    weightPerRoll: 1000,
  },
  {
    id: 4,
    manufacturer: "eSUN",
    material: "PLA+",
    color: "Blau",
    location: "Regal A4",
    stock: 0,
    minimumStock: 2,
    weightPerRoll: 1000,
  },
  {
    id: 5,
    manufacturer: "Fiberlogy",
    material: "TPU 30D",
    color: "Rot",
    location: "Trockenbox 2",
    stock: 1,
    minimumStock: 1,
    weightPerRoll: 850,
  },
];

const INITIAL_ORDERS: DemoOrder[] = [
  {
    id: "AUF-2026-0007",
    title: "Gehäuse für Sensorstation",
    customer: "Maker Werkstatt",
    dueDate: "24.07.2026",
    status: "In Arbeit",
  },
  {
    id: "AUF-2026-0008",
    title: "12 Kabelhalter drucken",
    customer: "Elektro Nord",
    dueDate: "27.07.2026",
    status: "Offen",
  },
  {
    id: "AUF-2026-0006",
    title: "Prototyp Lüfteradapter",
    customer: "Intern",
    dueDate: "19.07.2026",
    status: "Erledigt",
  },
];

const INITIAL_ACTIVITY: DemoActivity[] = [
  {
    id: "a1",
    time: "18:42",
    text: "PLA Basic Schwarz: 1 Rolle eingelagert",
  },
  {
    id: "a2",
    time: "18:19",
    text: "PETG HF Weiß: 1 Rolle ausgelagert",
  },
  {
    id: "a3",
    time: "16:42",
    text: "Auftrag AUF-2026-0007 auf „In Arbeit“ gesetzt",
  },
];

const NAV_ITEMS: Array<{
  id: DemoView;
  label: string;
  icon: string;
}> = [
  { id: "dashboard", label: "Übersicht", icon: "▦" },
  { id: "filaments", label: "Filamente", icon: "◉" },
  { id: "orders", label: "Aufträge", icon: "▧" },
  { id: "activity", label: "Protokoll", icon: "↕" },
];

function currentTime(): string {
  return new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}

export default function DemoPage() {
  const router = useRouter();
  const [view, setView] = useState<DemoView>("dashboard");
  const [filaments, setFilaments] =
    useState<DemoFilament[]>(INITIAL_FILAMENTS);
  const [orders, setOrders] =
    useState<DemoOrder[]>(INITIAL_ORDERS);
  const [activities, setActivities] =
    useState<DemoActivity[]>(INITIAL_ACTIVITY);
  const [notice, setNotice] = useState(
    "Demo-Daten sind lokal und werden nicht gespeichert.",
  );

  const totalRolls = useMemo(
    () =>
      filaments.reduce(
        (sum, filament) => sum + filament.stock,
        0,
      ),
    [filaments],
  );

  const totalWeight = useMemo(
    () =>
      filaments.reduce(
        (sum, filament) =>
          sum + filament.stock * filament.weightPerRoll,
        0,
      ) / 1000,
    [filaments],
  );

  const criticalCount = useMemo(
    () =>
      filaments.filter(
        (filament) =>
          filament.stock <= filament.minimumStock,
      ).length,
    [filaments],
  );

  const activeOrders = orders.filter(
    (order) => order.status !== "Erledigt",
  ).length;

  function addActivity(text: string) {
    setActivities((current) => [
      {
        id: crypto.randomUUID(),
        time: currentTime(),
        text,
      },
      ...current,
    ]);
  }

  function adjustStock(id: number, change: number) {
    const filament = filaments.find(
      (entry) => entry.id === id,
    );

    if (!filament) {
      return;
    }

    if (filament.stock + change < 0) {
      setNotice("Der Bestand kann nicht unter 0 fallen.");
      return;
    }

    setFilaments((current) =>
      current.map((entry) =>
        entry.id === id
          ? { ...entry, stock: entry.stock + change }
          : entry,
      ),
    );

    const action = change > 0 ? "eingelagert" : "ausgelagert";
    addActivity(
      `${filament.material} ${filament.color}: 1 Rolle ${action}`,
    );
    setNotice(
      `Demo-Buchung gespeichert: ${filament.material} ${filament.color}.`,
    );
  }

  function updateOrderStatus(
    id: string,
    status: DemoOrderStatus,
  ) {
    setOrders((current) =>
      current.map((order) =>
        order.id === id ? { ...order, status } : order,
      ),
    );
    addActivity(`Auftrag ${id} auf „${status}“ gesetzt`);
    setNotice(`Status von ${id} wurde geändert.`);
  }

  function resetDemo() {
    setFilaments(INITIAL_FILAMENTS);
    setOrders(INITIAL_ORDERS);
    setActivities(INITIAL_ACTIVITY);
    setView("dashboard");
    setNotice("Die Demo wurde auf den Ausgangszustand zurückgesetzt.");
  }

  return (
    <main className={styles.demoShell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <strong>
            Philamentix<span>Hub</span>
          </strong>
          <small>DEMO // LOKALE DATEN</small>
        </div>

        <nav className={styles.navigation}>
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={view === item.id ? styles.activeNav : ""}
              onClick={() => setView(item.id)}
            >
              <span aria-hidden="true">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <button type="button" onClick={resetDemo}>
            Demo zurücksetzen
          </button>
          <button
            type="button"
            className={styles.loginLink}
            onClick={() => router.push("/?login=1")}
          >
            Zur Anmeldung
          </button>
        </div>
      </aside>

      <section className={styles.workspace}>
        <header className={styles.topbar}>
          <div>
            <span className={styles.demoBadge}>Demo-Modus</span>
            <strong>Du kannst hier gefahrlos Funktionen ausprobieren.</strong>
          </div>
          <button type="button" onClick={() => router.push("/?login=1")}>
            Eigenes Konto verwenden
          </button>
        </header>

        <div className={styles.notice}>{notice}</div>

        {view === "dashboard" && (
          <div className={styles.pageContent}>
            <div className={styles.pageHeading}>
              <div>
                <span>Übersicht</span>
                <h1>Guten Abend, Demo-Nutzer</h1>
                <p>Ein realistischer Beispielbestand ohne Verbindung zu Supabase.</p>
              </div>
            </div>

            <section className={styles.metrics}>
              <article>
                <span>Rollen gesamt</span>
                <strong>{totalRolls}</strong>
                <small>{totalWeight.toFixed(1)} kg Material</small>
              </article>
              <article>
                <span>Kritischer Bestand</span>
                <strong>{criticalCount}</strong>
                <small>Nachbestellung prüfen</small>
              </article>
              <article>
                <span>Aktive Aufträge</span>
                <strong>{activeOrders}</strong>
                <small>Offen oder in Arbeit</small>
              </article>
              <article>
                <span>Demo-Speicherung</span>
                <strong>Lokal</strong>
                <small>Keine echten Kontodaten</small>
              </article>
            </section>

            <div className={styles.dashboardGrid}>
              <section className={styles.panel}>
                <div className={styles.panelHeader}>
                  <div>
                    <span>Material</span>
                    <h2>Kritische Bestände</h2>
                  </div>
                  <button type="button" onClick={() => setView("filaments")}>
                    Alle Filamente
                  </button>
                </div>
                <div className={styles.compactList}>
                  {filaments
                    .filter(
                      (filament) =>
                        filament.stock <= filament.minimumStock,
                    )
                    .map((filament) => (
                      <div key={filament.id} className={styles.compactRow}>
                        <div>
                          <strong>
                            {filament.material} {filament.color}
                          </strong>
                          <span>
                            {filament.manufacturer} · {filament.location}
                          </span>
                        </div>
                        <b>{filament.stock} Rollen</b>
                      </div>
                    ))}
                </div>
              </section>

              <section className={styles.panel}>
                <div className={styles.panelHeader}>
                  <div>
                    <span>Heute</span>
                    <h2>Letzte Aktivität</h2>
                  </div>
                  <button type="button" onClick={() => setView("activity")}>
                    Protokoll
                  </button>
                </div>
                <div className={styles.compactList}>
                  {activities.slice(0, 4).map((activity) => (
                    <div key={activity.id} className={styles.activityRow}>
                      <time>{activity.time}</time>
                      <span>{activity.text}</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        )}

        {view === "filaments" && (
          <div className={styles.pageContent}>
            <div className={styles.pageHeading}>
              <div>
                <span>Lager</span>
                <h1>Filamente ausprobieren</h1>
                <p>Buche Rollen ein oder aus. Die Änderungen gelten nur in dieser Demo.</p>
              </div>
            </div>

            <section className={styles.panel}>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Filament</th>
                      <th>Lagerort</th>
                      <th>Bestand</th>
                      <th>Status</th>
                      <th>Demo-Buchung</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filaments.map((filament) => {
                      const critical =
                        filament.stock <= filament.minimumStock;
                      return (
                        <tr key={filament.id}>
                          <td>
                            <strong>
                              {filament.material} {filament.color}
                            </strong>
                            <span>{filament.manufacturer}</span>
                          </td>
                          <td>{filament.location}</td>
                          <td>
                            <b>{filament.stock}</b> Rollen
                          </td>
                          <td>
                            <span
                              className={
                                critical
                                  ? styles.statusCritical
                                  : styles.statusOk
                              }
                            >
                              {filament.stock === 0
                                ? "Leer"
                                : critical
                                  ? "Mindestbestand"
                                  : "In Ordnung"}
                            </span>
                          </td>
                          <td>
                            <div className={styles.stockActions}>
                              <button
                                type="button"
                                onClick={() => adjustStock(filament.id, -1)}
                              >
                                − Auslagern
                              </button>
                              <button
                                type="button"
                                onClick={() => adjustStock(filament.id, 1)}
                              >
                                + Einlagern
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {view === "orders" && (
          <div className={styles.pageContent}>
            <div className={styles.pageHeading}>
              <div>
                <span>Produktion</span>
                <h1>Demo-Aufträge</h1>
                <p>Ändere den Status eines Beispielauftrags.</p>
              </div>
            </div>

            <section className={styles.orderList}>
              {orders.map((order) => (
                <article key={order.id} className={styles.orderCard}>
                  <div>
                    <span className={styles.orderNumber}>{order.id}</span>
                    <h2>{order.title}</h2>
                    <p>{order.customer}</p>
                  </div>
                  <div className={styles.orderMeta}>
                    <span>Fällig: {order.dueDate}</span>
                    <select
                      value={order.status}
                      onChange={(event) =>
                        updateOrderStatus(
                          order.id,
                          event.target.value as DemoOrderStatus,
                        )
                      }
                    >
                      <option>Offen</option>
                      <option>In Arbeit</option>
                      <option>Erledigt</option>
                    </select>
                  </div>
                </article>
              ))}
            </section>
          </div>
        )}

        {view === "activity" && (
          <div className={styles.pageContent}>
            <div className={styles.pageHeading}>
              <div>
                <span>Nachvollziehbarkeit</span>
                <h1>Demo-Protokoll</h1>
                <p>Alle Aktionen dieser Sitzung erscheinen sofort hier.</p>
              </div>
            </div>

            <section className={styles.panel}>
              <div className={styles.activityList}>
                {activities.map((activity) => (
                  <div key={activity.id} className={styles.activityEntry}>
                    <time>{activity.time}</time>
                    <span>{activity.text}</span>
                    <b>Demo-Nutzer</b>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </section>
    </main>
  );
}
