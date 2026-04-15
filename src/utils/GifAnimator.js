/**
 * GifAnimator — animated background frame player.
 *
 * Priority:
 *  1. Load from  /assets/bg-frames/manifest.json  (pre-extracted PNGs).
 *     After running  node tools/extract-frames.js  you can delete unwanted
 *     PNG files and regenerate the manifest with  node tools/update-manifest.js.
 *  2. If no manifest exists, fall back to decoding the GIF in-memory (slower
 *     first load, but zero setup required).
 */
export class GifAnimator {
  constructor() {
    this.frames        = [];   // [{ canvas|img, delay }]
    this.frameIndex    = 0;
    this.elapsed       = 0;
    this._lastTime     = null;
    this.ready         = false;
    this.currentCanvas = null;
    this.playbackRate  = 1;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────────────────

  async load(gifUrl) {
    // 1. Try manifest-based loading (pre-extracted PNG frames)
    const manifestUrl = '/assets/bg-frames/manifest.json';
    try {
      const res = await fetch(manifestUrl);
      if (res.ok) {
        const manifest = await res.json();
        if (manifest.frames?.length > 0) {
          await this._loadFromManifest(manifest);
          console.log(`[GifAnimator] loaded ${this.frames.length} frames from manifest`);
          return;
        }
      }
    } catch (_) { /* manifest not ready yet — fall through */ }

    // 2. Decode GIF in-memory
    console.log('[GifAnimator] no manifest found — decoding GIF in-memory …');
    const res    = await fetch(gifUrl);
    const buffer = await res.arrayBuffer();
    const bytes  = new Uint8Array(buffer);
    const frames = this._decodeGif(bytes);

    this.frames        = frames;
    this.frameIndex    = 0;
    this.currentCanvas = frames[0]?.canvas ?? null;
    this.ready         = frames.length > 0;
    console.log(`[GifAnimator] decoded ${frames.length} frames in-memory`);
  }

  update() {
    if (!this.ready || this.frames.length <= 1) return;
    const now = performance.now();
    if (this._lastTime === null) { this._lastTime = now; return; }
    const delta = now - this._lastTime;
    this._lastTime = now;
    this.elapsed  += delta * this.playbackRate;

    const delay = this.frames[this.frameIndex].delay;
    if (this.elapsed >= delay) {
      this.elapsed   -= delay;
      this.frameIndex = (this.frameIndex + 1) % this.frames.length;
      this.currentCanvas = this.frames[this.frameIndex].canvas;
    }
  }

  syncClock(now = performance.now()) {
    this._lastTime = now;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Manifest loading (PNG files)
  // ─────────────────────────────────────────────────────────────────────────

  async _loadFromManifest(manifest) {
    const base = '/assets/bg-frames/';
    const promises = manifest.frames.map(({ file, delay }) =>
      new Promise((resolve) => {
        const img   = new Image();
        // Create an offscreen canvas so drawImage works uniformly
        img.onload = () => {
          const c   = document.createElement('canvas');
          c.width   = img.naturalWidth;
          c.height  = img.naturalHeight;
          c.getContext('2d').drawImage(img, 0, 0);
          resolve({ canvas: c, delay: delay ?? 100 });
        };
        img.onerror = () => resolve(null);
        img.src = base + file;
      })
    );
    const results = await Promise.all(promises);
    this.frames        = results.filter(Boolean);
    this.frameIndex    = 0;
    this.currentCanvas = this.frames[0]?.canvas ?? null;
    this.ready         = this.frames.length > 0;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // In-memory GIF89a decoder (no external dependencies)
  // ─────────────────────────────────────────────────────────────────────────

  _decodeGif(data) {
    let pos = 0;
    const read8  = () => data[pos++];
    const read16 = () => { const v = data[pos] | (data[pos+1] << 8); pos += 2; return v; };

    pos = 6;
    const canvasW = read16();
    const canvasH = read16();
    const packed  = read8();
    read8(); read8();

    const gctFlag = (packed >> 7) & 1;
    const gctSize = packed & 0x07;
    let globalPalette = null;
    if (gctFlag) {
      globalPalette = this._readPalette(data, pos, 2 ** (gctSize + 1));
      pos += globalPalette.length * 3;
    }

    const frames   = [];
    const accumCanvas = document.createElement('canvas');
    accumCanvas.width  = canvasW;
    accumCanvas.height = canvasH;
    const accumCtx = accumCanvas.getContext('2d');
    let graphicControl = null;

    while (pos < data.length) {
      const block = read8();
      if (block === 0x3B) break;

      if (block === 0x21) {
        const label = read8();
        if (label === 0xF9) {
          read8();
          const gcPacked  = read8();
          const delay     = read16() * 10;
          const transpIdx = read8();
          read8();
          graphicControl = {
            disposalMethod: (gcPacked >> 3) & 0x07,
            hasTransp:      !!(gcPacked & 0x01),
            transpIndex:    transpIdx,
            delay:          delay || 100
          };
        } else {
          this._skipSubBlocks(data, pos, (n) => { pos = n; });
        }
        continue;
      }

      if (block === 0x2C) {
        const frameX = read16(), frameY = read16();
        const frameW = read16(), frameH = read16();
        const imgPacked  = read8();
        const lctFlag    = (imgPacked >> 7) & 1;
        const interlaced = (imgPacked >> 6) & 1;
        const lctSize    = imgPacked & 0x07;

        let palette = globalPalette;
        if (lctFlag) {
          palette = this._readPalette(data, pos, 2 ** (lctSize + 1));
          pos += palette.length * 3;
        }

        const minCode    = read8();
        const compressed = this._readSubBlocks(data, pos);
        pos += compressed.consumed;

        const pixels  = this._lzwDecode(compressed.bytes, minCode, frameW * frameH);
        const gc      = graphicControl;
        const transpIdx = gc?.hasTransp ? gc.transpIndex : -1;

        if (interlaced) this._deinterlace(pixels, frameW, frameH);

        const imgData = accumCtx.createImageData(frameW, frameH);
        for (let i = 0; i < pixels.length; i++) {
          const idx = pixels[i];
          if (idx === transpIdx) { imgData.data[i * 4 + 3] = 0; continue; }
          const c = palette[idx] ?? [0, 0, 0];
          imgData.data[i * 4]     = c[0];
          imgData.data[i * 4 + 1] = c[1];
          imgData.data[i * 4 + 2] = c[2];
          imgData.data[i * 4 + 3] = 255;
        }

        const tmp = document.createElement('canvas');
        tmp.width = frameW; tmp.height = frameH;
        tmp.getContext('2d').putImageData(imgData, 0, 0);
        accumCtx.drawImage(tmp, frameX, frameY);

        const snap = document.createElement('canvas');
        snap.width = canvasW; snap.height = canvasH;
        snap.getContext('2d').drawImage(accumCanvas, 0, 0);
        frames.push({ canvas: snap, delay: gc?.delay ?? 100 });

        if ((gc?.disposalMethod ?? 0) === 2) {
          accumCtx.clearRect(frameX, frameY, frameW, frameH);
        }
        graphicControl = null;
        continue;
      }

      console.warn(`[GifAnimator] unknown block 0x${block.toString(16)} at pos ${pos}`);
      break;
    }
    return frames;
  }

  _readPalette(data, pos, count) {
    const p = [];
    for (let i = 0; i < count; i++) p.push([data[pos+i*3], data[pos+i*3+1], data[pos+i*3+2]]);
    return p;
  }

  _readSubBlocks(data, pos) {
    const chunks = []; let consumed = 0;
    while (true) {
      const size = data[pos + consumed]; consumed++;
      if (size === 0) break;
      chunks.push(data.slice(pos + consumed, pos + consumed + size));
      consumed += size;
    }
    const totalLen = chunks.reduce((s, c) => s + c.length, 0);
    const out = new Uint8Array(totalLen); let off = 0;
    for (const c of chunks) { out.set(c, off); off += c.length; }
    return { bytes: out, consumed };
  }

  _skipSubBlocks(data, pos, setPos) {
    let p = pos;
    while (true) { const size = data[p++]; if (size === 0) break; p += size; }
    setPos(p);
  }

  _lzwDecode(data, minCodeSize, pixelCount) {
    const clearCode = 1 << minCodeSize;
    const eofCode   = clearCode + 1;
    let codeSize    = minCodeSize + 1;
    let nextCode    = eofCode + 1;
    let codeMask    = (1 << codeSize) - 1;
    const table     = [];

    const initTable = () => {
      table.length = 0;
      for (let i = 0; i < clearCode; i++) table[i] = [i];
      table[clearCode] = []; table[eofCode] = [];
      codeSize = minCodeSize + 1; nextCode = eofCode + 1; codeMask = (1 << codeSize) - 1;
    };
    initTable();

    const output = new Uint8Array(pixelCount);
    let outPos = 0, bitBuf = 0, bitsLeft = 0, dataPos = 0;

    const readCode = () => {
      while (bitsLeft < codeSize) {
        if (dataPos >= data.length) return -1;
        bitBuf |= data[dataPos++] << bitsLeft; bitsLeft += 8;
      }
      const code = bitBuf & codeMask;
      bitBuf >>= codeSize; bitsLeft -= codeSize;
      return code;
    };

    let prevCode = -1;
    while (outPos < pixelCount) {
      const code = readCode();
      if (code < 0 || code === eofCode) break;
      if (code === clearCode) { initTable(); prevCode = -1; continue; }

      let entry;
      if (code < nextCode) entry = table[code];
      else if (code === nextCode && prevCode >= 0) entry = table[prevCode].concat(table[prevCode][0]);
      else break;

      for (let i = 0; i < entry.length && outPos < pixelCount; i++) output[outPos++] = entry[i];

      if (prevCode >= 0 && nextCode < 4096) {
        table[nextCode++] = table[prevCode].concat(entry[0]);
        if (nextCode > codeMask && codeSize < 12) { codeSize++; codeMask = (1 << codeSize) - 1; }
      }
      prevCode = code;
    }
    return output;
  }

  _deinterlace(pixels, w, h) {
    const copy   = pixels.slice();
    const passes = [{ start: 0, step: 8 }, { start: 4, step: 8 }, { start: 2, step: 4 }, { start: 1, step: 2 }];
    let src = 0;
    for (const { start, step } of passes)
      for (let y = start; y < h; y += step)
        for (let x = 0; x < w; x++) pixels[y * w + x] = copy[src++];
  }
}
