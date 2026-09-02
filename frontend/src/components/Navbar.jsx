import React from 'react';
import { useAuth } from '../context/AuthContext';

import { useNavigate } from 'react-router-dom';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <header className="navbar">
      <div className="navbar-brand">SafeStack</div>
      <div className="navbar-user">
        <span>{user?.fullName}</span>
        <span className="role-pill">{user?.role}</span>
        <button onClick={handleLogout}>Log out</button>
      </div>
    </header>
  );
}