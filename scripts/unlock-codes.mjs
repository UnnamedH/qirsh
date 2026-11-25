/* Makes the Frata Plus key pair (once) and an unlock code for each buyer. Run on your own computer only.
 *
 *   node scripts/unlock-codes.mjs new-key <folder outside this repo>
 *       Writes the private key to <folder>/frata-plus.private.jwk and prints the public key. Paste the
 *       public key into UNLOCK_KEY in js/config.js. Keep the private file safe and never commit it: anyone
 *       with it can make codes. Lose it and you'll need a new pair, and earlier codes stop working.
 *
 *   node scripts/unlock-codes.mjs code <path to frata-plus.private.jwk> "Buyer's name"
 *       Prints a code to send to that buyer. It works on any phone, offline, for good.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { webcrypto } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { CODE_PREFIX, checkCode } from '../js/core/plus.js';

const { subtle } = webcrypto;
const b64url = (bytes) => Buffer.from(bytes).toString('base64url');
// A leading ~ means the home folder, also in shells that don't expand it (PowerShell, cmd).
const home = (p) => p && p.replace(/^~(?=$|[\\/])/, os.homedir());
const [cmd, a0, b] = process.argv.slice(2);
const a = home(a0);

if (cmd === 'new-key' && a) {
  const dir = path.resolve(a);
  const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  if (dir === repo || dir.startsWith(repo + path.sep)) {
    console.error('Choose a folder outside the repository, so the private key can never be committed.');
    process.exit(1);
  }
  const pair = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const priv = await subtle.exportKey('jwk', pair.privateKey);
  const pub = await subtle.exportKey('jwk', pair.publicKey);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'frata-plus.private.jwk');
  if (fs.existsSync(file)) {
    console.error(file + ' already exists. Move it away first: a new key would stop earlier codes working.');
    process.exit(1);
  }
  fs.writeFileSync(file, JSON.stringify(priv), { mode: 0o600 });
  console.log('Private key saved to ' + file + ' (keep it safe, never share or commit it).');
  console.log('\nPaste this into UNLOCK_KEY in js/config.js:\n');
  console.log(JSON.stringify({ kty: pub.kty, crv: pub.crv, x: pub.x, y: pub.y }));
} else if (cmd === 'code' && a && b) {
  const priv = JSON.parse(fs.readFileSync(a, 'utf8'));
  const key = await subtle.importKey('jwk', priv, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const payload = b64url(
    JSON.stringify({ n: b.trim().slice(0, 60), d: new Date().toISOString().slice(0, 10) }),
  );
  const sig = await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(payload));
  const code = CODE_PREFIX + payload + '.' + b64url(sig);
  // Check it with the matching public key before handing it out.
  const pub = { kty: priv.kty, crv: priv.crv, x: priv.x, y: priv.y };
  if (!(await checkCode(code, pub, subtle))) {
    console.error('The code did not check out against its own key. Nothing was printed.');
    process.exit(1);
  }
  console.log(code);
} else {
  console.log('Usage:\n  node scripts/unlock-codes.mjs new-key <folder outside this repo>');
  console.log('  node scripts/unlock-codes.mjs code <frata-plus.private.jwk> "Buyer\'s name"');
  process.exit(cmd ? 1 : 0);
}
