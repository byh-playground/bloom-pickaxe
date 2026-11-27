import { board, minerals, pickaxes, crackGrowthMs } from './fracture-world.js';
import {
    copperRavineCenter,
    ironRidgeCenter,
    onlineCopperRavineCenter,
    onlineIronRidgeCenter,
    worldCenter,
    worldSector,
} from './fracture-spawn.js';
import {
    expeditionGoldSector,
    goldLodeLocal,
    upperGoldSector,
    upperGoldLocal,
    restCampLocal,
} from './fracture-expedition.js';

const tilt = 0.8;
const TAU = Math.PI * 2;
const turf = { light: '#aac477', deep: '#88ab67', ink: '#425f46' };
const impactShake = {
    cut: 0.66,
    split: 1.65,
    slam: 1.22,
    hurt: 2.1,
    collapse: 1.8,
    bossFall: 2.2,
    goldBurst: 1.4,
};
const finisherCameraHoldMs = 95;
const finisherCameraReturnMs = 160;
const hitstopBlinkFilter = 'brightness(2.12) saturate(0.45)';
const sceneryCell = 174;
const scenerySpan = 92;
const onlineGoldCenter = {
    x: expeditionGoldSector.x * worldSector.width + goldLodeLocal.x,
    y: expeditionGoldSector.y * worldSector.height + goldLodeLocal.y,
};
const upperGoldCenter = {
    x: upperGoldSector.x * worldSector.width + upperGoldLocal.x,
    y: upperGoldSector.y * worldSector.height + upperGoldLocal.y,
};
const onlineRestCamp = {
    x: upperGoldSector.x * worldSector.width + restCampLocal.x,
    y: upperGoldSector.y * worldSector.height + restCampLocal.y,
};
const calderaRadius = 805;
const goldSparkColors = ['#cd8249', '#ffe39d', '#704355', '#fff4b9'];

function expeditionSurface(turned, radius) {
    const image = document.createElement('canvas');
    image.width = Math.ceil(2 * radius * (turned ? tilt : 1) + 24);
    image.height = Math.ceil(2 * radius * (turned ? 1 : tilt) + 24);
    const ox = image.width / 2;
    const oy = image.height / 2;
    const art = image.getContext('2d');
    art.translate(ox, oy);
    art.scale(turned ? tilt : 1, turned ? 1 : tilt);
    if (turned) art.rotate(-Math.PI / 2);
    art.lineCap = 'round';
    art.lineJoin = 'round';
    return { art, image, ox, oy };
}

function ringPoints(radius, count, offset = 0, wobble = 0) {
    return Array.from({ length: count }, (_, i) => {
        const angle = offset + (i * TAU) / count;
        const edge = radius * (1 - (wobble * ((i * 7 + 2) % 9)) / 8);
        return { x: Math.cos(angle) * edge, y: Math.sin(angle) * edge };
    });
}

function facetSpire(art, x, y, span, height, colors) {
    const foot = { x: x - span, y: y + span * 0.27 };
    const right = { x: x + span, y };
    const peak = { x: x + span * 0.24, y: y - height };
    const ridge = { x: x - span * 0.12, y: y - height * 0.2 };
    const base = { x: x + span * 0.32, y: y + span * 0.45 };
    ellipse(art, x + span * 0.45, y + span * 0.16, span * 1.65, span * 0.55, '#29243e54');
    art.lineWidth = 2.2;
    polygon(art, [foot, peak, right, base], colors[0], colors[2]);
    polygon(art, [foot, peak, ridge, base], colors[1]);
    line(art, [peak, ridge], colors[3], 1.9);
}

function bakeGoldFloor(turned, upper) {
    const radius = upper ? 278 : 258;
    const surface = expeditionSurface(turned, radius);
    const { art } = surface;
    polygon(art, ringPoints(radius, 16, 0.12, 0.09), upper ? '#50645d' : '#614a3c');
    polygon(art, ringPoints(radius - 12, 16, 0.12, 0.09), upper ? '#70958b' : '#9c7048');
    if (upper) {
        for (const [r, fill, edge] of [
            [223, '#8fb5a1', '#5c837b'],
            [171, '#adc4a1', '#73998a'],
            [102, '#c0c9a1', '#91ae98'],
        ]) {
            art.lineWidth = 4;
            polygon(art, ringPoints(r, 10, 0.24, 0.13), fill, edge);
        }
        for (const { x, y } of ringPoints(radius - 45, 13, 0.15, 0.16)) {
            const vein = [
                { x: x * 0.45, y: y * 0.45 },
                { x: x * 0.67 + 18, y: y * 0.71 },
                { x, y },
            ];
            line(art, vein, '#f6df9c', 5);
            line(art, vein, '#fff0b9', 2);
            facetSpire(art, x, y, 15, 38, ['#579997', '#aed9bd', '#436760', '#eaf4c4']);
        }
    } else {
        for (const { x, y } of ringPoints(radius - 20, 13, 0.1, 0.1)) {
            const vein = [
                { x: x * 0.13, y: y * 0.13 },
                { x: x * 0.45 - 18, y: y * 0.45 },
                { x: x * 0.62 + 21, y: y * 0.66 },
                { x: x * 0.77 - 12, y: y * 0.72 },
                { x, y },
            ];
            line(art, vein, '#664632', 12);
            line(art, vein, '#e3a452', 4);
            line(art, vein, '#ffd184', 1.4);
            facetSpire(art, x, y, 15, 20, ['#a36e42', '#d09c59', '#6b4736', '#e1b56f']);
        }
    }
    return surface;
}

function bakeCaldera(turned) {
    const surface = expeditionSurface(turned, calderaRadius);
    const { art } = surface;
    for (const [radius, shade] of [
        [805, '#554461'],
        [785, '#373042'],
        [733, '#463550'],
        [620, '#4e3c65'],
        [455, '#3d3858'],
        [333, '#584766'],
        [306, '#504365'],
        [220, '#5c4e70'],
    ]) {
        polygon(art, ringPoints(radius, 22, 0.06, 0.09), shade);
    }
    for (const [i, { x, y }] of ringPoints(760, 15, 0.2, 0.13).entries()) {
        const inner = 0.37 + (i % 3) * 0.052;
        const fissure = [
            { x: x * inner, y: y * inner },
            { x: x * 0.57 + 26, y: y * 0.59 },
            { x: x * 0.66 - 18, y: y * 0.71 },
            { x: x * 0.87 + 26, y: y * 0.82 },
            { x, y },
        ];
        const cold = i % 3 !== 0;
        line(art, fissure, '#272136', 24);
        line(art, fissure, cold ? '#635c9c' : '#7b406c', 15);
        line(art, fissure, cold ? '#74cbdd' : '#d478a3', 5);
        line(art, fissure, cold ? '#ccf4ed' : '#f6b4bb', 1.6);
        line(
            art,
            [
                fissure[2],
                { x: x * 0.78 - 57, y: y * 0.77 + 45 },
                { x: x * 0.91 - 67, y: y * 0.88 + 57 },
            ],
            cold ? '#628aaa' : '#a25886',
            3,
        );
    }
    art.lineWidth = 4;
    polygon(art, ringPoints(303, 22, 0.06, 0.09), null, '#c6a9db70');
    art.lineWidth = 2;
    polygon(art, ringPoints(284, 22, 0.06, 0.09), null, '#b5cbeb48');
    for (const { x, y } of ringPoints(286, 11, 0.2, 0.05)) {
        polygon(
            art,
            [
                { x: x * 0.94, y: y * 0.94 },
                { x: x - y * 0.034, y: y + x * 0.034 },
                { x: x * 1.04, y: y * 1.04 },
                { x: x + y * 0.034, y: y - x * 0.034 },
            ],
            '#b7a5dc',
        );
    }
    const blue = ['#5866b4', '#8dd9e1', '#322d52', '#d6fcf6'];
    const purple = ['#79549d', '#ba8dc8', '#36283d', '#edc5ed'];
    const spires = ringPoints(419, 11, 0.32, 0.2).concat(ringPoints(644, 13, 0.16, 0.12));
    // Sort once so the crystals facing the camera overlap the farther crystals.
    spires.sort((a, b) => (turned ? b.x - a.x : a.y - b.y));
    for (const [i, { x, y }] of spires.entries()) {
        art.save();
        art.translate(x, y);
        if (turned) art.rotate(Math.PI / 2);
        const span = 12 + (i % 4) * 3;
        facetSpire(art, -span * 0.86, 8, span * 0.65, 31, purple);
        facetSpire(art, 0, 0, span * 1.2, 64 + (i % 5) * 9, i % 3 === 1 ? purple : blue);
        facetSpire(art, span * 1.12, 12, span * 0.72, 36 + (i % 3) * 7, blue);
        art.restore();
    }
    return surface;
}

function bakeRestCamp(turned) {
    const surface = expeditionSurface(turned, 100);
    const { art } = surface;
    polygon(art, ringPoints(90, 10, 0.1, 0.11), '#617565');
    polygon(art, ringPoints(78, 10, 0.1, 0.11), '#859e80');
    polygon(art, ringPoints(63, 8, 0.4), '#bbc393', '#657962');
    for (const { x, y } of ringPoints(65, 6, 0.46)) {
        art.save();
        art.translate(x, y);
        if (turned) art.rotate(Math.PI / 2);
        facetSpire(art, 0, 0, 10, 22, ['#5d8e7c', '#b3d59c', '#4e6b63', '#edffcf']);
        art.restore();
    }
    return surface;
}

function bakeScenery() {
    const image = document.createElement('canvas');
    image.width = scenerySpan * 4;
    image.height = scenerySpan;
    const art = image.getContext('2d');
    art.lineWidth = 1.7;
    art.lineJoin = 'round';
    art.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
        art.save();
        art.translate(i * scenerySpan + 46, 71);
        ellipse(art, 4, 3, 29, 10, '#334d3940');
        if (i < 2) {
            for (const [x, scale] of i
                ? [
                      [-13, 0.66],
                      [13, 0.83],
                  ]
                : [
                      [-6, 1],
                      [18, 0.55],
                  ]) {
                art.save();
                art.translate(x, 0);
                art.scale(scale, scale);
                polygon(
                    art,
                    [
                        { x: -5, y: 0 },
                        { x: -4, y: -29 },
                        { x: 4, y: -29 },
                        { x: 5, y: 0 },
                    ],
                    '#866047',
                    '#4c513b',
                );
                const tree = [
                    { x: 0, y: -68 },
                    { x: 16, y: -46 },
                    { x: 10, y: -45 },
                    { x: 23, y: -27 },
                    { x: 15, y: -26 },
                    { x: 26, y: -11 },
                    { x: 10, y: -7 },
                    { x: -9, y: -7 },
                    { x: -26, y: -12 },
                    { x: -16, y: -27 },
                    { x: -23, y: -26 },
                    { x: -10, y: -43 },
                    { x: -16, y: -44 },
                ];
                polygon(art, tree, '#3f735c', '#34594c');
                polygon(
                    art,
                    [
                        tree[0],
                        tree[12],
                        tree[11],
                        tree[10],
                        tree[9],
                        tree[8],
                        tree[7],
                        { x: -3, y: -48 },
                    ],
                    '#5d9067',
                );
                line(
                    art,
                    [
                        { x: -8, y: -22 },
                        { x: 0, y: -25 },
                        { x: 9, y: -22 },
                    ],
                    '#89aa6b',
                    1.8,
                );
                art.restore();
            }
        } else if (i === 2) {
            for (const [x, y, r] of [
                [-18, -10, 12],
                [0, -17, 17],
                [17, -9, 12],
            ]) {
                ellipse(art, x, y, r, r * 0.75, '#56845b', '#486d53');
                ellipse(art, x - 3, y - 4, r * 0.63, r * 0.45, '#73a265');
            }
            for (const [x, y] of [
                [-21, -14],
                [-6, -24],
                [4, -17],
                [17, -12],
                [8, -7],
            ]) {
                ellipse(art, x, y, 2.1, 1.8, '#f0c875', '#ab8055');
            }
        } else {
            for (const [x, y, r] of [
                [-16, -4, 13],
                [1, -12, 16],
                [21, -4, 9],
            ]) {
                polygon(
                    art,
                    [
                        { x: x - r, y: y + 2 },
                        { x: x - r * 0.55, y: y - r * 0.62 },
                        { x: x + r * 0.27, y: y - r * 0.75 },
                        { x: x + r, y: y + 1 },
                        { x: x + r * 0.51, y: y + 6 },
                    ],
                    '#797f77',
                    '#52665b',
                );
                line(
                    art,
                    [
                        { x: x - r * 0.5, y: y - r * 0.5 },
                        { x: x + r * 0.22, y: y - r * 0.63 },
                        { x: x + r * 0.59, y: y - r * 0.25 },
                    ],
                    '#aeb5a0',
                    2.1,
                );
            }
        }
        art.restore();
    }
    return image;
}

function bakeIronRidge(turned) {
    const image = document.createElement('canvas');
    image.width = turned ? 418 : 548;
    image.height = turned ? 548 : 385;
    const ox = image.width / 2;
    const oy = image.height / 2;
    const art = image.getContext('2d');
    art.lineCap = 'round';
    art.lineJoin = 'round';
    const p = (x, y) =>
        turned ? { x: ox + y * tilt, y: oy - x } : { x: ox + x, y: oy + y * tilt };
    const path = (points) => points.map(([x, y]) => p(x, y));
    line(
        art,
        path([
            [-210, -208],
            [-99, -140],
            [-55, -84],
            [29, 27],
            [122, 78],
            [179, 123],
        ]),
        '#a9ac91',
        36,
    );
    line(
        art,
        path([
            [-211, -211],
            [-99, -143],
            [-53, -85],
            [31, 23],
            [122, 78],
            [179, 123],
        ]),
        '#c2bc9c',
        15,
    );
    const shelf = [
        [-239, -54],
        [-192, -107],
        [-109, -97],
        [-61, -142],
        [31, -140],
        [113, -110],
        [176, -120],
        [235, -77],
        [250, -21],
        [188, 22],
        [160, 94],
        [78, 133],
        [25, 108],
        [-66, 143],
        [-141, 107],
        [-193, 50],
        [-229, 21],
    ];
    polygon(art, path(shelf), '#617678');
    polygon(art, path(shelf.map(([x, y]) => [x * 0.9, y * 0.88])), '#8da6a4');
    polygon(
        art,
        path([
            [-214, -38],
            [-163, -89],
            [-108, -80],
            [-61, -121],
            [38, -111],
            [110, -82],
            [188, -87],
            [219, -64],
            [174, -37],
            [92, -55],
            [44, -28],
            [-31, -45],
            [-112, -22],
            [-172, -32],
        ]),
        '#b5c8ba',
    );
    polygon(
        art,
        path([
            [-156, 42],
            [-73, 17],
            [6, 34],
            [59, 6],
            [131, 28],
            [194, -16],
            [161, 72],
            [89, 113],
            [23, 87],
            [-64, 113],
            [-111, 80],
        ]),
        '#789399',
    );
    for (const vein of [
        [
            [-205, -1],
            [-128, -42],
            [-57, -17],
            [25, -63],
            [102, -34],
            [167, -52],
        ],
        [
            [-158, 61],
            [-84, 31],
            [-18, 51],
            [62, 15],
            [136, 38],
            [187, 9],
        ],
        [
            [-95, 97],
            [-38, 72],
            [25, 86],
            [78, 64],
            [127, 63],
        ],
    ]) {
        line(art, path(vein), '#58767c', 6);
        line(art, path(vein.map(([x, y]) => [x, y - 3])), '#d0dcca', 2.5);
    }
    const random = seeded(0x1a0d23);
    for (let i = 0; i < 75; i++) {
        const a = random() * TAU,
            radius = Math.sqrt(random()),
            q = p(Math.cos(a) * radius * 207, Math.sin(a) * radius * 106);
        line(
            art,
            [q, { x: q.x + 2 + random() * 5, y: q.y - 1 }],
            i % 3 ? '#68899188' : '#dbe0c998',
            1.6,
        );
    }
    return { image, ox, oy };
}
const ravineOutline = [
    [-251, -47],
    [-222, -101],
    [-160, -122],
    [-105, -107],
    [-46, -142],
    [35, -128],
    [104, -148],
    [177, -123],
    [242, -94],
    [266, -24],
    [222, 27],
    [237, 70],
    [171, 105],
    [100, 94],
    [55, 126],
    [-22, 109],
    [-68, 139],
    [-132, 128],
    [-192, 98],
    [-241, 64],
];

function bakeCopperRavine(turned) {
    const image = document.createElement('canvas');
    image.width = turned ? 486 : 560;
    image.height = turned ? 560 : 420;
    const ox = image.width / 2;
    const oy = turned ? image.height / 2 : 160;
    const art = image.getContext('2d');
    art.lineCap = 'round';
    art.lineJoin = 'round';
    const p = (x, y, z = 0) =>
        turned ? { x: ox + y * tilt, y: oy - x - z } : { x: ox + x, y: oy + y * tilt - z };
    const path = (points, scale = 1) => points.map(([x, y]) => p(x * scale, y * scale));
    const a = p(-200, -100);
    const b = p(260, 90);
    const strata = art.createLinearGradient(a.x, a.y, b.x, b.y);
    strata.addColorStop(0, '#624d50');
    strata.addColorStop(0.28, '#92705e');
    strata.addColorStop(0.67, '#b58265');
    strata.addColorStop(1, '#a06a56');

    polygon(
        art,
        path([
            [-112, 270],
            [-84, 183],
            [-34, 107],
            [45, 98],
            [18, 159],
            [-37, 205],
            [-63, 273],
        ]),
        '#b9a478',
    );
    line(
        art,
        path([
            [-89, 263],
            [-66, 197],
            [-15, 135],
            [12, 113],
        ]),
        '#d2bc84',
        15,
    );
    polygon(art, path(ravineOutline), '#647562');
    polygon(art, path(ravineOutline, 0.94), '#67666b');
    polygon(art, path(ravineOutline, 0.84), strata);
    line(
        art,
        path([
            [-234, 59],
            [-171, 92],
            [-130, 105],
            [-71, 116],
            [-18, 88],
        ]),
        '#d0a274',
        4,
    );
    line(
        art,
        path([
            [51, 106],
            [102, 78],
            [171, 87],
            [218, 60],
        ]),
        '#d0a274',
        5,
    );

    const strataLines = [
        [
            [-215, -29],
            [-161, -68],
            [-101, -73],
            [-48, -110],
            [12, -100],
            [53, -122],
        ],
        [
            [-165, 44],
            [-105, 29],
            [-52, 48],
            [3, 26],
            [58, 40],
            [131, 7],
            [203, 19],
        ],
        [
            [-66, 91],
            [-28, 60],
            [29, 63],
            [73, 43],
            [130, 51],
            [175, 38],
        ],
        [
            [12, -57],
            [62, -68],
            [114, -47],
            [169, -66],
            [220, -46],
        ],
    ];
    for (const seam of strataLines) {
        line(art, path(seam), '#684c52', 7);
        line(art, path(seam.map(([x, y]) => [x, y - 3])), '#dbad79', 2.4);
    }
    const rng = seeded(0xc097e2);
    for (let i = 0; i < 90; i++) {
        const t = rng() * TAU;
        const r = Math.sqrt(rng()) * 0.84;
        const x = Math.cos(t) * r * 244;
        const y = Math.sin(t) * r * 126;
        const size = 1 + rng() * 4;
        const q = p(x, y);
        polygon(
            art,
            [
                { x: q.x - size, y: q.y },
                { x: q.x + size * 0.7, y: q.y - size * 0.55 },
                { x: q.x + size, y: q.y + size * 0.45 },
            ],
            i % 4 ? '#6a545766' : '#e7bd8894',
        );
    }

    const clusters = [
        [-188, -54, 1.3],
        [-126, -82, 1.1],
        [-32, -92, 0.85],
        [76, -97, 1.15],
        [163, -75, 0.92],
        [221, -56, 0.8],
        [-158, 74, 0.84],
        [89, 62, 0.92],
        [191, 54, 1.15],
    ];
    for (const [x, y, size] of clusters) {
        const q = p(x, y);
        ellipse(art, q.x + 6, q.y + 4, 19 * size, 8 * size, '#4d4c57a6');
        for (const [dx, rise] of [
            [-10, 15],
            [0, 25],
            [10, 17],
        ]) {
            const base = q.x + dx * size;
            const top = q.y - rise * size;
            const left = { x: base - 7 * size, y: q.y };
            const tip = { x: base + 2 * size, y: top };
            const right = { x: base + 7 * size, y: q.y - 1 };
            const crease = { x: base + 2 * size, y: q.y + 2 * size };
            polygon(art, [left, tip, right, crease], '#506e68', '#514854');
            polygon(art, [left, tip, crease], '#78a08e');
            line(art, [left, tip], '#b3c9a0', 1.2);
        }
    }
    return { image, ox, oy };
}

function hitstopBlink(time, actor) {
    const start = actor.blinkAt ?? actor.hitstopAt;
    const until = actor.blinkUntil ?? actor.hitstopUntil;
    const age = time - start;
    return (
        age >= 0 && time < until && (age < 36 || (until - start > 100 && age >= 74 && age < 115))
    );
}
function ellipse(ctx, x, y, rx, ry, fill, stroke) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
    if (fill) {
        ctx.fillStyle = fill;
        ctx.fill();
    }
    if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.stroke();
    }
}
function polygon(ctx, points, fill, stroke) {
    if (!points.length) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.closePath();
    if (fill) {
        ctx.fillStyle = fill;
        ctx.fill();
    }
    if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.stroke();
    }
}
function line(ctx, points, color, width) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
}
function label(ctx, text, x, y, size, color = '#fff6db') {
    ctx.font = `900 ${size}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#344d36';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
}
function stoneWalls(ctx, scope) {
    const { w, h } = scope;
    ctx.fillStyle = '#557550';
    ctx.fillRect(0, 0, w, h + 15);
    const grass = ctx.createLinearGradient(0, 0, w, h);
    grass.addColorStop(0, turf.light);
    grass.addColorStop(1, turf.deep);
    ctx.fillStyle = grass;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#60815a';
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, w - 3, h - 3);
    for (const y of [2, h - 2]) {
        for (let x = 8; x < w - 3; x += 19)
            ellipse(ctx, x, y, 8, 3.7, x % 3 ? '#b6af7d' : '#a6a077');
    }
    for (const x of [2, w - 2]) {
        for (let y = 8; y < h - 3; y += 17) ellipse(ctx, x, y, 4, 7, y % 3 ? '#b5ae7d' : '#9d9b70');
    }
}
let marksSeed = 1729;
function random() {
    marksSeed = (Math.imul(marksSeed, 1664525) + 1013904223) >>> 0;
    return marksSeed / 4294967296;
}
const marks = Array.from({ length: 275 }, () => ({
    x: 15 + random() * (board.width - 30),
    y: 18 + random() * (board.height - 36),
    kind: random(),
    r: 2 + random() * 4,
}));

/* ───── 암석 재질 ───── */
const FACE_Z = 13;
const rockCapScale = 0.5;
const LIGHT = { x: -0.55, y: -0.83 }; // 왼쪽 위에서 오는 빛(월드 방향)
function hex(c) {
    const n = parseInt(c.slice(1, 7), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(a, b, t) {
    const A = hex(a),
        B = hex(b);
    const c = A.map((v, i) => Math.round(v + (B[i] - v) * t));
    return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}
function stonePalette(base, mineral) {
    return {
        cap: mix(base, '#fbf3df', 0.32),
        lit: mix(base, '#fff6e0', 0.2),
        mid: base,
        shade: mix(base, '#2f3a33', 0.28),
        deep: mix(base, '#1f2925', 0.48),
        line: mix(base, '#1d221f', 0.62),
        cut: mix(mix(base, '#3a302c', 0.5), mineral?.dark ?? base, 0.25),
        cutDeep: mix(base, '#231c1a', 0.66),
        grain: mineral ? mix(mineral.light, '#fffaf0', 0.25) : '#e9e1cf',
        vein: mineral?.color ?? base,
        veinLight: mineral?.light ?? '#ffffff',
        veinDark: mineral?.dark ?? base,
    };
}
const STONE = {
    ...Object.fromEntries(
        Object.entries(minerals).map(([id, ore]) => [id, stonePalette(ore.shell, ore)]),
    ),
    plain: stonePalette('#8d907f', null),
};
const guardianPalette = stonePalette('#766867', {
    color: '#d98b54',
    light: '#ffe698',
    dark: '#935441',
});
function seeded(seed) {
    let s = seed >>> 0 || 1;
    return () => {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        return s / 4294967296;
    };
}
function hashText(text) {
    let h = 2166136261;
    for (const ch of String(text)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    return h >>> 0;
}
function hashPoint(x, y) {
    return (Math.imul(Math.round(x * 4), 73856093) ^ Math.imul(Math.round(y * 4), 19349663)) >>> 0;
}
function centerOf(points) {
    // 면적 중심(폴리곤이 길쭉해도 돔 꼭대기가 안쪽에 오도록)
    let a = 0,
        cx = 0,
        cy = 0;
    for (let i = 0; i < points.length; i++) {
        const p = points[i],
            q = points[(i + 1) % points.length];
        const f = p.x * q.y - q.x * p.y;
        a += f;
        cx += (p.x + q.x) * f;
        cy += (p.y + q.y) * f;
    }
    if (Math.abs(a) < 1e-6)
        return points.reduce(
            (m, p) => ({
                x: m.x + p.x / points.length,
                y: m.y + p.y / points.length,
            }),
            { x: 0, y: 0 },
        );
    return { x: cx / (3 * a), y: cy / (3 * a) };
}
function areaOf(points) {
    let s = 0;
    for (let i = 0; i < points.length; i++) {
        const p = points[i],
            q = points[(i + 1) % points.length];
        s += p.x * q.y - q.x * p.y;
    }
    return Math.abs(s) / 2;
}
function inside(points, p) {
    let hit = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const a = points[i],
            b = points[j];
        if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x)
            hit = !hit;
    }
    return hit;
}
function interiorClearance(points, p) {
    if (!inside(points, p)) return 0;
    let nearest = Infinity;
    for (let i = 0; i < points.length; i++) {
        const a = points[i],
            b = points[(i + 1) % points.length];
        const dx = b.x - a.x,
            dy = b.y - a.y;
        const t = Math.max(
            0,
            Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)),
        );
        nearest = Math.min(nearest, Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy));
    }
    return nearest;
}
function outwardNormal(a, b, c) {
    // 변 a→b의 바깥 법선(중심 c 반대쪽)
    let nx = b.y - a.y,
        ny = a.x - b.x;
    const len = Math.hypot(nx, ny) || 1;
    nx /= len;
    ny /= len;
    const mx = (a.x + b.x) / 2 - c.x,
        my = (a.y + b.y) / 2 - c.y;
    if (nx * mx + ny * my < 0) {
        nx = -nx;
        ny = -ny;
    }
    return { x: nx, y: ny };
}

export function createFractureView(canvas, touchControls) {
    const mainContext = canvas.getContext('2d', { alpha: false });
    let ctx = mainContext;
    const faceMemory = new WeakMap();
    const rockAnimationClocks = new WeakMap();
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let layout = null;
    let viewport = null;
    let viewportDirty = true;
    const backingScales = [1, 0.85, 0.72];
    let qualityLevel = 0;
    let slowFrames = 0;
    let steadyFrames = 0;
    let lastDrawAt;
    let nextQualityChange = 0;
    const invalidateViewport = () => (viewportDirty = true);
    const resizeObserver = new ResizeObserver(invalidateViewport);
    resizeObserver.observe(canvas);
    if (touchControls) resizeObserver.observe(touchControls);
    window.addEventListener('resize', invalidateViewport);

    function measureViewport(dpr) {
        const b = canvas.getBoundingClientRect();
        const w = Math.max(1, b.width),
            h = Math.max(1, b.height);
        if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
            canvas.width = Math.round(w * dpr);
            canvas.height = Math.round(h * dpr);
        }
        const turned = w < 500 && h > w;
        const worldW = turned ? board.height * tilt : board.width;
        const worldH = turned ? board.width : board.height * tilt;
        const top = w < 540 ? 130 : 82;
        const controls = touchControls?.getBoundingClientRect();
        const bottom = controls?.height && h > w ? b.bottom - controls.top + 8 : w < 540 ? 164 : 90;
        const availableH = Math.max(160, h - top - bottom);
        const scale = Math.max(0.2, Math.min((w - 24) / worldW, availableH / worldH, 1.35));
        viewport = { w, h, dpr, turned, worldW, worldH, top, availableH, scale };
        viewportDirty = false;
    }

    function canvasDpr() {
        return Math.max(0.75, Math.min(2, devicePixelRatio || 1) * backingScales[qualityLevel]);
    }

    function measure(state) {
        const dpr = canvasDpr();
        if (viewportDirty || viewport?.dpr !== dpr) measureViewport(dpr);
        const { w, h, turned, worldW, worldH, top, availableH, scale: baseScale } = viewport;
        const bounds = state.bounds ?? board;
        const scale = state.bounds && w >= 900 && h >= 540 ? baseScale * 1.26 : baseScale;
        const { player } = state;
        const origin = player.impact?.origin;
        const recoilAge = state.time - (player.impact?.at ?? -Infinity);
        const lag =
            origin && recoilAge >= 0
                ? Math.max(
                      0,
                      1 - Math.max(0, recoilAge - finisherCameraHoldMs) / finisherCameraReturnMs,
                  ) ** 2
                : 0;
        const x = lag ? player.x + (origin.x - player.x) * lag : player.x;
        const y = lag ? player.y + (origin.y - player.y) * lag : player.y;
        const cameraX = turned ? y * tilt : x;
        const cameraY = turned ? bounds.width - x : y * tilt;
        layout = {
            ...viewport,
            scale,
            bounds,
            ox: state.bounds ? w / 2 - cameraX * scale : (w - worldW * scale) / 2,
            oy: state.bounds
                ? top + availableH / 2 - cameraY * scale
                : top + (availableH - worldH * scale) / 2,
        };
    }

    function updateQuality(now) {
        const elapsed = now - lastDrawAt;
        lastDrawAt = now;
        if (!Number.isFinite(elapsed) || elapsed > 100) {
            slowFrames = 0;
            steadyFrames = 0;
            return;
        }
        slowFrames = elapsed > 20 ? slowFrames + 1 : Math.max(0, slowFrames - 0.25);
        steadyFrames = elapsed <= 17.8 ? steadyFrames + 1 : 0;
        if (now < nextQualityChange) return;
        if (slowFrames >= 10 && qualityLevel < backingScales.length - 1) qualityLevel++;
        else if (steadyFrames >= 150 && qualityLevel > 0) qualityLevel--;
        else return;
        slowFrames = 0;
        steadyFrames = 0;
        nextQualityChange = now + 1500;
    }
    function project(a, z = 0) {
        return layout.turned
            ? { x: a.y * tilt, y: layout.bounds.width - a.x - z }
            : { x: a.x, y: a.y * tilt - z };
    }
    function screenDirection(vector) {
        const v = vector ?? { x: 1, y: 0 };
        const x = layout.turned ? v.y * tilt : v.x;
        const y = layout.turned ? -v.x : v.y * tilt;
        const length = Math.hypot(x, y);
        return length > 0 ? { x: x / length, y: y / length } : { x: 1, y: 0 };
    }
    function recoil(impact, time, amplitude) {
        const t = impact ? (time - impact.at) / 145 : 1;
        if (t < 0 || t >= 1) return { x: 0, y: 0 };
        const axis = screenDirection(impact);
        const amount = Math.cos(t * Math.PI * 1.85) * (1 - t) ** 2 * (impact.strength ?? 1);
        return { x: axis.x * amount * amplitude, y: axis.y * amount * amplitude };
    }
    function shakeCamera(state) {
        if (reducedMotion.matches) return;
        let x = 0,
            y = 0;
        for (const mark of state.marks) {
            const age = state.time - mark.at;
            if (
                age < 0 ||
                age >= 150 ||
                Math.hypot(state.player.x - mark.x, state.player.y - mark.y) > 130
            )
                continue;
            const power = impactShake[mark.kind];
            if (!power) continue;
            const direction = screenDirection(mark.direction);
            const beat = Math.cos(age * 0.058) * (1 - age / 150) ** 2;
            const amplitude = Math.min(2.5, power * (mark.strength ?? 1)) * beat;
            x += direction.x * amplitude;
            y += direction.y * amplitude;
        }
        layout.ox += Math.max(-2.5, Math.min(2.5, x));
        layout.oy += Math.max(-2.5, Math.min(2.5, y));
    }
    function paintCracks(paths, map, progress, palette, active, armed = false) {
        for (const path of paths) {
            const points = path.map(map);
            const lengths = points
                .slice(1)
                .map((p, i) => Math.hypot(p.x - points[i].x, p.y - points[i].y));
            let remaining = lengths.reduce((sum, length) => sum + length, 0) * progress;
            const shown = [points[0]];
            for (let i = 0; i < lengths.length && remaining > 0; i++) {
                const a = points[i],
                    b = points[i + 1];
                const t = Math.min(1, remaining / (lengths[i] || 1));
                shown.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
                remaining -= lengths[i];
            }
            if (shown.length < 2) continue;
            line(ctx, shown, palette.cutDeep, armed ? 5 : 3);
            if (armed) line(ctx, shown, '#ffde82', 2.2);
            else if (active) line(ctx, shown, palette.veinLight, 1.1);
        }
    }
    function fractureDetail(target, state, palette, map) {
        for (const crack of target.cracks ?? [])
            paintCracks(crack.paths, map, 1, palette, false, crack.armed === true);
        const breaking =
            state.breaking?.target === target
                ? state.breaking
                : state.breakingOthers?.find((entry) => entry.target === target);
        if (breaking) {
            const { at, plan } = breaking;
            paintCracks(plan.paths, map, (state.time - at) / crackGrowthMs, palette, true);
        }
    }
    function basePaint() {
        stoneWalls(ctx, { w: layout.worldW, h: layout.worldH });
        const a = project({ x: 375, y: 190 }),
            b = project({ x: 530, y: 440 });
        ellipse(ctx, a.x, a.y, layout.turned ? 105 : 310, layout.turned ? 270 : 95, '#c4bf8059');
        ellipse(ctx, b.x, b.y, layout.turned ? 113 : 227, layout.turned ? 220 : 123, '#e1ca8c4a');
        for (const m of marks) {
            const p = project(m);
            if (m.kind < 0.48) ellipse(ctx, p.x, p.y, m.r, m.r * 0.32, '#57765044');
            else if (m.kind < 0.88)
                line(
                    ctx,
                    [
                        { x: p.x - 3, y: p.y - 2 },
                        { x: p.x, y: p.y },
                        { x: p.x + 2, y: p.y - 6 },
                    ],
                    '#52724b6e',
                    1.2,
                );
            else {
                ellipse(ctx, p.x - 2, p.y, 2, 1.5, '#fff1c8');
                ellipse(ctx, p.x + 2, p.y, 2, 1.5, '#fff1c8');
                ellipse(ctx, p.x, p.y - 2, 1.5, 2, '#faedd8');
            }
        }
    }
    const groundCells = 8;
    const groundCellSize = 40;
    const groundTileSpan = groundCells * groundCellSize;
    const groundMargin = 8;
    const groundTiles = new Map();
    let groundTileLayout = '';

    function groundTile(col, row, bounds, density, limit) {
        const key = col + ':' + row;
        const cached = groundTiles.get(key);
        if (cached) {
            groundTiles.delete(key);
            groundTiles.set(key, cached);
            return cached;
        }
        const x0 = col * groundTileSpan;
        const y0 = row * groundTileSpan;
        const start = layout.turned
            ? project({ x: x0 + groundTileSpan, y: y0 })
            : project({ x: x0, y: y0 });
        const width = (layout.turned ? tilt : 1) * groundTileSpan + groundMargin * 2;
        const height = (layout.turned ? 1 : tilt) * groundTileSpan + groundMargin * 2;
        const tile = document.createElement('canvas');
        tile.width = Math.ceil(width * density);
        tile.height = Math.ceil(height * density);
        const tileCtx = tile.getContext('2d');
        tileCtx.scale(tile.width / width, tile.height / height);
        tileCtx.lineCap = 'round';
        tileCtx.lineJoin = 'round';
        for (let dy = 0; dy < groundCells; dy++) {
            for (let dx = 0; dx < groundCells; dx++) {
                const hash = hashPoint((col * groundCells + dx) * 5, (row * groundCells + dy) * 5);
                const x = x0 + dx * groundCellSize + (hash & 31) + 3;
                const y = y0 + dy * groundCellSize + ((hash >>> 5) & 31) + 3;
                if (x > bounds.width || y > bounds.height) continue;
                const p = project({ x, y });
                p.x += groundMargin - start.x;
                p.y += groundMargin - start.y;
                const kind = (hash >>> 10) % 16;
                if (kind < 2) {
                    ellipse(tileCtx, p.x, p.y, 17 + (hash % 7), 9, '#8da55c47');
                    line(
                        tileCtx,
                        [
                            { x: p.x - 2, y: p.y + 2 },
                            { x: p.x - 6, y: p.y - 5 },
                        ],
                        '#d4b972',
                        1.7,
                    );
                    line(
                        tileCtx,
                        [
                            { x: p.x + 1, y: p.y + 2 },
                            { x: p.x + 4, y: p.y - 6 },
                        ],
                        '#e0cc87',
                        1.7,
                    );
                } else if (kind < 7) {
                    ellipse(tileCtx, p.x, p.y, 3 + (hash % 3), 1.6, '#55794c3b');
                } else if (kind < 13) {
                    line(
                        tileCtx,
                        [{ x: p.x - 2, y: p.y - 3 }, p, { x: p.x + 2, y: p.y - 4 }],
                        '#52764b64',
                        1.2,
                    );
                } else {
                    ellipse(tileCtx, p.x - 1.6, p.y, 1.7, 1.1, '#f7efc2');
                    ellipse(tileCtx, p.x + 1.6, p.y - 0.8, 1.7, 1.1, '#f7efc2');
                }
            }
        }
        const item = {
            image: tile,
            x: start.x - groundMargin,
            y: start.y - groundMargin,
            width,
            height,
        };
        while (groundTiles.size >= limit) groundTiles.delete(groundTiles.keys().next().value);
        groundTiles.set(key, item);
        return item;
    }

    function paintOnlineGround(state) {
        const { w, h, scale, ox, oy, turned, bounds } = layout;
        const u0 = -ox / scale;
        const v0 = -oy / scale;
        const u1 = (w - ox) / scale;
        const v1 = (h - oy) / scale;
        const width = turned ? bounds.height * tilt : bounds.width;
        const height = turned ? bounds.width : bounds.height * tilt;
        const center = project(state.center ?? { x: bounds.width / 2, y: bounds.height / 2 });
        const range = Math.max(width, height) * 0.52;
        const grass = ctx.createRadialGradient(center.x, center.y, 30, center.x, center.y, range);
        grass.addColorStop(0, '#a7a779');
        grass.addColorStop(0.22, '#aabf79');
        grass.addColorStop(0.66, '#a1c077');
        grass.addColorStop(1, '#91b06b');
        ctx.fillStyle = grass;
        const left = Math.max(0, u0);
        const top = Math.max(0, v0);
        const right = Math.min(width, u1);
        const bottom = Math.min(height, v1);
        ctx.fillRect(left, top, right - left, bottom - top);
        ctx.strokeStyle = '#5a7e58';
        ctx.lineWidth = 8;
        ctx.strokeRect(0, 0, width, height);

        const x0 = Math.max(0, turned ? bounds.width - v1 : u0);
        const y0 = Math.max(0, (turned ? u0 : v0) / tilt);
        const x1 = Math.min(bounds.width, turned ? bounds.width - v0 : u1);
        const y1 = Math.min(bounds.height, (turned ? u1 : v1) / tilt);
        // Changing the frame buffer scale must not invalidate all visible ground tiles at once.
        const density = Math.max(1, Math.min(2, scale * Math.min(2, devicePixelRatio || 1)));
        const tileLayout = `${turned}:${bounds.width}:${bounds.height}:${density}`;
        if (tileLayout !== groundTileLayout) {
            groundTiles.clear();
            groundTileLayout = tileLayout;
        }
        const firstCol = Math.floor(Math.max(0, x0 - groundMargin / tilt) / groundTileSpan);
        const firstRow = Math.floor(Math.max(0, y0 - groundMargin / tilt) / groundTileSpan);
        const lastCol = Math.floor(
            Math.min(bounds.width, x1 + groundMargin / tilt) / groundTileSpan,
        );
        const lastRow = Math.floor(
            Math.min(bounds.height, y1 + groundMargin / tilt) / groundTileSpan,
        );
        const limit = Math.max(24, (lastRow - firstRow + 1) * (lastCol - firstCol + 1) + 8);
        for (let row = firstRow; row <= lastRow; row++) {
            for (let col = firstCol; col <= lastCol; col++) {
                const tile = groundTile(col, row, bounds, density, limit);
                ctx.drawImage(tile.image, tile.x, tile.y, tile.width, tile.height);
            }
        }
    }
    const landmarks = [
        [copperRavineCenter, onlineCopperRavineCenter, bakeCopperRavine, new Map()],
        [ironRidgeCenter, onlineIronRidgeCenter, bakeIronRidge, new Map()],
    ];
    const expeditionLandmarks = [
        [goldLodeLocal, onlineGoldCenter, (turned) => bakeGoldFloor(turned, false), new Map()],
        [upperGoldLocal, upperGoldCenter, (turned) => bakeGoldFloor(turned, true), new Map()],
        [restCampLocal, onlineRestCamp, bakeRestCamp, new Map()],
        [worldCenter, worldCenter, bakeCaldera, new Map(), calderaRadius + 12],
    ];
    function paintLandmark(state, [local, online, bake, cache, radius = 330]) {
        const anchor = project(state.bounds ? online : local);
        if (!isVisible(anchor, radius)) return;
        const turned = layout.turned;
        let art = cache.get(turned);
        if (!art) {
            art = bake(turned);
            cache.set(turned, art);
        }
        ctx.drawImage(art.image, anchor.x - art.ox, anchor.y - art.oy);
    }
    function paintPassage(passage, player) {
        const point = project(passage);
        const radius = passage.radius;
        if (!isVisible(point, radius)) return;
        const rx = radius * (layout.turned ? tilt : 1);
        const ry = radius * (layout.turned ? 1 : tilt);
        const rim = passage.open ? '#a3ecd1' : '#e5a282';
        ctx.save();
        ctx.lineWidth = 3;
        ellipse(ctx, point.x + 3, point.y + 5, rx * 1.09, ry * 1.09, '#273f3570');
        ellipse(ctx, point.x, point.y, rx, ry, '#243f3c', rim);
        ctx.lineWidth = 1.5;
        ellipse(ctx, point.x, point.y, rx * 0.72, ry * 0.72, null, rim);
        if (passage.open) {
            for (const dy of [-7, 5]) {
                line(
                    ctx,
                    [
                        { x: point.x - 12, y: point.y + dy - 4 },
                        { x: point.x, y: point.y + dy + 3 },
                        { x: point.x + 12, y: point.y + dy - 4 },
                    ],
                    rim,
                    3,
                );
            }
        } else {
            line(
                ctx,
                [
                    { x: point.x - 11, y: point.y },
                    { x: point.x + 11, y: point.y },
                ],
                rim,
                4,
            );
        }
        label(ctx, passage.label, point.x, point.y - ry - 15, 16, rim);
        if (Math.hypot(player.x - passage.x, player.y - passage.y) <= radius * 2)
            label(
                ctx,
                passage.open ? '걸어서 진입' : '강화 후 진입',
                point.x,
                point.y + ry + 14,
                12,
                '#fff1ce',
            );
        ctx.restore();
    }
    let sceneryArt;
    function collectScenery(state) {
        const { w, h, ox, oy, scale, turned, bounds } = layout;
        const minU = -ox / scale;
        const minV = -oy / scale;
        const maxU = (w - ox) / scale;
        const maxV = (h - oy) / scale;
        const fromX = turned ? bounds.width - maxV : minU;
        const toX = turned ? bounds.width - minV : maxU;
        const fromY = (turned ? minU : minV) / tilt;
        const toY = (turned ? maxU : maxV) / tilt;
        const copper = state.bounds ? onlineCopperRavineCenter : copperRavineCenter;
        const iron = state.bounds ? onlineIronRidgeCenter : ironRidgeCenter;
        for (
            let iy = Math.max(0, Math.floor(fromY / sceneryCell) - 1);
            iy <= Math.floor(toY / sceneryCell) + 1;
            iy++
        ) {
            for (
                let ix = Math.max(0, Math.floor(fromX / sceneryCell) - 1);
                ix <= Math.floor(toX / sceneryCell) + 1;
                ix++
            ) {
                const hash = hashPoint(ix * 13, iy * 13 + 711);
                if (((hash >>> 3) & 3) === 0) continue;
                const x = ix * sceneryCell + 24 + ((hash >>> 9) & 95);
                const y = iy * sceneryCell + 24 + ((hash >>> 18) & 95);
                if (x > bounds.width - 45 || y > bounds.height - 55) continue;
                if (Math.abs(x - copper.x) < 255 && Math.abs(y - copper.y) < 154) continue;
                if (Math.abs(x - iron.x) < 237 && Math.abs(y - iron.y) < 130) continue;
                if (state.expedition && state.bounds) {
                    if (
                        (x - worldCenter.x) ** 2 + (y - worldCenter.y) ** 2 <
                        (calderaRadius - 70) ** 2
                    )
                        continue;
                    if (
                        (x - onlineGoldCenter.x) ** 2 + (y - onlineGoldCenter.y) ** 2 < 236 ** 2 ||
                        (x - upperGoldCenter.x) ** 2 + (y - upperGoldCenter.y) ** 2 < 246 ** 2 ||
                        (x - onlineRestCamp.x) ** 2 + (y - onlineRestCamp.y) ** 2 < 91 ** 2
                    )
                        continue;
                }
                const p = project({ x, y });
                if (isVisible(p, 61))
                    actors.push({
                        p,
                        kind: 'scenery',
                        a: { sprite: (hash >>> 5) & 3, tone: 0.76 + ((hash >>> 26) & 7) * 0.045 },
                    });
            }
        }
    }
    function drawScenery({ sprite, tone }, p) {
        sceneryArt ??= bakeScenery();
        ctx.drawImage(
            sceneryArt,
            sprite * scenerySpan,
            0,
            scenerySpan,
            scenerySpan,
            p.x - 46 * tone,
            p.y - 71 * tone,
            scenerySpan * tone,
            scenerySpan * tone,
        );
    }
    // 바위 한 덩어리: 윤곽 = 실제 polygon(rimZ 평면), 아래로 옆면, 안쪽으로 솟은 돔.
    function boulder(o) {
        const n = o.points.length;
        if (n < 3) return null;
        const c = centerOf(o.points);
        const R = Math.sqrt(areaOf(o.points) / Math.PI) || 1;
        const sx = o.recoil?.x ?? 0;
        const sy = o.recoil?.y ?? 0;
        const P = (p, z) => {
            const s = project(p, z);
            return { x: s.x + sx, y: s.y + sy };
        };
        const rim = o.points.map((p) => P(p, o.rimZ));
        const foot = o.points.map((p) =>
            P({ x: c.x + (p.x - c.x) * 1.04, y: c.y + (p.y - c.y) * 1.04 }, o.baseZ),
        );
        const capWorld = o.points.map((p) => ({
            x: c.x + (p.x - c.x) * o.k + (o.capShift?.x ?? 0),
            y: c.y + (p.y - c.y) * o.k + (o.capShift?.y ?? 0),
        }));
        const cap = capWorld.map((p, i) => {
            const key = o.heightPoints?.[i] ?? o.points[i];
            const j = 0.86 + ((hashPoint(key.x, key.y) % 1000) / 1000) * 0.28;
            return P(p, o.rimZ + o.H * j);
        });
        const sc = P(c, o.rimZ);
        const L = { x: -0.6, y: -0.8 };
        const edges = [];
        for (let i = 0; i < n; i++) {
            const a = rim[i],
                b = rim[(i + 1) % n];
            const nn = outwardNormal(a, b, sc);
            edges.push({
                i,
                nn,
                lit: nn.x * L.x + nn.y * L.y,
                cut: o.isCut?.(i) ?? false,
            });
        }
        const pal = o.palette;
        // 땅 그림자: 실제 바닥 윤곽을 오른쪽 아래로
        ctx.save();
        ctx.globalAlpha = o.shadowAlpha ?? 1;
        polygon(
            ctx,
            o.points.map((p) => {
                const s = project({ x: c.x + (p.x - c.x) * 1.12, y: c.y + (p.y - c.y) * 1.12 }, 0);
                return { x: s.x + 7, y: s.y + 6 };
            }),
            '#2f45355c',
        );
        ctx.restore();
        if (o.blink) {
            ctx.save();
            ctx.filter = hitstopBlinkFilter;
        }
        // 옆면(앞쪽만)
        for (const e of edges) {
            if (e.nn.y <= 0.05) continue;
            const j = (e.i + 1) % n;
            const tone = e.cut
                ? pal.cutDeep
                : mix(pal.shade, pal.deep, Math.min(1, Math.max(0, 0.5 - e.lit * 0.6)));
            const quad = [rim[e.i], rim[j], foot[j], foot[e.i]];
            polygon(ctx, quad, tone);
        }
        const facet = (e) => {
            const j = (e.i + 1) % n;
            const quad = [rim[e.i], rim[j], cap[j], cap[e.i]];
            let tone;
            if (e.cut) tone = pal.cut;
            else {
                const b = e.lit + 0.18;
                tone =
                    b > 0
                        ? mix(pal.mid, pal.lit, Math.min(1, b))
                        : mix(pal.mid, pal.shade, Math.min(1, -b));
            }
            polygon(ctx, quad, tone);
            if (!e.cut) return;
            // 새 단면: 어두운 면 + 밝은 결(층 방향) + 반짝이는 광물 점
            const stablePoints = o.heightPoints ?? o.points;
            const rnd = seeded(hashPoint(stablePoints[e.i].x, stablePoints[j].y));
            const lerp = (a, b, t) => ({
                x: a.x + (b.x - a.x) * t,
                y: a.y + (b.y - a.y) * t,
            });
            for (const f of [0.22, 0.46, 0.7]) {
                const a = lerp(rim[e.i], cap[e.i], f);
                const b = lerp(rim[j], cap[j], f);
                const m = lerp(a, b, 0.35 + rnd() * 0.3);
                m.x += (rnd() - 0.5) * 3;
                m.y += (rnd() - 0.5) * 3;
                ctx.globalAlpha = 0.6 - f * 0.25;
                line(ctx, [a, m, b], pal.grain, 1);
            }
            ctx.globalAlpha = 1;
            for (let s = 0; s < 3; s++) {
                const u = rnd(),
                    v = 0.15 + rnd() * 0.6;
                const q = lerp(lerp(rim[e.i], rim[j], u), lerp(cap[e.i], cap[j], u), v);
                ellipse(ctx, q.x, q.y, 1.3, 1.1, pal.veinLight);
            }
        };
        const back = edges.filter((e) => e.nn.y < 0).sort((a, b) => a.nn.y - b.nn.y);
        const front = edges.filter((e) => e.nn.y >= 0).sort((a, b) => a.nn.y - b.nn.y);
        for (const e of back) facet(e);
        polygon(ctx, cap, pal.cap);
        for (const e of front) facet(e);
        if (o.flash > 0) {
            ctx.save();
            ctx.globalAlpha = o.flash;
            polygon(ctx, rim, '#fff1bf');
            ctx.restore();
        }
        // 면 사이 모서리: 각진 돌로 읽히게
        ctx.globalAlpha = 0.35;
        for (let i = 0; i < n; i++) line(ctx, [rim[i], cap[i]], pal.line, 0.9);
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 1;
        polygon(ctx, cap, null, pal.line);
        ctx.globalAlpha = 1;
        // 표면 결·반점(윤곽 안으로 자름)
        const zAt = (p) => {
            const d = Math.hypot(p.x - c.x, p.y - c.y) / R;
            return o.rimZ + o.H * Math.max(0, Math.min(1, (1 - d) / (1 - o.k)));
        };
        ctx.save();
        ctx.beginPath();
        rim.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
        ctx.closePath();
        ctx.clip();
        o.details?.({ P, zAt, c, R });
        ctx.restore();
        if (o.face) {
            ctx.save();
            ctx.beginPath();
            cap.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
            ctx.closePath();
            ctx.clip();
            o.face({ P, zAt });
            ctx.restore();
        }
        // 윤곽선 + 부서진 가장자리 하이라이트
        ctx.lineWidth = o.outline ?? 2;
        polygon(ctx, rim, null, pal.line);
        for (const e of edges) {
            const j = (e.i + 1) % n;
            if (e.cut) line(ctx, [rim[e.i], rim[j]], pal.grain, 1.6);
            else if (e.lit > 0.45) {
                ctx.globalAlpha = 0.6;
                line(ctx, [rim[e.i], rim[j]], '#fff7e2', 1.2);
                ctx.globalAlpha = 1;
            }
        }
        for (const e of edges) {
            if (e.nn.y <= 0.05) continue;
            line(ctx, [foot[e.i], foot[(e.i + 1) % n]], pal.line, 1.4);
        }
        if (o.blink) ctx.restore();
        return { rim, cap, c, R };
    }
    // 바위마다 고정된 광맥 위치(원래 크기 기준). 잘려 나간 자리의 광맥은 같이 사라진다.
    const veinCache = new WeakMap();
    function veinsFor(ore) {
        let v = veinCache.get(ore);
        if (v) return v;
        const rnd = seeded(hashText(ore.id));
        const crystals = Array.from({ length: 7 }, () => {
            const a = rnd() * TAU,
                d = Math.sqrt(rnd()) * ore.r * 0.78;
            return {
                x: Math.cos(a) * d,
                y: Math.sin(a) * d,
                s: 0.7 + rnd() * 0.6,
                tilt: (rnd() - 0.5) * 0.8,
                count: 1 + Math.floor(rnd() * 3),
            };
        });
        const streaks = Array.from({ length: 2 }, () => {
            const a = rnd() * TAU,
                pts = [];
            let x = Math.cos(a) * ore.r * 0.9,
                y = Math.sin(a) * ore.r * 0.9;
            const dir = a + Math.PI + (rnd() - 0.5) * 0.9;
            for (let k = 0; k < 6; k++) {
                pts.push({ x, y });
                x += Math.cos(dir + (rnd() - 0.5) * 0.9) * ore.r * 0.3;
                y += Math.sin(dir + (rnd() - 0.5) * 0.9) * ore.r * 0.3;
            }
            return pts;
        });
        const specks = Array.from({ length: 34 }, () => {
            const a = rnd() * TAU,
                d = Math.sqrt(rnd()) * ore.r;
            return {
                x: Math.cos(a) * d,
                y: Math.sin(a) * d,
                dark: rnd() < 0.6,
                r: 0.8 + rnd() * 1.4,
            };
        });
        v = { crystals, streaks, specks };
        veinCache.set(ore, v);
        return v;
    }
    function crystalTuft(x, y, size, tilt, count, pal) {
        for (let k = 0; k < count; k++) {
            const ox = (k - (count - 1) / 2) * 3.4 * size,
                h = (7 + (k % 2) * 3) * size,
                w = 2.4 * size;
            const bx = x + ox,
                tip = { x: bx + tilt * h * 0.6, y: y - h };
            const body = [
                { x: bx - w, y },
                { x: bx - w * 0.8, y: y - h * 0.6 },
                tip,
                { x: bx + w * 0.8, y: y - h * 0.6 },
                { x: bx + w, y },
            ];
            polygon(ctx, body, pal.vein);
            polygon(ctx, [body[0], body[1], tip, { x: bx, y: y - h * 0.5 }], pal.veinLight);
            ctx.lineWidth = 0.8;
            polygon(ctx, body, null, pal.veinDark);
        }
    }
    // 새 단면 기억: 이번 판에서 생긴 절단선 꼭짓점. 변의 두 끝이 모두 절단점이면 그 변은 단면.
    const cutMemory = new WeakMap();
    function cutPoints(ore) {
        let m = cutMemory.get(ore);
        if (!m) {
            m = { shape: null, points: [] };
            cutMemory.set(ore, m);
        }
        if (ore.seam?.length >= 2 && ore.polygon !== m.shape) {
            m.shape = ore.polygon;
            m.points.push(...ore.seam.map((p) => ({ x: p.x, y: p.y })));
        }
        return m.points;
    }
    function faceOnCap(ore, time) {
        const previous = faceMemory.get(ore);
        if (previous?.polygon === ore.polygon) return previous;
        const center = centerOf(ore.polygon);
        const cap = ore.polygon.map((p) => ({
            x: center.x + (p.x - center.x) * rockCapScale,
            y: center.y + (p.y - center.y) * rockCapScale,
        }));
        const limit = Math.min(19, ore.r * 0.38);
        let spot = previous?.spot ?? center;
        let clearance = interiorClearance(cap, spot);
        if (clearance < (previous?.clearance ?? limit)) {
            const minX = Math.min(...cap.map((p) => p.x));
            const maxX = Math.max(...cap.map((p) => p.x));
            const minY = Math.min(...cap.map((p) => p.y));
            const maxY = Math.max(...cap.map((p) => p.y));
            for (let j = 1; j < 9; j++) {
                for (let i = 1; i < 9; i++) {
                    const p = {
                        x: minX + ((maxX - minX) * i) / 9,
                        y: minY + ((maxY - minY) * j) / 9,
                    };
                    const room = interiorClearance(cap, p);
                    if (room > clearance) {
                        spot = p;
                        clearance = room;
                    }
                }
            }
        }
        const next = {
            polygon: ore.polygon,
            spot,
            clearance: Math.min(limit, clearance),
            faceHitAt: previous ? time : -Infinity,
        };
        faceMemory.set(ore, next);
        return next;
    }
    function mobFace(ore, time, pal, toWorld, { P, zAt }, still = false) {
        if (ore.guardian) return;
        const face = faceOnCap(ore, time);
        const world = toWorld(face.spot);
        const p = P(world, zAt(world) + 0.5);
        const s = face.clearance * 0.86;
        if (s < 2.2) return;
        const facing = Number.isFinite(ore.heading) ? ore.heading : 0;
        const ahead = project({
            x: world.x + Math.cos(facing),
            y: world.y + Math.sin(facing),
        });
        const ground = project(world);
        const gaze = still ? 0 : Math.max(-1, Math.min(1, ahead.x - ground.x));
        const tense = ore.stage === 'warn' || ore.stage === 'charge';
        const stunned = ore.stage === 'recover';
        const reactAge = time - face.faceHitAt;
        const expression = reactAge < 95 ? 0.18 : reactAge < 245 ? 0.53 : 0.38;
        const blink =
            !still && !tense && (time + (hashText(ore.uid ?? ore.id) % 2600)) % 2600 < 115;
        const y = p.y - s * 0.18;
        for (const side of [-1, 1]) {
            const x = p.x + (side * 0.46 + gaze * 0.2) * s;
            const openness = blink ? 0.08 : expression;
            ellipse(ctx, x, y, s * 0.27, s * openness, pal.cutDeep);
            if (!blink) {
                ellipse(
                    ctx,
                    x + gaze * s * 0.09,
                    y - s * 0.05,
                    s * 0.135,
                    s * openness * 0.58,
                    tense ? '#ffab55' : '#ffe2a6',
                );
                if (!tense)
                    ellipse(
                        ctx,
                        x + gaze * s * 0.09 - s * 0.05,
                        y - s * 0.15,
                        s * 0.054,
                        s * 0.054,
                        '#fff8e0',
                    );
            }
            if (tense) {
                line(
                    ctx,
                    [
                        { x: x - side * s * 0.23, y: y - s * 0.19 },
                        { x: x + side * s * 0.26, y: y - s * 0.51 },
                    ],
                    pal.cutDeep,
                    Math.max(1, s * 0.15),
                );
            }
        }
        if (s >= 5) {
            ellipse(
                ctx,
                p.x + gaze * s * 0.13,
                p.y + s * 0.38,
                s * 0.2,
                s * (stunned ? 0.18 : 0.07),
                pal.cutDeep,
            );
        }
    }
    const rockDetailCache = new WeakMap();
    function rockDetail(ore) {
        const local = ore.polygon;
        const previous = rockDetailCache.get(ore);
        if (previous?.local === local) return previous;
        const cuts = cutPoints(ore);
        const onCut = (p) =>
            cuts.some((q) => Math.abs(q.x - p.x) < 0.75 && Math.abs(q.y - p.y) < 0.75);
        const veins = veinsFor(ore);
        const detail = {
            local,
            center: centerOf(local),
            radius: Math.sqrt(areaOf(local) / Math.PI),
            cutEdges: local.map((point, i) => onCut(point) && onCut(local[(i + 1) % local.length])),
            specks: veins.specks.filter((p) => inside(local, p)),
            crystals: veins.crystals.filter((p) => inside(local, p)),
            streaks: veins.streaks.map((points) => points.filter((p) => inside(local, p))),
        };
        rockDetailCache.set(ore, detail);
        return detail;
    }

    const rockBodyCache = new WeakMap();
    // Pristine distant rocks share the same tier silhouette and a neutral face.
    const distantRockCache = new Map();
    // Rasterize newly visible bodies gradually so entering a crowded area stays responsive.
    const maxRockBakesPerFrame = 4;
    let rockBakes = 0;

    function cacheBody(ore, anchor, details, height, options, distantKey) {
        const density = Math.max(1, layout.scale * Math.min(2, devicePixelRatio || 1));
        const angle = ore.angle ?? 0;
        const cached = distantKey ? distantRockCache.get(distantKey) : rockBodyCache.get(ore);
        if (
            cached?.polygon === details.local &&
            cached.cracks === ore.cracks &&
            cached.angle === angle &&
            cached.turned === layout.turned &&
            cached.density === density
        )
            return cached;

        if (rockBakes >= maxRockBakesPerFrame) return null;
        rockBakes++;
        const source = options();
        const pad = ore.r * 1.24 + 13;
        const width = Math.ceil(pad * 2 * density);
        const heightPx = Math.ceil((pad * 2 + FACE_Z + height) * density);
        const image = document.createElement('canvas');
        image.width = width;
        image.height = heightPx;
        const surface = image.getContext('2d');
        const left = -pad;
        const top = -pad - FACE_Z - height;
        surface.setTransform(
            density,
            0,
            0,
            density,
            -(anchor.x + left) * density,
            -(anchor.y + top) * density,
        );
        surface.lineCap = 'round';
        surface.lineJoin = 'round';
        surface.lineWidth = 1.5;
        let shape;
        try {
            ctx = surface;
            shape = boulder(distantKey ? source : { ...source, face: undefined });
        } finally {
            ctx = mainContext;
        }
        if (!shape) return null;
        const record = {
            polygon: details.local,
            cracks: ore.cracks,
            angle,
            turned: layout.turned,
            density,
            image,
            radius: ore.r,
            left,
            top,
            width: width / density,
            height: heightPx / density,
            cap: shape.cap.map((p) => ({ x: p.x - anchor.x, y: p.y - anchor.y })),
        };
        if (distantKey) distantRockCache.set(distantKey, record);
        else rockBodyCache.set(ore, record);
        return record;
    }

    function pausedBetween(from, to, start, end) {
        return end === undefined ? 0 : Math.max(0, Math.min(to, end) - Math.max(from, start));
    }

    function rockFaceTime(ore, time) {
        if (ore.hitstopUntil === undefined) return time;
        let clock = rockAnimationClocks.get(ore);
        if (!clock || time < clock.time) {
            clock = { time: Math.min(time, ore.lastHit), pausedMs: 0 };
            rockAnimationClocks.set(ore, clock);
        }
        clock.pausedMs += pausedBetween(clock.time, time, ore.lastHit, ore.hitstopUntil);
        clock.time = time;
        return time - clock.pausedMs;
    }

    function rock(ore, state) {
        const color = minerals[ore.id];
        const pal = ore.guardian ? guardianPalette : (STONE[ore.id] ?? STONE.plain);
        const time = state.time;
        const blink = hitstopBlink(time, ore);
        const platedBoss = ore.boss && Number.isFinite(ore.bossPlates);
        const exposed = platedBoss && ore.exposedUntilMs > time;
        const age = time - (ore.lastHit ?? -Infinity);
        const impactAt = ore.impact?.at ?? 0;
        const recoilTime =
            time - Math.max(0, Math.min(time, ore.hitstopUntil ?? impactAt) - impactAt);
        const faceTime = rockFaceTime(ore, time);
        const bodyRecoil = recoil(ore.impact, recoilTime, 4.8);
        if (!ore.impact && age >= 0 && age < 120)
            bodyRecoil.x = Math.sin(age / 10) * 2 * (1 - age / 120);
        const nearby = Math.hypot(state.player.x - ore.x, state.player.y - ore.y) < 140;
        const anchor = project(ore);
        if (platedBoss) {
            drawOreTitan(
                anchor,
                ore,
                time,
                bodyRecoil,
                exposed,
                blink,
                state.expedition?.boss?.coreHp,
            );
            return;
        }
        const lodeCreature = !ore.guardian && ore.lode === 'gold';
        if (ore.guardian)
            drawGuardianLegs(
                anchor,
                ore.r,
                state.time,
                ore.stage === 'charge',
                ore.vein ?? ore.lode,
            );
        const distantKey =
            !blink &&
            !nearby &&
            !ore.boss &&
            !ore.guardian &&
            ore.geometryRevision === 0 &&
            ore.stage === 'roam' &&
            !bodyRecoil.x &&
            !bodyRecoil.y &&
            (age < 0 || age >= 90)
                ? ore.id + ':' + ore.polygon.length + ':' + layout.turned
                : null;
        const distant = distantRockCache.get(distantKey);
        if (distant) {
            if (lodeCreature) drawLodeCreatureFeet(anchor, ore, ore.r, faceTime);
            drawDistantRock(distant, anchor, ore.r);
            if (lodeCreature) {
                const crown = project(ore, FACE_Z + Math.max(6, Math.min(22, ore.r * 0.27)));
                drawGoldLodeCrown(crown, ore, ore.r, bodyRecoil, blink);
            }
            return;
        }
        const detail = rockDetail(ore);
        const local = detail.local;
        const cos = Math.cos(ore.angle ?? 0),
            sin = Math.sin(ore.angle ?? 0);
        const toWorld = (v) => ({
            x: ore.x + v.x * cos - v.y * sin,
            y: ore.y + v.x * sin + v.y * cos,
        });
        const R = detail.radius;
        const H = Math.max(6, Math.min(22, R * 0.27));
        if (lodeCreature) drawLodeCreatureFeet(anchor, ore, R, faceTime);
        const options = () => ({
            points: local.map(toWorld),
            heightPoints: local,
            baseZ: 0,
            rimZ: FACE_Z,
            H,
            k: rockCapScale,
            palette: pal,
            outline: ore.guardian ? 3.2 : 2.45,
            blink,
            recoil: bodyRecoil,
            flash: age >= 0 && age < 90 ? (1 - age / 90) ** 2 * 0.4 : 0,
            isCut: (i) => detail.cutEdges[i],
            details: ({ P, zAt }) => {
                for (const s of detail.specks) {
                    const w = toWorld(s);
                    const q = P(w, zAt(w));
                    ellipse(
                        ctx,
                        q.x,
                        q.y,
                        s.r,
                        s.r * 0.7,
                        s.dark ? pal.shade + '99' : pal.cap + 'aa',
                    );
                }
                for (const streak of detail.streaks) {
                    if (streak.length < 2) continue;
                    const pts = streak.map((p) => {
                        const w = toWorld(p);
                        return P(w, zAt(w));
                    });
                    ctx.globalAlpha = 0.5;
                    line(ctx, pts, pal.vein, 2.2);
                    ctx.globalAlpha = 0.45;
                    line(ctx, pts, pal.veinLight, 0.9);
                    ctx.globalAlpha = 1;
                }
                for (const cr of detail.crystals) {
                    const w = toWorld(cr);
                    const q = P(w, zAt(w));
                    ellipse(ctx, q.x, q.y + 0.5, 4.5 * cr.s, 2 * cr.s, pal.deep + '88');
                    crystalTuft(q.x, q.y, cr.s, cr.tilt, cr.count, pal);
                }
                if (ore.lode && !ore.guardian) {
                    const crest = toWorld({
                        x: detail.center.x - R * 0.15,
                        y: detail.center.y - R * 0.31,
                    });
                    const tip = P(crest, zAt(crest));
                    drawOreCrest(tip, Math.min(1.15, R / 36), ore.lode === 'iron', pal);
                }
                fractureDetail(ore, state, pal, (p) => {
                    const w = toWorld(p);
                    return P(w, zAt(w) + 1);
                });
            },
            face: (surface) => mobFace(ore, faceTime, pal, toWorld, surface, Boolean(distantKey)),
        });
        const center = toWorld(detail.center);
        const active =
            state.breaking?.target === ore ||
            state.breakingOthers?.some((entry) => entry.target === ore);
        const stable =
            !blink && !active && !bodyRecoil.x && !bodyRecoil.y && (age < 0 || age >= 90);
        const body = stable ? cacheBody(ore, anchor, detail, H, options, distantKey) : null;
        if (body && distantKey) {
            drawDistantRock(body, anchor, ore.r);
            return;
        }
        if (!body) boulder(options());
        else {
            ctx.drawImage(
                body.image,
                anchor.x + body.left,
                anchor.y + body.top,
                body.width,
                body.height,
            );
            ctx.save();
            ctx.beginPath();
            for (let i = 0; i < body.cap.length; i++) {
                const p = body.cap[i];
                if (i === 0) ctx.moveTo(anchor.x + p.x, anchor.y + p.y);
                else ctx.lineTo(anchor.x + p.x, anchor.y + p.y);
            }
            ctx.closePath();
            ctx.clip();
            mobFace(ore, faceTime, pal, toWorld, {
                P: project,
                zAt: (p) =>
                    FACE_Z +
                    H *
                        Math.max(
                            0,
                            Math.min(
                                1,
                                (1 - Math.hypot(p.x - center.x, p.y - center.y) / R) /
                                    (1 - rockCapScale),
                            ),
                        ),
            });
            ctx.restore();
        }
        if (lodeCreature) {
            const crown = project(center, FACE_Z + H);
            drawGoldLodeCrown(crown, ore, R, bodyRecoil, blink);
        }
        if (ore.guardian) {
            guardianCrown(
                project(center, FACE_Z + H),
                R,
                bodyRecoil,
                blink,
                ore.stage === 'warn' || ore.stage === 'charge',
            );
        }
        const selected = state.target?.actor === ore;
        const charging = ore.stage === 'warn' || ore.stage === 'charge';
        const visibleGuardian = ore.guardian && (charging || (nearby && !state.target));
        if (!selected && !ore.boss && !visibleGuardian) return;
        const badge = project(
            center,
            ore.guardian ? FACE_Z + H + Math.min(49, R * 0.82) : Math.min(52, R * 0.47 + 21),
        );
        const armed = ore.cracks?.some((crack) => crack.armed);
        const name = ore.guardian ? color.name + ' 수호석' : ore.boss ? '대광맥' : color.name;
        if (ore.guardian && (nearby || selected || charging)) {
            const meter = 46;
            ctx.fillStyle = '#362a2e';
            ctx.fillRect(badge.x - meter / 2 - 2, badge.y - 23, meter + 4, 8);
            ctx.fillStyle = charging ? '#ff7769' : '#ffc76a';
            ctx.fillRect(badge.x - meter / 2, badge.y - 21, armed ? meter / 2 : meter, 4);
        }
        label(
            ctx,
            armed ? '금 간 ' + name : name,
            badge.x,
            badge.y,
            selected || ore.guardian ? 18 : 15,
            armed ? '#ffde82' : color.light,
        );
        if (nearby && state.level < color.tier)
            label(ctx, pickaxes[color.tier].name + ' 필요', badge.x, badge.y + 17, 11, '#ffedbd');
    }
    function drawOreTitan(point, ore, time, recoil, exposed, blink, coreHp) {
        const plates = ore.bossPlates;
        const attacking = ore.stage === 'charge';
        const warm = ore.stage === 'warn';
        const core = exposed ? '#bcffec' : plates < 2 ? '#ffad78' : '#f0c487';
        const border = '#292631';
        const color = plates < 2 ? '#bc6372' : '#9c82be';
        const s = ore.r / 78;
        const beat = time < (ore.hitstopUntil ?? 0) ? (ore.hitstopAt ?? time) : time;
        const stride = attacking ? beat / 74 : beat / 210;
        ctx.save();
        ctx.translate(point.x + recoil.x, point.y + recoil.y);
        ctx.scale(s, s);
        ellipse(ctx, 0, 7, 97, 26, '#26243b71');
        if (blink) ctx.filter = hitstopBlinkFilter;
        const angular = (pairs, fill, stroke = border) =>
            polygon(
                ctx,
                pairs.map(([x, y]) => ({ x, y })),
                fill,
                stroke,
            );
        if (attacking && ore.chargeDir && !reducedMotion.matches) {
            const forward = screenDirection(ore.chargeDir);
            const width = plates ? 24 : 35;
            for (let i = 1; i <= 3; i++) {
                const back = i * (plates ? 25 : 42);
                const x = -forward.x * back;
                const y = -forward.y * back - (plates ? 28 : 66);
                ctx.globalAlpha = (4 - i) * 0.14;
                ctx.lineWidth = 4;
                ellipse(
                    ctx,
                    x,
                    y,
                    width + i * 5,
                    width * 0.55,
                    null,
                    plates ? '#ffbb80' : '#a7fff0',
                );
            }
            ctx.globalAlpha = 1;
        }
        if (plates === 0) {
            const lift = -73 + Math.sin(stride) * 5;
            const unstable = coreHp === 1;
            const color = exposed ? '#aaffed' : warm ? '#ffc279' : unstable ? '#f78cbd' : '#73e0fa';
            ctx.translate(0, lift);
            ctx.lineWidth = 4;
            ellipse(ctx, 0, 20, 118, 34, '#91dbe136', color);
            for (const side of [-1, 1]) {
                ctx.save();
                ctx.scale(side, 1);
                const wingbeat = Math.sin(stride * 0.8 + side) * (attacking ? 8 : 4);
                angular(
                    [
                        [35, -11],
                        [77, -27],
                        [138, -74 + wingbeat],
                        [125, 1],
                        [83, 55],
                        [46, 44],
                    ],
                    '#334969',
                );
                angular(
                    [
                        [54, -10],
                        [91, -24],
                        [131, -63 + wingbeat],
                        [106, 0],
                        [80, 32],
                    ],
                    color,
                );
                angular(
                    [
                        [82, 38],
                        [116, 10],
                        [103, 38],
                        [72, 63],
                        [54, 55],
                    ],
                    unstable ? '#ffc38a' : '#a9edd9',
                );
                if (unstable) {
                    const tip = { x: 115, y: -45 + wingbeat };
                    line(
                        ctx,
                        [tip, { x: 88, y: -38 }, { x: 94, y: -18 }, { x: 62, y: -6 }],
                        '#fff3c6',
                        3.3,
                    );
                    if (!reducedMotion.matches) {
                        const rise = (time / 26) % 30;
                        ellipse(ctx, tip.x + 5, tip.y - 7 - rise, 3, 4, '#ffd28f');
                        ellipse(ctx, tip.x - 7, tip.y - 15 - rise * 0.7, 2, 3, '#fff1c2');
                    }
                }
                ctx.restore();
            }
            const shards = ringPoints(1, 6, stride * 0.38);
            for (const { x, y } of shards) {
                ctx.save();
                ctx.translate(x * 110, y * 28 + 15);
                ctx.rotate(x * 0.44);
                angular(
                    [
                        [-12, 6],
                        [-2, -13],
                        [13, -2],
                        [5, 13],
                    ],
                    '#526799',
                );
                ctx.restore();
            }
            ctx.scale(1.25, 1.25);
            angular(
                [
                    [-44, -18],
                    [-3, -66],
                    [39, -29],
                    [49, 15],
                    [8, 63],
                    [-41, 36],
                ],
                '#37517d',
            );
            angular(
                [
                    [-44, -18],
                    [-3, -66],
                    [5, 8],
                    [-41, 36],
                ],
                color,
            );
            angular(
                [
                    [-3, -66],
                    [39, -29],
                    [49, 15],
                    [5, 8],
                ],
                unstable ? '#ffcddf' : '#d9ffef',
            );
            angular(
                [
                    [5, 8],
                    [49, 15],
                    [8, 63],
                ],
                unstable ? '#ad5a9c' : '#55a8d3',
            );
            angular(
                [
                    [-23, -3],
                    [-4, -29],
                    [21, -18],
                    [21, 11],
                    [3, 28],
                ],
                '#effff0',
            );
            ctx.restore();
            label(ctx, '대광맥 코어', point.x, point.y - 171, 23, color);
            return;
        }
        for (const side of [-1, 1]) {
            const joint = Math.sin(stride * (side === -1 ? 1 : -1)) * (attacking ? 10 : 3);
            for (const rear of [true, false]) {
                const knee = side * (rear ? 68 : 83);
                const end = knee + side * (rear ? 13 : 21);
                const lift = rear ? joint : -joint;
                const height = rear ? -3 : 16;
                const leg = [
                    { x: side * 40, y: rear ? -31 : -18 },
                    { x: knee, y: height - 26 },
                    { x: end, y: height + lift },
                ];
                line(ctx, leg, border, rear ? 19 : 23);
                line(ctx, leg, rear ? '#544564' : '#746181', rear ? 11 : 14);
                ellipse(ctx, knee, height - 26, 6, 5, color, border);
                ctx.lineWidth = 4;
                angular(
                    [
                        [end - 13, height + lift],
                        [end, height + lift - 8],
                        [end + 14, height + lift + 3],
                        [end + 8, height + lift + 10],
                        [end - 11, height + lift + 9],
                    ],
                    '#504252',
                );
            }
        }
        ctx.lineWidth = 5;
        angular(
            [
                [-67, -39],
                [-50, -77],
                [-20, -89],
                [29, -86],
                [57, -71],
                [69, -44],
                [53, -9],
                [26, 10],
                [-38, 6],
            ],
            '#443750',
        );
        angular(
            [
                [-51, -64],
                [-25, -83],
                [27, -78],
                [61, -52],
                [29, -39],
                [-30, -36],
            ],
            '#79668e',
        );
        angular(
            [
                [-58, -46],
                [-31, -35],
                [-31, -5],
                [-52, -16],
            ],
            '#625477',
        );
        angular(
            [
                [30, -41],
                [63, -55],
                [57, -17],
                [31, -3],
            ],
            '#5a476f',
        );
        ctx.lineWidth = 3;
        const crown = [
            { x: 0, y: -80, top: -141, dx: 6 },
            { x: -43, y: -72, top: -111, dx: -12 },
            { x: 41, y: -73, top: -115, dx: 13 },
            { x: -70, y: -56, top: -85, dx: -13 },
            { x: 68, y: -56, top: -88, dx: 15 },
        ];
        for (const { x, y, top, dx } of crown.slice(0, plates)) {
            angular(
                [
                    [x - 13, y],
                    [x - 14, top + 17],
                    [x + dx, top],
                    [x + 17, top + 15],
                    [x + 15, y + 3],
                    [x, y + 12],
                ],
                color,
            );
            angular(
                [
                    [x - 14, top + 17],
                    [x + dx, top],
                    [x + 5, y + 3],
                    [x - 13, y],
                ],
                '#e0b1e7',
                null,
            );
            angular(
                [
                    [x + dx, top],
                    [x + 17, top + 15],
                    [x + 15, y + 3],
                    [x + 5, y + 3],
                ],
                '#ae7dba',
                null,
            );
        }
        ctx.lineWidth = 4;
        angular(
            [
                [-45, -48],
                [-28, -63],
                [0, -59],
                [27, -64],
                [45, -50],
                [33, -21],
                [19, -10],
                [-20, -9],
                [-37, -23],
            ],
            exposed ? '#275450' : '#353044',
        );
        for (const side of [-1, 1]) {
            const x = side * 23;
            angular(
                [
                    [x - 10, -48],
                    [x + 8, -52],
                    [x + 9, -41],
                    [x - 5, -35],
                ],
                warm ? '#ff847a' : core,
                null,
            );
        }
        if (exposed) {
            ctx.globalAlpha = 0.24;
            ellipse(ctx, 0, -28, 28, 23, core);
            ctx.globalAlpha = 1;
        }
        ctx.lineWidth = exposed ? 3 : 2;
        angular(
            [
                [0, -49],
                [16, -30],
                [0, -11],
                [-16, -30],
            ],
            exposed ? core : '#60415e',
            color,
        );
        angular(
            [
                [0, -42],
                [7, -30],
                [0, -20],
                [-6, -30],
            ],
            exposed ? '#ecfff4' : core,
            null,
        );
        ctx.restore();
    }
    function drawLodeCreatureFeet(point, ore, radius, time) {
        if (ore.id === 'stone' || radius < 16) return;
        const copper = ore.id === 'copper';
        const iron = ore.id === 'iron';
        const color = copper ? '#d48458' : iron ? '#86a8c5' : '#f0be5b';
        const phase = time / (ore.stage === 'charge' ? 57 : 145) + ore.x * 0.6;
        const span = Math.min(44, radius * 0.88);
        ctx.save();
        ctx.translate(point.x, point.y);
        for (const side of [-1, 1]) {
            const height = Math.sin(phase + side) * (iron ? 6 : 3);
            const root = { x: side * span * 0.57, y: 2 };
            const knee = { x: side * (span + (copper ? 8 : 3)), y: iron ? -7 : 8 };
            const foot = { x: side * (span + (copper ? 17 : 7)), y: (iron ? 24 : 14) + height };
            const limb = [root, knee, foot];
            line(ctx, limb, '#3d3444', copper ? 12 : 9);
            line(ctx, limb, color, copper ? 6 : 4);
            if (copper) {
                line(ctx, [foot, { x: foot.x + side * 8, y: foot.y - 9 }], '#fff0a6', 3);
            } else {
                ellipse(ctx, foot.x, foot.y, iron ? 6 : 10, 4, color, '#403647');
            }
        }
        ctx.restore();
    }
    const goldLodeCrowns = {
        stone: {
            pieces: [
                [-9, 0, 21, 10],
                [12, 4, 14, 8],
            ],
            color: ['#8e95a3', '#d7d7c1', '#4f5362', '#f1e9cf'],
        },
        copper: {
            pieces: [
                [-14, 4, 12, 24],
                [10, 1, 14, 32],
            ],
            color: ['#ab684d', '#f7aa69', '#514c53', '#e1f6bb'],
        },
        iron: {
            pieces: [
                [-17, 1, 11, 29],
                [2, 1, 13, 45],
                [17, 5, 9, 27],
            ],
            color: ['#63849b', '#c5e5e6', '#3e5061', '#edfff4'],
        },
        gold: {
            pieces: [
                [-16, 4, 10, 24],
                [2, 1, 16, 40],
                [17, 6, 10, 25],
            ],
            color: ['#c48a3a', '#ffe283', '#715038', '#fff4b8'],
        },
    };
    function drawGoldLodeCrown(point, ore, radius, recoil, blink) {
        const look = goldLodeCrowns[ore.id];
        if (!look || radius < 12) return;
        ctx.save();
        ctx.translate(point.x + recoil.x, point.y + recoil.y);
        const scale = Math.min(1.17, radius / 39);
        ctx.scale(scale, scale);
        if (blink) ctx.filter = hitstopBlinkFilter;
        for (const [x, y, width, height] of look.pieces) {
            facetSpire(ctx, x, y, width, height, look.color);
        }
        ctx.restore();
    }
    function drawGuardianLegs(point, radius, time, charging, lode) {
        ctx.save();
        ctx.translate(point.x, point.y);
        const iron = lode === 'iron';
        const dawn = lode === 'dawn';
        const strut = iron ? '#7aaaba' : '#bc8256';
        const joint = iron ? '#c0effb' : '#ffc774';
        const pace = time / (charging ? 54 : 132);
        for (const side of [-1, 1]) {
            if (lode === 'gold' || dawn) {
                const lift = Math.sin(pace + side) * (charging ? 8 : 3);
                ctx.save();
                ctx.scale(side, 1);
                ctx.lineWidth = 3;
                const crystal = dawn
                    ? [
                          { x: 25, y: -12 },
                          { x: 47, y: -57 + lift },
                          { x: 68, y: -44 + lift },
                          { x: 52, y: -4 },
                      ]
                    : [
                          { x: 26, y: 3 },
                          { x: 55, y: -21 + lift },
                          { x: 77, y: -9 + lift },
                          { x: 70, y: 11 },
                          { x: 49, y: 20 },
                      ];
                polygon(ctx, crystal, dawn ? '#7bd6c4' : '#bb743e', '#3d3039');
                line(ctx, crystal.slice(1, 3), dawn ? '#ecfff0' : '#ffc46e', 3);
                ctx.restore();
            }
            for (let i = 0; i < 2; i++) {
                const step = Math.sin(pace + i * Math.PI + side);
                const x = side * radius * (0.76 + i * 0.11);
                const y = 4 + i * 9;
                const knee = { x: x + side * (15 + step * 5), y: y + (dawn ? -11 : 2) };
                const foot = { x: knee.x + side * 5, y: y + 16 - step * (charging ? 8 : 4) };
                const points = [{ x, y: y - 6 }, knee, foot];
                line(ctx, points, '#323039', 12);
                line(ctx, points, strut, 7);
                ellipse(ctx, foot.x, foot.y + 2, 7, 3, '#302c36');
                ellipse(ctx, knee.x, knee.y, 3.2, 2.6, joint);
            }
        }
        ctx.restore();
    }
    function drawOreCrest(point, scale, iron, pal) {
        ctx.save();
        ctx.translate(point.x, point.y);
        ctx.scale(scale, scale);
        ctx.lineWidth = 2.3;
        const peaks = iron
            ? [
                  [-12, 16],
                  [2, 25],
                  [14, 13],
              ]
            : [
                  [-8, 16],
                  [7, 25],
              ];
        for (const [x, h] of peaks) {
            const tip = x + (iron ? 3 : -4);
            const body = [
                { x: x - 6, y: 0 },
                { x: x - 5, y: -h * 0.6 },
                { x: tip, y: -h },
                { x: x + 7, y: -h * 0.56 },
                { x: x + 5, y: 0 },
            ];
            polygon(ctx, body, pal.vein, pal.veinDark);
            polygon(ctx, [body[1], body[2], body[3], { x, y: -h * 0.37 }], pal.veinLight);
        }
        ctx.restore();
    }
    function guardianCrown(point, radius, recoil, blink, tense) {
        const size = Math.min(1, radius / 41);
        ctx.save();
        if (blink) ctx.filter = hitstopBlinkFilter;
        ctx.translate(point.x + recoil.x, point.y + recoil.y);
        ctx.scale(size, size);
        ctx.lineWidth = 2.4;
        polygon(
            ctx,
            [
                { x: -24, y: 3 },
                { x: -16, y: 0 },
                { x: 0, y: 6 },
                { x: 16, y: 0 },
                { x: 24, y: 4 },
                { x: 19, y: 19 },
                { x: 0, y: 26 },
                { x: -19, y: 19 },
            ],
            '#52413f',
            '#bb895f',
        );
        for (const side of [-1, 1]) {
            ellipse(ctx, side * 11, 11, 5.8, 4, '#312829');
            ellipse(ctx, side * 11, 10.5, 3.8, 2.1, tense ? '#fff6a5' : '#efa551');
        }
        polygon(
            ctx,
            [
                { x: 0, y: 5 },
                { x: 3.8, y: 10 },
                { x: 0, y: 15 },
                { x: -3.8, y: 10 },
            ],
            tense ? '#ffef8c' : '#ffd569',
        );
        line(
            ctx,
            [
                { x: -6, y: 19 },
                { x: 0, y: 17 },
                { x: 6, y: 19 },
            ],
            '#32272c',
            2.1,
        );
        for (const [x, y, h, sway] of [
            [-25, -7, 20, -9],
            [25, -7, 20, 9],
            [0, -10, 31, 0],
        ]) {
            const crown = [
                { x: x - 8, y: y + 3 },
                { x: x - 9, y: y - h * 0.38 },
                { x: x + sway, y: y - h },
                { x: x + 8, y: y - h * 0.42 },
                { x: x + 9, y: y + 1 },
                { x: x, y: y + 5 },
            ];
            polygon(ctx, crown, '#c26a4a', '#58413f');
            polygon(
                ctx,
                [crown[0], crown[1], crown[2], { x: x - 1, y: y - h * 0.38 }, crown[5]],
                '#ffd77d',
            );
            line(
                ctx,
                [
                    { x: x + sway * 0.46, y: y - h * 0.48 },
                    { x: x + sway, y: y - h + 3 },
                ],
                '#ffedb2',
                2.3,
            );
        }
        ctx.restore();
    }
    function drawDistantRock(body, anchor, radius) {
        const scale = radius / body.radius;
        ctx.drawImage(
            body.image,
            anchor.x + body.left * scale,
            anchor.y + body.top * scale,
            body.width * scale,
            body.height * scale,
        );
    }
    function longestEdge(points) {
        let best = 0,
            len = -1;
        for (let i = 0; i < points.length; i++) {
            const a = points[i],
                b = points[(i + 1) % points.length];
            const d = Math.hypot(a.x - b.x, a.y - b.y);
            if (d > len) {
                len = d;
                best = i;
            }
        }
        return best;
    }
    function shard(piece, state) {
        const pal = STONE[piece.ore] ?? STONE.plain;
        const cos = Math.cos(piece.angle),
            sin = Math.sin(piece.angle);
        const transform = (v) => ({
            x: piece.x + v.x * cos - v.y * sin,
            y: piece.y + v.x * sin + v.y * cos,
        });
        const points = piece.shape.map(transform);
        const cutEdge = longestEdge(piece.shape);
        const R = Math.max(4, piece.radius);
        const air = piece.z;
        // 공중에서 구르는 느낌: 꼭대기가 각도에 따라 기울어짐
        const tumble = {
            x: Math.cos(piece.angle * 1.7) * R * 0.16,
            y: Math.sin(piece.angle * 1.3) * R * 0.16,
        };
        ctx.save();
        if (!piece.collectible)
            ctx.globalAlpha = Math.max(0, Math.min(1, (piece.expiresAt - state.time) / 350));
        if (piece.collectible && air < 2) {
            const g = project(piece);
            const tone = minerals[piece.ore].light;
            ctx.lineWidth = 2.1;
            if (piece.ore !== 'stone') {
                ctx.globalAlpha = 0.27;
                ellipse(ctx, g.x, g.y + 4, Math.max(15, R * 1.2), Math.max(7, R * 0.54), tone);
                ctx.globalAlpha = 0.83;
                line(
                    ctx,
                    [
                        { x: g.x, y: g.y - 12 },
                        { x: g.x, y: g.y - 38 },
                    ],
                    tone,
                    2.6,
                );
                ctx.globalAlpha = 1;
            }
            ellipse(ctx, g.x, g.y + 3, Math.max(10, R * 0.95), Math.max(5, R * 0.42), null, tone);
        }
        boulder({
            points,
            baseZ: air,
            rimZ: air + 3,
            H: Math.max(5, Math.min(17, R * 0.55)),
            k: 0.42,
            capShift: tumble,
            palette: pal,
            shadowAlpha: Math.max(0.25, 1 - air / 70),
            outline: 1.5,
            isCut: (i) => i === cutEdge,
            details: piece.collectible
                ? ({ P, zAt, c }) => {
                      // 덩어리 위 광맥 한 점: 무엇을 주울지 바로 읽히게
                      const q = P(c, zAt(c) + 1);
                      crystalTuft(
                          q.x,
                          q.y,
                          Math.max(0.7, Math.min(1.2, R / 16)),
                          0.2,
                          R > 14 ? 2 : 1,
                          pal,
                      );
                      fractureDetail(piece, state, pal, (p) => {
                          const w = transform(p);
                          return P(w, zAt(w) + 1);
                      });
                  }
                : undefined,
        });
        ctx.restore();
    }
    function wall(obstacle) {
        const rnd = seeded(hashPoint(obstacle.x, obstacle.y));
        const points = Array.from({ length: 9 }, (_, i) => {
            const a = (i / 9) * TAU + (rnd() - 0.5) * 0.3;
            const r = obstacle.r * (0.84 + rnd() * 0.22);
            return {
                x: obstacle.x + Math.cos(a) * r,
                y: obstacle.y + Math.sin(a) * r,
            };
        });
        boulder({
            points,
            baseZ: 0,
            rimZ: 9,
            H: obstacle.r * 0.42,
            k: 0.48,
            palette: STONE.plain,
            details: ({ P, zAt, c }) => {
                // 이끼
                const q = P(c, zAt(c));
                ellipse(ctx, q.x + 3, q.y - 2, obstacle.r * 0.45, obstacle.r * 0.16, '#7da159');
                ellipse(ctx, q.x + 1, q.y - 4, obstacle.r * 0.25, obstacle.r * 0.08, '#a3c477');
            },
        });
    }
    function chargeTell(ore, time) {
        if (!ore.chargeDir || (ore.stage !== 'warn' && ore.stage !== 'charge')) return;
        const { x, y } = ore.chargeDir;
        const distance = ore.chargeDistance ?? 115;
        const width = Math.min(ore.r * 0.68, Math.sqrt(areaOf(ore.polygon) / Math.PI));
        const range = ore.stage === 'warn' ? distance : Math.min(distance, 26);
        const a = project({ x: ore.x + x * 8, y: ore.y + y * 8 });
        const b = project({ x: ore.x + x * range, y: ore.y + y * range });
        ctx.save();
        ctx.globalAlpha = ore.stage === 'warn' ? 0.38 + 0.12 * Math.sin(time / 67) : 0.34;
        line(ctx, [a, b], '#a64e29', width * 1.55);
        ctx.globalAlpha = ore.stage === 'warn' ? 0.9 : 0.7;
        for (const n of [0.5, 0.72, 0.94]) {
            const i = range * n;
            const head = project({ x: ore.x + x * i, y: ore.y + y * i });
            const edges = [-1, 1].map((side) =>
                project({
                    x: ore.x + x * (i - 9) - y * side * 9,
                    y: ore.y + y * (i - 9) + x * side * 9,
                }),
            );
            line(ctx, [edges[0], head, edges[1]], '#ffdc9b', 2.1);
        }
        ctx.restore();
    }
    function targetMarker(target, level) {
        const actor = target?.actor;
        if (!actor) return;
        const tier = minerals[actor.id]?.tier ?? 0;
        const scale = actor.polygon ? Math.sqrt(areaOf(actor.polygon) / Math.PI) : actor.radius;
        const p = project(actor, actor.z ?? 0);
        const radius = Math.max(13, Math.min(62, scale * 1.1 + 9));
        ctx.save();
        ctx.lineWidth = 2;
        ctx.strokeStyle = level < tier ? '#d6bd9a' : '#f5f6bf';
        ctx.globalAlpha = 0.75;
        for (const side of [0, Math.PI]) {
            ctx.beginPath();
            ctx.ellipse(p.x, p.y + 5, radius, radius * 0.49, 0, side - 0.46, side + 0.46);
            ctx.stroke();
        }
        ctx.restore();
    }
    const minerArt = Object.fromEntries(
        Object.entries({
            backpack: 'M -19,-35 Q -29,-34 -29,-24 L -29,-13 Q -27,-6 -17,-7 L -10,-11 -12,-34 Z',
            packFlap: 'M -27,-28 Q -23,-33 -14,-31 L -13,-25 Q -20,-22 -27,-24 Z',
            coat: 'M -13,-30 Q -3,-34 11,-29 Q 18,-24 18,-13 Q 18,-5 9,-4 L -9,-4 Q -18,-5 -18,-12 Q -19,-24 -13,-30 Z',
            bib: 'M -13,-18 Q 0,-21 13,-18 L 13,-8 Q 7,-3 -8,-5 L -14,-9 Z',
            face: 'M -17,-39 Q -18,-25 -10,-22 Q -1,-18 8,-21 Q 17,-24 17,-35 L 12,-42 -13,-43 Z',
            shell: 'M -20,-39 Q -22,-46 -17,-51 Q -11,-58 -1,-58 Q 12,-58 18,-48 L 20,-40 Q 9,-35 -20,-39 Z',
            brim: 'M -22,-41 Q -5,-43 18,-42 Q 24,-42 25,-38 Q 24,-35 17,-35 L -17,-36 Q -23,-36 -22,-41 Z',
            pickHead:
                'M -19,-27 Q -13,-34 -3,-35 Q 11,-36 18,-26 L 22,-19 13,-22 Q 6,-28 0,-28 Q -8,-29 -16,-23 L -22,-20 Z',
        }).map(([id, path]) => [id, new Path2D(path)]),
    );
    const miners = new WeakMap();
    function minerPart(id, color, outline, width = 2) {
        ctx.fillStyle = color;
        ctx.fill(minerArt[id]);
        if (outline) {
            ctx.lineWidth = width;
            ctx.strokeStyle = outline;
            ctx.stroke(minerArt[id]);
        }
    }
    function avatar(player, level, time, swingState, name = '나', labelLift = 0, attackPreview) {
        const { x, y } = project(player);
        const facing = screenDirection(
            attackPreview?.facing ?? { x: player.faceX, y: player.faceY },
        );
        const dead = player.hp === 0 && Number.isFinite(player.deadAt);
        const deathAge = dead ? Math.max(0, time - player.deadAt) : 0;
        const deathLength = dead
            ? Math.max(1, (player.respawnAt ?? player.deadAt + 900) - player.deadAt)
            : 1;
        const fall = dead
            ? reducedMotion.matches
                ? 1
                : 1 - (1 - Math.min(1, deathAge / Math.min(320, deathLength))) ** 3
            : 0;
        const fade = dead ? Math.min(1, Math.max(0, (deathAge / deathLength - 0.7) / 0.3)) : 0;
        let minerMotion = miners.get(player);
        if (
            !minerMotion ||
            time < minerMotion.time ||
            minerMotion.spawnRevision !== player.spawnRevision
        ) {
            minerMotion = {
                x,
                y,
                time,
                pausedMs: 0,
                stride: 0,
                walk: 0,
                side: facing.x < 0 ? -1 : 1,
                spawnRevision: player.spawnRevision,
            };
            miners.set(player, minerMotion);
        }
        if (time > minerMotion.time) {
            const paused = pausedBetween(
                minerMotion.time,
                time,
                player.hitstopAt,
                player.hitstopUntil,
            );
            const dt = time - minerMotion.time - paused;
            const traveled = Math.hypot(x - minerMotion.x, y - minerMotion.y);
            if (dt > 0) {
                const speed = traveled / dt;
                const target = traveled > 55 ? 0 : Math.min(1, speed * 5);
                minerMotion.walk += (target - minerMotion.walk) * (1 - Math.exp(-dt / 55));
                minerMotion.stride += traveled > 55 ? 0 : traveled / 5.4;
            }
            minerMotion.pausedMs += paused;
            Object.assign(minerMotion, { x, y, time });
        }
        const appearanceTime = time - minerMotion.pausedMs;
        if (Math.abs(facing.x) > 0.18) minerMotion.side = Math.sign(facing.x);
        const { side, walk, stride } = minerMotion;
        const step = dead ? 0 : Math.cos(stride) * walk;
        const breathing = dead ? 0 : Math.sin(appearanceTime / 390) * 0.5;
        const contactAt = swingState?.hitAt ?? swingState?.contactAt;
        const swingAge =
            !dead && swingState
                ? time < contactAt
                    ? time - contactAt
                    : Math.max(0, time - (swingState.holdUntil ?? contactAt))
                : Infinity;
        const windup =
            swingAge < 0 ? (time - swingState.at) / (swingState.contactAt - swingState.at) : 1;
        const recovery = !dead && swingState && swingAge >= 0 ? 1 - Math.min(1, swingAge / 145) : 0;
        const landed = swingState?.hitAt !== undefined && swingAge >= 0 && !dead;
        const brace = landed ? Math.max(0, 1 - swingAge / 120) : 0;
        const follow = Math.max(recovery ** 2, brace);
        const bounce =
            landed && swingAge > 37 && swingAge < 160
                ? Math.sin((Math.PI * (swingAge - 37)) / 123)
                : 0;
        const load = Math.max(
            attackPreview?.load ?? 0,
            swingAge < 0 ? Math.sin(Math.PI * windup) : 0,
        );
        const hurt = !dead && time - (player.hurtAt ?? -Infinity) < 220;
        const kickTime =
            time -
            pausedBetween(player.impact?.at ?? time, time, player.hitstopAt, player.hitstopUntil);
        const kick = recoil(dead ? null : player.impact, kickTime, 5.4);
        const ink = '#3d3230';
        const boot = '#614538';
        const lamp = '#fff4c6';
        const ore = pickaxes[level]?.color ?? pickaxes[0].color;

        ctx.save();
        ctx.globalAlpha *= 1 - fade;
        ellipse(ctx, x - side * fall * 13, y + 3, 24 + fall * 10, 7, '#31483e65');
        if (dead && !reducedMotion.matches && deathAge > 180 && deathAge < 410) {
            const dust = (deathAge - 180) / 230;
            puff(x - side * (20 + dust * 14), y + 3 - dust * 5, 4 + dust * 5, (1 - dust) * 0.38);
            ctx.globalAlpha = 1 - fade;
        }
        if (hurt) {
            ctx.lineWidth = 2;
            ellipse(ctx, x, y, 22, 9, null, '#fa8c6c');
        }
        ctx.save();
        if (!dead && hitstopBlink(time, player)) ctx.filter = hitstopBlinkFilter;
        ctx.translate(x + kick.x - side * 5 * fall, y + kick.y + 2 * fall);
        ctx.scale(side, 1);
        ctx.rotate(kick.x * side * 0.018 - fall * 1.48);
        ctx.lineWidth = 2;
        for (const [foot, cycle] of [
            [-9, step],
            [10, -step],
        ]) {
            const lift = Math.max(0, cycle) * 3;
            ellipse(ctx, foot + cycle * 4, -2 - lift, 7.4, 4.7, boot, ink);
            ellipse(ctx, foot + 2 + cycle * 4, -4 - lift, 3.5, 1.1, '#a37a46');
        }

        ctx.translate(
            7 * brace - 5 * load,
            -Math.abs(step) * 2 + breathing + 5 * brace - 3 * bounce,
        );
        ctx.rotate(0.31 * brace - 0.17 * load - 0.19 * bounce + step * 0.045);
        ctx.scale(1 + 0.08 * follow, 1 - 0.09 * follow);
        minerPart('backpack', '#427063', '#34473c');
        minerPart('packFlap', '#77926b', '#34473c', 1.5);
        line(
            ctx,
            [
                { x: -26, y: -22 },
                { x: -26, y: -16 },
            ],
            '#b1a67a',
            1.4,
        );
        ellipse(ctx, -19, -24, 2, 2.1, '#f0b85c', ink);
        minerPart('coat', name === '나' ? '#3c5766' : '#76565a', ink);
        minerPart('bib', name === '나' ? '#496e85' : '#9a7170', '#293b4c', 1.2);
        for (const strap of [-9, 8]) {
            line(
                ctx,
                [
                    { x: strap - 1, y: -24 },
                    { x: strap + 1, y: -14 },
                ],
                '#ceb07b',
                2.4,
            );
            ellipse(ctx, strap + 1, -14, 1.6, 1.5, '#f4cd79', '#634a33');
        }
        line(
            ctx,
            [
                { x: -3, y: -12 },
                { x: 4, y: -12 },
            ],
            '#98aab0',
            1.1,
        );
        minerPart('face', '#edb38c', ink);
        ellipse(ctx, 11, -27, 3.8, 1.9, '#e88372');

        const blink = appearanceTime % 2450 > 2340;
        if (dead) {
            ctx.beginPath();
            for (const eye of [-4, 7]) {
                ctx.moveTo(eye - 2, -33);
                ctx.lineTo(eye + 2, -29);
                ctx.moveTo(eye + 2, -33);
                ctx.lineTo(eye - 2, -29);
            }
            ctx.lineWidth = 1.7;
            ctx.strokeStyle = ink;
            ctx.stroke();
        } else if (hurt || follow > 0.4 || blink) {
            for (const eye of [-4, 7])
                line(
                    ctx,
                    [
                        { x: eye - 2.5, y: -31 },
                        { x: eye, y: -32.4 },
                        { x: eye + 2.5, y: -31 },
                    ],
                    ink,
                    1.8,
                );
        } else {
            ellipse(ctx, -4, -31.5, 1.9, 2.7, ink);
            ellipse(ctx, 7, -31.5, 1.9, 2.7, ink);
        }
        if (hurt) ellipse(ctx, 2, -25.5, 2.1, 2.5, '#784139');
        else
            line(
                ctx,
                [
                    { x: 0, y: -25 },
                    { x: 2, y: -24.3 },
                    { x: 4, y: -25.1 },
                ],
                '#714337',
                1.35,
            );

        const localMiner = name === '나';
        if (!localMiner)
            polygon(
                ctx,
                [
                    { x: -12, y: -49 },
                    { x: -23, y: -59 },
                    { x: -24, y: -67 },
                    { x: -16, y: -63 },
                    { x: -8, y: -57 },
                ],
                '#ea927d',
                ink,
            );
        minerPart('shell', localMiner ? '#efb63d' : '#68bcb2', ink, 2.55);
        line(
            ctx,
            [
                { x: -15, y: -47 },
                { x: -10, y: -52 },
                { x: -4, y: -54 },
            ],
            localMiner ? '#ffe397' : '#baf4e1',
            2.7,
        );
        line(
            ctx,
            [
                { x: -15, y: -42 },
                { x: -4, y: -41 },
                { x: 5, y: -42 },
            ],
            '#a96c28',
            2,
        );
        minerPart('brim', localMiner ? '#fac650' : '#7ed5c5', ink);
        ctx.lineWidth = 2;
        ellipse(ctx, 10, -45, 7.8, 7.2, '#635744', ink);
        ellipse(ctx, 10, -45, 4.8, 4.5, lamp, '#c09548');
        ellipse(ctx, 8.5, -46.5, 1.7, 1.4, '#fffdf0');

        ctx.save();
        const hand = { x: 16 + brace * 8 - load * 7, y: -14 - load * 9 - bounce * 11 };
        const arm = [{ x: 7, y: -17 }, { x: 14, y: hand.y + 5 }, hand];
        line(ctx, arm, ink, 12);
        line(ctx, arm, '#7397a0', 7);
        ctx.translate(hand.x, hand.y);
        const direction = Math.atan2(facing.x * side, -facing.y);
        const angle =
            !dead && attackPreview
                ? 1.08 + (direction - 1.85 - 1.08) * load
                : !dead && swingState
                  ? direction -
                    load * 1.85 +
                    (landed ? 0.07 * brace - 1.05 * bounce : recovery * 0.44)
                  : 1.08;
        if (!attackPreview && swingAge >= -10 && swingAge <= 60) {
            ctx.save();
            const sweep = Math.max(0, 1 - Math.max(0, swingAge) / 60);
            const head = angle - Math.PI / 2 + 0.24;
            ctx.globalAlpha = sweep;
            ctx.beginPath();
            ctx.arc(0, 0, 44, head - 1.52, head);
            ctx.arc(0, 0, 38, head - 0.13, head - 1.5, true);
            ctx.closePath();
            ctx.fillStyle = '#fff5d8';
            ctx.fill();
            ctx.globalAlpha = sweep * 0.72;
            ctx.beginPath();
            ctx.arc(0, 0, 49, head - 1.18, head - 0.04);
            ctx.lineWidth = 1.4;
            ctx.strokeStyle = '#f5bd66';
            ctx.stroke();
            ctx.restore();
        }
        ctx.rotate(angle);
        line(
            ctx,
            [
                { x: 0, y: 12 },
                { x: 0, y: -32 },
            ],
            ink,
            6,
        );
        line(
            ctx,
            [
                { x: 0, y: 10 },
                { x: 0, y: -32 },
            ],
            '#b88350',
            3.7,
        );
        minerPart('pickHead', ore, ink, 2.15);
        line(
            ctx,
            [
                { x: -12, y: -29 },
                { x: -4, y: -32 },
                { x: 5, y: -32 },
            ],
            '#fff0bca0',
            1.6,
        );
        ellipse(ctx, 0, 0, 5.1, 4, '#e7be88', ink);
        if (follow > 0.29) ellipse(ctx, -0.2, 8, 3.8, 3.1, '#e7be88', ink);
        ctx.restore();
        ctx.restore();
        ctx.restore();

        if (dead) return;
        label(ctx, name, x, y - 69 - labelLift, 16, localMiner ? '#fff6db' : '#b9f0e7');
        if (Number.isFinite(player.maxHp)) {
            const width = 48;
            const slot = width / player.maxHp;
            ctx.fillStyle = '#342c32';
            ctx.fillRect(x - width / 2 - 3, y - 94 - labelLift, width + 4, 12);
            for (let i = 0; i < player.maxHp; i++) {
                ctx.fillStyle =
                    i < player.hp
                        ? player.hp === 1
                            ? '#ff785e'
                            : localMiner
                              ? '#9fe084'
                              : '#82d8c8'
                        : '#73505b';
                ctx.fillRect(x - width / 2 + slot * i, y - 91 - labelLift, slot - 2, 6);
            }
        }
    }
    // 흙먼지 한 뭉치(부드러운 원 몇 개)
    function puff(x, y, r, alpha) {
        if (alpha <= 0) return;
        ctx.globalAlpha = alpha;
        ellipse(ctx, x, y, r, r * 0.62, '#e4d8bd');
        ellipse(ctx, x - r * 0.35, y - r * 0.12, r * 0.6, r * 0.42, '#f1e8d2');
        ellipse(ctx, x + r * 0.3, y + r * 0.1, r * 0.55, r * 0.36, '#cbbd9f');
        ctx.globalAlpha = 1;
    }
    function impactBurst(mark, age, palette) {
        const strength = Math.max(0.4, Math.min(1.4, mark.strength ?? 1));
        const blocked = mark.kind === 'clink';
        const detached = mark.kind === 'split';
        const axis = screenDirection(mark.direction);
        const dx = blocked ? -axis.x : axis.x;
        const dy = blocked ? -axis.y : axis.y;
        const ground = project(mark);
        const height = mark.z ?? (mark.kind === 'slam' ? 7 : FACE_Z);
        const contact = { x: ground.x, y: ground.y - height };
        const warm = mark.kind === 'hurt';
        const bright = blocked ? '#d7eef0' : warm ? '#ffb88f' : '#fffbe8';
        const glow = blocked ? '#80aab5' : warm ? '#e16949' : '#e7a751';
        const duration = detached ? 140 : 95;
        const flash = Math.max(0, 1 - age / duration);
        if (flash > 0) {
            const span = (7 + strength * (detached ? 19 : 13)) * (1.2 - flash * 0.34);
            ctx.globalAlpha = flash * 0.95;
            const point = (forward, across) => ({
                x: contact.x + (dx * forward - dy * across) * span,
                y: contact.y + (dy * forward + dx * across) * span,
            });
            const flare = [
                point(1, 0),
                point(0.16, 0.17),
                point(0.02, 0.71),
                point(-0.2, 0.15),
                point(-0.65, -0.08),
                point(-0.2, -0.16),
                point(-0.03, -0.63),
                point(0.18, -0.13),
            ];
            polygon(ctx, flare, glow);
            polygon(
                ctx,
                [point(0.76, 0), point(0, 0.31), point(-0.44, -0.03), point(0, -0.27)],
                bright,
            );
        }
        if ((mark.kind === 'cut' || mark.kind === 'finisher') && age < 275) {
            const t = Math.max(0, age / 275);
            const heat = 1 - t;
            const radius = 14 + (1 - heat ** 1.8) * 48;
            const x = contact.x,
                y = contact.y;
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = heat * 0.58;
            const halo = ctx.createRadialGradient(x, y, 2, x, y, 34 + radius * 0.4);
            halo.addColorStop(0, '#ffcf65');
            halo.addColorStop(0.32, '#ff9a3980');
            halo.addColorStop(1, '#ff9a3900');
            ellipse(ctx, x, y, 34 + radius * 0.4, 34 + radius * 0.4, halo);
            ctx.globalAlpha = heat ** 2 * 0.83;
            ctx.lineWidth = 2.8 * heat + 0.7;
            ellipse(
                ctx,
                x + dx * radius * 0.18,
                y + dy * radius * 0.18,
                radius,
                radius * 0.62,
                null,
                '#ffcf5b',
            );
            if (age > 35) {
                ctx.globalAlpha = heat * 0.42;
                ctx.lineWidth = 1.3;
                ellipse(ctx, x, y, radius * 0.72, radius * 0.49, null, '#fff0ab');
            }
            const brightCoreMs = mark.kind === 'finisher' ? 78 : 55;
            if (age < brightCoreMs) {
                const flash = (1 - age / brightCoreMs) ** 0.7;
                ctx.globalAlpha = flash * 0.93;
                const angle = Math.atan2(dy, dx);
                polygon(
                    ctx,
                    Array.from({ length: 16 }, (_, i) => {
                        const a = angle + (i * Math.PI) / 8;
                        const r = i % 2 ? 6 : (i % 4 ? 21 : 32) * (0.7 + flash * 0.3);
                        return { x: x + Math.cos(a) * r, y: y + Math.sin(a) * r };
                    }),
                    '#fff8cc',
                );
            }
            const sparks = seeded(hashPoint(mark.x, mark.y));
            for (let i = 0; i < 15; i++) {
                const angle = (i / 15) * Math.PI * 2 + (sparks() - 0.5) * 0.6;
                const travel = (20 + sparks() * 55) * (1 - heat ** 2) + 6;
                const vx = Math.cos(angle),
                    vy = Math.sin(angle);
                const tx = x + vx * travel + dx * t * 15;
                const ty = y + vy * travel - t * (1 - t) * 26;
                ctx.globalAlpha = heat ** 1.35 * 0.93;
                line(
                    ctx,
                    [
                        { x: tx - vx * (6 + heat * 8), y: ty - vy * (6 + heat * 8) },
                        { x: tx, y: ty },
                    ],
                    i % 3 ? '#ffbe4e' : '#fff7d0',
                    1 + heat * 1.8,
                );
            }
            ctx.restore();
        }
        const dustAge = age / 350;
        if (!blocked && dustAge < 1) {
            const spread = (9 + (detached ? 40 : 24) * dustAge) * strength;
            const alpha = (1 - dustAge) ** 2 * 0.42 * strength;
            for (const side of [-1, 0, 1]) {
                puff(
                    contact.x + spread * (dx * 0.63 - dy * side * 0.55),
                    contact.y + spread * (dy * 0.63 + dx * side * 0.55) - dustAge * 9,
                    (3 + dustAge * (detached ? 11 : 6)) * strength,
                    alpha,
                );
            }
        }
        const rnd = seeded(hashPoint(mark.x, mark.y) ^ mark.at);
        const count = blocked ? 7 : Math.round((detached ? 12 : 7) + strength * 5);
        for (let i = 0; i < count; i++) {
            const spark = blocked || i % 3 === 0;
            const forward = (12 + rnd() * (detached ? 58 : 42)) * strength;
            const side = (rnd() - 0.5) * (30 + strength * 24);
            const lift = 24 + rnd() * 42;
            const life = spark ? 130 + rnd() * 60 : 270 + rnd() * 115;
            const u = age / life;
            if (u >= 1) continue;
            const vx = dx * forward - dy * side;
            const vy = dy * forward + dx * side;
            const step = 1 - (1 - u) ** 1.55;
            const x = ground.x + vx * step;
            const y = ground.y + vy * step - Math.max(0, height + lift * u - 82 * u * u);
            ctx.globalAlpha = 1 - u ** 2;
            if (spark) {
                line(
                    ctx,
                    [
                        { x: x - vx * 0.13, y: y - vy * 0.13 + 3 },
                        { x, y },
                    ],
                    bright,
                    1.4 + strength * 0.5,
                );
                continue;
            }
            const size = 1.5 + strength;
            polygon(
                ctx,
                [
                    { x: x - size, y: y + size * 0.55 },
                    { x: x + vx * 0.035, y: y - size },
                    { x: x + size, y: y + size * 0.4 },
                ],
                i % 2 ? palette.cutDeep : palette.grain,
            );
        }
        ctx.globalAlpha = 1;
    }
    function groundPulse(mark, time) {
        if (mark.kind === 'corePulseWarn' || mark.kind === 'corePulse') {
            const warning = mark.kind === 'corePulseWarn';
            const t = (time - mark.at) / (warning ? mark.durationMs : 470);
            if (t < 0 || t >= 1) return;
            const c = project(mark);
            const rx = layout.turned ? tilt : 1;
            const ry = layout.turned ? 1 : tilt;
            const hue = mark.innerRadius ? '#ffca88' : '#b5edff';
            ctx.save();
            ctx.globalAlpha = warning ? 0.19 + t * 0.16 : (1 - t) * 0.64;
            ctx.fillStyle = hue;
            ctx.beginPath();
            ctx.ellipse(c.x, c.y, mark.radius * rx, mark.radius * ry, 0, 0, Math.PI * 2);
            if (mark.innerRadius)
                ctx.ellipse(
                    c.x,
                    c.y,
                    mark.innerRadius * rx,
                    mark.innerRadius * ry,
                    0,
                    0,
                    Math.PI * 2,
                );
            ctx.fill('evenodd');
            ctx.globalAlpha = warning ? 0.9 : 1 - t;
            ctx.lineWidth = warning ? 4 : 12 * (1 - t);
            for (const radius of [mark.innerRadius, mark.radius]) {
                if (radius) ellipse(ctx, c.x, c.y, radius * rx, radius * ry, null, hue);
            }
            if (warning) {
                label(ctx, mark.innerRadius ? '안쪽으로!' : '바깥으로!', c.x, c.y + 44, 20, hue);
            } else if (!reducedMotion.matches) {
                for (const [i, { x, y }] of ringPoints(mark.radius * 0.83, 12, 0.33).entries()) {
                    const peak = project({ x: mark.x + x, y: mark.y + y });
                    ctx.globalAlpha = (1 - t) ** 2;
                    facetSpire(ctx, peak.x, peak.y, 7 + (i % 3) * 2, 24 + (i % 4) * 12, [
                        hue,
                        '#fff3d1',
                        '#5f5c86',
                        '#fffdf4',
                    ]);
                }
            }
            ctx.restore();
            return;
        }
        const falling = mark.kind === 'bossFallWarn' || mark.kind === 'bossFall';
        const gold = mark.kind === 'goldBurstWarn' || mark.kind === 'goldBurst';
        if (falling || gold || mark.kind === 'collapseWarn' || mark.kind === 'collapse') {
            const age = time - mark.at;
            const warning = mark.kind.endsWith('Warn');
            const phase = age / (warning ? mark.durationMs : 325);
            if (phase < 0 || phase >= 1) return;
            const point = project(mark);
            const radius = warning ? mark.radius : mark.radius * (0.7 + 0.48 * phase);
            const rx = radius * (layout.turned ? tilt : 1);
            const ry = radius * (layout.turned ? 1 : tilt);
            ctx.save();
            ctx.globalAlpha = warning ? 0.15 + phase * 0.24 : (1 - phase) * 0.55;
            ellipse(
                ctx,
                point.x,
                point.y,
                rx,
                ry,
                warning ? (falling ? '#cc71c7' : gold ? '#b35529' : '#d6543d') : '#eecb80',
            );
            ctx.globalAlpha = warning ? 0.8 : (1 - phase) * 0.9;
            ctx.lineWidth = warning ? 3 : 5 * (1 - phase) + 1;
            ctx.setLineDash(warning ? [12, 7] : []);
            ellipse(
                ctx,
                point.x,
                point.y,
                rx,
                ry,
                null,
                warning ? (falling ? '#ffe0f6' : gold ? '#fff0a0' : '#ff835f') : '#ffeabd',
            );
            ctx.setLineDash([]);
            if (warning) {
                ellipse(ctx, point.x, point.y, rx * phase, ry * phase, null, '#ffbb79');
                if (!gold)
                    label(
                        ctx,
                        falling ? '낙석' : '붕괴',
                        point.x,
                        point.y + ry - 12,
                        22,
                        falling ? '#ffe2ff' : gold ? '#fff0a2' : '#ffbc9c',
                    );
            }
            ctx.restore();
            return;
        }
        if (mark.kind !== 'split' && mark.kind !== 'slam' && mark.kind !== 'hurt') return;
        const age = time - mark.at;
        const t = age / 320;
        if (t < 0 || t >= 1) return;
        const p = project(mark);
        const axis = screenDirection(mark.direction);
        const size = (10 + 35 * (1 - (1 - t) ** 2)) * (mark.strength ?? 1);
        const color = mark.kind === 'hurt' ? '#ebaf81' : '#fff0bf';
        ctx.save();
        ctx.globalAlpha = (1 - t) ** 2 * 0.69;
        ctx.lineWidth = 1.4 + (1 - t) * 1.75;
        ellipse(
            ctx,
            p.x + axis.x * size * 0.17,
            p.y + axis.y * size * 0.17,
            size,
            size * 0.48,
            null,
            color,
        );
        ctx.restore();
    }
    function effect(mark, time) {
        if (mark.kind === 'swing') return;
        const age = time - mark.at,
            t =
                age /
                (mark.kind === 'bossAssist' || mark.kind === 'goldChain' ? mark.durationMs : 580),
            color = minerals[mark.ore] ?? minerals.stone,
            pal = STONE[mark.ore] ?? STONE.plain,
            p = project(mark);
        if (t < 0 || t >= 1) return;
        ctx.save();
        if (
            mark.kind === 'cut' ||
            mark.kind === 'bossPlate' ||
            mark.kind === 'bossCoreHit' ||
            mark.kind === 'finisher' ||
            mark.kind === 'clink' ||
            mark.kind === 'split' ||
            mark.kind === 'slam'
        ) {
            impactBurst(mark, age, pal);
            if (mark.kind === 'bossPlate' || mark.kind === 'bossCoreHit') {
                ctx.globalAlpha = 1 - t ** 2;
                label(
                    ctx,
                    mark.kind === 'bossPlate' ? '−1장' : '−1',
                    p.x,
                    p.y - 71 - 37 * t,
                    25,
                    '#fff3b0',
                );
            }
        } else if (mark.kind === 'goldChain') {
            impactBurst(mark, age, pal);
            ctx.globalAlpha = 1 - t;
            label(ctx, '연쇄 파쇄', p.x, p.y - 49 - t * 34, 22, '#fff3ad');
        } else if (mark.kind === 'bossAssist') {
            const partner = project(mark.target);
            const middle = { x: (p.x + partner.x) * 0.5, y: (p.y + partner.y) * 0.5 };
            ctx.globalAlpha = 1 - t ** 2;
            line(ctx, [p, { x: middle.x, y: middle.y - 29 }, partner], '#90f8d6', 6 - 4 * t);
            ellipse(ctx, p.x, p.y, 23 + 12 * t, 14 + 8 * t, null, '#d1ffe4');
            ellipse(ctx, partner.x, partner.y, 23 + 12 * t, 14 + 8 * t, null, '#d1ffe4');
            label(
                ctx,
                mark.healed ? '협동 반격 · 회복' : '협동 반격',
                middle.x,
                middle.y - 44 - t * 15,
                23,
                '#d3ffec',
            );
        } else if (mark.kind === 'bossFall') {
            const size = mark.radius * (0.28 + t * 0.48);
            ctx.globalAlpha = (1 - t) ** 1.6;
            for (const side of [-1, 1]) {
                const x = side * size;
                const fall = t < 0.23 ? 99 * (1 - t / 0.23) : 0;
                line(
                    ctx,
                    [
                        { x: p.x + x * 0.6, y: p.y - 97 - fall },
                        { x: p.x + x, y: p.y - fall },
                    ],
                    '#ffcb96',
                    9 * (1 - t),
                );
                polygon(
                    ctx,
                    [
                        { x: p.x + x - 19, y: p.y - fall - 22 },
                        { x: p.x + x - 5, y: p.y - fall - 51 },
                        { x: p.x + x + 19, y: p.y - fall - 17 },
                        { x: p.x + x + 7, y: p.y - fall },
                    ],
                    '#ffe09e',
                    '#493752',
                );
            }
        } else if (mark.kind === 'goldBurst') {
            ctx.globalAlpha = (1 - t) ** 1.6;
            for (const [i, { x, y }] of ringPoints(mark.radius * (0.45 + 0.55 * t), 8).entries()) {
                const spark = project({ x: mark.x + x, y: mark.y + y });
                facetSpire(ctx, spark.x, spark.y, 5, 13 + (i % 3) * 5, goldSparkColors);
            }
        } else if (
            mark.kind === 'bossOpen' ||
            mark.kind === 'bossCoreOpen' ||
            mark.kind === 'passage' ||
            mark.kind === 'expeditionReturn'
        ) {
            const radius = 12 + (mark.kind === 'bossCoreOpen' ? 170 : 46) * t;
            ctx.globalAlpha = 1 - t;
            ctx.lineWidth = 3 * (1 - t) + 1;
            ellipse(ctx, p.x, p.y - 8, radius, radius * 0.6, null, '#a2efd6');
        } else if (mark.kind === 'bait') {
            const direction = screenDirection(mark.direction);
            const side = { x: -direction.y, y: direction.x };
            const distance = 18 + t * 74;
            const width = 14 + t * 28;
            ctx.globalAlpha = (1 - t) ** 2;
            for (const offset of [0, 21, 42]) {
                const x = p.x + direction.x * (distance - offset);
                const y = p.y + direction.y * (distance - offset) - (mark.z ?? 0);
                line(
                    ctx,
                    [
                        { x: x - side.x * width, y: y - side.y * width },
                        { x: x + direction.x * 20, y: y + direction.y * 20 },
                        { x: x + side.x * width, y: y + side.y * width },
                    ],
                    '#ffdb86',
                    5 - t * 2.5,
                );
            }
        } else if (mark.kind === 'collect') {
            ctx.globalAlpha = Math.max(0, 1 - t);
            const a = project(mark, 7),
                b = project(mark.target, 22),
                u = Math.min(1, age / 260);
            const x = a.x + (b.x - a.x) * u,
                y = a.y + (b.y - a.y) * u - Math.sin(u * Math.PI) * 34;
            polygon(
                ctx,
                [
                    { x: x - 6, y: y + 2 },
                    { x: x - 2, y: y - 5 },
                    { x: x + 6, y: y - 2 },
                    { x: x + 3, y: y + 4 },
                ],
                pal.mid,
                pal.line,
            );
            ellipse(ctx, x, y - 1, 2, 2, color.light);
            if (u > 0.75)
                label(ctx, `+${mark.amount ?? 1}`, b.x - 11, b.y - 23 - u * 12, 21, color.light);
        } else if (mark.kind === 'hurt') {
            impactBurst(mark, age, pal);
            ctx.globalAlpha = Math.max(0, 1 - t ** 3);
            const push = screenDirection(mark.direction);
            const x = p.x + push.x * 29 * t;
            const y = p.y - 44 - t * 32;
            ctx.fillStyle = '#532b3e';
            ctx.fillRect(x - 17, y - 15, 34, 29);
            label(ctx, `−${mark.amount ?? 1}`, x, y + 1, 27, '#ffae94');
        } else if (mark.kind === 'upgrade') {
            ctx.globalAlpha = Math.max(0, 1 - t);
            ctx.lineWidth = 2.4;
            ellipse(ctx, p.x, p.y - 18, 5 + 27 * t, 5 + 27 * t, null, color.light);
            label(ctx, '개조 완료!', p.x, p.y - 54 - t * 14, 20, color.light);
        }
        ctx.restore();
    }
    const arenaRunes = ringPoints(319, 12, 0.28);
    function paintFightBowl(state, boss) {
        const center = project(worldCenter);
        if (!isVisible(center, 480)) return;
        const rx = layout.turned ? tilt : 1;
        const ry = layout.turned ? 1 : tilt;
        const armored = boss.bossPlates > 0;
        const unstable = !armored && state.expedition.boss.coreHp === 1;
        const hue = armored ? '#f39380' : unstable ? '#ed83ae' : '#79dcfb';
        const still = reducedMotion.matches;
        ctx.save();
        ellipse(
            ctx,
            center.x,
            center.y,
            378 * rx,
            378 * ry,
            armored ? '#261e3c9c' : unstable ? '#391f46b5' : '#132b46b5',
        );
        ctx.lineWidth = 3;
        ellipse(
            ctx,
            center.x,
            center.y,
            337 * rx,
            337 * ry,
            null,
            armored ? '#b477846f' : '#67b5ea86',
        );
        for (const [i, rune] of arenaRunes.entries()) {
            const point = project({ x: worldCenter.x + rune.x, y: worldCenter.y + rune.y });
            const pulse = still ? 0.5 : (Math.cos(state.time / 265 - i * 0.6) + 1) * 0.5;
            ctx.globalAlpha = 0.28 + pulse * 0.5;
            facetSpire(ctx, point.x, point.y, 8, 17 + pulse * 21, [
                hue,
                '#fff1d0',
                '#2b2944',
                '#ecfff4',
            ]);
            if (!still) ellipse(ctx, point.x - 3, point.y - 33 - pulse * 19, 2.8, 4.2, hue);
            if (i % 2 === 0) {
                const outside = project({
                    x: worldCenter.x + rune.x * 1.3,
                    y: worldCenter.y + rune.y * 1.3,
                });
                const elbow = {
                    x: (point.x + outside.x) * 0.5 - 12,
                    y: (point.y + outside.y) * 0.5 + 8,
                };
                const track = [point, elbow, outside];
                ctx.globalAlpha = (unstable ? 0.45 : 0.24) + pulse * 0.24;
                line(ctx, track, hue, 5);
                line(ctx, track, '#fce8e2', 1.4);
                ellipse(ctx, outside.x, outside.y - 9 - pulse * 10, 3.5, 5, hue);
            }
        }
        ctx.restore();
    }
    let victoryMark;
    function paintCalderaVictory(state) {
        const at = state.expedition?.victoryAtMs;
        if (at == null) return;
        const age = state.time - at;
        if (age < 0 || age >= 5600) return;
        victoryMark = state.marks.find((mark) => mark.kind === 'bossVictory') ?? victoryMark;
        const point = project(victoryMark?.at === at ? victoryMark : worldCenter);
        if (!isVisible(point, 300)) return;
        ctx.save();
        const slow = reducedMotion.matches;
        if (age < 760 && !slow) {
            for (const delay of [0, 120]) {
                const u = (age - delay) / 640;
                if (u < 0 || u >= 1) continue;
                const radius = 28 + 265 * (1 - (1 - u) ** 2);
                const rx = radius * (layout.turned ? tilt : 1);
                const ry = radius * (layout.turned ? 1 : tilt);
                ctx.globalAlpha = (1 - u) * 0.86;
                ctx.lineWidth = 6 - 4 * u;
                ellipse(ctx, point.x, point.y, rx, ry, null, delay ? '#bafaf5' : '#fff4a4');
                ctx.globalAlpha = (1 - u) ** 3 * 0.25;
                ellipse(ctx, point.x, point.y, rx, ry, '#fff2bc');
            }
        }
        if (age < 1450 && !slow) {
            const u = age / 1450;
            ctx.globalAlpha = Math.min(1, age / 120) * (1 - u) ** 0.7;
            for (let i = 0; i < 10; i++) {
                const angle = (i * TAU) / 10 + 0.3;
                const x = Math.cos(angle) * (52 + u * 175);
                const y = Math.sin(angle) * (29 + u * 82);
                const rise = Math.sin(Math.PI * Math.sqrt(u)) * (91 + (i % 3) * 35);
                const tip = { x: point.x + x, y: point.y + y - rise };
                const tint = i % 2 ? '#b3f4ee' : '#ffe28d';
                line(
                    ctx,
                    [
                        { x: tip.x - x * 0.49, y: tip.y + 33 },
                        { x: tip.x - x * 0.21 + Math.sin(u * 8 + i) * 12, y: tip.y + 12 },
                        tip,
                    ],
                    tint,
                    3.6 - 2 * u,
                );
                polygon(
                    ctx,
                    [
                        { x: tip.x, y: tip.y - 8 },
                        { x: tip.x + 5, y: tip.y },
                        { x: tip.x, y: tip.y + 8 },
                        { x: tip.x - 5, y: tip.y },
                    ],
                    '#fffae7',
                );
            }
        }
        const rewardGlow = Math.max(0, Math.min((age - 330) / 370, (5600 - age) / 1700, 1));
        ctx.globalAlpha = rewardGlow * 0.63;
        for (const [i, { x, y }] of arenaRunes.entries()) {
            const rune = project({ x: worldCenter.x + x, y: worldCenter.y + y });
            const height = slow ? 51 : 38 + Math.cos(age / 381 - i * 0.8) * 24;
            line(ctx, [rune, { x: rune.x - 11, y: rune.y - height }], '#9ff9df', 4);
            ellipse(ctx, rune.x, rune.y, 13, 7, '#76cfb9');
        }
        ctx.globalAlpha = Math.min(1, age / 160, (5600 - age) / 650);
        label(ctx, '대광맥 격파!', point.x, point.y - 119, 37, '#fff6bd');
        ctx.restore();
    }
    let latestLevel;
    let diamondAt = -Infinity;
    function paintDiamondUpgrade(state, point) {
        if (state.level < 5) diamondAt = -Infinity;
        if (state.level === 5 && latestLevel !== undefined && latestLevel < 5)
            diamondAt = state.time;
        latestLevel = state.level;
        const age = state.time - diamondAt;
        if (!state.player.hp || age < 0 || age >= 5100) return;
        ctx.save();
        ctx.globalAlpha = Math.min(1, (5100 - age) / 900);
        const h = reducedMotion.matches ? 125 : 125 + Math.sin(age / 220) * 6;
        facetSpire(ctx, point.x, point.y - h, 21, 40, ['#50c8cb', '#d6ffef', '#296b83', '#fffdf1']);
        label(ctx, '다이아 곡괭이 완성!', point.x, point.y - h - 51, 23, '#d2fff0');
        ctx.restore();
    }
    // 파편이 땅에 닿는 순간: 낮게 퍼지는 먼지 + 작은 튐(무게)
    const lastZ = new WeakMap();
    let landings = [];
    function trackLandings(shards, time) {
        for (const s of shards) {
            const prev = lastZ.get(s);
            if (prev !== undefined && prev > 0.8 && s.z <= 0.01)
                landings.push({
                    x: s.x,
                    y: s.y,
                    at: time,
                    size: Math.max(6, s.radius),
                    ore: s.ore,
                });
            lastZ.set(s, s.z);
        }
        landings = landings.filter((l) => time - l.at >= 0 && time - l.at < 420);
    }
    function landing(l, time) {
        const t = (time - l.at) / 420;
        const p = project(l);
        ctx.save();
        const spread = l.size * (0.7 + t * 0.9);
        for (const side of [-1, -0.4, 0.4, 1])
            puff(
                p.x + side * spread,
                p.y + 2 - t * 5,
                3 + l.size * 0.22 * (0.6 + t),
                0.5 * (1 - t) ** 1.3,
            );
        ctx.globalAlpha = 0.35 * (1 - t);
        ellipse(ctx, p.x, p.y + 3, spread * 1.1, spread * 0.38, null, '#5d5340');
        ctx.restore();
    }
    function isVisible(p, padding) {
        const { w, h, scale, ox, oy } = layout;
        const x = p.x * scale + ox;
        const y = p.y * scale + oy;
        const margin = padding * scale;
        return x >= -margin && x <= w + margin && y >= -margin && y <= h + margin;
    }

    const actors = [];
    function addActors(items, kind, margin) {
        for (const item of items) {
            const p = project(item);
            const padding = margin ?? item.r * 1.35 + 18;
            if (isVisible(p, padding + (item.z ?? 0))) actors.push({ a: item, kind, p });
        }
    }

    function draw(state, now = performance.now()) {
        rockBakes = 0;
        updateQuality(now);
        measure(state);
        shakeCamera(state);
        const { w, h, dpr, scale, ox, oy } = layout;
        const worldW = layout.turned ? layout.bounds.height * tilt : layout.bounds.width;
        const worldH = layout.turned ? layout.bounds.width : layout.bounds.height * tilt;
        const coversScreen =
            ox <= 0 && oy <= 0 && ox + worldW * scale >= w && oy + worldH * scale >= h;
        if (!state.bounds || !coversScreen) {
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            const ground = ctx.createRadialGradient(
                w * 0.49,
                h * 0.43,
                25,
                w * 0.49,
                h * 0.52,
                Math.max(w, h) * 0.72,
            );
            ground.addColorStop(0, '#577e59');
            ground.addColorStop(1, '#2d4a37');
            ctx.fillStyle = ground;
            ctx.fillRect(0, 0, w, h);
        }
        ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.lineWidth = 1.5;
        if (state.bounds) paintOnlineGround(state);
        else basePaint();
        for (const landmark of landmarks) paintLandmark(state, landmark);
        if (state.expedition && state.bounds) {
            for (const landmark of expeditionLandmarks) paintLandmark(state, landmark);
            for (const passage of state.expedition.passages ?? [])
                paintPassage(passage, state.player);
        }
        const fight = state.bounds && state.expedition?.boss && state.rocks.find((ore) => ore.boss);
        if (fight) paintFightBowl(state, fight);
        for (const mark of state.marks) {
            if (isVisible(project(mark), Math.max(120, mark.radius ?? 0)))
                groundPulse(mark, state.time);
        }
        for (const ore of state.rocks) {
            if (ore.chargeDir && isVisible(project(ore), (ore.chargeDistance ?? 115) + ore.r))
                chargeTell(ore, state.time);
        }
        targetMarker(state.target, state.level);
        const playerScreen = project(state.player);
        const bossScreen = fight && project(fight);
        actors.length = 0;
        addActors(state.rocks, 'rock');
        addActors(state.obstacles, 'wall', 110);
        addActors(state.shards, 'shard', 75);
        if (state.others) addActors(state.others, 'other', 125);
        collectScenery(state);
        actors.push({ a: state.player, kind: 'player', p: playerScreen });
        actors.sort((a, b) => a.p.y - b.p.y);
        for (const { a, kind, p } of actors) {
            if (kind === 'rock') {
                const behindFight =
                    fight && !a.boss && !a.guardian && a.uid !== state.target?.actor.uid;
                if (behindFight) ctx.globalAlpha = a.lode === 'arena' ? 0.83 : 0.46;
                rock(a, state);
                if (behindFight) ctx.globalAlpha = 1;
            }
            if (kind === 'wall') wall(a);
            if (kind === 'shard') shard(a, state);
            if (kind === 'scenery') drawScenery(a, p);
            if (kind === 'player')
                avatar(a, state.level, state.time, state.swing, '나', 0, state.attackPreview);
            if (kind === 'other') {
                const lift =
                    Math.abs(p.x - playerScreen.x) < 69 && Math.abs(p.y - playerScreen.y) < 39
                        ? 38
                        : 0;
                avatar(a, a.level, state.time, a.swing, '광부 ' + String(a.id).slice(-4), lift);
            }
        }
        trackLandings(state.shards, state.time);
        for (const l of landings) {
            if (isVisible(project(l), 120)) landing(l, state.time);
        }
        for (const m of state.marks) {
            if (isVisible(project(m), 160)) effect(m, state.time);
        }
        if (
            bossScreen &&
            state.player.hp &&
            bossScreen.y > playerScreen.y &&
            bossScreen.y - playerScreen.y < (fight.bossPlates ? 128 : 168) &&
            Math.abs(bossScreen.x - playerScreen.x) < (fight.bossPlates ? 86 : 123)
        ) {
            ctx.lineWidth = 2.3;
            ellipse(ctx, playerScreen.x, playerScreen.y, 20, 10, '#28344090', '#fff2c8');
            label(ctx, '나', playerScreen.x, playerScreen.y - 19, 14, '#fff2c8');
        }
        paintCalderaVictory(state);
        paintDiamondUpgrade(state, playerScreen);
    }
    // Allocate and touch the real backing surface before network playback starts.
    const initialDpr = canvasDpr();
    measureViewport(initialDpr);
    mainContext.setTransform(initialDpr, 0, 0, initialDpr, 1, 1);
    mainContext.fillStyle = '#2d4a37';
    mainContext.fillRect(0, 0, 1, 1);

    return {
        draw,
        renderScale: () => backingScales[qualityLevel],
        screenAngle(vector) {
            const projected = screenDirection(vector);
            return Math.atan2(projected.y, projected.x);
        },
        stickVector({ x, y }) {
            const vector = layout?.turned ? { x: -y, y: x / tilt } : { x, y: y / tilt };
            const scale = Math.hypot(x, y) / (Math.hypot(vector.x, vector.y) || 1);
            return { x: vector.x * scale, y: vector.y * scale };
        },
        worldVector(x, y) {
            return layout?.turned ? { x: -y, y: x } : { x, y };
        },
    };
}
