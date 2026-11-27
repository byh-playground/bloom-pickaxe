import { board, minerals, pickaxes, crackGrowthMs } from './fracture-world.js';

const tilt = 0.8;
const TAU = Math.PI * 2;
const turf = { light: '#aac477', deep: '#88ab67', ink: '#425f46' };
const impactShake = { cut: 0.66, split: 1.65, slam: 1.22, hurt: 2.1 };
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

    function measure(state) {
        const dpr = Math.max(
            0.75,
            Math.min(2, devicePixelRatio || 1) * backingScales[qualityLevel],
        );
        if (viewportDirty || viewport?.dpr !== dpr) measureViewport(dpr);
        const { w, turned, worldW, worldH, top, availableH, scale } = viewport;
        const bounds = state.bounds ?? board;
        const cameraX = turned ? state.player.y * tilt : state.player.x;
        const cameraY = turned ? bounds.width - state.player.x : state.player.y * tilt;
        layout = {
            ...viewport,
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
                if (kind < 7) {
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
        const pal = STONE[ore.id] ?? STONE.plain;
        const time = state.time;
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
        const distantKey =
            !nearby &&
            !ore.boss &&
            ore.geometryRevision === 0 &&
            ore.stage === 'roam' &&
            !bodyRecoil.x &&
            !bodyRecoil.y &&
            (age < 0 || age >= 90)
                ? ore.id + ':' + layout.turned
                : null;
        const distant = distantRockCache.get(distantKey);
        if (distant) {
            drawDistantRock(distant, anchor, ore.r);
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
        const options = () => ({
            points: local.map(toWorld),
            heightPoints: local,
            baseZ: 0,
            rimZ: FACE_Z,
            H,
            k: rockCapScale,
            palette: pal,
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
        const stable = !active && !bodyRecoil.x && !bodyRecoil.y && (age < 0 || age >= 90);
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
        if (!nearby && !ore.boss) return;
        const badge = project(center, Math.min(52, R * 0.47 + 21));
        const armed = ore.cracks?.some((crack) => crack.armed);
        const name = ore.boss ? '대광맥' : color.name;
        label(
            ctx,
            armed ? '금 간 ' + name : name,
            badge.x,
            badge.y,
            15,
            armed ? '#ffde82' : color.light,
        );
        if (nearby && state.level < color.tier)
            label(ctx, pickaxes[color.tier].name + ' 필요', badge.x, badge.y + 17, 11, '#ffedbd');
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
            ctx.lineWidth = 1.4;
            ellipse(
                ctx,
                g.x,
                g.y + 3,
                Math.max(10, R * 0.95),
                Math.max(5, R * 0.42),
                null,
                '#fff3c899',
            );
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
    function avatar(player, level, time, swingState, name = '나', labelLift = 0) {
        const { x, y } = project(player);
        const facing = screenDirection({ x: player.faceX, y: player.faceY });
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
                swingState?.hitAt,
                swingState?.holdUntil,
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
        const load = swingAge < 0 ? Math.max(0, Math.sin(Math.PI * windup)) : 0;
        const hurt = !dead && time - (player.hurtAt ?? -Infinity) < 220;
        const kickTime =
            time -
            pausedBetween(
                player.impact?.at ?? time,
                time,
                swingState?.hitAt,
                swingState?.holdUntil,
            );
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

        minerPart('shell', '#efb63d', ink, 2.25);
        line(
            ctx,
            [
                { x: -15, y: -47 },
                { x: -10, y: -52 },
                { x: -4, y: -54 },
            ],
            '#ffe397',
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
        minerPart('brim', '#fac650', ink);
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
            !dead && swingState
                ? direction -
                  load * 1.85 +
                  (landed ? 0.07 * brace - 1.05 * bounce : recovery * 0.44)
                : 1.08;
        if (swingAge >= -10 && swingAge <= 60) {
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
        label(ctx, name, x, y - 69 - labelLift, 14, name === '나' ? '#fff6db' : '#ffecb6');
        if (Number.isFinite(player.maxHp)) {
            const width = 39;
            const slot = width / player.maxHp;
            for (let i = 0; i < player.maxHp; i++) {
                ctx.fillStyle = i < player.hp ? '#ffba88' : '#5d443c';
                ctx.fillRect(x - width / 2 + slot * i, y - 81 - labelLift, slot - 2, 4);
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
        if (mark.kind === 'cut' && age < 275) {
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
            if (age < 106) {
                const flash = (1 - age / 106) ** 0.7;
                ctx.globalAlpha = flash * 0.93;
                const angle = Math.atan2(dy, dx);
                polygon(
                    ctx,
                    Array.from({ length: 16 }, (_, i) => {
                        const a = angle + (i * Math.PI) / 8;
                        const r = i % 2 ? 7 : (i % 4 ? 26 : 38) * (0.7 + flash * 0.3);
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
            t = age / 580,
            color = minerals[mark.ore] ?? minerals.stone,
            pal = STONE[mark.ore] ?? STONE.plain,
            p = project(mark);
        if (t < 0 || t >= 1) return;
        ctx.save();
        if (
            mark.kind === 'cut' ||
            mark.kind === 'clink' ||
            mark.kind === 'split' ||
            mark.kind === 'slam'
        ) {
            impactBurst(mark, age, pal);
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
                label(ctx, `+${mark.amount ?? 1}`, b.x - 11, b.y - 23 - u * 12, 17, color.light);
        } else if (mark.kind === 'hurt') {
            impactBurst(mark, age, pal);
            ctx.globalAlpha = Math.max(0, 1 - t * 1.6);
            label(ctx, `−${mark.amount ?? 1}`, p.x, p.y - 42 - t * 22, 20, '#ffac92');
        } else if (mark.kind === 'upgrade') {
            ctx.globalAlpha = Math.max(0, 1 - t);
            ctx.lineWidth = 2.4;
            ellipse(ctx, p.x, p.y - 18, 5 + 27 * t, 5 + 27 * t, null, color.light);
            label(ctx, '개조 완료!', p.x, p.y - 54 - t * 14, 20, color.light);
        }
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
        for (const mark of state.marks) {
            if (isVisible(project(mark), 120)) groundPulse(mark, state.time);
        }
        for (const ore of state.rocks) {
            if (ore.chargeDir && isVisible(project(ore), (ore.chargeDistance ?? 115) + ore.r))
                chargeTell(ore, state.time);
        }
        targetMarker(state.target, state.level);
        const playerScreen = project(state.player);
        actors.length = 0;
        addActors(state.rocks, 'rock');
        addActors(state.obstacles, 'wall', 110);
        addActors(state.shards, 'shard', 75);
        if (state.others) addActors(state.others, 'other', 125);
        actors.push({ a: state.player, kind: 'player', p: playerScreen });
        actors.sort((a, b) => a.p.y - b.p.y);
        for (const { a, kind, p } of actors) {
            if (kind === 'rock') rock(a, state);
            if (kind === 'wall') wall(a);
            if (kind === 'shard') shard(a, state);
            if (kind === 'player') avatar(a, state.level, state.time, state.swing);
            if (kind === 'other') {
                const lift =
                    Math.abs(p.x - playerScreen.x) < 68 && Math.abs(p.y - playerScreen.y) < 23
                        ? 27
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
    }
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
