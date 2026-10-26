import React, { useState, useEffect, useCallback } from 'react';
import { 
  Trophy, 
  Shield, 
  UserCheck, 
  Lock, 
  Unlock, 
  Gamepad2, 
  Sparkles, 
  Users, 
  CheckCircle2, 
  AlertCircle,
  Settings,
  Flame,
  RotateCcw,
  Edit3,
  Trash2,
  UserPlus,
  Check,
  X,
  Search,
  Filter,
  Link as LinkIcon,
  RefreshCw,
  Server
} from 'lucide-react';
import { 
  DEFAULT_WEBHOOK_URL, 
  fetchSlotsFromWebhook, 
  postSlotUpdateToWebhook 
} from './webhookService';

const TOTAL_SLOTS = 12;

// Initial 12 slots template
const generateInitialSlots = () => {
  return Array.from({ length: TOTAL_SLOTS }, (_, i) => ({
    slotNumber: i + 1,
    teamName: '',
    iglName: '',
    isBooked: false,
  }));
};

export default function App() {
  // Sync view state with URL hash (#/admin or #/player)
  const getInitialView = () => {
    const hash = window.location.hash.toLowerCase();
    if (hash.includes('admin')) return 'admin';
    return 'player';
  };

  const [activeView, setActiveView] = useState(getInitialView);
  
  // Google Apps Script Webhook URL configuration
  const [webhookUrl, setWebhookUrl] = useState(() => {
    return localStorage.getItem('nexus_gas_webhook_url') || DEFAULT_WEBHOOK_URL;
  });
  const [webhookInputDraft, setWebhookInputDraft] = useState(webhookUrl);
  
  // Backend sync status: 'idle' | 'syncing' | 'connected' | 'error' | 'local'
  const [syncStatus, setSyncStatus] = useState('idle');
  const [lastSyncedTime, setLastSyncedTime] = useState(null);

  // 12 Tournament Slots State
  const [slots, setSlots] = useState(() => {
    const saved = localStorage.getItem('nexus_tournament_slots');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === TOTAL_SLOTS) {
          return parsed;
        }
      } catch (e) {
        console.error('Failed to parse saved slots', e);
      }
    }
    return generateInitialSlots();
  });

  // Player view form states & errors
  const [draftInputs, setDraftInputs] = useState({});
  const [errors, setErrors] = useState({});

  // Admin states: editing / assigning / filters / search
  const [editingSlots, setEditingSlots] = useState({});
  const [assigningSlots, setAssigningSlots] = useState({});
  const [adminFilter, setAdminFilter] = useState('all'); // 'all' | 'booked' | 'open'
  const [adminSearch, setAdminSearch] = useState('');

  // Toast notification state: { text, type: 'info' | 'error' }
  const [toast, setToast] = useState(null);

  const showToast = (text, type = 'info') => {
    setToast({ text, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Sync slots to localStorage as resilient offline cache
  useEffect(() => {
    localStorage.setItem('nexus_tournament_slots', JSON.stringify(slots));
  }, [slots]);

  // Synchronize URL hash with active view & listen to hash changes
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.toLowerCase();
      if (hash.includes('admin')) {
        setActiveView('admin');
      } else {
        setActiveView('player');
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const switchView = (view) => {
    setActiveView(view);
    window.location.hash = `#/${view}`;
  };

  /* ========================================================
     API LOGIC: ON LOAD (GET)
     Send GET request to webhook to fetch slots and populate UI
     ======================================================== */
  const loadSlotsFromBackend = useCallback(async (targetUrl = webhookUrl) => {
    if (!targetUrl || !targetUrl.trim()) {
      setSyncStatus('local');
      return;
    }

    setSyncStatus('syncing');
    try {
      const remoteSlots = await fetchSlotsFromWebhook(targetUrl);
      if (remoteSlots && remoteSlots.length === TOTAL_SLOTS) {
        setSlots(remoteSlots);
        setSyncStatus('connected');
        setLastSyncedTime(new Date().toLocaleTimeString());
        showToast('☁️ Synced 12 slots with Google Apps Script backend');
      } else {
        throw new Error('Received unexpected slot count');
      }
    } catch (err) {
      console.warn('Webhook GET load warning:', err.message);
      setSyncStatus('error');
      // Gracefully fall back to local cached slots
    }
  }, [webhookUrl]);

  // Execute GET on initial mount
  useEffect(() => {
    loadSlotsFromBackend();
  }, [loadSlotsFromBackend]);

  // Save new Webhook URL
  const handleSaveWebhookUrl = () => {
    const cleanUrl = webhookInputDraft.trim();
    setWebhookUrl(cleanUrl);
    localStorage.setItem('nexus_gas_webhook_url', cleanUrl);
    showToast(cleanUrl ? 'Webhook URL saved. Testing connection...' : 'Webhook URL cleared (Local Mode)');
    loadSlotsFromBackend(cleanUrl);
  };

  /* ========================================================
     AUTO-SAVE (POST) HELPER
     Fires a POST request with:
     { slotNumber, teamName, iglName, actionType }
     ======================================================== */
  const triggerAutoSave = async (slotNumber, teamName, iglName, actionType) => {
    if (!webhookUrl || !webhookUrl.trim()) {
      return; // Working in local mode
    }

    setSyncStatus('syncing');
    try {
      await postSlotUpdateToWebhook(webhookUrl, {
        slotNumber,
        teamName,
        iglName,
        actionType
      });
      setSyncStatus('connected');
      setLastSyncedTime(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('Webhook POST auto-save failed:', err);
      setSyncStatus('error');
      showToast(`⚠️ Auto-save POST failed: ${err.message}`, 'error');
    }
  };

  /* ========================================================
     PLAYER VIEW LOGIC & LOCKING VALIDATION
     ======================================================== */
  const handleInputChange = (slotNumber, field, value) => {
    setDraftInputs(prev => ({
      ...prev,
      [slotNumber]: {
        ...prev[slotNumber],
        [field]: value
      }
    }));
    if (errors[slotNumber]) {
      setErrors(prev => ({ ...prev, [slotNumber]: null }));
    }
  };

  const handleClaimSlot = async (slotNumber) => {
    // LOCKING VALIDATION: Verify locally that the slot is still isBooked: false
    const targetSlot = slots.find(s => s.slotNumber === slotNumber);
    if (!targetSlot || targetSlot.isBooked) {
      showToast('❌ Slot already taken! Please choose another slot.', 'error');
      setErrors(prev => ({
        ...prev,
        [slotNumber]: 'Slot already taken by another team!'
      }));
      return;
    }

    const currentDraft = draftInputs[slotNumber] || {};
    const teamName = (currentDraft.teamName || '').trim();
    const iglName = (currentDraft.iglName || '').trim();

    if (!teamName || !iglName) {
      setErrors(prev => ({
        ...prev,
        [slotNumber]: 'Both Team Name & IGL Name are required!'
      }));
      return;
    }

    // Instantly update UI (optimistic update)
    setSlots(prevSlots =>
      prevSlots.map(slot =>
        slot.slotNumber === slotNumber
          ? { ...slot, teamName, iglName, isBooked: true }
          : slot
      )
    );

    // Clear draft form inputs
    setDraftInputs(prev => {
      const next = { ...prev };
      delete next[slotNumber];
      return next;
    });

    showToast(`⚔️ Slot #${slotNumber} locked for "${teamName}"!`);

    // AUTO-SAVE (POST): Send actionType: 'CLAIM'
    await triggerAutoSave(slotNumber, teamName, iglName, 'CLAIM');
  };

  /* ========================================================
     ADMIN PANEL ACTIONS (EDIT, CLEAR, MANUAL ASSIGN)
     ======================================================== */

  // 1. Edit booked slot
  const startEditing = (slot) => {
    setEditingSlots(prev => ({
      ...prev,
      [slot.slotNumber]: {
        teamName: slot.teamName,
        iglName: slot.iglName,
        error: ''
      }
    }));
  };

  const cancelEditing = (slotNumber) => {
    setEditingSlots(prev => {
      const next = { ...prev };
      delete next[slotNumber];
      return next;
    });
  };

  const handleEditChange = (slotNumber, field, value) => {
    setEditingSlots(prev => ({
      ...prev,
      [slotNumber]: {
        ...prev[slotNumber],
        [field]: value,
        error: ''
      }
    }));
  };

  const saveEditSlot = async (slotNumber) => {
    const editData = editingSlots[slotNumber];
    if (!editData) return;

    const teamName = (editData.teamName || '').trim();
    const iglName = (editData.iglName || '').trim();

    if (!teamName || !iglName) {
      setEditingSlots(prev => ({
        ...prev,
        [slotNumber]: {
          ...prev[slotNumber],
          error: 'Team Name and IGL Name cannot be blank!'
        }
      }));
      return;
    }

    // Update state locally
    setSlots(prevSlots =>
      prevSlots.map(slot =>
        slot.slotNumber === slotNumber
          ? { ...slot, teamName, iglName, isBooked: true }
          : slot
      )
    );

    cancelEditing(slotNumber);
    showToast(`✅ Slot #${slotNumber} updated to "${teamName}"`);

    // AUTO-SAVE (POST): Send actionType: 'EDIT'
    await triggerAutoSave(slotNumber, teamName, iglName, 'EDIT');
  };

  // 2. Clear / Delete slot
  const handleClearSlot = async (slotNumber) => {
    // Immediately reset isBooked to false and wipe team data
    setSlots(prevSlots =>
      prevSlots.map(slot =>
        slot.slotNumber === slotNumber
          ? {
              slotNumber,
              teamName: '',
              iglName: '',
              isBooked: false,
            }
          : slot
      )
    );

    cancelEditing(slotNumber);
    cancelAssigning(slotNumber);
    showToast(`🗑️ Slot #${slotNumber} cleared & reopened on Player View!`);

    // AUTO-SAVE (POST): Send actionType: 'CLEAR'
    await triggerAutoSave(slotNumber, '', '', 'CLEAR');
  };

  // 3. Manual assign to empty slot
  const startAssigning = (slotNumber) => {
    setAssigningSlots(prev => ({
      ...prev,
      [slotNumber]: {
        teamName: '',
        iglName: '',
        error: ''
      }
    }));
  };

  const cancelAssigning = (slotNumber) => {
    setAssigningSlots(prev => {
      const next = { ...prev };
      delete next[slotNumber];
      return next;
    });
  };

  const handleAssignChange = (slotNumber, field, value) => {
    setAssigningSlots(prev => ({
      ...prev,
      [slotNumber]: {
        ...prev[slotNumber],
        [field]: value,
        error: ''
      }
    }));
  };

  const saveManualAssign = async (slotNumber) => {
    const assignData = assigningSlots[slotNumber];
    if (!assignData) return;

    const teamName = (assignData.teamName || '').trim();
    const iglName = (assignData.iglName || '').trim();

    if (!teamName || !iglName) {
      setAssigningSlots(prev => ({
        ...prev,
        [slotNumber]: {
          ...prev[slotNumber],
          error: 'Both Team Name & IGL Name are required!'
        }
      }));
      return;
    }

    setSlots(prevSlots =>
      prevSlots.map(slot =>
        slot.slotNumber === slotNumber
          ? { ...slot, teamName, iglName, isBooked: true }
          : slot
      )
    );

    cancelAssigning(slotNumber);
    showToast(`⚡ Admin assigned "${teamName}" to Slot #${slotNumber}`);

    // AUTO-SAVE (POST): Send actionType: 'MANUAL_ASSIGN'
    await triggerAutoSave(slotNumber, teamName, iglName, 'MANUAL_ASSIGN');
  };

  // 4. Reset entire tournament
  const handleResetAll = async () => {
    if (window.confirm('Are you sure you want to reset all 12 tournament slots?')) {
      const fresh = generateInitialSlots();
      setSlots(fresh);
      setDraftInputs({});
      setErrors({});
      setEditingSlots({});
      setAssigningSlots({});
      showToast('Tournament grid has been completely wiped and reset.');

      // AUTO-SAVE (POST): Send actionType: 'RESET_ALL'
      await triggerAutoSave(0, '', '', 'RESET_ALL');
    }
  };

  // Metrics
  const bookedCount = slots.filter(s => s.isBooked).length;
  const availableCount = TOTAL_SLOTS - bookedCount;

  // Filter & Search for Admin Master Dashboard
  const filteredSlots = slots.filter(slot => {
    if (adminFilter === 'booked' && !slot.isBooked) return false;
    if (adminFilter === 'open' && slot.isBooked) return false;

    if (adminSearch.trim() !== '') {
      const q = adminSearch.toLowerCase();
      const matchSlot = String(slot.slotNumber).includes(q);
      const matchTeam = slot.teamName.toLowerCase().includes(q);
      const matchIgl = slot.iglName.toLowerCase().includes(q);
      return matchSlot || matchTeam || matchIgl;
    }
    return true;
  });

  return (
    <div className="app-container">
      {/* Toast Notification Banner */}
      {toast && (
        <div className={`toast-banner ${toast.type === 'error' ? 'error' : ''}`}>
          {toast.type === 'error' ? (
            <AlertCircle size={20} color="#f87171" />
          ) : (
            <Sparkles size={20} color="#00f2fe" />
          )}
          <span>{toast.text}</span>
        </div>
      )}

      {/* Main Top Header */}
      <header className="app-header glass-panel">
        <div className="brand-section">
          <div className="brand-icon-wrapper">
            <Trophy size={28} />
          </div>
          <div>
            <h1 className="brand-title">NEXUS ARENA</h1>
            <p className="brand-subtitle">12-Slot Championship Registration System</p>
          </div>
        </div>

        <div className="header-actions-group">
          {/* Webhook Sync Status Pill */}
          <div 
            className={`sync-status-pill ${
              syncStatus === 'connected' ? 'connected' :
              syncStatus === 'syncing' ? 'syncing' :
              syncStatus === 'error' ? 'error' : 'local'
            }`}
            title={lastSyncedTime ? `Last synced: ${lastSyncedTime}` : 'Cloud sync status'}
          >
            {syncStatus === 'syncing' ? (
              <RefreshCw size={13} className="spin" />
            ) : (
              <span className={`status-dot ${
                syncStatus === 'connected' ? 'green' : 
                syncStatus === 'syncing' ? 'cyan' : 'amber'
              }`} />
            )}
            <span>
              {syncStatus === 'connected' ? 'BACKEND SYNCED' :
               syncStatus === 'syncing' ? 'SYNCING...' :
               syncStatus === 'error' ? 'SYNC ISSUE (LOCAL ACTIVE)' : 'LOCAL MODE'}
            </span>
          </div>

          {/* Quick Manual Refresh button */}
          {webhookUrl && (
            <button 
              type="button"
              className="action-chip cancel"
              onClick={() => loadSlotsFromBackend()}
              title="Refresh slots from backend"
              style={{ padding: '8px 12px' }}
            >
              <RefreshCw size={14} className={syncStatus === 'syncing' ? 'spin' : ''} />
            </button>
          )}

          {/* View Switcher: Player View vs Admin Panel */}
          <nav className="view-toggle-nav">
            <button 
              type="button"
              className={`nav-tab-btn ${activeView === 'player' ? 'active' : ''}`}
              onClick={() => switchView('player')}
              title="Switch to Player Registration View"
            >
              <Gamepad2 size={18} />
              Player View
            </button>
            <button 
              type="button"
              className={`nav-tab-btn ${activeView === 'admin' ? 'active' : ''}`}
              onClick={() => switchView('admin')}
              title="Switch to Admin Management Panel (URL: #/admin)"
            >
              <Settings size={18} />
              Admin Panel
            </button>
          </nav>
        </div>
      </header>

      {/* Tournament Live Metrics Ribbon */}
      <section className="stats-ribbon">
        <div className="stat-card glass-panel total">
          <div className="stat-icon" style={{ color: '#00f2fe' }}>
            <Users size={22} />
          </div>
          <div className="stat-info">
            <div className="stat-label">Total Tournament Slots</div>
            <div className="stat-value">{TOTAL_SLOTS}</div>
          </div>
        </div>

        <div className="stat-card glass-panel booked">
          <div className="stat-icon" style={{ color: '#ff2a85' }}>
            <Lock size={22} />
          </div>
          <div className="stat-info">
            <div className="stat-label">Booked Slots</div>
            <div className="stat-value">{bookedCount}</div>
          </div>
        </div>

        <div className="stat-card glass-panel available">
          <div className="stat-icon" style={{ color: '#10b981' }}>
            <Unlock size={22} />
          </div>
          <div className="stat-info">
            <div className="stat-label">Available Slots</div>
            <div className="stat-value">{availableCount}</div>
          </div>
        </div>

        <div className="stat-card glass-panel status">
          <div className="stat-icon" style={{ color: '#9d4edd' }}>
            <Flame size={22} />
          </div>
          <div className="stat-info">
            <div className="stat-label">Registration Status</div>
            <div className="stat-value" style={{ fontSize: '1.15rem' }}>
              {availableCount === 0 ? 'ROSTER FULL' : 'REGISTRATION LIVE'}
            </div>
          </div>
        </div>
      </section>

      {/* Conditional View Rendering */}
      {activeView === 'player' ? (
        /* ========================================================
           PLAYER VIEW
           ======================================================== */
        <main>
          <div className="slots-section-header">
            <h2 className="section-title">
              <span>//</span> Tournament Grid Roster
            </h2>
            <div style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
              Select any unlocked slot below to register your squad
            </div>
          </div>

          {/* 12 Slots Grid */}
          <div className="slots-grid">
            {slots.map((slot) => {
              const isClaimed = slot.isBooked;
              const draft = draftInputs[slot.slotNumber] || { teamName: '', iglName: '' };
              const error = errors[slot.slotNumber];

              return (
                <div 
                  key={slot.slotNumber} 
                  className={`slot-card glass-panel ${isClaimed ? 'booked' : 'available'}`}
                >
                  {/* Slot Card Header */}
                  <div className="slot-card-top">
                    <div className="slot-number-badge">
                      <Shield size={20} />
                      SLOT {String(slot.slotNumber).padStart(2, '0')}
                    </div>
                    {isClaimed ? (
                      <span className="slot-status-pill claimed">
                        <Lock size={12} />
                        BOOKED
                      </span>
                    ) : (
                      <span className="slot-status-pill open">
                        <Unlock size={12} />
                        OPEN
                      </span>
                    )}
                  </div>

                  {/* Slot Content: Locked vs Open */}
                  {isClaimed ? (
                    <div className="booked-content">
                      <div className="locked-banner">
                        <Lock size={14} color="#f472b6" />
                        <span>Slot Locked & Verified</span>
                      </div>

                      {/* Display registered teamName prominently */}
                      <div className="booked-team-display">
                        <div className="display-field-group">
                          <span className="field-label-mini">
                            <Shield size={12} /> Registered Team
                          </span>
                          <div className="team-name-value">{slot.teamName}</div>
                        </div>

                        <div className="display-field-group">
                          <span className="field-label-mini">
                            <UserCheck size={12} /> In-Game Leader (IGL)
                          </span>
                          <div className="igl-name-value">{slot.iglName || 'N/A'}</div>
                        </div>
                      </div>

                      {/* Locked and disabled input fields preview */}
                      <div className="locked-inputs-section">
                        <div className="form-group">
                          <label className="form-label" htmlFor={`team-locked-${slot.slotNumber}`}>
                            Team Name
                          </label>
                          <input 
                            id={`team-locked-${slot.slotNumber}`}
                            type="text" 
                            className="form-input disabled" 
                            value={slot.teamName} 
                            disabled 
                            readOnly
                          />
                        </div>

                        <div className="form-group">
                          <label className="form-label" htmlFor={`igl-locked-${slot.slotNumber}`}>
                            IGL Name
                          </label>
                          <input 
                            id={`igl-locked-${slot.slotNumber}`}
                            type="text" 
                            className="form-input disabled" 
                            value={slot.iglName} 
                            disabled 
                            readOnly
                          />
                        </div>

                        <button type="button" className="locked-btn" disabled>
                          <Lock size={16} /> Slot Claimed
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Clean UI with inputs and Claim Slot button */
                    <div className="active-form-content">
                      <div className="form-group" style={{ marginBottom: '12px' }}>
                        <label className="form-label" htmlFor={`team-input-${slot.slotNumber}`}>
                          Team Name
                        </label>
                        <input 
                          id={`team-input-${slot.slotNumber}`}
                          type="text" 
                          className="form-input" 
                          placeholder="e.g. Sentinels, Fnatic..."
                          value={draft.teamName}
                          onChange={(e) => handleInputChange(slot.slotNumber, 'teamName', e.target.value)}
                        />
                      </div>

                      <div className="form-group" style={{ marginBottom: '14px' }}>
                        <label className="form-label" htmlFor={`igl-input-${slot.slotNumber}`}>
                          IGL Name
                        </label>
                        <input 
                          id={`igl-input-${slot.slotNumber}`}
                          type="text" 
                          className="form-input" 
                          placeholder="e.g. Boaster, TenZ..."
                          value={draft.iglName}
                          onChange={(e) => handleInputChange(slot.slotNumber, 'iglName', e.target.value)}
                        />
                      </div>

                      {error && (
                        <div className="error-text" style={{ marginBottom: '10px' }}>
                          <AlertCircle size={14} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '4px' }} />
                          {error}
                        </div>
                      )}

                      <button 
                        type="button"
                        className="claim-btn"
                        onClick={() => handleClaimSlot(slot.slotNumber)}
                      >
                        <CheckCircle2 size={18} />
                        Claim Slot {slot.slotNumber}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </main>
      ) : (
        /* ========================================================
           ADMIN PANEL (Prompt 2 & 3: Master Lobby & Backend Webhook)
           ======================================================== */
        <main className="admin-panel-container glass-panel">
          {/* Header */}
          <div className="admin-header">
            <div className="admin-title-area">
              <h2>Master Dashboard // Lobby Controller</h2>
              <p>
                Manage all 12 slots, edit team typos, clear slots, assign squads, and link your Google Apps Script backend.
              </p>
            </div>
            <div>
              <button 
                type="button"
                className="action-chip reset" 
                onClick={handleResetAll}
                style={{ padding: '10px 18px', display: 'flex', alignItems: 'center', gap: '8px' }}
                title="Wipe all 12 slots back to empty"
              >
                <RotateCcw size={16} /> Reset All 12 Slots
              </button>
            </div>
          </div>

          {/* Webhook Backend Integration Card (Prompt 3) */}
          <div className="webhook-config-box">
            <div className="webhook-config-header">
              <div className="webhook-config-title">
                <Server size={18} />
                Google Apps Script Webhook URL
              </div>
              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                Auto-saves GET (load) & POST (mutations) to your Google Drive / Sheet
              </span>
            </div>

            <div className="webhook-input-group">
              <input 
                type="text"
                className="webhook-input"
                placeholder="https://script.google.com/macros/s/.../exec"
                value={webhookInputDraft}
                onChange={(e) => setWebhookInputDraft(e.target.value)}
              />
              <button 
                type="button"
                className="action-chip save"
                onClick={handleSaveWebhookUrl}
              >
                <LinkIcon size={14} /> Connect Webhook
              </button>
              {webhookUrl && (
                <button 
                  type="button"
                  className="action-chip cancel"
                  onClick={() => loadSlotsFromBackend()}
                  title="Force refresh now via GET"
                >
                  <RefreshCw size={14} className={syncStatus === 'syncing' ? 'spin' : ''} /> Fetch Now
                </button>
              )}
            </div>
          </div>

          {/* Admin Filter & Search Bar */}
          <div className="admin-controls-bar">
            <div className="admin-filter-group">
              <span style={{ fontSize: '0.85rem', color: '#94a3b8', marginRight: '6px', fontWeight: 600 }}>
                <Filter size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                Filter:
              </span>
              <button
                type="button"
                className={`filter-pill ${adminFilter === 'all' ? 'active' : ''}`}
                onClick={() => setAdminFilter('all')}
              >
                All Slots ({TOTAL_SLOTS})
              </button>
              <button
                type="button"
                className={`filter-pill ${adminFilter === 'booked' ? 'active' : ''}`}
                onClick={() => setAdminFilter('booked')}
              >
                Booked ({bookedCount})
              </button>
              <button
                type="button"
                className={`filter-pill ${adminFilter === 'open' ? 'active' : ''}`}
                onClick={() => setAdminFilter('open')}
              >
                Open ({availableCount})
              </button>
            </div>

            <div className="admin-search-wrapper">
              <Search size={16} className="admin-search-icon" />
              <input 
                type="text"
                className="admin-search-input"
                placeholder="Search slot #, team or IGL..."
                value={adminSearch}
                onChange={(e) => setAdminSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Master Dashboard Cards Grid */}
          <div className="admin-cards-grid">
            {filteredSlots.map((slot) => {
              const isEditing = Boolean(editingSlots[slot.slotNumber]);
              const editData = editingSlots[slot.slotNumber] || {};
              const isAssigning = Boolean(assigningSlots[slot.slotNumber]);
              const assignData = assigningSlots[slot.slotNumber] || {};

              return (
                <div 
                  key={slot.slotNumber}
                  className={`admin-slot-row-card ${isEditing ? 'is-editing' : ''} ${isAssigning ? 'is-assigning' : ''}`}
                >
                  {/* Slot Header */}
                  <div className="admin-slot-header">
                    <div className="admin-slot-num">
                      <Shield size={18} color={slot.isBooked ? '#ff2a85' : '#00f2fe'} />
                      SLOT #{String(slot.slotNumber).padStart(2, '0')}
                    </div>
                    {slot.isBooked ? (
                      <span className="slot-status-pill claimed">
                        <Lock size={12} /> BOOKED
                      </span>
                    ) : (
                      <span className="slot-status-pill open">
                        <Unlock size={12} /> OPEN
                      </span>
                    )}
                  </div>

                  {/* Body: Editing Form vs Assigning Form vs Regular Display */}
                  {isEditing ? (
                    /* Inline Editing Mode (Fix Typos in Team Name / IGL) */
                    <div className="admin-inline-form">
                      <div style={{ fontSize: '0.8rem', color: '#fbbf24', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>
                        ✏️ Edit Slot Details
                      </div>

                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: '0.78rem' }}>
                          Team Name
                        </label>
                        <input 
                          type="text"
                          className="admin-inline-input"
                          value={editData.teamName}
                          onChange={(e) => handleEditChange(slot.slotNumber, 'teamName', e.target.value)}
                          placeholder="Team Name"
                          autoFocus
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: '0.78rem' }}>
                          IGL Name
                        </label>
                        <input 
                          type="text"
                          className="admin-inline-input"
                          value={editData.iglName}
                          onChange={(e) => handleEditChange(slot.slotNumber, 'iglName', e.target.value)}
                          placeholder="IGL Name"
                        />
                      </div>

                      {editData.error && (
                        <div className="error-text">
                          <AlertCircle size={13} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '4px' }} />
                          {editData.error}
                        </div>
                      )}

                      <div className="admin-actions-group">
                        <button 
                          type="button"
                          className="action-chip save"
                          onClick={() => saveEditSlot(slot.slotNumber)}
                        >
                          <Check size={14} /> Save
                        </button>
                        <button 
                          type="button"
                          className="action-chip cancel"
                          onClick={() => cancelEditing(slot.slotNumber)}
                        >
                          <X size={14} /> Cancel
                        </button>
                      </div>
                    </div>
                  ) : isAssigning ? (
                    /* Manual Assign Form for Empty Slot */
                    <div className="admin-inline-form">
                      <div style={{ fontSize: '0.8rem', color: '#34d399', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>
                        ⚡ Manual Assign Slot
                      </div>

                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: '0.78rem' }}>
                          Assign Team Name
                        </label>
                        <input 
                          type="text"
                          className="admin-inline-input"
                          value={assignData.teamName}
                          onChange={(e) => handleAssignChange(slot.slotNumber, 'teamName', e.target.value)}
                          placeholder="Enter Team Name"
                          autoFocus
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: '0.78rem' }}>
                          Assign IGL Name
                        </label>
                        <input 
                          type="text"
                          className="admin-inline-input"
                          value={assignData.iglName}
                          onChange={(e) => handleAssignChange(slot.slotNumber, 'iglName', e.target.value)}
                          placeholder="Enter IGL Name"
                        />
                      </div>

                      {assignData.error && (
                        <div className="error-text">
                          <AlertCircle size={13} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '4px' }} />
                          {assignData.error}
                        </div>
                      )}

                      <div className="admin-actions-group">
                        <button 
                          type="button"
                          className="action-chip save"
                          onClick={() => saveManualAssign(slot.slotNumber)}
                        >
                          <Check size={14} /> Confirm Assign
                        </button>
                        <button 
                          type="button"
                          className="action-chip cancel"
                          onClick={() => cancelAssigning(slot.slotNumber)}
                        >
                          <X size={14} /> Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Normal Display Mode */
                    <>
                      {slot.isBooked ? (
                        <div className="admin-team-preview">
                          <div className="admin-team-title">
                            <Shield size={16} color="#00f2fe" />
                            {slot.teamName}
                          </div>
                          <div className="admin-igl-title">
                            <UserCheck size={15} />
                            IGL: {slot.iglName || 'N/A'}
                          </div>
                        </div>
                      ) : (
                        <div className="admin-empty-state">
                          <span>Slot is currently vacant</span>
                          <span style={{ color: '#10b981', fontWeight: 700 }}>AVAILABLE</span>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="admin-actions-group">
                        {slot.isBooked ? (
                          <>
                            {/* Edit Button (to fix typos) */}
                            <button 
                              type="button"
                              className="action-chip edit"
                              onClick={() => startEditing(slot)}
                              title="Edit team details / fix typos"
                            >
                              <Edit3 size={14} /> Edit
                            </button>

                            {/* Clear/Delete Button (wipes slot & re-opens in Player View) */}
                            <button 
                              type="button"
                              className="action-chip delete"
                              onClick={() => handleClearSlot(slot.slotNumber)}
                              title="Clear booking and make available on Player View"
                            >
                              <Trash2 size={14} /> Clear
                            </button>
                          </>
                        ) : (
                          /* Manual Assign Button for Empty Slot */
                          <button 
                            type="button"
                            className="action-chip assign"
                            onClick={() => startAssigning(slot.slotNumber)}
                            title="Manually allocate a squad to this slot"
                          >
                            <UserPlus size={14} /> Manual Assign
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {filteredSlots.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
              No tournament slots match your current filter or search criteria.
            </div>
          )}
        </main>
      )}
    </div>
  );
}
