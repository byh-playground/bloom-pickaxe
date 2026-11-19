import { mapSize, projectionTilt as TILT, referenceCamera, regions } from './map-layout.js';

const HALF_WIDTH = mapSize.width / 2;
const HALF_HEIGHT = mapSize.height / 2;
const MARK_SPACING = 34;
const ORE_PALETTES = [
    { light: '#ffd28b', mid: '#db9650', deep: '#965937', glint: '#fff1b6' },
    { light: '#abe8ed', mid: '#50add0', deep: '#377392', glint: '#e4fff6' },
    { light: '#f3c6e8', mid: '#cc83b3', deep: '#895777', glint: '#fff0f2' },
    { light: '#f9cf7e', mid: '#dc7c55', deep: '#895468', glint: '#fff0ac' },
];
const PICKAXES = ['#c1ccd2', '#ffcf7f', '#83dee3', '#f5b7e8'];

function path(ctx, points, color, outline = null, width = 1) {
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
    ctx.closePath();
    if (color) {
        ctx.fillStyle = color;
        ctx.fill();
    }
    if (outline) {
        ctx.strokeStyle = outline;
        ctx.lineWidth = width;
        ctx.stroke();
    }
}

function oval(ctx, x, y, rx, ry, color, stroke = null, width = 1) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    if (color) {
        ctx.fillStyle = color;
        ctx.fill();
    }
    if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = width;
        ctx.stroke();
    }
}

function segment(ctx, x1, y1, x2, y2, color, width) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
}

function rounded(ctx, x, y, width, height, radius, fill) {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    ctx.fillStyle = fill;
    ctx.fill();
}

function label(ctx, text, x, y, color, font, outline) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = font;
    if (outline) {
        ctx.lineWidth = 3;
        ctx.strokeStyle = outline;
        ctx.strokeText(text, x, y);
    }
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
}

function textId(value) {
    return [...String(value)].reduce(
        (hash, digit) => (Math.imul(hash, 31) + digit.charCodeAt(0)) | 0,
        0,
    );
}

function* terrainMarks(limits) {
    const left = Math.max(-HALF_WIDTH, limits.x - limits.width);
    const right = Math.min(HALF_WIDTH, limits.x + limits.width);
    const top = Math.max(-HALF_HEIGHT * TILT, limits.y - limits.height);
    const bottom = Math.min(HALF_HEIGHT * TILT, limits.y + limits.height);
    for (
        let row = Math.floor(top / MARK_SPACING);
        row <= Math.floor(bottom / MARK_SPACING);
        row++
    ) {
        for (
            let col = Math.floor(left / MARK_SPACING);
            col <= Math.floor(right / MARK_SPACING);
            col++
        ) {
            yield terrainMark(col, row);
        }
    }
}

function terrainMark(col, row) {
    let randomState = Math.imul(col, 73856093) ^ Math.imul(row, 19349663) ^ 9527;
    const random = () => {
        randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
        return randomState / 4294967296;
    };
    return {
        x: (col + random()) * MARK_SPACING,
        y: (row + random()) * MARK_SPACING,
        kind: random(),
        size: 0.6 + random() * 0.8,
    };
}

function drawGrass(ctx, x, y, size, color) {
    ctx.beginPath();
    ctx.moveTo(x - 3 * size, y - 3 * size);
    ctx.quadraticCurveTo(x - 1 * size, y - 3 * size, x, y);
    ctx.quadraticCurveTo(x + 1 * size, y - 8 * size, x + 3 * size, y - 7 * size);
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 3 * size, y - 4 * size, x + 5 * size, y - 3 * size);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2 * size;
    ctx.stroke();
}

function drawGround(ctx, state, elapsed, limits) {
    const groundHeight = HALF_HEIGHT * TILT;
    rounded(
        ctx,
        -HALF_WIDTH - 22,
        -groundHeight - 12,
        HALF_WIDTH * 2 + 44,
        groundHeight * 2 + 58,
        34,
        '#49694f',
    );
    rounded(
        ctx,
        -HALF_WIDTH - 10,
        -groundHeight + 13,
        HALF_WIDTH * 2 + 20,
        groundHeight * 2 + 26,
        29,
        '#a38252',
    );
    rounded(
        ctx,
        -HALF_WIDTH - 10,
        -groundHeight + 7,
        HALF_WIDTH * 2 + 20,
        groundHeight * 2 + 24,
        28,
        '#cca670',
    );
    const grass = ctx.createLinearGradient(0, -groundHeight, 0, groundHeight);
    grass.addColorStop(0, '#9bbc70');
    grass.addColorStop(0.54, '#b9d487');
    grass.addColorStop(1, '#a3c176');
    rounded(ctx, -HALF_WIDTH, -groundHeight, HALF_WIDTH * 2, groundHeight * 2, 21, grass);

    const nearCenter =
        Math.abs(limits.x) < limits.width + 215 && Math.abs(limits.y) < limits.height + 165;
    const focal = nearCenter ? regions.boss : regions.meadow;
    const focalY = focal.y * TILT;
    const groundGlow = ctx.createRadialGradient(focal.x, focalY, 27, focal.x, focalY, 310);
    groundGlow.addColorStop(0, nearCenter ? '#ece3a7aa' : '#deed9c99');
    groundGlow.addColorStop(1, '#ede7b200');
    oval(ctx, focal.x, focalY, 320, 240, groundGlow);

    for (const { x, y, kind, size } of terrainMarks(limits)) {
        if (Math.abs(x - limits.x) > limits.width || Math.abs(y - limits.y) > limits.height)
            continue;
        if (Math.abs(x) > HALF_WIDTH - 8 || Math.abs(y) > groundHeight - 8) continue;
        if ((x / 109) ** 2 + (y / 77) ** 2 < 1) continue;
        if (kind < 0.32) {
            oval(ctx, x, y, 2.8 * size, 1.35 * size, '#7c965477');
        } else if (kind < 0.64) {
            drawGrass(ctx, x, y, size, '#779951aa');
        } else if (kind < 0.86) {
            oval(ctx, x, y, 7 * size, 3.5 * size, '#dce6a955');
            oval(ctx, x - 2 * size, y - size, 2.8 * size, size, '#f1efc759');
        } else {
            drawGrass(ctx, x, y, size, '#71944b');
            const hue = kind > 0.93 ? '#fff1b0' : '#f4e1ef';
            for (let i = 0; i < 4; i++) {
                const angle = Math.PI * (i / 2);
                oval(
                    ctx,
                    x + Math.cos(angle) * 2.2 * size,
                    y - 6 * size + Math.sin(angle) * 2.2 * size,
                    1.7 * size,
                    1.4 * size,
                    hue,
                );
            }
            oval(ctx, x, y - 6 * size, 1.3 * size, 1.1 * size, '#dca961');
        }
    }

    if (!nearCenter) return;
    oval(ctx, 0, 5, 108, 79, '#7e775657');
    oval(ctx, 0, 0, 105, 75, '#b49a70', '#806f52', 3);
    oval(ctx, 0, -2, 96, 66, '#d5bf89', '#ead19c', 3);
    oval(ctx, 0, -3, 76, 53, null, '#b49464', 1.6);
    oval(ctx, 0, -3, 64, 45, '#cbaa7855', '#ecdbad', 2);
    for (let i = 0; i < 10; i++) {
        const angle = (Math.PI * 2 * i) / 10;
        const x = Math.cos(angle) * 87;
        const y = Math.sin(angle) * 60;
        path(
            ctx,
            [
                [x, y - 4],
                [x + 5, y],
                [x, y + 4],
                [x - 5, y],
            ],
            '#997c58',
        );
    }
    if (Number.isFinite(state.bossNextAt)) {
        const remaining = Math.max(0, Math.ceil((state.bossNextAt - elapsed) / 1000));
        label(ctx, `보스 등장 ${remaining}초`, 0, -23, '#614f3b', '800 15px system-ui');
    }
    label(ctx, '광맥의 심장', 0, 54, '#71563d', '800 12px system-ui');
}

function gem(ctx, x, y, height, width, colors, phase) {
    const a = [x, y - height];
    const b = [x + width * 0.38, y - height * 0.48];
    const c = [x + width * 0.32, y];
    const d = [x - width * 0.32, y + height * 0.015];
    const e = [x - width * 0.38, y - height * 0.51];
    path(ctx, [a, b, c, d, e], colors.mid, '#69544477', 1);
    path(ctx, [a, [x + phase * width * 0.12, y - height * 0.52], d, e], colors.light);
    path(ctx, [[x + phase * width * 0.12, y - height * 0.52], b, c, d], colors.deep);
    segment(
        ctx,
        x - width * 0.11,
        y - height * 0.65,
        x - width * 0.2,
        y - height * 0.48,
        colors.glint,
        1.4,
    );
}

function bar(ctx, x, y, width, ratio, color) {
    rounded(ctx, x - width / 2, y, width, 6, 3, '#55493cba');
    if (ratio > 0) rounded(ctx, x - width / 2 + 1, y + 1, (width - 2) * ratio, 4, 2, color);
}

function drawOre(ctx, ore, time, recentHit) {
    const boss = ore.boss || ore.tier === 3;
    const tier = boss ? 3 : ore.tier;
    const colors = ORE_PALETTES[tier] ?? ORE_PALETTES[0];
    const width = boss ? 106 : 31 + tier * 4;
    const height = boss ? 93 : 29 + tier * 6;
    const phase = time / (boss ? 270 : 150) + (textId(ore.id) % 31);
    const bob = Math.sin(phase) * (boss ? 3 : 1.6);
    const hitAge = time - (recentHit?.at ?? -Infinity);
    const shake = hitAge >= 0 && hitAge < 140 ? Math.sin(hitAge / 11) * 3 * (1 - hitAge / 140) : 0;
    const { x } = ore;
    const y = ore.y * TILT;
    oval(ctx, x, y, width * 0.57, width * 0.21, '#50644544');
    ctx.save();
    ctx.translate(x + shake, y - Math.abs(bob));

    const foot = boss ? 13 : 5;
    oval(ctx, -width * 0.33, -2 + bob * 0.35, foot, foot * 0.43, colors.deep);
    oval(ctx, width * 0.33, -2 - bob * 0.35, foot, foot * 0.43, colors.deep);

    const top = [-width * 0.19, -height * 0.75];
    const rightTop = [width * 0.3, -height * 0.73];
    const right = [width * 0.51, -height * 0.36];
    const rightBase = [width * 0.36, -3];
    const leftBase = [-width * 0.39, -3];
    const left = [-width * 0.53, -height * 0.36];
    const middle = [width * 0.06, -height * 0.5];
    const outline = [top, rightTop, right, rightBase, leftBase, left];
    path(ctx, outline, colors.mid, '#755445ad', boss ? 3 : 1.8);
    path(ctx, [left, top, rightTop, middle], colors.light);
    path(ctx, [middle, rightTop, right, rightBase, [width * 0.24, -height * 0.23]], colors.deep);
    path(ctx, [leftBase, left, middle, [width * 0.24, -height * 0.23], rightBase], colors.mid);
    segment(
        ctx,
        -width * 0.42,
        -height * 0.35,
        -width * 0.18,
        -height * 0.48,
        colors.light,
        boss ? 4 : 2,
    );

    gem(ctx, -width * 0.22, -height * 0.58, height * 0.41, width * 0.46, colors, -1);
    gem(ctx, width * 0.18, -height * 0.64, height * (boss ? 0.57 : 0.43), width * 0.47, colors, 1);
    if (boss || tier > 0)
        gem(ctx, width * 0.36, -height * 0.35, height * 0.32, width * 0.33, colors, -1);

    const blink = Math.sin(phase * 0.44) > 0.988 ? 0.3 : 1;
    const eye = boss ? 5 : 2.1;
    for (const side of [-1, 1]) {
        const eyeX = width * (side * 0.12 - 0.08);
        oval(ctx, eyeX, -height * 0.23, eye, eye * blink * 1.12, '#4c3740');
        if (blink === 1)
            oval(ctx, eyeX + eye * 0.34, -height * 0.24, eye * 0.32, eye * 0.31, '#fff5d5');
    }
    ctx.restore();
    if (boss || ore.hp < ore.maxHp) {
        const topY = y - height * (boss ? 1.41 : 1.27);
        if (boss)
            label(ctx, '대광맥 골렘', x, topY - 13, '#563c37', '900 16px system-ui', '#fff0c5');
        bar(
            ctx,
            x,
            topY,
            boss ? 102 : width,
            Math.max(0, Math.min(1, ore.hp / ore.maxHp)),
            boss ? '#ee9272' : colors.glint,
        );
    }
}

function drawPickaxe(ctx, x, y, angle, metal) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    segment(ctx, 0, 8, 0, -16, '#644c36', 4.5);
    segment(ctx, 0, 6, 0, -15, '#c99f69', 2);
    path(
        ctx,
        [
            [-13, -9],
            [-8, -18],
            [0, -21],
            [9, -18],
            [15, -10],
            [5, -14],
            [0, -13],
            [-6, -15],
        ],
        metal,
        '#594c46',
        1.4,
    );
    segment(ctx, -5, -18, 5, -18, '#fffbde', 1.6);
    ctx.restore();
}

function drawPlayer(ctx, player, self, time) {
    const x = player.x;
    const y = player.y * TILT;
    const facing = Math.atan2((player.faceY ?? 0) * TILT, player.faceX ?? 1);
    const side = Math.cos(facing) < 0 ? -1 : 1;
    const swingLeft = player.swingUntil - time;
    const progress = Math.min(1, Math.max(0, 1 - swingLeft / 250));
    const swinging = swingLeft > 0;
    const mantle = self ? '#477d67' : '#6877a0';
    const scarf = self ? '#db744f' : '#dc9a61';
    const metal = PICKAXES[player.level] ?? PICKAXES.at(-1);
    ctx.save();
    if (player.online === false) ctx.globalAlpha = 0.48;
    oval(ctx, x, y + 1, 20, 8, '#50644544');
    if (self) oval(ctx, x, y + 1, 23, 10, null, '#fcf3c3', 1.5);
    oval(ctx, x - 7, y - 3, 6.4, 4.2, '#5a4238');
    oval(ctx, x + 7, y - 3, 6.4, 4.2, '#5a4238');
    oval(ctx, x, y - 13, 13, 11, mantle, '#484e46', 1.7);
    oval(ctx, x + side * 7, y - 15, 6, 5, '#f6d6aa');
    oval(ctx, x, y - 21, 11.6, 4, scarf);
    oval(ctx, x, y - 29, 11.7, 11, '#f4d4a4', '#6b5643', 1.5);
    oval(ctx, x + side * 4, y - 28, 1.4, 2, '#523e36');
    oval(ctx, x + side * 7, y - 28, 1.3, 1.9, '#523e36');
    oval(ctx, x - side * 3, y - 25, 2.3, 1.2, '#e3a581');
    oval(ctx, x - 0.5, y - 37, 11.7, 7, '#b68b51', '#715638', 1.4);
    oval(ctx, x + 1, y - 33, 15, 3.8, '#d6ab66', '#886639', 1.2);
    oval(ctx, x + side * 6, y - 36, 2.7, 2.7, '#fff0aa');
    segment(ctx, x + side, y - 40, x + side * 5, y - 45, '#5d8e54', 2);
    drawPickaxe(
        ctx,
        x + side * 15,
        y - 14,
        swinging ? facing + 0.05 + progress * 1.7 : side * 0.36,
        metal,
    );
    if (swinging) {
        ctx.beginPath();
        ctx.ellipse(x, y - 10, 38 + progress * 7, 24, 0, facing - 0.63, facing + 0.68);
        ctx.strokeStyle = `rgba(255,249,207,${Math.max(0, 0.72 * (1 - progress))})`;
        ctx.lineWidth = 3.2;
        ctx.stroke();
    }
    label(
        ctx,
        player.name || (self ? '나' : '광부'),
        x,
        y - 57,
        '#4b4733',
        '800 11px system-ui',
        '#fff5d7',
    );
    ctx.restore();
}

function drawEvent(ctx, event, time) {
    const age = Math.max(0, time - event.at);
    const life = event.kind === 'hit' ? 280 : 600;
    const progress = age / life;
    if (progress >= 1) return;
    const { x, tier } = event;
    const y = event.y * TILT;
    const colors = ORE_PALETTES[tier] ?? ORE_PALETTES[0];
    const size = tier === 3 ? 1.65 : 1;
    ctx.save();
    ctx.globalAlpha = (1 - progress) ** 1.15;
    if (event.kind !== 'hit')
        oval(
            ctx,
            x,
            y + 1,
            (13 + progress * 46) * size,
            (7 + progress * 29) * size,
            null,
            colors.glint,
            2.8,
        );
    for (let i = 0; i < (event.kind === 'hit' ? 5 : 9); i++) {
        const angle = i * 2.39996 + (textId(event.id) % 21);
        const dist = (7 + progress * (19 + i * 3)) * size;
        const sx = x + Math.cos(angle) * dist;
        const sy = y - 16 + Math.sin(angle) * dist * 0.65 - progress * 21;
        const w = (2 + (i % 3)) * size * (1 - progress * 0.5);
        path(
            ctx,
            [
                [sx, sy - w],
                [sx + w, sy],
                [sx, sy + w],
                [sx - w, sy],
            ],
            i % 2 ? colors.glint : colors.mid,
        );
    }
    ctx.restore();
}

export function createView(canvas, { drawTerrain, drawOverlay, fitScale } = {}) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D is unavailable');
    let scale = 1;

    function render(state, selfId, camera) {
        const bounds = canvas.getBoundingClientRect();
        const width = Math.max(1, bounds.width);
        const height = Math.max(1, bounds.height);
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const actualWidth = Math.round(width * dpr);
        const actualHeight = Math.round(height * dpr);
        if (canvas.width !== actualWidth || canvas.height !== actualHeight) {
            canvas.width = actualWidth;
            canvas.height = actualHeight;
        }
        const elapsed = state.now;
        scale = fitScale
            ? fitScale(width, height)
            : width < 600
              ? Math.max(0.76, width / 540)
              : Math.min(referenceCamera.zoom, width / 840);
        const originX = width / 2;
        const originY = height * 0.55;
        const cameraX = camera.x;
        const cameraY = camera.y;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        const backdrop = ctx.createLinearGradient(0, 0, 0, height);
        backdrop.addColorStop(0, '#769962');
        backdrop.addColorStop(1, '#4d7458');
        ctx.fillStyle = backdrop;
        ctx.fillRect(0, 0, width, height);
        ctx.translate(originX - cameraX * scale, originY - cameraY * TILT * scale);
        ctx.scale(scale, scale);
        const limits = {
            x: cameraX,
            y: cameraY * TILT,
            width: width / (2 * scale) + 90,
            height: height / (2 * scale) + 120,
        };
        drawGround(ctx, state, elapsed, limits);
        drawTerrain?.(ctx, state, limits);
        const actors = [
            ...state.players.map((player) => ({ player, y: player.y })),
            ...state.ores.map((ore) => ({ ore, y: ore.y })),
        ];
        actors.sort((a, b) => a.y - b.y);
        const events = state.events ?? [];
        for (const { player, ore } of actors) {
            const actor = player ?? ore;
            if (
                Math.abs(actor.x - cameraX) > limits.width ||
                Math.abs(actor.y * TILT - limits.y) > limits.height
            )
                continue;
            if (player) {
                drawPlayer(ctx, player, player.id === selfId, elapsed);
            } else {
                let lastHit;
                for (const event of events) {
                    if (
                        event.kind === 'hit' &&
                        (event.x - ore.x) ** 2 + (event.y - ore.y) ** 2 < 324
                    )
                        lastHit = event;
                }
                drawOre(ctx, ore, elapsed, lastHit);
            }
        }
        for (const event of events) drawEvent(ctx, event, elapsed);
        drawOverlay?.(ctx, state, limits);
    }

    return {
        render,
        panDelta(dx, dy) {
            return { x: dx / scale, y: dy / (scale * TILT) };
        },
    };
}
