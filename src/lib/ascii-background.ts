import { createHash } from 'node:crypto';
import sharp from 'sharp';

const glyphs = ' .:-=+*#%@';
const columns = 60;
const rows = 18;
const width = 324;
const height = 162;

// The same notched silhouette serves as a loose petal or one fifth of the flower.
const petalPath = 'M0 0C-8-3-19-11-20-24C-21-36-14-46-5-47L0-36 5-47C14-46 21-36 20-24C19-11 8-3 0 0Z';
const flowerPaths = Array.from({ length: 5 }, (_, index) =>
  `<path d="${petalPath}" transform="rotate(${index * 72}) translate(0 -5) scale(.69 .91)"/>`,
).join('') + '<circle r="3.5" stroke="none" fill-opacity="1"/>';

const compositions = [[1, 0], [0, 1], [2, 0], [1, 1], [0, 2], [2, 1], [1, 2]] as const;
const layouts = [
  { size: 58, points: [[224, 81]] },
  { size: 43, points: [[146, 91], [252, 72]] },
  { size: 32, points: [[95, 91], [172, 67], [254, 88]] },
] as const;

export async function asciiBackgroundScene(title: string) {
  const seed = createHash('sha256').update(title.trim().normalize('NFC')).digest();
  const tone = seed[0] % 2 === 0 ? 'primary' : 'secondary';
  const [flowers, petals] = compositions[seed.readUInt16BE(1) % compositions.length];
  const kinds = [
    ...Array.from({ length: flowers }, () => 'flower'),
    ...Array.from({ length: petals }, () => 'petal'),
  ];

  for (let index = kinds.length - 1; index > 0; index--) {
    const swap = seed[3 + index] % (index + 1);
    [kinds[index], kinds[swap]] = [kinds[swap], kinds[index]];
  }

  const layout = layouts[kinds.length - 1];
  const shapes = kinds.map((kind, index) => {
    const [anchorX, anchorY] = layout.points[index];
    const offset = 7 + index * 6;
    const x = anchorX + seed[offset] % 15 - 7;
    const y = anchorY + seed[offset + 1] % 9 - 4;
    const size = layout.size + seed[offset + 2] % 9;
    const rotation = kind === 'flower' ? seed[offset + 3] % 72 : seed[offset + 3] % 150 - 75;
    const fill = seed[offset + 4] % 2 === 0 ? 0 : .4 + (seed[offset + 4] % 31) / 100;
    const scale = size / (kind === 'flower' ? 48 : 29);
    const stroke = (4 + seed[offset + 5] % 3) / scale;
    const paths = kind === 'flower' ? flowerPaths : `<path d="${petalPath}" transform="translate(0 23.5)"/>`;

    return `<g transform="translate(${x} ${y}) rotate(${rotation}) scale(${scale})"
      fill-opacity="${fill}" stroke-width="${stroke}">${paths}</g>`;
  }).join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <g fill="white" stroke="white" stroke-linejoin="round">${shapes}</g>
  </svg>`;
  const { data, info } = await sharp(Buffer.from(svg))
    .resize(columns, rows, { fit: 'fill' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const text = Array.from({ length: rows }, (_, row) =>
    Array.from({ length: columns }, (_, column) => {
      const alphaIndex = (row * columns + column + 1) * info.channels - 1;
      return glyphs[Math.round(data[alphaIndex] / 255 * (glyphs.length - 1))];
    }).join('')
  ).join('\n');

  return { tone, text } as const;
}
