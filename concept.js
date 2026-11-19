import { createView } from './view.js';
import { mapSize, projectionTilt, regions } from './map-layout.js';
import { createMockState } from './mock-world.js';

const stops = {
    meadow: { ...regions.meadow, name: '외곽 · 갈림돌 광맥' },
    crossing: { x: mapSize.width * 0.18, y: mapSize.height * 0.09, name: '동쪽 · 바위목 광맥' },
    boss: { ...regions.boss, name: '정중앙 · 대광맥 골렘' },
};
const duration = 2700;
const turnAt = 980;
const resultsAt = { roll: 1820, redirect: 2040 };
const action = { x: 10, y: 48 };
const start = { x: -128, y: 48 };
const straight = { x: 176, y: 48 };
const redirected = { x: -65, y: -116 };
const afterward = { x: -143, y: -177 };
const canvas = document.querySelector('#world-view');
const get = (id) => document.getElementById(id);
const map = get('region-map');
const range = get('progress');
const round = get('roll');
const redirect = get('redirect');
const replay = get('replay');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const camera = { x: stops.meadow.x, y: stops.meadow.y + 4 };
let location = 'meadow';
let mode = 'roll';
let time = 0;
let started = null;
let playing = false;
let drag = null;

const worldPoint = (base, point) => ({ x: base.x + point.x, y: base.y + point.y });
const mix = (a, b, p) => ({ x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p });
const ease = (u) => Math.max(0, Math.min(1, u));
function ore(id, x, y, tier, hp = 3) {
    return { id, x, y, tier, hp, maxHp: 3, boss: false };
}
function miner(id, name, x, y, level, faceX, faceY, swingAt = -1000) {
    return { id, name, x, y, level, faceX, faceY, swingUntil: swingAt + 310 };
}
function rock(x, y, r) {
    return { x, y, r };
}
const meadowStones = [
    rock(-212, -62, 37),
    rock(145, -82, 33),
    rock(213, 135, 41),
    rock(-119, 165, 29),
];
const eastStones = [
    rock(-112, -93, 42),
    rock(-120, 68, 34),
    rock(117, -65, 46),
    rock(115, 101, 31),
];
const geometry = [
    { zone: 'meadow', rocks: meadowStones, radiusX: 222, radiusY: 138 },
    { zone: 'crossing', rocks: eastStones, radiusX: 167, radiusY: 123 },
];
const fixedCentral = createMockState(0);
const centerOres = fixedCentral.ores.filter((item) => item.boss || item.id.startsWith('boss:'));
const centerMiners = fixedCentral.players.filter((person) => person.id.startsWith('boss-'));

function presentState(at) {
    const base = stops.meadow;
    const east = stops.crossing;
    const isRedirect = mode === 'redirect';
    const goal = isRedirect ? redirected : straight;
    const resultAt = resultsAt[mode];
    const result = at >= resultAt;
    const firstLeg = at <= turnAt;
    const a = firstLeg
        ? mix(start, action, ease(at / turnAt))
        : mix(action, goal, ease((at - turnAt) / (resultAt - turnAt)));
    const blue =
        isRedirect && result ? mix(redirected, afterward, ease((at - resultAt) / 360)) : redirected;
    const receiver = mix({ x: 72, y: 135 }, { x: 39, y: 94 }, ease((at - 390) / 590));
    const easternOres = [
        ore('east-copper', -54, 41, 0),
        ore('east-blue', 21, -26, 1),
        ore('east-amethyst', 62, -95, 2),
        ore('east-copper-2', 65, 55, 0),
    ].map((item) => ({ ...item, ...worldPoint(east, item) }));
    const meadowOres = [
        ore('front-copper', a.x, a.y, 0),
        ore(
            'straight-copper',
            straight.x + (result && !isRedirect ? 25 : 0),
            straight.y,
            0,
            result && !isRedirect ? 1 : 3,
        ),
        ore('route-blue', blue.x, blue.y, 1, result && isRedirect ? 1 : 3),
        ore('route-amethyst', afterward.x, afterward.y, 2, isRedirect && at > 2420 ? 1 : 3),
        ore('resting-copper', -130, 113, 0),
        ore('quiet-gem', 88, -143, 2),
        ore('quiet-blue', 121, 102, 1),
    ]
        .filter((item) => item.id !== 'front-copper' || !result)
        .map((item) => ({ ...item, ...worldPoint(base, item) }));
    const lead = mix({ x: -173, y: 57 }, { x: -75, y: 95 }, ease((at - turnAt) / 1350));
    const helper =
        isRedirect && at > turnAt
            ? mix(receiver, { x: -26, y: 13 }, ease((at - turnAt) / 1050))
            : receiver;
    const miners = [
        miner('player', '나', lead.x, lead.y, 1, 1, -0.08, at > 0 ? 0 : -1000),
        miner(
            'mindeul',
            '민들레',
            helper.x,
            helper.y,
            2,
            -0.48,
            -0.86,
            isRedirect ? turnAt : -1000,
        ),
        miner('bada', '솔방울', 182, 110, 0, -0.83, -0.3),
    ].map((person) => ({ ...person, ...worldPoint(base, person) }));
    const eastMiners = [
        miner('east-player', '밤톨', -61, 103, 1, 0.1, -1),
        miner('east-friend', '도토리', 53, 102, 1, -0.25, -1),
    ].map((person) => ({ ...person, ...worldPoint(east, person) }));
    const moments = [{ at: 0, point: start, tier: 0 }];
    if (isRedirect) moments.push({ at: turnAt, point: action, tier: 0 });
    moments.push({ at: resultAt, point: goal, tier: isRedirect ? 1 : 0 });
    if (isRedirect) moments.push({ at: 2420, point: afterward, tier: 2 });
    const events = moments
        .filter((e) => at > 0 && e.at <= at && at - e.at < 725)
        .map((e) => ({
            kind: e.at >= resultAt ? 'break' : 'hit',
            tier: e.tier,
            at: e.at,
            ...worldPoint(base, e.point),
        }));
    const traces = [{ a: start, b: firstLeg ? a : action, color: '#fff2c4' }];
    if (!firstLeg) traces.push({ a: action, b: a, color: isRedirect ? '#76eff9' : '#fff2c4' });
    if (isRedirect && result)
        traces.push({
            a: redirected,
            b: mix(redirected, afterward, ease((at - resultAt) / 360)),
            color: '#e8b9f8',
        });
    const shards = result
        ? scatter(goal, isRedirect ? 4 : 2, at - resultAt, isRedirect ? 1 : 0)
        : [];
    if (isRedirect && at >= 2420) shards.push(...scatter(afterward, 2, at - 2420, 2));
    return {
        now: at,
        players: [...miners, ...eastMiners, ...centerMiners],
        ores: [...meadowOres, ...easternOres, ...centerOres],
        bossNextAt: null,
        events,
        traces,
        shards,
        receiver: helper,
    };
}
function scatter(p, count, age, tier) {
    return Array.from({ length: count }, (_, index) => {
        const angle = (index * Math.PI * 2) / count + 0.18;
        const r = 15 + ease(age / 270) * 35 + index * 2;
        return { x: p.x + Math.cos(angle) * r, y: p.y + Math.sin(angle) * r, tier };
    });
}

function projected(p) {
    return { x: p.x, y: p.y * projectionTilt };
}
function isNear(zone, limits) {
    const stem = stops[zone];
    return (
        Math.abs(stem.x - limits.x) < limits.width + 260 &&
        Math.abs(stem.y * projectionTilt - limits.y) < limits.height + 200
    );
}
function ellipse(ctx, x, y, rx, ry, color) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
}
function drawStone(ctx, base, stone) {
    const p = projected(worldPoint(base, stone));
    const { x, y } = p;
    const radius = stone.r;
    ellipse(ctx, x + 6, y + 7, radius * 1.08, radius * 0.46, '#3a543746');
    ctx.beginPath();
    ctx.moveTo(x - radius, y + 1);
    ctx.lineTo(x - radius * 0.69, y - radius * 0.68);
    ctx.lineTo(x - radius * 0.18, y - radius * 0.9);
    ctx.lineTo(x + radius * 0.52, y - radius * 0.72);
    ctx.lineTo(x + radius * 0.96, y - radius * 0.02);
    ctx.lineTo(x + radius * 0.67, y + radius * 0.27);
    ctx.lineTo(x - radius * 0.67, y + radius * 0.27);
    ctx.closePath();
    ctx.fillStyle = '#778069';
    ctx.fill();
    ctx.strokeStyle = '#56624e';
    ctx.lineWidth = 2;
    ctx.stroke();
    ellipse(ctx, x - radius * 0.16, y - radius * 0.55, radius * 0.49, radius * 0.2, '#b4bf8d');
}
function drawTerrain(ctx, _state, limits) {
    for (const item of geometry) {
        if (!isNear(item.zone, limits)) continue;
        const base = stops[item.zone];
        const p = projected(base);
        ellipse(ctx, p.x, p.y, item.radiusX, item.radiusY, '#b8a4753f');
        ellipse(ctx, p.x, p.y, item.radiusX * 0.91, item.radiusY * 0.78, '#e2cb973a');
        for (const stone of item.rocks) drawStone(ctx, base, stone);
    }
}
function drawArrow(ctx, from, to, color) {
    const a = projected(worldPoint(stops.meadow, from));
    const b = projected(worldPoint(stops.meadow, to));
    if (Math.hypot(b.x - a.x, b.y - a.y) < 8) return;
    const heading = Math.atan2(b.y - a.y, b.x - a.x);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3.1;
    ctx.setLineDash([7, 7]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - Math.cos(heading - 0.6) * 13, b.y - Math.sin(heading - 0.6) * 13);
    ctx.lineTo(b.x - Math.cos(heading + 0.6) * 13, b.y - Math.sin(heading + 0.6) * 13);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
}
function drawOverlay(ctx, state, limits) {
    if (!isNear('meadow', limits)) return;
    ctx.save();
    if (state.now === 0) drawArrow(ctx, start, action, '#fff2c4');
    for (const line of state.traces) drawArrow(ctx, line.a, line.b, line.color);
    for (const shard of state.shards) {
        const { x, y } = projected(worldPoint(stops.meadow, shard));
        ellipse(ctx, x, y + 6, 8, 3, '#51604860');
        ctx.beginPath();
        ctx.moveTo(x, y - 9);
        ctx.lineTo(x + 6, y - 2);
        ctx.lineTo(x, y + 5);
        ctx.lineTo(x - 6, y - 1);
        ctx.closePath();
        ctx.strokeStyle = '#fff4d7';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.fillStyle = ['#ebad59', '#71d5f1', '#e4a8e9'][shard.tier];
        ctx.fill();
    }
    if (mode === 'redirect' && state.now >= turnAt && state.now < turnAt + 520) {
        const { x, y } = projected(worldPoint(stops.meadow, action));
        ellipse(ctx, x, y, 21, 13, '#61e9fb58');
    }
    ctx.restore();
}
const view = createView(canvas, {
    drawTerrain,
    drawOverlay,
    fitScale: (width, height) => Math.min(1.48, width / 525, height / 305),
});
const name = get('region-name');
const heading = get('moment-title');
const copy = get('moment-copy');
const outcome = get('outcome');
const buttons = [...map.querySelectorAll('[data-region]')];

function setText(element, text) {
    if (element.textContent !== text) element.textContent = text;
}
function render() {
    view.render(presentState(time), 'player', camera);
    for (const button of buttons) {
        const current = String(button.dataset.region === location);
        if (button.getAttribute('aria-current') !== current)
            button.setAttribute('aria-current', current);
    }
    range.value = time;
    round.setAttribute('aria-pressed', String(mode === 'roll'));
    redirect.setAttribute('aria-pressed', String(mode === 'redirect'));
    const branch = mode === 'redirect';
    const done = time >= resultsAt[mode];
    setText(name, stops[location]?.name ?? '광맥 사이 · 초원');
    if (location !== 'meadow') {
        setText(
            heading,
            location === 'boss'
                ? '정중앙의 대광맥 골렘'
                : location === 'crossing'
                  ? '바위 사이로 모이는 광석'
                  : '하나로 이어진 초원',
        );
        setText(
            copy,
            location === 'boss'
                ? '강화한 곡갱이로 큰 광석을 굴려 골렘에게 부딪히게 한다.'
                : location === 'crossing'
                  ? '좁은 길에 광석이 겹치면, 지나가던 사람도 타격에 끼어들 수 있다.'
                  : '목업의 카메라가 광맥 사이를 보고 있어요. 지도에서 다른 위치를 둘러보세요.',
        );
    } else if (time === 0) {
        setText(heading, '구리 하나, 갈라지는 두 경로');
        setText(copy, '같은 구리를 날린 뒤, 옆에서 한 번 더 치면 어디까지 이어질까요?');
    } else if (time < turnAt) {
        setText(heading, '내 곡갱이가 구리를 날림');
        setText(copy, '흰 점선은 첫 타격으로 굴러간 길. 민들레가 옆에서 다가온다.');
    } else if (!done) {
        setText(heading, branch ? '민들레가 옆에서 받아침' : '구리가 원래 방향으로 굴러감');
        setText(
            copy,
            branch
                ? '하늘색 경로가 청석 무리 쪽으로 꺾인다.'
                : '그대로 두면 앞에 있는 구리 한 덩이와 부딪힌다.',
        );
    } else {
        setText(heading, branch ? '청석이 자수정까지 밀어냄' : '앞의 구리 한 덩이에 충돌');
        setText(
            copy,
            branch
                ? '내 쪽의 파편을 먼저 주울지, 옆에서 열린 청석·자수정 쪽을 노릴지 선택한다.'
                : '내가 앞으로 가면 구리 파편을 먼저 챙길 수 있다.',
        );
    }
    setText(
        outcome,
        done
            ? branch
                ? `연쇄 ${time >= 2420 ? 3 : 2} · 파편 ${time >= 2420 ? 6 : 4}개`
                : '충돌 1회 · 구리 파편 2개'
            : '',
    );
}
function selectRegion(id) {
    location = id;
    camera.x = stops[id].x;
    camera.y = stops[id].y + (id === 'boss' ? 110 : 4);
    render();
}
function play(choice) {
    if (location !== 'meadow') selectRegion('meadow');
    mode = choice;
    started = null;
    time = reduceMotion.matches ? duration : 0;
    playing = !reduceMotion.matches;
    render();
}
for (const button of buttons) {
    const p = stops[button.dataset.region];
    button.style.left = `${50 + (p.x / mapSize.width) * 100}%`;
    button.style.top = `${50 + (p.y / mapSize.height) * 100}%`;
    button.addEventListener('click', () => selectRegion(button.dataset.region));
}
round.addEventListener('click', () => play('roll'));
redirect.addEventListener('click', () => play('redirect'));
replay.addEventListener('click', () => play(mode));
range.addEventListener('input', () => {
    playing = false;
    time = Number(range.value);
    render();
});
canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || drag) return;
    canvas.setPointerCapture(e.pointerId);
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
});
canvas.addEventListener('pointermove', (e) => {
    if (drag?.id !== e.pointerId) return;
    const delta = view.panDelta(drag.x - e.clientX, drag.y - e.clientY);
    camera.x = Math.max(-mapSize.width / 2, Math.min(mapSize.width / 2, camera.x + delta.x));
    camera.y = Math.max(-mapSize.height / 2, Math.min(mapSize.height / 2, camera.y + delta.y));
    drag.x = e.clientX;
    drag.y = e.clientY;
    location = Object.keys(stops).find(
        (id) => Math.hypot(stops[id].x - camera.x, stops[id].y - camera.y) < 360,
    );
    render();
});
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    canvas.addEventListener(type, (e) => {
        if (drag?.id === e.pointerId) drag = null;
    });
}
function animate(now) {
    if (playing) {
        started ??= now;
        time = Math.min(duration, Math.round(now - started));
        if (time === duration) playing = false;
        render();
    }
    requestAnimationFrame(animate);
}
addEventListener('resize', render);
selectRegion('meadow');
requestAnimationFrame(animate);
