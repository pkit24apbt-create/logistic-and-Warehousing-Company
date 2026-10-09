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

// ---- who signs the certificates (change these lines if needed) ----
// Leave the name empty ('') to print only the title under the signature.
const SIGNATORY_NAME = '';
const SIGNATORY_TITLE = 'Training Director';

// The real handwritten signature, traced as a vector shape (viewBox 420 x 307).
const SIGNATURE_PATH = 'M186 90 186 96 190 100 197 102 202 98 202 94 199 91 193 88 188 88ZM2 179 5 196 13 213 31 231 34 232 64 231 75 226 89 215 92 215 94 217 94 249 95 250 96 279 98 290 98 300 102 302 104 300 104 261 103 260 104 220 103 216 104 213 110 208 145 199 159 194 184 189 201 184 234 178 239 176 245 176 259 172 272 171 274 173 275 179 275 205 276 206 276 224 274 231 276 234 279 235 284 231 286 220 284 171 287 168 309 164 316 164 322 162 333 162 341 160 352 160 356 158 378 157 383 155 399 154 404 159 404 162 394 170 375 189 375 192 379 193 387 187 396 183 408 172 414 164 415 152 418 147 415 144 404 144 398 141 388 141 374 148 330 152 300 157 288 157 286 154 289 149 288 141 290 135 290 128 296 118 296 114 286 102 278 99 266 102 258 107 247 120 243 117 242 113 237 107 227 105 220 108 206 119 199 119 184 122 175 126 172 129 171 134 177 142 181 142 183 137 189 131 195 131 197 133 186 151 183 159 183 167 190 174 188 178 168 182 161 185 144 189 135 190 134 186 150 170 157 165 163 156 165 151 165 142 156 133 149 131 129 131 126 128 133 110 134 104 138 96 142 81 145 76 145 72 149 61 152 44 152 27 149 17 143 9 135 4 129 2 122 2 121 0 116 0 115 2 108 2 90 7 69 18 47 39 33 58 19 85 9 114 4 139 3 159 2 160ZM106 148 108 150 108 153 100 178 97 198 94 201 91 201 89 199 88 190 80 173 80 170 95 153 103 148ZM153 142 156 145 155 151 142 163 132 176 119 189 117 193 114 196 109 197 107 195 108 184 119 146 123 142 131 140 147 140ZM281 112 281 124 276 149 276 156 273 160 248 166 240 166 235 168 215 171 202 175 199 175 197 173 207 160 209 154 216 144 218 134 217 124 225 115 230 115 234 121 233 137 230 144 230 151 232 154 235 155 242 149 252 127 265 112 273 108 277 108ZM132 12 138 16 142 22 144 29 144 43 135 78 115 131 112 134 85 142 76 147 72 151 69 151 66 148 60 135 58 123 58 116 60 110 69 102 89 91 97 92 99 94 99 99 96 106 86 118 85 126 88 128 95 126 101 121 106 114 110 105 111 99 110 91 106 82 100 77 90 76 77 81 65 90 55 100 51 108 49 116 49 131 51 139 57 153 63 161 77 186 80 196 80 205 72 210 63 211 55 214 47 213 38 217 34 217 24 210 18 202 11 178 11 162 10 161 14 127 21 101 29 81 40 61 48 50 74 24 95 14 106 11 125 10Z';

function Signature() {
  return (
    <div style={{ height: 70, display: 'flex', justifyContent: 'center', alignItems: 'flex-end', paddingBottom: 4 }}>
      <svg height="62" viewBox="0 0 420 307" role="img" aria-label="Authorised signature" style={{ display: 'block' }}>
        <path d={SIGNATURE_PATH} fill="#1E3A8A" fillRule="evenodd" />
      </svg>
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

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 30, fontFamily: 'system-ui, sans-serif' }}>
            <div style={{ textAlign: 'center', width: 230 }}>
              <Signature />
              <div style={{ borderTop: '1px solid #0F172A', paddingTop: 6 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{SIGNATORY_NAME ? `${SIGNATORY_NAME}, ${SIGNATORY_TITLE}` : SIGNATORY_TITLE}</div>
                <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>Authorised signature</div>
                <div style={{ fontSize: 11, color: '#64748B' }}>{cert.organisation}</div>
              </div>
            </div>

            <Seal />

            <div style={{ textAlign: 'center', width: 230 }}>
              <div style={{ height: 70, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 6, fontFamily: 'Georgia, "Times New Roman", serif', fontSize: 19, fontWeight: 700, color: '#0F172A' }}>
                {formatDate(cert.issued_date)}
              </div>
              <div style={{ borderTop: '1px solid #0F172A', paddingTop: 6 }}>
                <div style={{ fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>Date issued</div>
                <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                  {cert.expiry_date ? `Valid until ${formatDate(cert.expiry_date)}` : 'No expiry date'}
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 44, marginTop: 24, fontFamily: 'system-ui, sans-serif' }}>
            <div>
              <div style={{ fontSize: 10, color: '#64748B', textTransform: 'uppercase', letterSpacing: 1 }}>Certificate no.</div>
              <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: 1, fontFamily: 'ui-monospace, Menlo, Consolas, monospace' }}>{cert.cert_code}</div>
            </div>
            {cert.department && (
              <div>
                <div style={{ fontSize: 10, color: '#64748B', textTransform: 'uppercase', letterSpacing: 1 }}>Department</div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{cert.department}</div>
              </div>
            )}
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