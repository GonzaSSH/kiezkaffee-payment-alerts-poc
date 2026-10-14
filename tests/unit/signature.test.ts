import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TOLERANCE_SECONDS,
  computeSignature,
  signatureHeader,
  verifySignatureHeader,
} from '../../src/provider/signature';
import { WebhookRejectedError } from '../../src/core/types';

const SECRET = 'whsec_test_secret';
const BODY = '{"id":"evt_1","type":"payment_intent.payment_failed"}';
const T = 1_791_972_000;

async function rejection(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    if (e instanceof WebhookRejectedError) return e;
    throw e;
  }
  throw new Error('expected a rejection, but it was accepted');
}

describe('signature (Stripe scheme: HMAC-SHA256 of "<t>.<body>", header t=...,v1=...)', () => {
  it('matches an independent HMAC-SHA256 implementation (Node crypto)', async () => {
    const oracle = createHmac('sha256', SECRET).update(`${T}.${BODY}`, 'utf8').digest('hex');
    expect(await computeSignature(SECRET, `${T}.${BODY}`)).toBe(oracle);
  });

  it('builds the header in the Stripe format', async () => {
    const header = await signatureHeader(SECRET, BODY, T);
    expect(header).toMatch(/^t=1791972000,v1=[0-9a-f]{64}$/);
  });

  it('accepts a correctly signed payload', async () => {
    const header = await signatureHeader(SECRET, BODY, T);
    await expect(verifySignatureHeader(BODY, header, SECRET, T)).resolves.toBeUndefined();
  });

  it('uses a 300-second tolerance, like Stripe', () => {
    expect(DEFAULT_TOLERANCE_SECONDS).toBe(300);
  });

  it('accepts a signature exactly 300 seconds old', async () => {
    const header = await signatureHeader(SECRET, BODY, T);
    await expect(verifySignatureHeader(BODY, header, SECRET, T + 300)).resolves.toBeUndefined();
  });

  it('rejects a signature 301 seconds old (replay protection)', async () => {
    const header = await signatureHeader(SECRET, BODY, T);
    const e = await rejection(verifySignatureHeader(BODY, header, SECRET, T + 301));
    expect(e.reason).toBe('timestamp_out_of_window');
    expect(e.message).toBe('Signature timestamp is outside the 300-second window');
  });

  it('rejects a payload signed with another secret', async () => {
    const header = await signatureHeader('whsec_wrong', BODY, T);
    const e = await rejection(verifySignatureHeader(BODY, header, SECRET, T));
    expect(e.reason).toBe('signature_mismatch');
    expect(e.message).toBe('Invalid signature: no signature matches this payload');
  });

  it('rejects a body changed after signing', async () => {
    const header = await signatureHeader(SECRET, BODY, T);
    const tampered = BODY.replace('payment_failed', 'succeeded');
    expect((await rejection(verifySignatureHeader(tampered, header, SECRET, T))).reason).toBe('signature_mismatch');
  });

  it('rejects a changed timestamp (the timestamp is part of what is signed)', async () => {
    const header = await signatureHeader(SECRET, BODY, T);
    const moved = header.replace(`t=${T}`, `t=${T + 10}`);
    expect((await rejection(verifySignatureHeader(BODY, moved, SECRET, T + 10))).reason).toBe('signature_mismatch');
  });

  it('rejects a missing header', async () => {
    const e = await rejection(verifySignatureHeader(BODY, undefined, SECRET, T));
    expect(e.reason).toBe('missing_header');
    expect(e.message).toBe('Missing signature header');
  });

  it.each([
    ['empty', ''],
    ['no timestamp', 'v1=abc'],
    ['no v1 signature', `t=${T}`],
    ['only another scheme', `t=${T},v0=abc`],
    ['non-numeric timestamp', 't=soon,v1=abc'],
    ['garbage', 'hello world'],
  ])('rejects a malformed header (%s)', async (_name, header) => {
    const e = await rejection(verifySignatureHeader(BODY, header, SECRET, T));
    expect(e.reason).toBe('malformed_header');
    expect(e.message).toBe('Malformed signature header');
  });

  it('accepts when any one of several v1 signatures matches (secret rotation)', async () => {
    const good = await signatureHeader(SECRET, BODY, T);
    const header = `t=${T},v1=${'0'.repeat(64)},${good.split(',')[1]}`;
    await expect(verifySignatureHeader(BODY, header, SECRET, T)).resolves.toBeUndefined();
  });
});
