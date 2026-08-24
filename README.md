# Omarchy Homelab Plugin

A compact Omarchy bar widget for local homelab/service discovery.

It scans listening TCP/UDP sockets with `ss`, merges Docker-published ports when Docker is available, and shows app/container endpoints first while keeping raw system ports behind a disclosure.

## Features

- Omarchy bar widget with a keyboard-friendly popup.
- App/container endpoints shown before raw system sockets.
- Docker-published ports merged with matching `ss` rows.
- System ports collapsed by default.
- Stable refresh layout with no stat-card jump.
- Click/keyboard actions:
  - `R`: refresh.
  - `S`: show or hide system ports.
  - `Enter`: open launchable endpoint, copy otherwise.
  - `C`: copy selected endpoint.
  - Left click: open/copy row.
  - Right click: copy row.

## Public install

After reviewing the code, install through Omarchy's git-backed plugin installer:

```bash
omarchy plugin add https://github.com/thatbeautifuldream/omarchy-homelab-plugin.git --enable
```

Non-interactive install:

```bash
omarchy plugin add https://github.com/thatbeautifuldream/omarchy-homelab-plugin.git --enable --yes
```

Update later:

```bash
omarchy plugin update thatbeautifuldream.homelab
```

Remove:

```bash
omarchy plugin remove thatbeautifuldream.homelab
```

Plugins run unsandboxed inside `omarchy-shell`. Only install plugins whose source you have reviewed and trust.

## Local development

Clone the repo, edit there, then sync it into Omarchy's user plugin directory:

```bash
git clone https://github.com/thatbeautifuldream/omarchy-homelab-plugin.git ~/code/self/omarchy-homelab-plugin
cd ~/code/self/omarchy-homelab-plugin
make sync-to
```

Omarchy rejects symlinked plugin folders during validation, so local development uses `rsync` instead of a symlink. After editing files in the repo, run:

```bash
make sync-to
```

The sync copies this repo to:

```text
~/.config/omarchy/plugins/thatbeautifuldream.homelab
```

Useful commands:

```bash
make validate        # validate manifest/schema
make reload          # force plugin rescan
make sync-to         # copy repo files into Omarchy
make sync-from       # copy currently installed plugin files back into this repo
make link            # compatibility alias for sync-to; symlinks are not used
```

## Requirements

- Omarchy with `omarchy-shell` plugin support.
- `ss` from `iproute2`.
- Optional: Docker CLI for Docker-published port detection.
- Optional: `wl-copy` for copy actions.

## Repo shape

Omarchy expects third-party plugins to be git repos with `manifest.json` at the repository root. This repo follows that contract directly; no build step is required.

## License

MIT
