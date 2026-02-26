"use client";

import React, { useEffect, useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { BarChart3, PieChart as PieChartIcon, TrendingUp, Users, Calendar, CheckCircle } from 'lucide-react';

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function ReportsPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/reports')
      .then(res => res.json())
      .then(data => setStats(data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-12 text-center">Loading Reports...</div>;

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="mb-12">
        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">Analytics & Reports</h1>
        <p className="text-slate-500 mt-2">Deep dive into your event performance data</p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        <div className="bg-white p-6 rounded-3xl card-shadow border border-slate-100">
          <div className="bg-green-50 w-12 h-12 rounded-2xl flex items-center justify-center mb-4">
            <Calendar className="w-6 h-6 text-green-600" />
          </div>
          <div className="text-3xl font-bold text-slate-900">{stats.totalEvents.count}</div>
          <div className="text-slate-500 text-sm font-medium">Total Events</div>
        </div>
        <div className="bg-white p-6 rounded-3xl card-shadow border border-slate-100">
          <div className="bg-blue-50 w-12 h-12 rounded-2xl flex items-center justify-center mb-4">
            <Users className="w-6 h-6 text-blue-600" />
          </div>
          <div className="text-3xl font-bold text-slate-900">{stats.totalUsers.count}</div>
          <div className="text-slate-500 text-sm font-medium">Active Users</div>
        </div>
        <div className="bg-white p-6 rounded-3xl card-shadow border border-slate-100">
          <div className="bg-amber-50 w-12 h-12 rounded-2xl flex items-center justify-center mb-4">
            <TrendingUp className="w-6 h-6 text-amber-600" />
          </div>
          <div className="text-3xl font-bold text-slate-900">{stats.totalRegistrations.count}</div>
          <div className="text-slate-500 text-sm font-medium">Registrations</div>
        </div>
        <div className="bg-white p-6 rounded-3xl card-shadow border border-slate-100">
          <div className="bg-purple-50 w-12 h-12 rounded-2xl flex items-center justify-center mb-4">
            <CheckCircle className="w-6 h-6 text-purple-600" />
          </div>
          <div className="text-3xl font-bold text-slate-900">{Math.round(stats.attendanceRate.rate || 0)}%</div>
          <div className="text-slate-500 text-sm font-medium">Avg. Attendance</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Category Distribution */}
        <div className="bg-white p-8 rounded-3xl card-shadow border border-slate-100">
          <div className="flex items-center gap-2 mb-8">
            <PieChartIcon className="w-5 h-5 text-slate-400" />
            <h2 className="text-xl font-bold text-slate-900">Events by Category</h2>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.eventsByCategory}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {stats.eventsByCategory.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Registration Trends */}
        <div className="bg-white p-8 rounded-3xl card-shadow border border-slate-100">
          <div className="flex items-center gap-2 mb-8">
            <BarChart3 className="w-5 h-5 text-slate-400" />
            <h2 className="text-xl font-bold text-slate-900">Registrations per Event</h2>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.registrationsByEvent}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" hide />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="value" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
