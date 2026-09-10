#!/usr/bin/env node
/**
 * Generate Apple client secret JWT for Supabase Apple Auth provider.
 *
 * Usage:
 *   node scripts/generate-apple-client-secret.js <path-to-p8-file> <key-id>
 *
 * Example:
 *   node scripts/generate-apple-client-secret.js ~/Downloads/AuthKey_ABC123.p8 ABC123
 *
 * The generated JWT is valid for 6 months (Apple's maximum).
 */

const fs = require('fs');
const crypto = require('crypto');

const TEAM_ID = 'V59J57D8PA';
const CLIENT_ID = 'com.poup.consumer'; // bundle ID for native apps

function generateAppleClientSecret(p8Path, keyId) {
  const privateKey = fs.readFileSync(p8Path, 'utf8');

  const header = {
    alg: 'ES256',
    kid: keyId,
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: TEAM_ID,
    iat: now,
    exp: now + 15777000, // ~6 months
    aud: 'https://appleid.apple.com',
    sub: CLIENT_ID,
  };

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const sign = crypto.createSign('SHA256');
  sign.update(signingInput);
  const derSig = sign.sign(privateKey);

  // Parse DER signature: SEQUENCE { INTEGER r, INTEGER s }
  // Format: 30 <seq-len> 02 <r-len> <r-bytes> 02 <s-len> <s-bytes>
  let offset = 2; // skip SEQUENCE tag + length
  const rLen = derSig[offset + 1];
  const rBytes = derSig.subarray(offset + 2, offset + 2 + rLen);
  offset = offset + 2 + rLen;
  const sLen = derSig[offset + 1];
  const sBytes = derSig.subarray(offset + 2, offset + 2 + sLen);

  // Strip leading zero padding (DER uses signed integers) and pad to 32 bytes
  function toPaddedBytes(buf, size) {
    const trimmed = buf[0] === 0 ? buf.subarray(1) : buf;
    const padded = Buffer.alloc(size);
    trimmed.copy(padded, size - trimmed.length);
    return padded;
  }

  const rawSig = Buffer.concat([toPaddedBytes(rBytes, 32), toPaddedBytes(sBytes, 32)]);
  const encodedSignature = rawSig.toString('base64url');

  return `${signingInput}.${encodedSignature}`;
}

// CLI
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: node scripts/generate-apple-client-secret.js <p8-file> <key-id>');
  console.error('Example: node scripts/generate-apple-client-secret.js ~/Downloads/AuthKey_ABC123.p8 ABC123');
  process.exit(1);
}

const [p8Path, keyId] = args;

if (!fs.existsSync(p8Path)) {
  console.error(`Error: File not found: ${p8Path}`);
  process.exit(1);
}

const jwt = generateAppleClientSecret(p8Path, keyId);
console.log('\n=== Apple Client Secret JWT ===\n');
console.log(jwt);
console.log('\n=== Configuration for Supabase ===\n');
console.log(`Client ID (Service ID): ${CLIENT_ID}`);
console.log(`Secret Key: (the JWT above)`);
console.log(`\nThis JWT expires in ~6 months. Re-run this script to generate a new one.\n`);
