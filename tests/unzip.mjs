import { inflateRawSync } from 'node:zlib';

/**
 * Reads one entry out of a zip file. Node has no zip reader and the fidelity check is the
 * only thing that needs one, so this walks the central directory by hand rather than
 * adding a dependency to a project whose brief asked for as few as possible.
 *
 * Format: the End of Central Directory record sits at the tail and points at the central
 * directory; each central entry points at a local header; the data follows that header.
 */
export function readZipEntry(buffer, wantedName) {
  const EOCD_SIG = 0x06054b50;
  const CENTRAL_SIG = 0x02014b50;

  let eocd = -1;
  for (let i = buffer.length - 22; i >= 0; i -= 1) {
    if (buffer.readUInt32LE(i) === EOCD_SIG) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('Not a zip file: no end-of-central-directory record.');

  const entryCount = buffer.readUInt16LE(eocd + 10);
  let cursor = buffer.readUInt32LE(eocd + 16);

  for (let i = 0; i < entryCount; i += 1) {
    if (buffer.readUInt32LE(cursor) !== CENTRAL_SIG) {
      throw new Error(`Corrupt central directory at entry ${i}.`);
    }
    const method = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localOffset = buffer.readUInt32LE(cursor + 42);
    const name = buffer.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8');

    if (name === wantedName) {
      // The local header repeats the name and extra fields, at its own lengths.
      const localNameLength = buffer.readUInt16LE(localOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localOffset + 28);
      const start = localOffset + 30 + localNameLength + localExtraLength;
      const data = buffer.subarray(start, start + compressedSize);
      if (method === 0) return Buffer.from(data);
      if (method === 8) return inflateRawSync(data);
      throw new Error(`Unsupported compression method ${method} for ${name}.`);
    }
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  throw new Error(`${wantedName} not found in the archive.`);
}
