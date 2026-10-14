// Stripe-style webhook signatures, following stripe-node's src/Webhooks.ts:
//   header:  Stripe-Signature: t=<unix seconds>,v1=<hex signature>[,v1=...]
//   signed:  HMAC-SHA256(secret, "<t>.<raw body>")
//   window:  reject timestamps more than 300 seconds old
import { WebhookRejectedError } from '../core/types';

export const DEFAULT_TOLERANCE_SECONDS = 300;
const SCHEME = 'v1';

const encoder = new TextEncoder();

/** Hex HMAC-SHA256, using the Web Crypto API built into browsers and Node. */
export async function computeSignature(secret: string, signedPayload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(signedPayload));
  return Array.from(new Uint8Array(mac), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function signatureHeader(secret: string, payload: string, timestampSeconds: number): Promise<string> {
  return `t=${timestampSeconds},${SCHEME}=${await computeSignature(secret, `${timestampSeconds}.${payload}`)}`;
}

function parseHeader(header: string): { timestamp: number; signatures: string[] } | null {
  let timestamp = Number.NaN;
  const signatures: string[] = [];
  for (const item of header.split(',')) {
    const [key, value] = item.trim().split('=', 2);
    if (key === 't' && value !== undefined && /^\d+$/.test(value)) timestamp = Number(value);
    if (key === SCHEME && value) signatures.push(value);
  }
  return Number.isNaN(timestamp) || signatures.length === 0 ? null : { timestamp, signatures };
}

/** Compares in constant time, so response timing cannot leak the signature. */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifySignatureHeader(
  payload: string,
  header: string | undefined,
  secret: string,
  nowSeconds: number,
  toleranceSeconds = DEFAULT_TOLERANCE_SECONDS,
): Promise<void> {
  if (header === undefined) throw new WebhookRejectedError('missing_header', 'Missing signature header');

  const parsed = parseHeader(header);
  if (!parsed) throw new WebhookRejectedError('malformed_header', 'Malformed signature header');

  const expected = await computeSignature(secret, `${parsed.timestamp}.${payload}`);
  if (!parsed.signatures.some((s) => constantTimeEqual(s, expected))) {
    throw new WebhookRejectedError('signature_mismatch', 'Invalid signature: no signature matches this payload');
  }

  if (nowSeconds - parsed.timestamp > toleranceSeconds) {
    throw new WebhookRejectedError(
      'timestamp_out_of_window',
      `Signature timestamp is outside the ${toleranceSeconds}-second window`,
    );
  }
}
