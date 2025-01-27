export class BinaryReader {
  buffer: DataView<ArrayBufferLike>;
  position: number;

  constructor(u8: ArrayBuffer | Uint8Array | Uint8ClampedArray) {
    if (u8 instanceof ArrayBuffer) {
      this.buffer = new DataView(u8);
    } else {
      this.buffer = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    }
    this.position = 0;
  }

  readByte() {
    return this.buffer.getUint8(this.position++);
  }

  readBe16() {
    const r = this.buffer.getUint16(this.position, false);
    this.position += 2;
    return r;
  }

  readBe32() {
    const r = this.buffer.getUint32(this.position, false);
    this.position += 4;
    return r;
  }

  readBe64() {
    const h = this.readBe32();
    const l = this.readBe32();
    return (BigInt(h) << 32n) | (BigInt(l) << 0n);
  }

  readBytes(n?: number) {
    const pos = this.buffer.byteOffset + this.position;
    if (n === undefined) n = this.buffer.byteLength - this.position;
    this.position += n;
    return this.buffer.buffer.slice(pos, pos + n);
  }

  readString() {
    const size = this.buffer.byteLength - this.position;
    for (let i = 0; i < size; i++) {
      if (this.buffer.getUint8(this.position + i) === 0) {
        return new TextDecoder().decode(this.readBytes(i + 1).slice(0, -1));
      }
    }
    return undefined;
  }

  eof() {
    return this.position >= this.buffer.byteLength;
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
}
