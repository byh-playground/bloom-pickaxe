import { regions } from './map-layout.js';

const meadowOres = [
    ['copper-left', 0, -205, 120],
    ['copper', 0, -76, 67, 24, 32],
    ['copper-right', 0, 168, 155],
    ['copper-back', 0, -240, -115],
    ['blue', 1, 122, 28, 42, 60],
    ['blue-flank', 1, 254, -72],
    ['purple', 2, -139, -82],
    ['purple-flank', 2, 162, -150],
];
const bossOres = [
    ['copper-left', 0, -226, 104],
    ['blue', 1, 146, 66, 42, 60],
    ['purple', 2, -143, -50],
    ['purple-flank', 2, 185, -105],
];
const oreGroups = { meadow: meadowOres, boss: bossOres };
export const cameraSpots = {
    meadow: { x: regions.meadow.x, y: regions.meadow.y + 154 },
    boss: { x: 0, y: 126 },
};
const miners = [
    {
        id: 'player',
        name: '나',
        ...cameraSpots.meadow,
        level: 1,
        loot: [5, 2, 1, 0],
        faceX: -0.52,
        faceY: -0.85,
    },
    {
        id: 'friend-1',
        name: '민들레',
        x: regions.meadow.x + 90,
        y: regions.meadow.y + 72,
        level: 2,
        faceX: -0.8,
        faceY: -0.6,
    },
    {
        id: 'friend-2',
        name: '솔방울',
        x: regions.meadow.x - 147,
        y: regions.meadow.y + 10,
        level: 0,
        faceX: 1,
        faceY: 0,
    },
    { id: 'boss-miner', name: '도토리', ...cameraSpots.boss, level: 2, faceX: 0, faceY: -1 },
    { id: 'boss-friend-1', name: '버들', x: 90, y: 72, level: 2, faceX: -0.8, faceY: -0.6 },
    { id: 'boss-friend-2', name: '밤톨', x: -145, y: 10, level: 1, faceX: 1, faceY: 0 },
];
export const hitSamples = {
    meadow: { miner: 'player', x: regions.meadow.x - 76, y: regions.meadow.y + 67, tier: 0 },
    boss: { miner: 'boss-miner', x: regions.boss.x, y: regions.boss.y, tier: 3 },
};

export function createMockState(now, strike = null) {
    const ores = Object.entries(oreGroups).flatMap(([region, rows]) => {
        const origin = regions[region];
        return rows.map(([id, tier, x, y, hp = 32 + tier * 28, maxHp = 32 + tier * 28], index) => {
            const drift = now / 1850 + index * 1.4;
            return {
                id: region + ':' + id,
                tier,
                x: origin.x + x + Math.sin(drift) * 6,
                y: origin.y + y + Math.cos(drift) * 4,
                hp,
                maxHp,
                boss: false,
            };
        });
    });
    ores.push({ id: 'boss', tier: 3, ...regions.boss, hp: 345, maxHp: 480, boss: true });
    const players = miners.map((miner, index) => ({
        ...miner,
        x: miner.x + (index % 3 ? Math.sin(now / 1550 + index) * 12 : 0),
        y: miner.y + (index % 3 ? Math.cos(now / 1550 + index) * 10 : 0),
        swingUntil: strike?.miner === miner.id ? strike.at + 340 : -Infinity,
        online: true,
    }));
    const active = strike && now >= strike.at && now - strike.at < 700;
    return {
        now,
        players,
        ores,
        events: active ? [{ ...strike, id: strike.at, kind: 'hit' }] : [],
        bossNextAt: null,
    };
}
