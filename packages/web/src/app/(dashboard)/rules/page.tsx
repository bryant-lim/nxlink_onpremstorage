"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Toggle from "@/components/Toggle";
import { useAuth } from "@/providers/auth-provider";

interface Rule {
  id: number;
  name: string;
  agentNames: string | null;
  directions: string | null;
  answeredOnly: boolean;
  minDuration: number | null;
  isActive: boolean;
  createdAt: string;
}

interface Agent {
  id: number;
  name: string;
  nickname: string | null;
  group: string | null;
  isActive: boolean;
}

export default function RulesPage() {
  const { hasPermission } = useAuth();
  const [rules, setRules] = useState<Rule[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    selectedAgents: [] as string[],
    directions: [] as number[],
    answeredOnly: false,
    minDuration: "",
    isActive: true,
  });
  const [showAgentDropdown, setShowAgentDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchRules = useCallback(async () => {
    try {
      const token = localStorage.getItem("accessToken");
      const res = await fetch("http://localhost:3009/api/rules", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setRules(await res.json());
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAgents = useCallback(async () => {
    try {
      const token = localStorage.getItem("accessToken");
      const res = await fetch("http://localhost:3009/api/agents", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setAgents(await res.json());
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetchRules();
    fetchAgents();
  }, [fetchRules, fetchAgents]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setShowAgentDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const token = localStorage.getItem("accessToken");
    const body = {
      name: form.name,
      agentNames: form.selectedAgents.length > 0 ? form.selectedAgents : null,
      directions: form.directions.length > 0 ? form.directions : null,
      answeredOnly: form.answeredOnly,
      minDuration: form.minDuration ? parseInt(form.minDuration) : null,
      isActive: form.isActive,
    };
    const url = editingRule
      ? `http://localhost:3009/api/rules/${editingRule.id}`
      : "http://localhost:3009/api/rules";
    const method = editingRule ? "PATCH" : "POST";
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
        setError(data.error || "Failed to save rule");
        return;
      }
      setShowForm(false);
      setEditingRule(null);
      setForm({
        name: "",
        selectedAgents: [],
        directions: [],
        answeredOnly: false,
        minDuration: "",
        isActive: true,
      });
      fetchRules();
    } catch {
      setError("Network error");
    }
  };

  const handleEdit = (rule: Rule) => {
    setEditingRule(rule);
    setForm({
      name: rule.name,
      selectedAgents: rule.agentNames ? JSON.parse(rule.agentNames) : [],
      directions: rule.directions ? JSON.parse(rule.directions) : [],
      answeredOnly: rule.answeredOnly,
      minDuration: rule.minDuration?.toString() || "",
      isActive: rule.isActive,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this rule?")) return;
    const token = localStorage.getItem("accessToken");
    try {
      await fetch(`http://localhost:3009/api/rules/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchRules();
    } catch {
      /* ignore */
    }
  };

  const toggleDirection = (dir: number) => {
    setForm((prev) => ({
      ...prev,
      directions: prev.directions.includes(dir)
        ? prev.directions.filter((d) => d !== dir)
        : [...prev.directions, dir],
    }));
  };

  const toggleAgent = (name: string) => {
    setForm((prev) => ({
      ...prev,
      selectedAgents: prev.selectedAgents.includes(name)
        ? prev.selectedAgents.filter((a) => a !== name)
        : [...prev.selectedAgents, name],
    }));
  };

  if (loading) return <div className="p-4">Loading...</div>;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Download Rules</h1>
          <p className="mt-1 text-sm text-gray-500">
            Configure which recordings to download automatically
          </p>
        </div>
        <button
          onClick={() => {
            setShowForm(true);
            setEditingRule(null);
            setForm({
              name: "",
              selectedAgents: [],
              directions: [],
              answeredOnly: false,
              minDuration: "",
              isActive: true,
            });
          }}
          className="rounded bg-green-600 px-4 py-2 text-sm text-white transition hover:bg-green-700"
        >
          Add Rule
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-6 rounded-lg border bg-white p-6 shadow-sm"
        >
          <h2 className="mb-4 text-lg font-semibold">
            {editingRule ? "Edit Rule" : "New Rule"}
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Rule Name
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                required
              />
            </div>
            <div ref={dropdownRef}>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Agents
              </label>
              <button
                type="button"
                onClick={() => setShowAgentDropdown(!showAgentDropdown)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-left bg-white hover:border-gray-400"
              >
                {form.selectedAgents.length > 0
                  ? `${form.selectedAgents.length} agent(s) selected`
                  : "Select agents..."}
              </button>
              {showAgentDropdown && (
                <div className="absolute z-20 mt-1 w-72 max-h-64 overflow-y-auto rounded border bg-white shadow-lg">
                  {agents.length === 0 ? (
                    <div className="p-3 text-sm text-gray-500">
                      No agents configured. Go to Agents page to add.
                    </div>
                  ) : (
                    Object.entries(
                      agents.reduce<Record<string, Agent[]>>((acc, a) => {
                        const g = a.group || "Ungrouped";
                        if (!acc[g]) acc[g] = [];
                        acc[g].push(a);
                        return acc;
                      }, {}),
                    )
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([group, groupAgents]) => (
                        <div key={group}>
                          <div className="px-3 py-1 text-xs font-semibold text-gray-400 uppercase bg-gray-50">
                            {group}
                          </div>
                          {groupAgents.map((agent) => (
                            <label
                              key={agent.id}
                              className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={form.selectedAgents.includes(
                                  agent.name,
                                )}
                                onChange={() => toggleAgent(agent.name)}
                                className="rounded"
                              />
                              <span>{agent.name}</span>
                              {agent.nickname && (
                                <span className="text-gray-400 text-xs">
                                  ({agent.nickname})
                                </span>
                              )}
                            </label>
                          ))}
                        </div>
                      ))
                  )}
                </div>
              )}
              {form.selectedAgents.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {form.selectedAgents.map((name) => (
                    <span
                      key={name}
                      className="inline-flex items-center gap-1 rounded bg-green-50 px-2 py-0.5 text-xs text-green-700"
                    >
                      {name}
                      <button
                        type="button"
                        onClick={() => toggleAgent(name)}
                        className="hover:text-green-900"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Directions
              </label>
              <div className="flex gap-4">
                {[
                  { value: 0, label: "Inbound" },
                  { value: 1, label: "Outbound" },
                  { value: 2, label: "AICC" },
                ].map((dir) => (
                  <label
                    key={dir.value}
                    className="flex items-center gap-1 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={form.directions.includes(dir.value)}
                      onChange={() => toggleDirection(dir.value)}
                    />
                    {dir.label}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Min Duration (seconds)
              </label>
              <input
                type="number"
                value={form.minDuration}
                onChange={(e) =>
                  setForm({ ...form, minDuration: e.target.value })
                }
                min={0}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.answeredOnly}
                  onChange={(e) =>
                    setForm({ ...form, answeredOnly: e.target.checked })
                  }
                />
                Answered only
              </label>
              <Toggle
                checked={form.isActive}
                onChange={(v) => setForm({ ...form, isActive: v })}
                label="Active"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            {hasPermission("rules:manage") && (
              <button
                type="submit"
                className="rounded bg-green-600 px-4 py-2 text-sm text-white transition hover:bg-green-700"
              >
                {editingRule ? "Save" : "Add Rule"}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingRule(null);
              }}
              className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 transition hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Agents
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Directions
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Answered Only
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Min Duration
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {rules.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-6 py-8 text-center text-sm text-gray-500"
                >
                  No rules configured
                </td>
              </tr>
            ) : (
              rules.map((rule) => (
                <tr key={rule.id}>
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                    {rule.name}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {rule.agentNames
                      ? JSON.parse(rule.agentNames).join(", ")
                      : "All"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {rule.directions
                      ? JSON.parse(rule.directions)
                          .map(
                            (d: number) => ["Inbound", "Outbound", "AICC"][d],
                          )
                          .join(", ")
                      : "All"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {rule.answeredOnly ? "Yes" : "No"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {rule.minDuration ? `${rule.minDuration}s` : "-"}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {hasPermission("rules:manage") ? (
                      <Toggle
                        checked={rule.isActive}
                        onChange={() => handleEdit(rule)}
                      />
                    ) : (
                      <span
                        className={`rounded-full px-2 py-1 text-xs ${rule.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}
                      >
                        {rule.isActive ? "Active" : "Inactive"}
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm">
                    {hasPermission("rules:manage") && (
                      <>
                        <button
                          onClick={() => handleEdit(rule)}
                          className="mr-2 text-blue-600 hover:text-blue-800"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(rule.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
