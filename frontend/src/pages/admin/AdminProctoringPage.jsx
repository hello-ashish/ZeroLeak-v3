/**
 * Admin Proctoring Dashboard
 *
 * Layout:
 *   A. Suspicious Activity panel  — AI alerts, prioritised by score
 *   B. All Live Students panel    — lightweight metadata list, no streams
 *
 * WebRTC (on-demand only):
 *   Admin clicks "Monitor" → proctoring:request-stream(sessionId)
 *   Student creates peer + sends offer using adminSocketId echo
 *   Admin renders stream in modal
 *   Admin closes modal → proctoring:stop-monitoring(sessionId) → peer closed
 *
 * State ownership:
 *   sessionsMapRef   useRef<Map>   — live session metadata (no streams)
 *   alertsMapRef     useRef<Map>   — AI alert entries keyed by sessionId
 *   rtcMapRef        useRef<Map>   — active RTCPeerConnections keyed by sessionId
 *   streamsRef       useRef<Map>   — active MediaStreams keyed by sessionId
 *   socketRef        useRef        — Socket.IO connection
 *   forceRender      useState(0)   — tick counter to trigger repaint
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "./AdminLayout.jsx";
import {
    Activity, Video, Mic, MicOff, MonitorPlay, AlertTriangle,
    Filter, ShieldAlert, Eye, X, ChevronRight, Wifi, WifiOff,
    Brain, AlertCircle, Shield, Users, TrendingUp
} from "lucide-react";

const BACKEND_URL = import.meta.env.DEV ? "" : "https://zeroleak-v2.onrender.com";
const API        = `${BACKEND_URL}/api`;
const SOCKET_URL = `${BACKEND_URL}/proctoring`;

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

    .proctor-page { font-family: 'Inter', sans-serif; }

    /* Alert card — prominent */
    .alert-card {
        border-radius: 12px;
        border: 1px solid;
        padding: 16px;
        position: relative;
        overflow: hidden;
        transition: transform 0.15s ease, box-shadow 0.15s ease;
        cursor: pointer;
    }
    .alert-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 24px rgba(0,0,0,0.3);
    }
    .alert-card.level-HIGH {
        border-color: rgba(255, 71, 87, 0.6);
        background: linear-gradient(135deg, rgba(255,71,87,0.12) 0%, rgba(30,15,20,0.95) 100%);
    }
    .alert-card.level-SUSPICIOUS {
        border-color: rgba(255, 171, 0, 0.6);
        background: linear-gradient(135deg, rgba(255,171,0,0.1) 0%, rgba(25,20,5,0.95) 100%);
    }
    .alert-card.level-MONITOR {
        border-color: rgba(100, 149, 237, 0.5);
        background: linear-gradient(135deg, rgba(100,149,237,0.08) 0%, rgba(10,15,30,0.95) 100%);
    }
    [data-theme="light"] .alert-card {
        background: #ffffff;
        box-shadow: 0 4px 16px rgba(0,0,0,0.05);
    }
    [data-theme="light"] .alert-card:hover {
        box-shadow: 0 8px 24px rgba(0,0,0,0.1);
    }
    [data-theme="light"] .alert-card.level-HIGH {
        border-color: rgba(239, 68, 68, 0.35);
        background: linear-gradient(135deg, rgba(239, 68, 68, 0.06) 0%, #ffffff 100%);
    }
    [data-theme="light"] .alert-card.level-SUSPICIOUS {
        border-color: rgba(245, 158, 11, 0.35);
        background: linear-gradient(135deg, rgba(245, 158, 11, 0.06) 0%, #ffffff 100%);
    }
    [data-theme="light"] .alert-card.level-MONITOR {
        border-color: rgba(59, 130, 246, 0.35);
        background: linear-gradient(135deg, rgba(59, 130, 246, 0.06) 0%, #ffffff 100%);
    }
    .alert-card::before {
        content: '';
        position: absolute;
        top: 0; left: 0; width: 4px; height: 100%;
    }
    .alert-card.level-HIGH::before     { background: var(--danger); }
    .alert-card.level-SUSPICIOUS::before { background: var(--warning); }
    .alert-card.level-MONITOR::before  { background: #6495ed; }

    /* Score bar */
    .score-bar-track {
        height: 4px;
        background: rgba(255,255,255,0.1);
        border-radius: 2px;
        overflow: hidden;
        margin-top: 8px;
    }
    [data-theme="light"] .score-bar-track {
        background: var(--border-default, rgba(0,0,0,0.1));
    }
    .score-bar-fill {
        height: 100%;
        border-radius: 2px;
        transition: width 0.4s ease;
    }

    /* Student row */
    .student-row {
        display: flex;
        align-items: center;
        padding: 10px 14px;
        border-radius: 8px;
        border: 1px solid var(--border-subtle);
        background: var(--bg-elevated);
        transition: background 0.15s ease;
        gap: 12px;
    }
    .student-row:hover { background: var(--bg-surface); }

    /* Status dot */
    .dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .dot.online  { background: var(--success); box-shadow: 0 0 6px var(--success); animation: pulse-green 2s infinite; }
    .dot.offline { background: var(--danger); }
    .dot.unstable{ background: var(--warning); }
    @keyframes pulse-green {
        0%  { box-shadow: 0 0 0 0 rgba(46,213,115,0.6); }
        70% { box-shadow: 0 0 0 5px rgba(46,213,115,0); }
        100%{ box-shadow: 0 0 0 0 rgba(46,213,115,0); }
    }

    /* Monitor modal */
    .monitor-modal {
        position: fixed; inset: 0;
        background: rgba(0,0,0,0.75);
        backdrop-filter: blur(4px);
        z-index: 1000;
        display: flex; align-items: center; justify-content: center;
    }
    [data-theme="light"] .monitor-modal {
        background: rgba(15, 23, 42, 0.45);
    }
    .monitor-panel {
        background: var(--bg-elevated);
        border: 1px solid var(--border-default);
        border-radius: 16px;
        width: 100%; max-width: 920px;
        max-height: 92vh; overflow-y: auto;
        padding: 28px;
        box-shadow: 0 32px 64px rgba(0,0,0,0.6);
    }
    [data-theme="light"] .monitor-panel {
        box-shadow: 0 24px 48px rgba(0,0,0,0.15);
    }

    /* Video containers */
    .video-box {
        background: #000;
        border-radius: 10px;
        overflow: hidden;
        aspect-ratio: 16/9;
        position: relative;
    }
    .video-box video { width: 100%; height: 100%; object-fit: cover; }
    .video-placeholder-inner {
        position: absolute; inset: 0;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        color: var(--text-tertiary);
        gap: 8px;
    }

    /* Level badge */
    .level-badge {
        display: inline-flex; align-items: center; gap: 4px;
        padding: 3px 8px; border-radius: 4px;
        font-size: 11px; font-weight: 700; letter-spacing: 0.08em;
        text-transform: uppercase;
    }
    .level-badge.HIGH       { background: rgba(255,71,87,0.2);  color: var(--danger); border: 1px solid rgba(255,71,87,0.4); }
    .level-badge.SUSPICIOUS { background: rgba(255,171,0,0.2); color: var(--warning); border: 1px solid rgba(255,171,0,0.3); }
    .level-badge.MONITOR    { background: rgba(100,149,237,0.2); color: #6495ed; border: 1px solid rgba(100,149,237,0.3); }
    .level-badge.NORMAL     { background: rgba(46,213,115,0.1); color: var(--success); border: 1px solid rgba(46,213,115,0.2); }
    [data-theme="light"] .level-badge.SUSPICIOUS { color: #b45309; background: rgba(245, 158, 11, 0.12); border-color: rgba(245, 158, 11, 0.3); }
    [data-theme="light"] .level-badge.MONITOR    { color: #2563eb; background: rgba(59, 130, 246, 0.12); border-color: rgba(59, 130, 246, 0.3); }
    [data-theme="light"] .level-badge.HIGH       { color: #dc2626; background: rgba(239, 68, 68, 0.12); border-color: rgba(239, 68, 68, 0.3); }
    [data-theme="light"] .level-badge.NORMAL     { color: #059669; background: rgba(16, 185, 129, 0.12); border-color: rgba(16, 185, 129, 0.3); }

    /* Section header */
    .section-hdr {
        display: flex; align-items: center; gap: 10px;
        font-size: 16px; font-weight: 700; color: var(--text-primary);
        margin-bottom: 16px;
    }

    /* Stat card */
    .stat-pill {
        background: var(--bg-elevated);
        border: 1px solid var(--border-default);
        border-radius: 10px;
        padding: 16px 20px;
    }

    /* Connecting spinner */
    @keyframes spin { to { transform: rotate(360deg); } }
    .spinner { animation: spin 1s linear infinite; }

    /* Listening pulse */
    @keyframes mic-pulse {
        0%,100% { opacity: 1; }
        50%      { opacity: 0.4; }
    }
    .mic-active { animation: mic-pulse 1.5s ease-in-out infinite; }

    /* Skeleton Pulse */
    @keyframes skeleton-pulse {
        0%   { opacity: 0.6; }
        50%  { opacity: 0.3; }
        100% { opacity: 0.6; }
    }
    .skeleton-block {
        background: var(--bg-elevated);
        border-radius: 6px;
        animation: skeleton-pulse 1.5s ease-in-out infinite;
        height: 32px;
        margin-bottom: 6px;
    }
`;

// ─── StreamVideo (memoised video element) ────────────────────────────────────
const StreamVideo = React.memo(({ stream, muted = true }) => {
    const ref = useRef(null);

    useEffect(() => {
        const v = ref.current;
        if (!v || !stream) return;
        v.srcObject = stream;
        v.play().catch(() => {});
        return () => { if (v.srcObject === stream) v.srcObject = null; };
    }, [stream]);

    useEffect(() => {
        if (ref.current) {
            ref.current.muted = muted;
        }
    }, [muted]);

    return <video ref={ref} autoPlay playsInline muted={muted}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }} />;
});

// ─── Helpers ─────────────────────────────────────────────────────────────────
const levelColor = { HIGH: "var(--danger)", SUSPICIOUS: "var(--warning)", MONITOR: "#6495ed", NORMAL: "var(--success)" };
const dotClass   = (cs) => cs === "ONLINE" ? "online" : cs === "UNSTABLE" ? "unstable" : "offline";
const fmt        = (dt) => dt ? new Date(dt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "--";
const initials   = (name) => (name || "?").charAt(0).toUpperCase();

// ─── AlertCard ───────────────────────────────────────────────────────────────
const AlertCard = React.memo(({ alert, onMonitor, onDetails }) => {
    const level = alert.level || "MONITOR";
    const score = Math.min(alert.score || 0, 100);

    return (
        <div className={`alert-card level-${level}`} onClick={() => onMonitor(alert.sessionId)}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                        width: 36, height: 36, borderRadius: "50%",
                        background: `${levelColor[level]}22`,
                        border: `1px solid ${levelColor[level]}66`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontWeight: 700, color: levelColor[level], fontSize: 14
                    }}>
                        {initials(alert.studentId?.name)}
                    </div>
                    <div>
                        <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text-primary)" }}>
                            {alert.studentId?.name || "Unknown Student"}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                            {alert.studentId?.studentId || "—"}  ·  {alert.examId?.title || "—"}
                        </div>
                    </div>
                </div>
                <span className={`level-badge ${level}`}>{level}</span>
            </div>

            <div style={{ display: "flex", gap: 16, fontSize: 12, color: "var(--text-secondary)", marginBottom: 6 }}>
                <span><Brain size={11} style={{ marginRight: 4, verticalAlign: "middle" }} />
                    {(alert.latestSignal || "—").replace(/_/g, " ")}</span>
                <span style={{ marginLeft: "auto" }}>
                    {Math.round((alert.confidence || 0) * 100)}% confidence
                </span>
                <span>{fmt(alert.latestAt)}</span>
            </div>

            <div className="score-bar-track">
                <div className="score-bar-fill" style={{
                    width: `${score}%`,
                    background: levelColor[level]
                }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 11, color: "var(--text-tertiary)" }}>
                <span>Suspicion score: {score}</span>
                <span style={{ color: levelColor[level], fontWeight: 600 }}>{alert.eventCount} signal{alert.eventCount !== 1 ? "s" : ""}</span>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button
                    className="btn btn-primary"
                    style={{ flex: 1, fontSize: 12, padding: "7px 0", background: levelColor[level], border: "none" }}
                    onClick={(e) => { e.stopPropagation(); onMonitor(alert.sessionId); }}
                >
                    <Eye size={13} style={{ marginRight: 5 }} /> View Live
                </button>
                <button
                    className="btn btn-outline"
                    style={{ padding: "7px 14px", fontSize: 12 }}
                    onClick={(e) => { e.stopPropagation(); onDetails(alert.sessionId); }}
                >
                    Details
                </button>
            </div>
        </div>
    );
});

// ─── StudentRow (lightweight) ─────────────────────────────────────────────────
const StudentRow = React.memo(({ session, aiSuspicion, onMonitor }) => {
    const cs    = session.connectionStatus || "OFFLINE";
    const level = aiSuspicion?.level || "NORMAL";

    return (
        <div className="student-row">
            <div className={`dot ${dotClass(cs)}`} />
            <div style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 13, color: "var(--text-primary)", flexShrink: 0 }}>
                {initials(session.studentId?.name)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, fontSize: 13, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {session.studentId?.name || "Unknown"}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {session.examId?.title || "—"}
                </div>
            </div>
            <div style={{ fontSize: 11, color: cs === "ONLINE" ? "var(--success)" : "var(--danger)", fontWeight: 600, flexShrink: 0 }}>
                {cs}
            </div>
            <span className={`level-badge ${level}`} style={{ flexShrink: 0 }}>
                AI: {level}
            </span>
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <button
                    className="btn btn-outline"
                    style={{ padding: "5px 12px", fontSize: 11 }}
                    onClick={() => onMonitor(session._id)}
                >
                    <Eye size={12} style={{ marginRight: 4 }} /> Monitor
                </button>
            </div>
        </div>
    );
}, (prev, next) =>
    prev.session === next.session &&
    prev.aiSuspicion?.level === next.aiSuspicion?.level
);

// ─── MonitorModal ─────────────────────────────────────────────────────────────
const MonitorModal = React.memo(({ session, streams, aiEvents, incidents, onClose, listeningTo, onToggleListen, mode, onRequestLive, onEndSession, isLoading }) => {
    const studentIdStr = session?.studentId?._id?.toString();

    return (
        <div className="monitor-modal" onClick={onClose}>
            <div className="monitor-panel" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                            {session?.studentId?.name || "Unknown Student"}
                        </h2>
                        <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 4 }}>
                            {session?.studentId?.studentId}  ·  {session?.examId?.title}
                            {session?.aiSuspicion && (
                                <span className={`level-badge ${session.aiSuspicion.level}`} style={{ marginLeft: 8 }}>
                                    {session.aiSuspicion.level}  ·  score {session.aiSuspicion.score}
                                </span>
                            )}
                        </div>
                    </div>
                    <button className="btn btn-outline" style={{ padding: "6px 14px" }} onClick={onClose}>
                        <X size={16} style={{ marginRight: 6 }} /> Close
                    </button>
                </div>

                {/* Video feeds */}
                {mode === 'live' && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                        <div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>Screen</div>
                            <div className="video-box">
                                {streams?.screen
                                    ? <StreamVideo stream={streams.screen} muted={true} />
                                    : <div className="video-placeholder-inner">
                                        <Activity size={24} className="spinner" style={{ opacity: 0.4 }} />
                                        <span style={{ fontSize: 12 }}>Establishing…</span>
                                      </div>
                                }
                            </div>
                        </div>
                        <div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>Camera</div>
                            <div className="video-box">
                                {streams?.camera
                                    ? <StreamVideo stream={streams.camera} muted={listeningTo !== studentIdStr} />
                                    : <div className="video-placeholder-inner">
                                        <Activity size={24} className="spinner" style={{ opacity: 0.4 }} />
                                        <span style={{ fontSize: 12 }}>Establishing…</span>
                                      </div>
                                }
                            </div>
                        </div>
                    </div>
                )}

                {/* Controls */}
                <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
                    {mode === 'live' && (
                        <button
                            className="btn btn-outline"
                            style={{
                                padding: "8px 16px", fontSize: 13,
                                background: listeningTo === studentIdStr ? "rgba(255,71,87,0.15)" : undefined,
                                borderColor: listeningTo === studentIdStr ? "var(--danger)" : undefined,
                                color: listeningTo === studentIdStr ? "var(--danger)" : undefined
                            }}
                            onClick={() => onToggleListen(studentIdStr)}
                        >
                            {listeningTo === studentIdStr
                                ? <><Mic size={14} className="mic-active" style={{ marginRight: 6 }} />Mute</>
                                : <><MicOff size={14} style={{ marginRight: 6 }} />Listen</>
                            }
                        </button>
                    )}

                    {mode === 'details' && (
                        <button
                            className="btn btn-outline"
                            style={{ padding: "8px 16px", fontSize: 13 }}
                            onClick={onRequestLive}
                        >
                            <Eye size={14} style={{ marginRight: 6 }} /> Request Live View
                        </button>
                    )}

                    <button
                        className="btn btn-primary"
                        style={{ padding: "8px 16px", fontSize: 13, background: "var(--danger)", border: "none" }}
                        onClick={() => onEndSession(session._id)}
                    >
                        <ShieldAlert size={14} style={{ marginRight: 6 }} /> Terminate Session
                    </button>

                    {mode === 'live' && !streams?.camera && !streams?.screen && (
                        <span style={{ fontSize: 12, color: "var(--warning)", display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
                            <Activity size={13} className="spinner" /> Negotiating WebRTC connection…
                        </span>
                    )}
                </div>

                {/* Session info + security metrics */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                    <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 10 }}>Session Info</div>
                        {[
                            ["Exam",       session?.examId?.title],
                            ["Student ID", session?.studentId?.studentId],
                            ["Status",     session?.status],
                            ["Connection", session?.connectionStatus],
                            ["Started",    session?.startedAt ? new Date(session.startedAt).toLocaleString() : "—"]
                        ].map(([k, v]) => (
                            <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border-subtle)", fontSize: 12 }}>
                                <span style={{ color: "var(--text-tertiary)" }}>{k}</span>
                                <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{v || "—"}</span>
                            </div>
                        ))}
                    </div>
                    <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 10 }}>Security Metrics</div>
                        {[
                            ["Tab Switches",    session?.tabSwitchCount  || 0],
                            ["Window Blurs",    session?.windowBlurCount || 0],
                            ["Total Incidents", session?.incidentCount   || 0],
                            ["Camera",          session?.cameraStatus],
                            ["Microphone",      session?.microphoneStatus]
                        ].map(([k, v]) => (
                            <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border-subtle)", fontSize: 12 }}>
                                <span style={{ color: "var(--text-tertiary)" }}>{k}</span>
                                <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{v ?? "—"}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Recent AI events */}
                <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                        <Brain size={14} /> AI Detection Signals (recent)
                    </div>
                    {isLoading ? (
                        <div>
                            <div className="skeleton-block"></div>
                            <div className="skeleton-block"></div>
                            <div className="skeleton-block"></div>
                        </div>
                    ) : aiEvents?.length > 0 ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {aiEvents.slice(0, 6).map(e => (
                                <div key={e._id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, padding: "6px 10px", background: "var(--bg-surface)", borderRadius: 6, border: "1px solid var(--border-subtle)" }}>
                                    <span style={{ color: "var(--text-tertiary)", flexShrink: 0, fontSize: 11 }}>{fmt(e.createdAt)}</span>
                                    <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{(e.type || "").replace(/_/g, " ")}</span>
                                    <span style={{ color: "var(--text-tertiary)", marginLeft: "auto" }}>
                                        {Math.round((e.confidence || 0) * 100)}% · +{e.scoreContribution} pts
                                    </span>
                                    <span style={{ fontWeight: 600, color: "var(--text-tertiary)", fontSize: 10 }}>{e.modelVersion}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>No AI signals recorded.</div>
                    )}
                </div>

                {/* Recent incidents */}
                <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                        <AlertTriangle size={14} /> Behavioural Incidents (recent)
                    </div>
                    {isLoading ? (
                        <div>
                            <div className="skeleton-block"></div>
                            <div className="skeleton-block"></div>
                        </div>
                    ) : incidents?.length > 0 ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            {incidents.slice(0, 6).map(i => (
                                <div key={i._id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, padding: "5px 10px", background: "var(--bg-surface)", borderRadius: 6 }}>
                                    <span style={{ color: "var(--text-tertiary)", flexShrink: 0, fontSize: 11 }}>{fmt(i.timestamp)}</span>
                                    <span style={{ fontWeight: 600 }}>{(i.type || "").replace(/_/g, " ")}</span>
                                    <span style={{ padding: "1px 6px", borderRadius: 3, fontSize: 10, fontWeight: 700, background: i.severity === "HIGH" ? "rgba(255,71,87,0.2)" : i.severity === "MEDIUM" ? "rgba(255,171,0,0.2)" : "rgba(255,255,255,0.08)", color: i.severity === "HIGH" ? "var(--danger)" : i.severity === "MEDIUM" ? "var(--warning)" : "var(--text-tertiary)" }}>
                                        {i.severity}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>No incidents recorded.</div>
                    )}
                </div>
            </div>
        </div>
    );
});

// ─── Main Page ────────────────────────────────────────────────────────────────
export const AdminProctoringPage = () => {
    const navigate = useNavigate();
    // ── State ─────────────────────────────────────────────────────────────────
    const sessionsMapRef = useRef(new Map());  // sessionId → session metadata
    const alertsMapRef   = useRef(new Map());  // sessionId → alert entry
    const rtcMapRef      = useRef(new Map());  // sessionId → { pc }
    const streamsRef     = useRef(new Map());  // sessionId → { camera, screen }
    const socketRef      = useRef(null);
    const isMountedRef   = useRef(false);

    const [, forceRender] = useState(0);
    const tick = useCallback(() => forceRender(v => v + 1), []);

    const [selectedExam,    setSelectedExam]    = useState("ALL");
    const [exams,           setExams]           = useState([]);
    const [summary,         setSummary]         = useState(null);
    const [monitorSessionId,setMonitorSessionId]= useState(null); // modal open
    const [monitorMode,     setMonitorMode]     = useState('live'); // 'live' or 'details'
    const [listeningTo,     setListeningTo]     = useState(null);
    const [modalAIEvents,   setModalAIEvents]   = useState([]);
    const [modalIncidents,  setModalIncidents]  = useState([]);
    const [searchQuery,     setSearchQuery]     = useState("");
    const [isLoadingModal,  setIsLoadingModal]  = useState(false);
    const [isPageLoading,   setIsPageLoading]   = useState(true);
    const [isDemoMode,      setIsDemoMode]      = useState(false);

    // ── Derived ───────────────────────────────────────────────────────────────
    const sessions       = useMemo(() => [...sessionsMapRef.current.values()], []); // refreshed by tick()
    const alerts         = useMemo(() => [...alertsMapRef.current.values()].sort((a, b) => (b.score || 0) - (a.score || 0)), []);
    const monitorSession = monitorSessionId ? sessionsMapRef.current.get(monitorSessionId) : null;
    const monitorStreams  = monitorSessionId ? streamsRef.current.get(monitorSessionId) : null;

    const filteredSessions = useMemo(() => {
        const all = [...sessionsMapRef.current.values()];
        if (!searchQuery) return all;
        const q = searchQuery.toLowerCase();
        return all.filter(s =>
            s.studentId?.name?.toLowerCase().includes(q) ||
            s.studentId?.studentId?.toLowerCase().includes(q) ||
            s.examId?.title?.toLowerCase().includes(q)
        );
    }, [searchQuery]);

    // ── Open monitor modal ────────────────────────────────────────────────────
    const handleMonitor = useCallback(async (sessionId, mode = 'live') => {
        // Close any existing monitoring session first
        if (monitorSessionId && monitorSessionId !== sessionId) {
            closeMonitor(monitorSessionId);
        }

        setMonitorSessionId(sessionId);
        setMonitorMode(mode);
        setListeningTo(null);
        setModalAIEvents([]);
        setModalIncidents([]);
        setIsLoadingModal(true);

        // Request WebRTC stream
        if (mode === 'live' && socketRef.current && !isDemoMode) {
            socketRef.current.emit("proctoring:request-stream", { sessionId });
        }

        // Fetch AI events + incidents for the modal
        const token = localStorage.getItem("adminToken");
        if (token && !isDemoMode) {
            try {
                const [aiRes, incRes] = await Promise.all([
                    axios.get(`${API}/admin/proctoring/sessions/${sessionId}/ai-events?limit=20`, { headers: { Authorization: `Bearer ${token}` } }),
                    axios.get(`${API}/admin/proctoring/sessions/${sessionId}/incidents?limit=20`, { headers: { Authorization: `Bearer ${token}` } })
                ]);
                setModalAIEvents(aiRes.data.events  || []);
                setModalIncidents(incRes.data.incidents || []);
            } catch { /* non-critical */ }
        }
        setIsLoadingModal(false);
    }, [monitorSessionId]);

    const handleSimulateDemo = useCallback(() => {
        setIsDemoMode(true);
        sessionsMapRef.current.clear();
        alertsMapRef.current.clear();
        
        const demoSessions = [
            {
                _id: "demo-sess-1", sessionId: "demo-sess-1",
                studentId: { name: "Alice Johnson", studentId: "S-1001", _id: "stu1", email: "alice@example.com" },
                examId: { title: "CS101 Midterm" }, status: "ONLINE",
                joinedAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
                lastPingAt: new Date().toISOString(), aiSuspicion: { score: 10, level: 'NORMAL' }
            },
            {
                _id: "demo-sess-2", sessionId: "demo-sess-2",
                studentId: { name: "Bob Smith", studentId: "S-1002", _id: "stu2", email: "bob@example.com" },
                examId: { title: "Physics Final" }, status: "ONLINE",
                joinedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
                lastPingAt: new Date().toISOString(), aiSuspicion: { score: 92, level: 'HIGH' }
            },
            {
                _id: "demo-sess-3", sessionId: "demo-sess-3",
                studentId: { name: "Charlie Brown", studentId: "S-1003", _id: "stu3", email: "charlie@example.com" },
                examId: { title: "Biology 101" }, status: "UNSTABLE",
                joinedAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
                lastPingAt: new Date(Date.now() - 1000 * 60 * 2).toISOString(), aiSuspicion: { score: 25, level: 'NORMAL' }
            },
            {
                _id: "demo-sess-4", sessionId: "demo-sess-4",
                studentId: { name: "David Wilson", studentId: "S-1004", _id: "stu4", email: "david@example.com" },
                examId: { title: "Calculus I" }, status: "ONLINE",
                joinedAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
                lastPingAt: new Date().toISOString(), aiSuspicion: { score: 65, level: 'SUSPICIOUS' }
            }
        ];
    
        const demoAlerts = [
            {
                sessionId: "demo-sess-2", studentId: { name: "Bob Smith", studentId: "S-1002" }, examId: { title: "Physics Final" },
                level: "HIGH", score: 92, type: "MULTIPLE_PERSONS", message: "Multiple faces detected in frame consistently for 30s.",
                timestamp: new Date().toISOString()
            },
            {
                sessionId: "demo-sess-4", studentId: { name: "David Wilson", studentId: "S-1004" }, examId: { title: "Calculus I" },
                level: "SUSPICIOUS", score: 65, type: "LOOKING_AWAY", message: "Student repeatedly looking off-screen.",
                timestamp: new Date().toISOString()
            }
        ];
    
        demoSessions.forEach(s => sessionsMapRef.current.set(s.sessionId, s));
        demoAlerts.forEach(a => alertsMapRef.current.set(a.sessionId, a));
        tick();
    }, [tick]);

    const closeMonitor = useCallback((sessionId) => {
        if (!sessionId) return;
        if (socketRef.current) {
            socketRef.current.emit("proctoring:stop-monitoring", { sessionId });
        }
        if (rtcMapRef.current.has(sessionId)) {
            rtcMapRef.current.get(sessionId).pc?.close();
            rtcMapRef.current.delete(sessionId);
        }
        streamsRef.current.delete(sessionId);
        setMonitorSessionId(null);
        setListeningTo(null);
        tick();
    }, [tick]);

    const handleCloseMonitor = useCallback(() => {
        closeMonitor(monitorSessionId);
    }, [monitorSessionId, closeMonitor]);

    const handleDetails = useCallback((sessionId) => {
        // Open monitor in details-only mode
        handleMonitor(sessionId, 'details');
    }, [handleMonitor]);

    const handleRequestLive = useCallback(() => {
        if (monitorSessionId && socketRef.current) {
            setMonitorMode('live');
            socketRef.current.emit("proctoring:request-stream", { sessionId: monitorSessionId });
        }
    }, [monitorSessionId]);

    const handleEndSession = useCallback(async (sessionId) => {
        if (!window.confirm("Are you sure you want to terminate this student's exam session immediately?")) return;
        try {
            const token = localStorage.getItem("adminToken");
            await axios.post(`${API}/admin/proctoring/sessions/${sessionId}/end`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            handleCloseMonitor();
        } catch(e) {
            alert("Failed to terminate session: " + (e.response?.data?.message || e.message));
        }
    }, [handleCloseMonitor]);

    // ── Initial data load ─────────────────────────────────────────────────────
    const fetchState = useCallback(async (examId) => {
        setIsPageLoading(true);
        const token = localStorage.getItem("adminToken");
        if (!token) {
            setIsPageLoading(false);
            return;
        }
        try {
            const [examsRes, liveRes] = await Promise.all([
                axios.get(`${API}/admin/proctoring/active-exams`,   { headers: { Authorization: `Bearer ${token}` } }),
                axios.get(`${API}/admin/proctoring/live${examId !== "ALL" ? `?examId=${examId}` : ""}`, { headers: { Authorization: `Bearer ${token}` } })
            ]);

            setExams(examsRes.data.exams || []);

            const sessArr = liveRes.data.sessions || [];
            sessionsMapRef.current.clear();
            sessArr.forEach(s => sessionsMapRef.current.set(s._id, s));
            setSummary(liveRes.data.pagination
                ? { total: liveRes.data.pagination.total || sessArr.length }
                : { total: sessArr.length });
            tick();
        } catch(e) {
            console.error("[AdminProctoring] fetchState:", e.message);
        } finally {
            setIsPageLoading(false);
        }
    }, [tick]);

    // Fetch alerts separately
    const fetchAlerts = useCallback(async (examId) => {
        const token = localStorage.getItem("adminToken");
        if (!token) return;
        try {
            const res = await axios.get(`${API}/admin/proctoring/alerts${examId !== "ALL" ? `?examId=${examId}` : ""}`, { headers: { Authorization: `Bearer ${token}` } });
            const alerts = res.data.alerts || [];
            alertsMapRef.current.clear();
            alerts.forEach(a => alertsMapRef.current.set(a.sessionId?.toString(), a));
            tick();
        } catch { /* non-critical */ }
    }, [tick]);

    // ── Socket setup (mount only) ─────────────────────────────────────────────
    useEffect(() => {
        const token = localStorage.getItem("adminToken");
        if (!token) { window.location.href = "/admin/login"; return; }

        fetchState("ALL");
        fetchAlerts("ALL");

        const socket = io(SOCKET_URL, { auth: { token } });
        socketRef.current = socket;

        socket.on("connect", () => {
            socket.emit("proctoring:admin-join", { examId: selectedExam });
        });

        // ── Metadata events ──────────────────────────────────────────────────
        socket.on("proctoring:student-joined", (data) => {
            if (!sessionsMapRef.current.has(data.sessionId?.toString())) {
                // Fetch only this session
                const t = localStorage.getItem("adminToken");
                axios.get(`${API}/admin/proctoring/sessions/${data.sessionId}`, { headers: { Authorization: `Bearer ${t}` } })
                    .then(res => {
                        if (res.data.session) {
                            sessionsMapRef.current.set(res.data.session._id, res.data.session);
                            tick();
                        }
                    }).catch(() => {});
            }
        });

        socket.on("proctoring:student-updated", (data) => {
            const sid = data.sessionId?.toString();
            const cur = sessionsMapRef.current.get(sid);
            if (cur) { sessionsMapRef.current.set(sid, { ...cur, ...data }); tick(); }
        });

        socket.on("proctoring:heartbeat-batch", (batch) => {
            let changed = false;
            for (const b of batch) {
                const sid = b.sessionId?.toString();
                const cur = sessionsMapRef.current.get(sid);
                if (cur) { 
                    sessionsMapRef.current.set(sid, { ...cur, ...b }); 
                    changed = true; 
                } else if (sid) {
                    // Fetch the missing session!
                    const t = localStorage.getItem("adminToken");
                    axios.get(`${API}/admin/proctoring/sessions/${sid}`, { headers: { Authorization: `Bearer ${t}` } })
                        .then(res => {
                            if (res.data.session) {
                                sessionsMapRef.current.set(res.data.session._id, res.data.session);
                                tick();
                            }
                        }).catch(() => {});
                }
            }
            if (changed) tick();
        });

        socket.on("proctoring:incident", (data) => {
            const sid = data.sessionId?.toString();
            const cur = sessionsMapRef.current.get(sid);
            if (cur) {
                const updates = { incidentCount: (cur.incidentCount || 0) + 1 };
                if (data.incident?.violationType === "TAB_SWITCH") updates.tabSwitchCount = (cur.tabSwitchCount || 0) + 1;
                if (data.incident?.violationType === "WINDOW_BLUR") updates.windowBlurCount = (cur.windowBlurCount || 0) + 1;
                sessionsMapRef.current.set(sid, { ...cur, ...updates });
                tick();
            }
        });

        socket.on("proctoring:student-left", (data) => {
            const sid = data.sessionId?.toString();
            sessionsMapRef.current.delete(sid);
            alertsMapRef.current.delete(sid);
            if (rtcMapRef.current.has(sid)) {
                rtcMapRef.current.get(sid).pc?.close();
                rtcMapRef.current.delete(sid);
            }
            streamsRef.current.delete(sid);
            if (monitorSessionId === sid) { setMonitorSessionId(null); }
            tick();
        });

        // ── AI events ────────────────────────────────────────────────────────
        socket.on("proctoring:ai-alert", (alert) => {
            const sid = alert.sessionId?.toString();
            const cur = alertsMapRef.current.get(sid) || {};
            alertsMapRef.current.set(sid, {
                ...cur,
                ...alert,
                eventCount: (cur.eventCount || 0) + 1
            });
            tick();
        });

        socket.on("proctoring:ai-state-updated", (data) => {
            const sid = data.sessionId?.toString();
            const cur = sessionsMapRef.current.get(sid);
            if (cur) {
                sessionsMapRef.current.set(sid, {
                    ...cur,
                    aiSuspicion: { score: data.score, level: data.level, lastEvent: data.lastEvent, lastEventAt: data.lastEventAt }
                });
                // Update alert map if above threshold
                if (data.score >= 20) {
                    const alert = alertsMapRef.current.get(sid) || {};
                    alertsMapRef.current.set(sid, { ...alert, sessionId: data.sessionId, studentId: cur.studentId, examId: cur.examId, score: data.score, level: data.level, latestSignal: data.lastEvent, latestAt: data.lastEventAt });
                } else {
                    alertsMapRef.current.delete(sid);
                }
                tick();
            }
        });

        // ── WebRTC (admin receives offer from student) ───────────────────────
        socket.on("proctoring:offer", async ({ sessionId, studentId, offer, streamIds }) => {
            // Build RTCPeerConnection
            const pc = new RTCPeerConnection({
                iceServers: [
                    { urls: "stun:stun.l.google.com:19302" },
                    { urls: "stun:stun1.l.google.com:19302" }
                ]
            });

            const sid = sessionId?.toString();

            pc.onicecandidate = ({ candidate }) => {
                if (candidate) {
                    socket.emit("proctoring:ice-candidate", { sessionId, candidate });
                }
            };

            pc.ontrack = ({ streams: [trackStream] }) => {
                if (!trackStream || !sid) return;
                let pair = streamsRef.current.get(sid) || { camera: null, screen: null };

                if (streamIds?.screen && trackStream.id === streamIds.screen) {
                    pair = { ...pair, screen: trackStream };
                } else if (streamIds?.camera && trackStream.id === streamIds.camera) {
                    pair = { ...pair, camera: trackStream };
                } else {
                    if (!pair.camera) pair = { ...pair, camera: trackStream };
                    else              pair = { ...pair, screen: trackStream };
                }

                streamsRef.current.set(sid, pair);

                // If this is the currently monitored session, update modal streams
                setMonitorSessionId(current => {
                    if (current === sid) tick();
                    return current;
                });
            };

            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            socket.emit("proctoring:answer", { sessionId, answer });
            rtcMapRef.current.set(sid, { pc });
        });

        socket.on("proctoring:answer", async ({ sessionId, answer }) => {
            const sid = sessionId?.toString();
            const entry = rtcMapRef.current.get(sid);
            if (entry?.pc) {
                try { await entry.pc.setRemoteDescription(new RTCSessionDescription(answer)); }
                catch { /* already set */ }
            }
        });

        socket.on("proctoring:ice-candidate", async ({ sessionId, candidate }) => {
            const sid = sessionId?.toString();
            const entry = rtcMapRef.current.get(sid);
            if (entry?.pc && candidate) {
                try { await entry.pc.addIceCandidate(new RTCIceCandidate(candidate)); }
                catch { /* ignore */ }
            }
        });

        return () => {
            socket.disconnect();
            socketRef.current = null;
            for (const { pc } of rtcMapRef.current.values()) pc?.close();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Selected exam change ──────────────────────────────────────────────────
    useEffect(() => {
        if (!isMountedRef.current) { isMountedRef.current = true; return; }
        if (socketRef.current?.connected) {
            socketRef.current.emit("proctoring:admin-join", { examId: selectedExam });
        }
        fetchState(selectedExam);
        fetchAlerts(selectedExam);
    }, [selectedExam, fetchState, fetchAlerts]);

    // Refresh alerts every 60s
    useEffect(() => {
        const id = setInterval(() => fetchAlerts(selectedExam), 60_000);
        return () => clearInterval(id);
    }, [selectedExam, fetchAlerts]);

    // ── Render ─────────────────────────────────────────────────────────────────
    const sessionsList = [...sessionsMapRef.current.values()].filter(s => s.connectionStatus !== "OFFLINE");
    const alertsList   = [...alertsMapRef.current.values()].sort((a, b) => (b.score || 0) - (a.score || 0));
    const filteredList = searchQuery
        ? sessionsList.filter(s => {
            const q = searchQuery.toLowerCase();
            return s.studentId?.name?.toLowerCase().includes(q) ||
                   s.studentId?.studentId?.toLowerCase().includes(q);
          })
        : sessionsList;

    return (
        <AdminLayout>
            <style>{styles}</style>
            {isPageLoading ? (
                <div className="proctor-page">
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 24 }}>
                        <div className="skeleton-block" style={{ width: 250, height: 36 }}></div>
                        <div className="skeleton-block" style={{ width: 150, height: 36 }}></div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 32 }}>
                        <div className="skeleton-block" style={{ height: 80 }}></div>
                        <div className="skeleton-block" style={{ height: 80 }}></div>
                        <div className="skeleton-block" style={{ height: 80 }}></div>
                    </div>
                    <div className="skeleton-block" style={{ width: 200, height: 24, marginBottom: 16 }}></div>
                    <div style={{ display: "grid", gap: 16 }}>
                        <div className="skeleton-block" style={{ height: 110 }}></div>
                        <div className="skeleton-block" style={{ height: 110 }}></div>
                        <div className="skeleton-block" style={{ height: 110 }}></div>
                    </div>
                </div>
            ) : (
            <div className="proctor-page">

                {/* Page header */}
                <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
                    <div>
                        <h1 className="page-title">
                            <ShieldAlert size={22} style={{ marginRight: 10, color: "var(--brand-primary)" }} />
                            {isDemoMode ? "Demo Live Proctoring" : "Live Proctoring"}
                        </h1>
                        <p className="page-subtitle">AI-assisted monitoring · {sessionsList.length} student{sessionsList.length !== 1 ? "s" : ""} live</p>
                    </div>
                    <div style={{ display: "flex", gap: 12, alignItems: 'center' }}>
                        <div className="search-box">
                            <Filter size={14} />
                            <select value={selectedExam} onChange={e => setSelectedExam(e.target.value)}
                                style={{ border: "none", background: "transparent", color: "var(--text-primary)", outline: "none" }}>
                                <option value="ALL">All Active Exams</option>
                                {exams.map(ex => (
                                    <option key={ex._id} value={ex._id}>{ex.title} ({ex.activeStudentCount})</option>
                                ))}
                            </select>
                        </div>
                        {isDemoMode ? (
                            <button onClick={() => {
                                setIsDemoMode(false);
                                fetchState(selectedExam);
                                fetchAlerts(selectedExam);
                            }} className="btn btn-secondary">
                                Back to Live Proctoring
                            </button>
                        ) : (
                            <button onClick={handleSimulateDemo} className="btn btn-primary">
                                Simulate Demo
                            </button>
                        )}
                    </div>
                </div>

                {/* Summary stats */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 32 }}>
                    {[
                        { label: "Live Students", value: sessionsList.length, icon: <Users size={18} color="var(--brand-primary)" />, bg: "rgba(var(--brand-primary-rgb, 99,102,241),0.1)" },
                        { label: "AI Alerts",     value: alertsList.filter(a => a.level === "HIGH" || a.level === "SUSPICIOUS").length, icon: <Brain size={18} color="var(--danger)" />, bg: "rgba(255,71,87,0.1)" },
                        { label: "Monitoring",    value: rtcMapRef.current.size, icon: <Eye size={18} color="#6495ed" />, bg: "rgba(100,149,237,0.1)" },
                        { label: "Incidents",     value: sessionsList.reduce((s, x) => s + (x.incidentCount || 0), 0), icon: <AlertTriangle size={18} color="var(--warning)" />, bg: "rgba(255,171,0,0.1)" }
                    ].map(({ label, value, icon, bg }) => (
                        <div key={label} className="stat-pill" style={{ display: "flex", alignItems: "center", gap: 14 }}>
                            <div style={{ padding: 10, borderRadius: 8, background: bg }}>{icon}</div>
                            <div>
                                <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1, color: "var(--text-primary)" }}>{value}</div>
                                <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* ── A. Suspicious Activity ──────────────────────────────── */}
                {alertsList.length > 0 && (
                    <div style={{ marginBottom: 36 }}>
                        <div className="section-hdr">
                            <Brain size={18} color="var(--danger)" />
                            Suspicious Activity
                            <span style={{ fontSize: 12, padding: "2px 8px", background: "rgba(255,71,87,0.15)", color: "var(--danger)", borderRadius: 4, fontWeight: 600 }}>
                                {alertsList.length}
                            </span>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
                            {alertsList.map(alert => (
                                <AlertCard
                                    key={alert.sessionId}
                                    alert={alert}
                                    onMonitor={handleMonitor}
                                    onDetails={handleDetails}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* ── B. All Live Students ────────────────────────────────── */}
                <div>
                    <div className="section-hdr" style={{ justifyContent: "space-between" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <Users size={18} color="var(--brand-primary)" />
                            All Live Students
                            <span style={{ fontSize: 12, padding: "2px 8px", background: "var(--border-subtle)", color: "var(--text-secondary)", borderRadius: 4 }}>
                                {sessionsList.length}
                            </span>
                        </span>
                        <input
                            type="text"
                            placeholder="Search by name or ID…"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            style={{ padding: "7px 12px", fontSize: 13, borderRadius: 8, border: "1px solid var(--border-default)", background: "var(--bg-elevated)", color: "var(--text-primary)", outline: "none", width: 220 }}
                        />
                    </div>

                    {filteredList.length === 0 ? (
                        <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--text-tertiary)", background: "var(--bg-elevated)", borderRadius: 12, border: "1px dashed var(--border-subtle)" }}>
                            <MonitorPlay size={40} style={{ opacity: 0.4, marginBottom: 12 }} />
                            <div style={{ fontWeight: 600, marginBottom: 4 }}>
                                {sessionsList.length === 0 ? "No Active Sessions" : "No results"}
                            </div>
                            <div style={{ fontSize: 13 }}>
                                {sessionsList.length === 0 ? "Students will appear here when they start an exam." : "Try a different search term."}
                            </div>
                        </div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {filteredList.map(session => (
                                <StudentRow
                                    key={session._id}
                                    session={session}
                                    aiSuspicion={session.aiSuspicion}
                                    onMonitor={handleMonitor}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* ── Monitor modal ────────────────────────────────────────── */}
                {monitorSession && (
                    <MonitorModal
                        session={monitorSession}
                        streams={monitorStreams}
                        aiEvents={modalAIEvents}
                        incidents={modalIncidents}
                        onClose={handleCloseMonitor}
                        listeningTo={listeningTo}
                        onToggleListen={sid => setListeningTo(p => p === sid ? null : sid)}
                        mode={monitorMode}
                        onRequestLive={handleRequestLive}
                        onEndSession={handleEndSession}
                        isLoading={isLoadingModal}
                    />
                )}
            </div>
            )}
        </AdminLayout>
    );
};
