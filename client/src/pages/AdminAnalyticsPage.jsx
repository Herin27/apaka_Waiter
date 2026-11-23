import { useCallback, useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import {
  BarChart3,
  Download,
  IndianRupee,
  ShoppingBag,
  Clock,
  Star,
  Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import { Button, Card, Badge, Skeleton } from '../components/ui';
import { formatCurrency } from '../utils/formatters';

const PIE_COLORS = ['#E8591A', '#38BDF8', '#10B981', '#A855F7', '#F59E0B', '#F43F5E'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = [9, 11, 13, 15, 17, 19, 21, 23];

export default function AdminAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date(Date.now() - 30 * 86400000);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [data, setData] = useState(null);
  const [forecast, setForecast] = useState(null);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const [analyticsRes, forecastRes] = await Promise.all([
        api.get(`/analytics?from=${fromDate}&to=${toDate}`),
        api.get('/analytics/demand-forecast'),
      ]);
      setData(analyticsRes.data.data);
      setForecast(forecastRes.data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const exportAnalyticsCsv = () => {
    if (!data?.revenueByDay?.length) return;
    const headers = ['Date', 'Revenue (INR)', 'Orders', 'Avg Order Value'];
    const rows = data.revenueByDay.map((d) =>
      [d.date, d.revenue, d.orders, d.avgOrderValue].join(',')
    );
    const blob = new Blob([[headers.join(','), ...rows].join('\n')], {
      type: 'text/csv;charset=utf-8',
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `aapka-waiter-analytics-${fromDate}-to-${toDate}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  const { summary, revenueByDay, categoryMix, peakHeatmap, topSellers, waiterPerformance } = data;

  const getHeatCount = (weekdayIdx1Based, hourStart) => {
    return (peakHeatmap || [])
      .filter(
        (h) =>
          h.weekday === weekdayIdx1Based && h.hour >= hourStart && h.hour < hourStart + 2
      )
      .reduce((s, h) => s + h.count, 0);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface-1 border border-border-subtle p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent border border-accent/35">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-white">Revenue &amp; Operations Analytics</h1>
            <p className="text-xs text-zinc-400">
              Sales trends, category mix, peak-hour heatmap, AI demand forecast &amp; staff SLAs
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="h-9 rounded-xl bg-surface-2 border border-border-subtle px-3 text-xs font-bold text-white"
          />
          <span className="text-xs text-zinc-500">to</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="h-9 rounded-xl bg-surface-2 border border-border-subtle px-3 text-xs font-bold text-white"
          />
          <Button variant="secondary" size="sm" onClick={exportAnalyticsCsv}>
            <Download className="h-3.5 w-3.5 text-accent" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* AI Demand Forecasting Card */}
      {forecast?.advice && (
        <Card glow className="p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-accent">
              <Sparkles className="h-4 w-4" />
              AI Demand Forecast &amp; Stocking Advice (8-Week Trend)
            </span>
            <Badge tone="orange">{forecast.generatedByAi ? 'Gemini AI' : 'Smart Trend'}</Badge>
          </div>
          <p className="text-sm text-zinc-200 whitespace-pre-line leading-relaxed">
            {forecast.advice}
          </p>
        </Card>
      )}

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span>Total Revenue</span>
            <IndianRupee className="h-4 w-4 text-accent" />
          </div>
          <p className="mt-2 text-2xl font-black text-white">
            {formatCurrency(summary.totalRevenue)}
          </p>
          <p className="mt-1 text-[11px] text-zinc-400">
            Avg Order: {formatCurrency(summary.avgOrderValue)}
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span>Total Orders</span>
            <ShoppingBag className="h-4 w-4 text-sky-400" />
          </div>
          <p className="mt-2 text-2xl font-black text-white">{summary.totalOrders}</p>
          <p className="mt-1 text-[11px] text-zinc-400">
            Avg Table Turnover: {summary.avgTurnoverMin}m
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span>Avg Prep &amp; Serve</span>
            <Clock className="h-4 w-4 text-emerald-400" />
          </div>
          <p className="mt-2 text-2xl font-black text-white">{summary.avgPrepMin}m prep</p>
          <p className="mt-1 text-[11px] text-zinc-400">
            Confirm: {summary.avgConfirmMin}m • Serve: {summary.avgServeMin}m
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span>Guest Satisfaction</span>
            <Star className="h-4 w-4 text-amber-400" />
          </div>
          <p className="mt-2 text-2xl font-black text-white">{summary.avgRating} ★</p>
          <p className="mt-1 text-[11px] text-emerald-400">Live post-bill reviews</p>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card className="p-5 space-y-3">
          <h2 className="text-sm font-extrabold text-white">Daily Revenue Trend (₹)</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="date" tick={{ fill: '#a1a1aa', fontSize: 10 }} />
                <YAxis tick={{ fill: '#a1a1aa', fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1C1C1F',
                    borderColor: 'rgba(255,255,255,0.12)',
                    borderRadius: '12px',
                    fontSize: '12px',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#E8591A"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#E8591A' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5 space-y-3">
          <h2 className="text-sm font-extrabold text-white">Daily Orders Volume</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="date" tick={{ fill: '#a1a1aa', fontSize: 10 }} />
                <YAxis tick={{ fill: '#a1a1aa', fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1C1C1F',
                    borderColor: 'rgba(255,255,255,0.12)',
                    borderRadius: '12px',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="orders" fill="#38BDF8" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Category Pie + Peak Hours Heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <Card className="lg:col-span-5 p-5 space-y-3">
          <h2 className="text-sm font-extrabold text-white">Category Revenue Mix</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryMix}
                  dataKey="revenue"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  outerRadius={82}
                  label={({ category }) => category.slice(0, 12)}
                >
                  {categoryMix.map((_, idx) => (
                    <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1C1C1F',
                    borderColor: 'rgba(255,255,255,0.12)',
                    borderRadius: '12px',
                    fontSize: '12px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="lg:col-span-7 p-5 space-y-3 overflow-x-auto">
          <h2 className="text-sm font-extrabold text-white">Peak Hours Heatmap (Day × Hour)</h2>
          <table className="w-full text-center text-[11px]">
            <thead>
              <tr className="text-zinc-400">
                <th className="py-1.5 text-left">Day</th>
                {HOURS.map((h) => (
                  <th key={h} className="py-1.5">
                    {h}:00
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {WEEKDAYS.map((dayName, idx) => (
                <tr key={dayName}>
                  <td className="py-2 text-left font-bold text-zinc-300">{dayName}</td>
                  {HOURS.map((h) => {
                    const cnt = getHeatCount(idx + 1, h);
                    const intensity =
                      cnt === 0
                        ? 'bg-surface-2 text-zinc-600'
                        : cnt <= 2
                        ? 'bg-accent/20 text-orange-200'
                        : cnt <= 5
                        ? 'bg-accent/55 text-white'
                        : 'bg-accent text-white font-extrabold';
                    return (
                      <td key={h} className="p-1">
                        <div className={`rounded-lg py-1.5 ${intensity}`}>{cnt}</div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      {/* Top Sellers & Waiter Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card className="p-5 space-y-3">
          <h2 className="text-sm font-extrabold text-white">Top Selling Dishes</h2>
          <div className="space-y-2">
            {topSellers.map((item, i) => (
              <div
                key={item.name}
                className="flex items-center justify-between rounded-xl bg-surface-2 px-3.5 py-2.5 text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <Badge tone="orange">#{i + 1}</Badge>
                  <span className="font-bold text-white">{item.name}</span>
                </div>
                <div className="text-right">
                  <span className="font-extrabold text-white">{item.qtySold} sold</span>
                  <span className="ml-2 text-zinc-400">({formatCurrency(item.revenue)})</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5 space-y-3">
          <h2 className="text-sm font-extrabold text-white">Staff SLA Performance</h2>
          <div className="space-y-2">
            {waiterPerformance.length === 0 ? (
              <p className="text-xs text-zinc-500">No staff performance logs in selected range.</p>
            ) : (
              waiterPerformance.map((w) => (
                <div
                  key={w.waiter}
                  className="flex items-center justify-between rounded-xl bg-surface-2 px-3.5 py-2.5 text-xs"
                >
                  <div>
                    <p className="font-bold text-white">{w.waiter}</p>
                    <p className="text-[11px] text-zinc-400">
                      Confirm: {w.avgConfirmMin}m • Serve: {w.avgServeMin}m
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone="green">{w.ordersHandled} orders</Badge>
                    <Badge tone="amber">{w.rating} ★</Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
