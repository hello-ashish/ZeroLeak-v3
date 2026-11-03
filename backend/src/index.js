import dotenv from "dotenv"
import connectDB from "./db/index.js"
import { app } from "./app.js"
import http from "http"
import { Server } from "socket.io"
import { setupProctoringSockets } from "./sockets/proctoring.socket.js"
import { initZMailNamespace } from "./sockets/zmail.socket.js"
import { setupSupportSockets } from "./sockets/support.socket.js"
import { createAdapter } from "@socket.io/redis-adapter"
import redisClient, { connectRedis } from "./redis/index.js"

dotenv.config({
    path: './.env',
    quiet: true
})

// first connect the database
connectDB()
    .then(async () => {
        // Connect Redis
        await connectRedis();

        // Initialize Mock Blockchain Ledger
        const { initFabricGateway, closeFabricGateway } = await import("./Services/fabric.service.js");
        await initFabricGateway();

        // Start IntegrityOutbox worker and self-healing reconciler
        const { startIntegrityOutboxWorker, startIntegrityReconciler } = await import("./Services/integrityOutbox.service.js");
        startIntegrityOutboxWorker();
        startIntegrityReconciler();

        const { startIntegrityWatcher } = await import("./Services/integrityWatcher.service.js");
        startIntegrityWatcher();

        const { startExamExpirationWorker } = await import("./Services/examExpiration.service.js");
        startExamExpirationWorker();
        console.log("ZeroLeak background workers initialized.");

        // Clean shutdown of Mock Blockchain on process exit
        process.on('SIGTERM', async () => { await closeFabricGateway(); process.exit(0); });
        process.on('SIGINT', async () => { await closeFabricGateway(); process.exit(0); });

        // Socket.IO CORS configuration mirroring app.js
        const { isOriginAllowed } = await import("./utils/cors.js");

        // Create HTTP server and initialize Socket.IO
        const server = http.createServer(app);
        const io = new Server(server, {
            cors: {
                origin: (origin, callback) => {
                    if (isOriginAllowed(origin)) {
                        return callback(null, true);
                    }
                    return callback(null, false);
                },
                methods: ["GET", "POST"],
                credentials: true
            }
        });

        // Setup Redis Adapter for Socket.IO (with fallback)
        try {
            const pubClient = redisClient.duplicate();
            const subClient = redisClient.duplicate();
            await Promise.all([pubClient.connect(), subClient.connect()]);
            io.adapter(createAdapter(pubClient, subClient));
            console.log("[REDIS] Socket.IO Adapter successfully configured.");
        } catch (error) {
            console.warn("[REDIS] Could not connect to Redis server. Falling back to default in-memory adapter.");
        }

        // Setup Proctoring Sockets
        setupProctoringSockets(io);

        // Setup ZMail Sockets (user-private real-time mail rooms)
        initZMailNamespace(io);

        // Setup Support Sockets (support:team room, agents only)
        setupSupportSockets(io);

        // Provision system support mailbox if it doesn't exist
        import("./Services/support/supportIdentity.service.js").then(({ ensureSupportMailbox }) => {
            ensureSupportMailbox().catch(err => console.warn("[SUPPORT] Failed to provision support mailbox:", err.message));
        });
        
        server.listen(process.env.PORT || 4000, "0.0.0.0", () => {
            console.log(`Server is running on port : ${process.env.PORT || 4000}`)

            // Run ZMail backfill in the background after server is ready
            // Ensures all existing users have ZMail accounts without blocking startup
            import("./Services/zmail/zmailIdentity.service.js").then(({ backfillAllUsers }) => {
                backfillAllUsers().then(results => {
                    if (results.created > 0 || results.errors.length > 0) {
                        console.log(`[ZMAIL] Backfill: created=${results.created} skipped=${results.skipped} errors=${results.errors.length}`);
                    }
                }).catch(err => console.warn("[ZMAIL] Backfill error:", err.message));
            });
        })
    })
    .catch((error) => {
        console.log("MongoDB connection error : ", error)
        process.exit(1)
    })