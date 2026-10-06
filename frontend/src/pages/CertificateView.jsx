import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { formatDate, COMPETENCY_STYLES } from '../components/UiBits';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';

// "Download PDF" fetches a real PDF from the server. "Print" uses the
// browser's print dialog: this stylesheet hides the sidebar and buttons and
// lets the certificate fill an A4 landscape page.
const printCss = `
@media print {
  .no-print { display: none !important; }
  .cert-main { margin: 0 !important; padding: 0 !important; max-width: none !important; background: #fff !important; }
  body { background: #fff !important; }
  @page { size: A4 landscape; margin: 8mm; }
  .cert-sheet { box-shadow: none !important; max-width: none !important; }
}`;

function Seal() {
  return (
    <svg width="76" height="76" viewBox="0 0 72 72" aria-hidden="true">
      <circle cx="36" cy="36" r="33" fill="#F59E0B" />
      <circle cx="36" cy="36" r="27" fill="none" stroke="#fff" strokeWidth="2" />
      <path d="M24 37l8 8 16-18" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function CertificateView() {
  const { id } = useParams();
  const { user } = useAuth();
  const [cert, setCert] = useState(null);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(null);

  useEffect(() => {
    axiosClient.get(`/management/certificates/${id}`)
      .then((res) => setCert(res.data))
      .catch((err) => setError((err.response && err.response.data && err.response.data.error) || 'Could not load this certificate.'));
  }, [id]);

  async function downloadPdf() {
    setDownloading(true);
    setDownloadError(null);
    try {
      const res = await axiosClient.get(`/management/certificates/${id}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `certificate-${cert.cert_code}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setDownloadError('Could not download the PDF. Check that pdf-lib is installed in the backend and the server has been restarted.');
    } finally {
      setDownloading(false);
    }
  }

  const backTo = user && user.role === 'administrator' ? '/admin/management'
    : user && user.role === 'supervisor' ? '/dashboard/supervisor'
    : '/dashboard/employee';

  if (error) {
    return (
      <div>
        <Navbar />
        <main className="dashboard">
          <p className="auth-error">{error}</p>
          <Link to={backTo} style={{ fontSize: 13 }}>&larr; Back</Link>
        </main>
      </div>
    );
  }

  if (!cert) return <div><Navbar /><main className="dashboard">Loading…</main></div>;

  const level = COMPETENCY_STYLES[cert.competency_level];
  const notValid = cert.effective_status !== 'valid';

  return (
    <div>
      <div className="no-print"><Navbar /></div>
      <main className="dashboard cert-main">
        <style>{printCss}</style>

        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
          <Link to={backTo} style={{ fontSize: 13 }}>&larr; Back</Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="btn-secondary" onClick={() => window.print()} style={{ cursor: 'pointer' }}>
              Print
            </button>
            <button className="auth-btn-primary" style={{ width: 'auto', padding: '10px 22px' }} onClick={downloadPdf} disabled={downloading}>
              {downloading ? 'Preparing PDF…' : 'Download PDF'}
            </button>
          </div>
        </div>

        {downloadError && (
          <div className="no-print" style={{ maxWidth: 900, margin: '0 auto 16px', background: '#FEE2E2', border: '1px solid #DC2626', color: '#B91C1C', borderRadius: 10, padding: '12px 16px', fontWeight: 600, fontSize: 13.5 }}>
            {downloadError}
          </div>
        )}

        {notValid && (
          <div className="no-print" style={{ maxWidth: 900, margin: '0 auto 16px', background: '#FEE2E2', border: '1px solid #DC2626', color: '#B91C1C', borderRadius: 10, padding: '12px 16px', fontWeight: 600, fontSize: 13.5 }}>
            This certificate is {cert.effective_status} and is no longer valid.
          </div>
        )}

        <div
          className="cert-sheet"
          style={{
            maxWidth: 900, margin: '0 auto', background: '#fff', textAlign: 'center',
            border: '10px double #0F766E', padding: '34px 56px 30px',
            boxShadow: '0 4px 24px rgba(15,118,110,0.12)', fontFamily: 'Georgia, "Times New Roman", serif',
            opacity: notValid ? 0.75 : 1,
          }}
        >
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: '#0F766E', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18, fontFamily: 'system-ui, sans-serif' }}>
              SS
            </div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#115E59', fontFamily: 'system-ui, sans-serif' }}>{cert.organisation}</div>
          </div>

          <div style={{ height: 3, width: 90, background: '#F59E0B', margin: '18px auto 20px', borderRadius: 2 }} />

          <div style={{ fontSize: 40, fontWeight: 700, color: '#115E59', letterSpacing: 1.5 }}>Certificate of Completion</div>

          <p style={{ margin: '22px 0 8px', fontSize: 15, fontStyle: 'italic', color: '#475569' }}>This is to certify that</p>
          <div style={{ display: 'inline-block', fontSize: 38, fontWeight: 700, color: '#0F172A', padding: '0 30px 6px', borderBottom: '3px solid #F59E0B' }}>
            {cert.employee_name}
          </div>

          <p style={{ margin: '22px 0 8px', fontSize: 15, fontStyle: 'italic', color: '#475569' }}>has successfully completed the training module</p>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#0F766E' }}>{cert.module_title}</div>

          <div style={{ margin: '20px 0 4px', fontFamily: 'system-ui, sans-serif', fontSize: 14, color: '#334155' }}>
            Competency achieved:{' '}
            {level && (
              <span style={{ display: 'inline-block', padding: '4px 14px', borderRadius: 999, fontWeight: 700, background: level[1], color: level[2] }}>
                {level[0]}
              </span>
            )}
            {cert.overall_score !== null && cert.overall_score !== undefined && (
              <span style={{ marginLeft: 12 }}>Overall score <strong>{cert.overall_score}%</strong></span>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 34, fontFamily: 'system-ui, sans-serif' }}>
            <div style={{ textAlign: 'left', minWidth: 170 }}>
              <div style={{ fontSize: 11, color: '#64748B', textTransform: 'uppercase', letterSpacing: 1 }}>Date issued</div>
              <div style={{ fontSize: 15, fontWeight: 600, borderTop: '1px solid #CBD5E1', marginTop: 6, paddingTop: 6 }}>{formatDate(cert.issued_date)}</div>
              <div style={{ fontSize: 11, color: '#64748B', textTransform: 'uppercase', letterSpacing: 1, marginTop: 14 }}>Valid until</div>
              <div style={{ fontSize: 15, fontWeight: 600, borderTop: '1px solid #CBD5E1', marginTop: 6, paddingTop: 6 }}>
                {cert.expiry_date ? formatDate(cert.expiry_date) : 'No expiry'}
              </div>
            </div>

            <Seal />

            <div style={{ textAlign: 'right', minWidth: 170 }}>
              <div style={{ fontSize: 11, color: '#64748B', textTransform: 'uppercase', letterSpacing: 1 }}>Certificate code</div>
              <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: 1, borderTop: '1px solid #CBD5E1', marginTop: 6, paddingTop: 6, fontFamily: 'ui-monospace, Menlo, Consolas, monospace' }}>
                {cert.cert_code}
              </div>
              {cert.department && (
                <>
                  <div style={{ fontSize: 11, color: '#64748B', textTransform: 'uppercase', letterSpacing: 1, marginTop: 14 }}>Department</div>
                  <div style={{ fontSize: 15, fontWeight: 600, borderTop: '1px solid #CBD5E1', marginTop: 6, paddingTop: 6 }}>{cert.department}</div>
                </>
              )}
            </div>
          </div>

          {notValid && (
            <div style={{ marginTop: 22, fontFamily: 'system-ui, sans-serif', fontWeight: 800, letterSpacing: 2, color: '#DC2626', textTransform: 'uppercase' }}>
              {cert.effective_status}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}