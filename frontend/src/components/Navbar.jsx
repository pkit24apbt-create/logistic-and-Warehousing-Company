import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <header className="navbar">
      <div className="navbar-brand">
        <div className="mark">SS</div>
        SafeStack
      </div>

      {user?.role === 'administrator' && (
        <nav className="navbar-links">
          <Link to="/dashboard/admin">Dashboard</Link>
          <Link to="/admin/users">Users &amp; Roles</Link>
        </nav>
      )}

      <div className="navbar-user">
        <span>{user?.fullName}</span>
        <span className="role-pill">{user?.role}</span>
        <button onClick={handleLogout}>Log out</button>
      </div>
    </header>
  );
}