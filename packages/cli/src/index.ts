#!/usr/bin/env node
import { PluginHub } from '@devfleet/core';

const VERSION = '0.1.0';

const HELP = `devfleet ${VERSION} — commander shell for a fleet of AI coding agents

Usage:
  fleet <command> [options]

Commands (phase 1 scaffolding — most are stubs):
  version           Print version and exit
  help              Show this message
  plugins           List registered plugins (empty in phase 1)

Coming in later phases: init, start, status, spawn, send, session, doctor.
`;

function main(argv: readonly string[]): number {
  const [, , cmd = 'help', ...rest] = argv;
  switch (cmd) {
    case 'version':
    case '--version':
    case '-v':
      process.stdout.write(`${VERSION}\n`);
      return 0;
    case 'help':
    case '--help':
    case '-h':
      process.stdout.write(HELP);
      return 0;
    case 'plugins': {
      const hub = new PluginHub();
      const cat = hub.catalog();
      const kinds = Object.keys(cat) as Array<keyof typeof cat>;
      for (const k of kinds) {
        process.stdout.write(`${k}: ${cat[k].length}\n`);
      }
      return 0;
    }
    default:
      process.stderr.write(`Unknown command: ${cmd}\n\n${HELP}`);
      void rest;
      return 1;
  }
}

process.exit(main(process.argv));
