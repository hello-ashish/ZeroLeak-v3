import { Notification } from "../models/notification.models.js";
import { Admin } from "../models/admin.models.js";
import { Auditor } from "../models/auditor.models.js";

// Helper function to create a notification (to be used within other controllers)
export const createNotification = async ({ userId, userRole, title, message, type = "INFO", relatedLink = null }) => {
    try {
        await Notification.create({
            userId,
            userRole,
            title,
            message,
            type,
            relatedLink
        });
    } catch (error) {
        console.error("Error creating notification:", error);
    }
};

// Helper function to broadcast to all Admins (excludes support members)
export const notifyAdmins = async ({ title, message, type = "INFO", relatedLink = null }) => {
    try {
        const admins = await Admin.find({ isSupport: { $ne: true } }).select("_id");
        const notifications = admins.map(admin => ({
            userId: admin._id,
            userRole: "Admin",
            title,
            message,
            type,
            relatedLink
        }));
        if (notifications.length > 0) {
            await Notification.insertMany(notifications);
        }
    } catch (error) {
        console.error("Error notifying admins:", error);
    }
};

// Helper function to broadcast to all Auditors
export const notifyAuditors = async ({ title, message, type = "INFO", relatedLink = null }) => {
    try {
        const auditors = await Auditor.find({}).select("_id");
        const notifications = auditors.map(auditor => ({
            userId: auditor._id,
            userRole: "Auditor",
            title,
            message,
            type,
            relatedLink
        }));
        if (notifications.length > 0) {
            await Notification.insertMany(notifications);
        }
    } catch (error) {
        console.error("Error notifying auditors:", error);
    }
};

// --- API Endpoints ---

// Get all notifications for the authenticated user
export const getMyNotifications = async (req, res) => {
    try {
        // The user ID and role come from the respective auth middleware
        // But since we might have different auth middlewares (admin, student, etc.) calling this same endpoint,
        // we need to determine the user dynamically or pass it.
        // A better approach is to have the middleware inject a common `req.user` and `req.userRole`.
        // Let's resolve the user from the req object (based on existing middlewares)
        const userId = req.user?._id || req.admin?._id || req.student?._id || req.professor?._id || req.auditor?._id;

        if (!userId) {
            return res.status(401).json({ message: "Unauthorized: User not found in request" });
        }

        const notifications = await Notification.find({ userId })
            .sort({ createdAt: -1 })
            .limit(50); // Fetch latest 50

        const unreadCount = await Notification.countDocuments({ userId, isRead: false });

        return res.status(200).json({ notifications, unreadCount });
    } catch (error) {
        console.error("Error fetching notifications:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// Mark a specific notification as read
export const markAsRead = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?._id || req.admin?._id || req.student?._id || req.professor?._id || req.auditor?._id;

        const notification = await Notification.findOneAndUpdate(
            { _id: id, userId },
            { isRead: true },
            { returnDocument: 'after' }
        );

        if (!notification) {
            return res.status(404).json({ message: "Notification not found" });
        }

        return res.status(200).json({ message: "Marked as read", notification });
    } catch (error) {
        console.error("Error marking notification as read:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// Mark all notifications as read for the user
export const markAllAsRead = async (req, res) => {
    try {
        const userId = req.user?._id || req.admin?._id || req.student?._id || req.professor?._id || req.auditor?._id;

        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        await Notification.updateMany(
            { userId, isRead: false },
            { isRead: true }
        );

        return res.status(200).json({ message: "All notifications marked as read" });
    } catch (error) {
        console.error("Error marking all as read:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
