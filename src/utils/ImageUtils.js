export function removeWhiteBackground(img) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  canvas.width = img.width;
  canvas.height = img.height;
  
  ctx.drawImage(img, 0, 0);
  
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  
  // Iterate through pixels (r, g, b, a)
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    
    // If pixel is white or near-white, set alpha to 0
    if (r > 220 && g > 220 && b > 220) {
      data[i + 3] = 0;
    }
  }
  
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * Crops a canvas to its actual visible content by trimming fully transparent borders.
 * This ensures hitboxes match what the player actually sees.
 */
export function cropToContent(sourceCanvas) {
  const ctx = sourceCanvas.getContext('2d');
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  const data = ctx.getImageData(0, 0, w, h).data;

  let minX = w, minY = h, maxX = 0, maxY = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const alpha = data[(y * w + x) * 4 + 3];
      if (alpha > 10) { // non-transparent pixel
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  // Nothing visible
  if (maxX < minX || maxY < minY) return sourceCanvas;

  const croppedW = maxX - minX + 1;
  const croppedH = maxY - minY + 1;

  const cropped = document.createElement('canvas');
  cropped.width = croppedW;
  cropped.height = croppedH;
  cropped.getContext('2d').drawImage(sourceCanvas, minX, minY, croppedW, croppedH, 0, 0, croppedW, croppedH);
  return cropped;
}
