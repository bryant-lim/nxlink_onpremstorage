"use client";

import { useState, useEffect, useCallback } from "react";

interface Role {
  id: number;
  name: string;
  description: string | null;
  isSystem: boolean;
  _count: { permissions: number };
}

interface Permission {
  id: number;
  key: string;
  category: string;
  label: string;
  description: string | null;
}

const CATEGORIES = [
  "dashboard",
  "recordings",
  "downloads",
  "agents",
  "rules",
  "reports",
  "settings",
  "users",
];

const CATEGORY_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  recordings: "Recordings",
  downloads: "Downloads",
  agents: "Agents",
  rules: "Rules",
  reports: "Reports",
  settings: "Settings",
  users: "Users",
};

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState({
    name: "",
    description: "",
    permissionKeys: [] as string[],
  });

  const fetchData = useCallback(async () => {
    const token = localStorage.getItem("accessToken");
    try {
      const [rolesRes, permsRes] = await Promise.all([
        fetch("http://localhost:3009/api/roles", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("http://localhost:3009/api/roles/permissions", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      if (rolesRes.ok) setRoles(await rolesRes.json());
      if (permsRes.ok) setPermissions(await permsRes.json());
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    const token = localStorage.getItem("accessToken");
    const body = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      permissionKeys: form.permissionKeys,
    };
    const url = editing
      ? `http://localhost:3009/api/roles/${editing.id}`
      : "http://localhost:3009/api/roles";
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
      setForm({ name: "", description: "", permissionKeys: [] });
      fetchData();
      setSuccess(editing ? "Role updated" : "Role created");
    } catch {
      setError("Network error");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this role?")) return;
    const token = localStorage.getItem("accessToken");
    try {
      await fetch(`http://localhost:3009/api/roles/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchData();
    } catch {
      /* ignore */
    }
  };

  const togglePermission = (key: string) => {
    setForm((prev) => ({
      ...prev,
      permissionKeys: prev.permissionKeys.includes(key)
        ? prev.permissionKeys.filter((k) => k !== key)
        : [...prev.permissionKeys, key],
    }));
  };

  const toggleCategory = (category: string) => {
    const catPerms = permissions
      .filter((p) => p.category === category)
      .map((p) => p.key);
    const allSelected = catPerms.every((k) => form.permissionKeys.includes(k));
    setForm((prev) => ({
      ...prev,
      permissionKeys: allSelected
        ? prev.permissionKeys.filter((k) => !catPerms.includes(k))
        : [...new Set([...prev.permissionKeys, ...catPerms])],
    }));
  };

  if (loading) return <div className="p-4">Loading...</div>;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Roles</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage roles and permissions
          </p>
        </div>
        <button
          onClick={() => {
            setShowForm(true);
            setEditing(null);
            setForm({ name: "", description: "", permissionKeys: [] });
          }}
          className="rounded bg-green-600 px-4 py-2 text-sm text-white transition hover:bg-green-700"
        >
          Create Role
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
          onSubmit={handleSubmit}
          className="mb-6 rounded-lg border bg-white p-6 shadow-sm"
        >
          <h2 className="mb-4 text-lg font-semibold">
            {editing ? "Edit Role" : "New Role"}
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Role Name *
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
                Description
              </label>
              <input
                type="text"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <h3 className="mb-2 text-sm font-medium text-gray-700">
            Permissions ({form.permissionKeys.length} selected)
          </h3>
          <div className="space-y-4 max-h-96 overflow-y-auto border rounded-lg p-4">
            {CATEGORIES.map((cat) => {
              const catPerms = permissions.filter((p) => p.category === cat);
              const allSelected = catPerms.every((p) =>
                form.permissionKeys.includes(p.key),
              );
              return (
                <div key={cat}>
                  <div className="flex items-center gap-2 mb-1">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={() => toggleCategory(cat)}
                      className="rounded"
                    />
                    <span className="text-sm font-semibold text-gray-700">
                      {CATEGORY_LABELS[cat]}
                    </span>
                  </div>
                  <div className="ml-6 grid grid-cols-1 sm:grid-cols-2 gap-1">
                    {catPerms.map((perm) => (
                      <label
                        key={perm.id}
                        className="flex items-center gap-2 text-sm cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={form.permissionKeys.includes(perm.key)}
                          onChange={() => togglePermission(perm.key)}
                          className="rounded"
                        />
                        {perm.label}
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
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

      <div className="space-y-4">
        {roles.map((role) => (
          <div
            key={role.id}
            className="rounded-lg border bg-white p-4 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {role.name}
                  </h3>
                  {role.isSystem && (
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                      Built-in
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500">
                  {role.description || "No description"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">
                  {role._count.permissions} permissions
                </span>
                {!role.isSystem && (
                  <>
                    <button
                      onClick={async () => {
                        const token = localStorage.getItem("accessToken");
                        try {
                          const res = await fetch(
                            `http://localhost:3009/api/roles/${role.id}`,
                            { headers: { Authorization: `Bearer ${token}` } },
                          );
                          if (res.ok) {
                            const roleData = await res.json();
                            setEditing(role);
                            setForm({
                              name: role.name,
                              description: role.description || "",
                              permissionKeys: (roleData.permissions || []).map(
                                (rp: any) => rp.permission.key,
                              ),
                            });
                            setShowForm(true);
                          }
                        } catch {
                          /* ignore */
                        }
                      }}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(role.id)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
