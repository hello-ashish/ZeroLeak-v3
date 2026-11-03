/**
 * Support Identity Service
 *
 * Manages the system-level support mailbox: support@zeroleak.com
 * This is a protected service account — cannot be registered by regular users.
 *
 * The support mailbox has a synthetic userId (a fixed ObjectId) so it can
 * integrate naturally with ZMailAccount and ZMailMessage author fields.
 */

import mongoose from "mongoose";
import { ZMailAccount } from "../../models/zmail/zmailAccount.models.js";

// Fixed synthetic ObjectId for the support system account.
// This is NOT a real user — it's a system identity.
export const SUPPORT_SYSTEM_ID = new mongoose.Types.ObjectId("000000000000000000005570"); // "support"
export const SUPPORT_EMAIL = "support@zeroleak.com";
export const SUPPORT_DISPLAY_NAME = "ZeroLeak Support";
export const SUPPORT_ADDRESS_NORMALIZED = "support@zeroleak.com";

/**
 * Provision the support@zeroleak.com ZMail account if it doesn't exist.
 * Idempotent — safe to call on every startup.
 */
export async function ensureSupportMailbox() {
    const existing = await ZMailAccount.findOne({
        normalizedAddress: SUPPORT_ADDRESS_NORMALIZED,
    }).lean();

    if (existing) return existing;

    const account = await ZMailAccount.create({
        userId: SUPPORT_SYSTEM_ID,
        userType: "SYSTEM",
        isSupportMailbox: true,
        zmailAddress: SUPPORT_EMAIL,
        normalizedAddress: SUPPORT_ADDRESS_NORMALIZED,
        displayName: SUPPORT_DISPLAY_NAME,
        mailboxStatus: "active",
    });

    console.log("[SUPPORT] Support mailbox provisioned:", SUPPORT_EMAIL);
    return account;
}

/**
 * Get the support ZMailAccount.
 */
export async function getSupportAccount() {
    return ZMailAccount.findOne({ normalizedAddress: SUPPORT_ADDRESS_NORMALIZED }).lean();
}

/**
 * Check whether a userId matches the support system account.
 */
export function isSupportUserId(userId) {
    return userId?.toString() === SUPPORT_SYSTEM_ID.toString();
}

/**
 * Guard: prevent a normal user from sending as support@zeroleak.com
 * Call before any send/reply where the from address matters.
 */
export function assertNotImpersonatingSupport(senderAddress, senderUserId) {
    const addr = (senderAddress || "").toLowerCase().trim();
    if (addr === SUPPORT_ADDRESS_NORMALIZED && !isSupportUserId(senderUserId)) {
        throw new Error("Forbidden: cannot impersonate the support mailbox.");
    }
}
