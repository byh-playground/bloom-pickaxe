// 곡갱이 연쇄 시험장 렌더러. 월드(920×600)는 위에서 본 지면 좌표이고,
// 화면에서는 지면 위에 몸통을 세워 그리는 2.5D로 보인다.
// 세로로 긴 화면에서는 판 전체를 90° 돌려 더 크게 보이게 한다(스프라이트는 똑바로 선다).

const WORLD_W = 920;
const WORLD_H = 600;
const WALL = 16; // 판 둘레 돌담 두께(월드 단위)
const SQUASH = 0.62; // 그림자·바닥 원의 세로 눌림
const TRAIL_MS = 140;

const ORE = [
    // 0 구리: 무겁고 둥근 덩어리
    { light: '#ffd28b', mid: '#db9650', deep: '#965937', glint: '#fff1b6', name: '구리' },
    // 1 청석: 매끈하고 납작한 얼음 판
    { light: '#c6f2f3', mid: '#5ab6d6', deep: '#33708f', glint: '#f2ffff', name: '청석' },
    // 2 자수정: 뾰족한 결정 다발, 잘 갈라짐
    { light: '#f6cdec', mid: '#c77fb4', deep: '#7f4e78', glint: '#fff2f8', name: '자수정' },
    // 3 이상: 황금
    { light: '#ffe49a', mid: '#e3a845', deep: '#8f5a2c', glint: '#fffbd8', name: '황금' },
];
const MINE = { mantle: '#477d67', scarf: '#e07a4f', ring: '#ffe7a3' };
const RIVAL = { mantle: '#6b7fb4', scarf: '#f0b65e', ring: '#cdd6f5' };
const OUTLINE = '#4f3a33';
// 곡갱이 머리: 강화 단계 = 재질(0 철, 1 청석, 2 자수정, 3 황금)
const PICK_METAL = ['#c1ccd2', ORE[1].mid, ORE[2].mid, ORE[3].mid];

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const tierColors = (tier) => ORE[clamp(tier | 0, 0, ORE.length - 1)];

function seeded(seed) {
    let s = seed >>> 0 || 1;
    return () => {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        return s / 4294967296;
    };
}
function hashId(value) {
    let h = 7;
    for (const ch of String(value)) h = (Math.imul(h, 31) + ch.charCodeAt(0)) | 0;
    return h >>> 0;
}

function oval(ctx, x, y, rx, ry, fill, stroke, width = 1) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), 0, 0, Math.PI * 2);
    if (fill) {
        ctx.fillStyle = fill;
        ctx.fill();
    }
    if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = width;
        ctx.stroke();
    }
}
function poly(ctx, pts, fill, stroke, width = 1) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    if (fill) {
        ctx.fillStyle = fill;
        ctx.fill();
    }
    if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = width;
        ctx.stroke();
    }
}
function line(ctx, x1, y1, x2, y2, color, width) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
}
function text(ctx, value, x, y, color, size, weight = 900, outline = '#fff6da') {
    ctx.font = `${weight} ${size}px 'Malgun Gothic', 'Apple SD Gothic Neo', system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (outline) {
        ctx.lineWidth = Math.max(2, size * 0.24);
        ctx.strokeStyle = outline;
        ctx.strokeText(value, x, y);
    }
    ctx.fillStyle = color;
    ctx.fillText(value, x, y);
}

/* ───────── 바닥(캐시) ───────── */

function paintGround(ctx, w, h) {
    // 돌담 바깥 그림자
    ctx.fillStyle = '#1f3a2a66';
    ctx.beginPath();
    ctx.roundRect(-WALL - 4, -WALL + 6, w + WALL * 2 + 8, h + WALL * 2 + 6, 26);
    ctx.fill();
    // 돌담 옆면·윗면
    ctx.fillStyle = '#7d7466';
    ctx.beginPath();
    ctx.roundRect(-WALL, -WALL + 5, w + WALL * 2, h + WALL * 2, 22);
    ctx.fill();
    ctx.fillStyle = '#b7ad98';
    ctx.beginPath();
    ctx.roundRect(-WALL, -WALL, w + WALL * 2, h + WALL * 2, 22);
    ctx.fill();
    // 돌담 돌 무늬
    const rnd = seeded(4021);
    const stones = (x0, y0, x1, y1) => {
        const len = Math.hypot(x1 - x0, y1 - y0);
        for (let d = 8; d < len; d += 22 + rnd() * 10) {
            const t = d / len;
            const x = x0 + (x1 - x0) * t;
            const y = y0 + (y1 - y0) * t;
            oval(ctx, x, y, 8 + rnd() * 3, 5 + rnd() * 1.5, rnd() > 0.5 ? '#c9bfa9' : '#a99f8b');
        }
    };
    stones(-WALL / 2, -WALL / 2, w + WALL / 2, -WALL / 2);
    stones(-WALL / 2, h + WALL / 2, w + WALL / 2, h + WALL / 2);
    stones(-WALL / 2, 0, -WALL / 2, h);
    stones(w + WALL / 2, 0, w + WALL / 2, h);

    // 잔디판: 담 안쪽 그늘 + 결
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, 12);
    ctx.clip();
    const grass = ctx.createLinearGradient(0, 0, 0, h);
    grass.addColorStop(0, '#8fb167');
    grass.addColorStop(0.5, '#a8c878');
    grass.addColorStop(1, '#97b86c');
    ctx.fillStyle = grass;
    ctx.fillRect(0, 0, w, h);

    // 큰 결(잔디 깎은 줄) — 공간을 읽히게 하는 옅은 띠
    ctx.globalAlpha = 0.16;
    for (let i = 0; i < 9; i++) {
        ctx.fillStyle = i % 2 ? '#c7dd93' : '#7ea25a';
        ctx.fillRect(0, (h / 9) * i, w, h / 9);
    }
    ctx.globalAlpha = 1;

    // 흙 자국
    const r2 = seeded(777);
    for (let i = 0; i < 9; i++) {
        const x = r2() * w;
        const y = r2() * h;
        const s = 18 + r2() * 26;
        oval(ctx, x, y, s, s * 0.55, '#b9a06d55');
        oval(ctx, x - s * 0.2, y - s * 0.1, s * 0.55, s * 0.28, '#d7c08a44');
    }
    // 풀·꽃
    const r3 = seeded(1203);
    for (let i = 0; i < 260; i++) {
        const x = r3() * w;
        const y = r3() * h;
        const k = r3();
        const sz = 0.7 + r3() * 0.7;
        if (k < 0.55) {
            ctx.beginPath();
            ctx.moveTo(x - 3 * sz, y - 2 * sz);
            ctx.quadraticCurveTo(x - sz, y - 2 * sz, x, y);
            ctx.quadraticCurveTo(x + sz, y - 7 * sz, x + 3 * sz, y - 6 * sz);
            ctx.moveTo(x, y);
            ctx.quadraticCurveTo(x + 3 * sz, y - 3 * sz, x + 5 * sz, y - 2 * sz);
            ctx.strokeStyle = '#6f9349aa';
            ctx.lineWidth = 1.2 * sz;
            ctx.stroke();
        } else if (k < 0.85) {
            oval(ctx, x, y, 2.6 * sz, 1.3 * sz, '#76924f66');
        } else {
            const petal = k > 0.94 ? '#fff1b0' : '#f6e3f0';
            for (let p = 0; p < 4; p++) {
                const a = (Math.PI / 2) * p;
                oval(
                    ctx,
                    x + Math.cos(a) * 2 * sz,
                    y + Math.sin(a) * 1.4 * sz,
                    1.6 * sz,
                    1.2 * sz,
                    petal,
                );
            }
            oval(ctx, x, y, 1.1 * sz, 0.9 * sz, '#d9a85e');
        }
    }
    // 담 안쪽 그늘(벽이 있다는 걸 바닥에서도 읽히게)
    const edge = 26;
    const shade = (x, y, ww, hh, x0, y0, x1, y1) => {
        const g = ctx.createLinearGradient(x0, y0, x1, y1);
        g.addColorStop(0, '#2e4a2a55');
        g.addColorStop(1, '#2e4a2a00');
        ctx.fillStyle = g;
        ctx.fillRect(x, y, ww, hh);
    };
    shade(0, 0, w, edge, 0, 0, 0, edge);
    shade(0, 0, edge * 0.6, h, 0, 0, edge * 0.6, 0);
    shade(w - edge * 0.6, 0, edge * 0.6, h, w, 0, w - edge * 0.6, 0);
    ctx.restore();
    // 담 안쪽 테두리 선
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, 12);
    ctx.strokeStyle = '#6b6252';
    ctx.lineWidth = 2;
    ctx.stroke();
}

/* ───────── 사물 ───────── */

function drawRock(ctx, x, y, r, seed) {
    const rnd = seeded(seed);
    oval(ctx, x + r * 0.08, y + r * 0.3, r * 1.08, r * SQUASH * 0.9, '#2f452c55');
    const h = r * 1.15;
    const pts = [];
    for (let i = 0; i < 9; i++) {
        const a = Math.PI + (Math.PI * i) / 8;
        const k = 0.86 + rnd() * 0.18;
        pts.push([x + Math.cos(a) * r * k, y + r * 0.25 + Math.sin(a) * h * k]);
    }
    pts.push([x + r * 0.95, y + r * 0.35], [x - r * 0.95, y + r * 0.35]);
    poly(ctx, pts, '#8e8a80', '#4e4a44', 1.8);
    // 윗면 밝은 면
    oval(ctx, x - r * 0.12, y - r * 0.38, r * 0.62, r * 0.36, '#b8b3a6');
    oval(ctx, x - r * 0.25, y - r * 0.5, r * 0.28, r * 0.14, '#d6d1c4');
    // 이끼
    oval(ctx, x + r * 0.15, y - r * 0.7, r * 0.42, r * 0.17, '#7da159');
    oval(ctx, x + r * 0.05, y - r * 0.76, r * 0.24, r * 0.09, '#a3c477');
    // 아래 어두운 띠
    ctx.save();
    ctx.globalAlpha = 0.35;
    oval(ctx, x + r * 0.1, y + r * 0.16, r * 0.82, r * 0.22, '#3e3a35');
    ctx.restore();
}

function crackLines(ctx, w, h, stage, color, seed) {
    if (stage <= 0) return;
    const rnd = seeded(seed);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let c = 0; c < stage; c++) {
        let x = (rnd() - 0.5) * w * 0.5;
        let y = -h * (0.75 + rnd() * 0.15);
        ctx.beginPath();
        ctx.moveTo(x, y);
        const steps = 3 + c;
        for (let i = 0; i < steps; i++) {
            x += (rnd() - 0.5) * w * 0.34;
            y += (h * 0.62) / steps;
            ctx.lineTo(x, y);
        }
        ctx.lineWidth = 1.4 + c * 0.5;
        ctx.stroke();
    }
    ctx.restore();
}

// 광석 몸통: 원점이 지면 접점, 위로 솟는다
function oreBody(ctx, tier, r, colors, blink, squint) {
    const w = r * 2.4;
    const h = r * 2.1;
    if (tier === 1) {
        // 청석: 납작한 판 + 광택
        const top = [
            [-w * 0.48, -h * 0.34],
            [-w * 0.2, -h * 0.66],
            [w * 0.3, -h * 0.62],
            [w * 0.5, -h * 0.3],
        ];
        poly(
            ctx,
            [...top, [w * 0.42, -h * 0.02], [-w * 0.42, -h * 0.02]],
            colors.mid,
            OUTLINE,
            1.8,
        );
        poly(ctx, [top[0], top[1], top[2], top[3], [w * 0.05, -h * 0.4]], colors.light);
        poly(
            ctx,
            [[w * 0.05, -h * 0.4], top[3], [w * 0.42, -h * 0.02], [w * 0.02, -h * 0.06]],
            colors.deep,
        );
        line(ctx, -w * 0.26, -h * 0.5, w * 0.12, -h * 0.58, colors.glint, 2.4);
        line(ctx, -w * 0.32, -h * 0.4, -w * 0.18, -h * 0.44, colors.glint, 1.6);
    } else if (tier === 2) {
        // 자수정: 결정 3개
        const spike = (cx, ht, wd, lean) => {
            const tip = [cx + lean, -h * ht];
            poly(
                ctx,
                [
                    tip,
                    [cx + wd * 0.5, -h * ht * 0.55],
                    [cx + wd * 0.45, -h * 0.05],
                    [cx - wd * 0.45, -h * 0.05],
                    [cx - wd * 0.5, -h * ht * 0.55],
                ],
                colors.mid,
                OUTLINE,
                1.6,
            );
            poly(
                ctx,
                [
                    tip,
                    [cx, -h * ht * 0.5],
                    [cx - wd * 0.45, -h * 0.05],
                    [cx - wd * 0.5, -h * ht * 0.55],
                ],
                colors.light,
            );
            poly(
                ctx,
                [
                    tip,
                    [cx + wd * 0.5, -h * ht * 0.55],
                    [cx + wd * 0.45, -h * 0.05],
                    [cx, -h * ht * 0.5],
                ],
                colors.deep,
            );
        };
        spike(-w * 0.26, 0.82, w * 0.4, -w * 0.08);
        spike(w * 0.27, 0.78, w * 0.38, w * 0.08);
        spike(0, 1.08, w * 0.46, 0);
        line(ctx, -w * 0.06, -h * 0.82, -w * 0.1, -h * 0.55, colors.glint, 1.8);
    } else {
        // 구리(·황금): 둥근 덩어리 + 혹
        oval(ctx, -w * 0.32, -h * 0.72, w * 0.16, h * 0.15, colors.mid, OUTLINE, 1.5);
        oval(ctx, w * 0.28, -h * 0.78, w * 0.13, h * 0.13, colors.deep, OUTLINE, 1.5);
        ctx.beginPath();
        ctx.moveTo(-w * 0.5, -h * 0.06);
        ctx.bezierCurveTo(-w * 0.56, -h * 0.6, -w * 0.25, -h * 0.84, 0, -h * 0.84);
        ctx.bezierCurveTo(w * 0.3, -h * 0.84, w * 0.56, -h * 0.6, w * 0.5, -h * 0.06);
        ctx.closePath();
        ctx.fillStyle = colors.mid;
        ctx.fill();
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 2;
        ctx.stroke();
        oval(ctx, -w * 0.12, -h * 0.58, w * 0.3, h * 0.2, colors.light);
        ctx.save();
        ctx.globalAlpha = 0.8;
        oval(ctx, w * 0.22, -h * 0.28, w * 0.24, h * 0.2, colors.deep);
        ctx.restore();
        oval(ctx, -w * 0.2, -h * 0.64, w * 0.08, h * 0.05, colors.glint);
    }
    // 눈: 살아 있는 광석
    const eyeY = tier === 2 ? -h * 0.3 : tier === 1 ? -h * 0.26 : -h * 0.34;
    const eye = Math.max(1.6, r * 0.12);
    for (const s of [-1, 1]) {
        const ex = s * r * 0.3 - r * 0.06;
        if (squint) {
            line(ctx, ex - eye, eyeY - eye * 0.5 * s * 0, ex + eye, eyeY, '#3d2b33', 1.6);
            line(ctx, ex - eye, eyeY, ex + eye * 0.2, eyeY - eye * 0.7, '#3d2b33', 1.6);
        } else {
            oval(ctx, ex, eyeY, eye, eye * 1.15 * blink, '#3d2b33');
            if (blink > 0.5)
                oval(ctx, ex + eye * 0.35, eyeY - eye * 0.35, eye * 0.35, eye * 0.35, '#fff6dc');
        }
    }
}

function drawOre(ctx, ore, lx, ly, motion, now, hover, flash) {
    const r = ore.r ?? 18;
    const tier = ore.tier | 0;
    const colors = tierColors(tier);
    const seed = hashId(ore.id);
    const speed = motion.speed; // 월드 단위/초(화면 이동 기준)
    const fast = speed > 90;

    // 그림자 — 지면 접점. 빠르면 길게 늘어짐
    oval(
        ctx,
        lx,
        ly + r * 0.32,
        r * (1.05 + Math.min(0.5, speed / 900)),
        r * SQUASH * 0.78,
        '#2e452c55',
    );

    // 잔상
    if (motion.trail.length > 1 && fast) {
        ctx.save();
        for (let i = 0; i < motion.trail.length - 1; i++) {
            const p = motion.trail[i];
            const a = (i + 1) / motion.trail.length;
            ctx.globalAlpha = 0.22 * a;
            oval(ctx, p.x, p.y - r * 0.4, r * 0.95 * a, r * 0.8 * a, colors.light);
        }
        ctx.restore();
        // 속도선
        const n = Math.hypot(motion.dx, motion.dy) || 1;
        const ux = -motion.dx / n;
        const uy = -motion.dy / n;
        for (let i = -1; i <= 1; i++) {
            const ox = -uy * i * r * 0.55;
            const oy = ux * i * r * 0.55;
            line(
                ctx,
                lx + ux * r * 1.1 + ox,
                ly - r * 0.4 + uy * r * 1.1 + oy,
                lx + ux * r * (1.9 + Math.abs(i) * -0.3) + ox,
                ly - r * 0.4 + uy * r * (1.9 + Math.abs(i) * -0.3) + oy,
                '#fffbe0cc',
                2,
            );
        }
    }

    // 호버(겨냥) 고리
    if (hover) {
        const pulse = 1 + Math.sin(now / 120) * 0.05;
        oval(
            ctx,
            lx,
            ly + r * 0.32,
            r * 1.35 * pulse,
            r * SQUASH * 1.05 * pulse,
            null,
            '#fff4b0',
            2.5,
        );
    }

    ctx.save();
    ctx.translate(lx, ly + r * 0.32);
    // 움직임 방향으로 기울고, 맞은 직후엔 찌그러짐
    const lean = fast ? clamp(motion.dx / Math.max(1, speed), -1, 1) * 0.16 : 0;
    const hop = fast ? 0 : Math.abs(Math.sin(now / 260 + (seed % 13))) * r * 0.06;
    ctx.translate(0, -hop);
    ctx.rotate(lean);
    const squash = flash > 0 ? 1 - flash * 0.22 : 1;
    ctx.scale(1 / Math.sqrt(squash), squash);
    const blinkPhase = Math.sin(now / 900 + (seed % 37));
    const blink = blinkPhase > 0.985 ? 0.25 : 1;
    oreBody(ctx, tier, r, colors, blink, fast || flash > 0.3);

    // 금: 체력 비율에 따라 1~3단
    const ratio = ore.maxHp > 0 ? clamp(ore.hp / ore.maxHp, 0, 1) : 1;
    const stage = ratio < 0.999 ? (ratio > 0.66 ? 1 : ratio > 0.33 ? 2 : 3) : 0;
    crackLines(ctx, r * 2.4, r * 2.1, stage, '#3a2420', seed);
    if (stage === 3) {
        // 곧 깨짐: 안쪽에서 빛이 샘
        ctx.globalAlpha = 0.35 + Math.sin(now / 90) * 0.2;
        oval(ctx, 0, -r * 0.8, r * 0.6, r * 0.5, colors.glint);
        ctx.globalAlpha = 1;
    }
    if (flash > 0) {
        ctx.globalAlpha = flash * 0.75;
        ctx.globalCompositeOperation = 'lighter';
        oval(ctx, 0, -r * 0.95, r * 1.2, r * 1.05, '#fff6d0');
    }
    ctx.restore();

    // 체력: 깎였을 때만, 칸으로
    if (stage > 0) {
        const bw = r * 1.7;
        const by = ly - r * 2.15 - (tier === 2 ? r * 0.45 : 0);
        ctx.fillStyle = '#3f3529bb';
        ctx.beginPath();
        ctx.roundRect(lx - bw / 2 - 1.5, by - 1.5, bw + 3, 7, 3.5);
        ctx.fill();
        ctx.fillStyle = colors.glint;
        ctx.beginPath();
        ctx.roundRect(lx - bw / 2, by, bw * ratio, 4, 2);
        ctx.fill();
    }
}

function drawShard(ctx, shard, lx, ly, now, i) {
    const colors = tierColors(shard.tier);
    const bob = Math.sin(now / 180 + i * 1.7) * 2;
    const s = 8;
    oval(ctx, lx, ly + 2, s * 0.9, s * 0.38, '#2e452c55');
    if (shard.locked) {
        // 잠김: 친 사람 몫으로 잠깐 묶임 — 점선 고리, 반짝임 없음
        ctx.save();
        ctx.setLineDash([3, 3]);
        ctx.lineDashOffset = -now / 40;
        oval(ctx, lx, ly + 2, s * 1.7, s * 0.85, null, MINE.ring, 1.6);
        ctx.restore();
    } else {
        // 풀림: 누구나 주울 수 있음 — 빛기둥
        ctx.save();
        ctx.globalAlpha = 0.28 + Math.sin(now / 140 + i) * 0.12;
        const g = ctx.createLinearGradient(0, ly - 22, 0, ly);
        g.addColorStop(0, '#fff6c800');
        g.addColorStop(1, colors.glint);
        ctx.fillStyle = g;
        ctx.fillRect(lx - 3, ly - 22, 6, 22);
        ctx.restore();
    }
    const y = ly - 6 - (shard.locked ? 0 : bob);
    poly(
        ctx,
        [
            [lx, y - s],
            [lx + s * 0.65, y],
            [lx, y + s * 0.8],
            [lx - s * 0.65, y],
        ],
        colors.mid,
        OUTLINE,
        1.2,
    );
    poly(
        ctx,
        [
            [lx, y - s],
            [lx, y + s * 0.8],
            [lx - s * 0.65, y],
        ],
        colors.light,
    );
    if (!shard.locked) {
        const tw = (Math.sin(now / 110 + i * 2.3) + 1) / 2;
        line(ctx, lx - 2, y - s * 0.4, lx - 0.5, y - s * 0.65, colors.glint, 1.4);
        ctx.globalAlpha = tw;
        line(ctx, lx + s, y - s - 3, lx + s, y - s + 3, '#fffbe8', 1.3);
        line(ctx, lx + s - 3, y - s, lx + s + 3, y - s, '#fffbe8', 1.3);
        ctx.globalAlpha = 1;
    }
}

function drawPickaxe(ctx, x, y, angle, metal) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    line(ctx, 0, 8, 0, -16, '#644c36', 4.5);
    line(ctx, 0, 6, 0, -15, '#c99f69', 2);
    poly(
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
    line(ctx, -5, -18, 5, -18, '#fffbde', 1.6);
    ctx.restore();
}

function drawMiner(ctx, lx, ly, face, swing, style, name, metal = PICK_METAL[0]) {
    const facing = Math.atan2(face.y, face.x);
    const side = Math.cos(facing) < 0 ? -1 : 1;
    oval(ctx, lx, ly + 1, 18, 7, '#2e452c55');
    oval(ctx, lx, ly + 1, 21, 9, null, style.ring, 2);
    // 보는 방향 표시(발밑 작은 화살)
    const fx = Math.cos(facing);
    const fy = Math.sin(facing) * SQUASH;
    poly(
        ctx,
        [
            [lx + fx * 30, ly + 1 + fy * 30],
            [lx + fx * 22 - fy * 5, ly + 1 + fy * 22 + fx * 5],
            [lx + fx * 22 + fy * 5, ly + 1 + fy * 22 - fx * 5],
        ],
        style.ring,
    );
    oval(ctx, lx - 7, ly - 3, 6.2, 4, '#5a4238');
    oval(ctx, lx + 7, ly - 3, 6.2, 4, '#5a4238');
    oval(ctx, lx, ly - 13, 13, 11, style.mantle, '#3f463e', 1.7);
    oval(ctx, lx, ly - 21, 11.6, 4, style.scarf);
    oval(ctx, lx, ly - 29, 11.7, 11, '#f4d4a4', '#6b5643', 1.5);
    oval(ctx, lx + side * 4, ly - 28, 1.4, 2, '#523e36');
    oval(ctx, lx + side * 7, ly - 28, 1.3, 1.9, '#523e36');
    oval(ctx, lx - side * 3, ly - 25, 2.3, 1.2, '#e3a581');
    oval(ctx, lx - 0.5, ly - 37, 11.7, 7, '#b68b51', '#715638', 1.4);
    oval(ctx, lx + 1, ly - 33, 15, 3.8, '#d6ab66', '#886639', 1.2);
    oval(ctx, lx + side * 6, ly - 36, 2.7, 2.7, '#fff0aa');
    const angle = swing > 0 ? facing + Math.PI / 2 - 1.2 + swing * 2.2 : side * 0.36;
    drawPickaxe(ctx, lx + side * 15, ly - 14, angle, metal);
    if (name) text(ctx, name, lx, ly - 55, '#3f4430', 11, 850);
}

/* ───────── 효과 ───────── */

const LIFE = { swing: 220, crack: 460, break: 720, collect: 560, preview: 260 };

function drawEffect(ctx, fx, lx, ly, showChain) {
    const life = LIFE[fx.kind] ?? 500;
    const t = clamp((fx.ageMs ?? 0) / life, 0, 1);
    if (t >= 1) return;
    const colors = tierColors(fx.tier ?? 0);
    const depth = fx.depth | 0;
    ctx.save();
    switch (fx.kind) {
        case 'swing': {
            // 휘두름: 흰 초승달
            ctx.globalAlpha = (1 - t) * 0.9;
            ctx.beginPath();
            ctx.ellipse(lx, ly - 14, 30 + t * 10, 20 + t * 6, 0, -2.2 + t * 0.6, 0.1 + t * 0.9);
            ctx.strokeStyle = '#fffbe2';
            ctx.lineWidth = 5 * (1 - t) + 1;
            ctx.stroke();
            break;
        }
        case 'crack': {
            // 금: 짧은 충격 고리 + 재질 조각 + 연쇄 숫자
            ctx.globalAlpha = 1 - t;
            oval(
                ctx,
                lx,
                ly,
                10 + t * 30,
                (10 + t * 30) * SQUASH,
                null,
                colors.glint,
                3 * (1 - t) + 0.5,
            );
            const rnd = seeded(Math.round(lx * 13 + ly * 7));
            for (let i = 0; i < 6; i++) {
                const a = rnd() * Math.PI * 2;
                const d = 6 + t * (18 + rnd() * 14);
                const x = lx + Math.cos(a) * d;
                const y = ly - 12 + Math.sin(a) * d * SQUASH - t * 10 + t * t * 26;
                const s = 2.5 + rnd() * 2;
                poly(
                    ctx,
                    [
                        [x, y - s],
                        [x + s, y],
                        [x, y + s],
                        [x - s, y],
                    ],
                    i % 2 ? colors.light : colors.mid,
                );
            }
            if (t < 0.12) {
                ctx.globalCompositeOperation = 'lighter';
                ctx.globalAlpha = 0.6;
                oval(ctx, lx, ly - 10, 18, 14, '#fff4cf');
            }
            break;
        }
        case 'break': {
            // 깨짐: 섬광 + 충격파 + 많은 조각
            if (t < 0.1) {
                ctx.globalCompositeOperation = 'lighter';
                ctx.globalAlpha = 0.85 * (1 - t / 0.1);
                oval(ctx, lx, ly - 12, 42, 34, '#fff7d6');
                ctx.globalCompositeOperation = 'source-over';
            }
            ctx.globalAlpha = 1 - t;
            oval(
                ctx,
                lx,
                ly,
                16 + t * 70,
                (16 + t * 70) * SQUASH,
                null,
                colors.light,
                5 * (1 - t) + 0.5,
            );
            oval(
                ctx,
                lx,
                ly,
                8 + t * 44,
                (8 + t * 44) * SQUASH,
                null,
                '#fffbe8',
                2.5 * (1 - t) + 0.3,
            );
            const rnd = seeded(Math.round(lx * 31 + ly * 17));
            for (let i = 0; i < 14; i++) {
                const a = rnd() * Math.PI * 2;
                const d = 8 + t * (34 + rnd() * 30);
                const x = lx + Math.cos(a) * d;
                const y = ly - 14 + Math.sin(a) * d * SQUASH - t * 24 + t * t * 44;
                const s = (3 + rnd() * 3.5) * (1 - t * 0.4);
                poly(
                    ctx,
                    [
                        [x, y - s],
                        [x + s * 0.8, y],
                        [x, y + s],
                        [x - s * 0.8, y],
                    ],
                    [colors.light, colors.mid, colors.deep][i % 3],
                    OUTLINE,
                    0.8,
                );
            }
            break;
        }
        case 'collect': {
            // 줍기: 위로 솟는 반짝임 + +1
            ctx.globalAlpha = 1 - t * t;
            const y = ly - 18 - t * 26;
            for (let i = 0; i < 4; i++) {
                const a = (Math.PI / 2) * i + t * 2;
                const d = 5 + t * 12;
                line(
                    ctx,
                    lx + Math.cos(a) * d,
                    y + Math.sin(a) * d,
                    lx + Math.cos(a) * (d + 4),
                    y + Math.sin(a) * (d + 4),
                    colors.glint,
                    2,
                );
            }
            text(ctx, '+1', lx, y - 8, '#7a4a12', 13, 900);
            break;
        }
        case 'preview': {
            // 내 타격 즉시 표시(서버 판정 전): 흰 고리만, 조각·숫자 없음 — 확정 타격과 구분
            ctx.globalAlpha = (1 - t) * 0.9;
            oval(
                ctx,
                lx,
                ly - 10,
                12 + t * 16,
                (12 + t * 16) * 0.8,
                null,
                '#ffffff',
                3 * (1 - t) + 0.8,
            );
            ctx.setLineDash([3, 4]);
            oval(ctx, lx, ly + 4, 20 + t * 8, (20 + t * 8) * SQUASH, null, '#fff4b0', 1.6);
            break;
        }
    }
    ctx.restore();

    // 연쇄 깊이 — 2단 이상부터 크게
    if (showChain && depth >= 2) {
        const pop = t < 0.15 ? 0.7 + (t / 0.15) * 0.5 : 1.2 - Math.min(0.2, (t - 0.15) * 0.4);
        ctx.save();
        ctx.globalAlpha = t > 0.7 ? (1 - t) / 0.3 : 1;
        const size = (14 + Math.min(4, depth) * 3) * pop;
        text(
            ctx,
            `연쇄 ×${depth}`,
            lx,
            ly - 46 - t * 16,
            depth >= 4 ? '#c2411f' : '#9a5a0a',
            size,
            950,
            '#fff3c4',
        );
        ctx.restore();
    }
}

/* ───────── 겨냥 안내 ───────── */

// 선과 원의 첫 교차(로컬 좌표). 반환: 거리 또는 Infinity
function rayCircle(ox, oy, dx, dy, cx, cy, r) {
    const fx = ox - cx;
    const fy = oy - cy;
    const b = fx * dx + fy * dy;
    const c = fx * fx + fy * fy - r * r;
    const disc = b * b - c;
    if (disc < 0) return Infinity;
    const t = -b - Math.sqrt(disc);
    return t > 0.5 ? t : Infinity;
}

/* ───────── 뷰 ───────── */

export function createChainView(canvas) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D is unavailable');

    const layout = { cssW: 1, cssH: 1, dpr: 1, scale: 1, ox: 0, oy: 0, rotated: false };
    let ground = null;
    let groundKey = '';
    const motion = new Map(); // ore id → { trail:[{x,y,t}], dx, dy, speed }
    let lastNow = 0;

    function toLocal(x, y) {
        return layout.rotated ? { x: y, y: WORLD_W - x } : { x, y };
    }
    function toLocalVec(x, y) {
        return layout.rotated ? { x: y, y: -x } : { x, y };
    }
    function localDims() {
        return layout.rotated ? { w: WORLD_H, h: WORLD_W } : { w: WORLD_W, h: WORLD_H };
    }

    function measure() {
        const rect = canvas.getBoundingClientRect();
        const cssW = Math.max(1, rect.width);
        const cssH = Math.max(1, rect.height);
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const pw = Math.round(cssW * dpr);
        const ph = Math.round(cssH * dpr);
        if (canvas.width !== pw || canvas.height !== ph) {
            canvas.width = pw;
            canvas.height = ph;
        }
        // HUD 띠가 차지하는 자리
        const narrow = cssW <= 620;
        const top = 54;
        const bottom = cssH <= 460 ? 58 : narrow ? 98 : 62;
        const side = 10;
        const availW = cssW - side * 2 - WALL * 2;
        const availH = cssH - top - bottom - WALL * 2;
        // 세로 화면이면 돌려서 더 크게
        const flat = Math.min(availW / WORLD_W, availH / WORLD_H);
        const turned = Math.min(availW / WORLD_H, availH / WORLD_W);
        const rotated = turned > flat * 1.12;
        const scale = Math.max(0.1, rotated ? turned : flat);
        const { w, h } = rotated ? { w: WORLD_H, h: WORLD_W } : { w: WORLD_W, h: WORLD_H };
        Object.assign(layout, {
            cssW,
            cssH,
            dpr,
            scale,
            rotated,
            ox: (cssW - w * scale) / 2,
            oy: top + WALL + (availH - h * scale) / 2,
        });
        const key = `${pw}x${ph}:${scale.toFixed(4)}:${rotated}`;
        if (key !== groundKey) {
            groundKey = key;
            const pad = WALL + 8;
            ground = document.createElement('canvas');
            const k = scale * dpr;
            ground.width = Math.ceil((w + pad * 2) * k);
            ground.height = Math.ceil((h + pad * 2) * k);
            const g = ground.getContext('2d');
            g.setTransform(k, 0, 0, k, pad * k, pad * k);
            g.lineJoin = 'round';
            g.lineCap = 'round';
            paintGround(g, w, h);
            ground.pad = pad;
        }
    }

    function trackMotion(ores, now) {
        const seen = new Set();
        for (const ore of ores) {
            seen.add(ore.id);
            const p = toLocal(ore.x, ore.y);
            let m = motion.get(ore.id);
            if (!m) {
                m = { trail: [], dx: 0, dy: 0, speed: 0 };
                motion.set(ore.id, m);
            }
            m.trail.push({ x: p.x, y: p.y, t: now });
            while (m.trail.length > 2 && now - m.trail[0].t > TRAIL_MS) m.trail.shift();
            const first = m.trail[0];
            const dt = Math.max(1, now - first.t) / 1000;
            m.dx = p.x - first.x;
            m.dy = p.y - first.y;
            // 화면상 속도를 월드 단위/초로(회전·배율과 무관)
            m.speed = m.trail.length > 1 ? Math.hypot(m.dx, m.dy) / dt : 0;
            if (m.speed < 90 && Math.abs(ore.vx ?? 0) + Math.abs(ore.vy ?? 0) > 0) {
                // 상태가 드물게 올 때를 위한 보조: 속도 벡터가 있으면 방향만 빌림
                const v = toLocalVec(ore.vx, ore.vy);
                if (Math.hypot(v.x, v.y) > 0 && m.speed > 30) {
                    m.dx = v.x;
                    m.dy = v.y;
                }
            }
        }
        for (const id of motion.keys()) if (!seen.has(id)) motion.delete(id);
    }

    function hoveredOre(state, pointer) {
        if (!pointer) return null;
        // 입력 쪽이 이미 고른 광석이 있으면 그것을 따른다(판정과 표시가 어긋나지 않게)
        if ('ore' in pointer) return (state.ores ?? []).find((o) => o.id === pointer.ore) ?? null;
        let best = null;
        let bestD = Infinity;
        for (const ore of state.ores ?? []) {
            const r = (ore.r ?? 18) * 1.35;
            // 몸통이 위로 솟아 있으므로 위쪽 클릭도 받아 준다
            const dx = pointer.x - ore.x;
            const dy = pointer.y - ore.y;
            const d = Math.hypot(dx, dy);
            if (d < r && d < bestD) {
                best = ore;
                bestD = d;
            }
        }
        return best;
    }

    function drawAim(state, ore) {
        const player = state.player;
        if (!player || !ore) return;
        const pp = toLocal(player.x, player.y);
        const op = toLocal(ore.x, ore.y);
        let dx = op.x - pp.x;
        let dy = op.y - pp.y;
        const n = Math.hypot(dx, dy) || 1;
        dx /= n;
        dy /= n;
        const r = ore.r ?? 18;
        // 첫 충돌 찾기: 바위·다른 광석·담
        const { w, h } = localDims();
        let hit = Infinity;
        let kind = 'wall';
        for (const rock of state.rocks ?? []) {
            const c = toLocal(rock.x, rock.y);
            const t = rayCircle(op.x, op.y, dx, dy, c.x, c.y, rock.r + r);
            if (t < hit) {
                hit = t;
                kind = 'rock';
            }
        }
        for (const other of state.ores ?? []) {
            if (other === ore) continue;
            const c = toLocal(other.x, other.y);
            const t = rayCircle(op.x, op.y, dx, dy, c.x, c.y, (other.r ?? 18) + r);
            if (t < hit) {
                hit = t;
                kind = 'ore';
            }
        }
        const wallT = Math.min(
            dx > 0 ? (w - r - op.x) / dx : dx < 0 ? (r - op.x) / dx : Infinity,
            dy > 0 ? (h - r - op.y) / dy : dy < 0 ? (r - op.y) / dy : Infinity,
        );
        if (wallT < hit) {
            hit = wallT;
            kind = 'wall';
        }
        const maxLen = 300;
        const len = Math.min(hit, maxLen);
        const ex = op.x + dx * len;
        const ey = op.y + dy * len;
        ctx.save();
        ctx.setLineDash([6, 7]);
        ctx.lineDashOffset = -performance.now() / 30;
        line(
            ctx,
            op.x + dx * r,
            op.y + dy * r,
            ex,
            ey,
            kind === 'ore' && hit <= maxLen ? '#ffe27add' : '#fff8dcaa',
            3,
        );
        ctx.setLineDash([]);
        if (hit <= maxLen) {
            // 부딪힐 자리에 광석 윤곽
            oval(ctx, ex, ey, r, r * SQUASH, null, kind === 'ore' ? '#ffd95a' : '#fff6d0', 2.5);
            if (kind === 'ore') text(ctx, '쾅!', ex, ey - r - 14, '#a2560c', 13, 950);
        } else {
            poly(
                ctx,
                [
                    [ex + dx * 10, ey + dy * 10],
                    [ex - dy * 6, ey + dx * 6],
                    [ex + dy * 6, ey - dx * 6],
                ],
                '#fff8dcaa',
            );
        }
        ctx.restore();
    }

    function draw(state, pointer) {
        measure();
        const now = performance.now();
        const frameDt = now - lastNow;
        lastNow = now;
        const { dpr, scale } = layout;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        // 바깥 배경
        const bg = ctx.createRadialGradient(
            layout.cssW / 2,
            layout.cssH * 0.45,
            40,
            layout.cssW / 2,
            layout.cssH / 2,
            Math.max(layout.cssW, layout.cssH) * 0.75,
        );
        bg.addColorStop(0, '#507b56');
        bg.addColorStop(1, '#233f2e');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, layout.cssW, layout.cssH);

        const effects = state.effects ?? [];
        // 깨짐 직후 짧은 화면 흔들림
        let shakeX = 0;
        let shakeY = 0;
        for (const fx of effects) {
            if (fx.kind === 'break' && (fx.ageMs ?? 0) < 130) {
                const k = (1 - fx.ageMs / 130) * (2 + Math.min(4, fx.depth | 0));
                shakeX += Math.sin(now / 17 + fx.x) * k;
                shakeY += Math.cos(now / 13 + fx.y) * k * 0.6;
            }
        }

        ctx.setTransform(
            dpr * scale,
            0,
            0,
            dpr * scale,
            dpr * (layout.ox + shakeX),
            dpr * (layout.oy + shakeY),
        );
        if (ground) {
            const pad = ground.pad;
            ctx.drawImage(
                ground,
                -pad,
                -pad,
                ground.width / (scale * dpr),
                ground.height / (scale * dpr),
            );
        }

        trackMotion(state.ores ?? [], now);
        const hover = hoveredOre(state, pointer);
        canvas.style.cursor = hover ? 'pointer' : 'crosshair';

        // 바닥 위에 깔리는 것: 겨냥선, 이동 표시, 예상 지점
        if (hover) drawAim(state, hover);
        else if (
            pointer &&
            pointer.x >= 0 &&
            pointer.y >= 0 &&
            pointer.x <= WORLD_W &&
            pointer.y <= WORLD_H
        ) {
            const p = toLocal(pointer.x, pointer.y);
            oval(ctx, p.x, p.y, 9, 9 * SQUASH, null, '#fff8dc88', 1.6);
        }

        // 세워 그리는 것들: 지면 y 순서
        const actors = [];
        for (const rock of state.rocks ?? []) {
            const p = toLocal(rock.x, rock.y);
            actors.push({ k: 0, y: p.y, p, o: rock });
        }
        (state.shards ?? []).forEach((s, i) => {
            const p = toLocal(s.x, s.y);
            actors.push({ k: 1, y: p.y - 4, p, o: s, i });
        });
        for (const ore of state.ores ?? []) {
            const p = toLocal(ore.x, ore.y);
            actors.push({ k: 2, y: p.y + (ore.r ?? 18) * 0.32, p, o: ore });
        }
        (state.rivals ?? []).forEach((rv, i) => {
            const p = toLocal(rv.x, rv.y);
            actors.push({ k: 3, y: p.y, p, o: rv, i });
        });
        if (state.player) {
            const p = toLocal(state.player.x, state.player.y);
            actors.push({ k: 4, y: p.y, p, o: state.player });
        }
        actors.sort((a, b) => a.y - b.y);

        // 광석 섬광: 최근 crack/break 근처
        const flashOf = (ore) => {
            let f = 0;
            for (const fx of effects) {
                if ((fx.kind === 'crack' || fx.kind === 'break') && (fx.ageMs ?? 0) < 150) {
                    const d = Math.hypot(fx.x - ore.x, fx.y - ore.y);
                    if (d < (ore.r ?? 18) * 2.2) f = Math.max(f, 1 - fx.ageMs / 150);
                }
            }
            return f;
        };

        for (const a of actors) {
            if (a.k === 0) drawRock(ctx, a.p.x, a.p.y, a.o.r ?? 20, hashId(`${a.o.x},${a.o.y}`));
            else if (a.k === 1) drawShard(ctx, a.o, a.p.x, a.p.y, now, a.i);
            else if (a.k === 2)
                drawOre(
                    ctx,
                    a.o,
                    a.p.x,
                    a.p.y,
                    motion.get(a.o.id),
                    now,
                    a.o === hover,
                    flashOf(a.o),
                );
            else if (a.k === 3) drawMiner(ctx, a.p.x, a.p.y, { x: 1, y: 0 }, 0, RIVAL, '봇');
            else {
                const pl = a.o;
                const f = toLocalVec(pl.faceX ?? 1, pl.faceY ?? 0);
                const sw =
                    typeof pl.swing === 'number' ? clamp(pl.swing, 0, 1) : pl.swing ? 0.5 : 0;
                const level = clamp((state.level ?? pl.level ?? 0) | 0, 0, PICK_METAL.length - 1);
                drawMiner(
                    ctx,
                    a.p.x,
                    a.p.y,
                    { x: f.x, y: f.y * SQUASH },
                    sw,
                    MINE,
                    '나',
                    PICK_METAL[level],
                );
            }
        }

        // 연쇄 숫자는 한 곳에만: 살아 있는 금·깨짐 중 가장 높은 단계, 같으면 가장 최근
        let chainFx = null;
        for (const fx of effects) {
            if (fx.kind !== 'crack' && fx.kind !== 'break') continue;
            if ((fx.depth | 0) < 2 || (fx.ageMs ?? 0) >= LIFE[fx.kind]) continue;
            if (
                !chainFx ||
                (fx.depth | 0) > (chainFx.depth | 0) ||
                ((fx.depth | 0) === (chainFx.depth | 0) && (fx.ageMs ?? 0) < (chainFx.ageMs ?? 0))
            )
                chainFx = fx;
        }
        for (const fx of effects) {
            const p = toLocal(fx.x, fx.y);
            drawEffect(ctx, fx, p.x, p.y, fx === chainFx);
        }
        void frameDt;
    }

    function worldPoint(clientX, clientY) {
        const rect = canvas.getBoundingClientRect();
        const lx = (clientX - rect.left - layout.ox) / layout.scale;
        const ly = (clientY - rect.top - layout.oy) / layout.scale;
        return layout.rotated ? { x: WORLD_W - ly, y: lx } : { x: lx, y: ly };
    }

    // 화면 방향(키보드 위·아래·왼쪽·오른쪽)을 월드 방향으로. 세로 화면에서 판이 돌아가 있을 때 필요하다.
    function worldVector(screenX, screenY) {
        return layout.rotated ? { x: -screenY, y: screenX } : { x: screenX, y: screenY };
    }

    return { draw, worldPoint, worldVector };
}
