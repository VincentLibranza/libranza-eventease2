"use client";

import React, { useEffect, useState } from 'react';
import { Event } from '@/src/types';
import { MapPin, Calendar as CalendarIcon, Users, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'motion/react';

const EventCard: React.FC<{ event: Event }> = ({ event }) => {
  const isFull = event.registration_count >= event.capacity;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl overflow-hidden card-shadow border border-slate-100 group"
    >
      <div className="h-48 bg-slate-200 relative overflow-hidden">
        <img 
          src={`https://picsum.photos/seed/${event.id}/800/600`} 
          alt={event.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          referrerPolicy="no-referrer"
        />
        <div className="absolute top-4 left-4 bg-white/90 backdrop-blur px-3 py-1 rounded-full text-xs font-bold text-brand-700 uppercase tracking-wider">
          {event.category}
        </div>
      </div>
      
      <div className="p-6">
        <h3 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-brand-600 transition-colors">
          {event.title}
        </h3>
        
        <div className="space-y-3 mb-6">
          <div className="flex items-center gap-2 text-slate-500 text-sm">
            <CalendarIcon className="w-4 h-4" />
            {new Date(event.date).toLocaleDateString('en-US', { 
              weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' 
            })}
          </div>
          <div className="flex items-center gap-2 text-slate-500 text-sm">
            <MapPin className="w-4 h-4" />
            {event.location}
          </div>
          <div className="flex items-center gap-2 text-slate-500 text-sm">
            <Users className="w-4 h-4" />
            {event.registration_count} / {event.capacity} Registered
          </div>
        </div>

        <Link 
          href={`/events/${event.id}`}
          className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold transition-all ${
            isFull 
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
              : 'bg-brand-50 text-brand-700 hover:bg-brand-600 hover:text-white'
          }`}
        >
          {isFull ? 'Event Full' : 'View Details'}
          {!isFull && <ArrowRight className="w-4 h-4" />}
        </Link>
      </div>
    </motion.div>
  );
};

export default function HomePage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/events')
      .then(res => res.json())
      .then(data => setEvents(data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="mb-12">
        <h1 className="text-4xl font-extrabold text-slate-900 mb-4 tracking-tight">
          Discover Upcoming Events
        </h1>
        <p className="text-slate-500 text-lg max-w-2xl">
          Join the community, learn new skills, and connect with people at our latest gatherings.
        </p>
      </div>

      {events.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center card-shadow border border-slate-100">
          <CalendarIcon className="w-16 h-16 text-slate-200 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">No events found</h2>
          <p className="text-slate-500">Check back later for new upcoming events.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {events.map(event => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}
