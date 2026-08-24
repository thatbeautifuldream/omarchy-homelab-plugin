# Omarchy Homelab Plugin

A compact Omarchy bar widget for local homelab/service discovery.

<img width="688" height="708" alt="image" src="https://github.com/user-attachments/assets/d04a1184-a53b-4aad-9593-50e41d51b41c" />

It scans listening TCP/UDP sockets with `ss`, merges Docker-published ports when Docker is available, and shows app/container endpoints first while keeping raw system ports behind a disclosure.

## Features

- Omarchy `bar-widget` plugin with a keyboard-friendly popup.
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

## Install

Omarchy's official plugin contract is a public git repository with `manifest.json` at the repository root. The installer clones the repo into `~/.config/omarchy/plugins/<id>/`; updates are fast-forward pulls of that checkout.

Review the code first. Plugins run unsandboxed inside the long-running `omarchy-shell` process.

```bash
omarchy plugin add https://github.com/thatbeautifuldream/omarchy-homelab-plugin.git --enable
```

Non-interactive install:

```bash
omarchy plugin add https://github.com/thatbeautifuldream/omarchy-homelab-plugin.git --enable --yes
```

Update:

```bash
omarchy plugin update thatbeautifuldream.homelab
```

Non-interactive update:

```bash
omarchy plugin update thatbeautifuldream.homelab --yes
```

Remove:

```bash
omarchy plugin remove thatbeautifuldream.homelab
```

## Local development

Work in the source repo, push commits, then update the installed Omarchy checkout through the same git-managed path users get.

```bash
git clone https://github.com/thatbeautifuldream/omarchy-homelab-plugin.git ~/code/self/omarchy-homelab-plugin
cd ~/code/self/omarchy-homelab-plugin
make validate
make install-local
```

`make install-local` / `make sync-to`:

1. validates this repo with `omarchy plugin validate .`;
2. requires the current branch HEAD to be pushed to `origin`;
3. backs up any existing non-git plugin folder;
4. installs or updates `~/.config/omarchy/plugins/thatbeautifuldream.homelab` as an Omarchy git-managed checkout;
5. rescans Omarchy shell plugins.

Useful commands:

```bash
make validate          # validate manifest/schema
make install-local     # install/update through Omarchy's git-managed plugin flow
make sync-to           # compatibility alias for install-local
make link              # compatibility alias; symlinks are not used
make update-installed  # run omarchy plugin update thatbeautifuldream.homelab --yes
make reload            # force plugin rescan
make status            # query live plugin status IPC
```

`make sync-from` intentionally does not copy files back. Official Omarchy installs are ordinary git checkouts; use git in the source repo instead.

## Requirements

- Omarchy with `omarchy-shell` plugin support.
- `ss` from `iproute2`.
- Optional: Docker CLI for Docker-published port detection.
- Optional: `wl-copy` for copy actions.

## Repo shape

```text
manifest.json
BarWidget.qml
Panel.qml
Model.js
HomelabIcon.qml
homelab.svg
poll-services
```

The manifest declares one `bar-widget` entry point: `BarWidget.qml`. `Panel.qml` is loaded by the bar widget, so it is not declared as a separate plugin kind.

## License

MIT
