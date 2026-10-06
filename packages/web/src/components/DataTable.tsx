"use client";

import { useState, useEffect, useRef } from "react";
import AudioPlayer from "./AudioPlayer";

interface Column {
  key: string;
  label: string;
  render?: (row: Record<string, any>) => React.ReactNode;
}

interface DataTableProps {
  columns: Column[];
  data: Record<string, any>[];
  loading: boolean;
  total: number;
  page: number;
  size: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onSizeChange: (size: number) => void;
  visibleColumns: string[];
  onColumnToggle: (columns: string[]) => void;
  selectedCallIds: string[];
  onSelectionChange: (callIds: string[]) => void;
  onExportSingle: (callId: string) => void;
  canExportSingle?: boolean;
}

const ALL_COLUMNS: Column[] = [
  {
    key: "recordingType",
    label: "Type",
    render: (row) =>
      row.recordingType === "ai_bot" ? (
        <span className="text-emerald-700 font-medium text-xs">AI Voice Bot</span>
      ) : (
        <span className="text-slate-600 font-medium text-xs">Agent Call</span>
      ),
  },
  { key: "agentName", label: "Agent" },
  { key: "agentNickName", label: "Nickname" },
  { key: "caller", label: "Caller" },
  { key: "callee", label: "Callee" },
  {
    key: "direction",
    label: "Direction",
    render: (row) => {
      const dirs: Record<number, string> = {
        0: "Inbound",
        1: "Outbound",
        2: "AICC",
      };
      return dirs[row.direction] || "-";
    },
  },
  {
    key: "answered",
    label: "Answered",
    render: (row) => (
      <span className={row.answered ? "text-emerald-600 font-medium text-xs" : "text-slate-400 text-xs"}>
        {row.answered ? "Yes" : "No"}
      </span>
    ),
  },
  {
    key: "callDuration",
    label: "Duration",
    render: (row) => {
      if (!row.callDuration) return "-";
      const mins = Math.floor(row.callDuration / 60);
      const secs = row.callDuration % 60;
      return `${mins}:${secs.toString().padStart(2, "0")}`;
    },
  },
  { key: "callStatus", label: "Status" },
  { key: "hangupReason", label: "Hangup Reason" },
  {
    key: "startTime",
    label: "Start Time",
    render: (row) =>
      row.startTime ? new Date(Number(row.startTime)).toLocaleString() : "-",
  },
  {
    key: "endTime",
    label: "End Time",
    render: (row) =>
      row.endTime ? new Date(Number(row.endTime)).toLocaleString() : "-",
  },
  { key: "callId", label: "Call ID" },
  { key: "orderId", label: "Order ID" },
  { key: "mos", label: "MOS" },
  {
    key: "actions",
    label: "Actions",
    render: (row) => null,
  },
];

export default function DataTable({
  data,
  loading,
  total,
  page,
  size,
  totalPages,
  onPageChange,
  onSizeChange,
  visibleColumns,
  onColumnToggle,
  selectedCallIds,
  onSelectionChange,
  onExportSingle,
  canExportSingle = true,
}: DataTableProps) {
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  const [activeColumns, setActiveColumns] = useState(visibleColumns);
  const audioPlayerRef = useRef<{ play: () => void } | null>(null);

  useEffect(() => {
    setActiveColumns(visibleColumns);
  }, [visibleColumns]);

  // Auto-play when playingUrl changes
  useEffect(() => {
    if (playingUrl && audioPlayerRef.current) {
      // Small delay to ensure audio element is ready
      setTimeout(() => {
        audioPlayerRef.current?.play();
      }, 300);
    }
  }, [playingUrl]);

  const handleColumnToggle = (key: string) => {
    const newColumns = activeColumns.includes(key)
      ? activeColumns.filter((c) => c !== key)
      : [...activeColumns, key];
    setActiveColumns(newColumns);
    onColumnToggle(newColumns);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const ids = data.filter((r) => r.localFilePath).map((r) => r.callId);
      onSelectionChange([...new Set([...selectedCallIds, ...ids])]);
    } else {
      const pageIds = new Set(data.map((r) => r.callId));
      onSelectionChange(selectedCallIds.filter((id) => !pageIds.has(id)));
    }
  };

  const handleSelectRow = (callId: string) => {
    onSelectionChange(
      selectedCallIds.includes(callId)
        ? selectedCallIds.filter((id) => id !== callId)
        : [...selectedCallIds, callId],
    );
  };

  const handlePlay = (filePath: string) => {
    setPlayingUrl(playingUrl === filePath ? null : filePath);
  };

  const handleRowDoubleClick = (row: Record<string, any>) => {
    if (row.localFilePath) {
      setPlayingUrl(row.localFilePath);
    }
  };

  const allSelected =
    data.length > 0 &&
    data
      .filter((r) => r.localFilePath)
      .every((r) => selectedCallIds.includes(r.callId));
  const someSelected = data
    .filter((r) => r.localFilePath)
    .some((r) => selectedCallIds.includes(r.callId));

  const displayColumns = ALL_COLUMNS.filter((col) =>
    activeColumns.includes(col.key),
  );

  return (
    <div className="rounded-lg border bg-white shadow-sm">
      {playingUrl && (
        <div className="border-b px-4 py-3 bg-blue-50">
          <AudioPlayer
            ref={audioPlayerRef}
            src={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3009/api"}/audio/stream?filePath=${encodeURIComponent(playingUrl)}&token=${encodeURIComponent(localStorage.getItem("accessToken") || "")}`}
            title="Playing recording"
          />
        </div>
      )}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <p className="text-sm text-gray-600">{total} records</p>
          {selectedCallIds.length > 0 && (
            <span className="rounded bg-green-50 px-2 py-1 text-xs text-green-700">
              {selectedCallIds.length} selected
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="rounded border border-gray-300 px-3 py-1 text-sm disabled:opacity-50 hover:bg-gray-50 transition"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            {page} / {totalPages || 1}
          </span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="rounded border border-gray-300 px-3 py-1 text-sm disabled:opacity-50 hover:bg-gray-50 transition"
          >
            Next
          </button>
        </div>
        <div className="relative">
          <button
            onClick={() => setShowColumnPicker(!showColumnPicker)}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            Columns
          </button>
          {showColumnPicker && (
            <div className="absolute right-0 z-10 mt-1 w-48 rounded border bg-white p-2 shadow-lg">
              {ALL_COLUMNS.filter((c) => c.key !== "actions").map((col) => (
                <label
                  key={col.key}
                  className="flex items-center gap-2 py-1 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={activeColumns.includes(col.key)}
                    onChange={() => handleColumnToggle(col.key)}
                    className="rounded"
                  />
                  {col.label}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected && !allSelected;
                  }}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="rounded"
                />
              </th>
              {displayColumns.map((col) => (
                <th
                  key={col.key}
                  className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {loading ? (
              <tr>
                <td
                  colSpan={displayColumns.length + 1}
                  className="px-4 py-8 text-center text-gray-500"
                >
                  Loading...
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={displayColumns.length + 1}
                  className="px-4 py-8 text-center text-gray-500"
                >
                  No records found
                </td>
              </tr>
            ) : (
              data.map((row) => (
                <tr
                  key={row.id}
                  className={`hover:bg-gray-50 ${row.localFilePath ? "cursor-pointer" : ""}`}
                  onDoubleClick={() => handleRowDoubleClick(row)}
                >
                  <td className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={selectedCallIds.includes(row.callId)}
                      onChange={() => handleSelectRow(row.callId)}
                      disabled={!row.localFilePath}
                      className="rounded"
                    />
                  </td>
                  {displayColumns.map((col) => (
                    <td
                      key={col.key}
                      className="whitespace-nowrap px-4 py-3 text-sm text-gray-900"
                    >
                      {col.key === "actions" ? (
                        <div className="flex items-center gap-1">
                          {row.localFilePath ? (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePlay(row.localFilePath);
                                }}
                                className={`rounded p-1.5 transition ${
                                  playingUrl === row.localFilePath
                                    ? "bg-blue-100 text-blue-700"
                                    : "text-blue-600 hover:bg-blue-50"
                                }`}
                                title={
                                  playingUrl === row.localFilePath
                                    ? "Stop"
                                    : "Play"
                                }
                              >
                                {playingUrl === row.localFilePath ? (
                                  <svg
                                    className="h-4 w-4"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                  >
                                    <rect x="5" y="3" width="3" height="14" />
                                    <rect x="12" y="3" width="3" height="14" />
                                  </svg>
                                ) : (
                                  <svg
                                    className="h-4 w-4"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                  >
                                    <path d="M6 4l10 6-10 6V4z" />
                                  </svg>
                                )}
                              </button>
                              {canExportSingle && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onExportSingle(row.callId);
                                  }}
                                  className="rounded p-1.5 text-gray-600 hover:bg-gray-50 transition"
                                  title="Export this recording"
                                >
                                  <svg
                                    className="h-4 w-4"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                                    />
                                  </svg>
                                </button>
                              )}
                            </>
                          ) : row.recordUrl ? (
                            <span className="text-xs text-gray-400">
                              Not downloaded
                            </span>
                          ) : null}
                        </div>
                      ) : col.render ? (
                        col.render(row)
                      ) : (
                        row[col.key] || "-"
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>



      <div className="flex items-center justify-between border-t px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span>Rows per page:</span>
          <select
            value={size}
            onChange={(e) => onSizeChange(Number(e.target.value))}
            className="rounded border border-gray-300 px-2 py-1"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="rounded border border-gray-300 px-3 py-1 text-sm disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            {page} / {totalPages || 1}
          </span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="rounded border border-gray-300 px-3 py-1 text-sm disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
