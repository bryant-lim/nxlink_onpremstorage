"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/providers/auth-provider";
import Toggle from "@/components/Toggle";

interface User {
  id: number;
  username: string;
  email: string | null;
  isActive: boolean;
  createdAt: string;
}

interface Role {
  id: number;
  name: string;
  description: string | null;
  isSystem: boolean;
}

interface Agent {
  id: number;
  name: string;
  nickname: string | null;
  group: string | null;
}

interface UserAccess {
  user: User;
  roles: { id: number; name: string; description: string | null }[];
  agents: Agent[];
}

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserAccess | null>(null);
  const [passwordUser, setPasswordUser] = useState<User | null>(null);
  const [passwordForm, setPasswordForm] = useState({
    password: "",
    confirm: "",
  });
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    username: "",
    password: "",
    email: "",
    role: "viewer",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchData = useCallback(async () => {
    const token = localStorage.getItem("accessToken");
    try {
      const [usersRes, rolesRes, agentsRes] = await Promise.all([
        fetch("http://localhost:3009/api/users", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("http://localhost:3009/api/roles", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("http://localhost:3009/api/agents", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      if (usersRes.ok) setUsers(await usersRes.json());
      if (rolesRes.ok) setRoles(await rolesRes.json());
      if (agentsRes.ok) setAgents(await agentsRes.json());
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const token = localStorage.getItem("accessToken");
      const res = await fetch("http://localhost:3009/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create user");
        return;
      }
      setShowForm(false);
      setForm({ username: "", password: "", email: "", role: "viewer" });
      fetchData();
      setSuccess("User created");
    } catch {
      setError("Network error");
    }
  };

  const handleToggleActive = async (user: User) => {
    const token = localStorage.getItem("accessToken");
    try {
      await fetch(`http://localhost:3009/api/users/${user.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isActive: !user.isActive }),
      });
      fetchData();
    } catch {
      /* ignore */
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (passwordForm.password.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      return;
    }
    if (passwordForm.password !== passwordForm.confirm) {
      setPasswordError("Passwords do not match");
      return;
    }

    const token = localStorage.getItem("accessToken");
    try {
      const res = await fetch(
        `http://localhost:3009/api/users/${passwordUser?.id}/password`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ password: passwordForm.password }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        setPasswordError(data.error || "Failed to update password");
        return;
      }
      setPasswordSuccess("Password updated successfully");
      setPasswordForm({ password: "", confirm: "" });
      setTimeout(() => {
        setShowPasswordModal(false);
        setPasswordUser(null);
        setPasswordForm({ password: "", confirm: "" });
        setPasswordError("");
        setPasswordSuccess("");
      }, 1500);
    } catch {
      setPasswordError("Network error");
    }
  };

  const openAccessModal = async (user: User) => {
    const token = localStorage.getItem("accessToken");
    try {
      const res = await fetch(
        `http://localhost:3009/api/users/${user.id}/access`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (res.ok) {
        setSelectedUser(await res.json());
        setShowAccessModal(true);
      }
    } catch {
      /* ignore */
    }
  };

  const handleSaveAll = async () => {
    if (!selectedUser) return;
    setSaving(true);
    setError("");
    setSuccess("");
    const token = localStorage.getItem("accessToken");

    try {
      // Save roles
      const rolesRes = await fetch(
        `http://localhost:3009/api/users/${selectedUser.user.id}/roles`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            roleIds: selectedUser.roles.map((r) => r.id),
          }),
        },
      );

      if (!rolesRes.ok) {
        const data = await rolesRes.json();
        setError(data.error || "Failed to save roles");
        setSaving(false);
        return;
      }

      // Save agents
      const agentsRes = await fetch(
        `http://localhost:3009/api/users/${selectedUser.user.id}/agents`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            agentIds: selectedUser.agents.map((a) => a.id),
          }),
        },
      );

      if (!agentsRes.ok) {
        const data = await agentsRes.json();
        setError(data.error || "Failed to save agent access");
        setSaving(false);
        return;
      }

      setSuccess("Access updated successfully");
      setTimeout(() => {
        setShowAccessModal(false);
        setSelectedUser(null);
        setSuccess("");
      }, 1500);
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  };

  const toggleRole = (role: Role) => {
    if (!selectedUser) return;
    setSelectedUser((prev) => {
      if (!prev) return prev;
      const exists = prev.roles.find((r) => r.id === role.id);
      return {
        ...prev,
        roles: exists
          ? prev.roles.filter((r) => r.id !== role.id)
          : [...prev.roles, role],
      };
    });
  };

  const toggleAgent = (agent: Agent) => {
    if (!selectedUser) return;
    setSelectedUser((prev) => {
      if (!prev) return prev;
      const exists = prev.agents.find((a) => a.id === agent.id);
      return {
        ...prev,
        agents: exists
          ? prev.agents.filter((a) => a.id !== agent.id)
          : [...prev.agents, agent],
      };
    });
  };

  if (loading) return <div className="p-4">Loading...</div>;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage users, roles, and agent access
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded bg-green-600 px-4 py-2 text-sm text-white transition hover:bg-green-700"
        >
          {showForm ? "Cancel" : "Add User"}
        </button>
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

      {showForm && (
        <form
          onSubmit={handleRegister}
          className="mb-6 rounded-lg border bg-white p-6 shadow-sm"
        >
          <h2 className="mb-4 text-lg font-semibold">New User</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Username
              </label>
              <input
                type="text"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Default Role
              </label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.name}>
                    {r.name}
                    {r.isSystem ? "" : " (custom)"}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button
            type="submit"
            className="mt-4 rounded bg-green-600 px-4 py-2 text-sm text-white transition hover:bg-green-700"
          >
            Create User
          </button>
        </form>
      )}

      {/* Users Table */}
      <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Username
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Email
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
            {users.map((u) => (
              <tr key={u.id}>
                <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                  {u.username}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                  {u.email || "-"}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm">
                  <Toggle
                    checked={u.isActive}
                    onChange={() => handleToggleActive(u)}
                    label={u.isActive ? "Active" : "Inactive"}
                  />
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openAccessModal(u)}
                      className="rounded bg-blue-50 px-2 py-1 text-xs text-blue-600 hover:bg-blue-100 transition"
                    >
                      Manage Access
                    </button>
                    {u.id !== currentUser?.id && (
                      <button
                        onClick={() => {
                          setPasswordUser(u);
                          setPasswordForm({ password: "", confirm: "" });
                          setPasswordError("");
                          setPasswordSuccess("");
                          setShowPasswordModal(true);
                        }}
                        className="rounded bg-gray-50 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 transition"
                      >
                        Change Password
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Access Management Modal */}
      {showAccessModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl max-h-[85vh] overflow-y-auto">
            <h2 className="mb-4 text-lg font-semibold">
              Manage Access: {selectedUser.user.username}
            </h2>

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

            <div className="mb-6">
              <h3 className="mb-2 text-sm font-medium text-gray-700">Roles</h3>
              <div className="space-y-2">
                {roles.map((role) => {
                  const isSelected = selectedUser.roles.some(
                    (r) => r.id === role.id,
                  );
                  return (
                    <label
                      key={role.id}
                      onClick={() => toggleRole(role)}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${
                        isSelected
                          ? "border-green-200 bg-green-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="mt-0.5 rounded"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-900">
                            {role.name}
                          </span>
                          {role.isSystem && (
                            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 uppercase">
                              Built-in
                            </span>
                          )}
                        </div>
                        {role.description && (
                          <p className="mt-0.5 text-xs text-gray-500 truncate">
                            {role.description}
                          </p>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="mb-6">
              <h3 className="mb-2 text-sm font-medium text-gray-700">
                Agent Access ({selectedUser.agents.length} agents)
              </h3>
              <div className="border rounded-lg p-3 max-h-48 overflow-y-auto">
                {Object.entries(
                  agents.reduce<Record<string, Agent[]>>((acc, a) => {
                    const g = a.group || "Ungrouped";
                    if (!acc[g]) acc[g] = [];
                    acc[g].push(a);
                    return acc;
                  }, {}),
                )
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([group, groupAgents]) => (
                    <div key={group} className="mb-2 last:mb-0">
                      <div className="px-1 py-1 text-xs font-semibold text-gray-400 uppercase">
                        {group}
                      </div>
                      {groupAgents.map((agent) => (
                        <label
                          key={agent.id}
                          className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-gray-50 rounded"
                        >
                          <input
                            type="checkbox"
                            checked={selectedUser.agents.some(
                              (a) => a.id === agent.id,
                            )}
                            onChange={() => toggleAgent(agent)}
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
                  ))}
              </div>
            </div>

            <div className="flex items-center justify-between border-t pt-4">
              <button
                onClick={() => {
                  setShowAccessModal(false);
                  setSelectedUser(null);
                  setError("");
                  setSuccess("");
                }}
                className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAll}
                disabled={saving}
                className="rounded bg-green-600 px-6 py-2 text-sm text-white hover:bg-green-700 transition disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showPasswordModal && passwordUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="mb-1 text-lg font-semibold">Change Password</h2>
            <p className="mb-4 text-sm text-gray-500">
              Updating password for{" "}
              <span className="font-medium text-gray-700">
                {passwordUser.username}
              </span>
            </p>

            {passwordError && (
              <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {passwordError}
              </div>
            )}
            {passwordSuccess && (
              <div className="mb-4 rounded border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                {passwordSuccess}
              </div>
            )}

            <form onSubmit={handleChangePassword}>
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    New Password *
                  </label>
                  <input
                    type="password"
                    value={passwordForm.password}
                    onChange={(e) =>
                      setPasswordForm({
                        ...passwordForm,
                        password: e.target.value,
                      })
                    }
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                    placeholder="Minimum 6 characters"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Confirm Password *
                  </label>
                  <input
                    type="password"
                    value={passwordForm.confirm}
                    onChange={(e) =>
                      setPasswordForm({
                        ...passwordForm,
                        confirm: e.target.value,
                      })
                    }
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                    placeholder="Re-enter password"
                    required
                  />
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordModal(false);
                    setPasswordUser(null);
                    setPasswordForm({ password: "", confirm: "" });
                    setPasswordError("");
                    setPasswordSuccess("");
                  }}
                  className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700 transition"
                >
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
