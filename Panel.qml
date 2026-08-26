import QtQuick
import qs.Commons
import qs.Ui
import "Model.js" as Model

Panel {
  id: root
  moduleName: "thatbeautifuldream.homelab"
  ipcTarget: "thatbeautifuldream.homelab"
  manageIpc: false

  property var anchorItem: null
  property var hostWidget: null
  property var services: []
  property bool loading: false
  property string errorText: ""
  property bool showSystemPorts: false
  property int selectedIndex: 0
  property bool cursorActive: false

  readonly property var serviceModel: hostWidget && ("services" in hostWidget) ? hostWidget.services : services
  readonly property bool effectiveLoading: hostWidget && ("loading" in hostWidget) ? hostWidget.loading === true : loading
  readonly property string effectiveErrorText: hostWidget && ("errorText" in hostWidget) ? String(hostWidget.errorText || "") : errorText
  readonly property int serviceCount: serviceModel ? serviceModel.length : 0
  readonly property var classifiedServices: Model.partitionServices(serviceModel)
  readonly property var primaryServices: classifiedServices.primary
  readonly property var systemServices: classifiedServices.system
  readonly property int visibleActionCount: primaryServices.length + (showSystemPorts ? systemServices.length : 0)
  readonly property var barIdentity: hostWidget || root
  readonly property color contentForeground: bar ? bar.foreground : Color.foreground
  readonly property string contentFontFamily: bar ? bar.fontFamily : Style.font.family

  onOpenedChanged: if (opened) {
    cursorActive = false
    selectedIndex = 0
    if (scroll) scroll.contentY = 0
  }

  onServiceCountChanged: clampSelectedIndex()
  onShowSystemPortsChanged: clampSelectedIndex()

  function clampSelectedIndex() {
    if (visibleActionCount <= 0) selectedIndex = 0
    else if (selectedIndex >= visibleActionCount) selectedIndex = visibleActionCount - 1
    else if (selectedIndex < 0) selectedIndex = 0
  }


  function shellQuote(value) {
    return "'" + String(value || "").replace(/'/g, "'\\''") + "'"
  }

  function runCommand(command) {
    if (root.bar && typeof root.bar.run === "function") root.bar.run(command)
  }

  function openService(service) {
    if (!Model.launchable(service, root.serviceModel)) return false
    runCommand("xdg-open " + shellQuote(Model.likelyUrl(service)))
    root.close()
    return true
  }

  function copyService(service) {
    var text = Model.launchable(service, root.serviceModel) ? Model.likelyUrl(service) : Model.endpointText(service)
    if (text === "") return false
    runCommand("printf %s " + shellQuote(text) + " | wl-copy")
    return true
  }

  function activateService(service) {
    if (!service) return
    if (!openService(service)) copyService(service)
  }

  function visibleRow(index) {
    if (index < primaryServices.length) return primaryServices[index]
    if (!showSystemPorts) return null
    return systemServices[index - primaryServices.length]
  }

  function activateSelected() {
    if (visibleActionCount <= 0) {
      refresh()
      return
    }
    cursorActive = true
    activateService(visibleRow(selectedIndex))
  }

  function moveCursor(delta) {
    if (visibleActionCount <= 0) return
    cursorActive = true
    selectedIndex = (selectedIndex + delta + visibleActionCount) % visibleActionCount
  }

  function toggleSystemPorts() {
    showSystemPorts = !showSystemPorts
  }

  function open() {
    if (hostWidget && hostWidget.refresh) hostWidget.refresh()
    root.controller.show()
  }

  function close() {
    root.controller.hide()
  }

  function toggle() {
    if (root.opened) root.close()
    else root.open()
  }

  function switchPanel(direction) {
    if (root.bar && typeof root.bar.switchPanelFrom === "function")
      return root.bar.switchPanelFrom(root.barIdentity, direction)
    return false
  }

  function refresh() {
    if (hostWidget && hostWidget.refresh) hostWidget.refresh()
  }

  KeyboardPanel {
    id: panel
    anchorItem: root.anchorItem
    owner: root.barIdentity
    bar: root.bar
    open: root.opened
    focusTarget: keyCatcher
    contentWidth: panel.fittedContentWidth(Style.space(440))
    contentHeight: panel.fittedContentHeight(contentColumn.implicitHeight, Style.space(680))

    PanelKeyCatcher {
      id: keyCatcher
      anchors.fill: parent
      onCloseRequested: root.close()
      onMoveRequested: function(dx, dy) { if (dy !== 0) root.moveCursor(dy) }
      onActivateRequested: root.activateSelected()
      onTabRequested: function(direction) { root.switchPanel(direction) }
      onTextKey: function(t) {
        if (t === "r" || t === "R") root.refresh()
        else if (t === "s" || t === "S") root.toggleSystemPorts()
        else if (t === "c" || t === "C") root.copyService(root.visibleRow(root.selectedIndex))
      }

      Flickable {
        id: scroll
        anchors.fill: parent
        contentWidth: contentColumn.width
        contentHeight: contentColumn.implicitHeight
        clip: true
        boundsBehavior: Flickable.StopAtBounds
        interactive: contentHeight > height

        Column {
          id: contentColumn
          width: scroll.width
          spacing: Style.space(6)

          Text {
            visible: root.effectiveErrorText !== ""
            width: parent.width
            text: root.effectiveErrorText
            color: Color.urgent
            font.family: root.contentFontFamily
            font.pixelSize: Style.font.caption
            wrapMode: Text.WordWrap
          }

          Text {
            visible: !root.effectiveLoading && root.primaryServices.length === 0 && root.effectiveErrorText === ""
            width: parent.width
            text: root.serviceCount === 0 ? "No ports." : "No apps."
            color: Util.alpha(root.contentForeground, 0.68)
            font.family: root.contentFontFamily
            font.pixelSize: Style.font.body
            wrapMode: Text.WordWrap
          }

          Column {
            visible: root.primaryServices.length > 0
            width: parent.width
            spacing: Style.space(6)

            Repeater {
              model: root.primaryServices

              delegate: ServiceRow {
                required property int index
                required property var modelData

                width: parent.width
                service: modelData
                rowIndex: index
                selected: root.cursorActive && root.selectedIndex === rowIndex
                systemRow: false
                onActivate: root.activateService(service)
                onCopy: root.copyService(service)
                onHover: function() {
                  root.cursorActive = true
                  root.selectedIndex = rowIndex
                }
              }
            }
          }

          Button {
            visible: root.systemServices.length > 0
            width: parent.width
            text: (root.showSystemPorts ? "Hide" : "System") + " (" + root.systemServices.length + ")"
            iconText: "›"
            iconRotation: root.showSystemPorts ? 90 : 0
            active: root.showSystemPorts
            leftAlign: true
            bordered: false
            background: Util.alpha(root.contentForeground, 0.04)
            foreground: root.showSystemPorts ? Color.accent : root.contentForeground
            fontFamily: root.contentFontFamily
            fontSize: Style.font.caption
            horizontalPadding: Style.space(6)
            verticalPadding: Style.space(3)
            onClicked: root.toggleSystemPorts()
          }

          Column {
            visible: root.showSystemPorts && root.systemServices.length > 0
            width: parent.width
            spacing: Style.space(4)

            Repeater {
              model: root.systemServices

              delegate: ServiceRow {
                required property int index
                required property var modelData

                width: parent.width
                service: modelData
                rowIndex: root.primaryServices.length + index
                selected: root.cursorActive && root.selectedIndex === rowIndex
                systemRow: true
                onActivate: root.copyService(service)
                onCopy: root.copyService(service)
                onHover: function() {
                  root.cursorActive = true
                  root.selectedIndex = rowIndex
                }
              }
            }
          }

        }
      }
    }
  }


  component ServiceRow: BorderSurface {
    id: rowRoot

    property var service: ({})
    property int rowIndex: 0
    property bool selected: false
    property bool systemRow: false
    signal activate()
    signal copy()
    signal hover()

    readonly property bool canOpen: Model.launchable(service, root.serviceModel)
    readonly property bool publicEndpoint: String(service && service.scope || "") === "all interfaces"
    readonly property color rowAccent: canOpen ? Color.accent : root.contentForeground

    implicitHeight: rowContent.implicitHeight + Style.space(systemRow ? 12 : 16)
    height: implicitHeight
    radius: Style.cornerRadius
    color: selected
      ? Util.alpha(rowAccent, 0.18)
      : (rowMouse.containsMouse ? Util.alpha(rowAccent, 0.08) : Util.alpha(root.contentForeground, systemRow ? 0.018 : 0.045))
    borderSpec: Border.flat(Util.alpha(selected ? rowAccent : root.contentForeground, selected ? 0.38 : (systemRow ? 0.08 : 0.14)), 1)
    padding: Style.space(systemRow ? 6 : 8)

    onSelectedChanged: if (selected) Qt.callLater(revealInScroll)

    function revealInScroll() {
      if (!scroll || !contentColumn || scroll.height <= 0) return

      var top = rowRoot.mapToItem(contentColumn, 0, 0).y
      var bottom = top + rowRoot.height
      var viewTop = scroll.contentY
      var viewBottom = scroll.contentY + scroll.height
      var maxY = Math.max(0, scroll.contentHeight - scroll.height)

      if (top < viewTop) scroll.contentY = Math.max(0, top - Style.space(6))
      else if (bottom > viewBottom) scroll.contentY = Math.min(maxY, bottom - scroll.height + Style.space(6))
    }

    Row {
      id: rowContent
      anchors.left: parent.left
      anchors.right: parent.right
      anchors.verticalCenter: parent.verticalCenter
      anchors.leftMargin: parent.contentLeftInset
      anchors.rightMargin: parent.contentRightInset
      spacing: Style.space(8)

      BorderSurface {
        id: portChip
        width: Style.space(rowRoot.systemRow ? 64 : 72)
        height: Style.space(25)
        radius: Math.max(2, Style.cornerRadius - Style.space(4))
        color: rowRoot.publicEndpoint
          ? Util.alpha(Color.accent, 0.18)
          : Util.alpha(root.contentForeground, 0.07)
        borderSpec: Border.flat(Util.alpha(rowRoot.publicEndpoint ? Color.accent : root.contentForeground, 0.18), 1)

        Text {
          anchors.centerIn: parent
          text: String(rowRoot.service.proto || "") + " " + String(rowRoot.service.port || "")
          color: rowRoot.publicEndpoint ? Color.accent : root.contentForeground
          font.family: root.contentFontFamily
          font.pixelSize: Style.font.caption
          font.weight: Font.DemiBold
        }
      }

      Text {
        width: Math.max(1, rowContent.width - portChip.width - actionPill.width - Style.space(16))
        anchors.verticalCenter: parent.verticalCenter
        text: rowRoot.systemRow
          ? Model.serviceSubtitle(rowRoot.service)
          : Model.serviceTitle(rowRoot.service) + " · " + Model.serviceSubtitle(rowRoot.service)
        color: root.contentForeground
        font.family: root.contentFontFamily
        font.pixelSize: Style.font.body
        font.weight: rowRoot.systemRow ? Font.Normal : Font.DemiBold
        elide: Text.ElideRight
      }

      BorderSurface {
        id: actionPill
        width: Style.space(rowRoot.canOpen ? 45 : 44)
        height: Style.space(24)
        radius: Math.max(2, Style.cornerRadius - Style.space(4))
        color: Util.alpha(rowRoot.canOpen ? Color.accent : root.contentForeground, rowRoot.canOpen ? 0.14 : 0.06)
        borderSpec: Border.flat(Util.alpha(rowRoot.canOpen ? Color.accent : root.contentForeground, rowRoot.canOpen ? 0.20 : 0.12), 1)

        Text {
          anchors.centerIn: parent
          text: rowRoot.canOpen ? "Open" : "Copy"
          color: rowRoot.canOpen ? Color.accent : Util.alpha(root.contentForeground, 0.74)
          font.family: root.contentFontFamily
          font.pixelSize: Style.font.caption
          font.weight: Font.Medium
        }
      }
    }

    MouseArea {
      id: rowMouse
      anchors.fill: parent
      hoverEnabled: true
      cursorShape: Qt.PointingHandCursor
      acceptedButtons: Qt.LeftButton | Qt.RightButton
      onEntered: rowRoot.hover()
      onPositionChanged: rowRoot.hover()
      onClicked: function(mouse) {
        rowRoot.hover()
        if (mouse.button === Qt.RightButton) rowRoot.copy()
        else rowRoot.activate()
      }
    }
  }
}
