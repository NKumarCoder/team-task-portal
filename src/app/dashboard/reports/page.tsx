'use client';

import React, { useEffect, useState } from 'react';
import { dbService } from '@/services/dbService';
import { MonthlyReport, Task } from '@/types';
import { 
  BarChart3, 
  TrendingUp, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  FileText
} from 'lucide-react';
import { motion } from 'framer-motion';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

const CHART_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#10b981', '#ef4444'];

export default function ReportsPage() {
  const [reports, setReports] = useState<MonthlyReport[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    async function loadData() {
      try {
        const fetchedReports = await dbService.getReports();
        const fetchedTasks = await dbService.getTasks();
        setReports(fetchedReports);
        setTasks(fetchedTasks);
      } catch (error) {
        console.error('Error loading reports:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Compute status share for the current active tasks list
  const pieData = [
    { name: 'Assigned', value: tasks.filter(t => t.status === 'assigned' || t.status === 'on-hold').length },
    { name: 'In Progress', value: tasks.filter(t => t.status === 'in-progress' || t.status === 'supplier-pending' || t.status === 'code-review' || t.status === 'development-completed').length },
    { name: 'UAT / Testing', value: tasks.filter(t => t.status === 'uat-testing' || t.status === 'uat-deployed' || t.status === 'testing' || t.status === 'uat').length },
    { name: 'Completed / Live', value: tasks.filter(t => t.status === 'completed' || t.status === 'prod-deployed' || t.status === 'ready-for-production-deploy' || t.status === 'moved-to-live' || t.status === 'deployed').length },
    { name: 'UAT Rejected / Blocked', value: tasks.filter(t => t.status === 'uat-rejected' || t.status === 'blocked').length },
  ].filter(item => item.value > 0); // only show populated categories

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Clock className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">System Performance & Reports</h1>
        <p className="text-sm text-muted-foreground mt-1">Audit task completion rates, development statistics, and historical trends.</p>
      </div>

      {/* Numerical Indicators Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel p-5 rounded-2xl flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-500">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-muted-foreground uppercase">Average Efficiency</span>
            <h3 className="text-2xl font-black mt-1">
              {reports.length > 0
                ? Math.round(reports.reduce((acc, r) => acc + r.efficiencyRate, 0) / reports.length)
                : 0}%
            </h3>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl flex items-center gap-4">
          <div className="p-3 bg-blue-500/10 rounded-xl text-blue-500">
            <BarChart3 className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-muted-foreground uppercase">Total Work Items</span>
            <h3 className="text-2xl font-black mt-1">
              {reports.reduce((acc, r) => acc + r.totalTasks, 0)}
            </h3>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl flex items-center gap-4">
          <div className="p-3 bg-violet-500/10 rounded-xl text-violet-500">
            <TrendingUp className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-muted-foreground uppercase">Active Reporting Months</span>
            <h3 className="text-2xl font-black mt-1">{reports.length} Months</h3>
          </div>
        </div>
      </div>

      {/* Visuals Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Side: Historical Comparison Bar Chart (takes 2/3 space) */}
        <div className="lg:col-span-2 glass-panel p-6 rounded-2xl">
          <h3 className="text-lg font-bold tracking-tight mb-6">Historical Comparison</h3>
          
          <div className="h-80 w-full">
            {isMounted && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={reports} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.08)" />
                  <XAxis dataKey="month" stroke="#a1a1aa" fontSize={11} tickLine={false} />
                  <YAxis stroke="#a1a1aa" fontSize={11} tickLine={false} />
                  <Tooltip 
                    contentStyle={{
                      background: 'rgba(24, 24, 27, 0.95)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '12px',
                      color: '#f4f4f5',
                      fontSize: '12px'
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Bar dataKey="totalTasks" name="Total Scope" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="completedTasks" name="Completed Items" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Right Side: Share Pie Chart (takes 1/3 space) */}
        <div className="glass-panel p-6 rounded-2xl flex flex-col justify-between">
          <h3 className="text-lg font-bold tracking-tight mb-4">Task Composition</h3>
          
          <div className="h-60 w-full flex items-center justify-center">
            {isMounted && pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{
                      background: 'rgba(24, 24, 27, 0.95)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '12px',
                      color: '#f4f4f5',
                      fontSize: '12px'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-muted-foreground italic text-center">No current active tasks to map.</p>
            )}
          </div>

          {/* Pie Chart Custom Legend */}
          {pieData.length > 0 && (
            <div className="grid grid-cols-2 gap-2 mt-4 text-xs font-semibold">
              {pieData.map((entry, index) => (
                <div key={entry.name} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />
                  <span className="text-muted-foreground">{entry.name} ({entry.value})</span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
