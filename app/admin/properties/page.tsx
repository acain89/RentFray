"use client";

import { useEffect, useMemo, useState } from "react";
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

type PropertiesListResponse = {
  ok?: boolean;
  properties?: Property[];
  error?: string;
};

export default function AdminPropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [propertyCodeSearch, setPropertyCodeSearch] = useState("");

  const trimmedSearch = useMemo(
    () => propertyCodeSearch.replace(/\D/g, "").slice(0, 5),
    [propertyCodeSearch]
  );

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

        const data: PropertiesListResponse = await res.json();

        if (!active) return;

        if (!res.ok) {
          setError(data.error || "Failed to load properties.");
          setProperties([]);
          setLoading(false);
          return;
        }

        setProperties(Array.isArray(data.properties) ? data.properties : []);
      } catch {
        if (!active) return;
        setError("Network error.");
        setProperties([]);
      }

      if (active) {
        setLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [trimmedSearch]);

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Properties</h1>
            <p className={styles.subtitle}>
              Search by property code and open any property account.
            </p>
          </div>

          <Link href="/admin/properties/new" className={styles.primaryButton}>
            + New Property
          </Link>
        </div>

        <div className={styles.searchCard}>
          <label htmlFor="propertyCodeSearch" className={styles.searchLabel}>
            Search by property code
          </label>
          <input
            id="propertyCodeSearch"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="1234"
            value={propertyCodeSearch}
            onChange={(e) => setPropertyCodeSearch(e.target.value)}
            className={styles.searchInput}
          />
        </div>

        {loading && <div className={styles.info}>Loading properties...</div>}
        {!loading && error && <div className={styles.error}>{error}</div>}

        {!loading && !error && properties.length === 0 && (
          <div className={styles.empty}>
            {trimmedSearch
              ? "No properties found for that code."
              : "No properties yet. Create your first one."}
          </div>
        )}

        <div className={styles.grid}>
          {properties.map((p) => (
            <Link
              key={p.id}
              href={`/admin/properties/${p.id}`}
              className={styles.card}
            >
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>{p.name}</h3>
                <span className={p.isActive ? styles.active : styles.inactive}>
                  {p.isActive ? "Active" : "Inactive"}
                </span>
              </div>

              <div className={styles.meta}>
                <div>
                  <span className={styles.metaLabel}>Code:</span> {p.propertyCode}
                </div>
                <div>
                  <span className={styles.metaLabel}>Type:</span> {p.propertyType}
                </div>
                <div>
                  <span className={styles.metaLabel}>Contact:</span>{" "}
                  {p.contactName || "—"}
                </div>
                <div>
                  <span className={styles.metaLabel}>Email:</span>{" "}
                  {p.contactEmail || "—"}
                </div>
                <div>
                  <span className={styles.metaLabel}>Units:</span> {p.unitCount}
                </div>
                <div>
                  <span className={styles.metaLabel}>Tiers:</span> {p.tierCount}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}