"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { StatsSummary } from "@/lib/analytics";

/**
 * The analytics dashboard.
 *
 * Built so a number can be produced on demand rather than recalled from memory.
 * Everything shown is a live count from the database; nothing is estimated.
 */
export default function StatsPage() {
  const [stats, setStats] = useState<StatsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch("/api/stats", { cache: "no-store" });
        const data: { success: boolean; stats?: StatsSummary; error?: string } = await res.json();
        if (cancelled) return;
        if (data.success && data.stats) setStats(data.stats);
        else setError(data.error ?? "Could not load stats");
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load stats");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    // A dashboard that goes stale while it is open invites people to quote an
    // old number, so it refreshes on a slow interval.
    const timer = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const peakDay = stats?.dailyActive.reduce(
    (max, day) => Math.max(max, day.events),
    1
  ) ?? 1;

  return (
    <div className="min-h-screen bg-background text-text-primary">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">MonadStudio analytics</h1>
            <p className="text-sm text-text-secondary mt-1">
              Live counts from the database. Refreshes every 30 seconds.
            </p>
          </div>
          <Link
            href="/studio"
            className="text-xs font-semibold px-3 py-2 rounded-lg border border-border-subtle hover:border-border-strong transition-colors"
          >
            Open studio
          </Link>
        </div>

        {loading && <p className="text-sm text-text-muted">Loading…</p>}

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {stats && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
              <Metric label="Total users" value={stats.totalUsers} />
              <Metric label="Connected a wallet" value={stats.walletUsers} />
              <Metric label="Active last 7 days" value={stats.activeLast7Days} />
              <Metric label="Active last 24h" value={stats.activeLast24Hours} />
              <Metric label="Total events" value={stats.totalEvents} />
              <Metric label="Contracts deployed" value={stats.totalDeployments} />
              <Metric
                label="Tracking since"
                value={stats.firstEventAt ? stats.firstEventAt.slice(0, 10) : "no data yet"}
              />
              <Metric
                label="Events / user"
                value={
                  stats.totalUsers > 0
                    ? (stats.totalEvents / stats.totalUsers).toFixed(1)
                    : "0"
                }
              />
            </div>

            <section className="mb-8">
              <h2 className="text-sm font-bold uppercase tracking-wider text-text-muted mb-3">
                What people actually do
              </h2>
              {stats.eventBreakdown.length === 0 ? (
                <EmptyNote />
              ) : (
                <div className="rounded-xl border border-border-subtle overflow-hidden">
                  {stats.eventBreakdown.map((row) => (
                    <div
                      key={row.type}
                      className="flex items-center justify-between px-4 py-2.5 border-b border-border-subtle last:border-0"
                    >
                      <span className="text-sm font-mono">{row.type}</span>
                      <span className="text-sm tabular-nums">
                        {row.count}
                        {row.errors > 0 && (
                          <span className="ml-2 text-xs text-red-600 dark:text-red-400">
                            {row.errors} failed
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="mb-8">
              <h2 className="text-sm font-bold uppercase tracking-wider text-text-muted mb-3">
                Daily activity (30 days)
              </h2>
              {stats.dailyActive.length === 0 ? (
                <EmptyNote />
              ) : (
                <div className="rounded-xl border border-border-subtle p-4 space-y-1.5">
                  {stats.dailyActive.map((day) => (
                    <div key={day.day} className="flex items-center gap-3">
                      <span className="text-[11px] font-mono text-text-muted w-20 shrink-0">
                        {day.day}
                      </span>
                      <div className="flex-1 h-4 rounded panel-sunken overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-purple-600 to-pink-600"
                          style={{ width: `${Math.max(4, (day.events / peakDay) * 100)}%` }}
                        />
                      </div>
                      <span className="text-[11px] tabular-nums text-text-secondary w-28 text-right shrink-0">
                        {day.users} users · {day.events} events
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2 className="text-sm font-bold uppercase tracking-wider text-text-muted mb-3">
                Recent deployments
              </h2>
              {stats.recentDeployments.length === 0 ? (
                <EmptyNote />
              ) : (
                <div className="rounded-xl border border-border-subtle overflow-hidden">
                  {stats.recentDeployments.map((d) => (
                    <a
                      key={d.txHash}
                      href={`https://testnet.monadexplorer.com/address/${d.contractAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between px-4 py-2.5 border-b border-border-subtle last:border-0 hover:bg-border-subtle/40"
                    >
                      <span className="text-sm">{d.contractName ?? "Contract"}</span>
                      <span className="text-[11px] font-mono text-text-muted">
                        {d.contractAddress.slice(0, 10)}…{d.contractAddress.slice(-6)}
                      </span>
                    </a>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-border-subtle p-4">
      <p className="text-[11px] uppercase tracking-wider text-text-muted">{label}</p>
      <p className="text-2xl font-bold mt-1 tabular-nums">{value}</p>
    </div>
  );
}

function EmptyNote() {
  return (
    <div className="rounded-xl border border-border-subtle p-6 text-center">
      <p className="text-sm text-text-secondary">
        Nothing recorded yet. Use the studio and this fills in immediately.
      </p>
    </div>
  );
}
