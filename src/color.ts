export type Color = string & {__brand: 'Color'};
// TODO: Replace these colors with proper color system (like in .css file)
export const Color = {
  WHITE: '#ffffff' as Color,
  WHITE_NAVAJO: '#FFE7A5' as Color,
  BLACK: '#000000' as Color,
  BLACK_ONYX: '#121212' as Color,
  BLACK_IERIE: '#202020' as Color,
  BLACK_RAISIN: '#242424' as Color,
  GRAY_GRANITE: oklch(0.57, 0, 0) as Color,
  RED: '#ff0000' as Color,
  PINK: '#ff4081' as Color,
  GOLDEN: '#ecc358' as Color,
  ORANGE_SAFFRON: '#ff9a39' as Color,
  ORANGE_GAMBOGE: '#8c7100' as Color,
  ORANGE_PHILIPPINE: '#ff6f00' as Color,
  GREEN: '#00ff00' as Color,
  GREEN_DARK: '#005400' as Color,
  GREEN_DARKEST: '#003400' as Color,
  GREEN_DEEP: '#00730a' as Color,
  GREEN_NT: '#00a71c' as Color,
};

function oklch(lightness: number, chroma: number, hue: number, alpha = 1) {
  assert(lightness >= 0 && lightness <= 1);
  assert(chroma >= 0 && chroma <= 1);
  assert(hue >= 0 && hue <= 360);
  assert(alpha >= 0 && alpha <= 1);

  // OKLCH -> OKLab
  const hr = hue * (Math.PI / 180);
  const A = Math.cos(hr) * chroma;
  const B = Math.sin(hr) * chroma;

  // OKLab -> LMS (cube roots)
  let l = lightness + 0.3963377774 * A + 0.2158037573 * B;
  let m = lightness - 0.1055613458 * A - 0.0638541728 * B;
  let s = lightness - 0.0894841775 * A - 1.291485548 * B;
  l = l * l * l;
  m = m * m * m;
  s = s * s * s;

  // LMS -> linear sRGB
  const rLinear = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const gLinear = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bLinear = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

  const r = linearRGBTo8Bit(rLinear);
  const g = linearRGBTo8Bit(gLinear);
  const b = linearRGBTo8Bit(bLinear);

  const a = Math.round(alpha * 255);
  return getHexString(r, g, b, a);
}

function linearRGBTo8Bit(x: number) {
  if (x <= 0) return 0;
  // sRGB EOTF
  const srgb = x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
  return srgb >= 1 ? 255 : (srgb * 255 + 0.5) | 0;
}

function getHexString(r: number, g: number, b: number, a = 1) {
  const hex: string = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}${a.toString(16).padStart(2, '0')}`;
  return hex;
}
