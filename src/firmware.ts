import { BinaryReader } from './BinaryReader';
import { PanelCommands, type PanelCommandsSource } from './commands';

type DsiFormat = 'rgb888' | 'rgb666' | 'rgb666-packed' | 'rgb565';

const firmwareMagic = [0x50, 0x41, 0x4e, 0x45, 0x4c, 0x2d, 0x46, 0x49, 0x52, 0x4d, 0x57, 0x41, 0x52, 0x45, 0x00];
const firmwareVersion = 1;

const DsiFormats: Record<DsiFormat, number> = {
  rgb888: 0,
  rgb666: 1,
  'rgb666-packed': 2,
  rgb565: 3,
};

/* include/drm/drm_modes.h */
const DrmModeFlag = {
  PHSYNC: 1 << 0,
  NHSYNC: 1 << 1,
  PVSYNC: 1 << 2,
  NVSYNC: 1 << 3,
  INTERLACE: 1 << 4,
  DBLSCAN: 1 << 5,

  CSYNC: 1 << 6,
  PCSYNC: 1 << 7,
  NCSYNC: 1 << 8,
  // HSKEW: (1<<9), // not supported currently
  // BCAST: deprecated
  // PIXMUX: deprecated
  DBLCLK: 1 << 12,
  CLKDIV2: 1 << 13,

  /*
  // 3D modes are not supported yet
  '3D_NONE': (0<<14),
  '3D_FRAME_PACKING': (1<<14),
  '3D_FIELD_ALTERNATIVE': (2<<14),
  '3D_LINE_ALTERNATIVE': (3<<14),
  '3D_SIDE_BY_SIDE_FULL': (4<<14),
  '3D_L_DEPTH': (5<<14),
  '3D_L_DEPTH_GFX_GFX_DEPTH': (6<<14),
  '3D_TOP_AND_BOTTOM': (7<<14),
  '3D_SIDE_BY_SIDE_HALF': (8<<14),
  */
};

const BIT = (n: number) => 1 << n;
const DrmBusFlag = {
  DE_LOW: BIT(0),
  DE_HIGH: BIT(1),
  PIXDATA_DRIVE_POSEDGE: BIT(2),
  PIXDATA_DRIVE_NEGEDGE: BIT(3),
  PIXDATA_SAMPLE_POSEDGE: BIT(3),
  PIXDATA_SAMPLE_NEGEDGE: BIT(2),
  DATA_MSB_TO_LSB: BIT(4),
  DATA_LSB_TO_MSB: BIT(5),
  SYNC_DRIVE_POSEDGE: BIT(6),
  SYNC_DRIVE_NEGEDGE: BIT(7),
  SYNC_SAMPLE_POSEDGE: BIT(7),
  SYNC_SAMPLE_NEGEDGE: BIT(6),
  SHARP_SIGNALS: BIT(8),
};

const DsiModeFlag = {
  MODE_VIDEO: BIT(0),
  MODE_VIDEO_BURST: BIT(1),
  MODE_VIDEO_SYNC_PULSE: BIT(2),
  MODE_VIDEO_AUTO_VERT: BIT(3),
  MODE_VIDEO_HSE: BIT(4),
  MODE_VIDEO_NO_HFP: BIT(5),
  MODE_VIDEO_NO_HBP: BIT(6),
  MODE_VIDEO_NO_HSA: BIT(7),
  MODE_VSYNC_FLUSH: BIT(8),
  MODE_NO_EOT_PACKET: BIT(9),
  CLOCK_NON_CONTINUOUS: BIT(10),
  MODE_LPM: BIT(11),
  HS_PKT_END_ALIGNED: BIT(12),
};

type SerializeOptions = {
  normalizeCommands?: boolean;
};

type FlagsObject<T extends string> = Partial<Record<T, boolean>>;
type FlagsInput<T extends string> = number | string | T[] | FlagsObject<T>;

type DrmModeFlags = keyof typeof DrmModeFlag;
type DrmBusFlags = keyof typeof DrmBusFlag;
type DsiModeFlags = keyof typeof DsiModeFlag;

type PanelTimingObject<F extends FlagsInput<DrmModeFlags>> = {
  dclk: number /* in kHz */;

  hactive: number;
  hfp: number;
  hslen: number;
  hbp: number;

  vactive: number;
  vfp: number;
  vslen: number;
  vbp: number;

  flags: F;
};

type PanelTimingArray<F extends FlagsInput<DrmModeFlags>> = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  F,
];
type PanelTiming<F extends FlagsInput<DrmModeFlags>> = PanelTimingObject<F> | PanelTimingArray<F>;

export type PanelConfig = {
  filename?: string;

  width_mm?: number;
  height_mm?: number;
  rotation?: 0 | 90 | 180 | 270;

  delays?: {
    reset?: number;
    init?: number;
    sleep?: number;
    backlight?: number;
  };

  dsi?: {
    lanes: number;
    format: DsiFormat | number;
    mode_flags: FlagsInput<DsiModeFlags>;
  };
  bus_flags?: FlagsInput<DrmBusFlags>;

  preferred_timing?: number;
  timings?: PanelTiming<FlagsInput<DrmModeFlags>>[];

  init_sequence?: PanelCommandsSource;
};

export type SerializedPanelTiming = PanelTimingObject<FlagsObject<DrmModeFlags>>;
export type SerializedConfig = {
  filename?: string;

  width_mm: number;
  height_mm: number;
  rotation: 0 | 90 | 180 | 270;

  delays: {
    reset: number;
    init: number;
    sleep: number;
    backlight: number;
  };

  dsi: {
    lanes: number;
    format: DsiFormat;
    mode_flags: FlagsObject<DsiModeFlags>;
  };
  bus_flags: FlagsObject<DrmBusFlags>;

  preferred_timing: number;
  timings: SerializedPanelTiming[];

  init_sequence: string[];
};

type ParsedConfig = {
  filename?: string;

  width_mm: number;
  height_mm: number;
  rotation: 0 | 90 | 180 | 270;

  delays: {
    reset: number;
    init: number;
    sleep: number;
    backlight: number;
  };

  dsi: {
    lanes: number;
    format: number;
    mode_flags: number;
  };
  bus_flags: number;

  preferred_timing: number;
  timings: PanelTimingObject<number>[];

  init_sequence: PanelCommands;
};

const be = (v: number, n: number) => [...new Array(n)].map((_, i) => (v / Math.pow(0x100, n - i - 1)) & 0xff);
const be16 = (v: number) => be(v, 2);
const be32 = (v: number) => be(v, 4);

const u8 = (v: number | undefined) => [v || 0];
const u16 = (v: number | undefined) => be16(v || 0);
const u32 = (v: number | undefined) => be32(v || 0);
const reserved = (n: number) => [...new Array(n)].map(() => 0);

function parseFlags<Def extends Record<string, number>>(
  flagDefs: Def,
  name: string,
  flags: FlagsInput<keyof Def & string>,
) {
  if (!Array.isArray(flags) && typeof flags === 'object') {
    flags = Object.entries(flags)
      .filter(([_, v]) => v)
      .map(([k]) => k);
  }
  if (typeof flags === 'string') flags = flags.trim().split(/\s*[|,]\s*/) as (keyof Def & string)[];
  if (Array.isArray(flags))
    flags = flags
      .filter((x) => x)
      .reduce((acc, flag) => {
        if (typeof flagDefs[flag] === 'undefined') throw new Error(`Invalid ${name}: ${String(flag)}`);
        return acc | flagDefs[flag];
      }, 0);
  return flags;
}

function parseDsiFormat(flags: DsiFormat | number) {
  if (typeof flags === 'string') {
    return DsiFormats[flags];
  }
  return flags;
}

function parseDrmModeFlags(flags: FlagsInput<DrmModeFlags>) {
  return parseFlags(DrmModeFlag, 'DRM_MODE_FLAG', flags);
}

function parseDrmBusFlags(flags: FlagsInput<DrmBusFlags>) {
  return parseFlags(DrmBusFlag, 'DRM_BUS_FLAG', flags);
}

function parseDsiModeFlags(flags: FlagsInput<DsiModeFlags>) {
  return parseFlags(DsiModeFlag, 'MIPI_DSI', flags);
}

function parsePanelTiming(t: PanelTiming<FlagsInput<DrmModeFlags>>): PanelTimingObject<number> {
  if (Array.isArray(t)) {
    const [hactive, hfp, hslen, hbp, vactive, vfp, vslen, vbp, dclk, flags] = t;
    return parsePanelTiming({ hactive, hfp, hslen, hbp, vactive, vfp, vslen, vbp, dclk, flags });
  }

  const { hactive, hfp, hslen, hbp, vactive, vfp, vslen, vbp, dclk, flags } = t;
  return { hactive, hfp, hslen, hbp, vactive, vfp, vslen, vbp, dclk, flags: parseDrmModeFlags(flags) };
}

function packPanelTiming(t: PanelTimingObject<number>) {
  const { hactive, hfp, hslen, hbp, vactive, vfp, vslen, vbp, dclk, flags } = t;
  return [
    u16(hactive),
    u16(hfp),
    u16(hslen),
    u16(hbp),

    u16(vactive),
    u16(vfp),
    u16(vslen),
    u16(vbp),

    u32(dclk),
    u32(flags),
    reserved(8),
  ].flatMap((x) => x);
}

function packPanelTimings(timings: PanelTimingObject<number>[]) {
  return timings.flatMap((t) => packPanelTiming(t));
}

function serializeFlags<Def extends Record<string, number>, T extends keyof Def & string>(
  defs: Def,
  flags: number,
): FlagsObject<T> {
  const kv = Object.entries(defs);
  const result: Record<string, boolean> = {};

  for (let i = 0; i < 32; i++) {
    if (flags & (1 << i)) {
      const found = kv.find(([_, v]) => 1 << i == v);
      if (found) {
        result[found[0]] = true;
      }
    }
  }

  return result as FlagsObject<T>;
}

function serializeDsiFormat(flags: DsiFormat | number) {
  if (typeof flags === 'number') {
    return (Object.entries(DsiFormats).find(([_, v]) => v === flags)?.[0] || 'rgb888') as DsiFormat;
  }
  return flags;
}

function serializeDsiModeFlags(flags: number) {
  return serializeFlags(DsiModeFlag, flags);
}

function serializeDrmBusFlags(flags: number) {
  return serializeFlags(DrmBusFlag, flags);
}

function serializeDrmModeFlags(flags: number) {
  return serializeFlags(DrmModeFlag, flags);
}

function serializePanelTiming(timing: PanelTimingObject<number>) {
  const { hactive, hfp, hslen, hbp, vactive, vfp, vslen, vbp, dclk, flags } = timing;
  return { hactive, hfp, hslen, hbp, vactive, vfp, vslen, vbp, dclk, flags: serializeDrmModeFlags(flags) };
}

function parseBlob(u8: Uint8Array | Uint8ClampedArray): ParsedConfig {
  const r = new BinaryReader(u8);

  if (firmwareMagic.some((x) => x !== r.readByte())) {
    throw new Error('Invalid magic');
  }

  if (firmwareVersion !== r.readByte()) {
    throw new Error('Invalid version');
  }

  const conf = {} as ParsedConfig;

  conf.width_mm = r.readBe16();
  conf.height_mm = r.readBe16();
  const rotation = r.readBe16();
  if (rotation !== 0 && rotation !== 90 && rotation !== 180 && rotation !== 270) {
    throw new Error('Invalid rotation');
  }
  conf.rotation = rotation;
  r.skip(2);
  r.skip(8);

  const reset = r.readBe16();
  const init = r.readBe16();
  const sleep = r.readBe16();
  const backlight = r.readBe16();
  r.skip(2 * 4);
  conf.delays = { reset, init, sleep, backlight };

  const lanes = r.readBe16();
  const format = parseDsiFormat(r.readBe16());
  const mode_flags = parseDsiModeFlags(r.readBe32());
  conf.dsi = { lanes, format, mode_flags };

  conf.bus_flags = parseDrmBusFlags(r.readBe32());
  r.skip(2);

  conf.preferred_timing = r.readByte();
  const numTimings = r.readByte();
  conf.timings = [];
  for (let i = 0; i < numTimings; i++) {
    const hactive = r.readBe16();
    const hfp = r.readBe16();
    const hslen = r.readBe16();
    const hbp = r.readBe16();

    const vactive = r.readBe16();
    const vfp = r.readBe16();
    const vslen = r.readBe16();
    const vbp = r.readBe16();

    const dclk = r.readBe32();

    const flags = r.readBe32();
    r.skip(8);

    conf.timings.push({ hactive, hfp, hslen, hbp, vactive, vfp, vslen, vbp, dclk, flags });
  }

  conf.init_sequence = new PanelCommands(u8.slice(r.position));

  return conf;
}

function packHeader() {
  return [firmwareMagic, u8(firmwareVersion)].flatMap((x) => x);
}

function packConfig(config: ParsedConfig) {
  return [
    // config: basic
    u16(config.width_mm),
    u16(config.height_mm),
    u16(config.rotation),
    reserved(2),
    reserved(8),

    // config: delays
    u16(config.delays.reset),
    u16(config.delays.init),
    u16(config.delays.sleep),
    u16(config.delays.backlight),
    reserved(2 * 4),

    // config: dsi
    u16(config.dsi.lanes),
    u16(config.dsi.format),
    u32(config.dsi.mode_flags),

    // config: drm_bus
    u32(config.bus_flags),
    reserved(2),

    // config: timings
    u8(config.preferred_timing),
    u8(config.timings.length),

    // timings
    packPanelTimings(config.timings || []),
  ].flatMap((x) => x);
}

function packCommands(commands: PanelCommands) {
  return commands.array();
}

function parsePanelTimings(timings: PanelTiming<FlagsInput<DrmModeFlags>>[]) {
  return timings.map((timing) => parsePanelTiming(timing));
}

function parseConfig(config: PanelConfig): ParsedConfig {
  return {
    filename: config.filename,

    width_mm: config.width_mm ?? 0,
    height_mm: config.height_mm ?? 0,
    rotation: config.rotation ?? 0,
    delays: {
      reset: config.delays?.reset ?? 5,
      init: config.delays?.init ?? 10,
      sleep: config.delays?.sleep ?? 120,
      backlight: config.delays?.backlight ?? 0,
    },
    dsi: {
      lanes: config.dsi?.lanes ?? 0,
      format: parseDsiFormat(config.dsi?.format ?? 0),
      mode_flags: parseDsiModeFlags(config.dsi?.mode_flags ?? 0),
    },
    bus_flags: parseDrmBusFlags(config.bus_flags ?? 0),

    preferred_timing: config.preferred_timing ?? 0,
    timings: parsePanelTimings(config.timings ?? []),

    init_sequence: new PanelCommands(config.init_sequence ?? []),
  };
}

function serializeConfig(config: ParsedConfig, { normalizeCommands }: SerializeOptions): SerializedConfig {
  return {
    filename: config.filename,

    width_mm: config.width_mm,
    height_mm: config.height_mm,
    rotation: config.rotation,
    delays: {
      reset: config.delays.reset,
      init: config.delays.init,
      sleep: config.delays.sleep,
      backlight: config.delays.backlight,
    },
    dsi: {
      lanes: config.dsi.lanes,
      format: serializeDsiFormat(config.dsi.format),
      mode_flags: serializeDsiModeFlags(config.dsi.mode_flags),
    },
    bus_flags: serializeDrmBusFlags(config.bus_flags),

    preferred_timing: config.preferred_timing,
    timings: config.timings.map(serializePanelTiming),

    init_sequence: config.init_sequence.serialize({ normalize: normalizeCommands }),
  };
}

export class PanelFirmware {
  #config: ParsedConfig;

  constructor(conf: PanelConfig | Uint8Array | Uint8ClampedArray) {
    if (conf instanceof Uint8Array || conf instanceof Uint8ClampedArray) {
      this.#config = parseBlob(conf);
    } else {
      this.#config = parseConfig(conf);
    }
  }

  toJSON() {
    return this.serialize({ normalizeCommands: false });
  }

  serialize(opts: SerializeOptions = { normalizeCommands: true }) {
    return serializeConfig(this.#config, opts);
  }

  array() {
    return [...packHeader(), ...packConfig(this.#config), ...packCommands(this.#config.init_sequence)];
  }

  u8() {
    return new Uint8ClampedArray(this.array());
  }

  blob() {
    return new Blob([this.u8()]);
  }

  commands() {
    return this.#config.init_sequence;
  }
}
