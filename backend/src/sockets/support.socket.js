/**
 * Support Socket Handler
 *
 * Manages the real-time support team room: support:team
 *
 * Security:
 *   - Only admin accounts with isSupport = true may join the support room.
 *   - Clients cannot self-assign to arbitrary rooms.
 *   - New ticket events and ticket updates are only broadcast to this room.
 *
 * Events emitted TO support clients:
 *   support:new-ticket      { ticketId, ticketNumber, title, reporterName, ... }
 *   support:ticket-updated  { ticketId, ticketNumber, status, event }
 *
 * Events received FROM clients:
 *   support:join            (no payload) — joins the support:team room after auth check
 */

import { authenticateWebSocket } from "../middlewares/auth.middleware.js";

function verifySupport(socket, next) {
    if (!socket.user || !socket.user.isSupport) {
        return next(new Error("Support auth: not a support team member"));
    }
    next();
}

let _supportNs = null;

export function getSupportSocketNamespace() {
    return _supportNs;
}

export function setupSupportSockets(io) {
    const ns = io.of("/support");
    ns.use(authenticateWebSocket);
    ns.use(verifySupport);

    ns.on("connection", (socket) => {
        const agent = socket.user;
        if (!agent) { socket.disconnect(true); return; }

        // Automatically join the protected support room
        socket.join("support:team");

        socket.on("support:leave", () => {
            socket.leave("support:team");
        });

        socket.on("disconnect", () => {
            socket.leave("support:team");
        });
    });

    _supportNs = ns;
    return ns;
}
