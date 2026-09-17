import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate, useLocation } from 'react-router-dom';

const ROLE_LINKS = {
  employee: [
    { to: '/dashboard/employee', label: 'Dashboard', icon: 'icon-dashboard' },
    { to: '/modules', label: 'Training', icon: 'icon-book' },
    { to: '/tour', label: 'Virtual Tour', icon: 'icon-compass' },
  ],
  trainer: [
    { to: '/dashboard/trainer', label: 'Dashboard', icon: 'icon-dashboard' },
    { to: '/modules', label: 'Manage Training', icon: 'icon-book' },
    { to: '/tour', label: 'Virtual Tour', icon: 'icon-compass' },
  ],
  supervisor: [
    { to: '/dashboard/supervisor', label: 'Dashboard', icon: 'icon-dashboard' },
    { to: '/reports', label: 'Reports', icon: 'icon-chart' },
    { to: '/tour', label: 'Virtual Tour', icon: 'icon-compass' },
  ],
  administrator: [
    { to: '/dashboard/admin', label: 'Dashboard', icon: 'icon-dashboard' },
    { to: '/admin/users', label: 'Users & Roles', icon: 'icon-users' },
    { to: '/modules', label: 'Training', icon: 'icon-book' },
    { to: '/reports', label: 'Reports', icon: 'icon-chart' },
    { to: '/tour', label: 'Virtual Tour', icon: 'icon-compass' },
  ],
};

function initials(name) {
  if (!name) return '?';
  return name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const links = ROLE_LINKS[user?.role] || [];

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-mark">SS</div>
        <span>SafeStack</span>
      </div>

      <nav className="sidebar-nav">
        {links.map((l) => {
          const active = location.pathname === l.to || location.pathname.startsWith(l.to + '/');
          return (
            <Link key={l.to} to={l.to} className={`sidebar-link ${active ? 'active' : ''}`}>
              <span className={`icon-mask ${l.icon} sidebar-link-icon`} />
              {l.label}
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">{initials(user?.fullName)}</div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{user?.fullName}</div>
            <span className="role-pill">{user?.role}</span>
          </div>
        </div>
        <button className="sidebar-logout" onClick={handleLogout}>
          <span className="icon-mask icon-logout sidebar-link-icon" />
          Log out
        </button>
      </div>
    </aside>
  );
}