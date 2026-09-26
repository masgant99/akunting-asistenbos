import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/AuthContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import COA from './pages/COA';
import Journal from './pages/Journal';
import Ledger from './pages/Ledger';
import Reports from './pages/Reports';
import Budget from './pages/Budget';
import Calendar from './pages/Calendar';
import CashBank from './pages/CashBank';
import Settings from './pages/Settings';
import AgenticMCP from './pages/AgenticMCP';
import LoginPage from './pages/Login';
import { Toaster } from '@/components/ui/sonner';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50 text-slate-800 font-sans">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
          <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Memuat Sistem...</span>
        </div>
      </div>
    );
  }
  
  if (!user) {
    return <LoginPage />;
  }
  
  return <>{children}</>;
};

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <ProtectedRoute>
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/coa" element={<COA />} />
              <Route path="/journal" element={<Journal />} />
              <Route path="/ledger" element={<Ledger />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/budget" element={<Budget />} />
              <Route path="/calendar" element={<Calendar />} />
              <Route path="/cash-bank" element={<CashBank />} />
              <Route path="/mcp" element={<AgenticMCP />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </Layout>
        </ProtectedRoute>
        <Toaster position="top-right" />
      </Router>
    </AuthProvider>
  );
}
