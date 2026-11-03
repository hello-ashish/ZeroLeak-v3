import React from 'react';
import { Video, Mic, ShieldAlert, MonitorPlay, Wifi } from 'lucide-react';

export const ProctoringStatusPanel = ({ stream, cameraStatus, microphoneStatus, isStarted }) => {
    if (!isStarted) return null;

    return (
        <div className="card" style={{ padding: '16px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
                <ShieldAlert size={16} color="var(--brand-primary)" />
                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Live Proctoring Active</h4>
            </div>

            <div style={{ 
                width: '100%', 
                aspectRatio: '16/9', 
                backgroundColor: '#000', 
                borderRadius: '8px',
                overflow: 'hidden',
                position: 'relative'
            }}>
                {stream?.camera ? (
                    <video 
                        ref={(el) => {
                            if (el && stream.camera) {
                                if (el.srcObject !== stream.camera) {
                                    el.srcObject = stream.camera;
                                }
                                const playPromise = el.play();
                                if (playPromise !== undefined) {
                                    playPromise.catch(e => console.error("Auto-play error:", e));
                                }
                            }
                        }}
                        autoPlay 
                        playsInline 
                        muted 
                        style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} // mirror for self
                    />
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-tertiary)' }}>
                        <Video size={24} style={{ marginBottom: '8px' }} />
                        <span style={{ fontSize: '12px' }}>Connecting...</span>
                    </div>
                )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}><Video size={12} style={{ marginRight: '4px' }}/> Camera</span>
                    <span style={{ color: cameraStatus === 'CONNECTED' ? 'var(--success)' : 'var(--danger)' }}>{cameraStatus}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}><Mic size={12} style={{ marginRight: '4px' }}/> Microphone</span>
                    <span style={{ color: microphoneStatus === 'CONNECTED' ? 'var(--success)' : 'var(--danger)' }}>{microphoneStatus}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}><Wifi size={12} style={{ marginRight: '4px' }}/> Proctoring</span>
                    <span style={{ color: 'var(--success)' }}>CONNECTED</span>
                </div>
            </div>
            
            {(cameraStatus === 'PERMISSION_DENIED' || microphoneStatus === 'PERMISSION_DENIED') && (
                <div style={{ padding: '8px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', borderRadius: '6px', fontSize: '12px' }}>
                    Please allow camera and microphone access to proceed with the exam.
                </div>
            )}
        </div>
    );
};
