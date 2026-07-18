import React, { useState, useEffect } from 'react';
import { Sliders, BarChart, Database, GraduationCap } from 'lucide-react';
import Dashboard from './components/Dashboard';
import EDA from './components/EDA';
import DataExplorer from './components/DataExplorer';

import initialStudents from './data/students.json';
import { trainMultipleLinearRegression } from './utils/regression';

export default function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [students, setStudents] = useState([]);
  const [model, setModel] = useState(null);

  // Initialize students and model on start
  useEffect(() => {
    const scaledStudents = initialStudents.map(s => ({
      ...s,
      G1: (s.G1 || 0) * 2,
      G2: (s.G2 || 0) * 2,
      G3: (s.G3 || 0) * 5
    }));
    setStudents(scaledStudents);
    const trained = trainMultipleLinearRegression(scaledStudents, ['G1', 'G2']);
    if (trained) {
      setModel(trained);
    }
  }, []);

  // Recalculates model when the dataset changes (e.g. upload CSV or add manually)
  const handleDataUpdate = (newDataset) => {
    // Keep currently selected features if possible, otherwise default to G1 and G2
    const currentFeatures = model ? Object.keys(model.coefficients) : ['G1', 'G2'];
    const trained = trainMultipleLinearRegression(newDataset, currentFeatures);
    if (trained) {
      setModel(trained);
    }
  };

  const renderPage = () => {
    if (students.length === 0 || !model) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
          <div style={{
            border: '4px solid var(--border-color)',
            borderTop: '4px solid var(--color-primary)',
            borderRadius: '50%',
            width: '40px',
            height: '40px',
            animation: 'spin 1s linear infinite'
          }} />
          <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Loading student records and regression model...</p>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      );
    }

    switch (currentPage) {
      case 'dashboard':
        return <Dashboard students={students} model={model} setModel={setModel} />;
      case 'eda':
        return <EDA students={students} model={model} />;
      case 'explorer':
        return <DataExplorer students={students} setStudents={setStudents} onDataUpdate={handleDataUpdate} />;
      default:
        return <Dashboard students={students} model={model} setModel={setModel} />;
    }
  };

  return (
    <div className="app-container">
      {/* Sidebar navigation */}
      <aside className="sidebar">
        <div className="brand-section">
          <div className="brand-icon">
            <GraduationCap size={22} style={{ color: 'white' }} />
          </div>
          <div className="brand-name">
            Explainable AI
            <span>Student Performance Prediction</span>
          </div>
        </div>

        <nav style={{ flexGrow: 1 }}>
          <ul className="nav-links">
            <li>
              <button
                onClick={() => setCurrentPage('dashboard')}
                className={`nav-item ${currentPage === 'dashboard' ? 'active' : ''}`}
                style={{ width: '100%', border: 'none', background: 'none', textAlign: 'left' }}
              >
                <Sliders />
                <span>Predictor</span>
              </button>
            </li>
            <li>
              <button
                onClick={() => setCurrentPage('eda')}
                className={`nav-item ${currentPage === 'eda' ? 'active' : ''}`}
                style={{ width: '100%', border: 'none', background: 'none', textAlign: 'left' }}
              >
                <BarChart />
                <span>Data Analytics (EDA)</span>
              </button>
            </li>

            <li>
              <button
                onClick={() => setCurrentPage('explorer')}
                className={`nav-item ${currentPage === 'explorer' ? 'active' : ''}`}
                style={{ width: '100%', border: 'none', background: 'none', textAlign: 'left' }}
              >
                <Database />
                <span>Dataset Explorer</span>
              </button>
            </li>
          </ul>
        </nav>

        <div className="sidebar-footer">
          <div className="dataset-badge">
            <span>Dataset size</span>
            <span className="dataset-count">{students.length}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <span>Explainable AI Predictor v1.0</span>
          </div>
        </div>
      </aside>

      {/* Main content display */}
      <main className="main-content">
        {renderPage()}
      </main>
    </div>
  );
}
