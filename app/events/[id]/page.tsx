"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Event } from '@/src/types';
import { useAuth } from '@/src/AuthContext';
import { MapPin, Calendar, Users, ArrowLeft, CheckCircle2, AlertCircle, Tag, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';

export default function EventDetailsPage() {
  const params = useParams();
  const id = params.id as string;
  const { user } = useAuth();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    fetch(`/api/events/${id}`)
      .then(res => res.json())
      .then(data => setEvent(data))
      .finally(() => setLoading(false));

    if (user) {
      fetch('/api/my-registrations')
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data) && data.some((r: any) => r.event_id === parseInt(id!))) {
            setRegistered(true);
          }
        });
    }
  }, [id, user]);

  const handleRegister = async () => {
    if (!user) {
      router.push('/login');
      return;
    }

    setRegistering(true);
    setError('');

    try {
      const res = await fetch(`/api/events/${id}/register`, { method: 'POST' });
      if (res.ok) {
        setRegistered(true);
      } else {
        const data = await res.json();
        setError(data.error || 'Registration failed');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setRegistering(false);
    }
  };

  if (loading) return <div className="p-12 text-center">Loading...</div>;
  if (!event) return <div className="p-12 text-center">Event not found</div>;

  const isFull = event.registration_count >= event.capacity;

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <button 
        onClick={() => router.back()}
        className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-medium mb-8 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Events
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl overflow-hidden card-shadow border border-slate-100"
          >
            <div className="h-80 bg-slate-200 relative">
              <img 
                src={`https://picsum.photos/seed/${event.id}/1200/800`} 
                alt={event.title}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute top-6 left-6 bg-white px-4 py-2 rounded-full text-sm font-bold text-brand-700 shadow-lg flex items-center gap-2">
                <Tag className="w-4 h-4" />
                {event.category}
              </div>
            </div>
            
            <div className="p-8">
              <h1 className="text-4xl font-extrabold text-slate-900 mb-6 tracking-tight">{event.title}</h1>
              
              <div className="flex flex-wrap gap-6 mb-8">
                <div className="flex items-center gap-3 bg-slate-50 px-4 py-3 rounded-2xl border border-slate-100">
                  <div className="bg-brand-100 p-2 rounded-xl">
                    <Calendar className="w-5 h-5 text-brand-600" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-400 font-bold uppercase">Date & Time</div>
                    <div className="text-sm font-bold text-slate-700">
                      {new Date(event.date).toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 bg-slate-50 px-4 py-3 rounded-2xl border border-slate-100">
                  <div className="bg-blue-100 p-2 rounded-xl">
                    <MapPin className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-400 font-bold uppercase">Location</div>
                    <div className="text-sm font-bold text-slate-700">{event.location}</div>
                  </div>
                </div>

                <div className="flex items-center gap-3 bg-slate-50 px-4 py-3 rounded-2xl border border-slate-100">
                  <div className="bg-amber-100 p-2 rounded-xl">
                    <Users className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-400 font-bold uppercase">Availability</div>
                    <div className="text-sm font-bold text-slate-700">
                      {event.registration_count} / {event.capacity} Spots
                    </div>
                  </div>
                </div>
              </div>

              <div className="prose prose-slate max-w-none">
                <h3 className="text-xl font-bold text-slate-900 mb-4">About this Event</h3>
                <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">
                  {event.description}
                </p>
              </div>
            </div>
          </motion.div>
        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-28">
            <div className="bg-white rounded-3xl p-8 card-shadow border border-slate-100">
              <h3 className="text-xl font-bold text-slate-900 mb-6">Registration</h3>
              
              {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl flex items-center gap-3 mb-6 border border-red-100">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p className="text-sm font-medium">{error}</p>
                </div>
              )}

              {registered ? (
                <div className="text-center">
                  <div className="bg-green-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-8 h-8 text-green-600" />
                  </div>
                  <h4 className="text-lg font-bold text-slate-900 mb-2">You're Registered!</h4>
                  <p className="text-slate-500 text-sm mb-6">We've saved your spot. See you at the event!</p>
                  <button 
                    onClick={() => router.push('/')}
                    className="w-full py-3 text-slate-600 font-bold hover:text-slate-900 transition-colors"
                  >
                    Browse more events
                  </button>
                </div>
              ) : (
                <>
                  <div className="space-y-4 mb-8">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Ticket Price</span>
                      <span className="font-bold text-slate-900">Free</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Service Fee</span>
                      <span className="font-bold text-slate-900">$0.00</span>
                    </div>
                    <div className="pt-4 border-t border-slate-100 flex justify-between">
                      <span className="font-bold text-slate-900">Total</span>
                      <span className="font-bold text-brand-600 text-xl">Free</span>
                    </div>
                  </div>

                  <button
                    onClick={handleRegister}
                    disabled={registering || isFull}
                    className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-all flex items-center justify-center gap-2 ${
                      isFull 
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                        : 'bg-brand-600 text-white hover:bg-brand-700 hover:shadow-brand-500/25'
                    }`}
                  >
                    {registering ? (
                      <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : isFull ? (
                      'Event Full'
                    ) : (
                      'Register Now'
                    )}
                  </button>
                  
                  {!user && (
                    <p className="text-center text-xs text-slate-400 mt-4">
                      You'll need to sign in to complete your registration.
                    </p>
                  )}
                </>
              )}
            </div>

            <div className="mt-6 bg-brand-50 rounded-3xl p-6 border border-brand-100">
              <h4 className="text-brand-800 font-bold mb-2 flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Why attend?
              </h4>
              <p className="text-brand-700 text-sm leading-relaxed">
                Join {event.registration_count} others who have already signed up. This is a great opportunity to network and learn in a professional environment.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
