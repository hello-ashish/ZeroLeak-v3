import dotenv from 'dotenv';
dotenv.config();

import {
    encryptQuestionContent,
    decryptQuestionContent,
    hashQuestionContent,
    verifyQuestionIntegrity
} from '../Services/crypto.service.js';

describe('Crypto & Integrity Service', () => {
    const sampleQuestion = {
        questionText: 'What is the speed of light?',
        options: ['3x10^8 m/s', '1.5x10^8 m/s', '3x10^6 m/s', 'None of these'],
        correctAnswer: '3x10^8 m/s',
        correctAnswerIndex: 0,
        subject: 'Physics',
        topic: 'Optics',
        difficultyLevel: 'Medium'
    };

    describe('Symmetric Encryption (AES-256-GCM)', () => {
        it('should correctly encrypt and decrypt question content', () => {
            const encrypted = encryptQuestionContent(sampleQuestion);
            expect(encrypted).toHaveProperty('ciphertext');
            expect(encrypted).toHaveProperty('iv');
            expect(encrypted).toHaveProperty('authTag');

            const decrypted = decryptQuestionContent(encrypted);
            expect(decrypted).toEqual(sampleQuestion);
        });

        it('should fail decryption if ciphertext is tampered', () => {
            const encrypted = encryptQuestionContent(sampleQuestion);
            const tamperedCiphertext = Buffer.from(encrypted.ciphertext, 'base64');
            tamperedCiphertext[0] ^= 0xFF;
            const tampered = { ...encrypted, ciphertext: tamperedCiphertext.toString('base64') };

            expect(() => decryptQuestionContent(tampered)).toThrow();
        });

        it('should fail decryption if authTag is altered', () => {
            const encrypted = encryptQuestionContent(sampleQuestion);
            const badTag = Buffer.alloc(16, 0).toString('base64');
            const tampered = { ...encrypted, authTag: badTag };

            expect(() => decryptQuestionContent(tampered)).toThrow();
        });
    });

    describe('Content Hashing (SHA-256 & Canonicalization)', () => {
        it('should generate identical hash regardless of key order', () => {
            const obj1 = { a: 1, b: 2, c: { x: 'hello', y: [1, 2] } };
            const obj2 = { b: 2, c: { y: [1, 2], x: 'hello' }, a: 1 };

            const hash1 = hashQuestionContent(obj1);
            const hash2 = hashQuestionContent(obj2);

            expect(hash1).toBe(hash2);
            expect(hash1).toMatch(/^[a-f0-9]{64}$/);
        });

        it('should produce different hash if options or text change', () => {
            const hash1 = hashQuestionContent(sampleQuestion);
            const modified = { ...sampleQuestion, questionText: 'What is the speed of sound?' };
            const hash2 = hashQuestionContent(modified);

            expect(hash1).not.toBe(hash2);
        });

        it('should produce different hash if metadata changes', () => {
            const hash1 = hashQuestionContent(sampleQuestion);
            const modifiedDiff = { ...sampleQuestion, difficultyLevel: 'Hard' };
            const modifiedSub = { ...sampleQuestion, subject: 'Chemistry' };

            expect(hash1).not.toBe(hashQuestionContent(modifiedDiff));
            expect(hash1).not.toBe(hashQuestionContent(modifiedSub));
        });

        it('should verify question integrity against expected hash', () => {
            const encrypted = encryptQuestionContent(sampleQuestion);
            const expectedHash = hashQuestionContent(sampleQuestion);

            const isValid = verifyQuestionIntegrity(encrypted, expectedHash, {
                subject: sampleQuestion.subject,
                topic: sampleQuestion.topic,
                difficultyLevel: sampleQuestion.difficultyLevel
            });

            expect(isValid).toBe(true);
        });
    });
});
