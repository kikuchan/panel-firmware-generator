type ObjectStyleCommand =
  | {
      type: 'sleep';
      args: [number];
      line?: string;
    }
  | {
      type: 'command';
      args: [number, ...number[]];
      line?: string;
    }
  | {
      type: 'nop';
      line?: string;
    };

type CommandArgs = [number, ...number[]];
type ArrayStyleCommand = ['command', number, ...number[]] | ['sleep', number?] | ['nop'] | [];

type Uint8ArrayLike = Uint8Array | Uint8ClampedArray | number[];
export type PanelCommandsSource =
  | string
  | Uint8ArrayLike
  | (string | Uint8ArrayLike | ArrayStyleCommand | ObjectStyleCommand)[];

function hex(v: number, n: number = 2, prefix?: boolean) {
  return `${prefix ? '0x' : ''}${v.toString(16).padStart(n, '0')}`;
}

function makeCommand(item: ArrayStyleCommand, line?: string): ObjectStyleCommand {
  const type = item[0];
  const args = item.slice(1) as number[];

  switch (type) {
    case 'command':
      if (args.length < 1) throw new Error(`Invalid command or argument: ${JSON.stringify(item)}`);
      return { type, args, line } as ObjectStyleCommand;

    case 'sleep':
      const sleep = Math.ceil((args[0] || 10) / 10) * 10;
      if (sleep > 10000) throw new Error('Too long sleep duration');
      return { type, args: [sleep], line };

    case 'nop':
    case undefined:
      return { type: 'nop', line };

    default:
      throw new Error(`Invalid command or argument: ${JSON.stringify(item)}`);
  }
}

function parseRawCommands(x: Uint8ArrayLike): ObjectStyleCommand[] {
  const result: ObjectStyleCommand[] = [];
  let sleep = 0;

  for (let i = 0; i < x.length; i++) {
    const ext = x[i] & 0x80;
    const len = x[i] & 0x7f;

    if (len === 0) {
      // sleep command
      sleep += ext ? 100 : 10;
      continue;
    }

    if (sleep) {
      result.push(makeCommand(['sleep', sleep]));
      sleep = 0;
    }

    if (ext) {
      throw new Error('Invalid command sequence');
    }

    result.push(makeCommand(['command', ...(x.slice(i + 1, i + 1 + len) as CommandArgs)]));

    i += len;
  }

  if (sleep) {
    result.push(makeCommand(['sleep', sleep]));
    sleep = 0;
  }

  return result as ObjectStyleCommand[];
}

function parseCommands(items: PanelCommandsSource | undefined): ObjectStyleCommand[] {
  if (!items) return [];
  if (items instanceof Uint8Array || items instanceof Uint8ClampedArray) return parseRawCommands(items);
  if (typeof items === 'string') items = items.split('\n');
  if (items.every((x) => typeof x === 'number')) return parseRawCommands(items);

  return items.map((item) => {
    if (typeof item === 'string') {
      return parseStringCommand(item);
    } else if (typeof item === 'object' && 'type' in item) {
      return item;
    } else if (typeof item[0] === 'string') {
      return makeCommand(item);
    } else {
      return makeCommand(['command', ...(item as CommandArgs)]);
    }
  });
}

function parseStringCommand(line: string): ObjectStyleCommand {
  const args = line
    .replace(/(;|#|\/\/).*$/, '')
    .trim()
    .split(/[\s,]+/)
    .filter((x) => x);
  const cmd = args[0];

  if (args.length === 0) return makeCommand(['nop'], line);

  if (cmd === 'sleep') {
    const arg = args.slice(1).join(' ');
    if (!arg) return makeCommand(['sleep'], line);
    const ms = arg.match(/^(\d+)\s*(ms)?$/);
    if (ms) return makeCommand(['sleep', Number(ms[1])], line);
    const s = arg.match(/^(\d+)\s*s$/);
    if (s) return makeCommand(['sleep', Number(s[1]) * 1000], line);
    throw new Error('Invalid argument: ' + arg);
  }

  if (cmd === 'command') {
    args.shift();
  }

  const cmds = args.filter((x) => x !== 'arguments').map((x) => x.match(/^(0x)?[0-9a-fA-F]{1,3}$/) && parseInt(x, 0));
  if (cmds.some((x) => x === null || isNaN(x)) || cmds.length < 1) {
    throw new Error('Invalid command or parameters: ' + line);
  }
  return makeCommand(['command', ...(cmds as CommandArgs)], line);
}

function packSleepCommand(ms: number) {
  let n = Math.ceil(ms / 10);
  const cmds = [];

  if (n > 1000) throw new Error('Too long sleep duration');

  while (n >= 10) {
    cmds.push(0x80);
    n -= 10;
  }
  while (n > 0) {
    cmds.push(0);
    n -= 1;
  }

  return cmds;
}

function packCommands(cmds: ObjectStyleCommand[]) {
  return cmds.flatMap((cmd) => {
    switch (cmd.type) {
      case 'command':
        const args = cmd.args;
        if (args.length >= 128) {
          throw new Error('Commands too long');
        }
        return [args.length, ...args];

      case 'sleep':
        return packSleepCommand(cmd.args[0] || 10);

      case 'nop':
      case undefined:
        return [];

      default:
        throw new Error('Unknown command: ' + (cmd as unknown[])[0]);
    }
  });
}

type Options = {
  normalize?: boolean;
  format?: 'text' | 'text-normalized' | 'dts' | 'dts-compact';
};

function serializeCommandsText(cmd: ObjectStyleCommand, comment: string | undefined, normalized: boolean) {
  if (!normalized && cmd.line) return cmd.line;

  comment = comment ? ' ; ' + comment : '';

  switch (cmd.type) {
    case 'command':
      return `command ${cmd.args.map((x) => hex(x, 2, true)).join(' ')}${comment}`;
    case 'sleep':
      return `sleep ${cmd.args[0]}ms${comment}`;
    case 'nop':
      return `${comment}`.trim();
  }
}

function serializeCommandsDts(cmd: ObjectStyleCommand, comment: string | undefined) {
  comment = comment ? ' // ' + comment : '';

  switch (cmd.type) {
    case 'command':
      return `${hex(cmd.args.length, 2)} ${cmd.args.map((x) => hex(x, 2)).join(' ')}${comment}`;

    case 'sleep':
      const sleep = Math.ceil(cmd.args[0] / 10);
      const sleepS = Math.floor(sleep / 10);
      const sleepMS = sleep % 10;

      return (`80 `.repeat(sleepS) + `00 `.repeat(sleepMS)).trim();

    case 'nop':
      return `${comment}`.trim();
  }
}

function serializeCommands(cmds: ObjectStyleCommand[], opts: Options = {}) {
  if (opts.format === 'dts-compact') {
    const packed = packCommands(cmds);

    const result = [];
    for (let i = 0; i < packed.length; i += 16) {
      const line = packed.slice(i, i + 16);
      result.push(line.map((x) => hex(x)).join(' '));
    }
    return result;
  }

  return cmds?.map((cmd) => {
    const comment = cmd.line?.match(/(;|#|\/\/)(.*)$/)?.[2].trim();

    switch (opts.format) {
      default:
      case 'text':
      case 'text-normalized':
        return serializeCommandsText(cmd, comment, opts.normalize ?? opts.format === 'text-normalized');
      case 'dts':
        return serializeCommandsDts(cmd, comment);
    }
  });
}

export class PanelCommands {
  #compiled: ObjectStyleCommand[];
  #options: Options;

  constructor(src: PanelCommandsSource, opts: Options = {}) {
    this.#compiled = parseCommands(src);
    this.#options = opts;
  }

  array() {
    return packCommands(this.#compiled);
  }

  u8() {
    return new Uint8ClampedArray(this.array());
  }

  blob() {
    return new Blob([this.u8()]);
  }

  serialize(opts: Options = {}) {
    return serializeCommands(this.#compiled, { ...this.#options, ...opts });
  }

  toJSON() {
    return this.serialize();
  }

  toString() {
    return this.serialize().join('\n');
  }
}
