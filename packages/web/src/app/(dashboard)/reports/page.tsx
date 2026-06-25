"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const ALL_TABS = ["call-stats", "audit-trail", "playback-history"] as const;
type Tab = (typeof ALL_TABS)[number];

const COLORS = [
  "#dc2626",
  "#2563eb",
  "#16a34a",
  "#d97706",
  "#7c3aed",
  "#0891b2",
];

export default function ReportsPage() {
  const { hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("call-stats");
  const [loading, setLoading] = useState(true);
  const [callStats, setCallStats] = useState<any>(null);
  const [downloadSummary, setDownloadSummary] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [playbackLogs, setPlaybackLogs] = useState<any[]>([]);
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [auditPage, setAuditPage] = useState(1);
  const [playbackPage, setPlaybackPage] = useState(1);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditTotalPages, setAuditTotalPages] = useState(0);
  const [playbackTotal, setPlaybackTotal] = useState(0);
  const [playbackTotalPages, setPlaybackTotalPages] = useState(0);
  const router = useRouter();

  const tabs = ALL_TABS.filter((tab) =>
    tab === "audit-trail" ? hasPermission("reports:audit-trail") : true,
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    const token = localStorage.getItem("accessToken");
    const headers = { Authorization: `Bearer ${token}` };

    const params = new URLSearchParams();
    if (dateRange.start)
      params.set("startDate", new Date(dateRange.start).toISOString());
    if (dateRange.end)
      params.set("endDate", new Date(dateRange.end).toISOString());

    try {
      if (activeTab === "call-stats") {
        const res = await fetch(
          `http://localhost:3009/api/reports/call-stats?${params}`,
          { headers },
        );
        if (res.ok) setCallStats(await res.json());
      } else if (activeTab === "audit-trail") {
        const p = new URLSearchParams({ page: String(auditPage), size: "20" });
        if (dateRange.start)
          p.set("startDate", new Date(dateRange.start).toISOString());
        if (dateRange.end)
          p.set("endDate", new Date(dateRange.end).toISOString());
        const res = await fetch(
          `http://localhost:3009/api/reports/audit-trail?${p}`,
          { headers },
        );
        if (res.ok) {
          const data = await res.json();
          setAuditLogs(data.data);
          setAuditTotal(data.total);
          setAuditTotalPages(data.totalPages);
        }
      } else if (activeTab === "playback-history") {
        const p = new URLSearchParams({
          page: String(playbackPage),
          size: "20",
        });
        if (dateRange.start)
          p.set("startDate", new Date(dateRange.start).toISOString());
        if (dateRange.end)
          p.set("endDate", new Date(dateRange.end).toISOString());
        const res = await fetch(
          `http://localhost:3009/api/reports/playback-history?${p}`,
          { headers },
        );
        if (res.ok) {
          const data = await res.json();
          setPlaybackLogs(data.data);
          setPlaybackTotal(data.total);
          setPlaybackTotalPages(data.totalPages);
        }
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [activeTab, dateRange, auditPage, playbackPage]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleBarClick = (data: any) => {
    if (!data || !data.activePayload || !data.activePayload[0]) return;
    const payload = data.activePayload[0].payload;
    if (activeTab === "call-stats") {
      if (payload.label) {
        const dirMap: Record<string, number> = {
          Inbound: 1,
          Outbound: 2,
          AICC: 3,
        };
        const dir = dirMap[payload.label];
        if (dir) router.push(`/recordings?direction=${dir}`);
      } else if (payload.agentName) {
        router.push(
          `/recordings?name=${encodeURIComponent(payload.agentName)}`,
        );
      }
    }
  };

  const tabLabels: Record<Tab, string> = {
    "call-stats": "Call Statistics",
    "audit-trail": "Audit Trail",
    "playback-history": "Playback History",
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="mt-1 text-sm text-gray-500">
          Analytics, audit trail, and playback history
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-4">
        <div className="flex gap-1 border-b">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
                activeTab === tab
                  ? "border-green-600 text-green-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tabLabels[tab]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) =>
              setDateRange((prev) => ({ ...prev, start: e.target.value }))
            }
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          />
          <span className="text-gray-400">to</span>
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) =>
              setDateRange((prev) => ({ ...prev, end: e.target.value }))
            }
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          />
          <button
            onClick={fetchData}
            className="rounded bg-green-600 px-3 py-1 text-sm text-white transition hover:bg-green-700"
          >
            Apply
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-green-600" />
        </div>
      ) : (
        <>
          {activeTab === "call-stats" && callStats && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                <StatCard
                  label="Total Calls"
                  value={callStats.summary.totalCalls}
                />
                <StatCard
                  label="Answered"
                  value={callStats.summary.answeredCalls}
                />
                <StatCard
                  label="Unanswered"
                  value={callStats.summary.unansweredCalls}
                />
                <StatCard
                  label="Answer Rate"
                  value={`${callStats.summary.answerRate}%`}
                />
              </div>

              <div className="rounded-lg border bg-white p-6 shadow-sm">
                <h3 className="mb-4 text-sm font-medium text-gray-700">
                  Calls by Direction (click to filter)
                </h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart
                    data={callStats.byDirection}
                    onClick={handleBarClick}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis />
                    <Tooltip />
                    <Bar
                      dataKey="count"
                      fill="#dc2626"
                      radius={[4, 4, 0, 0]}
                      cursor="pointer"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="rounded-lg border bg-white p-6 shadow-sm">
                <h3 className="mb-4 text-sm font-medium text-gray-700">
                  Calls by Agent (click to filter)
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={callStats.byAgent.slice(0, 10)}
                    layout="vertical"
                    onClick={handleBarClick}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="agentName" width={120} />
                    <Tooltip />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]} cursor="pointer">
                      {callStats.byAgent
                        .slice(0, 10)
                        .map((_: any, i: number) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {activeTab === "audit-trail" && (
            <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Action
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Entity
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      IP Address
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Timestamp
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-8 text-center text-sm text-gray-500"
                      >
                        No audit logs
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => (
                      <tr key={log.id}>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                          {log.user?.username || "System"}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm">
                          <span className="rounded-full bg-gray-100 px-2 py-1 text-xs capitalize">
                            {log.action}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                          {log.entityType
                            ? `${log.entityType} #${log.entityId}`
                            : "-"}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                          {log.ipAddress || "-"}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {auditTotalPages > 1 && (
                <div className="flex items-center justify-between border-t px-4 py-3">
                  <p className="text-sm text-gray-600">{auditTotal} total</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                      disabled={auditPage <= 1}
                      className="rounded border px-3 py-1 text-sm disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <span className="px-3 py-1 text-sm">
                      {auditPage} / {auditTotalPages}
                    </span>
                    <button
                      onClick={() =>
                        setAuditPage((p) => Math.min(auditTotalPages, p + 1))
                      }
                      disabled={auditPage >= auditTotalPages}
                      className="rounded border px-3 py-1 text-sm disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "playback-history" && (
            <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Recording
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Played At
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {playbackLogs.length === 0 ? (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-6 py-8 text-center text-sm text-gray-500"
                      >
                        No playback logs
                      </td>
                    </tr>
                  ) : (
                    playbackLogs.map((log) => (
                      <tr key={log.id}>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                          {log.user?.username || "Unknown"}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {log.cdr?.agentName
                            ? `${log.cdr.agentName} — ${log.callId || log.cdr.callId || "Unknown"}`
                            : log.callId || "-"}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                          {new Date(log.playedAt).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {playbackTotalPages > 1 && (
                <div className="flex items-center justify-between border-t px-4 py-3">
                  <p className="text-sm text-gray-600">{playbackTotal} total</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPlaybackPage((p) => Math.max(1, p - 1))}
                      disabled={playbackPage <= 1}
                      className="rounded border px-3 py-1 text-sm disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <span className="px-3 py-1 text-sm">
                      {playbackPage} / {playbackTotalPages}
                    </span>
                    <button
                      onClick={() =>
                        setPlaybackPage((p) =>
                          Math.min(playbackTotalPages, p + 1),
                        )
                      }
                      disabled={playbackPage >= playbackTotalPages}
                      className="rounded border px-3 py-1 text-sm disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}
