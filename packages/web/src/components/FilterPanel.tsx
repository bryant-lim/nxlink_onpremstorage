"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/providers/auth-provider";

interface Agent {
  id: number;
  name: string;
  nickname: string | null;
  group: string | null;
}

interface FilterParams {
  answered?: number;
  direction?: number;
  recordingType?: string;
  names?: string[];
  caller?: string;
  callee?: string;
  callId?: string;
  orderId?: string;
  startTime?: number;
  endTime?: number;
  minDuration?: number;
}

interface FilterPanelProps {
  onFilter: (filters: FilterParams) => void;
  onReset: () => void;
}

const getTodayRange = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return {
    start: `${year}-${month}-${day}T00:00`,
    end: `${year}-${month}-${day}T23:59`,
  };
};

export default function FilterPanel({ onFilter, onReset }: FilterPanelProps) {
  const { userAgents } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [filters, setFilters] = useState<FilterParams>({});
  const [dateRange, setDateRange] = useState(() => getTodayRange());
  const [agents, setAgents] = useState<Agent[]>([]);
  const [showAgentDropdown, setShowAgentDropdown] = useState(false);
  const agentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (token) {
      fetch("http://localhost:3009/api/agents", {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => (res.ok ? res.json() : []))
        .then((allAgents) => {
          // Filter to only user's assigned agents if they have restrictions
          const visibleAgents =
            userAgents.length > 0
              ? allAgents.filter((a: Agent) => userAgents.includes(a.name))
              : allAgents;
          setAgents(visibleAgents);
        })
        .catch(() => {});
    }
  }, [userAgents]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (agentRef.current && !agentRef.current.contains(e.target as Node)) {
        setShowAgentDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const params: FilterParams = { ...filters };

    if (dateRange.start) {
      params.startTime = Math.floor(new Date(dateRange.start).getTime() / 1000);
    }
    if (dateRange.end) {
      params.endTime = Math.floor(new Date(dateRange.end).getTime() / 1000);
    }

    onFilter(params);
  };

  const handleReset = () => {
    setFilters({});
    setDateRange({ start: "", end: "" });
    onReset();
  };

  const handleChange = (key: string, value: string) => {
    const numValue = value === "" ? undefined : Number(value);
    setFilters((prev) => ({
      ...prev,
      [key]: value === "" ? undefined : isNaN(numValue!) ? value : numValue,
    }));
  };

  const toggleAgent = (name: string) => {
    const current = filters.names || [];
    const updated = current.includes(name)
      ? current.filter((n) => n !== name)
      : [...current, name];
    setFilters((prev) => ({
      ...prev,
      names: updated.length > 0 ? updated : undefined,
    }));
  };

  return (
    <div className="mb-4 rounded-lg border bg-white shadow-sm">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="text-sm font-medium text-gray-700">Filters</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Reset
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-sm text-green-600 hover:text-green-800"
          >
            {expanded ? "Less" : "More"}
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Date From
            </label>
            <input
              type="datetime-local"
              value={dateRange.start}
              onChange={(e) =>
                setDateRange((prev) => ({ ...prev, start: e.target.value }))
              }
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Date To
            </label>
            <input
              type="datetime-local"
              value={dateRange.end}
              onChange={(e) =>
                setDateRange((prev) => ({ ...prev, end: e.target.value }))
              }
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Answered
            </label>
            <select
              value={filters.answered ?? ""}
              onChange={(e) => handleChange("answered", e.target.value)}
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            >
              <option value="">All</option>
              <option value="1">Not Answered</option>
              <option value="2">Answered</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Direction
            </label>
            <select
              value={filters.direction ?? ""}
              onChange={(e) => handleChange("direction", e.target.value)}
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            >
              <option value="">All</option>
              <option value="1">Inbound</option>
              <option value="2">Outbound</option>
              <option value="3">AICC</option>
            </select>
          </div>
        </div>

        {expanded && (
          <div className="grid grid-cols-1 gap-3 border-t px-4 py-3 sm:grid-cols-2 lg:grid-cols-4">
            <div ref={agentRef}>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                Agent Name
              </label>
              <button
                type="button"
                onClick={() => setShowAgentDropdown(!showAgentDropdown)}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-left bg-white hover:border-gray-400 min-h-[34px]"
              >
                {filters.names && filters.names.length > 0
                  ? `${filters.names.length} agent(s) selected`
                  : "All Agents"}
              </button>
              {showAgentDropdown && (
                <div className="absolute z-20 mt-1 w-72 max-h-64 overflow-y-auto rounded border bg-white shadow-lg">
                  {agents.length === 0 ? (
                    <div className="p-3 text-sm text-gray-500">
                      No agents configured
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
                                checked={(filters.names || []).includes(
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
              {filters.names && filters.names.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {filters.names.map((name) => (
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
              <label className="mb-1 block text-xs font-medium text-gray-500">
                Min Duration (seconds)
              </label>
              <input
                type="number"
                value={(filters.minDuration as number) ?? ""}
                onChange={(e) => handleChange("minDuration", e.target.value)}
                placeholder="e.g. 30"
                min={0}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                Caller
              </label>
              <input
                type="text"
                value={(filters.caller as string) ?? ""}
                onChange={(e) => handleChange("caller", e.target.value)}
                placeholder="Caller number..."
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                Callee
              </label>
              <input
                type="text"
                value={(filters.callee as string) ?? ""}
                onChange={(e) => handleChange("callee", e.target.value)}
                placeholder="Callee number..."
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                Call ID
              </label>
              <input
                type="text"
                value={(filters.callId as string) ?? ""}
                onChange={(e) => handleChange("callId", e.target.value)}
                placeholder="Call ID..."
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                Order ID
              </label>
              <input
                type="text"
                value={(filters.orderId as string) ?? ""}
                onChange={(e) => handleChange("orderId", e.target.value)}
                placeholder="Order ID..."
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                Type
              </label>
              <select
                value={filters.recordingType ?? ""}
                onChange={(e) => handleChange("recordingType", e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              >
                <option value="">All Types</option>
                <option value="agent">Agent Call</option>
                <option value="ai_bot">AI Voice Bot</option>
              </select>
            </div>
          </div>
        )}

        <div className="flex justify-end border-t px-4 py-3">
          <button
            type="submit"
            className="rounded bg-green-600 px-4 py-1.5 text-sm text-white transition hover:bg-green-700"
          >
            Apply Filters
          </button>
        </div>
      </form>
    </div>
  );
}
