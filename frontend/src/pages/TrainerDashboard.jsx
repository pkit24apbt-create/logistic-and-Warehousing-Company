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
        <p className="dashboard-subtitle">{data ? data.message : 'Loading…'}</p>
        <div className="card">
          <p className="placeholder-note" style={{ margin: 0 }}>
            This dashboard will show real widgets once later sprints add training
            data to report on.
          </p>
        </div>
      </main>
    </div>
  );
}