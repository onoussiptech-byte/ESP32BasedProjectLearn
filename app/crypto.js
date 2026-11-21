/* crypto.js - password hashing for ESP32 Tour.
 * PBKDF2-HMAC-SHA256. Uses the browser's WebCrypto when available, otherwise a bundled pure-JS
 * implementation of the SAME algorithm, so hashes are identical on every device and browser. */
(function () {
  'use strict';

  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
  const IV = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const W = new Uint32Array(64);

  const ror = (x, n) => (x >>> n) | (x << (32 - n));

  // One SHA-256 compression: state (8 words) absorbs one block (16 words)
  function compress(st, blk) {
    for (let i = 0; i < 16; i++) W[i] = blk[i];
    for (let i = 16; i < 64; i++) {
      const s0 = ror(W[i - 15], 7) ^ ror(W[i - 15], 18) ^ (W[i - 15] >>> 3);
      const s1 = ror(W[i - 2], 17) ^ ror(W[i - 2], 19) ^ (W[i - 2] >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0;
    }
    let a = st[0], b = st[1], c = st[2], d = st[3], e = st[4], f = st[5], g = st[6], h = st[7];
    for (let i = 0; i < 64; i++) {
      const S1 = ror(e, 6) ^ ror(e, 11) ^ ror(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[i] + W[i]) | 0;
      const S0 = ror(a, 2) ^ ror(a, 13) ^ ror(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    st[0] += a; st[1] += b; st[2] += c; st[3] += d; st[4] += e; st[5] += f; st[6] += g; st[7] += h;
  }

  // Absorb the final bytes of a message (with padding); priorLen = bytes already compressed
  function finish(st, bytes, priorLen) {
    const n = bytes.length, total = ((n + 9 + 63) >> 6) << 6;
    const buf = new Uint8Array(total);
    buf.set(bytes); buf[n] = 0x80;
    const bits = (priorLen + n) * 8, dv = new DataView(buf.buffer);
    dv.setUint32(total - 8, Math.floor(bits / 4294967296));
    dv.setUint32(total - 4, bits >>> 0);
    const blk = new Uint32Array(16);
    for (let o = 0; o < total; o += 64) {
      for (let i = 0; i < 16; i++) blk[i] = dv.getUint32(o + i * 4);
      compress(st, blk);
    }
    return st;
  }

  function wordsToBytes(words) {
    const out = new Uint8Array(words.length * 4), dv = new DataView(out.buffer);
    for (let i = 0; i < words.length; i++) dv.setUint32(i * 4, words[i]);
    return out;
  }

  function sha256Bytes(bytes) { return wordsToBytes(finish(IV.slice(), bytes, 0)); }

  // HMAC key schedule: pre-compressed inner and outer pad blocks
  function hmacInit(key) {
    if (key.length > 64) key = sha256Bytes(key);
    const ip = new Uint8Array(64).fill(0x36), op = new Uint8Array(64).fill(0x5c);
    for (let i = 0; i < key.length; i++) { ip[i] ^= key[i]; op[i] ^= key[i]; }
    const toState = (pad) => {
      const st = IV.slice(), blk = new Uint32Array(16), dv = new DataView(pad.buffer);
      for (let i = 0; i < 16; i++) blk[i] = dv.getUint32(i * 4);
      compress(st, blk);
      return st;
    };
    return { i: toState(ip), o: toState(op) };
  }

  function hmacBytes(h, msg) {
    const inner = finish(h.i.slice(), msg, 64);
    return finish(h.o.slice(), wordsToBytes(inner.slice(0, 8)), 64);
  }

  function pbkdf2Js(passBytes, saltBytes, iterations) {
    const h = hmacInit(passBytes);
    const msg = new Uint8Array(saltBytes.length + 4);
    msg.set(saltBytes); msg[msg.length - 1] = 1;               // block index 1 (32-byte output)
    let u = hmacBytes(h, msg);                                  // U1 as 8 words
    const t = u.slice();
    const blk = new Uint32Array(16), s = new Uint32Array(8), o = new Uint32Array(8);
    for (let n = 1; n < iterations; n++) {                      // U2 .. Un on 32-byte inputs
      blk.set(u); blk[8] = 0x80000000; blk.fill(0, 9, 15); blk[15] = 768;
      s.set(h.i); compress(s, blk);
      blk.set(s); blk[8] = 0x80000000; blk.fill(0, 9, 15); blk[15] = 768;
      o.set(h.o); compress(o, blk);
      u = o.slice();
      for (let i = 0; i < 8; i++) t[i] ^= u[i];
    }
    return toHex(wordsToBytes(t));
  }

  const toHex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  const fromHex = (hex) => Uint8Array.from(hex.match(/../g) || [], (x) => parseInt(x, 16));
  const utf8 = (s) => new TextEncoder().encode(s.normalize('NFKC'));

  async function derive(password, saltHex, iterations) {
    const pass = utf8(password), salt = fromHex(saltHex);
    const subtle = window.crypto && window.crypto.subtle;
    if (subtle && window.isSecureContext !== false) {
      try {
        const key = await subtle.importKey('raw', pass, 'PBKDF2', false, ['deriveBits']);
        const bits = await subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
        return toHex(new Uint8Array(bits));
      } catch (e) { /* fall through to the bundled implementation */ }
    }
    await new Promise((r) => setTimeout(r, 0));                 // let the UI paint a spinner first
    return pbkdf2Js(pass, salt, iterations);
  }

  function randomHex(bytes) {
    const a = new Uint8Array(bytes);
    window.crypto.getRandomValues(a);
    return toHex(a);
  }

  // Recovery code: 16 characters from an unambiguous alphabet, shown as XXXX-XXXX-XXXX-XXXX
  function recoveryCode() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const a = new Uint8Array(16);
    window.crypto.getRandomValues(a);
    const s = Array.from(a, (b) => alphabet[b % alphabet.length]).join('');
    return s.match(/.{4}/g).join('-');
  }

  window.CryptoX = { derive, randomHex, recoveryCode, pbkdf2Js, utf8, fromHex, toHex };
})();
