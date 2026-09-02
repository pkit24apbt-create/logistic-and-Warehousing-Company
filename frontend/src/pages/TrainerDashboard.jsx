import React from 'react';
import { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import axiosClient from '../api/axiosClient';

export default function TrainerDashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    axiosClient.get('/dashboard/trainer').then((res) => setData(res.data));
  }, []);

  return (
    <div>
      <Navbar />
      <main className="dashboard">
        <h1>Trainer Dashboard</h1>
        <p>{data ? data.message : 'Loading…'}</p>
        <p className="placeholder-note">
          This is the Sprint 1 placeholder dashboard. Widgets for this role
          are built in later sprints per the project Sprint plan.
        </p>
      </main>
    </div>
  );
}