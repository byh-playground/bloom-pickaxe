import { loadGameServer } from './game-server-config.js';
import { hasOnlineServer, normalizeServerOrigin } from './online-client.js';

const params = new URLSearchParams(location.search);
const start = document.querySelector('.start');
const startLabel = start.querySelector('.start-label');
const status = document.querySelector('.status');
const practice = document.querySelector('.practice');
const canvas = document.querySelector('.mine-art');
const ctx = canvas.getContext('2d');
let attempt = 0;

function gameUrl(online, server) {
    const url = new URL('./fracture.html', location.href);
    url.searchParams.set(online ? 'online' : 'offline', '1');
    if (online && server && params.has('server')) url.searchParams.set('server', server);
    const seed = params.get('seed');
    if (seed && /^\d+$/.test(seed)) url.searchParams.set('seed', seed);
    return url.href;
}

practice.href = gameUrl(false);

function updateEntry(label, message = '', busy = false) {
    start.disabled = busy;
    start.setAttribute('aria-busy', String(busy));
    startLabel.textContent = label;
    status.textContent = message;
}

start.addEventListener('click', async () => {
    const current = ++attempt;
    updateEntry('연결 중…', '온라인 채굴터에 연결하고 있어요.', true);
    try {
        const configured = params.get('server') ?? (await loadGameServer());
        const server = configured === null ? location.origin : normalizeServerOrigin(configured);
        if (server && (await hasOnlineServer(server))) {
            if (current === attempt) location.assign(gameUrl(true, server));
            return;
        }
    } catch {
        // Keep the menu available when the game server or its configuration cannot be reached.
    }
    if (current === attempt) {
        updateEntry('다시 시도', '온라인에 연결하지 못했어요.');
        start.focus({ preventScroll: true });
    }
});

window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    attempt++;
    updateEntry('게임 시작');
});

const ink = '#384137';

function contour(path, fill, stroke, width = 1) {
    const outline = new Path2D(path);
    ctx.fillStyle = fill;
    ctx.fill(outline);
    if (!stroke) return;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.stroke(outline);
}

function ellipse(x, y, rx, ry, fill) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
}

function line(points, color, width) {
    ctx.beginPath();
    ctx.moveTo(...points[0]);
    for (const point of points.slice(1)) ctx.lineTo(...point);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
}

function rock(x, y, scale, face = false) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ellipse(8, 12, 62, 15, '#34493155');
    contour('M-58 6-50-30-27-55 13-63 44-47 59-17 56 10 11 23-38 20Z', '#828a70', ink, 2.5);
    contour('M-58 6-50-30-22-25-10 14-38 20Z', '#68725c');
    contour('M-50-30-27-55 13-63 30-46 5-31-22-25Z', '#a0a385');
    contour('M59-17 56 10 11 23-10 14 5-31 30-46 44-47Z', '#727c67');
    contour('M-52-28-27-53-4-58 12-57 20-50 9-47 2-50-14-42-27-42-37-30Z', '#94a75e');
    line(
        [
            [-22, -25],
            [5, -31],
            [20, -17],
            [14, -2],
        ],
        '#c5c194',
        2,
    );
    if (face) {
        ellipse(-13, -15, 3.3, 4.4, ink);
        ellipse(0, -18, 3.3, 4.4, ink);
        ellipse(-13.6, -16.3, 1, 1.25, '#efefc9');
        ellipse(-0.6, -19.3, 1, 1.25, '#efefc9');
        line(
            [
                [-11, -5],
                [-6, -3],
                [-2, -7],
            ],
            ink,
            1.6,
        );
    }
    ctx.restore();
}

function crystals(x, y, scale) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ellipse(0, 7, 48, 10, '#3c575145');
    contour('M-39 6-42-17-31-29-13-20-9 11-20 14Z', '#88c1a8', '#3d685e', 2);
    contour('M-34 10-35-15-31-29-25-16-24 12Z', '#bde5b8');
    contour('M-13 10-16-35-5-62 12-51 23-37 16 12 4 17Z', '#72ceaf', '#3d685e', 2);
    contour('M-5-62 1-38 4 17-10 9-16-35Z', '#cef6cc');
    contour('M12-51 10-37 4 17 16 12 23-37Z', '#4e998c');
    contour('M16 11 20-10 39-25 47-18 43 6 29 16Z', '#a4dcc4', '#3d685e', 2);
    contour('M39-25 36-11 29 16 16 11 20-10Z', '#c0e6b6');
    ctx.restore();
}

function miner(x, y, scale) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ellipse(0, 48, 49, 13, '#4a56364e');
    ellipse(-20, 41, 17, 10, '#534132');
    ellipse(15, 42, 18, 10, '#534132');
    contour('M-43 8-49 2-48-18Q-48-30-36-31L-22-31-18 20-38 22Z', '#3c827b', ink, 3);
    line(
        [
            [-44, -12],
            [-31, -13],
        ],
        '#91a185',
        2,
    );
    contour('M-33 10-27-14 25-14 33 6 31 32 21 39-21 37Q-34 32-33 10Z', '#516b74', '#3b4238', 3);
    contour('M-21 10 22 9 22 33-16 35-23 29Z', '#6a8790');
    line(
        [
            [-23, 1],
            [-16, 12],
        ],
        '#e8ba5f',
        4,
    );
    line(
        [
            [24, 0],
            [17, 12],
        ],
        '#e8ba5f',
        4,
    );
    contour(
        'M-37-23Q-33-43-9-47 20-49 34-30L33-10Q31 10 4 11Q-26 10-34-6Z',
        '#efc37d',
        '#554534',
        3,
    );
    ellipse(-9, -18, 3.6, 5.8, '#4a3b30');
    ellipse(14, -18, 3.6, 5.8, '#4a3b30');
    ellipse(19, -8, 5, 2.9, '#e69e6e');
    line(
        [
            [1, -8],
            [6, -5],
            [11, -8],
        ],
        '#82543c',
        2,
    );
    contour('M-42-30Q-44-58-23-67 10-81 37-57L43-36 30-27-24-24Z', '#e4a440', '#4b422f', 3);
    contour('M-36-45Q-27-70-2-72L22-65 27-60Q-1-67-25-49L-31-38Z', '#ffcc67');
    contour('M-46-33Q-19-36 18-39L45-42 50-32 41-26-3-22-36-21-48-25Z', '#f2b64d', '#4b422f', 2.5);
    ellipse(16, -42, 12, 12, '#614b33');
    ellipse(16, -42, 8, 8, '#fff5ad');
    ellipse(14, -44, 3.2, 3, '#fffbe2');
    ctx.save();
    ctx.translate(43, 19);
    ctx.rotate(0.37);
    line(
        [
            [0, 20],
            [0, -58],
        ],
        '#583e2d',
        10,
    );
    line(
        [
            [-1, 18],
            [-1, -56],
        ],
        '#b08350',
        4,
    );
    contour(
        'M-27-48Q-21-62-3-62 20-66 32-49L30-44 19-51-2-52-15-49-27-43Z',
        '#abc2b0',
        '#4b5244',
        2.5,
    );
    ellipse(-1, 2, 10, 8, '#edbe75');
    ctx.restore();
    ctx.restore();
}

const tufts = Array.from({ length: 225 }, (_, i) => {
    const n = Math.sin(i * 79.365 + 1) * 43758.5453;
    const m = Math.sin(i * 21.551 + 8) * 29814.3382;
    return [(n - Math.floor(n)) * 680, 175 + (m - Math.floor(m)) * 425, i % 4];
});

function drawMine() {
    if (!ctx) return;
    const { width, height } = canvas.getBoundingClientRect();
    if (!width || !height) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const scale = Math.max(width / 680, height / 600);
    const dx = (width - scale * 680) / 2;
    const dy = (height - scale * 600) / 2;
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dx * dpr, dy * dpr);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    const sky = ctx.createLinearGradient(0, 0, 0, 600);
    sky.addColorStop(0, '#bdc790');
    sky.addColorStop(0.4, '#94ad74');
    sky.addColorStop(1, '#5f824e');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 680, 600);
    ellipse(488, 100, 94, 65, '#f1d79770');
    contour('M0 140Q85 76 170 151 260 67 378 158 492 100 680 168V294H0Z', '#86a273');
    contour('M0 205Q107 163 208 224 331 152 427 214 543 169 680 225V353H0Z', '#749364');
    contour('M0 354Q87 293 173 302 335 272 419 224 539 203 680 294V600H0Z', '#91a966');
    contour('M0 514Q142 436 273 443 427 428 563 347 622 309 680 321V600H0Z', '#8da763');
    contour(
        'M583 600H253Q210 546 238 509 292 443 375 405 463 364 475 309L509 307Q506 384 425 438 368 481 452 512 548 552 583 600Z',
        '#aeb376',
    );
    contour(
        'M542 600H324Q268 534 290 506 317 471 401 426 466 385 480 311L494 311Q484 396 422 441 376 479 444 518 494 549 542 600Z',
        '#bcb585',
    );

    for (const [x, y, style] of tufts) {
        const tint = style % 2 ? '#6284517a' : '#d1c38e94';
        if (style === 0)
            line(
                [
                    [x - 3, y - 2],
                    [x, y],
                    [x + 3, y - 6],
                ],
                tint,
                1.45,
            );
        else ellipse(x, y, style === 3 ? 3.4 : 1.5, style === 3 ? 1.3 : 0.9, tint);
    }

    rock(116, 330, 0.88);
    rock(84, 429, 1.02, true);
    rock(558, 405, 0.68);
    ellipse(474, 327, 174, 45, '#52644156');
    contour(
        'M297 318 322 232 366 170 466 134 539 156 599 201 628 278 615 332 550 356 366 352Z',
        '#8d9276',
        '#56664d',
        3,
    );
    contour('M322 232 366 170 466 134 539 156 492 174 436 181 390 211 367 248Z', '#a3a280');
    contour('M297 318 322 232 367 248 397 303 393 345 366 352Z', '#747e65');
    contour('M539 156 599 201 628 278 615 332 550 356 517 349 530 234Z', '#717d65');
    contour(
        'M322 220 366 168 466 134 516 149 535 162 507 168 493 161 471 172 450 163 415 174 386 194 365 206 353 227Z',
        '#a5ad69',
    );
    line(
        [
            [342, 253],
            [362, 247],
            [378, 260],
            [382, 281],
        ],
        '#5f6b54',
        3,
    );
    line(
        [
            [552, 204],
            [543, 234],
            [561, 247],
            [574, 244],
        ],
        '#657159',
        3,
    );

    contour('M403 333V254Q423 209 474 206 516 204 545 246V334Z', '#63533c', '#58604c', 3);
    contour('M421 332V260Q442 220 482 224 516 225 529 258V333Z', '#2d3830');
    contour('M431 332V263Q453 232 484 234L513 254 519 333Z', '#25322d');
    line(
        [
            [402, 332],
            [402, 256],
            [430, 218],
            [491, 211],
            [542, 246],
            [542, 333],
        ],
        '#614a32',
        15,
    );
    line(
        [
            [403, 330],
            [403, 256],
            [431, 219],
            [491, 211],
            [542, 246],
            [542, 329],
        ],
        '#b78e52',
        8,
    );
    line(
        [
            [403, 262],
            [431, 224],
            [490, 216],
            [543, 253],
        ],
        '#dfb577',
        3,
    );
    ellipse(404, 260, 3.5, 3.5, '#5b4b32');
    ellipse(541, 254, 3.5, 3.5, '#5b4b32');
    ellipse(474, 234, 6, 7, '#e2ad53');
    ellipse(474, 234, 3.2, 4.2, '#f9de8a');
    for (const tie of [
        [452, 327, 497],
        [442, 341, 503],
        [427, 361, 512],
        [411, 382, 522],
    ]) {
        line(
            [
                [tie[0], tie[1]],
                [tie[2], tie[1] + 5],
            ],
            '#796f52',
            5,
        );
    }
    line(
        [
            [463, 312],
            [448, 343],
            [408, 389],
        ],
        '#5c6860',
        4,
    );
    line(
        [
            [488, 313],
            [496, 344],
            [524, 391],
        ],
        '#5c6860',
        4,
    );

    rock(591, 487, 0.97, true);
    crystals(578, 404, 0.72);
    crystals(132, 475, 0.8);
    miner(242, 428, 1.14);

    const shade = ctx.createRadialGradient(352, 265, 150, 350, 280, 462);
    shade.addColorStop(0, '#30463200');
    shade.addColorStop(1, '#2942354c');
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, 680, 600);
}

new ResizeObserver(drawMine).observe(canvas);
drawMine();
