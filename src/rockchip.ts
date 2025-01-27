import { BinaryReader } from './BinaryReader';
import { Fdt, type FdtNode } from './fdt';
import { type PanelConfig, PanelFirmware, type SerializedPanelTiming } from './firmware';

function parseRockchipCommands(seq: ArrayBuffer | undefined) {
  if (!seq) return [];
  const cmds: (string | Uint8Array)[] = [];

  const r = new BinaryReader(seq);

  while (!r.eof()) {
    r.readByte(); // dtype: unused
    const wait = r.readByte();
    const dlen = r.readByte();

    cmds.push(new Uint8Array(r.readBytes(dlen)));
    if (wait) cmds.push(`sleep ${wait}ms`);
  }

  return cmds;
}

function parseDisplayTimings(node: FdtNode | undefined) {
  if (!node) return [];
  const timings: PanelConfig['timings'] = [];

  const nativeMode = node.readBe32('native-mode');
  const nodes = Object.values(node.nodes);
  let preferred_timing = 0;
  const bus_flags: PanelConfig['bus_flags'] = {};

  for (let idx = 0; idx < nodes.length; idx++) {
    const n = nodes[idx];
    const dclk = (n.readBe32('clock-frequency') || 0) / 1000;
    const hactive = n.readBe32('hactive') || 0;
    const vactive = n.readBe32('vactive') || 0;
    const hfp = n.readBe32('hfront-porch') || 0;
    const hslen = n.readBe32('hsync-len') || 0;
    const hbp = n.readBe32('hback-porch') || 0;
    const vfp = n.readBe32('vfront-porch') || 0;
    const vslen = n.readBe32('vsync-len') || 0;
    const vbp = n.readBe32('vback-porch') || 0;

    const hsync_active = n.readBe32('hsync-active');
    const vsync_active = n.readBe32('vsync-active');
    const de_active = n.readBe32('de-active');
    const pixelclk_active = n.readBe32('pixelclk-active');

    const flags: SerializedPanelTiming['flags'] = {};
    if (vsync_active !== undefined) {
      flags[vsync_active ? 'PVSYNC' : 'NVSYNC'] = true;
    }
    if (hsync_active !== undefined) {
      flags[hsync_active ? 'PHSYNC' : 'NHSYNC'] = true;
    }
    if (de_active !== undefined) {
      bus_flags[de_active ? 'DE_HIGH' : 'DE_LOW'] = true;
    }
    if (pixelclk_active !== undefined) {
      bus_flags[pixelclk_active ? 'PIXDATA_DRIVE_POSEDGE' : 'PIXDATA_DRIVE_NEGEDGE'] = true;
    }

    const phandle = n.readBe32('phandle');

    if (phandle === nativeMode) {
      preferred_timing = idx;
    }

    if (!dclk || !hactive || !vactive) continue;

    timings.push({
      hactive,
      hfp,
      hslen,
      hbp,
      vactive,
      vfp,
      vslen,
      vbp,
      dclk,
      flags,
    });
  }

  return { preferred_timing, timings, bus_flags };
}

export function parseRockchipFdt(src: ArrayBuffer | Uint8Array) {
  const fdt = new Fdt(src);

  const node = fdt.findNodeByCompatible('simple-panel-dsi');
  if (!node) return undefined;

  const filename = node.readString('compatible', 0);
  const init_sequence = parseRockchipCommands(node.readBytes('panel-init-sequence'));
  const display_timings = parseDisplayTimings(node.getNode('display-timings'));

  const config: PanelConfig = {
    filename,

    width_mm: node.readBe32('width-mm'),
    height_mm: node.readBe32('height-mm'),
    rotation: 0,

    delays: {
      reset: node.readBe32('reset-delay-ms'),
      init: node.readBe32('init-delay-ms'),
      sleep: node.readBe32('enable-delay-ms'),
    },

    dsi: {
      lanes: node.readBe32('dsi,lanes') || 0,
      format: node.readBe32('dsi,format') || 0,
      mode_flags: node.readBe32('dsi,flags') || 0,
    },
    bus_flags: {},

    init_sequence,

    ...display_timings,
  };

  return new PanelFirmware(config).serialize();
}
