import React, { useState, useEffect } from 'react';
import useStore from '../store/useStore';
import { Search, Plus, Trash2, Printer, FileText, Package, Box, Truck } from 'lucide-react';

export default function GatePassPage() {
  const { addToast } = useStore();
  const [activeTab, setActiveTab] = useState('create'); // 'create' or 'history'
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Create State
  const [challanQuery, setChallanQuery] = useState('');
  const [challanResults, setChallanResults] = useState([]);
  const [selectedChallans, setSelectedChallans] = useState([]);
  const [polyBags, setPolyBags] = useState(0);
  const [cartons, setCartons] = useState(0);
  const [plasticBags, setPlasticBags] = useState(0);
  const [creating, setCreating] = useState(false);
  const [usedChallanIds, setUsedChallanIds] = useState(new Set());

  const loadUsedChallanIds = async () => {
    try {
      const res = await window.kadal.gatePass.getUsedChallanIds();
      if (res.success) setUsedChallanIds(new Set(res.data.map(Number)));
    } catch (e) {}
  };

  useEffect(() => {
    if (activeTab === 'history') loadHistory();
  }, [activeTab]);

  useEffect(() => {
    loadUsedChallanIds();
  }, []);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const res = await window.kadal.gatePass.getAll();
      if (res.success) setHistory(res.data);
    } catch (e) { addToast('error', 'Failed to load history'); }
    setLoading(false);
  };

  const searchChallans = async (q) => {
    setChallanQuery(q);
    // If query is empty, we show recent available challans
    try {
      const res = await window.kadal.challans.getAll({ 
        search: q, 
        status: 'ACTIVE',
        excludeUsedInGatePass: true
      });
      if (res.success) {
        setChallanResults(res.data.filter(c => !selectedChallans.find(sc => sc.id === c.id)));
      }
    } catch (e) {}
  };

  const addChallan = (challan) => {
    setSelectedChallans([...selectedChallans, challan]);
    setChallanQuery('');
    setChallanResults([]);
  };

  const removeChallan = (id) => {
    setSelectedChallans(selectedChallans.filter(c => c.id !== id));
  };

  const handleSave = async () => {
    if (selectedChallans.length === 0) {
      addToast('error', 'Please select at least one challan');
      return;
    }
    setCreating(true);
    try {
      const res = await window.kadal.gatePass.create({
        challanIds: selectedChallans.map(c => c.id),
        polyBags: parseInt(polyBags) || 0,
        cartons: parseInt(cartons) || 0,
        plasticBags: parseInt(plasticBags) || 0
      });
      if (res.success) {
        if (res.pendingApproval) {
          addToast('info', 'Gate Pass request sent for Admin approval');
        } else {
          addToast('success', `Gate Pass ${res.gatePassNumber} created!`);
          window.kadal.gatePass.exportPdf(res.id);
        }
        // Reset
        setSelectedChallans([]);
        setPolyBags(0);
        setCartons(0);
        setPlasticBags(0);
        loadUsedChallanIds(); // Refresh used IDs to hide them from search
      } else {
        addToast('error', res.error || 'Failed to create Gate Pass');
      }
    } catch (e) {
      addToast('error', 'An error occurred');
    }
    setCreating(false);
  };

  const exportPdf = (id) => {
    window.kadal.gatePass.exportPdf(id);
  };

  return (
    <div className="page-container">
      <div className="tabs">
        <button className={`tab ${activeTab === 'create' ? 'active' : ''}`} onClick={() => setActiveTab('create')}>Create Gate Pass</button>
        <button className={`tab ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>GP History</button>
      </div>

      {activeTab === 'create' ? (
        <div className="grid-2">
          <div className="card">
            <div className="card-header"><h3 className="card-title">Select Challans</h3></div>
            <div className="form-group" style={{ position: 'relative' }}>
              <label className="form-label">Search Challan Number</label>
              <div className="search-bar">
                <Search size={18} />
                <input 
                  className="form-input" 
                  placeholder="Type to search or click to see recent..." 
                  value={challanQuery} 
                  onChange={e => searchChallans(e.target.value)} 
                  onFocus={() => searchChallans(challanQuery)}
                />
              </div>
              {challanResults.length > 0 && (
                <div className="autocomplete-dropdown">
                  {challanResults.map(c => (
                    <div key={c.id} className="autocomplete-item" onClick={() => addChallan(c)}>
                      <div style={{ fontWeight: 600 }}>{c.challan_number}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.receiver_name} | {new Date(c.challan_date).toLocaleDateString()}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4">
              <label className="form-label">Selected Challans</label>
              {selectedChallans.length === 0 ? (
                <div className="empty-state-mini">No challans selected</div>
              ) : (
                <table className="data-table">
                  <thead><tr><th>No.</th><th>Receiver</th><th>Action</th></tr></thead>
                  <tbody>
                    {selectedChallans.map(c => (
                      <tr key={c.id}>
                        <td className="text-mono">{c.challan_number}</td>
                        <td>{c.receiver_name}</td>
                        <td><button className="btn btn-ghost btn-sm" onClick={() => removeChallan(c.id)}><Trash2 size={14} color="var(--danger)" /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header"><h3 className="card-title">Packaging Details</h3></div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label"><Box size={14} /> Poly Bags</label>
                <input type="number" className="form-input" value={polyBags} onChange={e => setPolyBags(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label"><Package size={14} /> Cartoon Boxes</label>
                <input type="number" className="form-input" value={cartons} onChange={e => setCartons(e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label"><Box size={14} /> Plastic Bags</label>
              <input type="number" className="form-input" value={plasticBags} onChange={e => setPlasticBags(e.target.value)} />
            </div>

            <div className="mt-4" style={{ paddingTop: 20, borderTop: '1px solid var(--border)' }}>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>Gate Pass Preview</div>
                <div style={{ padding: 15, background: 'var(--bg-tertiary)', borderRadius: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{ fontWeight: 600 }}>Total Challans:</span>
                    <span className="text-mono">{selectedChallans.length}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 600 }}>Total Packaging:</span>
                    <span className="text-mono">{(parseInt(polyBags)||0) + (parseInt(cartons)||0) + (parseInt(plasticBags)||0)} Units</span>
                  </div>
                </div>
              </div>
              <button 
                className="btn btn-primary btn-lg" 
                style={{ width: '100%' }} 
                onClick={handleSave}
                disabled={creating || selectedChallans.length === 0}
              >
                {creating ? <div className="spinner-small"></div> : <><Truck size={18} /> Create & Print Gate Pass</>}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-header"><h3 className="card-title">Gate Pass History</h3></div>
          {loading ? (
            <div className="loading"><div className="spinner"></div></div>
          ) : history.length === 0 ? (
            <div className="empty-state"><h3>No Gate Passes</h3><p>You haven't created any gate passes yet.</p></div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>GP Number</th>
                    <th>Date</th>
                    <th>Challans</th>
                    <th style={{ textAlign: 'center' }}>Poly</th>
                    <th style={{ textAlign: 'center' }}>Carton</th>
                    <th style={{ textAlign: 'center' }}>Plastic</th>
                    <th>Created By</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(gp => {
                    let cids = [];
                    try { cids = typeof gp.challan_ids === 'string' ? JSON.parse(gp.challan_ids) : gp.challan_ids; } catch (e) {}
                    return (
                      <tr key={gp.id}>
                        <td className="text-mono fw-bold" style={{ color: 'var(--accent)' }}>
                        {gp.gate_pass_number}
                        {gp.gate_pass_number?.includes('-REJ') && (
                          <span className="badge badge-danger" style={{ marginLeft: 6, fontSize: 10 }}>REJECTED</span>
                        )}
                      </td>
                        <td>{new Date(gp.created_at).toLocaleString('en-GB', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })}</td>
                        <td>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{cids.length} Challan(s)</div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>ID: {Array.isArray(cids) ? cids.join(', ') : '-'}</div>
                        </td>
                        <td className="text-center text-mono">{gp.poly_bags}</td>
                        <td className="text-center text-mono">{gp.cartons}</td>
                        <td className="text-center text-mono">{gp.plastic_bags}</td>
                        <td>{gp.created_by_name || 'System'}</td>
                        <td className="text-right">
                          <button className="btn btn-ghost btn-icon btn-sm" title="Print PDF" onClick={() => exportPdf(gp.id)}>
                            <Printer size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
