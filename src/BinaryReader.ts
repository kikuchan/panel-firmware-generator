export class BinaryReader {
  view: DataView;
  position: number;

  constructor(u8: ArrayBuffer | Uint8Array | Uint8ClampedArray) {
    if (u8 instanceof ArrayBuffer) {
      this.view = new DataView(u8);
    } else {
      this.view = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    }
    this.position = 0;
  }

  get size() {
    return this.view.byteLength;
  }

  get remain() {
    return this.size - this.position;
  }

  eof() {
    return this.remain <= 0;
  }

  seek(n: number) {
    this.position = n;
    return this;
  }

  skip(n: number) {
    this.position += n;
    return this;
  }

  align(n: number) {
    if (this.position % n) {
      return this.skip(n - (this.position % n));
    }
    return this;
  }

  peekBuffer(n?: number) {
    if (n === undefined) n = this.remain;
    if (this.remain < n) return undefined; // EOF

    const pos = this.view.byteOffset + this.position;
    return this.view.buffer.slice(pos, pos + n);
  }

  readByte() {
    return this.view.getUint8(this.position++);
  }

  readBe16() {
    const r = this.view.getUint16(this.position, false);
    this.position += 2;
    return r;
  }

  readBe32() {
    const r = this.view.getUint32(this.position, false);
    this.position += 4;
    return r;
  }

  readBe64() {
    const h = this.readBe32();
    const l = this.readBe32();
    return (BigInt(h) << 32n) | (BigInt(l) << 0n);
  }

  readBytes(n?: number) {
    const buffer = this.peekBuffer(n);
    if (buffer) this.skip(buffer.byteLength);
    return buffer;
  }

  #strlen() {
    const remain = this.remain;
    for (let i = 0; i < remain; i++) {
      if (this.view.getUint8(this.position + i) === 0) {
        return i;
      }
    }
    return undefined; // No termination
  }

  /**
   * @returns string. undefined on oversize or EOF.
   */
  readString(len?: number, encoding?: string) {
    const remain = this.remain;
    let extraLength = 0;

    if (len === undefined) {
      // C String Mode
      len = this.#strlen();
      extraLength = 1;
    }
    if (len === undefined || remain < len) return undefined; // EOF

    const buffer = this.peekBuffer(len);
    try {
      const string = new TextDecoder(encoding ?? 'utf-8', { fatal: true }).decode(buffer);
      this.skip(len + extraLength);
      return string;
    } catch {
      return undefined;
    }
  }
}
