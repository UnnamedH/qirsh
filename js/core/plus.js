/* Frata Plus unlock codes: read one and check its signature. Pure: the key and WebCrypto are passed in. */

/*
 * A code is `FRATA1-<payload>.<signature>`, both base64url. The payload is JSON: `n` the buyer's name
 * (shown back to them) and `d` the day it was made. The maker signs it with a private key that never
 * leaves their computer (scripts/unlock-codes.mjs); the app holds only the public key, so it can check a
 * code offline but can't make one. ECDSA P-256 with SHA-256, signature as 64 raw bytes (r then s), the
 * form WebCrypto produces and expects.
 */
export const CODE_PREFIX = 'FRATA1-';

/** @param {string} s */
const fromB64url = (s) => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

/**
 * Splits a pasted code into its parts, forgiving spaces and line breaks from messaging apps.
 * @param {string} code
 * @returns {{ payload: string, sig: string } | null}
 */
export function splitCode(code) {
  const c = String(code || '').replace(/\s+/g, '');
  if (!c.startsWith(CODE_PREFIX)) return null;
  const [payload, sig, extra] = c.slice(CODE_PREFIX.length).split('.');
  if (!payload || !sig || extra !== undefined) return null;
  if (!/^[\w-]+$/.test(payload) || !/^[\w-]+$/.test(sig)) return null;
  return { payload, sig };
}

/**
 * Checks a code against the public key. Resolves to who it was made for, or null if it isn't genuine.
 * Never throws: a mistyped or tampered code is simply not valid.
 * @param {string} code
 * @param {JsonWebKey | null} publicKey
 * @param {SubtleCrypto} subtle
 * @returns {Promise<{ name: string, date: string } | null>}
 */
export async function checkCode(code, publicKey, subtle) {
  const parts = splitCode(code);
  if (!parts || !publicKey || !subtle) return null;
  try {
    const key = await subtle.importKey('jwk', publicKey, { name: 'ECDSA', namedCurve: 'P-256' }, false, [
      'verify',
    ]);
    const ok = await subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      key,
      fromB64url(parts.sig),
      new TextEncoder().encode(parts.payload),
    );
    if (!ok) return null;
    const p = JSON.parse(new TextDecoder().decode(fromB64url(parts.payload)));
    return {
      name: typeof p.n === 'string' ? p.n.slice(0, 60) : '',
      date: typeof p.d === 'string' ? p.d.slice(0, 10) : '',
    };
  } catch (e) {
    return null;
  }
}
