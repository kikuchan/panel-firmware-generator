import { BinaryReader } from './binary-reader';

function coalesceArray<T>(arr: T[], fn: (elm: T) => T | undefined) {
  for (const elm of arr) {
    const r = fn(elm);
    if (r) return r;
  }
  return undefined;
}

type FdtHeader = {
  totalsize: number;
  off_dt_struct: number;
  off_dt_strings: number;
  off_mem_rsvmap: number;
  version: number;
  last_comp_version: number;
  boot_cpuid_phys: number;
  size_dt_strings: number;
  size_dt_struct: number;
};

const FdtToken = {
  FDT_PADDING: 0,
  FDT_BEGIN_NODE: 1,
  FDT_END_NODE: 2,
  FDT_PROP: 3,
  FDT_NOP: 4,
  FDT_END: 9,
} as const;

type FdtToken = (typeof FdtToken)[keyof typeof FdtToken];

export class FdtNode {
  properties: Record<string, BinaryReader> = {};
  nodes: Record<string, FdtNode> = {};

  addProperty(name: string, value: Uint8Array) {
    this.properties[name] = new BinaryReader(value);
  }

  addNode(name: string, node: FdtNode) {
    this.nodes[name] = node;
  }

  readString(name: string, idx?: number): string | undefined {
    return this.readStrings(name)[idx ?? 0];
  }

  readStrings(name: string) {
    const r = this.properties?.[name]?.seek(0);
    const result: string[] = [];

    let s: string | undefined;
    while ((s = r?.readString()) !== undefined) {
      result.push(s);
    }
    return result;
  }

  readBe32(name: string): number | undefined {
    return this.properties?.[name]?.seek(0)?.readBe32();
  }

  readBytes(name: string) {
    if (!(name in this.properties)) return undefined;
    return this.properties[name].seek(0).readBytes();
  }

  getNode(name: string): FdtNode | undefined {
    return this.nodes?.[name];
  }

  getNodes() {
    return Object.values(this.nodes);
  }
}

export class Fdt {
  #data: Uint8Array | ArrayBuffer;
  #r: BinaryReader;
  #n: BinaryReader;
  #header: FdtHeader;
  #root: FdtNode;

  constructor(data: Uint8Array | ArrayBuffer) {
    this.#data = data;
    this.#r = new BinaryReader(this.#data);
    this.#n = new BinaryReader(this.#data);
    this.#header = this.#readHeader();

    this.#root = this.#readTree();
  }

  #readHeader(): FdtHeader {
    this.#r.seek(0);

    const magic = this.#r.readBe32();

    if (magic !== 0xd00dfeed) {
      throw new Error('Invalid FDT');
    }

    const totalsize = this.#r.readBe32();
    const off_dt_struct = this.#r.readBe32();
    const off_dt_strings = this.#r.readBe32();
    const off_mem_rsvmap = this.#r.readBe32();
    const version = this.#r.readBe32();
    const last_comp_version = this.#r.readBe32();
    const boot_cpuid_phys = this.#r.readBe32();
    const size_dt_strings = this.#r.readBe32();
    const size_dt_struct = this.#r.readBe32();

    return {
      totalsize,
      off_dt_struct,
      off_dt_strings,
      off_mem_rsvmap,
      version,
      last_comp_version,
      boot_cpuid_phys,
      size_dt_strings,
      size_dt_struct,
    };
  }

  readMemoryReservationBlock() {
    this.#r.seek(this.#header.off_mem_rsvmap);

    const result: { address: bigint; size: bigint }[] = [];
    while (true) {
      const address = this.#r.readBe64();
      const size = this.#r.readBe64();

      if (!address && !size) break;

      result.push({ address, size });
    }
    return result;
  }

  #readName(nameoff: number) {
    return this.#n.seek(this.#header.off_dt_strings + nameoff).readString();
  }

  #readTree() {
    this.#r.seek(this.#header.off_dt_struct);

    const root: FdtNode = new FdtNode();
    const stack: FdtNode[] = [];

    while (true) {
      const token: FdtToken = this.#r.align(4).readBe32() as FdtToken;
      switch (token) {
        case FdtToken.FDT_PADDING:
          break;
        case FdtToken.FDT_BEGIN_NODE:
          const nodeName = this.#r.readString();
          if (stack.length === 0) {
            stack.unshift(root);
          } else {
            if (!nodeName) throw new Error('Invalid Tree');
            const tree = new FdtNode();
            stack[0].addNode(nodeName, tree);
            stack.unshift(tree);
          }
          break;
        case FdtToken.FDT_END_NODE:
          stack.shift();
          break;
        case FdtToken.FDT_PROP:
          const len = this.#r.readBe32();
          const name = this.#readName(this.#r.readBe32());

          if (!name) throw new Error('Invalid Property');
          const data = new Uint8Array(this.#r.readBytes(len));
          stack[0].addProperty(name, data);

          break;
        case FdtToken.FDT_NOP:
          break;
        case FdtToken.FDT_END:
          return root;

        default:
          throw new Error('Unknown token: ' + token);
      }
    }
  }

  find(node: FdtNode, pred: (node: FdtNode) => boolean): FdtNode | undefined {
    if (pred(node)) return node;
    return coalesceArray(node.getNodes(), (elm) => elm && this.find(elm, pred));
  }

  findNodeByCompatible(c: string) {
    return this.find(this.#root, (node) => node?.readStrings('compatible').includes(c));
  }
}
