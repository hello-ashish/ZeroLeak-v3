/**
 * ZMail Identity Service
 *
 * Responsible for generating, normalizing, and resolving ZMail addresses.
 * ZMail addresses are generated once and are stable — they do not change
 * when a user's display name changes.
 *
 * Username generation strategy:
 *   1. Take the first word of the user's name, lowercase it.
 *   2. Strip all non-alphanumeric characters.
 *   3. If the result is empty, fall back to the first part of their login email.
 *   4. If <base>@zeroleak.com is taken, try <base><N>@zeroleak.com for N=1,2,3…
 *   5. Record the stable address in ZMailAccount.
 *
 * Collision safety: the unique MongoDB index on zmailAddress is the final guard.
 */

import { ZMailAccount } from "../../models/zmail/zmailAccount.models.js";
import { Admin } from "../../models/admin.models.js";
import { Professor } from "../../models/professor.models.js";
import { Student } from "../../models/student.models.js";
import { Auditor } from "../../models/auditor.models.js";

const DOMAIN = "zeroleak.com";

/**
 * Normalise an address for collision checks.
 * @param {string} address
 * @returns {string}
 */
export function normalizeAddress(address) {
    return address.toLowerCase().trim();
}

/**
 * Derive a base username from a display name or email.
 * @param {string} displayName  - user's full name
 * @param {string} loginEmail   - user's actual login email
 * @returns {string}
 */
function deriveBase(displayName, loginEmail = "") {
    // 1. Prioritize the part before @ in the login email, allowing dots.
    // e.g., avni.pandey@zeroleak.com -> avni.pandey
    const fromEmail = (loginEmail || "")
        .split("@")[0]
        .toLowerCase()
        .replace(/[^a-z0-9.]/g, "");

    if (fromEmail.length > 0) return fromEmail;

    // 2. Fallback to the first word of the name if no email is provided
    const fromName = (displayName || "")
        .trim()
        .split(/\s+/)[0]
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");

    return fromName || "user";
}

/**
 * Find a unique ZMail address for the given base username.
 * Returns the first available address by trying base, base1, base2, …
 * @param {string} base
 * @returns {Promise<string>} full zmailAddress e.g. "rahul@zeroleak.com"
 */
async function findAvailableAddress(base) {
    const candidate = `${base}@${DOMAIN}`;
    const existing = await ZMailAccount.findOne({ normalizedAddress: candidate }).select("_id").lean();
    if (!existing) return candidate;

    // Try base + number suffixes
    for (let i = 1; i <= 9999; i++) {
        const c = `${base}${i}@${DOMAIN}`;
        const ex = await ZMailAccount.findOne({ normalizedAddress: c }).select("_id").lean();
        if (!ex) return c;
    }
    throw new Error("Could not find an available ZMail address after 9999 attempts");
}

/**
 * Create a ZMailAccount for a user if one does not already exist.
 * This is idempotent — safe to call multiple times.
 *
 * @param {{ userId, userType, displayName, loginEmail }} param
 * @returns {Promise<ZMailAccount>}
 */
export async function ensureZMailAccount({ userId, userType, displayName, loginEmail }) {
    // Guard: prevent normal users from taking the protected support address
    const PROTECTED = ["support@zeroleak.com", "support"];
    if (loginEmail && PROTECTED.includes(loginEmail.toLowerCase().split("@")[0])) {
        // Only SYSTEM or Support type may use the support address
        if (userType !== "SYSTEM" && userType !== "Support") {
            throw new Error("The address 'support@zeroleak.com' is reserved and cannot be assigned to regular users.");
        }
    }

    // Idempotency check
    const existing = await ZMailAccount.findOne({ userId }).lean();
    if (existing) return existing;

    let zmailAddress = loginEmail;
    // Only use the login email directly if it is already a @zeroleak.com address.
    // External emails (gmail, etc.) must be converted to a @zeroleak.com address.
    if (!zmailAddress || !zmailAddress.toLowerCase().trim().endsWith("@zeroleak.com")) {
        const base = deriveBase(displayName, loginEmail);
        zmailAddress = await findAvailableAddress(base);
    }
    const normalizedAddress = normalizeAddress(zmailAddress);

    const account = await ZMailAccount.create({
        userId,
        userType,
        zmailAddress,
        normalizedAddress,
        displayName: (displayName || loginEmail || "").trim(),
        isSupportMailbox: (userType === "SYSTEM" || userType === "Support") && normalizedAddress === "support@zeroleak.com",
    });
    return account;
}

/**
 * Resolve a ZMail address to the corresponding ZMailAccount.
 * Returns null if not found.
 * @param {string} address
 * @returns {Promise<ZMailAccount|null>}
 */
export async function resolveAddress(address) {
    const normalized = normalizeAddress(address);
    return ZMailAccount.findOne({ normalizedAddress: normalized }).lean();
}

/**
 * Validate that an address is an internal @zeroleak.com address.
 * @param {string} address
 * @returns {boolean}
 */
export function isInternalAddress(address) {
    return typeof address === "string" && address.trim().toLowerCase().endsWith("@zeroleak.com");
}

/**
 * Look up a ZMailAccount by userId.
 * @param {string|ObjectId} userId
 * @returns {Promise<ZMailAccount|null>}
 */
export async function getAccountByUserId(userId) {
    return ZMailAccount.findOne({ userId }).lean();
}

/**
 * Backfill / ensure ZMail accounts exist for ALL current ZeroLeak users.
 * Idempotent — skips users who already have an account.
 * Safe to call multiple times (migration).
 */
export async function backfillAllUsers() {
    const results = { created: 0, skipped: 0, errors: [] };

    const processUser = async (user, userType, displayName, loginEmail) => {
        try {
            const existing = await ZMailAccount.findOne({ userId: user._id }).lean();
            if (existing) { results.skipped++; return; }
            await ensureZMailAccount({
                userId: user._id,
                userType,
                displayName,
                loginEmail,
            });
            results.created++;
        } catch (err) {
            results.errors.push({ userId: user._id.toString(), error: err.message });
        }
    };

    const [admins, professors, students, auditors] = await Promise.all([
        Admin.find({}).select("_id email").lean(),
        Professor.find({}).select("_id name email").lean(),
        Student.find({}).select("_id name email").lean(),
        Auditor.find({}).select("_id name email").lean(),
    ]);

    for (const a of admins)    await processUser(a, "Admin",    a.email?.split("@")[0] || "Admin",    a.email);
    for (const p of professors) await processUser(p, "Professor", p.name || "",                         p.email);
    for (const s of students)   await processUser(s, "Student",   s.name || "",                         s.email);
    for (const au of auditors)  await processUser(au, "Auditor",  au.name || au.email?.split("@")[0] || "Auditor", au.email);

    return results;
}
