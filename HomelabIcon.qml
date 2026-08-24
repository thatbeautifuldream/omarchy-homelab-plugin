import QtQuick
import QtQuick.Shapes
import qs.Commons

Item {
  id: root

  property real iconSize: Style.font.icon
  property color color: Color.foreground

  width: iconSize
  height: iconSize
  implicitWidth: iconSize
  implicitHeight: iconSize

  Shape {
    anchors.centerIn: parent
    width: 24
    height: 24
    scale: root.iconSize / 24
    antialiasing: true
    preferredRendererType: Shape.CurveRenderer

    ShapePath {
      fillColor: root.color
      strokeWidth: 0
      fillRule: ShapePath.WindingFill
      PathSvg { path: "M20 20C20 20.5523 19.5523 21 19 21H5C4.44772 21 4 20.5523 4 20V11L1 11L11.3273 1.6115C11.7087 1.26475 12.2913 1.26475 12.6727 1.6115L23 11L20 11V20ZM7 11V13C9.76142 13 12 15.2386 12 18H14C14 14.134 10.866 11 7 11ZM7 15V18H10C10 16.3431 8.65685 15 7 15Z" }
    }
  }
}
