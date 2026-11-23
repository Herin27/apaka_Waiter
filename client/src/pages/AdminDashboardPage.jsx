import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  IndianRupee,
  ShoppingBag,
  Utensils,
  AlertTriangle,
  Map as MapIcon,
  ArrowUpRight,
  BellRing,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "../api/axios";
import { useSocket } from "../api/socket";
import { Card, Badge, Button, Skeleton } from "../components/ui";
import { useAuthStore } from "../store/useAuthStore";
import { formatCurrency } from "../utils/formatters";
import FloorMap from "../components/floor/FloorMap";

export default function AdminDashboardPage() {
  const user = useAuthStore((s) => s.user);
  const [loading, setLoading] = useState(true);
  const [tables, setTables] = useState([]);
  const [zReport, setZReport] = useState(null);
  const [lateOrdersCount, setLateOrdersCount] = useState(0);
  const [dailySummary, setDailySummary] = useState(null);
  const [generatingSummary, setGeneratingSummary] = useState(false);

  const loadDashboardData = useCallback(async () => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const [tablesRes, zRes, ordersRes, summaryRes] = await Promise.all([
        api.get("/tables"),
        api.get(`/reports/z-report?date=${today}`),
        api.get("/orders?status=PLACED,CONFIRMED,PREPARING"),
        api.get("/admin/daily-summary"),
      ]);

      setTables(tablesRes.data.data.tables || []);
      setZReport(zRes.data.data);
      setDailySummary(summaryRes.data.data.summary);

      const activeOrders = ordersRes.data.data.orders || [];
      const lateCount = activeOrders.filter((o) => {
        const ageMins = (Date.now() - new Date(o.createdAt).getTime()) / 60000;
        return ageMins > 15;
      }).length;
      setLateOrdersCount(lateCount);
    } catch {
      // Fallback gracefully
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  useSocket("table:updated", ({ table }) => {
    if (!table) return;
    setTables((prev) =>
      prev.map((t) => (t._id === table._id ? { ...t, ...table } : t)),
    );
  });

  useSocket("order:new", () => loadDashboardData());
  useSocket("bill:paid", () => loadDashboardData());
  useSocket("summary:daily", ({ summary }) => {
    if (summary) setDailySummary(summary);
  });

  useSocket("feedback:low", ({ feedback, tableName }) => {
    toast.error(
      `Low Rating Alert (${feedback.rating}★) from ${tableName}: "${feedback.comment || "No comment"}"`,
      { duration: 6000 },
    );
  });

  const handleGenerateSummaryNow = async () => {
    setGeneratingSummary(true);
    try {
      const res = await api.post("/admin/daily-summary/generate");
      setDailySummary(res.data.data.summary);
      toast.success("Daily owner summary updated");
    } catch {
      toast.error("Failed to generate summary");
    } finally {
      setGeneratingSummary(false);
    }
  };

  const activeTablesCount = tables.filter((t) => t.status !== "EMPTY").length;

  return (
    <div className="space-y-6">
      <Card glow className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-extrabold text-white">
                Admin Control Center
              </h1>
              <Badge tone="orange">{user?.branch?.name || "Demo Cafe"}</Badge>
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              Real-time branch overview, table utilization, and operational
              alerts
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link to="/dashboard/admin/floor">
              <Button variant="primary" size="md">
                <MapIcon className="h-4 w-4" />
                Open Floor Editor
                <ArrowUpRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </Card>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-5 flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-zinc-400">
                Today&apos;s Revenue
              </p>
              <p className="mt-2 text-2xl font-black text-white">
                {formatCurrency(zReport?.netRevenue || 0)}
              </p>
              <p className="mt-1 text-[11px] text-emerald-400">
                GST Collected: {formatCurrency(zReport?.taxCollected || 0)}
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent border border-accent/35">
              <IndianRupee className="h-5 w-5" />
            </div>
          </Card>

          <Card className="p-5 flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-zinc-400">
                Today&apos;s Orders
              </p>
              <p className="mt-2 text-2xl font-black text-white">
                {zReport?.ordersCount || 0}
              </p>
              <p className="mt-1 text-[11px] text-zinc-400">
                Gross: {formatCurrency(zReport?.grossSales || 0)}
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400 border border-sky-500/35">
              <ShoppingBag className="h-5 w-5" />
            </div>
          </Card>

          <Card className="p-5 flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-zinc-400">
                Active Tables
              </p>
              <p className="mt-2 text-2xl font-black text-white">
                {activeTablesCount}{" "}
                <span className="text-sm font-semibold text-zinc-500">
                  / {tables.length}
                </span>
              </p>
              <p className="mt-1 text-[11px] text-indigo-300">
                {tables.length - activeTablesCount} available now
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/35">
              <Utensils className="h-5 w-5" />
            </div>
          </Card>

          <Card className="p-5 flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-zinc-400">
                Late Orders (&gt;15m)
              </p>
              <p className="mt-2 text-2xl font-black text-white">
                {lateOrdersCount}
              </p>
              <p className="mt-1 text-[11px] text-zinc-400">
                {lateOrdersCount > 0
                  ? "Requires kitchen attention"
                  : "All tickets on schedule"}
              </p>
            </div>
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl border ${
                lateOrdersCount > 0
                  ? "bg-red-500/15 text-red-400 border-red-500/35 animate-pulse"
                  : "bg-emerald-500/15 text-emerald-400 border-emerald-500/35"
              }`}
            >
              {lateOrdersCount > 0 ? (
                <AlertTriangle className="h-5 w-5" />
              ) : (
                <BellRing className="h-5 w-5" />
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Daily Owner Summary Card (11 PM Cron + On-Demand Refresh) */}
      <Card className="p-5 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-accent">
            <Sparkles className="h-4 w-4" />
            Daily Owner Summary{" "}
            {dailySummary?.date ? `(${dailySummary.date})` : ""}
          </span>
          <Button
            size="sm"
            variant="secondary"
            loading={generatingSummary}
            onClick={handleGenerateSummaryNow}
          >
            <RefreshCw className="h-3.5 w-3.5 text-accent" />
            Generate Summary Now
          </Button>
        </div>
        <p className="text-sm text-zinc-200 leading-relaxed">
          {dailySummary?.summaryText ||
            `Scheduled automatically at 11:00 PM daily, or click "Generate Summary Now" to build today's briefing.`}
        </p>
      </Card>

      {/* Live Floor Map */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-zinc-300">
            Live Branch Floor Map
          </h2>
          <Link
            to="/dashboard/admin/tables"
            className="text-xs font-semibold text-accent hover:underline"
          >
            Manage Tables &amp; QR Codes →
          </Link>
        </div>
        {loading ? (
          <Skeleton className="h-96 w-full" />
        ) : (
          <FloorMap tables={tables} enableSocket />
        )}
      </div>
    </div>
  );
}
