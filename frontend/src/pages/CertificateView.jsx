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
  @page { size: A4 landscape; margin: 6mm; }
  .cert-sheet { box-shadow: none !important; max-width: none !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
.cert-corner { position: absolute; width: 26px; height: 26px; background: #115E59; }
.cert-corner::after { content: ''; position: absolute; top: 6px; left: 6px; width: 14px; height: 14px; background: #D99A1E; }
`;

const FONT_SERIF = 'Georgia, "Times New Roman", serif';
const FONT_SANS = 'system-ui, -apple-system, "Segoe UI", Arial, sans-serif';

// Gold rosette with a check mark and two ribbon tails.
function Seal() {
  const scallops = Array.from({ length: 28 }, (_, i) => {
    const a = (i / 28) * Math.PI * 2;
    return <circle key={i} cx={50 + Math.cos(a) * 36} cy={50 + Math.sin(a) * 36} r="6" fill="#D99A1E" />;
  });
  return (
    <svg width="104" height="124" viewBox="0 0 100 120" aria-hidden="true">
      <path d="M40 70 L26 116 L42 106 L50 118 L58 78 Z" fill="#115E59" />
      <path d="M60 70 L74 116 L58 106 L50 118 L42 78 Z" fill="#0F766E" />
      {scallops}
      <circle cx="50" cy="50" r="37" fill="#D99A1E" />
      <circle cx="50" cy="50" r="30" fill="#F5C451" stroke="#fff" strokeWidth="1.6" />
      <circle cx="50" cy="50" r="24" fill="none" stroke="#D99A1E" strokeWidth="1" />
      <path d="M36 51l10 11 19-24" fill="none" stroke="#115E59" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SignatureBlock({ line, label, sub }) {
  return (
    <div style={{ width: 230, textAlign: 'center' }}>
      <div style={{ minHeight: 30, fontFamily: FONT_SERIF, fontWeight: 700, fontSize: 19, color: '#0F172A' }}>{line}</div>
      <div style={{ borderTop: '1px solid #0F172A', paddingTop: 6, fontFamily: FONT_SANS, fontSize: 11.5, fontWeight: 700, color: '#475569' }}>{label}</div>
      <div style={{ fontFamily: FONT_SANS, fontSize: 10.5, color: '#64748B', marginTop: 2 }}>{sub}</div>
    </div>
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
  const hasScore = cert.overall_score !== null && cert.overall_score !== undefined;

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
          <div className="no-print" style={{ maxWidth: 940, margin: '0 auto 16px', background: '#FEE2E2', border: '1px solid #DC2626', color: '#B91C1C', borderRadius: 10, padding: '12px 16px', fontWeight: 600, fontSize: 13.5 }}>
            {downloadError}
          </div>
        )}

        {notValid && (
          <div className="no-print" style={{ maxWidth: 940, margin: '0 auto 16px', background: '#FEE2E2', border: '1px solid #DC2626', color: '#B91C1C', borderRadius: 10, padding: '12px 16px', fontWeight: 600, fontSize: 13.5 }}>
            This certificate is {cert.effective_status} and is no longer valid.
          </div>
        )}

        {/* ---- the certificate ---- */}
        <div
          className="cert-sheet"
          style={{
            position: 'relative', maxWidth: 940, margin: '0 auto', background: '#FFFCF5',
            border: '8px solid #115E59', padding: 10, boxShadow: '0 6px 28px rgba(15,118,110,0.18)',
            fontFamily: FONT_SERIF, opacity: notValid ? 0.8 : 1,
          }}
        >
          <div style={{ position: 'relative', border: '2px solid #D99A1E', padding: 6 }}>
            <div style={{ position: 'relative', border: '1px solid #0F766E', padding: '34px 56px 26px', textAlign: 'center', overflow: 'hidden' }}>

              {/* corner ornaments */}
              <span className="cert-corner" style={{ top: -1, left: -1 }} />
              <span className="cert-corner" style={{ top: -1, right: -1 }} />
              <span className="cert-corner" style={{ bottom: -1, left: -1 }} />
              <span className="cert-corner" style={{ bottom: -1, right: -1 }} />

              {/* faint rings behind the text */}
              <svg aria-hidden="true" viewBox="0 0 600 600" style={{ position: 'absolute', left: '50%', top: '50%', width: 560, height: 560, transform: 'translate(-50%, -52%)', pointerEvents: 'none' }}>
                <circle cx="300" cy="300" r="290" fill="none" stroke="#E6F2F0" strokeWidth="3" />
                <circle cx="300" cy="300" r="245" fill="none" stroke="#E6F2F0" strokeWidth="1.5" />
                <circle cx="300" cy="300" r="200" fill="none" stroke="#E6F2F0" strokeWidth="3" />
                <circle cx="300" cy="300" r="155" fill="none" stroke="#E6F2F0" strokeWidth="1.5" />
              </svg>

              <div style={{ position: 'relative' }}>
                {/* brand */}
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 10, background: '#0F766E', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 17, fontFamily: FONT_SANS }}>
                    SS
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#115E59', fontFamily: FONT_SANS }}>{cert.organisation}</div>
                </div>

                {/* title */}
                <div style={{ fontSize: 56, fontWeight: 700, color: '#115E59', letterSpacing: 12, lineHeight: 1.1, margin: '16px 0 4px', paddingLeft: 12 }}>
                  CERTIFICATE
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                  <span style={{ height: 1, width: 130, background: '#D99A1E' }} />
                  <span style={{ width: 10, height: 10, background: '#D99A1E', transform: 'rotate(45deg)' }} />
                  <span style={{ height: 1, width: 130, background: '#D99A1E' }} />
                </div>
                <div style={{ fontFamily: FONT_SANS, fontSize: 14, fontWeight: 700, letterSpacing: 6, color: '#475569', marginTop: 10 }}>
                  OF COMPLETION
                </div>

                {/* body */}
                <p style={{ margin: '22px 0 4px', fontSize: 16, fontStyle: 'italic', color: '#475569' }}>This is to certify that</p>
                <div style={{ display: 'inline-block', fontSize: 46, fontWeight: 700, fontStyle: 'italic', color: '#0F172A', padding: '0 36px 4px', borderBottom: '2px solid #D99A1E', minWidth: 320, lineHeight: 1.2 }}>
                  {cert.employee_name}
                </div>

                <p style={{ margin: '18px 0 6px', fontSize: 16, fontStyle: 'italic', color: '#475569' }}>
                  has successfully completed the health and safety training module
                </p>
                <div style={{ fontSize: 30, fontWeight: 700, color: '#0F766E', lineHeight: 1.2 }}>{cert.module_title}</div>

                <div style={{ margin: '16px 0 0', fontFamily: FONT_SANS, fontSize: 14, color: '#334155' }}>
                  Competency achieved:{' '}
                  {level && (
                    <span style={{ display: 'inline-block', padding: '4px 16px', borderRadius: 999, fontWeight: 700, background: level[1], color: level[2] }}>
                      {level[0]}
                    </span>
                  )}
                  {hasScore && (
                    <span style={{ marginLeft: 16 }}>Overall score <strong>{cert.overall_score}%</strong></span>
                  )}
                </div>

                {/* footer: signature, seal, date */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 22 }}>
                  <SignatureBlock line={'\u00A0'} label="Authorised signature" sub={cert.organisation} />
                  <Seal />
                  <SignatureBlock
                    line={formatDate(cert.issued_date)}
                    label="Date issued"
                    sub={cert.expiry_date ? `Valid until ${formatDate(cert.expiry_date)}` : 'No expiry date'}
                  />
                </div>

                {/* certificate number */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: 40, marginTop: 4, fontFamily: FONT_SANS }}>
                  <div>
                    <div style={{ fontSize: 10, color: '#64748B', letterSpacing: 1.2 }}>CERTIFICATE NO.</div>
                    <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: 1, fontFamily: 'ui-monospace, Menlo, Consolas, monospace', color: '#0F172A' }}>{cert.cert_code}</div>
                  </div>
                  {cert.department && (
                    <div>
                      <div style={{ fontSize: 10, color: '#64748B', letterSpacing: 1.2 }}>DEPARTMENT</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>{cert.department}</div>
                    </div>
                  )}
                </div>

                {notValid && (
                  <div style={{ marginTop: 14, fontFamily: FONT_SANS, fontWeight: 800, letterSpacing: 2, color: '#DC2626', textTransform: 'uppercase' }}>
                    {cert.effective_status}
                  </div>
                )}
              </div>

              {notValid && (
                <div aria-hidden="true" style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%) rotate(-24deg)', fontSize: 120, fontWeight: 800, color: 'rgba(220,38,38,0.18)', letterSpacing: 6, textTransform: 'uppercase', pointerEvents: 'none', whiteSpace: 'nowrap' }}>
                  {cert.effective_status}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}