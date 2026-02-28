import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Calendar, 
  Users, 
  CheckCircle, 
  Plus, 
  Search, 
  MessageSquare, 
  TrendingUp,
  ChevronRight,
  QrCode,
  FileText,
  BarChart3,
  Loader2,
  Download,
  Brain,
  Trash2,
  X,
  Mail,
  MapPin,
  Clock,
  Filter,
  RefreshCw,
  Copy,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Event, Participant, Stats } from './types';
import { getChatbotResponse, predictAttendance, analyzeTrends } from './services/geminiService';
import { QRCodeSVG } from 'qrcode.react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';

export default function App() {
  const [user, setUser] = useState<{ id: number, name: string, email: string } | null>(() => {
    const saved = localStorage.getItem('eventease_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(localStorage.getItem('eventease_token'));
  const [activeTab, setActiveTab] = useState<'dashboard' | 'events' | 'register' | 'attendance' | 'participants' | 'ai'>('dashboard');
  const [events, setEvents] = useState<Event[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [aiInsights, setAiInsights] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [publicRegisterId, setPublicRegisterId] = useState<string | null>(null);
  const [publicCheckInId, setPublicCheckInId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const registerId = params.get('register');
    const checkinId = params.get('checkin');
    
    if (registerId) {
      setPublicRegisterId(registerId);
    }
    if (checkinId) {
      setPublicCheckInId(checkinId);
    }
  }, []);

  useEffect(() => {
    if (token) {
      fetchData();
    }
  }, [token]);

  const fetchData = async (silent = false) => {
    if (!token) return;
    if (!silent) setLoading(true);
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const [eventsRes, statsRes, participantsRes] = await Promise.all([
        fetch('/api/events', { headers }),
        fetch('/api/stats', { headers }),
        fetch('/api/participants', { headers })
      ]);

      if (eventsRes.status === 401 || statsRes.status === 401 || participantsRes.status === 401) {
        handleLogout();
        return;
      }

      const checkJson = async (res: Response) => {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          return res.json();
        }
        const text = await res.text();
        throw new Error(`Expected JSON but got ${contentType || 'unknown'}: ${text.substring(0, 100)}...`);
      };

      const eventsData = await checkJson(eventsRes);
      const statsData = await checkJson(statsRes);
      const participantsData = await checkJson(participantsRes);
      setEvents(eventsData);
      setStats(statsData);
      setParticipants(participantsData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleLogin = (userData: any, userToken: string) => {
    setUser(userData);
    setToken(userToken);
    localStorage.setItem('eventease_user', JSON.stringify(userData));
    localStorage.setItem('eventease_token', userToken);
  };

  const handleLogout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('eventease_user');
    localStorage.removeItem('eventease_token');
  };

  if (publicRegisterId) {
    return <PublicRegistrationPage eventId={publicRegisterId} onBack={() => {
      setPublicRegisterId(null);
      window.history.pushState({}, '', window.location.pathname);
    }} />;
  }

  if (publicCheckInId) {
    return <PublicCheckInPage eventId={publicCheckInId} onBack={() => {
      setPublicCheckInId(null);
      window.history.pushState({}, '', window.location.pathname);
    }} />
  }

  if (!token) {
    return <AuthPage onLogin={handleLogin} />;
  }

  const handleExportPDF = () => {
    const doc = new jsPDF() as any;
    doc.text('EventEase - Participant Report', 14, 15);
    doc.autoTable({
      startY: 20,
      head: [['Name', 'Email', 'Department', 'Event', 'Status']],
      body: participants.map(p => [p.name, p.email, p.department, (p as any).event_title, p.status]),
    });
    doc.save('participants-report.pdf');
  };

  const handleExportExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(participants.map(p => ({
      Name: p.name,
      Email: p.email,
      Department: p.department,
      Event: (p as any).event_title,
      Status: p.status === 'attended' ? 'Present' : 'Registered',
      'Registered At': new Date(p.registered_at).toLocaleString()
    })));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Participants");
    XLSX.writeFile(workbook, "participants-report.xlsx");
  };

  const handleAnalyzeTrends = async () => {
    if (!stats) return;
    setIsAnalyzing(true);
    try {
      const insights = await analyzeTrends(stats);
      setAiInsights(insights);
      setActiveTab('ai');
    } catch (error) {
      console.error('AI Analysis failed:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDeleteEvent = async (id: number) => {
    if (!confirm('Are you sure you want to delete this event? All registrations will be lost.')) return;
    try {
      await fetch(`/api/events/${id}`, { 
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchData();
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-white border-r border-slate-200 z-20 hidden md:block">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Calendar className="text-white w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-indigo-600">EventEase</h1>
          </div>

          <div className="mb-6 px-4 py-3 bg-slate-50 rounded-xl border border-slate-100">
            <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Logged in as</p>
            <p className="text-sm font-bold text-slate-700 truncate">{user?.name}</p>
            <button 
              onClick={handleLogout}
              className="text-[10px] text-red-500 font-bold hover:underline mt-2"
            >
              Logout
            </button>
          </div>

          <nav className="space-y-0.5">
            <NavItem 
              icon={<LayoutDashboard size={20} />} 
              label="Dashboard" 
              active={activeTab === 'dashboard'} 
              onClick={() => setActiveTab('dashboard')} 
            />
            <NavItem 
              icon={<Calendar size={20} />} 
              label="Events" 
              active={activeTab === 'events'} 
              onClick={() => setActiveTab('events')} 
            />
            <NavItem 
              icon={<CheckCircle size={20} />} 
              label="Attendance" 
              active={activeTab === 'attendance'} 
              onClick={() => setActiveTab('attendance')} 
            />
            <NavItem 
              icon={<Plus size={20} />} 
              label="Registration" 
              active={activeTab === 'register'} 
              onClick={() => setActiveTab('register')} 
            />
            <NavItem 
              icon={<Brain size={20} />} 
              label="AI Insights" 
              active={activeTab === 'ai'} 
              onClick={() => setActiveTab('ai')} 
            />
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <main className="md:ml-64 p-4 md:p-6">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold capitalize">{activeTab}</h2>
            <p className="text-slate-500 text-sm">Manage your event ecosystem efficiently.</p>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            {(activeTab === 'events' || activeTab === 'attendance') && (
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Search..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            )}
            <button 
              onClick={handleAnalyzeTrends}
              disabled={isAnalyzing}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl font-medium hover:bg-indigo-100 transition-colors disabled:opacity-50"
            >
              {isAnalyzing ? <Loader2 className="animate-spin" size={18} /> : <Brain size={18} />}
              <span className="hidden sm:inline">AI Insights</span>
            </button>
          </div>
        </header>

        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div 
              key="loader"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center h-64"
            >
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            </motion.div>
          ) : (
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'dashboard' && (
                <Dashboard 
                  stats={stats} 
                  events={events} 
                  onAnalyze={handleAnalyzeTrends} 
                  onViewEvents={() => setActiveTab('events')}
                />
              )}
              {activeTab === 'events' && <EventsList events={events} onRefresh={fetchData} onDelete={handleDeleteEvent} searchQuery={searchQuery} />}
              {activeTab === 'register' && <RegistrationForm events={events} onRefresh={fetchData} />}
              {activeTab === 'attendance' && <AttendanceTracker events={events} onRefresh={fetchData} searchQuery={searchQuery} />}
              {activeTab === 'ai' && <AITab insights={aiInsights} stats={stats} />}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Chatbot Toggle */}
      <button 
        onClick={() => setIsChatOpen(!isChatOpen)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-lg flex items-center justify-center hover:scale-110 transition-transform z-50"
      >
        <MessageSquare size={24} />
      </button>

      {/* Chatbot Window */}
      <AnimatePresence>
        {isChatOpen && (
          <ChatbotWindow onClose={() => setIsChatOpen(false)} events={events} />
        )}
      </AnimatePresence>
    </div>
  );
}

function PublicCheckInPage({ eventId, onBack }: { eventId: string, onBack: () => void }) {
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [attendeeName, setAttendeeName] = useState('');

  useEffect(() => {
    fetch(`/api/events/${eventId}`)
      .then(res => res.json())
      .then(data => {
        setEvent(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [eventId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/checkin/self', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, event_id: eventId })
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(true);
        setAttendeeName(data.name);
      } else {
        setError(data.error || 'Check-in failed');
      }
    } catch (err) {
      setError('A connection error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
    </div>
  );

  if (!event || event.error) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center">
        <X className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">Event Not Found</h2>
        <p className="text-slate-500 mb-6">The event you are looking for does not exist or has been removed.</p>
        <button onClick={onBack} className="text-indigo-600 font-bold hover:underline">Back to Home</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 p-4 flex items-center justify-center">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }} 
        animate={{ opacity: 1, scale: 1 }} 
        className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full border border-slate-200"
      >
        {success ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={32} />
            </div>
            <h2 className="text-2xl font-bold mb-2">Check-in Successful!</h2>
            <p className="text-slate-500 mb-6">Welcome, <strong>{attendeeName}</strong>! You've successfully checked in for <strong>{event.title}</strong>.</p>
            <button onClick={onBack} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-100">
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="text-center mb-8">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={24} />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">Event Check-in</h2>
              <p className="text-slate-500 mt-2">Enter your registered email to check in for <strong>{event.title}</strong></p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1 ml-1">Registered Email</label>
                <input 
                  required
                  type="email"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="your@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
              <button 
                type="submit" 
                disabled={submitting}
                className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-100 flex items-center justify-center gap-2 disabled:opacity-50 mt-4"
              >
                {submitting && <Loader2 className="animate-spin" size={20} />}
                {submitting ? 'Checking in...' : 'Check In Now'}
              </button>
              <button 
                type="button"
                onClick={onBack}
                className="w-full py-2 text-slate-400 text-sm font-medium hover:text-slate-600"
              >
                Cancel
              </button>
            </form>
          </>
        )}
      </motion.div>
    </div>
  );
}

function PublicRegistrationPage({ eventId, onBack }: { eventId: string, onBack: () => void }) {
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({ name: '', email: '', department: '' });

  useEffect(() => {
    fetch(`/api/events/${eventId}`)
      .then(res => res.json())
      .then(data => {
        setEvent(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [eventId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, event_id: eventId })
      });
      if (res.ok) {
        setSuccess(true);
      } else {
        const data = await res.json();
        setError(data.error || 'Registration failed');
      }
    } catch (err) {
      setError('A connection error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
    </div>
  );

  if (!event || event.error) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center">
        <X className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">Event Not Found</h2>
        <p className="text-slate-500 mb-6">The event you are looking for does not exist or has been removed.</p>
        <button onClick={onBack} className="text-indigo-600 font-bold hover:underline">Back to Home</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 p-4 flex items-center justify-center">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }} 
        animate={{ opacity: 1, scale: 1 }} 
        className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full border border-slate-200"
      >
        {success ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={32} />
            </div>
            <h2 className="text-2xl font-bold mb-2">You're Registered!</h2>
            <p className="text-slate-500 mb-6">We've successfully registered you for <strong>{event.title}</strong>. See you there!</p>
            <button onClick={onBack} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-100">
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="text-center mb-8">
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Calendar size={24} />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">{event.title}</h2>
              <div className="mt-4 space-y-2">
                <p className="text-slate-500 text-sm flex items-center justify-center gap-2">
                  <Clock size={14} /> {new Date(event.date).toLocaleString()}
                </p>
                <p className="text-slate-500 text-sm flex items-center justify-center gap-2">
                  <MapPin size={14} /> {event.location}
                </p>
              </div>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1 ml-1">Full Name</label>
                <input 
                  required
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Enter your name"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1 ml-1">Email Address</label>
                <input 
                  required
                  type="email"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="your@email.com"
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1 ml-1">Department</label>
                <input 
                  required
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. Marketing, IT"
                  value={formData.department}
                  onChange={e => setFormData({...formData, department: e.target.value})}
                />
              </div>
              <button 
                type="submit" 
                disabled={submitting}
                className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 disabled:opacity-50 mt-4"
              >
                {submitting && <Loader2 className="animate-spin" size={20} />}
                {submitting ? 'Registering...' : 'Complete Registration'}
              </button>
              <button 
                type="button"
                onClick={onBack}
                className="w-full py-2 text-slate-400 text-sm font-medium hover:text-slate-600"
              >
                Cancel
              </button>
            </form>
          </>
        )}
      </motion.div>
    </div>
  );
}

function AITab({ insights, stats }: { insights: any, stats: Stats | null }) {
  if (!insights) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
        <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 mb-4">
          <Brain size={40} />
        </div>
        <h3 className="text-xl font-bold text-slate-900">AI Insights Not Generated</h3>
        <p className="text-slate-500 max-w-md">
          Click the "AI Insights" button in the header to analyze your event data and generate trends.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4"
        >
          <div className="flex items-center gap-3 text-indigo-600">
            <TrendingUp size={20} />
            <h3 className="text-lg font-bold">Trend Analysis</h3>
          </div>
          <p className="text-slate-600 leading-relaxed text-sm">
            {insights.trends}
          </p>
          
          <div className="space-y-3">
            <h4 className="font-bold text-slate-900 flex items-center gap-2 text-sm">
              <Users size={16} className="text-indigo-500" />
              Most Active Departments
            </h4>
            <div className="flex flex-wrap gap-2">
              {insights.activeDepartments.map((dept: string, i: number) => (
                <span key={i} className="px-3 py-1 bg-slate-50 text-slate-700 rounded-lg text-xs font-medium border border-slate-100">
                  {dept}
                </span>
              ))}
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-indigo-600 p-6 rounded-3xl text-white shadow-xl shadow-indigo-100 space-y-4"
        >
          <div className="flex items-center gap-3">
            <Brain size={20} />
            <h3 className="text-lg font-bold">AI Recommendations</h3>
          </div>
          <ul className="space-y-2">
            {insights.recommendations.map((rec: string, i: number) => (
              <motion.li 
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="flex gap-3 bg-white/10 p-3 rounded-xl border border-white/10 text-sm"
              >
                <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold">
                  {i + 1}
                </div>
                <span className="text-indigo-50">{rec}</span>
              </motion.li>
            ))}
          </ul>
        </motion.div>
      </div>

      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-3">
          <BarChart3 size={20} className="text-indigo-600" />
          Attendance Performance
        </h3>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats?.eventStats}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis dataKey="title" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#FFF', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                cursor={{ fill: '#F1F5F9' }}
              />
              <Bar dataKey="registrations" name="Registrations" fill="#818CF8" radius={[4, 4, 0, 0]} />
              <Bar dataKey="attendance" name="Attendance" fill="#4F46E5" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
        active 
          ? 'bg-indigo-50 text-indigo-600 font-semibold' 
          : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function AuthPage({ onLogin }: { onLogin: (user: any, token: string) => void }) {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/signup';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      let data;
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(text.slice(0, 100) || 'A server error occurred. Please check your database configuration.');
      }

      if (!res.ok) throw new Error(data.error || 'Authentication failed');
      onLogin(data.user, data.token);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-8 rounded-3xl shadow-xl border border-slate-200 w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Calendar className="text-white" size={24} />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">{isLogin ? 'Welcome Back' : 'Create Account'}</h2>
          <p className="text-slate-500 text-sm mt-2">
            {isLogin ? 'Sign in to manage your events' : 'Join EventEase to start organizing'}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl text-sm font-medium border border-red-100">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
              <input 
                required
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="John Doe"
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
            <input 
              required
              type="email"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="john@example.com"
              value={formData.email}
              onChange={e => setFormData({...formData, email: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input 
              required
              type="password"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="••••••••"
              value={formData.password}
              onChange={e => setFormData({...formData, password: e.target.value})}
            />
          </div>
          <button 
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin mx-auto" size={24} /> : (isLogin ? 'Sign In' : 'Sign Up')}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button 
            onClick={() => setIsLogin(!isLogin)}
            className="text-indigo-600 font-semibold text-sm hover:underline"
          >
            {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function Dashboard({ stats, events, onAnalyze, onViewEvents }: { stats: Stats | null, events: Event[], onAnalyze: () => void, onViewEvents: () => void }) {
  const [prediction, setPrediction] = useState<{ predictedCount: number, reasoning: string } | null>(null);
  const [isPredicting, setIsPredicting] = useState(false);

  const handlePredict = async () => {
    if (events.length === 0) return;
    setIsPredicting(true);
    try {
      const nextEvent = { title: "Next Seminar", date: new Date().toISOString(), location: "Main Hall" };
      const res = await predictAttendance(nextEvent, events.slice(0, 5));
      setPrediction(res);
    } catch (error) {
      console.error(error);
    } finally {
      setIsPredicting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Events" value={stats?.totalEvents || 0} icon={<Calendar className="text-blue-600" />} color="bg-blue-50" />
        <StatCard label="Total Participants" value={stats?.totalParticipants || 0} icon={<Users className="text-emerald-600" />} color="bg-emerald-50" />
        <StatCard label="Attendance Rate" value={`${stats?.totalParticipants ? Math.round((stats.totalAttendance / stats.totalParticipants) * 100) : 0}%`} icon={<CheckCircle className="text-amber-600" />} color="bg-amber-50" />
        <StatCard label="Active Depts" value={stats?.departmentStats.length || 0} icon={<TrendingUp className="text-indigo-600" />} color="bg-indigo-50" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-base">Department Distribution</h3>
              <BarChart3 size={18} className="text-slate-400" />
            </div>
            <div className="space-y-3">
              {stats?.departmentStats.slice(0, 5).map((dept, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-slate-700">{dept.department}</span>
                    <span className="text-slate-500">{dept.count} participants</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${(dept.count / (stats.totalParticipants || 1)) * 100}%` }}
                      className="h-full bg-indigo-500"
                    />
                  </div>
                </div>
              ))}
              {(!stats?.departmentStats || stats.departmentStats.length === 0) && (
                <p className="text-center text-slate-400 py-4">No data available yet.</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-indigo-600 rounded-2xl p-4 text-white shadow-lg shadow-indigo-100 relative overflow-hidden">
              <div className="relative z-10">
                <h3 className="text-base font-bold mb-1 flex items-center gap-2">
                  <TrendingUp size={18} />
                  Attendance Prediction
                </h3>
                <p className="text-indigo-100 text-[10px] mb-4">
                  AI-powered insights for your next event.
                </p>
                
                {prediction ? (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/20"
                  >
                    <div className="flex items-end gap-2 mb-0.5">
                      <span className="text-xl font-bold">{prediction.predictedCount}</span>
                      <span className="text-indigo-200 text-[10px] pb-0.5">Predicted</span>
                    </div>
                    <p className="text-[10px] text-indigo-50 italic line-clamp-1">"{prediction.reasoning}"</p>
                  </motion.div>
                ) : (
                  <button 
                    onClick={handlePredict}
                    disabled={isPredicting || events.length === 0}
                    className="w-full py-2 bg-white text-indigo-600 rounded-lg font-bold hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
                  >
                    {isPredicting ? <Loader2 className="animate-spin" size={16} /> : <TrendingUp size={16} />}
                    Predict Next
                  </button>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-base font-bold mb-1 flex items-center gap-2 text-slate-900">
                  <Brain size={18} className="text-indigo-600" />
                  Deep Trend Analysis
                </h3>
                <p className="text-slate-500 text-[10px] mb-4">
                  Analyze all participant data to find hidden patterns.
                </p>
              </div>
              <button 
                onClick={onAnalyze}
                className="w-full py-2 bg-indigo-50 text-indigo-600 rounded-lg font-bold hover:bg-indigo-100 transition-colors flex items-center justify-center gap-2 text-sm"
              >
                <BarChart3 size={16} />
                Full AI Report
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-base mb-4">Upcoming Events</h3>
          <div className="space-y-2">
            {events.slice(0, 5).map((event) => (
              <div 
                key={event.id} 
                onClick={onViewEvents}
                className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer group"
              >
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex flex-col items-center justify-center text-slate-500 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                  <span className="text-[8px] font-bold uppercase">{new Date(event.date).toLocaleString('default', { month: 'short' })}</span>
                  <span className="text-base font-bold leading-none">{new Date(event.date).getDate()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-xs truncate">{event.title}</h4>
                  <p className="text-[9px] text-slate-500 truncate">{event.location}</p>
                </div>
                <ChevronRight size={12} className="text-slate-300" />
              </div>
            ))}
            {events.length === 0 && (
              <p className="text-center text-slate-400 py-4 text-xs">No events scheduled.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string, value: string | number, icon: React.ReactNode, color: string }) {
  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
      <div className={`w-10 h-10 ${color} rounded-lg flex items-center justify-center mb-3`}>
        {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<any>, { size: 20 }) : icon}
      </div>
      <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">{label}</p>
      <h4 className="text-xl font-bold mt-0.5">{value}</h4>
    </div>
  );
}

function EventsList({ events, onRefresh, onDelete, searchQuery }: { events: Event[], onRefresh: () => void, onDelete: (id: number) => void, searchQuery: string }) {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ title: '', description: '', date: '', location: '', capacity: 100 });
  const [qrEvent, setQrEvent] = useState<Event | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const filteredEvents = events.filter(e => 
    e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.location.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    try {
      const token = localStorage.getItem('eventease_token');
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      
      if (res.status === 401) {
        localStorage.removeItem('eventease_token');
        localStorage.removeItem('eventease_user');
        window.location.reload(); // Force a reload to show login page
        return;
      }

      const contentType = res.headers.get("content-type");
      let data;
      if (contentType && contentType.includes("application/json")) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(text.slice(0, 100) || 'Server returned non-JSON response');
      }

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create event');
      }

      setFormData({ title: '', description: '', date: '', location: '', capacity: 100 });
      setShowForm(false);
      onRefresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold">All Events</h3>
        <button 
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
        >
          <Plus size={18} />
          <span>Create Event</span>
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl"
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold">Create New Event</h3>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>
            
            {error && (
              <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-xs border border-red-100">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Event Title</label>
                <input 
                  required
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={formData.title}
                  onChange={e => setFormData({...formData, title: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea 
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none h-24"
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  placeholder="Tell us about the event..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                <input 
                  required
                  type="datetime-local"
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={formData.date}
                  onChange={e => setFormData({...formData, date: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
                <input 
                  required
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={formData.location}
                  onChange={e => setFormData({...formData, location: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Capacity</label>
                <input 
                  type="number"
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={formData.capacity}
                  onChange={e => setFormData({...formData, capacity: parseInt(e.target.value)})}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting && <Loader2 className="animate-spin" size={18} />}
                  {isSubmitting ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {qrEvent && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl p-8 w-full max-w-xs shadow-2xl text-center"
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">Event QR Code</h3>
              <button onClick={() => setQrEvent(null)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>
            <div className="bg-slate-50 p-6 rounded-xl flex justify-center mb-6">
              <QRCodeSVG 
                value={`${window.location.origin}?register=${qrEvent.id}`} 
                size={200} 
                level="H"
                includeMargin={true}
              />
            </div>
            <p className="font-bold text-slate-900 mb-1">{qrEvent.title}</p>
            <p className="text-sm text-slate-500 mb-6">{new Date(qrEvent.date).toLocaleDateString()}</p>
            
            <div className="mb-6">
              <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-200 mb-2">
                <input 
                  readOnly 
                  value={`${window.location.origin}?register=${qrEvent.id}`}
                  className="bg-transparent text-[10px] text-slate-500 outline-none flex-1 truncate"
                />
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}?register=${qrEvent.id}`);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
              {copied && <p className="text-[10px] text-emerald-600 font-medium animate-pulse">Link copied to clipboard!</p>}
            </div>

            <button 
              onClick={() => { setQrEvent(null); setCopied(false); }}
              className="w-full py-2 bg-indigo-600 text-white rounded-lg font-bold"
            >
              Close
            </button>
          </motion.div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredEvents.map(event => (
          <div key={event.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden group hover:border-indigo-300 transition-all">
            <div className="h-24 bg-slate-100 relative overflow-hidden">
              <img 
                src={`https://picsum.photos/seed/${event.id}/400/200`} 
                alt={event.title}
                className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-500"
                referrerPolicy="no-referrer"
              />
              <div className="absolute top-4 right-4 flex gap-2">
                <button 
                  onClick={(e) => { e.stopPropagation(); setQrEvent(event); }}
                  className="p-1.5 bg-white/90 backdrop-blur text-indigo-600 rounded-full hover:bg-indigo-50 transition-colors shadow-sm"
                  title="Show QR"
                >
                  <QrCode size={14} />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); onDelete(event.id); }}
                  className="p-1.5 bg-white/90 backdrop-blur text-red-500 rounded-full hover:bg-red-50 transition-colors shadow-sm"
                  title="Delete Event"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="absolute bottom-4 left-4">
                <div className="bg-white/90 backdrop-blur px-3 py-1 rounded-full text-[10px] font-bold text-indigo-600 shadow-sm flex items-center gap-1">
                  <MapPin size={10} />
                  {event.location}
                </div>
              </div>
            </div>
            <div className="p-4">
              <h4 className="text-base font-bold mb-1 group-hover:text-indigo-600 transition-colors">{event.title}</h4>
              <p className="text-slate-500 text-xs mb-3 line-clamp-2">{event.description || 'No description provided.'}</p>
              <div className="flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <Calendar size={14} />
                  <span>{new Date(event.date).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users size={14} />
                  <span>Max {event.capacity}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RegistrationForm({ events, onRefresh }: { events: Event[], onRefresh: () => void }) {
  const [formData, setFormData] = useState({ event_id: '', name: '', email: '', department: '' });
  const [successData, setSuccessData] = useState<{ id: number, event_title: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    if (res.ok) {
      const data = await res.json();
      const event = events.find(e => e.id === parseInt(formData.event_id));
      setSuccessData({ id: data.id, event_title: event?.title || 'Event' });
      setFormData({ event_id: '', name: '', email: '', department: '' });
      onRefresh();
    }
  };

  if (successData) {
    return (
      <div className="max-w-md mx-auto bg-white p-8 rounded-2xl border border-slate-200 shadow-xl text-center">
        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle size={32} />
        </div>
        <h3 className="text-2xl font-bold mb-2">Registration Successful!</h3>
        <p className="text-slate-500 mb-8">You have been successfully registered. You can check in at the event entrance using your registered email.</p>
        
        <div className="text-left bg-slate-50 p-6 rounded-2xl mb-8 border border-slate-100">
          <div className="mb-4">
            <p className="text-xs text-slate-400 uppercase font-bold mb-1">Event</p>
            <p className="font-bold text-slate-800 text-lg">{successData.event_title}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase font-bold mb-1">Status</p>
            <p className="font-bold text-emerald-600 flex items-center gap-2">
              <CheckCircle size={16} />
              Confirmed
            </p>
          </div>
        </div>

        <button 
          onClick={() => setSuccessData(null)}
          className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
        >
          Register Another
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
      <div className="text-center mb-8">
        <h3 className="text-2xl font-bold mb-2">Event Registration</h3>
        <p className="text-slate-500">Fill out the form below to register for an upcoming event.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Select Event</label>
          <select 
            required
            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-slate-50"
            value={formData.event_id}
            onChange={e => setFormData({...formData, event_id: e.target.value})}
          >
            <option value="">Choose an event...</option>
            {events.map(e => (
              <option key={e.id} value={e.id}>{e.title} - {new Date(e.date).toLocaleDateString()}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Full Name</label>
            <input 
              required
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="John Doe"
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Email Address</label>
            <input 
              required
              type="email"
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="john@example.com"
              value={formData.email}
              onChange={e => setFormData({...formData, email: e.target.value})}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Department / Organization</label>
          <input 
            required
            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
            placeholder="Computer Science"
            value={formData.department}
            onChange={e => setFormData({...formData, department: e.target.value})}
          />
        </div>

        <button 
          type="submit"
          className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
        >
          Register Now
        </button>
      </form>
    </div>
  );
}

function AttendanceTracker({ events, onRefresh, searchQuery }: { events: Event[], onRefresh: (silent?: boolean) => void, searchQuery: string }) {
  const [selectedEventId, setSelectedEventId] = useState('');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCheckInQR, setShowCheckInQR] = useState(false);
  const [copied, setCopied] = useState(false);

  const filteredParticipants = participants.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.department.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    if (selectedEventId) {
      fetchParticipants();
    }
  }, [selectedEventId]);

  const fetchParticipants = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('eventease_token');
      const res = await fetch(`/api/events/${selectedEventId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch participants');
      const data = await res.json();
      setParticipants(data.participants || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async (participantId: number) => {
    try {
      const token = localStorage.getItem('eventease_token');
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          participant_id: Number(participantId), 
          event_id: Number(selectedEventId) 
        })
      });
      
      const data = await res.json();
      
      if (res.ok || data.error === 'Already checked in') {
        onRefresh(true); // Silent refresh
        // Simple visual feedback
        setParticipants(prev => prev.map(p => p.id === participantId ? { ...p, status: 'attended' } : p));
        return true;
      } else {
        return false;
      }
    } catch (err) {
      console.error(err);
      return false;
    }
  };

  const handleExport = () => {
    if (participants.length === 0) return;
    const worksheet = XLSX.utils.json_to_sheet(participants.map(p => ({
      Name: p.name,
      Email: p.email,
      Department: p.department,
      Status: p.status === 'attended' ? 'Present' : 'Registered',
      'Registered At': new Date(p.registered_at).toLocaleString()
    })));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance");
    XLSX.writeFile(workbook, `event_${selectedEventId}_attendance.xlsx`);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <label className="block text-sm font-medium text-slate-700 mb-3">Select Event to Track Attendance</label>
        <div className="flex gap-4">
          <select 
            className="flex-1 px-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
            value={selectedEventId}
            onChange={e => setSelectedEventId(e.target.value)}
          >
            <option value="">Choose an event...</option>
            {events.map(e => (
              <option key={e.id} value={e.id}>{e.title}</option>
            ))}
          </select>
          <button 
            onClick={() => {
              if (!selectedEventId) {
                alert("Please select an event first");
                return;
              }
              setShowCheckInQR(true);
            }}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
          >
            <QrCode size={18} />
            <span>Show Check-in QR</span>
          </button>
        </div>
      </div>

      {showCheckInQR && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl p-8 w-full max-w-xs shadow-2xl text-center"
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">Attendee Check-in QR</h3>
              <button onClick={() => setShowCheckInQR(false)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>
            <div className="bg-slate-50 p-6 rounded-xl flex justify-center mb-6">
              <QRCodeSVG 
                value={`${window.location.origin}?checkin=${selectedEventId}`} 
                size={200} 
                level="H"
                includeMargin={true}
              />
            </div>
            <p className="text-sm text-slate-500 mb-6">Attendees can scan this QR code to check themselves in using their registered email.</p>
            
            <div className="mb-6">
              <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-200 mb-2">
                <input 
                  readOnly 
                  value={`${window.location.origin}?checkin=${selectedEventId}`}
                  className="bg-transparent text-[10px] text-slate-500 outline-none flex-1 truncate"
                />
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}?checkin=${selectedEventId}`);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
              {copied && <p className="text-[10px] text-emerald-600 font-medium animate-pulse">Link copied to clipboard!</p>}
            </div>

            <button 
              onClick={() => { setShowCheckInQR(false); setCopied(false); }}
              className="w-full py-2 bg-indigo-600 text-white rounded-lg font-bold"
            >
              Close
            </button>
          </motion.div>
        </div>
      )}

      {selectedEventId && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-bottom border-slate-100 flex justify-between items-center">
            <div className="flex items-center gap-4">
              <h4 className="font-bold">Participant List</h4>
              <button 
                onClick={fetchParticipants}
                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-all"
                title="Refresh List"
              >
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
            <button 
              onClick={handleExport}
              className="text-indigo-600 text-sm font-medium flex items-center gap-1 hover:underline"
            >
              <FileText size={16} />
              Export Report
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4">Department</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredParticipants.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-slate-400">{p.email}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{p.department}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                        p.status === 'attended' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {p.status === 'attended' ? 'Present' : 'Registered'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button 
                        disabled={p.status === 'attended'}
                        onClick={() => handleCheckIn(p.id)}
                        className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                          p.status === 'attended' 
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                            : 'bg-indigo-600 text-white hover:bg-indigo-700'
                        }`}
                      >
                        {p.status === 'attended' ? 'Checked In' : 'Check In'}
                      </button>
                    </td>
                  </tr>
                ))}
                {participants.length === 0 && !loading && (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                      No participants registered for this event yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function ChatbotWindow({ onClose, events }: { onClose: () => void, events: Event[] }) {
  const [messages, setMessages] = useState<{ role: 'user' | 'bot', text: string }[]>([
    { role: 'bot', text: 'Hello! I am EventEase Assistant. How can I help you today?' }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsTyping(true);

    try {
      const context = `Upcoming events: ${events.map(e => `${e.title} on ${e.date}`).join(', ')}`;
      const botResponse = await getChatbotResponse(userMsg, context);
      setMessages(prev => [...prev, { role: 'bot', text: botResponse || "I'm sorry, I couldn't process that." }]);
    } catch (error) {
      console.error('Chat error:', error);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      className="fixed bottom-24 right-6 w-80 md:w-96 h-[500px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col z-50 overflow-hidden"
    >
      <div className="p-4 bg-indigo-600 text-white flex justify-between items-center">
        <div className="flex items-center gap-2">
          <MessageSquare size={20} />
          <span className="font-bold">EventEase AI</span>
        </div>
        <button onClick={onClose} className="hover:bg-white/20 p-1 rounded transition-colors">
          <ChevronRight className="rotate-90" size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${
              msg.role === 'user' 
                ? 'bg-indigo-600 text-white rounded-tr-none' 
                : 'bg-slate-100 text-slate-800 rounded-tl-none'
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-slate-100 p-3 rounded-2xl rounded-tl-none flex gap-1">
              <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" />
              <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce [animation-delay:0.2s]" />
              <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce [animation-delay:0.4s]" />
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-slate-100 flex gap-2">
        <input 
          className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
          placeholder="Type a message..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyPress={e => e.key === 'Enter' && handleSend()}
        />
        <button 
          onClick={handleSend}
          className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"
        >
          <ChevronRight size={20} />
        </button>
      </div>
    </motion.div>
  );
}
