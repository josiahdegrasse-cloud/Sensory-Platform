import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { readFileSync, statSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { relative, resolve } from 'node:path';
import { root } from './lib.mjs';

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function inspectPng(path) {
  const absolute = resolve(root, path);
  const data = readFileSync(absolute);
  if (data.length < 45 || data.subarray(0,8).toString('hex') !== '89504e470d0a1a0a') throw new Error('invalid PNG signature');
  let offset = 8;
  let ihdr;
  let sawIend = false;
  const idat = [];
  while (offset < data.length) {
    if (offset + 12 > data.length) throw new Error('truncated PNG chunk');
    const length = data.readUInt32BE(offset);
    const end = offset + 12 + length;
    if (end > data.length) throw new Error('truncated PNG data');
    const type = data.subarray(offset + 4, offset + 8).toString('ascii');
    const payload = data.subarray(offset + 8, offset + 8 + length);
    const expectedCrc = data.readUInt32BE(offset + 8 + length);
    if (crc32(data.subarray(offset + 4, offset + 8 + length)) !== expectedCrc) throw new Error(`invalid ${type} CRC`);
    if (type === 'IHDR') {
      if (offset !== 8 || length !== 13) throw new Error('invalid IHDR');
      ihdr = { width:payload.readUInt32BE(0), height:payload.readUInt32BE(4), bitDepth:payload[8], colorType:payload[9], interlace:payload[12] };
    } else if (type === 'IDAT') idat.push(payload);
    else if (type === 'IEND') { if (length !== 0) throw new Error('invalid IEND'); sawIend = true; offset = end; break; }
    offset = end;
  }
  if (!ihdr || !sawIend || !idat.length || offset !== data.length) throw new Error('incomplete PNG');
  if (ihdr.bitDepth !== 8 || ihdr.interlace !== 0) throw new Error('unsupported PNG encoding');
  const channels = {0:1,2:3,3:1,4:2,6:4}[ihdr.colorType];
  if (!channels) throw new Error('unsupported PNG color type');
  const decoded = inflateSync(Buffer.concat(idat));
  const rowBytes = ihdr.width * channels;
  if (decoded.length !== (rowBytes + 1) * ihdr.height) throw new Error('invalid decoded PNG size');
  for (let row = 0; row < ihdr.height; row += 1) if (decoded[row * (rowBytes + 1)] > 4) throw new Error('invalid PNG filter');
  return { width:ihdr.width, height:ihdr.height, sha256:createHash('sha256').update(data).digest('hex'), mtime:statSync(absolute).mtimeMs };
}

export function isCurrentCapture(mtime, capturedAt, preflightAt, windowMs = 600_000) {
  return Number.isFinite(mtime) && Number.isFinite(capturedAt) && Number.isFinite(preflightAt) && mtime >= preflightAt && mtime <= capturedAt + 2000 && capturedAt - mtime <= windowMs;
}

export function isInsideRun(path, runId) {
  const runDir = resolve(root, 'agent-system/runs', runId);
  const rel = relative(runDir, resolve(root, path));
  return rel !== '' && !rel.startsWith('..') && !rel.startsWith('/');
}
