import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/src/AuthContext";
import Navbar from "@/src/components/Navbar";

export const metadata: Metadata = {
  title: "EventEase",
  description: "AI-powered event management system",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <div className="min-h-screen flex flex-col">
            <Navbar />
            <main className="flex-grow">
              {children}
            </main>
            <footer className="bg-white border-t border-slate-100 py-12 mt-20">
              <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
                <div className="flex items-center gap-2 text-xl font-bold text-slate-400">
                  <span>EventEase</span>
                </div>
                <div className="flex gap-8 text-slate-400 text-sm font-medium">
                  <a href="#" className="hover:text-brand-600 transition-colors">Privacy Policy</a>
                  <a href="#" className="hover:text-brand-600 transition-colors">Terms of Service</a>
                  <a href="#" className="hover:text-brand-600 transition-colors">Contact Us</a>
                </div>
                <div className="text-slate-400 text-sm">
                  © 2024 EventEase. All rights reserved.
                </div>
              </div>
            </footer>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
