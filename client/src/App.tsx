import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { BalanceProvider } from './contexts/BalanceContext';
import { WebSocketProvider } from './contexts/WebSocketContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import LoadingSpinner from './components/LoadingSpinner';
import ErrorBoundary from './components/ErrorBoundary';

// Lazy load components
const Login = React.lazy(() => import('./pages/Login'));
const Register = React.lazy(() => import('./pages/Register'));
const Home = React.lazy(() => import('./pages/Home'));
const Portfolio = React.lazy(() => import('./pages/Portfolio'));
const History = React.lazy(() => import('./pages/History'));
const Profile = React.lazy(() => import('./pages/Profile'));
const Loans = React.lazy(() => import('./pages/Loans'));
const ModalDemo = React.lazy(() => import('./pages/ModalDemo'));
const AdminDashboard = React.lazy(() => import('./pages/AdminDashboard'));
const AdminUsers = React.lazy(() => import('./pages/AdminUsers'));
const AdminTransactions = React.lazy(() => import('./pages/AdminTransactions'));
const AdminSettings = React.lazy(() => import('./pages/AdminSettings'));

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BalanceProvider>
          <WebSocketProvider>
            <Router>
            <div className="min-h-screen bg-black text-white">
            <Suspense fallback={<LoadingSpinner message="Loading page..." size="lg" className="min-h-screen" />}>
              <Routes>
              {/* Public routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
            
            {/* Protected routes */}
            <Route path="/" element={
              <ProtectedRoute>
                <Layout>
                  <Home />
                </Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/portfolio" element={
              <ProtectedRoute>
                <Layout>
                  <Portfolio />
                </Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/history" element={
              <ProtectedRoute>
                <Layout>
                  <History />
                </Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/profile" element={
              <ProtectedRoute>
                <Layout>
                  <Profile />
                </Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/loans" element={
              <ProtectedRoute>
                <Layout>
                  <Loans />
                </Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/modal-demo" element={
              <ProtectedRoute>
                <Layout>
                  <ModalDemo />
                </Layout>
              </ProtectedRoute>
            } />
            
            {/* Admin routes */}
            <Route path="/admin" element={
              <ProtectedRoute adminOnly>
                <Layout isAdmin>
                  <AdminDashboard />
                </Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/admin/users" element={
              <ProtectedRoute adminOnly>
                <Layout isAdmin>
                  <AdminUsers />
                </Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/admin/transactions" element={
              <ProtectedRoute adminOnly>
                <Layout isAdmin>
                  <AdminTransactions />
                </Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/admin/settings" element={
              <ProtectedRoute adminOnly>
                <Layout isAdmin>
                  <AdminSettings />
                </Layout>
              </ProtectedRoute>
            } />
            
              {/* Catch all route */}
              <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
            </div>
            </Router>
          </WebSocketProvider>
        </BalanceProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
