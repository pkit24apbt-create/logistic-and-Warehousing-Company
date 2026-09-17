export default function Topbar() {
  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <div className="topbar" style={{ justifyContent: 'flex-end' }}>
      <div className="topbar-right">
        <span className="topbar-date">{today}</span>
        <div className="topbar-bell">
          <span className="icon-mask icon-bell" />
          <span className="topbar-bell-dot" />
        </div>
      </div>
    </div>
  );
}