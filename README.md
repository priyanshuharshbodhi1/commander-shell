# commander

> Commander shell for a fleet of AI coding agents. One config, many agents, any repo, any tracker.

`commander` lets you declare a fleet of coding agents in a single YAML file, then commands them from one place — spawning sessions, routing reactions from your issue tracker, capturing everything to a replayable event journal. Every runtime, agent, workspace, tracker, SCM, and notifier is a plugin.

## Status

**Phase 1 — core scaffolding.** The plugin hub, config parser, data store, signal bus, and event journal are in. CLI and web are stubs. Real plugin implementations, session lifecycle, and dashboard land in later phases.

## Install

```bash
pnpm install
pnpm build
```

## Layout

```
packages/
  core/        @commander/core — plugin hub, config, data store, signals, journal
  cli/         @commander/cli  — fleet command (stub in phase 1)
  web/         @commander/web  — dashboard (stub in phase 1)
```

## Concepts

- **Fleet** — a named group of agents declared in `fleet.yaml`
- **Plugin** — a typed capability: runtime, agent, workspace, tracker, scm, notifier
- **Session** — one agent working on one task, persisted under the data root
- **Signal** — typed event published on the fleet bus
- **Journal** — append-only JSONL log of everything that happened, replayable

## License

MIT
