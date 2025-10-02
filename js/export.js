// export.js
// Exportar el contenido del <svg> a SVG o PNG.

import { download } from './utils.js';

export function exportSVG(svgEl, fileName = 'ftth-diagrama.svg') {
  let svgString = new XMLSerializer().serializeToString(svgEl);
  if (!svgString.includes('xmlns="http://www.w3.org/2000/svg"')) {
    svgString = svgString.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  download(url, fileName);
}

export function exportPNG(svgEl, fileName = 'ftth-diagrama.png') {
  let svgString = new XMLSerializer().serializeToString(svgEl);
  if (!svgString.includes('xmlns="http://www.w3.org/2000/svg"')) {
    svgString = svgString.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const img = new Image();

  img.onload = function () {
    canvas.width = svgEl.width.baseVal.value;
    canvas.height = svgEl.height.baseVal.value;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      download(url, fileName);
    }, 'image/png');
  };
  img.onerror = () => alert('Error al exportar PNG. Intente con SVG.');

  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  img.src = URL.createObjectURL(svgBlob);
}
