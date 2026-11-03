import crypto from "crypto";

function hashPair(left, right) {
    const combined = left < right ? left + right : right + left;
    return crypto
        .createHash("sha256")
        .update(combined, "utf8")
        .digest("hex");
}

export function buildMerkleRoot(hashes) {
    if (!Array.isArray(hashes) || hashes.length === 0) {
        return null;
    }

    const invalidHashes = hashes.filter(
        (hash) =>
            typeof hash !== "string" ||
            !/^[a-fA-F0-9]{64}$/.test(hash)
    );

    if (invalidHashes.length > 0) {
        throw new Error(
            "Merkle tree can only be built from valid SHA-256 hashes."
        );
    }

    // Sort the initial leaf hashes lexicographically to make the tree order-independent of question order.
    // Intermediate pairs are sorted within hashPair (left < right ? left+right : right+left) ensuring
    // canonical, deterministic pairing throughout the tree.
    let level = [...hashes].sort();

    while (level.length > 1) {
        const nextLevel = [];

        for (let i = 0; i < level.length; i += 2) {
            const left = level[i];

            const right =
                level[i + 1] !== undefined
                    ? level[i + 1]
                    : level[i];

            nextLevel.push(
                hashPair(left, right)
            );
        }

        level = nextLevel;
    }

    return level[0];
}