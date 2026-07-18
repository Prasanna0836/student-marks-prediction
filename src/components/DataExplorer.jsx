import React, { useState, useMemo } from 'react';
import { Search, Plus, Upload, X, Filter, ChevronLeft, ChevronRight, HelpCircle, ArrowUpDown } from 'lucide-react';

export default function DataExplorer({ students, setStudents, onDataUpdate }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSex, setFilterSex] = useState('ALL');
  
  // Table Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  // Table Sorting
  const [sortField, setSortField] = useState('G3');
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc' | 'desc'

  // Modal open status
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  // Form state for adding custom student
  const [newStudent, setNewStudent] = useState({
    school: 'GP',
    sex: 'F',
    age: 16,
    address: 'U',
    famsize: 'GT3',
    Pstatus: 'T',
    Medu: 4,
    Fedu: 4,
    Mjob: 'other',
    Fjob: 'other',
    reason: 'course',
    guardian: 'mother',
    traveltime: 1,
    schoolsup: 'no',
    famsup: 'no',
    paid: 'no',
    activities: 'no',
    nursery: 'yes',
    higher: 'yes',
    internet: 'yes',
    romantic: 'no',
    famrel: 4,
    freetime: 3,
    goout: 3,
    Dalc: 1,
    Walc: 1,
    health: 3,
    G1: 22,
    G2: 22,
    G3: 50
  });

  // Drag and drop / file upload state
  const [dragActive, setDragActive] = useState(false);
  const [csvError, setCsvError] = useState('');

  // Handle Sort
  const handleSort = (field) => {
    const isAsc = sortField === field && sortOrder === 'asc';
    setSortField(field);
    setSortOrder(isAsc ? 'desc' : 'asc');
    setCurrentPage(1);
  };

  // Filter & Search student rows
  const filteredStudents = useMemo(() => {
    return students.filter(student => {
      // 1. Search term match (check school, sex, address, age)
      const searchStr = `${student.school || ''} ${student.sex || ''} ${student.age || ''} ${student.address || ''}`.toLowerCase();
      const matchesSearch = searchStr.includes(searchTerm.toLowerCase());

      // 2. Sex filter match
      const matchesSex = filterSex === 'ALL' || student.sex === filterSex;

      return matchesSearch && matchesSex;
    }).sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      // Convert to numbers if applicable
      if (typeof valA === 'string' && !isNaN(Number(valA))) valA = Number(valA);
      if (typeof valB === 'string' && !isNaN(Number(valB))) valB = Number(valB);

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [students, searchTerm, filterSex, sortField, sortOrder]);

  // Paginated chunk
  const paginatedStudents = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredStudents.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredStudents, currentPage]);

  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage) || 1;

  // Add custom student submit
  const handleAddSubmit = (e) => {
    e.preventDefault();
    
    // Parse form values
    const processedStudent = { ...newStudent };
    const numericKeys = ['age', 'Medu', 'Fedu', 'traveltime', 'famrel', 'freetime', 'goout', 'Dalc', 'Walc', 'health', 'G1', 'G2', 'G3'];
    numericKeys.forEach(k => {
      processedStudent[k] = Number(processedStudent[k]);
    });

    const updated = [processedStudent, ...students];
    setStudents(updated);
    onDataUpdate(updated);

    setNewStudent({
      school: 'GP', sex: 'F', age: 16, address: 'U', famize: 'GT3', Pstatus: 'T', Medu: 4, Fedu: 4,
      Mjob: 'other', Fjob: 'other', reason: 'course', guardian: 'mother', traveltime: 1,
      schoolsup: 'no', famsup: 'no', paid: 'no', activities: 'no', nursery: 'yes',
      higher: 'yes', internet: 'yes', romantic: 'no', famrel: 4, freetime: 3, goout: 3, Dalc: 1,
      Walc: 1, health: 3, G1: 22, G2: 22, G3: 50
    });
    setCurrentPage(1);
  };

  // CSV parsing logic
  const parseCSVData = (text) => {
    const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length === 0) throw new Error("File is empty.");

    // Detect separator: check counts of commas vs semicolons in header
    const header = lines[0];
    const sep = header.split(';').length > header.split(',').length ? ';' : ',';

    // Parse header keys
    // Strip quotes
    const headers = header.split(sep).map(h => h.replace(/^["']|["']$/g, '').trim());
    
    // Check if mandatory keys exist (G1, G2, G3)
    const normalizedHeaders = headers.map(h => h.toUpperCase());
    const g1Idx = normalizedHeaders.indexOf('G1');
    const g2Idx = normalizedHeaders.indexOf('G2');
    const g3Idx = normalizedHeaders.indexOf('G3');

    if (g1Idx === -1 || g2Idx === -1 || g3Idx === -1) {
      throw new Error("CSV must contain columns named 'G1', 'G2', and 'G3' (case-insensitive) representing exam marks.");
    }

    const parsedRecords = [];

    for (let i = 1; i < lines.length; i++) {
      // Handle comma/semicolon split with quote escaping (simple csv split)
      const line = lines[i];
      
      // Simple splitter: matches delimiters unless they are within quotes.
      // But since student performance dataset has no quoted delimiters, we can split directly
      const rawCols = line.split(sep);
      const cols = rawCols.map(c => c.replace(/^["']|["']$/g, '').trim());
      
      if (cols.length < headers.length) continue; // skip incomplete rows

      const rowObj = {};
      headers.forEach((h, idx) => {
        const rawVal = cols[idx];
        // Try to parse numeric
        if (!isNaN(Number(rawVal)) && rawVal !== '') {
          rowObj[h] = Number(rawVal);
        } else {
          rowObj[h] = rawVal;
        }
      });
      
      if (rowObj.G1 === undefined) rowObj.G1 = 20;
      if (rowObj.G2 === undefined) rowObj.G2 = 20;
      if (rowObj.G3 === undefined) rowObj.G3 = 50;

      parsedRecords.push(rowObj);
    }

    return parsedRecords;
  };

  const handleFileUpload = (file) => {
    if (!file) return;
    setCsvError('');

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const parsed = parseCSVData(text);
        
        if (parsed.length === 0) {
          throw new Error("No student records could be parsed from the file.");
        }

        setStudents(parsed);
        onDataUpdate(parsed);
        setIsUploadModalOpen(false);
        setCurrentPage(1);
      } catch (err) {
        setCsvError(err.message || "Failed to parse CSV file.");
      }
    };
    reader.onerror = () => {
      setCsvError("Error reading file.");
    };
    reader.readAsText(file);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  // Label formatting for G3 Classifications
  const getGradeClass = (g3) => {
    if (g3 >= 80) return { class: 'excellent', label: 'Excellent' };
    if (g3 >= 60) return { class: 'good', label: 'Good' };
    if (g3 >= 50) return { class: 'pass', label: 'Pass' };
    return { class: 'fail', label: 'Fail' };
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dataset Explorer</h1>
          <p className="page-subtitle">Inspect student profiles, search features, upload custom datasets, and append records.</p>
        </div>
      </div>

      <div className="card">
        {/* Table Filters & Actions */}
        <div className="table-actions">
          
          <div className="search-input-wrapper">
            <Search className="search-icon" />
            <input
              type="text"
              placeholder="Search by school, sex, age..."
              className="text-input"
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Filter Sex */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Filter size={14} style={{ color: 'var(--text-muted)' }} />
              <select 
                className="select-input" 
                value={filterSex} 
                onChange={e => { setFilterSex(e.target.value); setCurrentPage(1); }}
                style={{ padding: '0.4rem 2rem 0.4rem 0.6rem', fontSize: '0.8rem' }}
              >
                <option value="ALL">All Sexes</option>
                <option value="F">Female Only</option>
                <option value="M">Male Only</option>
              </select>
            </div>

            <div className="table-buttons">
              <button className="btn btn-secondary" onClick={() => setIsUploadModalOpen(true)}>
                <Upload size={16} />
                Upload CSV
              </button>
              <button className="btn btn-primary" onClick={() => setIsAddModalOpen(true)}>
                <Plus size={16} />
                Add Student
              </button>
            </div>
          </div>

        </div>

        {/* Paginated Table */}
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('school')}>School <ArrowUpDown size={12} style={{ marginLeft: '4px' }} /></th>
                <th onClick={() => handleSort('sex')}>Sex <ArrowUpDown size={12} style={{ marginLeft: '4px' }} /></th>
                <th onClick={() => handleSort('age')}>Age <ArrowUpDown size={12} style={{ marginLeft: '4px' }} /></th>
                <th onClick={() => handleSort('G1')}>CIE 1 <ArrowUpDown size={12} style={{ marginLeft: '4px' }} /></th>
                <th onClick={() => handleSort('G2')}>CIE 2 <ArrowUpDown size={12} style={{ marginLeft: '4px' }} /></th>
                <th onClick={() => handleSort('G3')}>SEE <ArrowUpDown size={12} style={{ marginLeft: '4px' }} /></th>
                <th>Classification</th>
              </tr>
            </thead>
            <tbody>
              {paginatedStudents.map((student, idx) => {
                const gradeInfo = getGradeClass(student.G3 || 0);
                return (
                  <tr key={idx}>
                    <td>{student.school === 'GP' ? 'Gabriel Pereira' : student.school === 'MS' ? 'Mousinho da Silveira' : student.school}</td>
                    <td>{student.sex}</td>
                    <td>{student.age} yrs</td>
                    <td><strong>{student.G1}</strong> / 40</td>
                    <td><strong>{student.G2}</strong> / 40</td>
                    <td><strong style={{ color: 'var(--color-primary)' }}>{student.G3}</strong> / 100</td>
                    <td>
                      <span className={`grade-badge ${gradeInfo.class}`}>
                        {gradeInfo.label}
                      </span>
                    </td>
                  </tr>
                );
              })}

              {paginatedStudents.length === 0 && (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    No students matching the filter search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="pagination">
          <div>
            Showing {filteredStudents.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} to {Math.min(currentPage * itemsPerPage, filteredStudents.length)} of {filteredStudents.length} entries
          </div>
          <div className="pagination-controls">
            <button
              className="btn btn-secondary"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              style={{ padding: '0.4rem 0.8rem', opacity: currentPage === 1 ? 0.5 : 1, cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
            >
              <ChevronLeft size={16} />
              Prev
            </button>
            <span style={{ display: 'flex', alignItems: 'center', padding: '0 0.5rem', fontWeight: '600' }}>
              Page {currentPage} of {totalPages}
            </span>
            <button
              className="btn btn-secondary"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              style={{ padding: '0.4rem 0.8rem', opacity: currentPage === totalPages ? 0.5 : 1, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}
            >
              Next
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

      </div>

      {/* MODAL 1: Add Custom Student */}
      {isAddModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Add New Student Record</h2>
              <button className="modal-close" onClick={() => setIsAddModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleAddSubmit}>
              <div className="modal-grid-2">
                <div className="form-group">
                  <label className="form-label">School</label>
                  <select 
                    className="select-input" 
                    value={newStudent.school}
                    onChange={e => setNewStudent({...newStudent, school: e.target.value})}
                  >
                    <option value="GP">GP (Gabriel Pereira)</option>
                    <option value="MS">MS (Mousinho da Silveira)</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label className="form-label">Sex</label>
                  <select 
                    className="select-input" 
                    value={newStudent.sex}
                    onChange={e => setNewStudent({...newStudent, sex: e.target.value})}
                  >
                    <option value="F">Female</option>
                    <option value="M">Male</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Age (15-22)</label>
                  <input
                    type="number"
                    min="15"
                    max="22"
                    className="text-input"
                    value={newStudent.age}
                    onChange={e => setNewStudent({...newStudent, age: e.target.value})}
                    required
                  />
                </div>



                <div className="form-group">
                  <label className="form-label">CIE 1 Grade</label>
                  <input
                    type="number"
                    min="0"
                    max="40"
                    className="text-input"
                    value={newStudent.G1}
                    onChange={e => setNewStudent({...newStudent, G1: e.target.value})}
                    style={{ borderColor: 'var(--color-info)' }}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">CIE 2 Grade</label>
                  <input
                    type="number"
                    min="0"
                    max="40"
                    className="text-input"
                    value={newStudent.G2}
                    onChange={e => setNewStudent({...newStudent, G2: e.target.value})}
                    style={{ borderColor: 'var(--color-info)' }}
                    required
                  />
                </div>

                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label" style={{ color: 'var(--color-primary)' }}>Actual SEE Grade</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className="text-input"
                    value={newStudent.G3}
                    onChange={e => setNewStudent({...newStudent, G3: e.target.value})}
                    style={{ borderColor: 'var(--color-primary)', fontWeight: '600' }}
                    required
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsAddModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Append Student
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Upload CSV */}
      {isUploadModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Upload Custom Student CSV Dataset</h2>
              <button className="modal-close" onClick={() => setIsUploadModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <div 
              className={`file-drop-zone ${dragActive ? 'active' : ''}`}
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => document.getElementById('csv-file-input').click()}
            >
              <Upload className="file-drop-icon" />
              <p className="file-drop-text">
                Drag and drop your dataset file here, or <span>browse files</span>
              </p>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                Accepts `.csv` tables.
              </p>
              <input
                id="csv-file-input"
                type="file"
                accept=".csv"
                style={{ display: 'none' }}
                onChange={e => handleFileUpload(e.target.files[0])}
              />
            </div>

            {csvError && (
              <div style={{ color: 'var(--color-danger)', fontSize: '0.8rem', marginTop: '1rem', backgroundColor: 'var(--color-danger-light)', padding: '0.5rem', borderRadius: '4px' }}>
                <strong>Error: </strong> {csvError}
              </div>
            )}

            <div style={{ marginTop: '1.5rem', padding: '0.75rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginBottom: '0.25rem', fontSize: '0.8rem' }}>
                <HelpCircle size={12} /> Format Guidelines:
              </h4>
              <p>The CSV must contain columns named <strong>G1</strong> (CIE 1, 0-40), <strong>G2</strong> (CIE 2, 0-40), and <strong>G3</strong> (SEE, 0-100) representing exam grades. The file can be comma (<code>,</code>) or semicolon (<code>;</code>) delimited.</p>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setIsUploadModalOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
