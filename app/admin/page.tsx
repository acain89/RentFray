// app/admin/page.tsx

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";

type Property = {
  id: string;
  name: string;
  propertyCode: string;
  propertyType: string;
  isActive: boolean;
  contactName: string;
  contactEmail: string;
  unitCount: number;
  tierCount: number;
};

export default function AdminPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [propertyCodeSearch, setPropertyCodeSearch] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);

  const trimmedSearch = useMemo(
    () => propertyCodeSearch.replace(/\D/g, "").slice(0, 5),
    [propertyCodeSearch]
  );

  const refresh = useCallback(() => {
    setRefreshTick((p) => p + 1);
  }, []);

  // LOAD PROPERTIES
  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        setError("");

        const query = trimmedSearch
          ? `?propertyCode=${encodeURIComponent(trimmedSearch)}`
          : "";

        const res = await fetch(`/api/admin/properties/list${query}`, {
          cache: "no-store",
        });

        const data = await res.json();

        if (!active) return;

        if (!res.ok) {
          setError(data.error || "Failed to load properties.");
          setProperties([]);
          return;
        }

        setProperties(data.properties || []);
      } catch {
        if (!active) return;
        setError("Network error.");
        setProperties([]);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [trimmedSearch, refreshTick]);

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        {/* HEADER */}
        <div className={styles.hero}>
          <div>
            <div className={styles.eyebrow}>ADMIN</div>
            <h1 className={styles.title}>Dashboard</h1>
          </div>

          <div className={styles.actions}>
            <button onClick={refresh} className={styles.searchButton}>
              Refresh
            </button>

            <Link href="/setup" className={styles.primaryButton}>
              + New Property
            </Link>
          </div>
        </div>

        {/* 🔥 PRIMARY CTA */}
        <div className={styles.setupCard}>
          <div>
            <div className={styles.cardTitle}>Complete account setup</div>
            <div className={styles.cardText}>
              Finish setup to start accepting payments.
            </div>
          </div>

          <button
            className={styles.pulseButton}
            onClick={() => alert(
              "1) Connect bank account\n2) Confirm unit labels\n3) Add managers (optional)"
            )}
          >
            Complete setup
          </button>
        </div>

        {/* SEARCH */}
        <div className={styles.searchCard}>
          <div className={styles.cardTitle}>Find a property</div>

          <input
            value={propertyCodeSearch}
            onChange={(e) => setPropertyCodeSearch(e.target.value)}
            placeholder="Property code"
            className={styles.searchInput}
          />
        </div>

        {/* LIST */}
        <div className={styles.searchCard}>
          <div className={styles.cardTitle}>Your properties</div>

          {loading && <div>Loading...</div>}
          {error && <div>{error}</div>}

          {!loading && properties.length === 0 && (
            <div>No properties yet</div>
          )}

          {!loading && properties.length > 0 && (
            <div className={styles.propertyList}>
              {properties.map((p) => (
                <Link
                  key={p.id}
                  href={`/admin/properties/${p.id}`}
                  className={styles.propertyCard}
                >
                  <div className={styles.propertyName}>{p.name}</div>
                  <div className={styles.propertyMeta}>
                    Code: {p.propertyCode}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}