"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import {
  LayoutDashboard,
  AudioLines,
  Users,
  UserCircle,
  Shield,
  UserPlus,
  DownloadCloud,
  FileAudio,
  Filter,
  Settings,
  BarChart3,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

interface MenuItem {
  label: string;
  href: string;
  perm: string;
  icon: React.ReactNode;
}

interface MenuCategory {
  label: string;
  icon: React.ReactNode;
  items: MenuItem[];
}

const MENU_STRUCTURE: MenuCategory[] = [
  {
    label: "Dashboard",
    icon: <LayoutDashboard className="h-4 w-4" />,
    items: [
      { label: "Dashboard", href: "/", perm: "dashboard:view", icon: null },
    ],
  },
  {
    label: "Recordings",
    icon: <AudioLines className="h-4 w-4" />,
    items: [
      {
        label: "Recordings",
        href: "/recordings",
        perm: "recordings:view",
        icon: null,
      },
    ],
  },
  {
    label: "User Management",
    icon: <Users className="h-4 w-4" />,
    items: [
      {
        label: "Agents",
        href: "/agents",
        perm: "agents:view",
        icon: <UserCircle className="h-3.5 w-3.5" />,
      },
      {
        label: "Roles",
        href: "/roles",
        perm: "users:manage",
        icon: <Shield className="h-3.5 w-3.5" />,
      },
      {
        label: "Users",
        href: "/users",
        perm: "users:manage",
        icon: <UserPlus className="h-3.5 w-3.5" />,
      },
    ],
  },
  {
    label: "Data Sync",
    icon: <DownloadCloud className="h-4 w-4" />,
    items: [
      {
        label: "Download Logs",
        href: "/downloads",
        perm: "downloads:view",
        icon: <FileAudio className="h-3.5 w-3.5" />,
      },
      {
        label: "Rules",
        href: "/rules",
        perm: "rules:view",
        icon: <Filter className="h-3.5 w-3.5" />,
      },
      {
        label: "Settings",
        href: "/settings",
        perm: "settings:view",
        icon: <Settings className="h-3.5 w-3.5" />,
      },
    ],
  },
  {
    label: "Reports",
    icon: <BarChart3 className="h-4 w-4" />,
    items: [
      { label: "Reports", href: "/reports", perm: "reports:view", icon: null },
    ],
  },
];

function SubMenu({
  category,
  pathname,
  hasPermission,
  defaultExpanded = true,
}: {
  category: MenuCategory;
  pathname: string;
  hasPermission: (perm: string) => boolean;
  defaultExpanded?: boolean;
}) {
  const visibleItems = category.items.filter((item) =>
    hasPermission(item.perm),
  );
  if (visibleItems.length === 0) return null;

  const isActive = visibleItems.some((item) => item.href === pathname);
  const [expanded, setExpanded] = useState(defaultExpanded || isActive);

  // Auto-expand if active child
  useEffect(() => {
    if (isActive) setExpanded(true);
  }, [isActive]);

  // Single-item categories render as direct links
  if (
    category.items.length === 1 &&
    category.items[0].perm === visibleItems[0]?.perm
  ) {
    const item = visibleItems[0];
    const isActiveItem = pathname === item.href;
    return (
      <Link
        href={item.href}
        className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition ${
          isActiveItem
            ? "bg-green-50 text-green-700 border-r-2 border-green-600"
            : "text-gray-700 hover:bg-green-50 hover:text-green-700"
        }`}
      >
        {category.icon}
        <span>{category.label}</span>
      </Link>
    );
  }

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition ${
          isActive ? "bg-green-50 text-green-700" : "text-gray-600 hover:bg-gray-50"
        }`}
      >
        <div className="flex items-center gap-3">
          {category.icon}
          <span className="text-sm font-normal">{category.label}</span>
        </div>
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
      </button>

      {expanded && (
        <div className="ml-6 mt-1 space-y-0.5 border-l-2 border-gray-100 pl-2">
          {visibleItems.map((item) => {
            const isActiveItem = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition ${
                  isActiveItem
                    ? "bg-green-50 text-green-700 font-medium"
                    : "text-gray-600 hover:bg-green-50 hover:text-green-700"
                }`}
              >
                {item.icon && (
                  <span className="text-gray-400">{item.icon}</span>
                )}
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Sidebar() {
  const { user, logout, hasPermission, roleNames } = useAuth();
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r bg-white flex flex-col h-screen">
      {/* Header */}
      <div className="flex h-16 items-center border-b border-green-100 px-6">
        <div>
          <h1 className="text-lg font-bold text-gray-900">
            NeXL
          </h1>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4 space-y-1">
        {MENU_STRUCTURE.map((category) => (
          <SubMenu
            key={category.label}
            category={category}
            pathname={pathname}
            hasPermission={hasPermission}
          />
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t p-4">
        <div className="mb-2 text-sm text-gray-500">
          {user?.username}
          {roleNames.length > 0 && (
            <span className="ml-2 rounded bg-green-50 px-2 py-0.5 text-xs capitalize text-green-700">
              {roleNames.join(", ")}
            </span>
          )}
        </div>
        <button
          onClick={logout}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 transition hover:bg-green-50 hover:text-green-700 hover:border-green-200"
        >
          Sign Out
        </button>
      </div>
    </aside>
  );
}
