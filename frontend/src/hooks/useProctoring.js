/**
 * useProctoring — Student-side proctoring hook
 *
 * Responsibilities:
 *   - Acquire camera + mic + screen capture independently of socket lifecycle
 *   - Maintain heartbeat over Socket.IO
 *   - Handle screen-share track-ending (user stops sharing)
 *   - Respond to on-demand WebRTC stream requests from admin
 *   - Report behavioural incidents (tab switch, window blur, fullscreen exit…)
 *   - Signal to server when media is ready (to fulfil pending admin requests)
 *
 * State ownership (this hook):
 *   - streamRef  useRef      — latest live MediaStream pair (no React state)
 *   - socketRef  useRef      — socket (no React state, avoids re-renders)
 *   - peerConnectionRef useRef — active RTCPeerConnection
 *
 * WebRTC protocol (all events use sessionId, never arbitrary socketId):
 *   Admin → proctoring:request-stream { sessionId }
 *   Server → student room: proctoring:stream-requested { adminSocketId }
 *   Student → Admin: proctoring:offer { adminSocketId, offer, streamIds }
 *   Admin → Student room: proctoring:answer { sessionId, answer }
 *   ICE: both sides → proctoring:ice-candidate { sessionId|adminSocketId, candidate }
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { io } from "socket.io-client";

const BACKEND_URL        = import.meta.env.DEV ? "" : "https://zeroleak-v2.onrender.com";
const SOCKET_URL         = `${BACKEND_URL}/proctoring`;
const HEARTBEAT_INTERVAL = 10_000; // 10 s

export const useProctoring = (examId, isStarted) => {
    const [cameraStatus,    setCameraStatus]    = useState("UNKNOWN");
    const [microphoneStatus,setMicrophoneStatus]= useState("UNKNOWN");
    const [screenStatus,    setScreenStatus]    = useState("UNKNOWN");

    const socketRef          = useRef(null);
    const peerConnectionRef  = useRef(null);
    const streamRef          = useRef(null);        // { camera: MediaStream, screen: MediaStream }
    const mediaReadyRef      = useRef(false);       // true once both streams are acquired
    const statusRefs         = useRef({ cameraStatus: "UNKNOWN", microphoneStatus: "UNKNOWN", screenStatus: "UNKNOWN" });

    // Keep status refs in sync (heartbeat closure reads these)
    useEffect(() => {
        statusRefs.current = { cameraStatus, microphoneStatus, screenStatus };
    }, [cameraStatus, microphoneStatus, screenStatus]);

    // ── Effect 1: Media acquisition ─────────────────────────────────────────
    // Independent of socket.  Socket can reconnect without re-requesting permissions.
    useEffect(() => {
        if (!isStarted) return;

        let activeCam  = null;
        let activeScr  = null;
        let mounted    = true;

        const initMedia = async () => {
            // 1. Camera + Mic
            try {
                const camStream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        width:     { ideal: 320, max: 640 },
                        height:    { ideal: 240, max: 480 },
                        frameRate: { ideal: 10,  max: 15  }
                    },
                    audio: true
                });
                if (!mounted) { camStream.getTracks().forEach(t => t.stop()); return; }

                activeCam = camStream;
                setCameraStatus("CONNECTED");
                setMicrophoneStatus("CONNECTED");

                // 2. Screen capture
                try {
                    const scrStream = await navigator.mediaDevices.getDisplayMedia({
                        video: {
                            width:     { ideal: 1280, max: 1280 },
                            height:    { ideal: 720,  max: 720  },
                            frameRate: { ideal: 10,   max: 15   }
                        },
                        audio: false
                    });
                    if (!mounted) { camStream.getTracks().forEach(t => t.stop()); scrStream.getTracks().forEach(t => t.stop()); return; }

                    activeScr = scrStream;
                    setScreenStatus("CONNECTED");

                    // Listen for user stopping screen share (browser "Stop sharing" button)
                    scrStream.getVideoTracks().forEach(track => {
                        track.addEventListener("ended", () => {
                            if (!mounted) return;
                            setScreenStatus("STOPPED");
                            streamRef.current = streamRef.current
                                ? { ...streamRef.current, screen: null }
                                : { camera: null, screen: null };
                            // Notify server via proctoring:event
                            if (socketRef.current) {
                                socketRef.current.emit("proctoring:event", {
                                    type:        "SCREEN_SHARE_STOPPED",
                                    severity:    "HIGH",
                                    description: "Student stopped screen sharing",
                                    details:     {}
                                });
                                socketRef.current.emit("proctoring:status", {
                                    screenStatus: "STOPPED"
                                });
                            }
                        });
                    });

                    streamRef.current  = { camera: activeCam, screen: activeScr };
                    mediaReadyRef.current = true;

                    // Tell server media is ready (fulfils any pending admin request)
                    if (socketRef.current) {
                        socketRef.current.emit("proctoring:media-ready");
                    }

                } catch(scrErr) {
                    if (!mounted) return;
                    console.warn("[useProctoring] Screen capture failed:", scrErr.name);
                    if (scrErr.name === "NotAllowedError") setScreenStatus("PERMISSION_DENIED");
                    else setScreenStatus("NOT_AVAILABLE");
                    // Camera is still available even without screen
                    streamRef.current     = { camera: activeCam, screen: null };
                    mediaReadyRef.current = true;
                    if (socketRef.current) socketRef.current.emit("proctoring:media-ready");
                }
            } catch(camErr) {
                if (!mounted) return;
                console.error("[useProctoring] Camera/mic failed:", camErr.name);
                if (camErr.name === "NotAllowedError") {
                    setCameraStatus("PERMISSION_DENIED");
                    setMicrophoneStatus("PERMISSION_DENIED");
                } else if (camErr.name === "NotFoundError") {
                    setCameraStatus("NOT_FOUND");
                    setMicrophoneStatus("NOT_FOUND");
                } else {
                    setCameraStatus("DEVICE_ERROR");
                    setMicrophoneStatus("DEVICE_ERROR");
                }
                if (socketRef.current) {
                    socketRef.current.emit("proctoring:status", {
                        cameraStatus:     statusRefs.current.cameraStatus,
                        microphoneStatus: statusRefs.current.microphoneStatus
                    });
                }
            }
        };

        initMedia();

        return () => {
            mounted = false;
            activeCam?.getTracks().forEach(t => t.stop());
            activeScr?.getTracks().forEach(t => t.stop());
            streamRef.current     = null;
            mediaReadyRef.current = false;
        };
    }, [isStarted]);

    // ── Effect 2: Socket + WebRTC lifecycle ─────────────────────────────────
    useEffect(() => {
        if (!isStarted) return;

        const token = localStorage.getItem("studentToken");
        if (!token) return;

        const socket = io(SOCKET_URL, { auth: { token } });
        socketRef.current = socket;

        socket.on("connect", () => {
            socket.emit("proctoring:join", { examId });
        });

        socket.on("proctoring:terminated", (data) => {
            window.dispatchEvent(new CustomEvent("proctoring-force-terminate", { detail: data?.reason }));
        });

        socket.on("proctoring:session-ready", ({ sessionId }) => {
            // If media was already ready before the socket connected, signal now
            if (mediaReadyRef.current) {
                socket.emit("proctoring:media-ready");
            }
        });

        // Heartbeat — reads statusRefs for the latest values
        const heartbeatInterval = setInterval(() => {
            socket.emit("proctoring:heartbeat", {
                cameraStatus:     statusRefs.current.cameraStatus,
                microphoneStatus: statusRefs.current.microphoneStatus,
                fullscreenStatus: document.fullscreenElement ? "ACTIVE" : "INACTIVE",
                screenStatus:     statusRefs.current.screenStatus
            });
        }, HEARTBEAT_INTERVAL);

        // ── WebRTC: Admin requested this student's stream ─────────────────
        socket.on("proctoring:stream-requested", async ({ adminSocketId }) => {
            const current = streamRef.current;

            if (!current) {
                // Media not ready yet — let server know to queue
                socket.emit("proctoring:stream-not-ready", { adminSocketId });
                return;
            }

            // Teardown any existing peer connection before starting a new one
            if (peerConnectionRef.current) {
                peerConnectionRef.current.close();
                peerConnectionRef.current = null;
            }

            const pc = new RTCPeerConnection({
                iceServers: [
                    { urls: "stun:stun.l.google.com:19302" },
                    { urls: "stun:stun1.l.google.com:19302" }
                ]
            });
            peerConnectionRef.current = pc;

            if (current.camera) {
                current.camera.getTracks().forEach(t => pc.addTrack(t, current.camera));
            }
            if (current.screen) {
                current.screen.getTracks().forEach(t => pc.addTrack(t, current.screen));
            }

            // ICE — send to admin socket directly (server routes it)
            pc.onicecandidate = ({ candidate }) => {
                if (candidate) {
                    socket.emit("proctoring:ice-candidate", { adminSocketId, candidate });
                }
            };

            pc.oniceconnectionstatechange = () => {
                if (["failed", "closed"].includes(pc.iceConnectionState)) {
                    pc.close();
                    if (peerConnectionRef.current === pc) peerConnectionRef.current = null;
                }
            };

            try {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);

                socket.emit("proctoring:offer", {
                    adminSocketId,
                    offer,
                    streamIds: {
                        camera: current.camera?.id || null,
                        screen: current.screen?.id || null
                    }
                });
            } catch(e) {
                console.error("[useProctoring] createOffer failed:", e);
                pc.close();
                peerConnectionRef.current = null;
            }
        });

        // Answer from admin
        socket.on("proctoring:answer", async ({ answer }) => {
            if (peerConnectionRef.current) {
                try {
                    await peerConnectionRef.current.setRemoteDescription(
                        new RTCSessionDescription(answer)
                    );
                } catch(e) {
                    console.error("[useProctoring] setRemoteDescription failed:", e);
                }
            }
        });

        // ICE candidate from admin
        socket.on("proctoring:ice-candidate", async ({ candidate }) => {
            if (peerConnectionRef.current && candidate) {
                try {
                    await peerConnectionRef.current.addIceCandidate(
                        new RTCIceCandidate(candidate)
                    );
                } catch(e) {
                    console.error("[useProctoring] addIceCandidate failed:", e);
                }
            }
        });

        // Admin stopped monitoring — close peer connection
        socket.on("proctoring:monitoring-stopped", () => {
            if (peerConnectionRef.current) {
                peerConnectionRef.current.close();
                peerConnectionRef.current = null;
            }
        });

        return () => {
            clearInterval(heartbeatInterval);
            socket.emit("proctoring:leave");
            socket.disconnect();
            socketRef.current = null;
            if (peerConnectionRef.current) {
                peerConnectionRef.current.close();
                peerConnectionRef.current = null;
            }
        };
    }, [isStarted, examId]);

    // ── Public API ────────────────────────────────────────────────────────────
    const reportIncident = useCallback((type, severity = "MEDIUM", description = "", details = {}) => {
        if (socketRef.current) {
            socketRef.current.emit("proctoring:event", { type, severity, description, details });
        }
    }, []);

    return {
        // Expose current stream snapshot (for local preview, not for grid)
        stream:           streamRef.current,
        cameraStatus,
        microphoneStatus,
        screenStatus,
        reportIncident
    };
};
