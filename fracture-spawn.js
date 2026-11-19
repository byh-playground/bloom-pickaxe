const regions = [
    [81, 17, 2, 0, 0],
    [35, 36, 23, 6, 0],
    [5, 12, 34, 32, 17],
];

export const worldSector = { width: 760, height: 600 };
export const onlineSize = {
    width: worldSector.width * 100,
    height: worldSector.height * 100,
};
export const worldCenter = { x: onlineSize.width / 2, y: onlineSize.height / 2 };
export const onlineStarter = { x: worldCenter.x + 221, y: worldSector.height * 2 + 477 };

const anchors = [
    [128, 120],
    [362, 97],
    [595, 136],
    [227, 276],
    [574, 313],
    [155, 476],
    [420, 461],
    [643, 490],
];

export function sectorSlots(seed, sx, sy) {
    const sectorSeed = (seed ^ Math.imul(sx + 1, 0x9e3779b1) ^ Math.imul(sy + 1, 0x85ebca6b)) >>> 0;
    const random = oreRng(sectorSeed);
    const originX = sx * worldSector.width;
    const originY = sy * worldSector.height;
    const slots = [];
    for (let i = 0; i < anchors.length; i++) {
        const [ax, ay] = anchors[i];
        const tutorial = sx === 50 && sy === 2 && i === 5;
        const x = originX + ax + (tutorial ? 0 : (random() - 0.5) * 65);
        const y = originY + ay + (tutorial ? 0 : (random() - 0.5) * 65);
        if (Math.hypot(x - worldCenter.x, y - worldCenter.y) < 160) continue;
        const depth = Math.max(
            Math.abs(x - worldCenter.x) / worldCenter.x,
            Math.abs(y - worldCenter.y) / worldCenter.y,
        );
        const region = depth > 0.55 ? 0 : depth > 0.22 ? 1 : 2;
        slots.push({
            x,
            y,
            region,
            seed: Math.floor(random() * 2 ** 32),
            guaranteed: tutorial ? 0 : undefined,
        });
    }
    if (sx === 50 && sy === 50)
        slots.push({ ...worldCenter, region: 2, seed: sectorSeed, guaranteed: 4, boss: true });
    return slots;
}

export const oreSlots = [
    { x: 155, y: 476, region: 0, guaranteed: 0 },
    { x: 83, y: 348, region: 0 },
    { x: 91, y: 177, region: 0 },
    { x: 210, y: 78, region: 0 },
    { x: 392, y: 65, region: 0, guaranteed: 1 },
    { x: 576, y: 71, region: 0 },
    { x: 671, y: 179, region: 0 },
    { x: 687, y: 329, region: 0 },
    { x: 677, y: 509, region: 0 },
    { x: 448, y: 528, region: 0 },
    { x: 289, y: 534, region: 0 },
    { x: 213, y: 242, region: 1 },
    { x: 313, y: 160, region: 1, guaranteed: 2 },
    { x: 524, y: 161, region: 1 },
    { x: 539, y: 434, region: 1 },
    { x: 307, y: 374, region: 1 },
    { x: 342, y: 246, region: 2, guaranteed: 3 },
    { x: 563, y: 275, region: 2, guaranteed: 4 },
    { x: 419, y: 337, region: 2, guaranteed: 4, boss: true },
];

export function oreRng(seed) {
    let value = seed >>> 0;
    return () => {
        value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
        return value / 4294967296;
    };
}

export function oreTier(slot, random) {
    if (slot.guaranteed !== undefined) return slot.guaranteed;
    let roll = random() * 100;
    return regions[slot.region].findIndex((weight) => (roll -= weight) < 0);
}
