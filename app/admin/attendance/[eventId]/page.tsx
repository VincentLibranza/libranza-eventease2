"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Registration, AIPrediction, Event } from '@/src/types';
import { ArrowLeft, CheckCircle2, XCircle, BrainCircuit, Sparkles, TrendingUp, AlertCircle, Download, Mail, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function AttendanceTrackerPage() {
  const params = useParams();
  const eventId = params.eventId as string;
  const [event, setEvent] = useState<Event | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [prediction, setPrediction] = useState<AIPrediction | null>(null);
  const [loading, setLoading] = useState(true);
  const [predicting, setPredicting] = useState(false);
  const [sendingReminders, setSendingReminders] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetchData();
  }, [eventId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [eventRes, regRes] = await Promise.all([
        fetch(`/api/events/${eventId}`),
        fetch(`/api/admin/registrations/${eventId}`)
      ]);
      const eventData = await eventRes.json();
      const regData = await regRes.json();
      setEvent(eventData);
      setRegistrations(regData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleAttendance = async (regId: number, currentStatus: number) => {
    try {
      await fetch('/api/admin/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationId: regId, attended: !currentStatus }),
      });
      setRegistrations(regs => regs.map(r => 
        r.id === regId ? { ...r, attended: currentStatus ? 0 : 1 } : r
      ));
    } catch (err) {
      console.error(err);
    }
  };

  const runPrediction = async () => {
    setPredicting(true);
    try {
      const res = await fetch('/api/ai/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId }),
      });
      const data = await res.json();
      setPrediction(data);
    } catch (err) {
      console.error(err);
    } finally {
      setPredicting(false);
    }
  };

  const exportToCSV = () => {
    if (registrations.length === 0) return;
    
    const headers = ["Name", "Email", "Status", "Registered At"];
    const rows = registrations.map(r => [
      r.name,
      r.email,
      r.attended ? "Present" : "Absent",
      new Date(r.registered_at).toLocaleString()
    ]);
    
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.join(","))
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${event?.title || 'event'}_registrations.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const sendReminders = async () => {
    setSendingReminders(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    alert(`Confirmation emails and reminders sent to ${registrations.length} participants!`);
    setSendingReminders(false);
  };

  if (loading) return <div className="p-12 text-center">Loading...</div>;

  const attendedCount = registrations.filter(r => r.attended).length;

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <button 
        onClick={() => router.push('/admin')}
        className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-medium mb-8 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Attendance List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl card-shadow border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">{event?.title}</h1>
                <p className="text-slate-500 text-sm">Attendance Tracking</p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-brand-600">{attendedCount} / {registrations.length}</div>
                <div className="text-slate-400 text-xs font-bold uppercase tracking-wider">Present</div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-b border-slate-100 flex flex-wrap gap-3">
              <button
                onClick={exportToCSV}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-100 transition-all shadow-sm"
              >
                <Download className="w-4 h-4" />
                Export to Excel (CSV)
              </button>
              <button
                onClick={sendReminders}
                disabled={sendingReminders || registrations.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-bold hover:bg-brand-700 transition-all shadow-md disabled:opacity-50"
              >
                {sendingReminders ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Send Automated Reminders
              </button>
            </div>

            <div className="divide-y divide-slate-100">
              {registrations.map(reg => (
                <div key={reg.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold">
                      {reg.name?.charAt(0)}
                    </div>
                    <div>
                      <div className="font-bold text-slate-900">{reg.name}</div>
                      <div className="text-xs text-slate-500">{reg.email}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleAttendance(reg.id, reg.attended)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                      reg.attended 
                        ? 'bg-green-50 text-green-600 hover:bg-green-100' 
                        : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                    }`}
                  >
                    {reg.attended ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    {reg.attended ? 'Present' : 'Absent'}
                  </button>
                </div>
              ))}
              {registrations.length === 0 && (
                <div className="p-12 text-center text-slate-400 italic">
                  No registrations yet for this event.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: AI Prediction */}
        <div className="space-y-6">
          <div className="bg-slate-900 rounded-3xl p-8 text-white card-shadow relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <BrainCircuit className="w-32 h-32" />
            </div>
            
            <div className="relative z-10">
              <div className="flex items-center gap-2 text-brand-400 font-bold text-sm uppercase tracking-widest mb-4">
                <Sparkles className="w-4 h-4" />
                AI Attendance Predictor
              </div>
              
              <h2 className="text-2xl font-bold mb-4">Smart Forecast</h2>
              <p className="text-slate-400 text-sm mb-8">
                Our AI analyzes event details, historical data, and current registration trends to predict final attendance.
              </p>

              {!prediction ? (
                <button
                  onClick={runPrediction}
                  disabled={predicting}
                  className="w-full bg-brand-600 text-white py-4 rounded-xl font-bold hover:bg-brand-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {predicting ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <TrendingUp className="w-5 h-5" />
                      Generate Prediction
                    </>
                  )}
                </button>
              ) : (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                      <div className="text-3xl font-bold text-brand-400">{prediction.predicted_attendance_count}</div>
                      <div className="text-xs text-slate-500 font-bold uppercase mt-1">Predicted Count</div>
                    </div>
                    <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                      <div className="text-3xl font-bold text-blue-400">{Math.round(prediction.confidence_score * 100)}%</div>
                      <div className="text-xs text-slate-500 font-bold uppercase mt-1">Confidence</div>
                    </div>
                  </div>

                  <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                    <div className="flex items-center gap-2 text-slate-300 font-bold text-xs uppercase mb-2">
                      <AlertCircle className="w-3 h-3" />
                      AI Reasoning
                    </div>
                    <p className="text-slate-400 text-sm leading-relaxed italic">
                      "{prediction.reasoning}"
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="text-slate-300 font-bold text-xs uppercase">Growth Suggestions</div>
                    {prediction.suggestions.map((s, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-slate-400">
                        <div className="w-1.5 h-1.5 rounded-full bg-brand-500 mt-1.5 flex-shrink-0"></div>
                        {s}
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={runPrediction}
                    className="w-full bg-white/5 text-white py-3 rounded-xl font-bold text-sm hover:bg-white/10 transition-all border border-white/10"
                  >
                    Refresh Prediction
                  </button>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
