import { buildCommitmentId, computeDataHash } from '../Services/fabric.service.js';

describe('Fabric & Integrity Outbox Helpers', () => {
    describe('buildCommitmentId', () => {
        it('should generate deterministic commitment ID format', () => {
            const batchId = '6ac0101edd3c1795e0fbe305';
            const id = buildCommitmentId('Batch', batchId, 1);
            expect(id).toBe(`batch_${batchId}_v1`);
        });

        it('should handle version increments', () => {
            const examId = '6ac0101edd3c1795e0fbe306';
            const idV2 = buildCommitmentId('Exam', examId, 2);
            expect(idV2).toBe(`exam_${examId}_v2`);
        });
    });

    describe('computeDataHash', () => {
        it('should compute deterministic SHA-256 hash with canonicalized keys', () => {
            const payloadA = { title: 'Exam 1', subject: 'Math', duration: 60 };
            const payloadB = { duration: 60, title: 'Exam 1', subject: 'Math' };

            const hashA = computeDataHash(payloadA);
            const hashB = computeDataHash(payloadB);

            expect(hashA).toBe(hashB);
            expect(hashA).toMatch(/^[a-f0-9]{64}$/);
        });
    });
});
