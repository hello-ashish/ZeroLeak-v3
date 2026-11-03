import jwt from "jsonwebtoken"
import { Admin } from "../models/admin.models.js"
import { Professor } from "../models/professor.models.js"
import { Student } from "../models/student.models.js"
import { Auditor } from "../models/auditor.models.js"

export const validateSession = async (Model, decodedToken) => {
    const user = await Model.findById(decodedToken.id).select("-password");
    if (!user) {
        throw new Error("USER_NOT_FOUND");
    }
    if (user.sessionVersion !== decodedToken.sessionVersion) {
        throw new Error("SESSION_REPLACED");
    }
    if (user.isLoggedIn === false) {
        throw new Error("SESSION_TERMINATED");
    }
    if (user.isBlocked) {
        throw new Error("BLOCKED");
    }
    return user;
};

export const authenticateWebSocket = async (socket, next) => {
    try {
        const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(" ")[1];
        if (!token) return next(new Error("Authentication error: Token missing"));
        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

        let user;
        let role = decoded.role;
        
        if (role === "Student") {
            user = await validateSession(Student, decoded);
        } else if (role === "Admin") {
            user = await validateSession(Admin, decoded);
            if (user.isSupport) {
                return next(new Error("Authentication error: Support accounts cannot masquerade as Admin"));
            }
        } else if (role === "Professor") {
            user = await validateSession(Professor, decoded);
        } else if (role === "Auditor") {
            user = await validateSession(Auditor, decoded);
        } else if (role === "SupportAgent" || role === "Support") {
            user = await validateSession(Admin, decoded);
            if (!user.isSupport) {
                return next(new Error("Authentication error: User is not a support member"));
            }
            role = "Support";
        } else {
            return next(new Error("Authentication error: Invalid or missing role"));
        }
        
        socket.user = { 
            id: user._id, 
            role, 
            email: user.email, 
            studentId: user.studentId, 
            isSupport: user.isSupport 
        };
        return next();
    } catch (error) {
        return next(new Error("Authentication error: " + error.message));
    }
};

export const verifyAdminJWT = async (req, res, next) => {
    try {
        const authHeader = req.header("Authorization")
        const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : authHeader

        if (!token) {
            return res.status(401).json({ message: "Unauthorized request: No token provided" })
        }

        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)

        const admin = await validateSession(Admin, decodedToken);
        if (admin.isSupport) {
            return res.status(403).json({ message: "Forbidden: Support members cannot access Admin routes" })
        }

        req.admin = admin
        next()
    } catch (error) {
        if (error.message === "SESSION_REPLACED") {
            return res.status(401).json({ message: "This session has been replaced by a new login.", code: "SESSION_REPLACED" })
        }
        if (error.message === "SESSION_TERMINATED") {
            return res.status(401).json({ message: "Session has been terminated. Please log in again.", code: "SESSION_TERMINATED" })
        }
        if (error.message === "BLOCKED") {
            return res.status(403).json({ message: "Account is blocked.", code: "BLOCKED" })
        }
        return res.status(401).json({ message: "Invalid or Expired Access Token", code: "TOKEN_EXPIRED" })
    }
}

export const verifyProfessorJWT = async (req, res, next) => {
    try {
        const authHeader = req.header("Authorization")
        const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : authHeader

        if (!token) {
            return res.status(401).json({ message: "Unauthorized request: No token provided" })
        }

        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)
        const professor = await validateSession(Professor, decodedToken);

        req.professor = professor
        next()
    } catch (error) {
        if (error.message === "SESSION_REPLACED") {
            return res.status(401).json({ message: "This session has been replaced by a new login.", code: "SESSION_REPLACED" })
        }
        if (error.message === "SESSION_TERMINATED") {
            return res.status(401).json({ message: "Session has been terminated. Please log in again.", code: "SESSION_TERMINATED" })
        }
        if (error.message === "BLOCKED") {
            return res.status(403).json({ message: "Account is blocked.", code: "BLOCKED" })
        }
        return res.status(401).json({ message: "Invalid or Expired Access Token", code: "TOKEN_EXPIRED" })
    }
}

export const verifyStudentJWT = async (req, res, next) => {
    try {
        const authHeader = req.header("Authorization")
        const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : authHeader

        if (!token) {
            return res.status(401).json({ message: "Unauthorized request: No token provided" })
        }

        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)
        const student = await validateSession(Student, decodedToken);

        req.student = student
        next()
    } catch (error) {
        if (error.message === "SESSION_REPLACED") {
            return res.status(401).json({ message: "This session has been replaced by a new login.", code: "SESSION_REPLACED" })
        }
        if (error.message === "SESSION_TERMINATED") {
            return res.status(401).json({ message: "Session has been terminated. Please log in again.", code: "SESSION_TERMINATED" })
        }
        if (error.message === "BLOCKED") {
            return res.status(403).json({ message: "Account is blocked.", code: "BLOCKED" })
        }
        return res.status(401).json({ message: "Invalid or Expired Access Token", code: "TOKEN_EXPIRED" })
    }
}

export const verifyAuditorJWT = async (req, res, next) => {
    try {
        const authHeader = req.header("Authorization")
        const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : authHeader

        if (!token) {
            return res.status(401).json({ message: "Unauthorized request: No token provided" })
        }

        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)
        const auditor = await validateSession(Auditor, decodedToken);

        req.auditor = auditor
        next()
    } catch (error) {
        if (error.message === "SESSION_REPLACED") {
            return res.status(401).json({ message: "This session has been replaced by a new login.", code: "SESSION_REPLACED" })
        }
        if (error.message === "SESSION_TERMINATED") {
            return res.status(401).json({ message: "Session has been terminated. Please log in again.", code: "SESSION_TERMINATED" })
        }
        if (error.message === "BLOCKED") {
            return res.status(403).json({ message: "Account is blocked.", code: "BLOCKED" })
        }
        if (error.message === "USER_NOT_FOUND") {
            return res.status(401).json({ message: "Auditor not found", code: "TOKEN_EXPIRED" })
        }
        return res.status(401).json({ message: "Invalid or Expired Access Token", code: "TOKEN_EXPIRED" })
    }
}

export const verifyAdminOrAuditorJWT = async (req, res, next) => {
    try {
        const authHeader = req.header("Authorization")
        const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : authHeader

        if (!token) {
            return res.status(401).json({ message: "Unauthorized request: No token provided" })
        }

        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)

        if (decodedToken.role === "Admin") {
            const admin = await validateSession(Admin, decodedToken);
            if (admin.isSupport) {
                return res.status(403).json({ message: "Forbidden: Support members cannot access Admin/Auditor routes" });
            }
            req.admin = admin;
            req.userRole = "Admin";
            return next();
        } else if (decodedToken.role === "Auditor") {
            const auditor = await validateSession(Auditor, decodedToken);
            req.auditor = auditor;
            req.userRole = "Auditor";
            return next();
        }

        return res.status(401).json({ message: "Unauthorized request: Neither Admin nor Auditor found" })
    } catch (error) {
        if (error.message === "SESSION_REPLACED") {
            return res.status(401).json({ message: "This session has been replaced by a new login.", code: "SESSION_REPLACED" });
        }
        if (error.message === "SESSION_TERMINATED") {
            return res.status(401).json({ message: "Session has been terminated. Please log in again.", code: "SESSION_TERMINATED" });
        }
        if (error.message === "BLOCKED") {
            return res.status(403).json({ message: "Account is blocked.", code: "BLOCKED" });
        }
        return res.status(401).json({ message: "Invalid or Expired Access Token", code: "TOKEN_EXPIRED" })
    }
}

export const verifyAnyJWT = async (req, res, next) => {
    try {
        const authHeader = req.header("Authorization")
        const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : authHeader

        if (!token) {
            return res.status(401).json({ message: "Unauthorized request: No token provided" })
        }

        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)

        // Sequential lookups with early return
        if (decodedToken.role === "Admin") {
            const admin = await validateSession(Admin, decodedToken);
            if (admin.isSupport) {
                return res.status(403).json({ message: "Forbidden: Support members cannot masquerade as Admin" });
            }
            req.user = admin;
            req.userRole = "Admin";
            return next();
        } else if (decodedToken.role === "Professor") {
            const professor = await validateSession(Professor, decodedToken);
            req.user = professor;
            req.userRole = "Professor";
            return next();
        } else if (decodedToken.role === "Student") {
            const student = await validateSession(Student, decodedToken);
            req.user = student;
            req.userRole = "Student";
            return next();
        } else if (decodedToken.role === "Auditor") {
            const auditor = await validateSession(Auditor, decodedToken);
            req.user = auditor;
            req.userRole = "Auditor";
            return next();
        } else if (decodedToken.role === "SupportAgent" || decodedToken.role === "Support") {
            const admin = await validateSession(Admin, decodedToken);
            if (!admin.isSupport) {
                return res.status(403).json({ message: "Forbidden: User is not a Support member" });
            }
            req.userRole = "Support";
            req.user = admin;
            return next();
        }

        return res.status(401).json({ message: "User not found" })
    } catch (error) {
        if (error.message === "SESSION_REPLACED") {
            return res.status(401).json({ message: "This session has been replaced by a new login.", code: "SESSION_REPLACED" });
        }
        if (error.message === "SESSION_TERMINATED") {
            return res.status(401).json({ message: "Session has been terminated. Please log in again.", code: "SESSION_TERMINATED" });
        }
        if (error.message === "BLOCKED") {
            return res.status(403).json({ message: "Account is blocked.", code: "BLOCKED" });
        }
        return res.status(401).json({ message: "Invalid or Expired Access Token", code: "TOKEN_EXPIRED" })
    }
}

/**
 * Middleware that allows ONLY the standalone support account.
 */
export const verifySupportJWT = async (req, res, next) => {
    try {
        const authHeader = req.header("Authorization")
        const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : authHeader

        if (!token) {
            return res.status(401).json({ message: "Unauthorized request: No token provided" })
        }

        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)

        if (decodedToken.role !== "SupportAgent") {
            return res.status(403).json({ message: "Forbidden: Support access only" })
        }

        // Use the shared validateSession helper for consistent error handling
        const admin = await validateSession(Admin, decodedToken);
        if (!admin.isSupport) {
            return res.status(403).json({ message: "Forbidden: Support access only" })
        }

        req.userRole = "Support"
        req.user = admin
        return next()
    } catch (error) {
        if (error.message === "SESSION_REPLACED") {
            return res.status(401).json({ message: "This session has been replaced by a new login.", code: "SESSION_REPLACED" })
        }
        if (error.message === "SESSION_TERMINATED") {
            return res.status(401).json({ message: "Session has been terminated. Please log in again.", code: "SESSION_TERMINATED" })
        }
        if (error.message === "BLOCKED") {
            return res.status(403).json({ message: "Account is blocked.", code: "BLOCKED" })
        }
        return res.status(401).json({ message: "Invalid or Expired Access Token", code: "TOKEN_EXPIRED" })
    }
}