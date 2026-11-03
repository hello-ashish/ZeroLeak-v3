# ZeroLeak Blockchain Ledger

## Purpose
ZeroLeak uses a permissioned, MongoDB-backed, tamper-evident blockchain ledger to record cryptographic commitments for protected question batches and exams. Sensitive question text, options, answers, ciphertext, IVs, authentication tags, and encryption keys are never written to the ledger.

## Flow
1. A submitted batch is approved by an administrator.
2. The approved questions are encrypted with AES-256-GCM and fingerprinted with SHA-256.
3. The question hashes are combined into a Merkle root.
4. A `BATCH_COMMITMENT` block stores the batch ID, Merkle root, safe metadata, timestamp, previous block hash, commitment hash, and current block hash.
5. Exam creation creates an `EXAM_COMMITMENT` block using the exam Merkle root.
6. Every block links to the previous block through `previousHash`.
7. `/api/admin/blockchain/verify` recomputes every block hash and every previous-hash link.

## Block fields
- `blockIndex`: sequential height
- `blockType`: GENESIS, BATCH_COMMITMENT, or EXAM_COMMITMENT
- `entityId` / `entityLabel`: referenced batch or exam
- `merkleRoot`: integrity commitment for the question set
- `commitmentHash`: deterministic hash of the commitment payload
- `previousHash`: hash of the previous block
- `hash`: hash of the complete current block
- `metadata`: non-sensitive operational metadata only
- `timestamp`: append time

## Security boundary
The blockchain is an integrity/history layer, not the question-storage layer. AES-256-GCM protects confidentiality, SHA-256 fingerprints individual protected questions, the Merkle tree fingerprints the complete question set, and the blockchain preserves the sequence of those commitments.

## Admin interface
Open `/admin/blockchain` after administrator login to inspect blocks, search the ledger, view safe block details, refresh status, and run full-chain verification.

## Tamper demonstration
If a stored block's `hash` or `previousHash` is changed, chain verification reports the affected block and the reason for failure. There are intentionally no update/delete APIs for blockchain blocks.
