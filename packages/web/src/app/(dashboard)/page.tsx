"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/providers/auth-provider";

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalRecordings: 0,
    todayDownloads: 0,
    todayFailed: 0,
    storageUsed: "0 MB",
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      const token = localStorage.getItem("accessToken");
      const headers = { Authorization: `Bearer ${token}` };

      try {
        const [cdrsRes, downloadsRes] = await Promise.all([
          fetch("http://localhost:3009/api/cdrs?page=1&size=1", { headers }),
          fetch("http://localhost:3009/api/reports/download-summary", {
            headers,
          }),
        ]);

        let totalRecordings = 0;
        let todayDownloads = 0;
        let todayFailed = 0;
        let storageUsed = "0 MB";

        if (cdrsRes.ok) {
          const cdrsData = await cdrsRes.json();
          totalRecordings = cdrsData.total || 0;
        }

        if (downloadsRes.ok) {
          const dlData = await downloadsRes.json();
          todayDownloads = dlData.summary?.success || 0;
          todayFailed = dlData.summary?.failed || 0;
          const totalBytes = dlData.summary?.totalSizeBytes || 0;
          const totalMB = (totalBytes / (1024 * 1024)).toFixed(1);
          storageUsed = `${totalMB} MB`;
        }

        setStats({
          totalRecordings,
          todayDownloads,
          todayFailed,
          storageUsed,
        });
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-green-600" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
      <p className="mt-2 text-gray-600">Welcome, {user?.username}</p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Recordings" value={stats.totalRecordings} />
        <StatCard title="Today's Downloads" value={stats.todayDownloads} />
        <StatCard title="Failed Downloads" value={stats.todayFailed} />
        <StatCard title="Storage Used" value={stats.storageUsed} />
      </div>
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <p className="text-sm text-gray-500">{title}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}
