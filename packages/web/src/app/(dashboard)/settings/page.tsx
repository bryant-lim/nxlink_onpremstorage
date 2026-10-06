"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/providers/auth-provider";

interface ApiConfig {
  id: number;
  name: string;
  region: string;
  apiGateway: string;
  aiTokenUrl?: string | null;
  aiAppUrl?: string | null;
  isActive: boolean;
  createdAt: string;
}

interface SchedulerConfig {
  id: number;
  cronExpression: string;
  lookbackHours: number;
  pageSize: number;
  storagePath: string;
  isActive: boolean;
}

interface EncryptionStatus {
  enabled: boolean;
}

export default function SettingsPage() {
  const { hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState<
    "api" | "scheduler" | "encryption"
  >("api");
  const [apiConfigs, setApiConfigs] = useState<ApiConfig[]>([]);
  const [scheduler, setScheduler] = useState<SchedulerConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [showApiForm, setShowApiForm] = useState(false);
  const [editingConfig, setEditingConfig] = useState<ApiConfig | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [testing, setTesting] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [savingScheduler, setSavingScheduler] = useState(false);
  const [runningScheduler, setRunningScheduler] = useState(false);
  const [encryptionStatus, setEncryptionStatus] = useState<EncryptionStatus>({
    enabled: false,
  });
  const [apiForm, setApiForm] = useState({
    name: "",
    region: "APAC",
    apiGateway: "https://api-hk.nxlink.ai",
    accessKey: "",
    accessSecret: "",
    bizType: "8",
    action: "cc",
    aiTokenUrl: "",
    aiAppUrl: "",
  });
  const [schedulerForm, setSchedulerForm] = useState({
    cronExpression: "0 */6 * * *",
    lookbackHours: 24,
    pageSize: 100,
    storagePath: "./recordings",
    isActive: false,
  });

  const fetchData = useCallback(async () => {
    const token = localStorage.getItem("accessToken");
    try {
      const [configsRes, rulesRes, schedulerRes, encryptionRes] =
        await Promise.all([
          fetch("http://localhost:3009/api/configs", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch("http://localhost:3009/api/rules", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch("http://localhost:3009/api/scheduler", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch("http://localhost:3009/api/configs/encryption-status", {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);
      if (configsRes.ok) setApiConfigs(await configsRes.json());
      if (schedulerRes.ok) {
        const schedulers = await schedulerRes.json();
        const active = schedulers.find((s: any) => s.isActive) || schedulers[0];
        if (active) {
          setScheduler(active);
          setSchedulerForm({
            cronExpression: active.cronExpression,
            lookbackHours: active.lookbackHours,
            pageSize: active.pageSize,
            storagePath: active.storagePath,
            isActive: active.isActive,
          });
        }
      }
      if (encryptionRes.ok) {
        setEncryptionStatus(await encryptionRes.json());
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleApiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    const token = localStorage.getItem("accessToken");
    const url = editingConfig
      ? `http://localhost:3009/api/configs/${editingConfig.id}`
      : "http://localhost:3009/api/configs";
    const method = editingConfig ? "PATCH" : "POST";
    try {
      const body: Record<string, any> = { ...apiForm };
      if (!apiForm.accessSecret) delete body.accessSecret;
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
      setShowApiForm(false);
      setEditingConfig(null);
      setApiForm({
        name: "",
        region: "APAC",
        apiGateway: "https://api-hk.nxlink.ai",
        accessKey: "",
        accessSecret: "",
        bizType: "8",
        action: "cc",
        aiTokenUrl: "",
        aiAppUrl: "",
      });
      fetchData();
      setSuccess("API configuration saved");
    } catch {
      setError("Network error");
    }
  };

  const handleTest = async (id: number) => {
    setTesting(id);
    setError("");
    const token = localStorage.getItem("accessToken");
    try {
      const res = await fetch(`http://localhost:3009/api/configs/${id}/test`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setSuccess("Connection successful");
      else setError(data.message || "Connection failed");
    } catch {
      setError("Test failed");
    } finally {
      setTesting(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this API configuration?")) return;
    const token = localStorage.getItem("accessToken");
    try {
      await fetch(`http://localhost:3009/api/configs/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchData();
    } catch {
      /* ignore */
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setError("");
    setSuccess("");
    const token = localStorage.getItem("accessToken");
    const now = Math.floor(Date.now() / 1000);
    const oneDayAgo = now - 86400;
    try {
      const res = await fetch("http://localhost:3009/api/cdrs/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ startTime: oneDayAgo, endTime: now }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Sync failed");
        return;
      }
      setSuccess(
        `Sync complete: ${data.synced} new, ${data.updated} updated, ${data.total} total. Downloaded: ${data.downloaded || 0} matching recordings.`,
      );
    } catch {
      setError("Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const handleRunScheduler = async () => {
    setRunningScheduler(true);
    setError("");
    setSuccess("");
    const token = localStorage.getItem("accessToken");
    try {
      const res = await fetch("http://localhost:3009/api/scheduler/run", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to run scheduler sync");
        return;
      }
      setSuccess(
        `Scheduler sync complete: ${data.synced} CDRs synced, ${data.downloaded} downloaded, ${data.failed} failed, ${data.skipped} skipped.`,
      );
    } catch {
      setError("Failed to run scheduler sync");
    } finally {
      setRunningScheduler(false);
    }
  };

  const handleSaveScheduler = async () => {
    setSavingScheduler(true);
    setError("");
    setSuccess("");
    const token = localStorage.getItem("accessToken");
    try {
      const body = {
        cronExpression: schedulerForm.cronExpression,
        lookbackHours: schedulerForm.lookbackHours,
        pageSize: schedulerForm.pageSize,
        storagePath: schedulerForm.storagePath,
        isActive: schedulerForm.isActive,
      };

      let res;
      if (scheduler && scheduler.id) {
        res = await fetch(
          `http://localhost:3009/api/scheduler/${scheduler.id}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(body),
          },
        );
      } else {
        res = await fetch("http://localhost:3009/api/scheduler", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        });
      }

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to save scheduler config");
        return;
      }
      setScheduler(data);
      setSuccess("Scheduler configuration saved");
    } catch {
      setError("Failed to save scheduler config");
    } finally {
      setSavingScheduler(false);
    }
  };

  if (loading) return <div className="p-4">Loading...</div>;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          API configuration and scheduler settings
        </p>
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

      <div className="mb-4 flex gap-2 border-b">
        <button
          onClick={() => setActiveTab("api")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${activeTab === "api" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
        >
          API Configuration
        </button>
        <button
          onClick={() => setActiveTab("scheduler")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${activeTab === "scheduler" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
        >
          Scheduler
        </button>
        {hasPermission("settings:encryption") && (
          <button
            onClick={() => setActiveTab("encryption")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${activeTab === "encryption" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            Encryption
          </button>
        )}
      </div>

      {activeTab === "api" && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <button
              onClick={() => {
                setShowApiForm(true);
                setEditingConfig(null);
                setApiForm({
                  name: "",
                  region: "APAC",
                  apiGateway: "https://api-hk.nxlink.ai",
                  accessKey: "",
                  accessSecret: "",
                  bizType: "8",
                  action: "cc",
                  aiTokenUrl: "",
                  aiAppUrl: "",
                });
              }}
              className="rounded bg-green-600 px-4 py-2 text-sm text-white transition hover:bg-green-700"
            >
              Add API Config
            </button>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="rounded bg-green-600 px-4 py-2 text-sm text-white transition hover:bg-green-700 disabled:opacity-50"
            >
              {syncing ? "Syncing..." : "Sync Now"}
            </button>
          </div>

          {showApiForm && (
            <form
              onSubmit={handleApiSubmit}
              className="mb-6 rounded-lg border bg-white p-6 shadow-sm"
            >
              <h2 className="mb-4 text-lg font-semibold">
                {editingConfig ? "Edit" : "New"} API Configuration
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Name
                  </label>
                  <input
                    type="text"
                    value={apiForm.name}
                    onChange={(e) =>
                      setApiForm({ ...apiForm, name: e.target.value })
                    }
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Region
                  </label>
                  <select
                    value={apiForm.region}
                    onChange={(e) => {
                      const gateways: Record<string, string> = {
                        APAC: "https://api-hk.nxlink.ai",
                        AMER: "https://chl-api.nxlink.ai",
                        APAC_IDN: "https://api-idn.nxlink.ai",
                      };
                      setApiForm({
                        ...apiForm,
                        region: e.target.value,
                        apiGateway: gateways[e.target.value],
                      });
                    }}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="APAC">APAC (Hong Kong)</option>
                    <option value="AMER">AMER (Americas)</option>
                    <option value="APAC_IDN">APAC (Indonesia)</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    API Gateway
                  </label>
                  <input
                    type="text"
                    value={apiForm.apiGateway}
                    onChange={(e) =>
                      setApiForm({ ...apiForm, apiGateway: e.target.value })
                    }
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Access Key
                  </label>
                  <input
                    type="text"
                    value={apiForm.accessKey}
                    onChange={(e) =>
                      setApiForm({ ...apiForm, accessKey: e.target.value })
                    }
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Access Secret
                  </label>
                  <input
                    type="password"
                    value={apiForm.accessSecret}
                    onChange={(e) =>
                      setApiForm({ ...apiForm, accessSecret: e.target.value })
                    }
                    placeholder={
                      editingConfig ? "Leave blank to keep current" : ""
                    }
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                    required={!editingConfig}
                  />
                </div>
                <div className="sm:col-span-2 border-t pt-4 mt-2">
                  <h3 className="text-sm font-semibold text-gray-800 mb-1">AI Voice Bot Settings (Optional)</h3>
                  <p className="text-xs text-gray-500 mb-3">Required only if syncing and downloading AI Voice Bot recordings via Flow Manager.</p>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        AI Token URL
                      </label>
                      <input
                        type="url"
                        value={apiForm.aiTokenUrl}
                        onChange={(e) =>
                          setApiForm({ ...apiForm, aiTokenUrl: e.target.value })
                        }
                        placeholder="https://.../get_plat_token?access_key=..."
                        className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        AI App URL
                      </label>
                      <input
                        type="url"
                        value={apiForm.aiAppUrl}
                        onChange={(e) =>
                          setApiForm({ ...apiForm, aiAppUrl: e.target.value })
                        }
                        placeholder="https://app.nxlink.ai"
                        className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  type="submit"
                  className="rounded bg-green-600 px-4 py-2 text-sm text-white transition hover:bg-green-700"
                >
                  {editingConfig ? "Update" : "Create"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowApiForm(false);
                    setEditingConfig(null);
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
                    Region
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Gateway
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
                {apiConfigs.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-8 text-center text-sm text-gray-500"
                    >
                      No API configurations
                    </td>
                  </tr>
                ) : (
                  apiConfigs.map((config) => (
                    <tr key={config.id}>
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                        {config.name}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                        {config.region}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {config.apiGateway}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span
                          className={`rounded-full px-2 py-1 text-xs ${config.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}
                        >
                          {config.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm">
                        <button
                          onClick={() => handleTest(config.id)}
                          disabled={testing === config.id}
                          className="mr-2 text-blue-600 hover:text-blue-800 disabled:opacity-50"
                        >
                          {testing === config.id ? "Testing..." : "Test"}
                        </button>
                        <button
                          onClick={() => {
                            setEditingConfig(config);
                            setShowApiForm(true);
                            setApiForm({
                              name: config.name,
                              region: config.region,
                              apiGateway: config.apiGateway,
                              accessKey: "",
                              accessSecret: "",
                              bizType: "8",
                              action: "cc",
                              aiTokenUrl: config.aiTokenUrl || "",
                              aiAppUrl: config.aiAppUrl || "",
                            });
                          }}
                          className="mr-2 text-gray-600 hover:text-gray-800"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(config.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "scheduler" && (
        <div className="space-y-6">
          <div className="rounded-lg border bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">
              Scheduler Configuration
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Cron Expression
                </label>
                <input
                  type="text"
                  value={schedulerForm.cronExpression}
                  onChange={(e) =>
                    setSchedulerForm({
                      ...schedulerForm,
                      cronExpression: e.target.value,
                    })
                  }
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  placeholder="0 */6 * * *"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Default: every 6 hours
                </p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Lookback Hours
                </label>
                <input
                  type="number"
                  value={schedulerForm.lookbackHours}
                  onChange={(e) =>
                    setSchedulerForm({
                      ...schedulerForm,
                      lookbackHours: parseInt(e.target.value),
                    })
                  }
                  min={1}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Page Size
                </label>
                <input
                  type="number"
                  value={schedulerForm.pageSize}
                  onChange={(e) =>
                    setSchedulerForm({
                      ...schedulerForm,
                      pageSize: parseInt(e.target.value),
                    })
                  }
                  min={1}
                  max={100}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Storage Path
                </label>
                <input
                  type="text"
                  value={schedulerForm.storagePath}
                  onChange={(e) =>
                    setSchedulerForm({
                      ...schedulerForm,
                      storagePath: e.target.value,
                    })
                  }
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex items-center">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={schedulerForm.isActive}
                    onChange={(e) =>
                      setSchedulerForm({
                        ...schedulerForm,
                        isActive: e.target.checked,
                      })
                    }
                  />
                  Enable scheduler
                </label>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={handleSaveScheduler}
                disabled={savingScheduler}
                className="rounded bg-green-600 px-4 py-2 text-sm text-white transition hover:bg-green-700 disabled:opacity-50"
              >
                {savingScheduler ? "Saving..." : "Save Scheduler Config"}
              </button>
              <button
                type="button"
                onClick={handleRunScheduler}
                disabled={runningScheduler}
                className="rounded bg-green-600 px-4 py-2 text-sm text-white transition hover:bg-green-700 disabled:opacity-50"
              >
                {runningScheduler ? "Running..." : "Run Scheduler Sync Now"}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === "encryption" && (
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="mb-2 text-lg font-semibold">Audio Encryption</h2>
          <p className="mb-4 text-sm text-gray-500">
            When enabled, recordings are encrypted on disk using AES-256-GCM.
            Playback and export work transparently. Direct file access will not
            work.
          </p>

          <div className="flex items-center gap-3 rounded-lg border bg-gray-50 p-4">
            <div
              className={`h-3 w-3 rounded-full ${encryptionStatus.enabled ? "bg-green-500" : "bg-gray-300"}`}
            />
            <div>
              <p className="text-sm font-medium text-gray-900">
                {encryptionStatus.enabled
                  ? "Encryption Enabled"
                  : "Encryption Disabled"}
              </p>
              <p className="text-xs text-gray-500">
                {encryptionStatus.enabled
                  ? "New recordings will be encrypted. Set AUDIO_ENCRYPTION_KEY in .env to configure."
                  : "Recordings are stored unencrypted. Set AUDIO_ENCRYPTION_KEY in .env to enable."}
              </p>
            </div>
          </div>

          {!encryptionStatus.enabled && (
            <div className="mt-4 rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
              <strong>How to enable:</strong> Generate a key with{" "}
              <code className="rounded bg-amber-100 px-1">
                openssl rand -hex 32
              </code>{" "}
              and set it as{" "}
              <code className="rounded bg-amber-100 px-1">
                AUDIO_ENCRYPTION_KEY
              </code>{" "}
              in your <code className="rounded bg-amber-100 px-1">.env</code>{" "}
              file, then restart the server.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
