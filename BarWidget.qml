import QtQuick
import Quickshell
import Quickshell.Io
import qs.Commons
import qs.Ui
import "Model.js" as Model

BarWidget {
  id: root
  moduleName: "thatbeautifuldream.homelab"

  property var services: []
  property bool loading: false
  property string errorText: ""
  property string updatedAt: ""
  readonly property int serviceCount: services.length
  readonly property int refreshSeconds: Math.max(2, Number(setting("refreshSeconds", 10)) || 10)

  function refresh() {
    if (portsProc.running) return
    loading = true
    errorText = ""
    portsProc.running = true
  }

  function applyPorts(text) {
    services = Model.parsePorts(text)
    updatedAt = Qt.formatTime(new Date(), "HH:mm:ss")
    loading = false
    injectPanel()
  }

  function injectPanel() {
    var target = panelLoader.item
    if (!target) return
    if ("bar" in target) target.bar = root.bar
    if ("settings" in target) target.settings = root.settings
    if ("anchorItem" in target) target.anchorItem = button
    if ("hostWidget" in target) target.hostWidget = root
    if ("services" in target) target.services = root.services
    if ("loading" in target) target.loading = root.loading
    if ("errorText" in target) target.errorText = root.errorText
    if ("updatedAt" in target) target.updatedAt = root.updatedAt
  }

  function togglePanel() {
    if (panelLoader.item && panelLoader.item.toggle) panelLoader.item.toggle()
  }

  readonly property bool opened: panelLoader.item ? panelLoader.item.opened === true : false
  readonly property bool popoutSwitchClosing: panelLoader.item ? panelLoader.item.popoutSwitchClosing === true : false

  function open() {
    if (panelLoader.item && panelLoader.item.open) panelLoader.item.open()
  }

  function close() {
    if (panelLoader.item && panelLoader.item.close) panelLoader.item.close()
  }

  function closeForPopoutSwitch() {
    if (panelLoader.item) panelLoader.item.closeForPopoutSwitch()
  }

  implicitWidth: button.implicitWidth
  implicitHeight: button.implicitHeight

  onBarChanged: injectPanel()
  onSettingsChanged: injectPanel()
  onServicesChanged: injectPanel()
  onLoadingChanged: injectPanel()
  onErrorTextChanged: injectPanel()
  onUpdatedAtChanged: injectPanel()

  Loader {
    id: panelLoader
    active: true
    source: Qt.resolvedUrl("Panel.qml")
    visible: false
    onLoaded: {
      root.injectPanel()
      Qt.callLater(root.injectPanel)
    }
  }

  Process {
    id: portsProc
    running: false
    command: [Quickshell.env("HOME") + "/.config/omarchy/plugins/thatbeautifuldream.homelab/poll-services"]

    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: root.applyPorts(text)
    }

    stderr: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        var message = String(text || "").trim()
        if (message !== "") root.errorText = message
      }
    }

    onExited: function(exitCode) {
      root.loading = false
      if (exitCode !== 0 && root.errorText === "") root.errorText = "ss exited with " + exitCode
      root.injectPanel()
    }
  }

  Timer {
    interval: root.refreshSeconds * 1000
    running: true
    repeat: true
    triggeredOnStart: true
    onTriggered: root.refresh()
  }

  IpcHandler {
    target: root.moduleName

    function refresh(): string { root.refresh(); return "ok" }
    function open(): string { root.open(); return "ok" }
    function close(): string { root.close(); return "ok" }
    function show(): string { root.open(); return "ok" }
    function hide(): string { root.close(); return "ok" }
    function toggle(): string { root.togglePanel(); return "ok" }
    function status(): string {
      var panel = panelLoader.item
      var shown = []
      if (panel && panel.primaryServices) {
        for (var i = 0; i < panel.primaryServices.length; i++) {
          var service = panel.primaryServices[i]
          shown.push({
            title: panel.serviceTitle(service),
            endpoint: panel.endpointText(service),
            process: String(service.process || ""),
            scope: String(service.scope || "")
          })
        }
      }

      return JSON.stringify({
        count: root.serviceCount,
        shownCount: panel && panel.primaryServices ? panel.primaryServices.length : null,
        hiddenCount: panel && panel.systemServices ? panel.systemServices.length : null,
        shown: shown,
        loading: root.loading,
        error: root.errorText,
        updatedAt: root.updatedAt
      })
    }
  }

  BarIconButton {
    id: button
    anchors.fill: parent
    bar: root.bar
    tooltipText: "Homelab"
    iconComponent: Component {
      Item {
        HomelabIcon {
          anchors.centerIn: parent
          iconSize: Style.space(15)
          color: button.foreground
        }
      }
    }

    onPressed: function(b) {
      if (b === Qt.MiddleButton || b === Qt.RightButton) root.refresh()
      else root.togglePanel()
    }
  }
}
