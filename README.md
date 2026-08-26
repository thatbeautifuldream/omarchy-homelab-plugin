# Omarchy Homelab Plugin

A compact Omarchy bar widget for local homelab/service discovery.

<img width="2560" height="1600" alt="image" src="https://github.com/user-attachments/assets/172c30b8-0c54-4518-8644-68768face7a1" />


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

Omarchy's official plugin contract is a public git repository with `manifest.json` at the repository root. The installer clones the repo into `~/.config/omarchy/plugins/<id>/`; updates are fast-forward pulls of that checkout. See the [publishing guide](https://omarchyplugins.com/publish.html) for the marketplace requirements.

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

## Publish to the marketplace

Before submitting, validate the exact commit you intend to publish and push it
to the public GitHub repository:

```bash
make validate
make lint
git add .
git commit -m "Prepare marketplace release"
git push origin HEAD
```

Then open the [marketplace submission form](https://github.com/HANCORE-linux/omarchy-plugin-marketplace/issues/new?template=submit-plugin.yml)
and submit:

- **Repository URL:** `https://github.com/thatbeautifuldream/omarchy-homelab-plugin`
- **Category:** `System`
- **Tags:** `Bar`, `Quickshell`, `System`
- **Maintainer notes:** `ss` from `iproute2` is required; Docker CLI and
  `wl-copy` are optional. The plugin runs `ss`, optional `docker ps`, `xdg-open`,
  and `wl-copy` with the current user's permissions and does not modify user
  configuration.

The submission checklist requires a public repository with install and removal
instructions, a documented license and dependencies, permission to submit the
code and preview assets, no implicit user-configuration overwrites, and
acknowledgement that marketplace approval is not a security review.

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
make lint              # run qmllint with Omarchy import paths
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

## Safety and permissions

The plugin has no install or startup hook beyond the commands declared in
`manifest.json`. At runtime it:

- reads listening sockets with `ss`;
- optionally reads Docker-published ports with `docker ps`;
- invokes `xdg-open` only for classified TCP endpoints; and
- invokes `wl-copy` only when copying an endpoint.

These commands run with the current user's permissions inside the
unsandboxed `omarchy-shell` process. The plugin does not write user
configuration or persistent state.

Removing the plugin deletes its Omarchy-managed checkout. It does not alter
the services or containers it discovers. Use the removal command above.

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
