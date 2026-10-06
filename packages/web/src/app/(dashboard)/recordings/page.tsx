"use client";

import { useState, useEffect, useCallback } from "react";
import FilterPanel from "@/components/FilterPanel";
import DataTable from "@/components/DataTable";
import { useAuth } from "@/providers/auth-provider";

interface FilterParams {
  answered?: number;
  direction?: number;
  name?: string;
  caller?: string;
  callee?: string;
  callId?: string;
  orderId?: string;
  startTime?: number;
  endTime?: number;
  minDuration?: number;
}

const getTodayRangeTimestamps = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const startTime = Math.floor(
    new Date(`${year}-${month}-${day}T00:00`).getTime() / 1000,
  );
  const endTime = Math.floor(
    new Date(`${year}-${month}-${day}T23:59`).getTime() / 1000,
  );
  return { startTime, endTime };
};

export default function RecordingsPage() {
  const { hasPermission } = useAuth();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [filters, setFilters] = useState<FilterParams>(() =>
    getTodayRangeTimestamps(),
  );
  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    "recordingType",
    "agentName",
    "agentNickName",
    "caller",
    "callee",
    "direction",
    "answered",
    "callDuration",
    "callStatus",
    "startTime",
    "actions",
  ]);
  const [selectedCallIds, setSelectedCallIds] = useState<string[]>([]);
  const [exporting, setExporting] = useState(false);

  const fetchCdrs = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("accessToken");
      const params = new URLSearchParams({
        page: String(page),
        size: String(size),
        ...Object.fromEntries(
          Object.entries(filters)
            .filter(([_, v]) => v !== undefined && v !== "")
            .map(([k, v]) => [k, String(v)]),
        ),
      });

      const res = await fetch(`http://localhost:3009/api/cdrs?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const json = await res.json();
        setData(json.data);
        setTotal(json.total);
        setTotalPages(json.totalPages);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [page, size, filters]);

  useEffect(() => {
    fetchCdrs();
  }, [fetchCdrs]);

  // Load column preferences
  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (token) {
      fetch("http://localhost:3009/api/users/me/preferences", {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((prefs) => {
          if (prefs?.visibleColumns) {
            // Ensure "actions" is always included
            const cols = prefs.visibleColumns.includes("actions")
              ? prefs.visibleColumns
              : [...prefs.visibleColumns, "actions"];
            setVisibleColumns(cols);
          }
        })
        .catch(() => {});
    }
  }, []);

  // Save column preferences
  const handleColumnToggle = useCallback(async (columns: string[]) => {
    // Ensure "actions" is always saved
    const cols = columns.includes("actions")
      ? columns
      : [...columns, "actions"];
    setVisibleColumns(cols);
    const token = localStorage.getItem("accessToken");
    if (token) {
      fetch("http://localhost:3009/api/users/me/preferences", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ visibleColumns: cols }),
      }).catch(() => {});
    }
  }, []);

  const handleFilter = (newFilters: FilterParams) => {
    setFilters(newFilters);
    setPage(1);
    setSelectedCallIds([]);
  };

  const handleReset = () => {
    setFilters({});
    setPage(1);
    setSelectedCallIds([]);
  };

  const handleExportCsv = async () => {
    try {
      const token = localStorage.getItem("accessToken");
      const params = new URLSearchParams({
        page: "1",
        size: "10000",
        ...Object.fromEntries(
          Object.entries(filters)
            .filter(([_, v]) => v !== undefined && v !== "")
            .map(([k, v]) => [k, String(v)]),
        ),
      });

      const res = await fetch(`http://localhost:3009/api/cdrs?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const json = await res.json();
        const headers = [
          "Call ID",
          "Agent",
          "Nickname",
          "Caller",
          "Callee",
          "Direction",
          "Answered",
          "Duration",
          "Status",
          "Start Time",
        ];
        const rows = json.data.map((r: any) => [
          r.callId,
          r.agentName || "",
          r.agentNickName || "",
          r.caller || "",
          r.callee || "",
          ["Inbound", "Outbound", "AICC"][r.direction] || "",
          r.answered ? "Yes" : "No",
          r.callDuration || 0,
          r.callStatus || "",
          r.startTime ? new Date(Number(r.startTime)).toLocaleString() : "",
        ]);

        const csv = [headers, ...rows]
          .map((row) =>
            row.map((cell: string | number) => `"${cell}"`).join(","),
          )
          .join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `recordings_${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      // ignore
    }
  };

  const handleExportSingle = async (callId: string) => {
    try {
      const token = localStorage.getItem("accessToken");
      const res = await fetch("http://localhost:3009/api/cdrs/export-single", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ callId }),
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${callId}.mp3`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const err = await res.json();
        alert(err.error || "Export failed");
      }
    } catch {
      alert("Export failed");
    }
  };

  const handleBulkExport = async () => {
    if (selectedCallIds.length === 0) return;
    setExporting(true);
    try {
      const token = localStorage.getItem("accessToken");
      const res = await fetch("http://localhost:3009/api/cdrs/export-bulk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ callIds: selectedCallIds }),
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `recordings_${Date.now()}.zip`;
        a.click();
        URL.revokeObjectURL(url);
        setSelectedCallIds([]);
      } else {
        const err = await res.json();
        alert(err.error || "Export failed");
      }
    } catch {
      alert("Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Recordings</h1>
          <p className="mt-1 text-sm text-gray-500">
            Browse and play voice recordings
          </p>
        </div>
        <div className="flex gap-2">
          {selectedCallIds.length > 0 &&
            hasPermission("recordings:export-bulk") && (
              <button
                onClick={handleBulkExport}
                disabled={exporting}
                className="rounded bg-green-600 px-4 py-2 text-sm text-white transition hover:bg-green-700 disabled:opacity-50"
              >
                {exporting
                  ? "Exporting..."
                  : `Export Selected (${selectedCallIds.length})`}
              </button>
            )}
          {hasPermission("recordings:export-csv") && (
            <button
              onClick={handleExportCsv}
              className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 transition hover:bg-gray-50"
            >
              Export CSV
            </button>
          )}
        </div>
      </div>

      <FilterPanel onFilter={handleFilter} onReset={handleReset} />

      <DataTable
        columns={[]}
        data={data}
        loading={loading}
        total={total}
        page={page}
        size={size}
        totalPages={totalPages}
        onPageChange={setPage}
        onSizeChange={(s) => {
          setSize(s);
          setPage(1);
        }}
        visibleColumns={visibleColumns}
        onColumnToggle={handleColumnToggle}
        selectedCallIds={selectedCallIds}
        onSelectionChange={setSelectedCallIds}
        onExportSingle={handleExportSingle}
        canExportSingle={hasPermission("recordings:export-single")}
      />
    </div>
  );
}
