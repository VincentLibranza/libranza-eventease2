"use client";

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../AuthContext';
import { Calendar, LayoutDashboard, LogOut, User as UserIcon, PlusCircle, BarChart3 } from 'lucide-react';

const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <nav className="glass sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
      <Link href="/" className="flex items-center gap-2 text-2xl font-bold text-brand-600">
        <Calendar className="w-8 h-8" />
        <span>EventEase</span>
      </Link>

      <div className="flex items-center gap-6">
        <Link href="/" className="text-slate-600 hover:text-brand-600 font-medium transition-colors">Events</Link>
        
        {user ? (
          <>
            {user.role === 'admin' && (
              <>
                <Link href="/admin" className="flex items-center gap-1 text-slate-600 hover:text-brand-600 font-medium transition-colors">
                  <LayoutDashboard className="w-4 h-4" />
                  Dashboard
                </Link>
                <Link href="/admin/reports" className="flex items-center gap-1 text-slate-600 hover:text-brand-600 font-medium transition-colors">
                  <BarChart3 className="w-4 h-4" />
                  Reports
                </Link>
              </>
            )}
            <div className="flex items-center gap-4 ml-4 pl-4 border-l border-slate-200">
              <div className="flex items-center gap-2 text-slate-700 font-medium">
                <UserIcon className="w-4 h-4" />
                {user.name}
              </div>
              <button 
                onClick={handleLogout}
                className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-slate-600 hover:text-brand-600 font-medium transition-colors">Login</Link>
            <Link href="/register" className="bg-brand-600 text-white px-5 py-2 rounded-full font-medium hover:bg-brand-700 transition-all shadow-md hover:shadow-lg">
              Get Started
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
