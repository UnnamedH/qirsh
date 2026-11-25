/* Makes the Frata Plus key pair (once) and an unlock code for each buyer. Run on your own computer only.
 *
 *   node scripts/unlock-codes.mjs new-key <folder outside this repo>
 *       Writes the private key to <folder>/frata-plus.private.jwk and prints the public key. Paste the
 *       public key into UNLOCK_KEY in js/config.js. Keep the private file safe and never commit it: anyone
 *       with it can make codes. Lose it and you'll need a new pair, and earlier codes stop working.
 *
 *   node scripts/unlock-codes.mjs setup [folder outside this repo, default ~/frata-keys]   (npm run plus:setup)
 *       Does it all at once: makes the key pair (or reuses the one already in the folder), puts the public key
 *       in js/config.js, stamps the service workers and checks a test code against the app's key.
 *
 *   node scripts/unlock-codes.mjs code <path to frata-plus.private.jwk> "Buyer's name"
 *       Prints a code to send to that buyer. It works on any phone, offline, for good.
 */
import { execSync } from 'node:child_process';
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

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG = path.join(REPO, 'js', 'config.js');
const publicOf = (k) => ({ kty: k.kty, crv: k.crv, x: k.x, y: k.y });

/* The private key's file in `dir`, which must be outside the repository so it can never be committed. */
function keyFile(dir) {
  const d = path.resolve(dir);
  if (d === REPO || d.startsWith(REPO + path.sep)) {
    console.error('Choose a folder outside the repository, so the private key can never be committed.');
    process.exit(1);
  }
  return path.join(d, 'frata-plus.private.jwk');
}

/* Makes a key pair and saves the private half. Returns the private JWK. */
async function makeKey(file) {
  const pair = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const priv = await subtle.exportKey('jwk', pair.privateKey);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(priv), { mode: 0o600 });
  return priv;
}

if (cmd === 'new-key' && a) {
  const file = keyFile(a);
  if (fs.existsSync(file)) {
    console.error(file + ' already exists. Move it away first: a new key would stop earlier codes working.');
    process.exit(1);
  }
  const priv = await makeKey(file);
  console.log('Private key saved to ' + file + ' (keep it safe, never share or commit it).');
  console.log('\nPaste this into UNLOCK_KEY in js/config.js:\n');
  console.log(JSON.stringify(publicOf(priv)));
} else if (cmd === 'setup') {
  const file = keyFile(a || home('~/frata-keys'));
  const reuse = fs.existsSync(file);
  const priv = reuse ? JSON.parse(fs.readFileSync(file, 'utf8')) : await makeKey(file);
  const pub = publicOf(priv);
  const src = fs.readFileSync(CONFIG, 'utf8');
  if (!/export const UNLOCK_KEY = [^;]*;/.test(src)) {
    console.error('Could not find UNLOCK_KEY in js/config.js.');
    process.exit(1);
  }
  fs.writeFileSync(
    CONFIG,
    src.replace(/export const UNLOCK_KEY = [^;]*;/, `export const UNLOCK_KEY = ${JSON.stringify(pub)};`),
  );
  execSync('npx prettier --write js/config.js', { cwd: REPO, stdio: 'ignore' });
  execSync('npm run stamp', { cwd: REPO, stdio: 'ignore' });
  // Check a code against the key now in the app, the way a phone will.
  const mod = await import('../js/config.js?' + Date.now());
  const key = await subtle.importKey('jwk', priv, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const payload = b64url(JSON.stringify({ n: 'Setup check', d: new Date().toISOString().slice(0, 10) }));
  const sig = await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(payload));
  const ok = await checkCode(CODE_PREFIX + payload + '.' + b64url(sig), mod.UNLOCK_KEY, subtle);
  if (!ok) {
    console.error('The app key does not match the private key. Nothing to commit: check js/config.js.');
    process.exit(1);
  }
  console.log((reuse ? 'Using your existing private key: ' : 'Private key saved to ') + file);
  console.log('Back it up somewhere safe (a password manager or USB stick). Never share or commit it.');
  console.log('The public key is now in js/config.js and a test code checks out. Commit and push:');
  console.log('  git commit -am "Add the Frata Plus public key" && git push');
  console.log('Make a code for a buyer with:');
  console.log('  node scripts/unlock-codes.mjs code "' + file + '" "Buyer\'s name"');
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
  console.log('Usage:\n  node scripts/unlock-codes.mjs setup [folder outside this repo]');
  console.log('  node scripts/unlock-codes.mjs new-key <folder outside this repo>');
  console.log('  node scripts/unlock-codes.mjs code <frata-plus.private.jwk> "Buyer\'s name"');
  process.exit(cmd ? 1 : 0);
}
