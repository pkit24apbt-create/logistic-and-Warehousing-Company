import React from 'react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import axiosClient from '../api/axiosClient';

export default function AdminDashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    axiosClient.get('/dashboard/admin').then((res) => setData(res.data));
  }, []);

  return (
    <div>
      <Navbar />
      <main className="dashboard">
        <h1>Admin Dashboard</h1>
        <p className="dashboard-subtitle">{data ? data.message : 'Loading…'}</p>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>User &amp; role management</h3>
          <p className="dashboard-subtitle" style={{ marginBottom: 16 }}>
            Create accounts for Employees, Trainers, and Supervisors, and manage
            everyone's access.
          </p>
          <Link
            to="/admin/users"
            className="auth-btn-primary"
            style={{ display: 'inline-block', width: 'auto', padding: '12px 28px', textDecoration: 'none' }}
          >
            Manage Users
          </Link>
        </div>
      </main>
    </div>
  );
}