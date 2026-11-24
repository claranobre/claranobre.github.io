import { readFile } from 'node:fs/promises';
import { create, type Font } from 'fontkit';
import sharp from 'sharp';
import { shareImageSize, site } from '../site.config';
import { articleColors } from './article-colors';
import { splitArticleTitle } from './article-title';
import { asciiBackgroundScene } from './ascii-background';

async function loadFont(path: string) {
  const font = create(await readFile(path));
  if (!('layout' in font)) throw new Error('A single typeface is required for sharing images');
  return font;
}

async function loadAssets() {
  const [font, logo] = await Promise.all([
    loadFont('src/assets/source-sans-3-semibold.ttf'),
    readFile('public/cerejeira.svg'),
  ]);
  return { font, logo: logo.toString('base64') };
}

let assets: ReturnType<typeof loadAssets> | undefined;

function textWidth(font: Font, text: string, size: number) {
  return font.layout(text).advanceWidth / font.unitsPerEm * size;
}

function wrapText(text: string, font: Font, size: number, width: number) {
  const lines: string[] = [];
  let line = '';
  for (const word of text.trim().split(/\s+/u)) {
    const next = line ? `${line} ${word}` : word;
    if (line && textWidth(font, next, size) > width) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function ellipsize(font: Font, text: string, size: number, width: number) {
  const characters = Array.from(text);
  while (textWidth(font, characters.join('') + '…', size) > width) characters.pop();
  return characters.join('').trimEnd() + '…';
}

function drawText(font: Font, text: string, size: number, x: number, baseline: number, color: string) {
  const run = font.layout(text);
  let advance = 0;
  const paths = run.glyphs.map((glyph, index) => {
    const position = run.positions[index];
    const outline = glyph.path.toSVG();
    const path = outline && `<path transform="translate(${advance + position.xOffset} ${position.yOffset})" d="${outline}"/>`;
    advance += position.xAdvance;
    return path;
  }).join('');
  const scale = size / font.unitsPerEm;
  return `<g transform="translate(${x} ${baseline}) scale(${scale} ${-scale})" fill="${color}">${paths}</g>`;
}

function layoutTitle(title: string, font: Font) {
  const { prefix, suffix } = splitArticleTitle(title);
  const width = 575;
  const maxHeight = 275;
  const minimumSize = 36;
  const parts = [{ text: prefix, accent: false }, { text: suffix, accent: true }].filter(part => part.text);

  function wrap(size: number) {
    return parts.flatMap(({ text, accent }) => wrapText(text, font, size, width).map(text => ({ text, accent })));
  }

  for (let size = 88; size >= minimumSize; size -= 2) {
    const lines = wrap(size);
    const leading = size * 1.05;
    if (lines.length * leading <= maxHeight && lines.every(line => textWidth(font, line.text, size) <= width)) {
      return { lines, size, leading };
    }
  }

  const leading = minimumSize * 1.05;
  const lines = wrap(minimumSize);
  const limit = Math.floor(maxHeight / leading);
  const shortened = lines.slice(0, limit).map((line, index) => {
    const needsEllipsis = textWidth(font, line.text, minimumSize) > width || (index === limit - 1 && lines.length > limit);
    if (!needsEllipsis) return line;
    return { ...line, text: ellipsize(font, line.text, minimumSize, width) };
  });
  return { lines: shortened, size: minimumSize, leading };
}

function drawAscii(ascii: string, font: Font, color: string) {
  const rows = ascii.split('\n');
  const width = 590;
  const x = 530;
  const y = 165;
  const cell = width / rows[0].length;
  const rowHeight = width / 2 / rows.length;
  const symbols = new Map([...new Set(ascii.replace(/\s/g, ''))].map((glyph, index) => [glyph, `glyph-${index}`]));
  const definitions = [...symbols].map(([glyph, id]) => {
    const size = Math.min(rowHeight, cell / textWidth(font, glyph, 1));
    return `<g id="${id}">${drawText(font, glyph, size, (cell - textWidth(font, glyph, size)) / 2, rowHeight * .83, color)}</g>`;
  }).join('');
  const artwork = rows.map((row, i) => Array.from(row, (glyph, j) => {
    const id = symbols.get(glyph);
    return id ? `<use xlink:href="#${id}" x="${x + j * cell}" y="${y + i * rowHeight}"/>` : '';
  }).join('')).join('');

  return `<defs>${definitions}</defs><g opacity=".62">${artwork}</g>`;
}

function drawTags(tags: readonly string[], font: Font, ink: string) {
  const size = 24;
  const gap = 10;
  const padding = 17;
  const right = 1112;
  const maxLabelWidth = 300;
  const chipWidth = (label: string) => Math.ceil(textWidth(font, label, size)) + 2 * padding;
  let x = 88;

  const chips: string[] = [];
  function addChip(label: string) {
    const width = chipWidth(label);
    chips.push(
      `<rect x="${x}" y="505" width="${width}" height="42" rx="21" fill="none" stroke="${ink}" stroke-opacity=".42" stroke-width="1.5"/>`,
      drawText(font, label, size, x + padding, 534, ink),
    );
    x += width + gap;
  }

  for (const [index, tag] of tags.entries()) {
    const label = textWidth(font, tag, size) > maxLabelWidth ? ellipsize(font, tag, size, maxLabelWidth) : tag;
    const remaining = tags.length - index - 1;
    const reserve = remaining ? gap + chipWidth(`+${remaining}`) : 0;
    if (x + chipWidth(label) + reserve > right) {
      addChip(`+${remaining + 1}`);
      break;
    }
    addChip(label);
  }
  return chips.join('');
}

export async function renderArticleImage(title: string, tags: readonly string[]) {
  const [scene, { font, logo }] = await Promise.all([
    asciiBackgroundScene(title),
    assets ??= loadAssets(),
  ]);
  const { width, height } = shareImageSize;
  const palette = articleColors[scene.tone].light;
  const heading = layoutTitle(title, font);
  const titleBaseline = 320 - (heading.lines.length - 1) * heading.leading / 2 + heading.size * .32;
  const titlePaths = heading.lines.map((line, index) =>
    drawText(font, line.text, heading.size, 88, titleBaseline + index * heading.leading, line.accent ? palette.accent : palette.ink),
  ).join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="${width}" height="${height}" fill="#fff7f9"/>
    <rect x="30" y="30" width="${width - 60}" height="${height - 60}" rx="24" fill="${palette.surface}"/>
    <image x="82" y="73" width="48" height="48" xlink:href="data:image/svg+xml;base64,${logo}"/>
    ${drawText(font, site.title, 34, 145, 107, palette.ink)}
    ${drawAscii(scene.text, font, palette.accent)}
    ${titlePaths}
    ${drawTags(tags, font, palette.ink)}
  </svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

export async function renderHomeImage() {
  const [{ font, logo }, displayFont, blossom] = await Promise.all([
    assets ??= loadAssets(),
    loadFont('src/assets/italiana.ttf'),
    sharp('public/models/cerejeira-ascii.webp').png().toBuffer(),
  ]);
  const { width, height } = shareImageSize;
  const palette = articleColors.primary.light;
  const { prefix, suffix } = splitArticleTitle(site.title);
  const titleSize = Math.min(94, 460 / textWidth(displayFont, site.title, 1));
  const titleX = 87;
  const suffixX = titleX + textWidth(displayFont, prefix + ' ', titleSize);
  const descriptionWidth = 450;
  const descriptionHeight = 240;
  const lineHeight = 1.4;
  let descriptionSize = 30;
  let descriptionLines = wrapText(site.description, font, descriptionSize, descriptionWidth);
  while (descriptionLines.length * descriptionSize * lineHeight > descriptionHeight ||
    descriptionLines.some(line => textWidth(font, line, descriptionSize) > descriptionWidth)) {
    descriptionSize -= 1;
    descriptionLines = wrapText(site.description, font, descriptionSize, descriptionWidth);
  }
  const leading = descriptionSize * lineHeight;
  const descriptionBaseline = 398 - (descriptionLines.length - 1) * leading / 2;
  const titleBaseline = descriptionBaseline - 60;
  const description = descriptionLines
    .map((line, index) => drawText(font, line, descriptionSize, titleX, descriptionBaseline + index * leading, palette.ink))
    .join('');
  const left = 30;
  const top = 30;
  const right = width - left;
  const bottom = height - top;
  const radius = 24;
  const turn = 16;
  const curve = 26;
  const cutout = 90;
  const cutX = right - cutout;
  const cutY = bottom - cutout;
  // The lower corner follows the same inner and outer arcs as CornerCard.
  const card = [
    `M${left + radius} ${top}H${right - radius}`,
    `A${radius} ${radius} 0 0 1 ${right} ${top + radius}V${cutY - turn}`,
    `A${turn} ${turn} 0 0 1 ${right - turn} ${cutY}H${cutX + curve}`,
    `A${curve} ${curve} 0 0 0 ${cutX} ${cutY + curve}V${bottom - turn}`,
    `A${turn} ${turn} 0 0 1 ${cutX - turn} ${bottom}H${left + radius}`,
    `A${radius} ${radius} 0 0 1 ${left} ${bottom - radius}V${top + radius}`,
    `A${radius} ${radius} 0 0 1 ${left + radius} ${top}Z`,
  ].join(' ');
  const markX = right - cutout / 2;
  const markY = bottom - cutout / 2;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="${width}" height="${height}" fill="#fff7f9"/>
    <path d="${card}" fill="#fffbfc" stroke="#e4cbdc" stroke-width="1.5"/>
    <circle cx="${markX}" cy="${markY}" r="31" fill="#f8e8f0" stroke="#e4cbdc" stroke-width="1.5"/>
    <image x="${markX - 19}" y="${markY - 19}" width="38" height="38" xlink:href="data:image/svg+xml;base64,${logo}"/>
    <image x="492" y="84" width="660" height="435" xlink:href="data:image/png;base64,${blossom.toString('base64')}"/>
    ${drawText(displayFont, prefix, titleSize, titleX, titleBaseline, palette.ink)}
    ${drawText(displayFont, suffix, titleSize, suffixX, titleBaseline, palette.accent)}
    ${description}
  </svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}
