PLUGIN_ID := thatbeautifuldream.homelab
PLUGIN_DIR := $(HOME)/.config/omarchy/plugins/$(PLUGIN_ID)

.PHONY: validate reload install-local sync-to link update-installed sync-from status

validate:
	omarchy plugin validate .

reload:
	omarchy-shell shell rescanPlugins

install-local sync-to:
	./scripts/sync-to-omarchy

link:
	./scripts/link-local

update-installed:
	omarchy plugin update $(PLUGIN_ID) --yes

sync-from:
	./scripts/sync-from-omarchy

status:
	omarchy-shell $(PLUGIN_ID) status
