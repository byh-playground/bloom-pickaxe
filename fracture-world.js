import { createFracturePhysics } from './fracture-physics.js';
import {
    oreRng,
    oreSlots,
    oreTier,
    onlineSize,
    onlineStarter,
    sectorSlots,
    worldCenter,
    worldSector,
} from './fracture-spawn.js';

export const board = worldSector;
export const onlineBoard = onlineSize;
export const tickRate = 30;
export const tickMs = 1000 / tickRate;
export const clockToleranceMs = 1e-6;
const attackReach = 72;
export const walkSpeed = 235;
const ramRunUp = 24;
const ramSpeed = 170;
const ramRecoilMs = 150;
const ramRollMs = 250;
const chainBeatMs = 75;
const shardLandingMs = 310;
const shardClaimMs = 900;
const shardPickupReach = 58;
export function walkDelta(x, y, dt) {
    const distance = (walkSpeed * dt) / Math.max(1, Math.hypot(x, y));
    return { x: x * distance, y: y * distance };
}
export function secondsAfterHitstop(time, stepSeconds, hitstopUntil = 0) {
    // A step crossing the deadline spends only its remaining time on movement.
    return Math.min(stepSeconds, Math.max(0, (time - hitstopUntil) / 1000));
}
const emptyDash = { charges: 0, nextChargeAt: 0, until: 0, direction: null };
const playerRadius = 13;
const chipSpanLimit = 52;
const debrisLifetimeMs = 1200;
const dropLifetimeMs = 60000;
const minRockCutArea = 160;
export const crackGrowthMs = 100;
const oreTypes = [
    ['stone', '돌', '#a8aaa2', '#e8e9dc', '#545954', '#97988d'],
    ['copper', '구리', '#ce8742', '#ffcf76', '#784535', '#9b8e7f'],
    ['iron', '철', '#8ca3bc', '#d2e5f5', '#455b72', '#78818a'],
    ['gold', '금', '#eab644', '#fff2a5', '#845e30', '#978062'],
    ['diamond', '다이아', '#46cbb7', '#c5fff4', '#2b766c', '#74928b'],
];
export const minerals = Object.fromEntries(
    oreTypes.map(([id, name, color, light, dark, shell], tier) => [
        id,
        { name, color, light, dark, shell, tier },
    ]),
);
export const pickaxes = [
    { name: '나무 곡괭이', color: '#b9875f' },
    ...oreTypes.map(([id, name, color], tier) => ({
        name: name + ' 곡괭이',
        color,
        ore: id,
        recipe: Object.fromEntries(
            oreTypes.slice(0, tier + 1).map(([ore], index) => [ore, index === tier ? 50 : 15]),
        ),
    })),
];
const contours = ['round', 'copper', 'iron', 'spire', 'ridge'];
const respawnMs = 5500;
const playerRespawnMs = 1150;
const bossRespawnMs = 24000;
const warnMs = 480;
const guardianAwareness = 300;
const guardianChargeReach = 154;
const guardianApproachSpeed = 76;
const collapseDelayMs = 450;
const collapseRadius = 116;
const tutorialWarnMs = 1000;
const recoverMs = 650;
const impactDrag = 7.5;
const swingWindupMs = 50;
const miningHitstopMs = 50;
const finisherHitstopMs = 160;
const finisherRecoilMs = 120;
const finisherRecoilSpeed = 320;
const attackBufferMs = 450;
const swingTotalMs = 245;
const impulseLimit = 390;
const starter = { x: 221, y: 477 };
const obstacles = [
    { x: 462, y: 431, r: 19 },
    { x: 630, y: 408, r: 18 },
];
const outlines = {
    round: [
        [-1.05, -0.09],
        [-0.79, -0.68],
        [-0.32, -0.91],
        [0.36, -0.88],
        [0.72, -0.6],
        [1.03, -0.22],
        [0.9, 0.45],
        [0.48, 0.86],
        [-0.19, 0.88],
        [-0.83, 0.59],
    ],
    broad: [
        [-1.08, -0.18],
        [-0.71, -0.66],
        [0.36, -0.76],
        [1.07, -0.29],
        [0.89, 0.4],
        [0.21, 0.74],
        [-0.76, 0.62],
    ],
    copper: [
        [-1.04, -0.3],
        [-0.59, -0.84],
        [0.16, -0.96],
        [0.62, -0.62],
        [1.08, -0.07],
        [0.64, 0.59],
        [-0.02, 0.88],
        [-0.84, 0.53],
    ],
    iron: [
        [-0.83, -0.58],
        [-0.17, -1.03],
        [0.49, -0.89],
        [0.78, -0.25],
        [0.68, 0.58],
        [0.04, 1.02],
        [-0.58, 0.77],
        [-0.9, 0.13],
    ],
    ridge: [
        [-0.96, -0.12],
        [-0.72, -0.72],
        [-0.19, -0.95],
        [0.41, -0.81],
        [0.93, -0.65],
        [0.98, -0.02],
        [0.63, 0.65],
        [0.19, 0.91],
        [-0.44, 0.72],
        [-0.84, 0.41],
    ],
    spire: [
        [-1.04, -0.17],
        [-0.66, -0.73],
        [-0.03, -0.96],
        [0.52, -0.72],
        [0.87, -0.36],
        [1.04, 0.24],
        [0.61, 0.78],
        [0.07, 0.88],
        [-0.56, 0.71],
        [-0.93, 0.38],
    ],
};
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const unit = (x, y) => {
    const length = Math.hypot(x, y);
    return length ? { x: x / length, y: y / length } : { x: 1, y: 0 };
};
const dot = (a, b) => a.x * b.x + a.y * b.y;

function resetRock(rock) {
    return {
        ...rock,
        polygon: outlines[rock.contour].map(([x, y]) => ({ x: x * rock.r, y: y * rock.r })),
        seam: [],
        cracks: [],
        geometryRevision: 0,
        lastHit: -Infinity,
    };
}
function centroid(points) {
    return points.reduce(
        (p, v) => ({ x: p.x + v.x / points.length, y: p.y + v.y / points.length }),
        { x: 0, y: 0 },
    );
}
function area(points) {
    let sum = 0;
    for (let i = 0; i < points.length; i++) {
        const a = points[i],
            b = points[(i + 1) % points.length];
        sum += a.x * b.y - b.x * a.y;
    }
    return Math.abs(sum) / 2;
}

export function splitPolygon(points, normal, offset) {
    const base = [],
        loose = [],
        seam = [];
    for (let i = 0; i < points.length; i++) {
        const a = points[i],
            b = points[(i + 1) % points.length];
        const da = dot(a, normal) - offset,
            db = dot(b, normal) - offset;
        if (da <= 0) base.push(a);
        if (da >= 0) loose.push(a);
        if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
            const t = da / (da - db);
            const p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
            base.push(p);
            loose.push(p);
            seam.push(p);
        }
    }
    return { base, loose, seam };
}

function withFractureEdge(polygon, original, bends) {
    const [start, end] = original;
    return polygon.flatMap((point, index) => {
        const next = polygon[(index + 1) % polygon.length];
        if (point === start && next === end) return [point, ...bends];
        if (point === end && next === start) return [point, ...bends.toReversed()];
        return [point];
    });
}

function roughenCut(points, cut, normal, depth) {
    if (cut.seam.length !== 2) return cut;
    const [a, b] = cut.seam;
    const span = distance(a, b);
    const bend = Math.min(depth, span * 0.12);
    if (bend < 1) return cut;
    const samples = [
        [0.2, -0.45],
        [0.38, 0.8],
        [0.55, -0.8],
        [0.72, 0.65],
        [0.87, -0.25],
    ];
    const bends = samples.map(([t, amplitude]) => ({
        x: a.x + (b.x - a.x) * t + normal.x * bend * amplitude,
        y: a.y + (b.y - a.y) * t + normal.y * bend * amplitude,
    }));
    const seam = [a, ...bends, b];
    const fits = seam.slice(0, -1).every((point, index) => {
        const next = seam[index + 1];
        return [0.25, 0.5, 0.75].every((t) =>
            inPolygon(points, {
                x: point.x + (next.x - point.x) * t,
                y: point.y + (next.y - point.y) * t,
            }),
        );
    });
    if (!fits || !bends.every((point) => inPolygon(points, point))) return cut;
    return {
        base: withFractureEdge(cut.base, cut.seam, bends),
        loose: withFractureEdge(cut.loose, cut.seam, bends),
        seam,
    };
}

export function closestOnSegment(p, a, b) {
    const dx = b.x - a.x,
        dy = b.y - a.y;
    const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
    return { x: a.x + dx * t, y: a.y + dy * t };
}

function closestOnPath(p, points, closed) {
    let nearest = points[0];
    for (let i = 1; i < points.length + Number(closed); i++) {
        const q = closestOnSegment(p, points[i - 1], points[i % points.length]);
        if (distance(p, q) < distance(p, nearest)) nearest = q;
    }
    return nearest;
}

function rotate({ x, y }, angle) {
    const cos = Math.cos(angle),
        sin = Math.sin(angle);
    return { x: x * cos - y * sin, y: x * sin + y * cos };
}

function fracturePaths(spot, seam) {
    if (!seam.length) return [];
    const join = closestOnPath(spot, seam, false);
    let i = 1;
    while (
        i < seam.length - 1 &&
        distance(closestOnSegment(join, seam[i - 1], seam[i]), join) > 0.001
    )
        i++;
    return [
        [spot, join, ...seam.slice(0, i).reverse()],
        [join, ...seam.slice(i)],
    ];
}

function planRock(rock, spot, level) {
    const whole = rock.polygon;
    const center = centroid(whole);
    const edge = closestOnPath(spot, whole, true);
    const depth = distance(spot, edge);
    const direction = unit(edge.x - center.x, edge.y - center.y);
    const size = area(whole);
    const perimeter = whole.reduce(
        (sum, p, i) => sum + distance(p, whole[(i + 1) % whole.length]),
        0,
    );
    const fragile = size / perimeter < rock.r * 0.12 || size < rock.r ** 2 * 0.55;
    const thick = depth > Math.sqrt(size / Math.PI) * 0.46;
    const nearCrack = rock.cracks.some((crack) => distance(crack.origin, spot) < rock.r * 0.38);
    if (fragile) {
        const split = splitChip(whole, direction, rock.r, size * 0.08);
        return { base: [], parts: split.parts, paths: fracturePaths(spot, split.seam), direction };
    }
    if (thick && !nearCrack) {
        const across = { x: -direction.y, y: direction.x };
        const paths = [-1, 1].map((side) => [
            spot,
            {
                x: spot.x + direction.x * depth * 0.3 + across.x * side * depth * 0.18,
                y: spot.y + direction.y * depth * 0.3 + across.y * side * depth * 0.18,
            },
            {
                x: spot.x + direction.x * depth * 0.63 + across.x * side * depth * 0.43,
                y: spot.y + direction.y * depth * 0.63 + across.y * side * depth * 0.43,
            },
        ]);
        return { paths, direction };
    }

    // Bisect a point at the exposed edge and one just inboard. Moving the
    // inboard point changes the depth without scaling the cut with the whole rock.
    const bite = rock.r * (level ? 0.42 : 0.28) * (nearCrack ? 1.35 : 1);
    const areaLimit = Math.min(size * 0.38, rock.r ** 2 * (nearCrack ? 0.95 : 0.62));
    for (const turn of [0, 0.35, -0.35, 0.7, -0.7, Math.PI / 2, -Math.PI / 2]) {
        const normal = rotate(direction, turn);
        const exposed = Math.max(...whole.map((p) => dot(p, normal)));
        for (const width of [1, 0.65, 1.4, 0.35]) {
            const plane = Math.min(exposed, dot(edge, normal) + bite * 0.35) - bite * width;
            const cut = splitPolygon(whole, normal, plane);
            const looseArea = area(cut.loose);
            if (cut.seam.length !== 2 || looseArea < minRockCutArea || looseArea > areaLimit)
                continue;
            const section = roughenCut(whole, cut, normal, bite * 0.27);
            return { ...section, paths: fracturePaths(spot, section.seam), direction: normal };
        }
    }

    for (const turn of [0, 0.35, -0.35, 0.7, -0.7]) {
        const normal = rotate(direction, turn);
        const lip = Math.max(...whole.map((p) => dot(p, normal)));
        for (const width of [0.35, 0.65, 1]) {
            const cut = splitPolygon(whole, normal, lip - bite * width);
            const looseArea = area(cut.loose);
            if (cut.seam.length === 2 && looseArea > 0 && looseArea <= areaLimit) {
                const section = roughenCut(whole, cut, normal, bite * 0.19);
                return { ...section, paths: fracturePaths(spot, section.seam), direction: normal };
            }
        }
    }
    const split = splitChip(whole, direction, rock.r, size * 0.08);
    return { base: [], parts: split.parts, paths: fracturePaths(spot, split.seam), direction };
}
function inPolygon(points, p) {
    let hit = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const a = points[i],
            b = points[j];
        if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x)
            hit = !hit;
    }
    return hit;
}

function splitChip(whole, direction, radius, minArea = 120) {
    const center = centroid(whole);
    const angle = Math.atan2(direction.y, direction.x) + Math.PI / 2;
    for (const turn of [0, 0.32, -0.32, 0.64, -0.64, 1.05, Math.PI / 2]) {
        const normal = { x: Math.cos(angle + turn), y: Math.sin(angle + turn) };
        const cut = splitPolygon(whole, normal, dot(center, normal));
        if (cut.seam.length !== 2) continue;
        const parts = roughenCut(whole, cut, normal, radius * 0.1);
        if ([parts.base, parts.loose].every((p) => p.length >= 3 && area(p) >= minArea)) {
            return { parts: [parts.base, parts.loose], seam: parts.seam };
        }
    }
    return { parts: [whole], seam: [] };
}

function breakOversizedChip(piece, remainingCuts = 2) {
    let ends;
    let maxSpan = chipSpanLimit;
    for (const a of piece) {
        for (const b of piece) {
            const span = distance(a, b);
            if (span > maxSpan) {
                maxSpan = span;
                ends = [a, b];
            }
        }
    }
    if (!ends || remainingCuts <= 0) return [piece];
    const [a, b] = ends;
    const normal = unit(b.x - a.x, b.y - a.y);
    const middle = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const cut = splitPolygon(piece, normal, dot(middle, normal));
    if (cut.seam.length !== 2 || area(cut.base) < 35 || area(cut.loose) < 35) return [piece];
    const parts = roughenCut(piece, cut, normal, 4);
    return [parts.base, parts.loose].flatMap((part) => breakOversizedChip(part, remainingCuts - 1));
}

export function createFractureWorld(Rapier, seed = 17, { online = false } = {}) {
    let simulationTick = 0;
    let nextId = 0;
    let eventId = 0;
    const rng = oreRng(seed);
    const physics = createFracturePhysics(Rapier, online);
    const keys = Object.keys(minerals);
    const bounds = online ? onlineBoard : board;
    const center = online ? worldCenter : { x: bounds.width / 2, y: bounds.height / 2 };
    const entry = online ? onlineStarter : starter;
    const state = {
        time: 0,
        rocks: [],
        obstacles: online ? [] : obstacles,
        shards: [],
        marks: [],
    };
    const participants = new Map();
    let ranking = null;
    const playerSessions = new Map();
    const chunks = new Map();
    const activeChunks = new Set();
    const liveChunks = new Set();
    const depleted = [];
    const wireGeometry = new WeakMap();
    let neighborhood = '';
    let slams = 0;
    let impactFractures = [];
    const finishers = new Map();
    const collapses = [];
    const shardOwners = new WeakMap();

    function addPlayer(id) {
        const player = {
            ...entry,
            faceX: -1,
            faceY: 0,
            hp: 4,
            maxHp: 4,
            hurtAt: -Infinity,
            deadAt: null,
            respawnAt: null,
            spawnRevision: 0,
            ramRecoverUntil: 0,
        };
        const session = {
            id,
            player,
            level: 0,
            target: null,
            breaking: null,
            swing: null,
            bag: Object.fromEntries(oreTypes.map(([key]) => [key, 0])),
            stats: { cuts: 0, pickups: 0, upgrades: 0, kills: 0, hitsTaken: 0 },
            message: '',
            pending: null,
            moving: false,
            ramTravel: 0,
            ramHeading: null,
        };
        participants.set(id, session);
        ranking = null;
        playerSessions.set(player, session);
        return session;
    }

    function blockedSpawn(session, point) {
        return (
            Array.from(participants.values()).some(
                (other) =>
                    other !== session && distance(other.player, point) < playerRadius * 2 + 12,
            ) ||
            state.rocks.some((rock) => distance(rock, point) < rock.r * 1.07 + playerRadius + 5)
        );
    }
    function respawnPoint(session) {
        if (!online || !blockedSpawn(session, entry)) return entry;
        for (let ring = 1; ring <= 8; ring++) {
            for (let i = 0; i < 8 * ring; i++) {
                const angle = (i * Math.PI) / (4 * ring);
                const candidate = {
                    x: entry.x + Math.cos(angle) * ring * 31,
                    y: entry.y + Math.sin(angle) * ring * 31,
                };
                if (!blockedSpawn(session, candidate)) return candidate;
            }
        }
        return entry;
    }
    function randomRespawn(session) {
        const margin = 70;
        for (let i = 0; i < 48; i++) {
            const x = online
                ? entry.x + (rng() - 0.5) * 2500
                : margin + rng() * (bounds.width - margin * 2);
            const y = online
                ? entry.y + (rng() - 0.25) * 1450
                : margin + rng() * (bounds.height - margin * 2);
            const point = { x, y };
            if (
                x < margin ||
                y < margin ||
                x > bounds.width - margin ||
                y > bounds.height - margin ||
                distance(session.player, point) < 125 ||
                blockedSpawn(session, point) ||
                state.obstacles.some(
                    (obstacle) => distance(obstacle, point) < obstacle.r + playerRadius + 12,
                )
            )
                continue;
            if (online) {
                const sx = Math.floor(x / worldSector.width),
                    sy = Math.floor(y / worldSector.height);
                let crowded = false;
                for (let cy = Math.max(0, sy - 1); cy <= Math.min(99, sy + 1); cy++) {
                    for (let cx = Math.max(0, sx - 1); cx <= Math.min(99, sx + 1); cx++) {
                        const here = chunks.get(`${cx}:${cy}`) ?? sectorSlots(seed, cx, cy);
                        if (here.some((actor) => distance(actor, point) < (actor.r ?? 80) + 42))
                            crowded = true;
                    }
                }
                if (crowded) continue;
            }
            return point;
        }
        return null;
    }

    for (const obstacle of state.obstacles) physics.add(obstacle, obstacle.r);
    function spawn(slot) {
        const random = online ? oreRng(slot.seed + (slot.generation ?? 0)) : rng;
        if (online) slot.generation = (slot.generation ?? 0) + 1;
        const tier = oreTier(slot, random);
        const rock = resetRock({
            uid: ++nextId,
            id: keys[tier],
            x: slot.x + (slot.guaranteed === 0 || slot.boss ? 0 : (random() - 0.5) * 16),
            y: slot.y + (slot.guaranteed === 0 || slot.boss ? 0 : (random() - 0.5) * 16),
            r: slot.boss ? 58 : slot.guardian ? 52 : 39 + tier * 2 + random() * 5,
            lode: slot.lode,
            guardian: slot.guardian,
            contour:
                !slot.tutorial && tier === 0 && Math.floor(slot.seed ?? slot.x + slot.y) % 3 === 1
                    ? 'broad'
                    : contours[tier],
            heading: random() * Math.PI * 2,
            stage: 'roam',
            stageUntil: state.time + 500 + random() * 1400,
            chargeDir: null,
            chargeDistance: slot.boss || slot.guardian ? 125 : slot.guaranteed === 0 ? 68 : 96,
            chargeLeft: 0,
            remainingYield:
                slot.boss || slot.guardian ? 35 : (slot.tutorial || slot.lode ? 25 : 12) + tier,
            boss: Boolean(slot.boss),
            slot,
        });
        if (online) chunks.get(slot.chunk).push(rock);
        physics.add(rock, rock.r * 1.1);
        state.rocks.push(rock);
    }
    function refreshChunks() {
        if (!online) return;
        const sectors = new Set();
        for (const { player } of participants.values()) {
            const sx = Math.floor(player.x / worldSector.width);
            const sy = Math.floor(player.y / worldSector.height);
            sectors.add(`${sx}:${sy}`);
        }
        const signature = Array.from(sectors).sort().join('|');
        if (signature === neighborhood) return;
        neighborhood = signature;
        const wanted = new Set();
        liveChunks.clear();
        for (const sector of sectors) {
            const [sx, sy] = sector.split(':').map(Number);
            for (let y = Math.max(0, sy - 2); y <= Math.min(99, sy + 2); y++) {
                for (let x = Math.max(0, sx - 2); x <= Math.min(99, sx + 2); x++) {
                    const key = `${x}:${y}`;
                    wanted.add(key);
                    if (Math.abs(x - sx) <= 1 && Math.abs(y - sy) <= 1) liveChunks.add(key);
                }
            }
        }
        for (const key of activeChunks) {
            if (wanted.has(key)) continue;
            for (const rock of chunks.get(key)) physics.remove(rock);
            activeChunks.delete(key);
        }
        state.rocks = state.rocks.filter((rock) => activeChunks.has(rock.slot.chunk));
        for (const key of wanted) {
            if (activeChunks.has(key)) continue;
            activeChunks.add(key);
            const existing = chunks.get(key);
            if (existing) {
                for (const rock of existing) {
                    physics.add(rock, rock.r * 1.1);
                    state.rocks.push(rock);
                }
            } else {
                const [x, y] = key.split(':').map(Number);
                chunks.set(key, []);
                for (const slot of sectorSlots(seed, x, y)) spawn({ ...slot, chunk: key });
            }
        }
    }
    if (!online) for (const slot of oreSlots) spawn(slot);

    function join(id) {
        if (participants.has(id)) return;
        const session = addPlayer(id);
        refreshChunks();
        Object.assign(session.player, respawnPoint(session));
        physics.add(session.player, playerRadius);
        session.target = nearestTarget(session);
    }
    function leave(id) {
        const session = participants.get(id);
        if (!session) return;
        if (session.player.hp > 0) physics.remove(session.player);
        playerSessions.delete(session.player);
        participants.delete(id);
        ranking = null;
        refreshChunks();
    }
    function mark(kind, x, y, ore, extra = {}) {
        state.marks.push({ kind, x, y, ore, at: state.time, eventId: ++eventId, ...extra });
    }
    function aim(session, p) {
        const f = unit(p.x - session.player.x, p.y - session.player.y);
        session.player.faceX = f.x;
        session.player.faceY = f.y;
        return f;
    }
    function plan(session, target, local) {
        if (target.polygon) {
            const tier = minerals[target.id].tier;
            return session.level < tier ? null : planRock(target, local, session.level > tier);
        }
        const direction = unit(local.x, local.y);
        const split = splitChip(target.shape, direction, target.radius, area(target.shape) * 0.08);
        return { parts: split.parts, paths: fracturePaths(local, split.seam), direction };
    }
    function miningAction(session, target, spot) {
        const local = rotate({ x: spot.x - target.x, y: spot.y - target.y }, -(target.angle ?? 0));
        const points = target.polygon ?? target.shape;
        const aimPoint = inPolygon(points, local) ? local : closestOnPath(local, points, true);
        return { target, local: aimPoint, plan: plan(session, target, aimPoint), shape: points };
    }
    function contactPoint({ target, local }) {
        const p = rotate(local, target.angle ?? 0);
        return { x: target.x + p.x, y: target.y + p.y };
    }
    function targetSpot(session, actor) {
        const { player } = session;
        if (actor.polygon) return physics.closestPoint(actor, player);
        const local = rotate({ x: player.x - actor.x, y: player.y - actor.y }, -actor.angle);
        const edge = rotate(closestOnPath(local, actor.shape, true), actor.angle);
        return { x: actor.x + edge.x, y: actor.y + edge.y };
    }
    function closestTarget(session, actors, eligible) {
        let nearest = null;
        let best = attackReach;
        for (const actor of actors) {
            if (
                !eligible(actor) ||
                distance(session.player, actor) > best + (actor.r ?? actor.radius) * 1.8
            )
                continue;
            const spot = targetSpot(session, actor);
            if (!spot) continue;
            const reach = distance(session.player, spot);
            if (reach > best || (nearest && reach === best)) continue;
            nearest = { actor, spot };
            best = reach;
        }
        return nearest;
    }
    function nearestTarget(session) {
        return (
            closestTarget(session, state.rocks, (rock) => !rock.ram && !finishers.has(rock)) ??
            closestTarget(session, state.shards, (shard) => shard.breakable && shard.z <= 18)
        );
    }
    function impactMass(actor) {
        if (!actor.polygon) return 1;
        return clamp(area(actor.polygon) / (Math.PI * 35 ** 2), 0.57, 2.8);
    }
    function kick(actor, direction, speed, strength) {
        const x = (actor.kickX ?? 0) + direction.x * speed;
        const y = (actor.kickY ?? 0) + direction.y * speed;
        const limit = Math.min(1, impulseLimit / (Math.hypot(x, y) || 1));
        actor.kickX = x * limit;
        actor.kickY = y * limit;
        actor.impact = { at: state.time, x: direction.x, y: direction.y, strength };
    }
    function fractureOnImpact(session, target, hit, direction, chained = false) {
        if (finishers.has(target) || session.level < minerals[target.id].tier) return;
        const { primed } = target;
        const action = primed ?? miningAction(session, target, hit);
        let plan = action.plan;
        if ((primed || chained) && !target.boss) plan = planShatter(target, direction);
        target.lastHit = state.time;
        impactFractures.push({
            session,
            at: state.time + (chained ? finisherHitstopMs + chainBeatMs : 0),
            action: { ...action, plan, direction, claimed: true, chained },
        });
    }
    function planShatter(target, direction) {
        const split = splitChip(target.polygon, direction, target.r, area(target.polygon) * 0.08);
        return { base: [], parts: split.parts, direction };
    }
    function finishRam(rock) {
        const roll = rock.ram;
        if (!roll) return;
        rock.ram = null;
        fractureOnImpact(roll.session, rock, rock, roll.direction);
    }
    function slam(actor, hit, direction, speed) {
        if (speed < 68 || state.time - (actor.slamAt ?? -Infinity) < 115) return;
        const ore = actor.ore ?? actor.id ?? hit.actor?.id ?? actor.impactOre;
        if (!Object.hasOwn(minerals, ore)) return;
        actor.slamAt = state.time;
        slams++;
        const strength = clamp(speed / 190, 0.4, 1.25);
        mark('slam', hit.x, hit.y, ore, { direction, strength, z: 6 });
        if (hit.actor?.polygon && !finishers.has(hit.actor)) {
            const other = hit.actor;
            const incoming = Math.max(0, -direction.x * hit.nx - direction.y * hit.ny);
            const transfer = Math.min(190, (speed * 0.62 * impactMass(actor)) / impactMass(other));
            if (incoming > 0.2) {
                kick(other, direction, transfer * incoming, strength * 0.7);
                if (actor.ram && speed >= 100 && incoming >= 0.5) {
                    fractureOnImpact(actor.ram.session, other, hit, direction, true);
                    finishRam(actor);
                } else if (
                    actor.stage === 'charge' &&
                    actor.primed &&
                    speed >= 100 &&
                    incoming >= 0.5
                ) {
                    const owner = participants.get(actor.primed.ownerId);
                    if (owner?.player.hp && !actor.boss) {
                        fractureOnImpact(owner, actor, hit, direction);
                        fractureOnImpact(owner, other, hit, direction, true);
                        mark('bait', hit.x, hit.y, ore, { direction, strength: 1.4, z: 8 });
                    }
                }
            }
        }
    }
    function advanceImpact(actor, dt) {
        const x = actor.kickX ?? 0,
            y = actor.kickY ?? 0;
        const speed = Math.hypot(x, y);
        if (speed < 3) {
            actor.kickX = 0;
            actor.kickY = 0;
            return;
        }
        const hit = moveActor(actor, x * dt, y * dt);
        let vx = x,
            vy = y;
        if (hit) {
            const inward = Math.min(0, x * hit.nx + y * hit.ny);
            const kickDirection = { x: x / speed, y: y / speed };
            slam(actor, hit, kickDirection, -inward);
            vx -= 1.16 * inward * hit.nx;
            vy -= 1.16 * inward * hit.ny;
        }
        const drag = Math.exp(-impactDrag * dt);
        actor.kickX = vx * drag;
        actor.kickY = vy * drag;
    }
    function chargeHeading(target, player) {
        const aim = unit(player.x - target.x, player.y - target.y);
        if (!target.lode) return aim;
        let best = aim;
        let alignment = 0.55;
        for (const rock of state.rocks) {
            if (
                rock === target ||
                rock.lode !== target.lode ||
                finishers.has(rock) ||
                distance(rock, target) > target.chargeDistance + target.r + rock.r
            )
                continue;
            const lane = unit(rock.x - target.x, rock.y - target.y);
            const score = dot(lane, aim);
            if (score > alignment) {
                best = lane;
                alignment = score;
            }
        }
        return best;
    }
    function startStrike(session, action) {
        const { target } = action;
        const spot = contactPoint(action);
        const direction = aim(session, spot);
        const ore = target.ore ?? target.id;
        const z = target.z === undefined ? 14 : target.z + 4;
        if (target.polygon) target.lastHit = state.time;
        if (action.plan) {
            session.swing.hitAt = state.time;
            const separated = Boolean(action.plan.loose || action.plan.parts);
            const strength = separated ? 1.05 : 0.68;
            const plan =
                (target.slot?.tutorial || target.lode) && target.primed
                    ? planShatter(target, direction)
                    : separated
                      ? action.plan
                      : (target.primed?.plan ?? action.plan);
            if (target.polygon && target.primed && plan.parts && !plan.base.length) {
                session.swing.holdUntil = beginFinisher(session, { ...action, plan, direction });
                session.swing.endsAt += finisherHitstopMs;
                return;
            }
            session.breaking = {
                ...action,
                plan,
                at: state.time,
                direction,
                prepare: Boolean(target.polygon && !target.primed),
            };
            if (target.polygon) {
                const braced = target.stage === 'charge' ? 0.42 : 1;
                kick(
                    target,
                    direction,
                    ((session.breaking.prepare ? 65 : 165) * strength * braced) /
                        Math.sqrt(impactMass(target)),
                    strength,
                );
            }
            if (target.polygon && target.stage === 'roam') {
                target.stage = 'warn';
                target.stageUntil = state.time + (target.slot.tutorial ? tutorialWarnMs : warnMs);
                target.chargeDir = chargeHeading(target, session.player);
                target.heading = Math.atan2(target.chargeDir.y, target.chargeDir.x);
            }
            if (target.polygon) {
                session.swing.holdUntil = holdMiningContact(session, target, miningHitstopMs);
                session.swing.endsAt += miningHitstopMs;
            }
            mark('cut', spot.x, spot.y, ore, { z, direction, strength });
        } else {
            kick(session.player, { x: -direction.x, y: -direction.y }, 44, 0.38);
            mark('clink', spot.x, spot.y, ore, { z, direction, strength: 0.6 });
            session.message =
                pickaxes[minerals[ore].tier].name + '부터 ' + minerals[ore].name + ' 채굴 가능';
        }
    }
    function holdMiningContact(session, target, durationMs) {
        const holdUntil = state.time + durationMs;
        const oldDeadline = Math.max(state.time, target.hitstopUntil ?? state.time);
        if (oldDeadline === state.time) target.hitstopAt = state.time;
        target.stageUntil += Math.max(0, holdUntil - oldDeadline);
        target.hitstopUntil = Math.max(oldDeadline, holdUntil);
        if (!(session.player.hitstopUntil > state.time)) session.player.hitstopAt = state.time;
        session.player.hitstopUntil = Math.max(session.player.hitstopUntil ?? 0, holdUntil);
        return holdUntil;
    }
    function beginFinisher(session, action) {
        const { target, direction } = action;
        const holdUntil = holdMiningContact(session, target, finisherHitstopMs);
        target.lastHit = state.time;
        const { x, y } = contactPoint(action);
        mark('finisher', x, y, target.id, {
            direction,
            strength: 1.4,
            z: 14,
            attackerId: session.id,
            recoilUntil: holdUntil + finisherRecoilMs,
        });
        finishers.set(target, { session, action, holdUntil });
        return holdUntil;
    }
    function releaseFinishers() {
        for (const [rock, { session, action, holdUntil }] of finishers) {
            if (state.time < holdUntil) continue;
            finishers.delete(rock);
            applyFracture(session, action, holdUntil);
            const { player } = session;
            if (!player.hp || !participants.has(session.id)) continue;
            const { x, y } = action.direction;
            const recoil = { x: -x, y: -y };
            const existing = dot({ x: player.kickX ?? 0, y: player.kickY ?? 0 }, recoil);
            kick(player, recoil, Math.max(0, finisherRecoilSpeed - existing), 1.25);
            player.impact.origin = { x: player.x, y: player.y };
            player.impactOre = rock.id;
            player.ramRecoverUntil = Math.max(player.ramRecoverUntil, holdUntil + finisherRecoilMs);
        }
    }
    function chip(rock, points, push, index, amount, breakable, claim) {
        const center = centroid(points);
        const section = points.map((p) => ({ x: p.x - center.x, y: p.y - center.y }));
        const radius = Math.sqrt(area(points) / Math.PI);
        const collectible = amount > 0;
        const speed = collectible ? 93 : 163;
        const scatter = index === 0 ? -55 : index === 1 ? 55 : ((index % 4) - 1.5) * 39;
        const shard = {
            id: ++nextId,
            ore: rock.id,
            x: rock.x + center.x,
            y: rock.y + center.y,
            shape: section,
            radius,
            collectible,
            amount,
            breakable,
            expiresAt: collectible
                ? online
                    ? state.time + dropLifetimeMs
                    : Infinity
                : state.time + debrisLifetimeMs,
            z: rock.z ?? 12,
            vz: (collectible ? 124 : 155) + (index % 3) * 18,
            vx: (rock.vx ?? 0) + push.x * speed - push.y * scatter,
            vy: (rock.vy ?? 0) + push.y * speed + push.x * scatter,
            angle: 0,
            spin: index ? 4.2 : -3.5,
            bornAt: state.time,
            bounces: 0,
        };
        if (collectible && claim) shardOwners.set(shard, claim);
        state.shards.push(shard);
    }
    function scatterChips(source, pieces, direction, canBreak, amount, claim) {
        const parts = pieces
            .flatMap((piece) => breakOversizedChip(piece))
            .sort((a, b) => area(b) - area(a));
        parts.forEach((part, i) => {
            const reward = i === 0 ? amount : 0;
            chip(
                source,
                part,
                direction,
                i,
                reward,
                canBreak && reward > 0 && area(part) >= minRockCutArea,
                claim,
            );
        });
    }
    function applyFracture(session, action, finisherAt) {
        const { target, local, plan: result, direction, shape, prepare, claimed, chained } = action;
        const activeTargets = target.polygon ? state.rocks : state.shards;
        const active = activeTargets.includes(target);
        const sector = target.polygon && online ? chunks.get(target.slot.chunk) : null;
        const finalizing = finisherAt !== undefined;
        const available = active || (finalizing && sector?.includes(target));
        if (!available || (target.polygon ?? target.shape) !== shape || finishers.has(target))
            return;
        if (
            !finalizing &&
            !prepare &&
            !chained &&
            target.polygon &&
            result.parts &&
            !result.base.length
        ) {
            beginFinisher(session, action);
            return;
        }
        const name = minerals[target.ore ?? target.id].name;
        if (prepare) {
            if (target.primed) return;
            const plan =
                result.parts || result.loose
                    ? result
                    : planRock(target, closestOnPath(local, shape, true), true);
            target.primed = { ...action, plan, prepare: false, ownerId: session.id };
            target.cracks = [
                ...target.cracks.slice(-3),
                { origin: local, paths: plan.paths, armed: true },
            ];
            target.geometryRevision++;
            session.message = target.lode
                ? '금이 갔어요. 돌진을 피해서 옆 광물과 부딪치게 해 보세요.'
                : name + '에 금이 갔어요. 몸으로 밀거나 곡괭이로 한 번 더 치세요.';
            return;
        }
        if (target.polygon && !result.parts && !result.loose) {
            target.cracks = [...target.cracks.slice(-3), { origin: local, paths: result.paths }];
            target.geometryRevision++;
            session.message = name + '에 실금이 갔어요. 금이 난 자리를 다시 쳐 보세요.';
            return;
        }
        const firstShardId = nextId + 1;
        if (target.polygon) {
            target.primed = null;
            target.ram = null;
            const pieces = result.parts ?? [result.loose];
            const amount = result.base.length
                ? Math.min(2, Math.max(0, target.remainingYield - 4))
                : target.remainingYield;
            target.remainingYield -= amount;
            const push = unit(
                result.direction.x + direction.x * 0.42,
                result.direction.y + direction.y * 0.42,
            );
            scatterChips(
                { ...target, vx: (target.kickX ?? 0) * 0.44, vy: (target.kickY ?? 0) * 0.44 },
                pieces,
                push,
                true,
                amount,
                claimed
                    ? { id: session.id, until: state.time + shardLandingMs + shardClaimMs }
                    : null,
            );
            if (result.base.length) {
                target.polygon = result.base;
                physics.replaceHull(target);
                target.seam = result.seam;
                target.cracks = target.cracks.filter(
                    (crack) => !crack.armed && inPolygon(result.base, crack.origin),
                );
                target.geometryRevision++;
            } else {
                state.rocks = state.rocks.filter((rock) => rock !== target);
                if (active) physics.remove(target);
                if (sector) sector.splice(sector.indexOf(target), 1);
                session.stats.kills++;
                ranking = null;
                depleted.push({
                    slot: target.slot,
                    respawnAt: state.time + (target.boss ? bossRespawnMs : respawnMs),
                });
            }
        } else {
            const { x, y, z, vx, vy, angle, ore } = target;
            const pieces = result.parts.map((part) => part.map((p) => rotate(p, angle)));
            state.shards = state.shards.filter((piece) => piece !== target);
            scatterChips(
                { x, y, z, vx, vy, id: ore },
                pieces,
                rotate(result.direction, angle),
                false,
                target.amount,
                shardOwners.get(target),
            );
        }
        const spot = contactPoint({ target, local });
        mark('split', spot.x, spot.y, target.ore ?? target.id, {
            direction,
            z: target.z === undefined ? 12 : target.z + 4,
            strength: target.polygon && !result.base.length ? 1.3 : 0.95,
            ...(finalizing && {
                at: finisherAt,
                finisher: { rockUid: target.uid, firstShardId, lastShardId: nextId },
            }),
        });
        session.stats.cuts++;
        session.message = chained
            ? '연쇄 파쇄! 옆 광물에서도 조각이 떨어졌어요.'
            : name + (target.polygon ? ' 조각이 떨어졌어요.' : ' 파편이 잘게 깨졌어요.');
    }
    function tryUpgrade(session) {
        const next = pickaxes[session.level + 1];
        if (!next || session.breaking) return;
        const costs = Object.entries(next.recipe);
        if (!costs.every(([ore, amount]) => session.bag[ore] >= amount)) return;
        for (const [ore, amount] of costs) session.bag[ore] -= amount;
        session.level++;
        ranking = null;
        session.stats.upgrades++;
        mark('upgrade', session.player.x, session.player.y, next.ore);
        session.message = next.name + ' 완성!';
    }
    function moveActor(actor, dx, dy, slide = true) {
        const boundary = actor.r ? actor.r * 1.08 + 8 : 24;
        const delta = {
            x: clamp(actor.x + dx, boundary, bounds.width - boundary) - actor.x,
            y: clamp(actor.y + dy, boundary, bounds.height - boundary) - actor.y,
        };
        const hit = physics.move(actor, delta, slide);
        if (hit) return hit;
        const bx = dx - delta.x,
            by = dy - delta.y;
        if (Math.hypot(bx, by) <= 0.001) return null;
        if (Math.abs(bx) > Math.abs(by))
            return { nx: -Math.sign(bx), ny: 0, x: actor.x, y: actor.y };
        return { nx: 0, ny: -Math.sign(by), x: actor.x, y: actor.y };
    }
    function walkPlayer(session, x, y, dt) {
        const player = session.player;
        if ((!x && !y) || state.time < player.ramRecoverUntil) {
            session.ramTravel = 0;
            return false;
        }
        const heading = unit(x, y);
        if (!session.ramHeading || dot(heading, session.ramHeading) < 0.75) session.ramTravel = 0;
        session.ramHeading = heading;
        const move = walkDelta(x, y, dt);
        const before = { x: player.x, y: player.y };
        const hit = moveActor(player, move.x, move.y);
        const speed = hit ? Math.max(0, -(move.x * hit.nx + move.y * hit.ny) / dt) : 0;
        const ready = hit?.actor?.primed && session.level >= minerals[hit.actor.id].tier;
        if (
            (ready && speed >= ramSpeed * 0.75) ||
            (hit?.actor && session.ramTravel >= ramRunUp && speed >= ramSpeed)
        )
            ram(session, hit, speed);
        else if (!hit)
            session.ramTravel = Math.min(ramRunUp, session.ramTravel + distance(before, player));
        else session.ramTravel = 0;
        if (!session.swing) aim(session, { x: player.x + x, y: player.y + y });
        return true;
    }
    function ram(session, hit, speed) {
        const { actor: other } = hit;
        const receiver = playerSessions.get(other);
        if ((!receiver && !other.polygon) || other.ram || finishers.has(other)) return;
        const { player } = session;
        const direction = { x: -hit.nx, y: -hit.ny };
        const ore = other.polygon ? other.id : (pickaxes[session.level].ore ?? 'stone');
        player.ramRecoverUntil = state.time + ramRecoilMs;
        player.impactOre = ore;
        session.ramTravel = 0;
        kick(player, { x: -direction.x, y: -direction.y }, speed * 0.62, 0.65);
        if (receiver) {
            kick(other, direction, speed * 0.68, 0.85);
            mark('slam', hit.x, hit.y, ore, { direction, strength: 0.82, z: 9 });
            return;
        }
        mark('slam', hit.x, hit.y, ore, { direction, strength: 1.1, z: 9 });
        const armed = other.primed && session.level >= minerals[ore].tier;
        const rollSpeed = armed ? Math.max(speed, ramSpeed) * 1.45 : speed * 0.46;
        kick(other, direction, rollSpeed / Math.sqrt(impactMass(other)), 1.1);
        if (!armed) return;
        other.ram = { session, direction, until: state.time + ramRollMs };
        other.stage = 'recover';
        other.stageUntil = state.time + recoverMs;
    }
    function hurtPlayer(session, source, hit, speed) {
        const player = session.player;
        if (!player.hp || state.time - player.hurtAt < 650) return;
        const ore = source.id;
        player.hurtAt = state.time;
        player.hp--;
        session.stats.hitsTaken++;
        const direction = { x: -hit.nx, y: -hit.ny };
        const strength = source.boss ? 1.28 : 1.05;
        player.impactOre = ore;
        kick(player, direction, 100 + speed * 0.68, strength);
        mark('hurt', hit.x, hit.y, ore, { direction, strength, z: 10 });
        const recoil = { x: -direction.x, y: -direction.y };
        kick(source, recoil, (speed * 0.26) / impactMass(source), 0.38);
        if (!player.hp) {
            player.deadAt = state.time;
            player.respawnAt = state.time + playerRespawnMs;
            physics.remove(player);
            session.pending = null;
            session.swing = null;
            session.breaking = null;
            session.target = null;
            session.moving = false;
            session.message = '쓰러졌어요. 잠시 뒤 다른 채굴터에서 다시 시작해요.';
        } else {
            session.message = '돌진에 맞았어요. 예고 방향 옆으로 피해 보세요.';
        }
    }
    function revive(session) {
        const point = randomRespawn(session);
        if (!point) return false;
        const { player } = session;
        Object.assign(player, point, {
            hp: player.maxHp,
            deadAt: null,
            respawnAt: null,
            spawnRevision: player.spawnRevision + 1,
            hurtAt: state.time,
            ramRecoverUntil: 0,
            hitstopAt: 0,
            hitstopUntil: 0,
            kickX: 0,
            kickY: 0,
            impact: null,
        });
        physics.add(player, playerRadius);
        session.message = '새 채굴터에서 다시 시작했어요.';
        return true;
    }
    function seekWithGuardian(rock, dt) {
        let nearest = null;
        let reach = guardianAwareness;
        const tier = minerals[rock.id].tier;
        for (const session of participants.values()) {
            const { player, level } = session;
            if (!player.hp || level < tier) continue;
            const range = distance(rock, player);
            if (range >= reach) continue;
            nearest = session;
            reach = range;
        }
        if (!nearest) return false;
        const aim = unit(nearest.player.x - rock.x, nearest.player.y - rock.y);
        rock.heading = Math.atan2(aim.y, aim.x);
        if (reach > guardianChargeReach) {
            moveActor(rock, aim.x * guardianApproachSpeed * dt, aim.y * guardianApproachSpeed * dt);
        } else {
            rock.stage = 'warn';
            rock.stageUntil = state.time + warnMs;
            rock.chargeDir = aim;
            const name = rock.lode === 'iron' ? '철 수호석' : '구리 수호석';
            nearest.message = name + ' 돌진! 예고 방향 옆으로 피하세요.';
        }
        return true;
    }
    function warnCollapse(rock) {
        const { x, y } = rock;
        collapses.push({ x, y, source: rock, at: state.time + collapseDelayMs });
        mark('collapseWarn', x, y, rock.id, {
            radius: collapseRadius,
            durationMs: collapseDelayMs,
        });
    }
    function stepCollapses() {
        while (collapses.length && collapses[0].at <= state.time) {
            const collapse = collapses.shift();
            const { x, y, source } = collapse;
            mark('collapse', x, y, source.id, { radius: collapseRadius, strength: 1.45 });
            for (const session of participants.values()) {
                const player = session.player;
                if (distance(player, collapse) > collapseRadius) continue;
                const inward = unit(x - player.x, y - player.y);
                hurtPlayer(
                    session,
                    source,
                    { x: player.x, y: player.y, nx: inward.x, ny: inward.y },
                    155,
                );
            }
        }
    }
    function stepMobs(stepSeconds) {
        for (const rock of state.rocks) {
            const dt = secondsAfterHitstop(state.time, stepSeconds, rock.hitstopUntil);
            if (!dt) continue;
            if (
                online &&
                rock.stage === 'roam' &&
                !liveChunks.has(rock.slot.chunk) &&
                !rock.kickX &&
                !rock.kickY
            )
                continue;
            advanceImpact(rock, dt);
            if (rock.ram && state.time >= rock.ram.until) finishRam(rock);
            if (rock.stage === 'warn') {
                if (state.time >= rock.stageUntil) {
                    rock.stage = 'charge';
                    rock.chargeLeft = rock.chargeDistance;
                }
            } else if (rock.stage === 'charge') {
                const speed = rock.slot.guaranteed === 0 ? 235 : 295;
                const movement = Math.min(rock.chargeLeft, speed * dt);
                const { x, y } = rock.chargeDir;
                const before = { x: rock.x, y: rock.y };
                const hit = moveActor(rock, x * movement, y * movement, false);
                const moved = distance(before, rock);
                rock.chargeLeft -= moved;
                const hitPlayer = hit ? playerSessions.get(hit.actor) : null;
                if (hitPlayer) {
                    hurtPlayer(hitPlayer, rock, hit, speed);
                } else if (hit) {
                    slam(
                        rock,
                        hit,
                        rock.chargeDir,
                        Math.max(0, -(x * hit.nx + y * hit.ny) * speed),
                    );
                    kick(rock, { x: hit.nx, y: hit.ny }, (speed * 0.24) / impactMass(rock), 0.5);
                }
                if (hit || moved + 0.005 < movement || rock.chargeLeft <= 0.005) {
                    if (rock.guardian) warnCollapse(rock);
                    rock.stage = 'recover';
                    rock.stageUntil = state.time + recoverMs;
                }
            } else if (rock.stage === 'recover') {
                if (state.time >= rock.stageUntil) {
                    rock.stage = 'roam';
                    rock.stageUntil = state.time;
                }
            } else {
                if (rock.guardian && seekWithGuardian(rock, dt)) continue;
                if (state.time >= rock.stageUntil) {
                    const back = Math.atan2(rock.slot.y - rock.y, rock.slot.x - rock.x);
                    rock.heading = distance(rock, rock.slot) > 37 ? back : rng() * Math.PI * 2;
                    rock.stageUntil = state.time + 700 + rng() * 1100;
                }
                if (rock.boss || rock.slot.tutorial) continue;
                const speed = 27 * dt;
                moveActor(rock, Math.cos(rock.heading) * speed, Math.sin(rock.heading) * speed);
            }
        }
    }
    function advanceShard(shard, dt) {
        if (state.time >= shard.expiresAt) return false;
        const x = shard.x + shard.vx * dt;
        const y = shard.y + shard.vy * dt;
        shard.x = clamp(x, 16, bounds.width - 16);
        shard.y = clamp(y, 20, bounds.height - 18);
        if (x !== shard.x) shard.vx *= -0.43;
        if (y !== shard.y) shard.vy *= -0.43;
        if (shard.z || shard.vz) {
            shard.vz -= 860 * dt;
            shard.z += shard.vz * dt;
            if (shard.z <= 0) {
                shard.z = 0;
                shard.vz = shard.bounces++ === 0 ? -shard.vz * 0.33 : 0;
                shard.vx *= 0.67;
                shard.vy *= 0.67;
                shard.spin *= 0.6;
            }
        }
        shard.angle += shard.spin * dt;
        const friction = Math.exp(-(shard.z ? 0.65 : 4.3) * dt);
        shard.vx *= friction;
        shard.vy *= friction;
        shard.spin *= friction;
        if (!shard.collectible || state.time - shard.bornAt < shardLandingMs || shard.z > 18)
            return true;
        const claim = shardOwners.get(shard);
        let session = null;
        let best = shardPickupReach;
        for (const candidate of participants.values()) {
            const reach = distance(candidate.player, shard);
            if (!candidate.moving || candidate.swing?.target === shard || reach > best) continue;
            if (
                claim?.until > state.time &&
                claim.id !== candidate.id &&
                participants.has(claim.id)
            )
                continue;
            if (session && reach === best) continue;
            session = candidate;
            best = reach;
        }
        if (!session) return true;
        session.bag[shard.ore] += shard.amount;
        session.stats.pickups++;
        mark('collect', shard.x, shard.y, shard.ore, {
            target: { x: session.player.x, y: session.player.y },
            amount: shard.amount,
        });
        return false;
    }
    function stepSwing(session) {
        const active = session.swing;
        if (active && state.time >= active.contactAt && !active.contacted) {
            active.contacted = true;
            const target = active.target;
            if (
                target &&
                !target.ram &&
                !finishers.has(target) &&
                (target.polygon ? state.rocks : state.shards).includes(target)
            ) {
                const spot = targetSpot(session, target);
                if (spot && distance(session.player, spot) <= attackReach)
                    startStrike(session, miningAction(session, target, spot));
            }
        }
        if (active && state.time >= active.endsAt) session.swing = null;
        if (session.pending === null || session.swing) return;
        const requestedAt = session.pending;
        session.pending = null;
        if (state.time - requestedAt > attackBufferMs) return;
        const hit = nearestTarget(session);
        if (hit) aim(session, hit.spot);
        session.swing = {
            at: state.time,
            contactAt: state.time + swingWindupMs,
            endsAt: state.time + swingTotalMs,
            target: hit?.actor ?? null,
            contacted: false,
        };
        mark('swing', session.player.x, session.player.y, pickaxes[session.level].ore ?? 'stone');
    }

    function tick(inputs) {
        state.time = (++simulationTick * 1000) / tickRate;
        const dt = tickMs / 1000;
        refreshChunks();
        releaseFinishers();
        let relocated = false;
        for (const [id, session] of participants) {
            if (!session.player.hp) {
                if (state.time >= session.player.respawnAt)
                    relocated = revive(session) || relocated;
                continue;
            }
            const { x = 0, y = 0, attack = false } = inputs.get(id) ?? {};
            if (attack) session.pending = state.time;
            const moveSeconds = secondsAfterHitstop(state.time, dt, session.player.hitstopUntil);
            if (!moveSeconds) {
                session.moving = false;
                continue;
            }
            advanceImpact(session.player, moveSeconds);
            session.moving = walkPlayer(session, x, y, moveSeconds);
        }
        if (relocated) refreshChunks();
        stepMobs(dt);
        stepCollapses();
        if (impactFractures.length)
            impactFractures = impactFractures.filter(({ session, action, at }) => {
                if (state.time < at) return true;
                applyFracture(session, action);
                return false;
            });
        for (const session of participants.values()) {
            if (!session.player.hp) continue;
            if (
                session.breaking &&
                state.time - session.breaking.at + clockToleranceMs >= crackGrowthMs
            ) {
                applyFracture(session, session.breaking);
                session.breaking = null;
            }
            stepSwing(session);
        }
        state.shards = state.shards.filter((shard) => advanceShard(shard, dt));
        for (const session of participants.values()) tryUpgrade(session);
        for (let i = depleted.length - 1; i >= 0; i--) {
            const { slot, respawnAt } = depleted[i];
            if (
                state.time < respawnAt ||
                (online && !activeChunks.has(slot.chunk)) ||
                Array.from(participants.values()).some(
                    ({ player }) => distance(player, slot) < (slot.boss ? 82 : 65),
                ) ||
                state.rocks.some((rock) => distance(rock, slot) < rock.r + (slot.boss ? 62 : 49))
            )
                continue;
            spawn(slot);
            depleted.splice(i, 1);
        }
        for (const session of participants.values())
            session.target = session.player.hp ? nearestTarget(session) : null;
        state.marks = state.marks.filter((m) => state.time - m.at < 580);
    }
    function visualSwing(swing) {
        if (!swing) return null;
        const { at, contactAt, endsAt, contacted, hitAt, holdUntil } = swing;
        return { at, contactAt, endsAt, contacted, hitAt, holdUntil, rockUid: swing.target?.uid };
    }
    function roundWire(value) {
        return Math.round(value * 100) / 100;
    }
    function wirePoints(points) {
        let rounded = wireGeometry.get(points);
        if (!rounded) {
            rounded = points.map(({ x, y }) => ({ x: roundWire(x), y: roundWire(y) }));
            wireGeometry.set(points, rounded);
        }
        return rounded;
    }
    function wireRock(rock) {
        const {
            uid,
            id,
            lode,
            guardian,
            geometryRevision,
            x,
            y,
            r,
            polygon,
            seam,
            cracks,
            angle,
            boss,
            impact,
            hitstopAt,
            hitstopUntil,
            stage,
            chargeDir,
            chargeDistance,
            heading,
        } = rock;
        return {
            uid,
            id,
            lode,
            guardian,
            geometryRevision,
            x: roundWire(x),
            y: roundWire(y),
            r: roundWire(r),
            polygon: wirePoints(polygon),
            seam: wirePoints(seam),
            cracks,
            angle,
            boss,
            impact,
            hitstopAt,
            hitstopUntil,
            stage,
            chargeDir,
            chargeDistance,
            heading,
            lastHit: Number.isFinite(rock.lastHit) ? rock.lastHit : -100000,
        };
    }
    function wirePlayer(player) {
        return { ...player, hurtAt: Number.isFinite(player.hurtAt) ? player.hurtAt : -100000 };
    }
    function wireActor(actor) {
        if (actor.polygon) return { uid: actor.uid, x: actor.x, y: actor.y };
        return { id: actor.id, x: actor.x, y: actor.y };
    }
    function wireBreaking(breaking) {
        return breaking
            ? {
                  at: breaking.at,
                  target: wireActor(breaking.target),
                  plan: { paths: breaking.plan.paths },
              }
            : null;
    }
    function snapshot(id) {
        const session = participants.get(id);
        if (!session) return null;
        ranking ??= Array.from(participants.values())
            .map(({ id, stats, level }) => ({ id, breaks: stats.kills, level }))
            .sort((a, b) => b.breaks - a.breaks || b.level - a.level)
            .slice(0, 4);
        const near = (object) =>
            Math.abs(object.x - session.player.x) <= 800 &&
            Math.abs(object.y - session.player.y) <= 700;
        const { level, target, breaking, bag, stats, message, player, swing } = session;
        const nearbyPeers = Array.from(participants.values()).filter(
            (other) => other !== session && near(other.player),
        );
        return {
            time: state.time,
            ranking,
            level,
            dash: emptyDash,
            bag,
            message,
            bounds,
            center,
            player: wirePlayer(player),
            stats: { ...stats, slams },
            rocks: state.rocks.filter(near).map(wireRock),
            obstacles: state.obstacles.filter(near),
            shards: state.shards.filter(near),
            marks: state.marks.filter(near),
            target: target ? { actor: wireActor(target.actor), spot: target.spot } : null,
            breaking: wireBreaking(breaking),
            breakingOthers: nearbyPeers
                .filter((other) => other.breaking)
                .map((other) => wireBreaking(other.breaking)),
            swing: visualSwing(swing),
            others: nearbyPeers.map((other) => ({
                ...wirePlayer(other.player),
                id: other.id,
                level: other.level,
                swing: visualSwing(other.swing),
            })),
        };
    }

    if (online) return { join, leave, tick, snapshot, dispose: physics.dispose };

    const soloId = 'solo';
    join(soloId);
    const solo = participants.get(soloId);
    for (const key of ['player', 'level', 'target', 'breaking', 'swing', 'bag', 'message']) {
        Object.defineProperty(state, key, {
            enumerable: true,
            get: () => solo[key],
            set: (value) => {
                solo[key] = value;
            },
        });
    }
    Object.defineProperty(solo.stats, 'slams', { enumerable: true, get: () => slams });
    state.stats = solo.stats;
    const inputs = new Map();
    return {
        state,
        step(input) {
            inputs.set(soloId, input);
            tick(inputs);
        },
        attack() {
            solo.pending = state.time;
        },
        cancelAttack() {
            solo.pending = null;
        },
        dispose: physics.dispose,
    };
}
