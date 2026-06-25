"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/providers/auth-provider";
import Toggle from "@/components/Toggle";

interface Agent {
  id: number;
  name: string;
  nickname: string | null;
  group: string | null;
  isActive: boolean;
  createdAt: string;
}

interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export default function AgentsPage() {
  const { hasPermission, userAgents } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Agent | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState({
    name: "",
    nickname: "",
    group: "",
    isActive: true,
  });
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [showGroupDropdown, setShowGroupDropdown] = useState(false);
  const [showNewGroupInput, setShowNewGroupInput] = useState(false);
  const [newGroup, setNewGroup] = useState("");
  const groupRef = useRef<HTMLDivElement>(null);

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    const token = localStorage.getItem("accessToken");
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (groupFilter !== "all") params.set("group", groupFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);

      const res = await fetch(`http://localhost:3009/api/agents?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setAgents(await res.json());
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [search, groupFilter, statusFilter]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (groupRef.current && !groupRef.current.contains(e.target as Node)) {
        setShowGroupDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    const token = localStorage.getItem("accessToken");
    const body = {
      name: form.name.trim(),
      nickname: form.nickname.trim() || null,
      group: form.group.trim() || null,
      isActive: form.isActive,
    };
    const url = editing
      ? `http://localhost:3009/api/agents/${editing.id}`
      : "http://localhost:3009/api/agents";
    const method = editing ? "PATCH" : "POST";
    try {
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to save");
        return;
      }
      setShowForm(false);
      setEditing(null);
      setForm({ name: "", nickname: "", group: "", isActive: true });
      fetchAgents();
      setSuccess(editing ? "Agent updated" : "Agent created");
    } catch {
      setError("Network error");
    }
  };

  const handleToggleActive = async (agent: Agent) => {
    const token = localStorage.getItem("accessToken");
    try {
      await fetch(`http://localhost:3009/api/agents/${agent.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isActive: !agent.isActive }),
      });
      fetchAgents();
    } catch {
      /* ignore */
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this agent?")) return;
    const token = localStorage.getItem("accessToken");
    try {
      await fetch(`http://localhost:3009/api/agents/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchAgents();
    } catch {
      /* ignore */
    }
  };

  const selectGroup = (g: string) => {
    setForm({ ...form, group: g });
    setShowGroupDropdown(false);
    setShowNewGroupInput(false);
    setNewGroup("");
  };

  const createNewGroup = () => {
    if (newGroup.trim()) {
      setForm({ ...form, group: newGroup.trim() });
      setShowGroupDropdown(false);
      setShowNewGroupInput(false);
      setNewGroup("");
    }
  };

  const handleImport = async () => {
    setError("");
    setImportResult(null);
    setImporting(true);

    try {
      const lines = csvText
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l);
      if (lines.length < 2) {
        setError("CSV must have a header row and at least one data row");
        setImporting(false);
        return;
      }

      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
      const agents = lines.slice(1).map((line) => {
        const values = line.split(",").map((v) => v.trim());
        const row: Record<string, string> = {};
        headers.forEach((h, i) => {
          row[h] = values[i] || "";
        });
        return row;
      });

      const token = localStorage.getItem("accessToken");
      const res = await fetch("http://localhost:3009/api/agents/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ agents }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Import failed");
        setImporting(false);
        return;
      }

      setImportResult(data);
      fetchAgents();
    } catch {
      setError("Network error");
    } finally {
      setImporting(false);
    }
  };

  // Filtered and paginated agents
  const groups = Array.from(
    new Set(
      agents.map((a) => a.group || "Ungrouped").filter(Boolean) as string[],
    ),
  ).sort();

  const filteredAgents = agents; // Already filtered by backend
  const totalPages = Math.ceil(filteredAgents.length / pageSize);
  const paginatedAgents = filteredAgents.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );

  const canManage = hasPermission("agents:manage");

  if (loading) return <div className="p-4">Loading...</div>;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agents</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage agent names, nicknames, and groups
          </p>
        </div>
        <div className="flex gap-2">
          {canManage && (
            <button
              onClick={() => {
                setShowImport(true);
                setCsvText("");
                setImportResult(null);
              }}
              className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 transition hover:bg-gray-50"
            >
              Import CSV
            </button>
          )}
          {canManage && (
            <button
              onClick={() => {
                setShowForm(true);
                setEditing(null);
                setForm({ name: "", nickname: "", group: "", isActive: true });
              }}
              className="rounded bg-green-600 px-4 py-2 text-sm text-white transition hover:bg-green-700"
            >
              Add Agent
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 rounded border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search agents..."
          className="rounded border border-gray-300 px-3 py-2 text-sm w-64"
        />
        <select
          value={groupFilter}
          onChange={(e) => {
            setGroupFilter(e.target.value);
            setPage(1);
          }}
          className="rounded border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="all">All Groups</option>
          {groups.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="rounded border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <span className="text-sm text-gray-500">
          {filteredAgents.length} agent(s)
        </span>
      </div>

      {/* Table */}
      {filteredAgents.length === 0 ? (
        <div className="rounded-lg border bg-white p-8 text-center text-gray-500">
          {canManage ? "No agents configured" : "No agents assigned to you"}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Nickname
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Group
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Status
                </th>
                {canManage && (
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {paginatedAgents.map((agent) => (
                <tr key={agent.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                    {agent.name}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {agent.nickname || "-"}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm">
                    <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-700">
                      {agent.group || "Ungrouped"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm">
                    {canManage ? (
                      <Toggle
                        checked={agent.isActive}
                        onChange={() => handleToggleActive(agent)}
                        label={agent.isActive ? "Active" : "Inactive"}
                      />
                    ) : (
                      <span
                        className={`rounded-full px-2 py-1 text-xs ${agent.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}
                      >
                        {agent.isActive ? "Active" : "Inactive"}
                      </span>
                    )}
                  </td>
                  {canManage && (
                    <td className="whitespace-nowrap px-6 py-4 text-sm">
                      <button
                        onClick={() => {
                          setEditing(agent);
                          setForm({
                            name: agent.name,
                            nickname: agent.nickname || "",
                            group: agent.group || "",
                            isActive: agent.isActive,
                          });
                          setShowForm(true);
                        }}
                        className="mr-2 text-blue-600 hover:text-blue-800"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(agent.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
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
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded border border-gray-300 px-3 py-1 text-sm disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded border border-gray-300 px-3 py-1 text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-6 rounded-lg border bg-white p-6 shadow-sm"
        >
          <h2 className="mb-4 text-lg font-semibold">
            {editing ? "Edit Agent" : "New Agent"}
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Agent Name *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Nickname
              </label>
              <input
                type="text"
                value={form.nickname}
                onChange={(e) => setForm({ ...form, nickname: e.target.value })}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div ref={groupRef}>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Group
              </label>
              <button
                type="button"
                onClick={() => {
                  setShowGroupDropdown(!showGroupDropdown);
                  setShowNewGroupInput(false);
                }}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-left bg-white hover:border-gray-400 min-h-[34px] flex items-center justify-between"
              >
                <span>{form.group || "Select or create a group..."}</span>
                <svg
                  className="w-4 h-4 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
              {showGroupDropdown && (
                <div className="absolute z-20 mt-1 w-64 rounded border bg-white shadow-lg max-h-48 overflow-y-auto">
                  {(() => {
                    const existingGroups = Array.from(
                      new Set(
                        agents.map((a) => a.group).filter(Boolean) as string[],
                      ),
                    ).sort();
                    return existingGroups.length === 0 ? (
                      <div className="p-3 text-sm text-gray-500">
                        No groups yet
                      </div>
                    ) : (
                      existingGroups.map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => selectGroup(g)}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-green-50 ${
                            form.group === g ? "bg-green-50 text-green-700" : ""
                          }`}
                        >
                          {g}
                        </button>
                      ))
                    );
                  })()}
                  <div className="border-t">
                    <button
                      type="button"
                      onClick={() => setShowNewGroupInput(true)}
                      className="w-full text-left px-3 py-2 text-sm text-green-600 hover:bg-green-50 font-medium"
                    >
                      + Create new group
                    </button>
                  </div>
                </div>
              )}
              {showNewGroupInput && (
                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    value={newGroup}
                    onChange={(e) => setNewGroup(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        createNewGroup();
                      }
                      if (e.key === "Escape") {
                        setShowNewGroupInput(false);
                        setNewGroup("");
                      }
                    }}
                    placeholder="Group name..."
                    className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={createNewGroup}
                    className="rounded bg-green-600 px-3 py-2 text-sm text-white hover:bg-green-700"
                  >
                    Add
                  </button>
                </div>
              )}
            </div>
            <div className="flex items-end">
              <Toggle
                checked={form.isActive}
                onChange={(v) => setForm({ ...form, isActive: v })}
                label="Active"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              className="rounded bg-green-600 px-4 py-2 text-sm text-white transition hover:bg-green-700"
            >
              {editing ? "Update" : "Create"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditing(null);
              }}
              className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 transition hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* CSV Import Modal */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl max-h-[85vh] overflow-y-auto">
            <h2 className="mb-1 text-lg font-semibold">
              Import Agents from CSV
            </h2>
            <p className="mb-4 text-sm text-gray-500">
              Paste CSV data with columns:{" "}
              <code className="rounded bg-gray-100 px-1">name</code>,{" "}
              <code className="rounded bg-gray-100 px-1">nickname</code>{" "}
              (optional),{" "}
              <code className="rounded bg-gray-100 px-1">group</code>{" "}
              (optional). Existing agents will be updated.
            </p>

            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={
                "name,nickname,group\nNX0001,John Doe,Team A\nNX0002,Jane Smith,Team B"
              }
              className="w-full h-48 rounded border border-gray-300 px-3 py-2 text-sm font-mono"
            />

            {importResult && (
              <div className="mt-4 rounded border border-green-200 bg-green-50 p-4">
                <h3 className="text-sm font-medium text-green-800">
                  Import Results
                </h3>
                <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                  <span className="text-green-700">
                    Created: {importResult.created}
                  </span>
                  <span className="text-blue-700">
                    Updated: {importResult.updated}
                  </span>
                  <span className="text-yellow-700">
                    Skipped: {importResult.skipped}
                  </span>
                </div>
                {importResult.errors.length > 0 && (
                  <div className="mt-2 text-xs text-red-600">
                    <strong>Errors:</strong>
                    <ul className="list-disc ml-4">
                      {importResult.errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {error && !importResult && (
              <div className="mt-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setShowImport(false);
                  setCsvText("");
                  setImportResult(null);
                  setError("");
                }}
                className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition"
              >
                Close
              </button>
              <button
                onClick={handleImport}
                disabled={importing || !csvText.trim()}
                className="rounded bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700 transition disabled:opacity-50"
              >
                {importing ? "Importing..." : "Import"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
