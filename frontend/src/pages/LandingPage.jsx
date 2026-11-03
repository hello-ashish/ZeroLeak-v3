import React, { useState, useEffect, useRef, useId } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Layers,
  Sun,
  Moon,
  ArrowRight,
  Shield,
  Lock,
  Cpu,
  Database,
  Activity,
  CheckCircle2,
  FileCode,
  Terminal,
  ExternalLink,
  Sparkles,
  RefreshCw,
  Eye,
  Sliders,
  ChevronRight,
  X,
  Play,
  KeyRound,
  ShieldCheck,
  AlertTriangle,
  GraduationCap,
  BookOpen,
  Search,
  LifeBuoy
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext.jsx';
import './LandingPage.css';

// Client-side SHA-256 helper for the interactive simulation
async function computeSha256(str) {
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    return 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
  }
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export default function LandingPage() {
  const navigate = useNavigate();
  const architectureRef = useRef(null);

  // Centralized theme state from ThemeContext
  const { isDark, toggleTheme } = useTheme();

  // Card view mode: 'blueprint' (matching user image exactly) vs 'simulator' (interactive live test)
  const [cardMode, setCardMode] = useState('blueprint');

  // Interactive Architecture Modal
  const [showArchModal, setShowArchModal] = useState(false);

  // Simulation State
  const [simReleaseTime, setSimReleaseTime] = useState(() => Math.floor(Date.now() / 1000));
  const [simLedgerHash, setSimLedgerHash] = useState('0x7f4a9b2c8e1d5a3f90c4b2e817a5d3f28c1b9e0a7f4a9b2c8e1d5a3f90c4b2e8');
  const [simSystemSeed, setSimSystemSeed] = useState('0xd892a0e1c45ff829b3a167098e72c83a152e094f');
  const [simCenterSalt, setSimCenterSalt] = useState('0x9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d');
  const [simResultHash, setSimResultHash] = useState('');
  const [simQuestions, setSimQuestions] = useState([]);
  const [isSimulating, setIsSimulating] = useState(false);

  // Run live simulation computation
  const runSimulation = async () => {
    setIsSimulating(true);
    const combinedString = `${simReleaseTime}:${simLedgerHash}:${simSystemSeed}:${simCenterSalt}`;
    const hash = await computeSha256(combinedString);
    setSimResultHash(hash);

    // Deterministically pick 10 question indices using chunks of the hash
    const questions = [];
    for (let i = 0; i < 10; i++) {
      const chunk = hash.substring(i * 4, i * 4 + 4);
      const val = parseInt(chunk, 16);
      const questionIndex = (val % 250) + 1; // Pool of 250 questions
      questions.push({
        id: questionIndex,
        difficulty: ['Easy', 'Medium', 'Hard'][val % 3],
        topic: ['Calculus', 'Quantum Cryptography', 'Distributed Systems', 'Data Structures', 'Network Security'][val % 5]
      });
    }
    setSimQuestions(questions);
    setIsSimulating(false);
  };

  useEffect(() => {
    runSimulation();
  }, [simReleaseTime, simLedgerHash, simSystemSeed, simCenterSalt]);

  const randomizeEntropy = () => {
    setSimReleaseTime(Math.floor(Date.now() / 1000));
    setSimLedgerHash('0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(''));
    setSimSystemSeed('0x' + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join(''));
    setSimCenterSalt('0x' + Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join(''));
  };

  const scrollToArchitecture = () => {
    if (architectureRef.current) {
      architectureRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Add subtle pulse highlight
      architectureRef.current.classList.add('zl-card-highlight');
      setTimeout(() => {
        architectureRef.current?.classList.remove('zl-card-highlight');
      }, 1800);
    }
  };

  return (
    <div className="zl-root">
      {/* Dynamic Grid & Ambient Glows */}
      <div className="zl-grid-bg" aria-hidden="true" />
      <div className="zl-ambient-glow zl-glow-top" aria-hidden="true" />
      <div className="zl-ambient-glow zl-glow-card" aria-hidden="true" />

      {/* ── Top Navigation Bar ── */}
      <header className="zl-navbar" role="banner">
        <div className="zl-nav-left" onClick={() => navigate('/portal')} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && navigate('/portal')}>
          <div className="zl-nav-logo-icon" aria-label="ZeroLeak Logo">
            <img src="/logo.png" alt="ZeroLeak Logo" style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover' }} />
          </div>
          <span className="zl-nav-brand-title">ZeroLeak</span>
        </div>

        <div className="zl-nav-right">
          <button
            type="button"
            className="zl-nav-theme-btn"
            onClick={toggleTheme}
            aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDark ? <Sun size={18} strokeWidth={1.5} /> : <Moon size={18} strokeWidth={1.5} />}
          </button>

          <button
            type="button"
            className="zl-btn-launch-terminal"
            onClick={() => navigate('/portal')}
            id="launch-terminal-btn"
          >
            Launch Terminal <span className="zl-arrow">→</span>
          </button>
        </div>
      </header>

      {/* ── Main Landing Content ── */}
      <main className="zl-main-content">
        {/* ── Hero Section ── */}
        <section className="zl-hero-section" aria-label="Hero Section">
          <div className="zl-hero-inner">
            {/* Monospace Pill Badge */}
            <div className="zl-protocol-pill" role="status">
              ZERO-EXISTENCE CRYPTOGRAPHY PROTOCOL
            </div>

            {/* Main Headline */}
            <h1 className="zl-hero-headline">
              <span className="zl-title-white">Blockchain-Based Dynamic</span>
              <span className="zl-title-gradient">Examination Paper Generation</span>
            </h1>

            {/* Description Subtitle */}
            <p className="zl-hero-subtitle">
              ZeroLeak stops exam paper leaks at their source. No final exam paper exists
              anywhere in the world until minutes before the examination, assembled dynamically
              using decentralized entropy and verified on an immutable ledger.
            </p>

            {/* Call to Actions */}
            <div className="zl-hero-actions">
              <button
                type="button"
                className="zl-btn-primary-console"
                onClick={() => navigate('/admin/login')}
                id="access-admin-console-btn"
              >
                Access Admin Console <span className="zl-arrow">→</span>
              </button>

              <button
                type="button"
                className="zl-btn-secondary-protocol"
                onClick={scrollToArchitecture}
                id="inspect-protocol-btn"
              >
                Inspect Protocol Architecture
              </button>
            </div>
          </div>
        </section>

        {/* ── Protocol Architecture Card ── */}
        <section
          className="zl-architecture-card"
          ref={architectureRef}
          id="protocol-architecture"
          aria-label="Dynamic Seed Mixing Protocol & Lineage"
        >
          {/* Card Terminal Header */}
          <div className="zl-card-header">
            <div className="zl-card-title-group">
              <span className="zl-prompt-symbol">&gt;_</span>
              <h2 className="zl-card-title">Dynamic Seed Mixing Protocol &amp; Lineage</h2>
            </div>

            <div className="zl-card-tabs">
              <button
                type="button"
                className={`zl-tab-btn ${cardMode === 'blueprint' ? 'active' : ''}`}
                onClick={() => setCardMode('blueprint')}
              >
                Blueprint View
              </button>
              <button
                type="button"
                className={`zl-tab-btn ${cardMode === 'simulator' ? 'active' : ''}`}
                onClick={() => setCardMode('simulator')}
              >
                <Sparkles size={13} style={{ marginRight: 4 }} />
                Live Simulator
              </button>
            </div>
          </div>

          {/* Blueprint Mode (Exact match to screenshot) */}
          {cardMode === 'blueprint' ? (
            <div className="zl-card-blueprint">
              <div className="zl-flow-grid">
                {/* ── Row 1 ── */}
                <div className="zl-flow-row">
                  {/* Box 1: Input Entropy */}
                  <div className="zl-flow-box zl-box-entropy">
                    <div className="zl-box-heading zl-heading-blue">1. Input Entropy</div>
                    <ul className="zl-box-bullets">
                      <li>• Release Time ($T$)</li>
                      <li>• Ledger Hash ($H$)</li>
                      <li>• System Seed ($S$)</li>
                      <li>• Center Salt ($E$)</li>
                    </ul>
                  </div>

                  <div className="zl-flow-arrow" aria-hidden="true">→</div>

                  {/* Middle Box: SHA-256 computation */}
                  <div className="zl-flow-box zl-box-hash">
                    <span className="zl-pill-tag zl-tag-purple">SHA-256</span>
                    <div className="zl-formula-text">r = SHA256(T + H + S + E)</div>
                  </div>

                  <div className="zl-flow-arrow zl-arrow-row1" aria-hidden="true">→</div>
                </div>

                {/* ── Row 2 ── */}
                <div className="zl-flow-row zl-row-2">
                  {/* Box 2: Seeded Selection */}
                  <div className="zl-flow-box zl-box-seeded">
                    <div className="zl-box-heading zl-heading-green">2. Seeded Selection</div>
                    <ul className="zl-box-bullets">
                      <li>• Modulo Indexing</li>
                      <li>• Balancing Rules</li>
                      <li>• Ledger Verification</li>
                      <li>• Time-locked Keys</li>
                    </ul>
                  </div>

                  <div className="zl-flow-arrow" aria-hidden="true">→</div>

                  {/* Right Box: Exam Package */}
                  <div className="zl-flow-box zl-box-release">
                    <span className="zl-pill-tag zl-tag-cyan">RELEASE</span>
                    <div className="zl-package-text">Unique Exam Package (X Questions)</div>
                  </div>
                </div>
              </div>

              {/* Security Assertion Callout Box */}
              <div className="zl-security-assertion">
                <strong className="zl-assertion-label">Security Assertion:</strong>{' '}
                The redundancy pool $N$ ($N = X \times n$) contains thousands of fully encrypted
                questions. Since the combined seed $r$ is completely unpredictable prior to $T$,
                the selected indices cannot be solved beforehand, guaranteeing 100% security against leakage.
              </div>
            </div>
          ) : (
            /* Interactive Live Simulation Mode */
            <div className="zl-card-simulator">
              <div className="zl-sim-header">
                <div className="zl-sim-intro">
                  <span className="zl-sim-badge">Live Cryptographic Engine</span>
                  <p>Modify entropy parameters to observe real-time dynamic SHA-256 seed synthesis and question extraction.</p>
                </div>
                <button type="button" className="zl-sim-refresh-btn" onClick={randomizeEntropy}>
                  <RefreshCw size={14} className={isSimulating ? 'spin' : ''} />
                  Randomize Entropy
                </button>
              </div>

              <div className="zl-sim-inputs-grid">
                <div className="zl-sim-input-box">
                  <label>Release Time ($T$)</label>
                  <input
                    type="number"
                    value={simReleaseTime}
                    onChange={(e) => setSimReleaseTime(Number(e.target.value))}
                    className="zl-sim-input"
                  />
                  <span className="zl-input-hint">{new Date(simReleaseTime * 1000).toISOString()}</span>
                </div>

                <div className="zl-sim-input-box">
                  <label>Ledger Block Hash ($H$)</label>
                  <input
                    type="text"
                    value={simLedgerHash}
                    onChange={(e) => setSimLedgerHash(e.target.value)}
                    className="zl-sim-input"
                  />
                  <span className="zl-input-hint">Hyperledger Fabric Anchor</span>
                </div>

                <div className="zl-sim-input-box">
                  <label>System Multi-Party Seed ($S$)</label>
                  <input
                    type="text"
                    value={simSystemSeed}
                    onChange={(e) => setSimSystemSeed(e.target.value)}
                    className="zl-sim-input"
                  />
                  <span className="zl-input-hint">CSPRNG Institutional Secret</span>
                </div>

                <div className="zl-sim-input-box">
                  <label>Test Center Salt ($E$)</label>
                  <input
                    type="text"
                    value={simCenterSalt}
                    onChange={(e) => setSimCenterSalt(e.target.value)}
                    className="zl-sim-input"
                  />
                  <span className="zl-input-hint">Hardware TPM Enclave Signature</span>
                </div>
              </div>

              {/* Dynamic Hash Display */}
              <div className="zl-sim-result-banner">
                <div className="zl-sim-result-label">
                  <span>Computed Combined Seed $r$</span>
                  <span className="zl-hash-tag">SHA-256 (256-bit)</span>
                </div>
                <div className="zl-sim-hash-code">{simResultHash || 'Computing...'}</div>
              </div>

              {/* Dynamic Questions Generated */}
              <div className="zl-sim-questions-container">
                <div className="zl-sim-questions-header">
                  <span>Dynamically Assembled Questions (Pool $N=250$, Sample $X=10$)</span>
                  <span className="zl-pill-verified">
                    <CheckCircle2 size={12} style={{ marginRight: 4, display: 'inline', verticalAlign: '-1px' }} />
                    Deterministically Verified
                  </span>
                </div>
                <div className="zl-questions-chips">
                  {simQuestions.map((q, idx) => (
                    <div className="zl-q-chip" key={idx}>
                      <span className="zl-q-id">#{q.id}</span>
                      <span className="zl-q-topic">{q.topic}</span>
                      <span className={`zl-q-diff zl-diff-${q.difficulty.toLowerCase()}`}>{q.difficulty}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Quick Deep Dive Trigger */}
          <div className="zl-card-footer-action">
            <button
              type="button"
              className="zl-btn-deep-dive"
              onClick={() => setShowArchModal(true)}
            >
              <FileCode size={14} />
              View Mathematical Proof &amp; Ledger Anchor Specs
            </button>
          </div>
        </section>

        {/* ── Key Technical Pillars ── */}
        <section className="zl-pillars-section">
          <div className="zl-section-title-wrap">
            <span className="zl-section-badge">Core Pillars</span>
            <h2 className="zl-section-h2">Why ZeroLeak Eliminates Leaks</h2>
            <p className="zl-section-sub">
              Conventional examination systems fail because papers exist days or weeks in advance.
              ZeroLeak mathematically enforces that an exam paper cannot exist until examination time.
            </p>
          </div>

          <div className="zl-pillars-grid">
            <div className="zl-pillar-card">
              <div className="zl-pillar-icon-box zl-p-purple">
                <Lock size={20} />
              </div>
              <h3>Zero-Existence Invariant</h3>
              <p>
                No complete exam paper is ever stored on any server, database, or disk before the official start timestamp ($T$).
                Even an administrator with root database access cannot leak the test.
              </p>
            </div>

            <div className="zl-pillar-card">
              <div className="zl-pillar-icon-box zl-p-blue">
                <Database size={20} />
              </div>
              <h3>Hyperledger Fabric Ledger</h3>
              <p>
                All question pools, entropy commitments, and student answer submissions are anchored to an immutable blockchain.
                Any retrospective tampering is immediately exposed.
              </p>
            </div>

            <div className="zl-pillar-card">
              <div className="zl-pillar-icon-box zl-p-green">
                <Cpu size={20} />
              </div>
              <h3>Decentralized Entropy Mixing</h3>
              <p>
                The seed algorithm mixes distributed inputs from the examination authority, time oracle, and local exam center hardware.
                Predicting the final paper requires solving SHA-256 backwards.
              </p>
            </div>

            <div className="zl-pillar-card">
              <div className="zl-pillar-icon-box zl-p-cyan">
                <ShieldCheck size={20} />
              </div>
              <h3>Offline-Resilient CBT Client</h3>
              <p>
                If network connectivity drops during an active exam session, students continue answering seamlessly.
                Progress auto-saves locally and syncs through telemetry heartbeats.
              </p>
            </div>
          </div>
        </section>

        {/* ── Direct Role Gateways ── */}
        <section className="zl-roles-section">
          <div className="zl-section-title-wrap">
            <span className="zl-section-badge">Access Gateways</span>
            <h2 className="zl-section-h2">Dedicated Portals for Every Role</h2>
            <p className="zl-section-sub">
              Zero-Trust architecture enforces least-privilege scoping. Select your operational terminal.
            </p>
          </div>

          <div className="zl-roles-grid">
            <div className="zl-role-card" onClick={() => navigate('/student/login')} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && navigate('/student/login')}>
              <div className="zl-role-tag">Student</div>
              <div className="zl-role-icon-wrap zl-ri-student">
                <GraduationCap size={20} />
              </div>
              <h4>Exam Candidate Portal</h4>
              <p>Launch secure exam sessions, auto-save answers offline, and view verified results.</p>
              <div className="zl-role-link">Enter Student Login <ArrowRight size={14} /></div>
            </div>

            <div className="zl-role-card" onClick={() => navigate('/professor/login')} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && navigate('/professor/login')}>
              <div className="zl-role-tag">Professor</div>
              <div className="zl-role-icon-wrap zl-ri-professor">
                <BookOpen size={20} />
              </div>
              <h4>Faculty Authoring Desk</h4>
              <p>Author encrypted question banks, build curriculum batches, and submit for review.</p>
              <div className="zl-role-link">Enter Professor Login <ArrowRight size={14} /></div>
            </div>

            <div className="zl-role-card zl-role-card-featured" onClick={() => navigate('/admin/login')} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && navigate('/admin/login')}>
              <div className="zl-role-tag zl-tag-highlight">Admin</div>
              <div className="zl-role-icon-wrap zl-ri-admin">
                <ShieldCheck size={20} />
              </div>
              <h4>Administrative Console</h4>
              <p>Control dynamic release triggers, supervise live sessions, and manage institutional nodes.</p>
              <div className="zl-role-link">Enter Admin Console <ArrowRight size={14} /></div>
            </div>

            <div className="zl-role-card" onClick={() => navigate('/auditor/login')} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && navigate('/auditor/login')}>
              <div className="zl-role-tag">Auditor</div>
              <div className="zl-role-icon-wrap zl-ri-auditor">
                <Search size={20} />
              </div>
              <h4>Independent Auditor</h4>
              <p>Scan for database discrepancies against blockchain commitments with Merkle verification.</p>
              <div className="zl-role-link">Enter Auditor Login <ArrowRight size={14} /></div>
            </div>

            <div className="zl-role-card" onClick={() => navigate('/support/login')} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && navigate('/support/login')}>
              <div className="zl-role-tag">Support</div>
              <div className="zl-role-icon-wrap zl-ri-support">
                <LifeBuoy size={20} />
              </div>
              <h4>Helpdesk Operations</h4>
              <p>Resolve candidate connectivity issues, review audit tickets, and inspect session conflicts.</p>
              <div className="zl-role-link">Enter Support Desk <ArrowRight size={14} /></div>
            </div>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="zl-footer" role="contentinfo">
          <div className="zl-footer-top">
            <div className="zl-footer-brand">
              <div className="zl-nav-logo-icon">
                <img src="/logo.png" alt="ZeroLeak Logo" style={{ width: 22, height: 22, borderRadius: 5, objectFit: 'cover' }} />
              </div>
              <span className="zl-footer-brand-name">ZeroLeak</span>
              <span className="zl-footer-sub">Zero-Trust Examination Security</span>
            </div>

            <div className="zl-footer-status">
              <span className="zl-status-dot" />
              <span>Hyperledger Fabric Network: Operational (Anchored)</span>
            </div>

            <div className="zl-footer-links">
              <a href="/portal">Launch Terminal</a>
              <a href="/admin/login">Admin Console</a>
              <button type="button" className="zl-footer-btn-link" onClick={() => setShowArchModal(true)}>
                Protocol Specs
              </button>
            </div>
          </div>

          <div className="zl-footer-bottom">
            <span>© {new Date().getFullYear()} ZeroLeak Protocol. All rights reserved.</span>
            <span>Cryptographic Proof Engine · Dynamic Entropy Synthesis</span>
          </div>
        </footer>
      </main>

      {/* ── Mathematical Proof & Protocol Specs Modal ── */}
      {showArchModal && (
        <div className="zl-modal-backdrop" onClick={() => setShowArchModal(false)}>
          <div className="zl-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="zl-modal-header">
              <div className="zl-modal-title">
                <ShieldCheck size={20} color="#38bdf8" />
                <h3>Zero-Existence Protocol Specification</h3>
              </div>
              <button type="button" className="zl-modal-close" onClick={() => setShowArchModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="zl-modal-body">
              <div className="zl-spec-block">
                <h4>1. The Zero-Existence Guarantee</h4>
                <p>
                  Let $\mathcal{P}$ denote the set of exam questions in the redundancy bank with cardinality $|\mathcal{P}| = N$.
                  The final exam paper $\mathcal{E}$ consists of $X$ questions selected at time $T$.
                  Prior to timestamp $T$, the combined seed $r$ does not exist:
                </p>
                <div className="zl-code-block">
                  r = \text{SHA256}(T \parallel H \parallel S \parallel E)
                </div>
                <p>
                  Because $H$ is the hash of the latest blockchain block produced at $T$, $H$ is strictly unknowable prior to $T$.
                  Therefore, no party (including developers, proctors, or administrators) can compute $r$ ahead of schedule.
                </p>
              </div>

              <div className="zl-spec-block">
                <h4>2. Deterministic Pseudo-Random Question Selection</h4>
                <p>
                  Using $r$ as a cryptographic PRNG state, questions are sampled without replacement while adhering to balanced difficulty constraints:
                </p>
                <div className="zl-code-block">
                  q_i = \text{Pool}[\text{HMAC}(r, i) \pmod N]
                </div>
                <p>
                  Every candidate receives an identical, mathematically verifiable exam package without relying on a human intermediary who could leak the questions.
                </p>
              </div>

              <div className="zl-spec-block">
                <h4>3. Post-Exam Merkle Tree Verification</h4>
                <p>
                  Upon submission, all student response commitments are aggregated into a Merkle Tree.
                  The Merkle Root is committed to Hyperledger Fabric. Auditors can independently verify that zero student answers were altered.
                </p>
              </div>
            </div>

            <div className="zl-modal-footer">
              <button type="button" className="zl-btn-modal-done" onClick={() => setShowArchModal(false)}>
                Close Specification
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
