import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosClient from '../api/axiosClient';

function timeAgo(value) {
  const then = new Date(String(value).replace(' ', 'T') + (String(value).endsWith('Z') ? '' : 'Z'));
  const minutes = Math.max(0, Math.round((Date.now() - then.getTime()) / 60000));
  if (Number.isNaN(minutes)) return '';
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export default function Topbar() {
  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState({ unreadCount: 0, notifications: [] });
  const boxRef = useRef(null);

  async function load() {
    try {
      const res = await axiosClient.get('/notifications/mine');
      setData(res.data);
    } catch (err) {
      // Notifications are a bonus: never break the page if they cannot load.
    }
  }

  useEffect(() => {
    load();
    const timer = setInterval(load, 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    function onClickOutside(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  async function openNotification(n) {
    setOpen(false);
    if (!n.read_at) {
      try { await axiosClient.post(`/notifications/mine/${n.notification_id}/read`); } catch (err) { /* ignore */ }
      load();
    }
    if (n.module_id) navigate(`/modules/${n.module_id}`);
  }

  async function markAllRead() {
    try { await axiosClient.post('/notifications/mine/read-all'); } catch (err) { /* ignore */ }
    load();
  }

  return (
    <div className="topbar" style={{ justifyContent: 'flex-end' }}>
      <div className="topbar-right">
        <span className="topbar-date">{today}</span>
        <div ref={boxRef} style={{ position: 'relative' }}>
          <button
            type="button"
            className="topbar-bell"
            aria-label={`Notifications${data.unreadCount ? `, ${data.unreadCount} unread` : ''}`}
            onClick={() => setOpen((v) => !v)}
            style={{ padding: 0 }}
          >
            <span className="icon-mask icon-bell" />
            {data.unreadCount > 0 && <span className="topbar-bell-dot" />}
          </button>

          {open && (
            <div
              role="dialog"
              aria-label="Notifications"
              style={{
                position: 'absolute', right: 0, top: 46, width: 340, maxWidth: '86vw', zIndex: 50,
                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
                boxShadow: '0 10px 30px rgba(0,0,0,0.15)', overflow: 'hidden',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
                <strong style={{ fontSize: 14 }}>Notifications</strong>
                <button
                  type="button" onClick={markAllRead} disabled={data.unreadCount === 0}
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', opacity: data.unreadCount === 0 ? 0.4 : 1 }}
                >
                  Mark all read
                </button>
              </div>
              <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                {data.notifications.length === 0 && (
                  <p style={{ margin: 0, padding: 18, fontSize: 13.5, color: 'var(--text-600)' }}>You have no notifications.</p>
                )}
                {data.notifications.map((n) => (
                  <button
                    key={n.notification_id} type="button" onClick={() => openNotification(n)}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left', padding: '12px 14px', cursor: 'pointer',
                      fontFamily: 'inherit', border: 'none', borderBottom: '1px solid var(--border)',
                      background: n.read_at ? 'transparent' : 'var(--primary-light)',
                      borderLeft: n.read_at ? '3px solid transparent' : '3px solid var(--accent)',
                    }}
                  >
                    <div style={{ fontSize: 13.5, fontWeight: n.read_at ? 600 : 800, color: 'var(--text-900)' }}>{n.title}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-600)', margin: '2px 0' }}>{n.message}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-400)' }}>{timeAgo(n.created_at)}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}