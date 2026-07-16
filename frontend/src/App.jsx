import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Layout/Navbar';
import Footer from './components/Layout/Footer';
import RegistrationWizard from './components/Registration/RegistrationWizard';
import Login from './components/Registration/Login';
import ItemSearch from './components/ItemSearch/ItemSearch';
import ItemDetail from './components/ItemDetail/ItemDetail';
import CreateItem from './components/ItemDetail/CreateItem';
import Profile from './components/Profile/Profile';
import MyListings from './components/Profile/MyListings';
import MyTransactions from './components/Transaction/MyTransactions';
import TransactionDetail from './components/Transaction/TransactionDetail';
import QRScan from './components/Transaction/QRScan';
import PublicProfile from './components/Profile/PublicProfile';
import AdminDashboard from './components/Admin/AdminDashboard';
import { useAuth } from './context/AuthContext';

function ProtectedRoute({ children, requireAdmin = false }) {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: window.location.pathname }} replace />;
  }

  if (requireAdmin && !user?.is_staff) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function PublicRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<ItemSearch />} />
          <Route path="/items/:id" element={<ItemDetail />} />
          <Route path="/users/:id/profile" element={<PublicProfile />} />

          <Route
            path="/register"
            element={
              <PublicRoute>
                <RegistrationWizard />
              </PublicRoute>
            }
          />
          <Route
            path="/login"
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            }
          />

          <Route
            path="/create-listing"
            element={
              <ProtectedRoute>
                <CreateItem />
              </ProtectedRoute>
            }
          />
          <Route
            path="/edit-item/:id"
            element={
              <ProtectedRoute>
                <CreateItem />
              </ProtectedRoute>
            }
          />

          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-listings"
            element={
              <ProtectedRoute>
                <MyListings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-transactions"
            element={
              <ProtectedRoute>
                <MyTransactions />
              </ProtectedRoute>
            }
          />
          <Route
            path="/transactions/:id"
            element={
              <ProtectedRoute>
                <TransactionDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/transactions/:id/scan"
            element={
              <ProtectedRoute>
                <QRScan />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/*"
            element={
              <ProtectedRoute requireAdmin>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}