"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { User, AuthState } from "@/types/auth";

interface AuthContextType extends AuthState {
  login: (
    username: string,
    password: string,
  ) => Promise<
    | { user: User; accessToken: string; refreshToken: string }
    | { error: string }
  >;
  logout: () => void;
  hasRole: (role: string) => boolean;
  hasPermission: (permission: string) => boolean;
  permissions: string[];
  userAgents: string[];
  roleNames: string[];
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [userAgents, setUserAgents] = useState<string[]>([]);
  const [roleNames, setRoleNames] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadPermissions = useCallback(async (token: string) => {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3009/api"}/auth/me`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (res.ok) {
        const data = await res.json();
        setUser(data);
        // Load permissions, agents, and role names from user's access data
        const accessRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3009/api"}/users/${data.id}/access`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (accessRes.ok) {
          const accessData = await accessRes.json();
          // Get all permissions for user's roles
          const allPerms = new Set<string>();
          const roles: string[] = [];
          for (const role of accessData.roles || []) {
            roles.push(role.name);
            const permsRes = await fetch(
              `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3009/api"}/roles/${role.id}`,
              { headers: { Authorization: `Bearer ${token}` } },
            );
            if (permsRes.ok) {
              const roleData = await permsRes.json();
              for (const rp of roleData.permissions || []) {
                allPerms.add(rp.permission.key);
              }
            }
          }
          setPermissions(Array.from(allPerms));
          setRoleNames(roles);
          setUserAgents((accessData.agents || []).map((a: any) => a.name));
        }
      }
    } catch (err) {
      console.error("Failed to load permissions:", err);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (token) {
      loadPermissions(token).finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [loadPermissions]);

  const login = useCallback(
    async (username: string, password: string) => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3009/api"}/auth/login`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
          },
        );

        if (!res.ok) {
          const data = await res.json();
          return { error: data.error || "Login failed" };
        }

        const data = await res.json();
        localStorage.setItem("accessToken", data.accessToken);
        localStorage.setItem("refreshToken", data.refreshToken);
        await loadPermissions(data.accessToken);
        return data;
      } catch {
        return { error: "Network error" };
      }
    },
    [loadPermissions],
  );

  const logout = useCallback(() => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    setUser(null);
    setPermissions([]);
    setUserAgents([]);
    setRoleNames([]);
    window.location.href = "/login";
  }, []);

  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem("accessToken");
    if (!token) return;
    await loadPermissions(token);
  }, [loadPermissions]);

  const hasRole = useCallback(
    (role: string) => {
      const roleOrder: Record<string, number> = {
        viewer: 0,
        manager: 1,
        admin: 2,
      };
      return user
        ? roleOrder[user.role as keyof typeof roleOrder] >=
            roleOrder[role as keyof typeof roleOrder]
        : false;
    },
    [user],
  );

  const hasPermission = useCallback(
    (permission: string) => {
      return permissions.includes(permission);
    },
    [permissions],
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        tokens: user
          ? {
              accessToken: localStorage.getItem("accessToken") || "",
              refreshToken: localStorage.getItem("refreshToken") || "",
            }
          : null,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        hasRole,
        hasPermission,
        permissions,
        userAgents,
        roleNames,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
