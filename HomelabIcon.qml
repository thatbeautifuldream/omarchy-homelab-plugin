import QtQuick
import QtQuick.Effects
import qs.Commons

Item {
  id: root

  property real iconSize: Style.font.icon
  property color color: Color.foreground

  width: iconSize
  height: iconSize
  implicitWidth: iconSize
  implicitHeight: iconSize

  Image {
    id: iconMask
    anchors.fill: parent
    source: Qt.resolvedUrl("homelab.svg")
    sourceSize.width: Math.round(root.iconSize * 3)
    sourceSize.height: Math.round(root.iconSize * 3)
    fillMode: Image.PreserveAspectFit
    smooth: true
    visible: false
    layer.enabled: true
  }

  MultiEffect {
    anchors.fill: iconMask
    source: iconMask
    colorization: 1.0
    colorizationColor: root.color
  }
}
