/**
 * Rescale a USDZ file by prepending a root.usda wrapper that applies a uniform
 * xformOp:scale to the existing model (which Meshy always packages as temp.usdc).
 *
 * USDZ is a ZIP archive with strict 64-byte alignment rules:
 *   - Each file's data must start at a 64-byte-aligned offset from the start of
 *     the archive. This is enforced by Apple's AR Quick Look.
 *
 * Strategy: prepend a new root.usda entry as the VERY FIRST entry in the zip.
 * To keep all existing entries' data aligned we must ensure:
 *   1. localHeaderSize (30 + filenameLen + extraLen) ≡ 0 (mod 64)
 *      → pad extraLen so the data starts on a 64-byte boundary.
 *   2. Total new entry size (localHeaderSize + paddedDataLen) ≡ 0 (mod 64)
 *      → pad fileData with trailing ASCII spaces (valid USDA whitespace) so the
 *        shift into all existing offsets is a multiple of 64.
 */

// ---------------------------------------------------------------------------
// CRC-32
// ---------------------------------------------------------------------------

const CRC32_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : c >>> 1;
    }
    t[i] = c;
  }
  return t;
})();

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC32_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

// ---------------------------------------------------------------------------
// Little-endian helpers (operate on a DataView backed by a Buffer/Uint8Array)
// ---------------------------------------------------------------------------

function readU16(dv: DataView, offset: number): number {
  return dv.getUint16(offset, true);
}
function readU32(dv: DataView, offset: number): number {
  return dv.getUint32(offset, true);
}
function writeU16(buf: Uint8Array, offset: number, value: number): void {
  buf[offset] = value & 0xff;
  buf[offset + 1] = (value >>> 8) & 0xff;
}
function writeU32(buf: Uint8Array, offset: number, value: number): void {
  buf[offset] = value & 0xff;
  buf[offset + 1] = (value >>> 8) & 0xff;
  buf[offset + 2] = (value >>> 16) & 0xff;
  buf[offset + 3] = (value >>> 24) & 0xff;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Prepend a root.usda scale wrapper as the first entry in a USDZ zip.
 *
 * @param usdzBuffer - Original USDZ bytes
 * @param scaleFactor - Uniform scale to apply (e.g. 0.3 / currentSizeInMeters)
 * @returns New USDZ bytes with scale baked in via USD layer override
 */
export function rescaleUsdz(
  usdzBuffer: Uint8Array,
  scaleFactor: number
): Uint8Array {
  const src = usdzBuffer;
  const dv = new DataView(src.buffer, src.byteOffset, src.byteLength);

  // -------------------------------------------------------------------------
  // Build root.usda content
  // -------------------------------------------------------------------------
  const usda = `#usda 1.0
(
  defaultPrim = "Root"
  metersPerUnit = 1
  upAxis = "Y"
)

def Xform "Root"
{
  def "Model" (
    prepend references = @temp.usdc@
  )
  {
    float3 xformOp:scale = (${scaleFactor}, ${scaleFactor}, ${scaleFactor})
    uniform token[] xformOpOrder = ["xformOp:scale"]
  }
}
`;

  const filenameStr = "root.usda";
  const filenameBytes = new TextEncoder().encode(filenameStr);

  // -------------------------------------------------------------------------
  // Step 1: calculate extraLen so localHeaderSize ≡ 0 (mod 64)
  // localHeaderSize = 30 + filenameLen + extraLen
  // -------------------------------------------------------------------------
  const headerBase = 30 + filenameBytes.length;
  const extraLen = (64 - (headerBase % 64)) % 64;
  const headerSize = headerBase + extraLen; // multiple of 64

  // -------------------------------------------------------------------------
  // Step 2: pad fileData so (headerSize + paddedDataLen) ≡ 0 (mod 64)
  // -------------------------------------------------------------------------
  const rawData = new TextEncoder().encode(usda);
  const rawLen = rawData.length;
  const paddedLen = rawLen + ((64 - (rawLen % 64)) % 64);
  const fileData = new Uint8Array(paddedLen).fill(0x20); // pad with spaces
  fileData.set(rawData, 0);

  const totalShift = headerSize + paddedLen; // must be multiple of 64
  if (totalShift % 64 !== 0) {
    throw new Error(
      `[rescaleUsdz] alignment bug: totalShift=${totalShift} not multiple of 64`
    );
  }

  // -------------------------------------------------------------------------
  // Build local file header for root.usda
  // -------------------------------------------------------------------------
  const localHeader = new Uint8Array(headerSize).fill(0);
  writeU32(localHeader, 0, 0x04034b50); // signature
  writeU16(localHeader, 4, 20); // version needed
  writeU16(localHeader, 6, 0); // flags
  writeU16(localHeader, 8, 0); // compression: STORE
  writeU16(localHeader, 10, 0); // mod time
  writeU16(localHeader, 12, 0); // mod date
  writeU32(localHeader, 14, crc32(fileData)); // CRC-32
  writeU32(localHeader, 18, paddedLen); // compressed size
  writeU32(localHeader, 22, paddedLen); // uncompressed size
  writeU16(localHeader, 26, filenameBytes.length);
  writeU16(localHeader, 28, extraLen);
  localHeader.set(filenameBytes, 30);

  // Combine header + data → the new zip entry
  const newEntry = new Uint8Array(totalShift);
  newEntry.set(localHeader, 0);
  newEntry.set(fileData, headerSize);

  // -------------------------------------------------------------------------
  // Find End of Central Directory (EOCD) — scan backwards for signature
  // -------------------------------------------------------------------------
  let eocdOffset = -1;
  for (let i = src.length - 22; i >= 0; i--) {
    if (readU32(dv, i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset < 0) {
    throw new Error("[rescaleUsdz] EOCD not found in USDZ file");
  }

  const cdOffset = readU32(dv, eocdOffset + 16);
  const cdSize = readU32(dv, eocdOffset + 12);
  const entryCount = readU16(dv, eocdOffset + 8);

  // -------------------------------------------------------------------------
  // Patch existing Central Directory entries: shift local header offsets
  // -------------------------------------------------------------------------
  const cd = new Uint8Array(src.buffer, src.byteOffset + cdOffset, cdSize).slice(); // mutable copy
  const cdDv = new DataView(cd.buffer, cd.byteOffset, cd.byteLength);
  let cdPos = 0;
  for (let e = 0; e < entryCount; e++) {
    if (readU32(cdDv, cdPos) !== 0x02014b50) {
      throw new Error(`[rescaleUsdz] Bad central directory signature at ${cdPos}`);
    }
    const fnLen = readU16(cdDv, cdPos + 28);
    const exLen = readU16(cdDv, cdPos + 30);
    const cmLen = readU16(cdDv, cdPos + 32);
    const oldLocalOffset = readU32(cdDv, cdPos + 42);
    writeU32(cd, cdPos + 42, oldLocalOffset + totalShift);
    cdPos += 46 + fnLen + exLen + cmLen;
  }

  // -------------------------------------------------------------------------
  // Build new Central Directory entry for root.usda
  // -------------------------------------------------------------------------
  const newCdEntrySize = 46 + filenameBytes.length;
  const newCdEntry = new Uint8Array(newCdEntrySize).fill(0);
  writeU32(newCdEntry, 0, 0x02014b50); // CD signature
  writeU16(newCdEntry, 4, 20); // version made by
  writeU16(newCdEntry, 6, 20); // version needed
  writeU16(newCdEntry, 8, 0); // flags
  writeU16(newCdEntry, 10, 0); // compression: STORE
  writeU16(newCdEntry, 12, 0); // mod time
  writeU16(newCdEntry, 14, 0); // mod date
  writeU32(newCdEntry, 16, crc32(fileData)); // CRC-32
  writeU32(newCdEntry, 20, paddedLen); // compressed size
  writeU32(newCdEntry, 24, paddedLen); // uncompressed size
  writeU16(newCdEntry, 28, filenameBytes.length);
  writeU16(newCdEntry, 30, 0); // extra field length
  writeU16(newCdEntry, 32, 0); // file comment length
  writeU16(newCdEntry, 34, 0); // disk number start
  writeU16(newCdEntry, 36, 0); // internal attributes
  writeU32(newCdEntry, 38, 0); // external attributes
  writeU32(newCdEntry, 42, 0); // local header offset = 0 (it's first)
  newCdEntry.set(filenameBytes, 46);

  // New CD = [newCdEntry, ...patchedExistingCd]
  const newCd = new Uint8Array(newCdEntrySize + cdSize);
  newCd.set(newCdEntry, 0);
  newCd.set(cd, newCdEntrySize);

  // -------------------------------------------------------------------------
  // Patch EOCD
  // -------------------------------------------------------------------------
  const eocd = src.slice(eocdOffset, eocdOffset + 22).slice(); // mutable copy
  const newCount = entryCount + 1;
  writeU16(eocd, 8, newCount); // total entries on disk
  writeU16(eocd, 10, newCount); // total entries
  writeU32(eocd, 12, newCd.length); // CD size
  writeU32(eocd, 16, cdOffset + totalShift); // CD offset

  // -------------------------------------------------------------------------
  // Assemble final archive: [newEntry | originalFileData | newCD | eocd]
  // -------------------------------------------------------------------------
  const originalFileData = src.slice(0, cdOffset);
  const result = new Uint8Array(
    newEntry.length + originalFileData.length + newCd.length + eocd.length
  );
  let pos = 0;
  result.set(newEntry, pos); pos += newEntry.length;
  result.set(originalFileData, pos); pos += originalFileData.length;
  result.set(newCd, pos); pos += newCd.length;
  result.set(eocd, pos);

  return result;
}
