import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Generates a signature for a webhook request body using HMAC-SHA256.
 * @param requestBody The unmodified request body received by your webhook listener.
 * @param sharedSecret The shared secret configured for this specific webhook.
 */
export function generateSignature(requestBody: Buffer, sharedSecret: string): Buffer {
    return createHmac('sha256', sharedSecret).update(requestBody).digest();
}

/**
 * Verifies a webhook's signature to determine if the request was sent by Flagsmith.
 * @param requestBody The unmodified request body received by your webhook listener.
 * @param receivedSignature The signature received in the webhook's X-Flagsmith-Signature request header.
 * @param sharedSecret The shared secret configured for this specific webhook.
 * @return True if the signature is valid, false otherwise.
 * @throws RangeError receivedSignature is of a different length than the generated signature.
 */
export function verifySignature(
    requestBody: Buffer,
    receivedSignature: Buffer,
    sharedSecret: string
): boolean {
    const expectedSignature = generateSignature(requestBody, sharedSecret);
    return timingSafeEqual(expectedSignature, receivedSignature);
}
