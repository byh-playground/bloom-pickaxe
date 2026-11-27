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
const starterNeighbor = { x: 53, y: 476, region: 0, guaranteed: 0, tutorial: true };
export const copperRavineCenter = { x: 449, y: 177 };
export const ironRidgeCenter = { x: 455, y: 450 };
export const onlineCopperRavineCenter = {
    x: worldCenter.x + copperRavineCenter.x,
    y: worldSector.height * 2 + copperRavineCenter.y,
};
export const onlineIronRidgeCenter = {
    x: worldCenter.x + ironRidgeCenter.x,
    y: worldSector.height * 3 + ironRidgeCenter.y,
};
const copperLode = [{ x: 345, y: 175 }, copperRavineCenter, { x: 553, y: 186 }].map((point) => ({
    ...point,
    region: 0,
    guaranteed: 1,
    lode: 'copper',
}));
const lodeClearance = 98;
const starterClearance = 126;
const copperRegion = [
    ...copperLode,
    { x: 545, y: 293, region: 0, guaranteed: 1, lode: 'copper', guardian: true },
];
const ironDeposit = [{ x: 345, y: 450 }, ironRidgeCenter, { x: 565, y: 449 }].map((point) => ({
    ...point,
    region: 1,
    guaranteed: 2,
    lode: 'iron',
}));
const ironLode = [
    ...ironDeposit,
    { x: 591, y: 335, region: 1, guaranteed: 2, lode: 'iron', guardian: true },
];
const nearLode = (group, x, y) =>
    group.some((slot) => Math.hypot(slot.x - x, slot.y - y) < lodeClearance);

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
        if (i >= 3 && !tutorial && ((sectorSeed >>> (i * 3)) & 3) === 0) continue;
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
            tutorial,
        });
        if (i === 6 && region === 0 && (sx + sy) % 2 === 0)
            slots.push({ x: x - 106, y, region, seed: Math.floor(random() * 2 ** 32) });
    }
    const lode = sx === 50 && sy === 2 ? copperRegion : sx === 50 && sy === 3 ? ironLode : null;
    if (lode) {
        for (let i = slots.length - 1; i >= 0; i--)
            if (nearLode(lode, slots[i].x - originX, slots[i].y - originY)) slots.splice(i, 1);
        for (const slot of lode)
            slots.push({
                ...slot,
                x: originX + slot.x,
                y: originY + slot.y,
                seed: Math.floor(random() * 2 ** 32),
            });
    }
    if (sx === 50 && sy === 2) {
        for (let i = slots.length - 1; i >= 0; i--) {
            const slot = slots[i];
            if (
                !slot.tutorial &&
                Math.hypot(slot.x - onlineStarter.x, slot.y - onlineStarter.y) < starterClearance
            )
                slots.splice(i, 1);
        }
        slots.push({
            ...starterNeighbor,
            x: originX + starterNeighbor.x,
            y: originY + starterNeighbor.y,
            seed: sectorSeed,
        });
    }
    if (sx === 50 && sy === 50)
        slots.push({ ...worldCenter, region: 2, seed: sectorSeed, guaranteed: 4, boss: true });
    return slots;
}

const practiceSlots = [
    { x: 155, y: 476, region: 0, guaranteed: 0, tutorial: true },
    starterNeighbor,
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
export const oreSlots = [
    ...practiceSlots.filter(
        (slot) =>
            slot.boss ||
            (!nearLode(copperRegion, slot.x, slot.y) && !nearLode(ironLode, slot.x, slot.y)),
    ),
    ...copperRegion,
    ...ironLode,
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
