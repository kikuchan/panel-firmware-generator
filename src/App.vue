<template>
  <div class="content leading-4">
    <div class="flex-none basis-0">
      <h1>Panel Firmware Generator</h1>
      <div class="flex flex-wrap justify-between gap-2 text-nowrap">
        <div class="flex gap-2">
          <button @click="page = 'main'" :aria-selected="page == 'main'">Parameters</button>
          <button @click="page = 'init-sequence'" :aria-selected="page == 'init-sequence'">Init Sequence</button>
          <button @click="page = 'dts'" :aria-selected="page == 'dts'" :disabled="!firmware">DTS</button>
          <button @click="page = 'json'" :aria-selected="page == 'json'" :disabled="!firmware">JSON</button>
          <button @click="page = 'hex'" :aria-selected="page == 'hex'" :disabled="!firmware">Firmware</button>
        </div>
        <div class="flex gap-2">
          <button @click="downloadJson()"><Icon name="download" />JSON</button>
          <button @click="downloadFirmware()"><Icon name="download" />Panel Firmware</button>
        </div>
      </div>
    </div>
    <div v-if="page === 'main'" class="basis-full">
      <div>
        <h2>
          Configurations:
          <div class="flex gap-2">
            <select v-model="preset" class="ml-0 h-7 rounded border px-2 text-[1rem]!">
              <optgroup v-for="(group, gid) in presets" :key="gid" :label="group.name">
                <option v-for="(item, idx) in group.children" :key="idx" :value="item.data">
                  {{ item.name }}
                </option>
              </optgroup>
            </select>
            <button @click="onPresetLoad()" class="h-7">Load</button>
          </div>
        </h2>
        <div class="flex flex-wrap gap-x-8 gap-y-4 pl-4">
          <Panel class="w-full">
            <Field label="Filename" size="32">
              <input type="text" v-model="config.filename" class="h-full w-full bg-white focus:outline-none" />
            </Field>
          </Panel>
          <Panel>
            <Input v-model="config.width_mm" label="Width" unit="mm" />
            <Input v-model="config.height_mm" label="Height" unit="mm" />
            <Field label="Size" unit="inch" readonly size="6">
              <FixedPoint
                :value="inch(diagonal(config.width_mm, config.height_mm))"
                upper="2"
                lower="3"
                class="block w-full text-right font-mono! text-[1.25rem] leading-none select-none" />
            </Field>
            <Select v-model="config.rotation" label="Rotation" unit="deg" class="text-right">
              <option :value="0">0</option>
              <option :value="90">90</option>
              <option :value="180">180</option>
              <option :value="270">270</option>
            </Select>
          </Panel>
          <Panel>
            <Input v-model="config.delays.reset" label="Reset" unit="ms" />
            <Input v-model="config.delays.init" label="Init" unit="ms" />
            <Input v-model="config.delays.sleep" label="Sleep" unit="ms" />
            <Input v-model="config.delays.backlight" label="Backlight" unit="ms" />
          </Panel>

          <Panel class="w-full">
            <Input v-model="config.dsi.lanes" label="DSI Lanes" />
            <Select v-model="config.dsi.format" :disabled="!config.dsi.lanes" label="DSI Format">
              <option value="rgb888">RGB 888</option>
              <option value="rgb666">RGB 666</option>
              <option value="rgb666-packed">RGB 666 (packed)</option>
              <option value="rgb565">RGB 565</option>
            </Select>
            <Flags
              v-model="config.dsi.mode_flags"
              :disabled="!config.dsi.lanes"
              :flags="dsiModeFlags"
              label="DSI Mode Flags" />
          </Panel>
          <Panel class="w-full">
            <Flags v-model="config.bus_flags" :flags="drmBusFlags" label="DRM Bus Flags" />
          </Panel>
        </div>
      </div>
      <div>
        <h2>
          Panel Timings:
          <button @click="addItem()">New</button>
        </h2>
        <div v-if="!config.timings.length" class="pl-4">None configured.</div>
        <div v-for="(item, idx) in config.timings" :key="idx" class="mt-2 pl-4">
          <div
            class="box-border rounded border border-slate-300 bg-slate-50 aria-selected:border-green-300 aria-selected:bg-green-50"
            :aria-selected="idx === config.preferredTiming">
            <div
              class="flex items-center justify-between gap-4 bg-slate-200 px-0.5 leading-8 in-[&[aria-selected='true']]:bg-green-200">
              <div class="font-bold">
                <span class="text-slate-400">#{{ idx }}</span>
                {{ item.hactive }}x{{ item.vactive }}
                <span class="text-slate-400">@</span>
                {{ fps(item).toFixed(2) }}
              </div>
              <div class="space-x-0.5">
                <button class="" @click.stop="duplicateItem(item)">Duplicate</button>
                <button class="border-red-400! bg-red-200! hover:bg-red-300!" @click.stop="removeItem(item)">
                  Remove
                </button>
              </div>
            </div>
            <div class="flex w-full gap-4 px-2 py-1">
              <label class="flex flex-col items-center justify-center text-center">
                <div class="block font-mono text-sm select-none">Prefer</div>
                <input type="radio" v-model="config.preferredTiming" :value="idx" />
              </label>
              <div class="w-full">
                <div class="mb-2 flex flex-wrap items-baseline gap-x-8 gap-y-2 p-1">
                  <div class="flex items-center gap-4">
                    <Input type="number" v-model="item.hactive" label="Hactive" unit="pixels" />
                    <Input type="number" v-model="item.hfp" label="Hfp" unit="pixels" />
                    <Input type="number" v-model="item.hslen" label="Hsync" unit="pixels" />
                    <Input type="number" v-model="item.hbp" label="Hbp" unit="pixels" />
                    <Field label="Htotal" unit="pixels" readonly size="6">
                      <div class="w-full text-right font-mono! text-[1.25rem] leading-none select-none">
                        {{ htotal(item) }}
                      </div>
                    </Field>
                  </div>
                  <div class="flex items-center gap-4">
                    <Input type="number" v-model="item.vactive" label="Vactive" unit="lines" />
                    <Input type="number" v-model="item.vfp" label="Vfp" unit="lines" />
                    <Input type="number" v-model="item.vslen" label="Vsync" unit="lines" />
                    <Input type="number" v-model="item.vbp" label="Vbp" unit="lines" />
                    <Field label="Vtotal" unit="lines" readonly size="6">
                      <div class="w-full text-right font-mono! text-[1.25rem] leading-none select-none">
                        {{ vtotal(item) }}
                      </div>
                    </Field>
                  </div>
                  <div class="flex flex-wrap justify-between gap-x-10 gap-y-4">
                    <div class="flex gap-4">
                      <Input type="number" v-model="item.dclk" label="Dot Clock" size="6" unit="kHz" />
                      <Field label="FPS" unit="frames/s" readonly size="6">
                        <FixedPoint
                          :value="fps(item)"
                          upper="2"
                          lower="2"
                          class="block w-full text-right font-mono! text-[1.25rem] leading-none select-none" />
                      </Field>
                    </div>
                    <Flags v-model="item.flags" :flags="drmModeFlags" label="DRM Mode Flags" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div v-if="page === 'init-sequence'" class="flex flex-grow basis-full flex-col">
      <h2>
        Init Sequence:
        <button @click="normalizeCommands()">Normalize</button>
      </h2>
      <div class="relative flex-grow pl-4">
        <textarea v-model="commands" class="h-full w-full resize-none" />
      </div>
    </div>
    <div v-if="page === 'dts'" class="flex flex-grow basis-full flex-col">
      <h2>
        DTS:
        <div class="flex gap-2">
          <label class="text-base select-none">
            <input type="checkbox" v-model="flagFirmware" /> Use Firmware File
          </label>
          <label class="text-base select-none">
            <input type="checkbox" v-model="compact" /> Compact Init-Sequence
          </label>
        </div>
      </h2>
      <div class="relative flex-grow pl-4">
        <textarea readonly class="h-full w-full resize-none bg-gray-100" :value="dts"></textarea>
      </div>
    </div>
    <div v-if="page === 'json'" class="flex flex-grow basis-full flex-col">
      <h2>
        JSON:
        <div class="flex gap-2">
          <Upload @upload="uploadJson" accept=".json"><Icon name="upload" />JSON</Upload>
        </div>
      </h2>
      <div class="relative flex-grow pl-4">
        <textarea class="h-full w-full resize-none" @change="onJsonChange($event)" :value="json"></textarea>
      </div>
    </div>
    <div v-if="page === 'hex'" class="flex flex-grow basis-full flex-col">
      <h2>
        Firmware:
        <div class="flex gap-2">
          <Upload @upload="uploadFirmware" accept=".panel"><Icon name="upload" />Panel Firmware</Upload>
        </div>
      </h2>
      <div class="relative flex-grow pl-4">
        <textarea class="h-full w-full resize-none bg-gray-100" :value="dump"></textarea>
      </div>
    </div>
  </div>
</template>
>

<script lang="ts" setup>
import { hexdump } from '@kikuchan/hexdump';
import { PanelFirmware, type SerializedConfig, type SerializedPanelTiming } from './firmware';
import { presets } from './presets';

const commands = computed({
  set: (value) => {
    config.value.init_sequence = value.split('\n');
  },
  get: () => {
    return config.value.init_sequence.join('\n');
  },
});
const page = ref('main');

const dsiModeFlags = [
  ['MODE_VIDEO', 'MODE_VIDEO_BURST', 'MODE_VIDEO_SYNC_PULSE', 'MODE_VIDEO_AUTO_VERT'],
  ['MODE_VIDEO_HSE', 'MODE_VIDEO_NO_HFP', 'MODE_VIDEO_NO_HBP', 'MODE_VIDEO_NO_HSA'],
  ['MODE_VSYNC_FLUSH', 'MODE_NO_EOT_PACKET', 'CLOCK_NON_CONTINUOUS', 'HS_PKT_END_ALIGNED'],
  ['MODE_LPM'],
];

const drmModeFlags = [
  ['PHSYNC', 'NHSYNC'],
  ['PVSYNC', 'NVSYNC'],
  ['INTERLACE', 'DBLSCAN'],
  ['CSYNC'],
  ['PCSYNC', 'NCSYNC'],
  ['DBLCLK', 'CLKDIV2'],
];

const drmBusFlags = [
  ['DE_LOW', 'DE_HIGH'],
  ['PIXDATA_DRIVE_POSEDGE', 'PIXDATA_DRIVE_NEGEDGE'],
  ['DATA_MSB_TO_LSB', 'DATA_LSB_TO_MSB'],
  ['SYNC_DRIVE_POSEDGE', 'SYNC_DRIVE_NEGEDGE'],
  ['SHARP_SIGNALS'],
];

const config = ref<SerializedConfig>({
  filename: 'unknown-vendor,unknown-panel',

  width_mm: 70,
  height_mm: 53,
  rotation: 0 as 0 | 90 | 180 | 270,

  delays: {
    reset: 1,
    init: 10,
    sleep: 120,
    backlight: 120,
  },

  dsi: {
    lanes: 0,
    format: 'rgb888',
    mode_flags: {},
  },

  bus_flags: {},

  preferredTiming: 0,

  timings: [],

  init_sequence: [],
});

function vtotal(t: SerializedPanelTiming) {
  return t.vactive + t.vfp + t.vslen + t.vbp;
}

function htotal(t: SerializedPanelTiming) {
  return t.hactive + t.hfp + t.hslen + t.hbp;
}

function fps(t: SerializedPanelTiming) {
  return Number((t.dclk * 1000) / (htotal(t) * vtotal(t)));
}

function addItem(
  template = {
    hactive: 640,
    hfp: 140,
    hslen: 4,
    hbp: 16,

    vactive: 480,
    vfp: 14,
    vslen: 4,
    vbp: 2,

    dclk: 24000,

    flags: {},
  } as SerializedPanelTiming,
) {
  const hactive = ref(template.hactive);
  const hfp = ref(template.hfp);
  const hslen = ref(template.hslen);
  const hbp = ref(template.hbp);

  const vactive = ref(template.vactive);
  const vfp = ref(template.vfp);
  const vslen = ref(template.vslen);
  const vbp = ref(template.vbp);

  const dclk = ref(template.dclk);

  const flags = ref({ ...template.flags });

  const timing = reactive({
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

  config.value.timings.push(timing);
}

function removeItem(item: SerializedPanelTiming) {
  const idx = config.value.timings.indexOf(item);
  if (idx >= 0) config.value.timings.splice(idx, 1);

  if (config.value.preferredTiming >= config.value.timings.length) {
    config.value.preferredTiming = 0;
  }
}

function duplicateItem(item: SerializedPanelTiming) {
  addItem(item);
}

const firmware = computed(() => {
  try {
    return new PanelFirmware(config.value);
  } catch {
    return null;
  }
});

const json = computed(() => firmware.value && JSON.stringify(firmware.value, null, 4));

function downloadBlobAs(filename: string, blob: Blob) {
  const obj = window.URL.createObjectURL(blob);

  const downloader = document.createElement('a');
  downloader.setAttribute('href', obj);
  downloader.setAttribute('download', filename);
  downloader.click();

  setTimeout(() => {
    window.URL.revokeObjectURL(obj);
  }, 100);
}

function uploadFirmware(data: Uint8Array, file: File) {
  try {
    const parsed = new PanelFirmware(data).serialize();
    config.value = {
      ...parsed,

      filename: file.name.replace(/\.panel$/, ''),
    };
  } catch (e) {
    alert(e);
  }
}

function downloadFirmware() {
  if (!firmware.value) return;
  const blob = firmware.value.blob();
  downloadBlobAs(`${config.value.filename}.panel`, blob);
}

function uploadJson(data: Uint8Array) {
  try {
    const conf = JSON.parse(new TextDecoder().decode(data));
    const parsed = new PanelFirmware(conf).serialize({ normalizeCommands: false });

    config.value = parsed;
  } catch (e) {
    console.log('ERROR:' + e);
    alert(e);
  }
}

function downloadJson() {
  if (!firmware.value) return;
  const blob = new Blob([json.value!]);
  downloadBlobAs(`${config.value.filename}.json`, blob);
}

function diagonal(x: number, y: number) {
  return Math.sqrt(x * x + y * y);
}

function inch(mm: number) {
  return mm / 25.4;
}

function onJsonChange(e: Event) {
  const textarea = e.target as HTMLTextAreaElement;

  try {
    const conf = JSON.parse(textarea.value);
    const parsed = new PanelFirmware(conf).serialize({ normalizeCommands: false });

    config.value = parsed;
  } catch (e) {
    console.log('ERROR:' + e);
    // reload
    config.value = {
      ...config.value,
    };
  }
}

function normalizeCommands() {
  const parsed = new PanelFirmware(config.value).serialize({ normalizeCommands: true });
  config.value = parsed;
}

const preset = ref<string | SerializedConfig | undefined>(undefined);

function onPresetLoad() {
  try {
    let data = preset.value;
    if (!data) return;

    if (typeof data === 'string') {
      if (data.startsWith('base64:')) data = atob(data.slice(7));
      data = JSON.parse(data) as SerializedConfig;
    }

    if (data) {
      const parsed = new PanelFirmware(data).serialize({ normalizeCommands: false });

      config.value = parsed;
    }
  } catch (e) {
    console.error(e);
    // reload
    config.value = {
      ...config.value,
    };
  }
  preset.value = undefined;
}

const compact = ref(true);
const flagFirmware = ref(true);

const dts = computed(
  () => `/dts-v1/;
/plugin/;

/ {
  fragment@0 {
    target = <&panel>;

    __overlay__ {
      compatible = "${config.value.dsi.lanes > 0 ? 'panel-mipi-dsi' : 'panel-mipi-dpi-spi'}";

${flagFirmware.value ? `      firmware-name = "${config.value.filename}";` : firmware.value?.dts({ compact: compact.value, indent: 6 })}
    };
  };
};
`,
);

const dump = computed(() => firmware.value && hexdump(firmware.value.u8()));
</script>

<style scoped>
@import 'tailwindcss';

h1,
h2 {
  font-variant-caps: small-caps;

  & > * {
    font-variant-caps: normal;
  }
}

h1 {
  font-size: 3rem;
  line-height: 1;
  margin: 0 0 1rem 0;
}

h2 {
  @apply mt-6 mb-4 flex w-full justify-between gap-2 text-[2rem] leading-7;
}

button {
  @apply cursor-pointer rounded border-2 border-slate-500 bg-slate-200 px-2 text-base hover:bg-slate-300;
  @apply aria-selected:bg-indigo-300;
  @apply disabled:border-slate-300 disabled:text-slate-400;
}

textarea {
  @apply field-sizing-content w-full overflow-auto rounded-md p-2 font-mono outline outline-black focus:outline-2;
}

.content {
  max-width: 1024px;
  min-height: 100%;
  margin: 0 auto;

  display: flex;
  flex-direction: column;
}
</style>
