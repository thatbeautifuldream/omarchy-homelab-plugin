PLUGIN_ID := thatbeautifuldream.homelab
PLUGIN_DIR := $(HOME)/.config/omarchy/plugins/$(PLUGIN_ID)
OMARCHY_PATH ?= /usr/share/omarchy
QMLLINT ?= $(shell command -v qmllint 2>/dev/null || printf /usr/lib/qt6/bin/qmllint)


.PHONY: validate lint test-model reload install-local sync-to link update-installed sync-from status

validate:
	omarchy plugin validate .

lint:
	@test -x "$(QMLLINT)" || { echo "qmllint not found; install qt6-declarative"; exit 1; }
	@tmp="$$(mktemp -d)"; \
	trap 'rm -rf "$$tmp"' EXIT; \
	mkdir -p "$$tmp/qs"; \
	ln -s "$(OMARCHY_PATH)/shell/Ui" "$$tmp/qs/Ui"; \
	ln -s "$(OMARCHY_PATH)/shell/Commons" "$$tmp/qs/Commons"; \
	"$(QMLLINT)" -I "$$tmp" --missing-property disable --signal-handler-parameters disable --unqualified disable --unused-imports disable BarWidget.qml Panel.qml HomelabIcon.qml

test-model:
	@command -v node >/dev/null 2>&1 || { echo "node not found"; exit 1; }
	@node tests/model.test.js

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
