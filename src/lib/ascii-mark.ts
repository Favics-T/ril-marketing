export const ASCII_RAMP = " .:-=+*#%@";

export function sampleMark(pixels: Uint8ClampedArray): Float32Array {
  const samples = new Float32Array(pixels.length / 4);
  let low = 1, high = 0;
  for (let i = 0; i < samples.length; i++) {
    if (pixels[i * 4 + 3] < 200) continue;
    const luminance = (pixels[i * 4] * .2126 + pixels[i * 4 + 1] * .7152 + pixels[i * 4 + 2] * .0722) / 255;
    low = Math.min(low, luminance); high = Math.max(high, luminance);
  }
  for (let i = 0; i < samples.length; i++) {
    const alpha = pixels[i * 4 + 3] / 255;
    if (alpha < .16) continue;
    const luminance = (pixels[i * 4] * .2126 + pixels[i * 4 + 1] * .7152 + pixels[i * 4 + 2] * .0722) / 255;
    const tone = high > low ? Math.max(0, Math.min(1, (luminance - low) / (high - low))) : .65;
    samples[i] = (.24 + .65 * Math.sqrt(tone)) * Math.sqrt(alpha);
  }
  return samples;
}

export function fallbackMark(cols: number, rows: number): Float32Array {
  const samples = new Float32Array(cols * rows);
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const px = x / cols, py = y / rows;
    const stem = ((px > .16 && px < .29) || (px > .71 && px < .84)) && py > .1 && py < .9;
    const cap = ((px > .16 && px < .43) || (px > .57 && px < .84)) && ((py > .1 && py < .18) || (py > .82 && py < .9));
    if (stem || cap) samples[y * cols + x] = .45 + .35 * (1 - py);
  }
  return samples;
}

export function renderMark(samples: Float32Array, cols: number, rows: number, time = 0): string {
  const scan = ((time / 12000) % 1) * (cols + rows * .2 + 32) - 16;
  const lines: string[] = [];
  for (let y = 0; y < rows; y++) {
    let line = "";
    for (let x = 0; x < cols; x++) {
      const tone = samples[y * cols + x];
      if (!tone) { line += " "; continue; }
      const distance = x + y * .2 - scan;
      const highlight = .09 * Math.exp(-(distance * distance) / 98);
      line += ASCII_RAMP[Math.min(ASCII_RAMP.length - 1, Math.max(1, Math.round((tone + highlight) * (ASCII_RAMP.length - 1))))];
    }
    lines.push(line);
  }
  return lines.join("\n");
}
