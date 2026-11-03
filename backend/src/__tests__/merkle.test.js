import crypto from 'crypto';
import { buildMerkleRoot } from '../Services/merkle.service.js';

function sha256(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
}

describe('Merkle Tree Service', () => {
    const h1 = sha256('question-1');
    const h2 = sha256('question-2');
    const h3 = sha256('question-3');
    const h4 = sha256('question-4');

    it('should return null for empty array', () => {
        expect(buildMerkleRoot([])).toBeNull();
    });

    it('should return the single leaf for array of length 1', () => {
        expect(buildMerkleRoot([h1])).toBe(h1);
    });

    it('should build a valid Merkle root for even number of leaves', () => {
        const root = buildMerkleRoot([h1, h2, h3, h4]);
        expect(root).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should be order-independent (Lexicographical Merkle Tree)', () => {
        const root1 = buildMerkleRoot([h1, h2, h3, h4]);
        const root2 = buildMerkleRoot([h4, h2, h1, h3]);
        expect(root1).toBe(root2);
    });

    it('should detect leaf modification and produce a different root', () => {
        const originalRoot = buildMerkleRoot([h1, h2, h3, h4]);
        const tamperedLeaf = sha256('question-1-TAMPERED');
        const tamperedRoot = buildMerkleRoot([tamperedLeaf, h2, h3, h4]);
        expect(tamperedRoot).not.toBe(originalRoot);
    });
});
