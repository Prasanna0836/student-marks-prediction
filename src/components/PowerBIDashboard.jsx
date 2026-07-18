import React, { useState } from 'react';
import { Database, HelpCircle } from 'lucide-react';

export default function PowerBIDashboard() {
  const [embedUrl, setEmbedUrl] = useState('');
  
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Power BI Integration</h1>
          <p className="page-subtitle">Embed and view your Microsoft Power BI reports directly in the dashboard portal.</p>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="card" style={{ gridColumn: 'span 12' }}>
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <Database size={20} style={{ color: 'var(--color-primary)' }} />
            Power BI Embed Console
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '1.5rem', marginTop: '0.5rem' }}>
            <label className="form-label" style={{ fontWeight: '600', fontSize: '0.85rem' }}>
              Paste your Power BI Publish-to-Web Embed URL or iframe code:
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                className="text-input"
                placeholder="e.g. https://app.powerbi.com/view?r=eyJr..."
                value={embedUrl}
                onChange={e => setEmbedUrl(e.target.value)}
                style={{ flexGrow: 1, padding: '0.55rem' }}
              />
              {embedUrl && (
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setEmbedUrl('')}
                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {embedUrl ? (
            <div style={{ 
              position: 'relative', 
              paddingBottom: '56.25%', // 16:9 Aspect Ratio
              height: 0, 
              overflow: 'hidden', 
              borderRadius: '8px', 
              border: '1px solid var(--border-color)',
              boxShadow: 'var(--shadow-sm)',
              backgroundColor: '#f8fafc'
            }}>
              <iframe
                title="Power BI Report"
                src={embedUrl.includes('iframe') ? (embedUrl.match(/src="([^"]+)"/) || [])[1] : embedUrl}
                frameBorder="0"
                allowFullScreen={true}
                style={{ 
                  position: 'absolute', 
                  top: 0, 
                  left: 0, 
                  width: '100%', 
                  height: '100%', 
                  border: 'none'
                }}
              />
            </div>
          ) : (
            <div style={{
              padding: '2.5rem',
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: '8px',
              border: '1px dotted var(--border-color)',
              textAlign: 'center'
            }}>
              <HelpCircle size={40} style={{ color: 'var(--color-primary)', margin: '0 auto 1rem' }} />
              <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                No Active Power BI Report Embedded
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: '500px', margin: '0 auto 1.5rem', lineHeight: '1.45' }}>
                To display a custom Power BI interactive dashboard here, follow these simple steps:
              </p>
              <div style={{ 
                textAlign: 'left', 
                maxWidth: '600px', 
                margin: '0 auto', 
                fontSize: '0.75rem', 
                color: 'var(--text-secondary)', 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '0.65rem',
                backgroundColor: 'white',
                padding: '1.25rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)'
              }}>
                <div><b>1. Load Dataset:</b> Open Microsoft Power BI Desktop and import our processed dataset <code>student-mat.csv</code> from the root folder.</div>
                <div><b>2. Build Visuals:</b> Create bar charts, scatter plots, or card gauges linking CIE grades, attendance, and study hours.</div>
                <div><b>3. Publish:</b> Publish your dashboard to your active Power BI Service workspace.</div>
                <div><b>4. Get Embed URL:</b> Select <i>File &rarr; Embed report &rarr; Publish to web (public)</i> and copy the URL link or iframe source. Paste the link in the input box above!</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
