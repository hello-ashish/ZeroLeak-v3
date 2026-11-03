/**
 * ZMail Socket Handler
 *
 * Manages user-private rooms for real-time mail delivery.
 *
 * Room scheme:
 *   zmail:user:<userId>   — private room for each authenticated user
 *
 * Security:
 *   - The server controls room membership after JWT verification.
 *   - Clients cannot join another user's private mail room.
 *   - No private mail data is broadcast to admin-all or exam rooms.
 *   - Socket.IO Redis adapter ensures multi-instance delivery works.
 *
 * Events emitted TO clients:
 *   zmail:new-message    { messageId, threadId, senderName, senderAddress, subject, snippet, sentAt, hasAttachment }
 *   zmail:unread-count   { count }
 *
 * Events received FROM clients:
 *   zmail:join           (no payload) — authenticated user joins their private room
 *   zmail:leave          (no payload) — user leaves their private room
 */

import { getUnreadCount } from "../Services/zmail/zmail.service.js";
import { authenticateWebSocket } from "../middlewares/auth.middleware.js";

// ─── Namespace setup ──────────────────────────────────────────────────────────

export function setupZMailSockets(io) {
    const ns = io.of("/zmail");

    ns.use(authenticateWebSocket);

    ns.on("connection", async (socket) => {
        const userId = socket.user?.id?.toString();
        if (!userId) {
            socket.disconnect(true);
            return;
        }

        // Automatically join the user's private mail room
        const privateRoom = `zmail:user:${userId}`;
        socket.join(privateRoom);

        // Deliver current unread count on connect
        try {
            const count = await getUnreadCount(socket.user.id);
            socket.emit("zmail:unread-count", { count });
        } catch { /* non-fatal */ }

        // Client explicitly refreshes unread count
        socket.on("zmail:get-unread", async () => {
            try {
                const count = await getUnreadCount(socket.user.id);
                socket.emit("zmail:unread-count", { count });
            } catch { /* non-fatal */ }
        });

        socket.on("disconnect", () => {
            socket.leave(privateRoom);
        });
    });

    return ns;
}

/**
 * Helper used by zmailController to get access to the ZMail namespace
 * so it can emit events after mail operations.
 * Store namespace reference after setup.
 */
let _zmailNs = null;
export function getZMailNamespace() { return _zmailNs; }

export function initZMailNamespace(io) {
    _zmailNs = setupZMailSockets(io);
    return _zmailNs;
}
