import express from "express"
import cors from "cors"
import questionRouter from "./routes/question.routes.js"
import examRouter from "./routes/exam.routes.js"
import examinationRouter from "./routes/examination.routes.js"
import studentRouter from "./routes/student.routes.js"
import adminRouter from "./routes/admin.routes.js"
import professorRouter from "./routes/professor.routes.js"
import auditorRouter from "./routes/auditor.routes.js"
import cheatingRouter from "./routes/cheating.routes.js"

import searchRouter from "./routes/search.routes.js"
import proctoringRouter from "./routes/proctoring.routes.js"
import aiRouter from "./routes/ai.routes.js"
import zmailRouter from "./routes/zmail.routes.js"
import supportRouter from "./routes/support.routes.js"
import integrityRouter from "./routes/integrity.routes.js"
import { setupSwagger } from "./swagger.js"
import { corsOptions } from "./utils/cors.js"

const app = express()

// Enable secure CORS with automatic support for Vercel, Render, and configured origins
app.use(cors(corsOptions))

// Container Healthcheck probes
app.get(["/health", "/api/health"], (req, res) => {
    res.status(200).json({ status: "healthy", timestamp: new Date().toISOString(), uptime: process.uptime() });
});

// we need this to parse json data coming from requests (like req.body)
app.use((req, res, next) => {
    if (req.path.includes("/zmail/attachments") || req.path.includes("/ai") || req.path.includes("/questions/bulk") || req.path.includes("/question/bulk")) {
        return express.json({ limit: "50mb" })(req, res, next);
    }
    return express.json({ limit: "2mb" })(req, res, next);
});

app.use((req, res, next) => {
    if (req.path.includes("/zmail/attachments") || req.path.includes("/ai") || req.path.includes("/questions/bulk") || req.path.includes("/question/bulk")) {
        return express.urlencoded({ extended: true, limit: "50mb" })(req, res, next);
    }
    return express.urlencoded({ extended: true, limit: "2mb" })(req, res, next);
});
app.use(express.static("public"))

// this says: any request starting with /api/admin goes to the adminRouter
app.use("/api/admin", adminRouter)
app.use("/api/admin/examinations", examinationRouter)
app.use("/api/admin/proctoring", proctoringRouter)
// http://localhost:4000/api/admin/

// this says: any request starting with /api/professor goes to the professorRouter
app.use("/api/professor", professorRouter)

// AI-assisted professor endpoints
app.use("/api/professor/ai", aiRouter)
// Global AI endpoints (for admin)
app.use("/api/ai", aiRouter)

// Tell the app to use our new question routes!
app.use("/api/question", questionRouter)
app.use("/api/questions", questionRouter)

// Exam route
app.use("/api/exams", examRouter)

// Student route
app.use("/api/students", studentRouter);

// Auditor route
app.use("/api/auditor", auditorRouter);

// Anti-cheating & security telemetry routes
app.use("/api/anti-cheating", cheatingRouter);

// Fabric integrity verification routes (Admin + Auditor only; Support is blocked)
app.use("/api/integrity", integrityRouter)

// Global search route
app.use("/api/search", searchRouter);

// ZMail internal messaging system
app.use("/api/zmail", zmailRouter);

// ZeroLeak Support System
app.use("/api/support", supportRouter);

setupSwagger(app);

// Centralized JSON error handler
app.use((err, req, res, next) => {
    console.error("[GLOBAL ERROR]:", err.message || err);
    const status = err.status || err.statusCode || 500;
    res.status(status).json({
        message: err.message || "Internal server error"
    });
});

export { app }
