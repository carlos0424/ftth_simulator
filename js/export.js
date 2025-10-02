// export.js
// Exportar el contenido del <svg> como archivo SVG o PNG.

import { download } from './utils.js';

/**
 * Exporta el diagrama a un archivo SVG.
 * @param {SVGElement} svgEl - Elemento <svg>.
 * @param {string} fileName - Nombre del archivo exportado.
 */
export function exportSVG(svgEl, fileName = 'ftth-diagrama.svg') {
  let svgString = new XMLSerializer().serializeToString(svgEl);

  // Asegurar namespace
  if (!svgString.includes('xmlns="http://www.w3.org/2000/svg"')) {
    svgString = svgString.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  }

  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  download(url, fileName);

  // Liberar memoria
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Exporta el diagrama a un archivo PNG.
 * @param {SVGElement} svgEl - Elemento <svg>.
 * @param {string} fileName - Nombre del archivo exportado.
 */
export function exportPNG(svgEl, fileName = 'ftth-diagrama.png') {
  let svgString = new XMLSerializer().serializeToString(svgEl);

  // Asegurar namespace
  if (!svgString.includes('xmlns="http://www.w3.org/2000/svg"')) {
    svgString = svgString.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const img = new Image();

  img.onload = function () {
    // Usar tamaño del svg, con fallback
    canvas.width = svgEl.width?.baseVal?.value || 1200;
    canvas.height = svgEl.height?.baseVal?.value || 800;

    // Fondo blanco para evitar transparencia
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.drawImage(img, 0, 0);

    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      download(url, fileName);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, 'image/png');
  };

  img.onerror = () => alert('❌ Error al exportar PNG. Intente con SVG.');

  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  img.src = URL.createObjectURL(svgBlob);
}
