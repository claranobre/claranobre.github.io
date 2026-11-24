export const cycleDurationMs = 27_000;

// As 11 poses da volta têm a mesma posição e escala.
const rotationsZ = [-175, 175, 142, 109, 59, 23, -19, -83, -118, -167, 170];
const xRotationMin = -129;
const xRotationMax = -43;

export const restPose = {
  x: -.25,
  y: .02,
  scale: 1.03,
  rotationX: 0,
  rotationY: 1,
  rotationZ: 0,
};

export function rotationReturnWeight(seconds: number) {
  const time = 4.5 * seconds;
  return (1 + time) * Math.exp(-time);
}

export function wrapDegrees(angle: number) {
  return ((angle + 180) % 360 + 360) % 360 - 180;
}

function tangent(first: number, second: number) {
  return first * second > 0 ? 2 * first * second / (first + second) : 0;
}

export function sampleSequence(elapsedMs: number) {
  const phase = (elapsedMs / cycleDurationMs) % 1;
  const count = rotationsZ.length;
  const position = phase * count;
  const index = Math.floor(position);
  const t = position - index;
  const before = rotationsZ[(index + count - 1) % count];
  const from = rotationsZ[index];
  const to = rotationsZ[(index + 1) % count];
  const after = rotationsZ[(index + 2) % count];
  const delta = wrapDegrees(to - from);
  const start = tangent(wrapDegrees(from - before), delta);
  const end = tangent(delta, wrapDegrees(after - to));
  const swing = (1 - Math.cos(4 * Math.PI * phase)) / 2;

  return {
    ...restPose,
    rotationX: xRotationMin + (xRotationMax - xRotationMin) * swing,
    rotationZ: from + t * (start + t * (3 * delta - 2 * start - end + t * (start + end - 2 * delta))),
  };
}
