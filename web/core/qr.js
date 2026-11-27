// QR code as inline SVG (uses vendor/qrcode.js, loaded as a classic script → window.qrcode).
export function qrSvg(text, cell = 8) {
  const q = window.qrcode(0, 'M'); q.addData(text); q.make();
  return q.createSvgTag({ cellSize: cell, margin: 2, scalable: true });
}
