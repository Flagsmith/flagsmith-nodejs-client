import { generateSignature, verifySignature } from '../../sdk/webhooks.js';
import { describe, it, expect } from 'vitest';

describe('webhooks', () => {
    it('test_generate_signature', () => {
        // Given
        const requestBody = Buffer.from(JSON.stringify({ data: { foo: 123 } }));
        const sharedSecret = 'shh';

        // When
        const signature = generateSignature(requestBody, sharedSecret);

        // Then
        expect(signature.toString('hex')).toHaveLength(64); // SHA-256 hex digest is 64 characters
    });

    it('test_verify_signature_valid', () => {
        // Given
        const requestBody = Buffer.from(JSON.stringify({ data: { foo: 123 } }));
        const sharedSecret = 'shh';

        // When
        const signature = generateSignature(requestBody, sharedSecret);

        // Then
        expect(verifySignature(requestBody, signature, sharedSecret)).toBe(true);
    });

    it('test_verify_signature_invalid', () => {
        // Given
        const requestBody = Buffer.from(
            JSON.stringify({ event: 'flag_updated', data: { id: 123 } })
        );

        // When
        const wrongSignature = generateSignature(Buffer.from('???'), '?');

        // Then
        expect(verifySignature(requestBody, wrongSignature, '?')).toBe(false);

        expect(() =>
            verifySignature(requestBody, Buffer.from('some invalid signature'), '???')
        ).toThrow('Input buffers must have the same byte length');
    });
});
