/* Unit tests for Frata Plus codes: made with a private key, checked with only the public one. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { webcrypto } from 'node:crypto';
import { CODE_PREFIX, checkCode, splitCode } from '../js/core/plus.js';

const { subtle } = webcrypto;
const ALG = { name: 'ECDSA', namedCurve: 'P-256' };
const b64 = (x) => Buffer.from(x).toString('base64url');

async function keys() {
  const pair = await subtle.generateKey(ALG, true, ['sign', 'verify']);
  const pub = await subtle.exportKey('jwk', pair.publicKey);
  return { priv: pair.privateKey, pub: { kty: pub.kty, crv: pub.crv, x: pub.x, y: pub.y } };
}
async function sign(priv, data) {
  const payload = b64(JSON.stringify(data));
  const sig = await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, priv, new TextEncoder().encode(payload));
  return CODE_PREFIX + payload + '.' + b64(sig);
}

test('a genuine code gives back who it was made for', async () => {
  const k = await keys();
  const code = await sign(k.priv, { n: 'Rita Ö.', d: '2026-11-25' });
  assert.deepEqual(await checkCode(code, k.pub, subtle), { name: 'Rita Ö.', date: '2026-11-25' });
  // Spaces and line breaks from a chat app don't matter.
  const pasted = ' ' + code.slice(0, 20) + '\n' + code.slice(20) + ' ';
  assert.ok(await checkCode(pasted, k.pub, subtle));
});

test('other keys, changed payloads and broken codes are refused without throwing', async () => {
  const k = await keys();
  const other = await keys();
  const code = await sign(k.priv, { n: 'Rita', d: '2026-11-25' });
  const [, sig] = code.slice(CODE_PREFIX.length).split('.');
  const renamed = CODE_PREFIX + b64(JSON.stringify({ n: 'Sam', d: '2026-11-25' })) + '.' + sig;
  for (const bad of [
    await sign(other.priv, { n: 'Rita', d: '2026-11-25' }),
    renamed,
    code.slice(0, -3),
    code + '.x',
    code.replace(CODE_PREFIX, 'FRATA2-'),
    'FRATA1-%%%.###',
    '',
    null,
  ])
    assert.equal(await checkCode(bad, k.pub, subtle), null);
  assert.equal(await checkCode(code, null, subtle), null, 'no key, nothing unlocks');
  assert.equal(await checkCode(code, { kty: 'EC' }, subtle), null, 'a broken key is not an error');
});

test('a signed payload that is not what the app expects still reads safely', async () => {
  const k = await keys();
  assert.deepEqual(await checkCode(await sign(k.priv, { n: 5 }), k.pub, subtle), { name: '', date: '' });
  const long = await sign(k.priv, { n: 'x'.repeat(200), d: '2026-11-25T10:00' });
  assert.deepEqual(await checkCode(long, k.pub, subtle), { name: 'x'.repeat(60), date: '2026-11-25' });
});

test('splitCode', () => {
  assert.deepEqual(splitCode('FRATA1-ab_c.d-e'), { payload: 'ab_c', sig: 'd-e' });
  assert.equal(splitCode('FRATA1-abc'), null);
  assert.equal(splitCode('frata1-a.b'), null);
});
