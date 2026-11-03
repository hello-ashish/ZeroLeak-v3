import { Router } from "express";
import { getMyNotifications, markAsRead, markAllAsRead } from "../controllers/notification.controllers.js";

const router = Router();

// These routes will be mounted on /api/admin/notifications, /api/student/notifications, etc.
// The actual middleware (verifyAdminJWT, etc.) should be applied before mounting this router,
// or we can pass a generic middleware if we had one.
// Since we have separate routers for each role, it's easier to mount this directly in app.js
// but with a special flexible auth middleware. Let's just create a quick middleware here for convenience,
// or we can mount it in the specific role routers.
// Let's mount them inside the role routers (e.g. admin.routes.js) so the auth is guaranteed.

router.get("/", getMyNotifications);
router.patch("/:id/read", markAsRead);
router.patch("/read-all", markAllAsRead);

export default router;
