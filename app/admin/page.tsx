"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Event } from '@/src/types';
import { Plus, Users, Calendar, MapPin, ChevronRight, Search, Filter } from 'lucide-react';
import { motion } from 'motion/react';

export default function AdminDashboardPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetch('/api/events')
      .then(res => res.json())
      .then(data => setEvents(data))
      .finally(() => setLoading(false));
  }, []);

  const filteredEvents = events.filter(e => 
    e.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
        <div>
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">Admin Dashboard</h1>
          <p className="text-slate-500 mt-2">Manage your events and track attendance</p>
        </div>
        <Link 
          href="/admin/create-event"
          className="flex items-center gap-2 bg-brand-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-brand-700 transition-all shadow-lg hover:shadow-brand-500/25"
        >
          <Plus className="w-5 h-5" />
          Create New Event
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Stats Cards */}
        <div className="lg:col-span-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-2xl card-shadow border border-slate-100">
            <div className="bg-blue-50 w-12 h-12 rounded-xl flex items-center justify-center mb-4">
              <Calendar className="w-6 h-6 text-blue-600" />
            </div>
            <div className="text-2xl font-bold text-slate-900">{events.length}</div>
            <div className="text-slate-500 text-sm font-medium">Total Events</div>
          </div>
          <div className="bg-white p-6 rounded-2xl card-shadow border border-slate-100">
            <div className="bg-green-50 w-12 h-12 rounded-xl flex items-center justify-center mb-4">
              <Users className="w-6 h-6 text-green-600" />
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {events.reduce((acc, e) => acc + e.registration_count, 0)}
            </div>
            <div className="text-slate-500 text-sm font-medium">Total Registrations</div>
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-4">
          <div className="bg-white rounded-3xl card-shadow border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h2 className="text-xl font-bold text-slate-900">Event Management</h2>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text"
                  placeholder="Search events..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-sm w-full sm:w-64"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-bold">
                    <th className="px-6 py-4">Event Details</th>
                    <th className="px-6 py-4">Category</th>
                    <th className="px-6 py-4">Registrations</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredEvents.map(event => (
                    <tr key={event.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-slate-100 overflow-hidden flex-shrink-0">
                            <img src={`https://picsum.photos/seed/${event.id}/100/100`} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">{event.title}</div>
                            <div className="text-xs text-slate-500 flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(event.date).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-md text-xs font-bold uppercase">
                          {event.category}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-brand-500" 
                              style={{ width: `${Math.min(100, (event.registration_count / event.capacity) * 100)}%` }}
                            ></div>
                          </div>
                          <span className="text-xs font-bold text-slate-700">
                            {event.registration_count}/{event.capacity}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {new Date(event.date) > new Date() ? (
                          <span className="flex items-center gap-1 text-green-600 text-xs font-bold">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-600 animate-pulse"></div>
                            Upcoming
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs font-bold">Past</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link 
                          href={`/admin/attendance/${event.id}`}
                          className="inline-flex items-center gap-1 text-brand-600 hover:text-brand-700 font-bold text-sm"
                        >
                          Attendance
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {filteredEvents.length === 0 && (
              <div className="p-12 text-center text-slate-500">
                No events found matching your search.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
