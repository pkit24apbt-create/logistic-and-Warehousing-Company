import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const DASHBOARD_BY_ROLE = {
  employee: '/dashboard/employee',
  trainer: '/dashboard/trainer',
  supervisor: '/dashboard/supervisor',
  administrator: '/dashboard/admin',
};

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="page-center">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;

  // A user with a one-time temporary password (freshly created, or reset by
  // an Administrator) is forced through the change-password screen before
  // they can reach anything else in the app.
  if (user.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role) && user.role !== 'administrator') {
    return <Navigate to={DASHBOARD_BY_ROLE[user.role] || '/login'} replace />;
  }

  return children;
}