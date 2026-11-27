import { createFractureWorld, minerals, tickMs, pickaxes } from './fracture-world.js';
import { createFractureView } from './fracture-view.js';
import { onlineCopperRavineCenter, onlineIronRidgeCenter } from './fracture-spawn.js';
import { createStick } from './fracture-stick.js';
import {
    createOnlineClient,
    createPlayback,
    hasOnlineServer,
    normalizeServerOrigin,
} from './online-client.js';
import { createRenderMetrics } from './render-metrics.js';
import { loadGameServer } from './game-server-config.js';

const get = (id) => document.getElementById(id);
const canvas = get('field');
const arena = canvas.closest('.fracture');
const status = get('status');
const resetButton = get('reset');
const onlinePanel = get('online-panel');
const connectionStatus = get('connection-status');
const compass = get('center-compass');
const centerDistance = get('center-distance');
const expeditionBoss = get('expedition-boss');
const expeditionPlates = get('expedition-plates');
const expeditionMeter = get('expedition-meter');
const expeditionOpening = get('expedition-opening');
const expeditionVictoryMs = 2400;
let expeditionVictoryAt = -Infinity;
const mineMap = get('mine-map');
const mineMapContext = mineMap.getContext('2d');
const mineRank = get('mine-rank');
const mineRankList = get('mine-rank-list');
const tool = get('tool');
const nextTool = get('next-tool');
const ingredientList = get('ingredients');
const ingredients = Object.entries(minerals).map(([id, ore]) => {
    const item = document.createElement('li');
    const gem = document.createElement('i');
    const title = document.createElement('span');
    const count = document.createElement('b');
    gem.className = 'chip';
    item.style.setProperty('--ore', ore.color);
    item.style.setProperty('--ore-light', ore.light);
    gem.setAttribute('aria-hidden', 'true');
    title.textContent = ore.name;
    item.append(gem, title, count);
    ingredientList.append(item);
    return { id, item, count };
});
const touchControls = arena.querySelector('.touch-sticks');
const touchScreen = matchMedia('(pointer: coarse)');
const view = createFractureView(canvas, touchControls);
canvas.tabIndex = 0;
const params = new URLSearchParams(location.search);
const metrics = params.get('perf') === '1' ? createRenderMetrics() : null;
const seedParam = params.get('seed');
const seed =
    seedParam !== null && /^\d+$/.test(seedParam)
        ? Number(seedParam) >>> 0
        : crypto.getRandomValues(new Uint32Array(1))[0];
status.textContent = '채굴터 준비 중…';
const offline = params.get('offline') === '1';
const configuredServer = offline ? null : (params.get('server') ?? (await loadGameServer()));
const forceOnline = !offline && (params.get('online') === '1' || configuredServer !== null);
const serverOrigin =
    configuredServer === null ? location.origin : normalizeServerOrigin(configuredServer);
if (params.has('server') && serverOrigin) {
    const menuUrl = new URL('./', location.href);
    menuUrl.searchParams.set('server', serverOrigin);
    get('return-menu').href = menuUrl;
}
const capabilities = !offline && serverOrigin && (await hasOnlineServer(serverOrigin));
const loadRapier = () =>
    import('https://cdn.jsdelivr.net/npm/@dimforge/rapier2d-compat@0.21.0/dist/rapier.mjs')
        .then(async ({ default: engine }) => {
            await engine.init();
            return engine;
        })
        .catch(() => null);
const online = capabilities
    ? createOnlineClient(
          updateConnection,
          serverOrigin,
          capabilities,
          capabilities.geometry === 1 ? loadRapier() : null,
          metrics,
      )
    : null;
const Rapier = !online && !forceOnline ? await loadRapier() : null;
if (!online && !forceOnline && !Rapier)
    status.textContent = '충돌 모듈을 불러오지 못했어요. 새로고침해 주세요.';
let world = Rapier ? createFractureWorld(Rapier, seed) : null;
let offlinePlayback = world ? createPlayback(tickMs) : null;
if (world) offlinePlayback.push(world.state);
let lastFrame;
let lastHudFrame = -Infinity;
let renderedLevel = -1;
let carry = 0;
// Chrome can block while allocating its audio graph. Prepare it during boot.
// The first gesture unlocks playback on browsers that start it suspended.
const sound = prepareAudio();
let impactNoise;
const held = new Set();
const keys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'];
let heard = new WeakSet();
let queuedAttack = false;
let sentMovement = '';
let sentAt = -Infinity;
const movePad = get('move-stick');
const moveStick = createStick(movePad, audioReady, {
    onVector() {
        if (online) sendInput(performance.now());
    },
});
const attackButton = get('attack-button');

function requestAttack() {
    if (online) {
        if (online.info().phase !== 'online') return;
        queuedAttack = true;
        sendInput(performance.now());
    } else {
        world?.attack();
    }
    audioReady();
}
attackButton.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    requestAttack();
});
attackButton.addEventListener('click', (event) => {
    if (event.detail === 0) requestAttack();
});

function resetInputs() {
    queuedAttack = false;
    held.clear();
    moveStick.reset();
    world?.cancelAttack();
    if (online) online.send({ x: 0, y: 0, attack: false });
    sentMovement = '';
}

function updateConnection({ phase, channelId } = { phase: 'unavailable' }) {
    onlinePanel.hidden = false;
    onlinePanel.dataset.phase = phase;
    compass.hidden = phase !== 'online';
    if (phase !== 'online') {
        expeditionBoss.hidden = true;
        expeditionVictoryAt = -Infinity;
        mineMap.hidden = true;
        mineRank.hidden = true;
    }
    resetButton.hidden = phase === 'online' || phase === 'connecting';
    resetButton.title = '다시 연결';
    resetButton.setAttribute('aria-label', '다시 연결');
    if (phase === 'online') {
        resetInputs();
        updateText(connectionStatus, '채널 ' + channelId);
        updateText(status, '');
    } else if (phase === 'connecting') {
        updateText(connectionStatus, '접속 중');
        updateText(status, '공유 채굴터에 연결하는 중이에요.');
    } else {
        resetInputs();
        updateText(connectionStatus, '연결 끊김');
        updateText(status, '공유 채굴터에 연결하지 못했어요. 다시 연결해 주세요.');
    }
}

function updateText(node, text) {
    if (node.textContent !== String(text)) node.textContent = text;
}
function prepareAudio() {
    if (!window.AudioContext) return null;
    try {
        return new AudioContext();
    } catch (error) {
        if (!(error instanceof DOMException)) throw error;
        return null;
    }
}

function audioReady() {
    if (sound && sound.state !== 'running') void sound.resume().catch(() => {});
}
function strikeSound(mark, now) {
    if (!impactNoise) {
        impactNoise = sound.createBuffer(1, Math.round(sound.sampleRate * 0.12), sound.sampleRate);
        const samples = impactNoise.getChannelData(0);
        let value = 3701;
        for (let i = 0; i < samples.length; i++) {
            value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
            samples[i] = value / 2147483648 - 1;
        }
    }
    const strength = mark.strength ?? 0.75;
    const hard = mark.kind === 'clink';
    const rock = mark.kind === 'cut' || mark.kind === 'split' || mark.kind === 'finisher';
    const split = mark.kind === 'split';
    const air = mark.kind === 'swing';
    const grit = sound.createBufferSource();
    const band = sound.createBiquadFilter();
    const crack = sound.createGain();
    grit.buffer = impactNoise;
    grit.playbackRate.value = hard ? 1.45 : 1;
    band.type = 'bandpass';
    band.frequency.value = air ? 820 : hard ? 2850 : split ? 1160 : rock ? 1680 : 690;
    band.Q.value = hard ? 2.7 : 0.8;
    crack.gain.setValueAtTime(strength * (air ? 0.07 : hard ? 0.2 : 0.25), now);
    crack.gain.exponentialRampToValueAtTime(0.001, now + (hard ? 0.035 : 0.09));
    grit.connect(band).connect(crack).connect(sound.destination);
    grit.onended = () => {
        grit.disconnect();
        band.disconnect();
        crack.disconnect();
    };
    grit.start(now);
    if (air) return;

    const thump = sound.createOscillator();
    const volume = sound.createGain();
    thump.type = hard ? 'triangle' : 'sine';
    thump.frequency.setValueAtTime(hard ? 465 : rock ? 145 : 105, now);
    thump.frequency.exponentialRampToValueAtTime(hard ? 245 : 45, now + 0.075);
    volume.gain.setValueAtTime(hard ? 0.035 : strength * 0.17, now);
    volume.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    thump.connect(volume).connect(sound.destination);
    thump.onended = () => {
        thump.disconnect();
        volume.disconnect();
    };
    thump.start(now);
    thump.stop(now + 0.11);
}
function playSounds(state) {
    if (sound?.state !== 'running') return;
    for (const mark of state.marks) {
        if (heard.has(mark) || state.time < mark.at) continue;
        heard.add(mark);
        if (online && Math.hypot(state.player.x - mark.x, state.player.y - mark.y) > 380) continue;
        const now = sound.currentTime;
        if (
            mark.kind === 'swing' ||
            mark.kind === 'cut' ||
            mark.kind === 'finisher' ||
            mark.kind === 'split' ||
            mark.kind === 'clink' ||
            mark.kind === 'hurt' ||
            mark.kind === 'slam' ||
            mark.kind === 'bait' ||
            mark.kind === 'bossPlate' ||
            mark.kind === 'bossFall' ||
            mark.kind === 'goldBurst' ||
            mark.kind === 'collapse'
        ) {
            strikeSound(mark, now);
            continue;
        }
        const frequency = { collect: 705, upgrade: 825, bossVictory: 523 }[mark.kind];
        if (!frequency) continue;
        const osc = sound.createOscillator(),
            gain = sound.createGain();
        osc.frequency.setValueAtTime(frequency, now);
        osc.frequency.exponentialRampToValueAtTime(
            mark.kind === 'collect' ? frequency * 1.23 : frequency * 0.49,
            now + 0.09,
        );
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.connect(gain);
        gain.connect(sound.destination);
        osc.start(now);
        osc.stop(now + 0.12);
        osc.onended = () => {
            osc.disconnect();
            gain.disconnect();
        };
    }
}
let lastMapAt = -Infinity;
let rankKey = '';
function showRank(state) {
    const entries = state.ranking ?? [];
    mineRank.hidden = entries.length < 2;
    if (mineRank.hidden) return;
    const key = entries.map(({ id, breaks }) => id + ':' + breaks).join(',');
    if (key === rankKey) return;
    rankKey = key;
    const rows = entries.map(({ id, breaks }) => {
        const row = document.createElement('li');
        const self = id === state.player.id;
        row.dataset.self = self;
        row.textContent = self ? '나' : '광부 ' + id.slice(-4);
        const score = document.createElement('b');
        score.textContent = breaks;
        row.append(score);
        return row;
    });
    mineRankList.replaceChildren(...rows);
}
function drawMineMap(state) {
    if (state.time >= lastMapAt && state.time - lastMapAt < 100) return;
    lastMapAt = state.time;
    const ctx = mineMapContext;
    const cx = mineMap.width / 2;
    const cy = mineMap.height / 2;
    const scale = 0.118;
    ctx.fillStyle = '#243c30';
    ctx.fillRect(0, 0, mineMap.width, mineMap.height);
    ctx.fillStyle = '#355041';
    for (let i = 0; i < mineMap.width; i += 16) ctx.fillRect(i, 0, 1, mineMap.height);
    for (let i = 0; i < mineMap.height; i += 16) ctx.fillRect(0, i, mineMap.width, 1);
    for (const rock of state.rocks) {
        const x = cx + (rock.x - state.player.x) * scale;
        const y = cy + (rock.y - state.player.y) * scale;
        const size = rock.guardian || rock.boss ? 4 : rock.lode ? 3 : 1.5;
        ctx.fillStyle = rock.guardian ? '#ff8172' : minerals[rock.id].color;
        ctx.fillRect(x - size, y - size, size * 2, size * 2);
    }
    for (const passage of state.expedition?.passages ?? []) {
        const x = cx + (passage.x - state.player.x) * scale;
        const y = cy + (passage.y - state.player.y) * scale;
        ctx.fillStyle = passage.open ? '#8ee3c8' : '#d59173';
        ctx.fillRect(x - 3, y - 3, 6, 6);
    }
    for (const other of state.others ?? []) {
        const x = cx + (other.x - state.player.x) * scale;
        const y = cy + (other.y - state.player.y) * scale;
        ctx.fillStyle = '#8ed5dc';
        ctx.fillRect(x - 2, y - 2, 4, 4);
    }
    ctx.fillStyle = '#fff4bb';
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fill();
}
function showExpeditionBoss(state) {
    const boss = state.expedition?.boss;
    if (!state.expedition || state.time < expeditionVictoryAt) expeditionVictoryAt = -Infinity;
    const victory = state.marks.findLast(
        (mark) => mark.kind === 'bossVictory' && mark.at <= state.time,
    );
    if (victory) expeditionVictoryAt = Math.max(expeditionVictoryAt, victory.at);
    const justWon = state.time - expeditionVictoryAt < expeditionVictoryMs;
    const returned = state.expedition?.completed && state.expedition.kind === 'lode';
    const readyToReturn = state.expedition?.completed && state.expedition.kind === 'passage';
    const completed = !boss && (justWon || readyToReturn);
    expeditionBoss.hidden = !boss && !completed && !returned;
    if (expeditionBoss.hidden) return;
    const seconds = Math.ceil(((boss?.exposedUntilMs ?? 0) - state.time) / 100) / 10;
    const exposed = seconds > 0;
    if (expeditionBoss.dataset.exposed !== String(exposed))
        expeditionBoss.dataset.exposed = exposed;
    if (expeditionBoss.dataset.completed !== String(completed || Boolean(returned)))
        expeditionBoss.dataset.completed = completed || Boolean(returned);
    expeditionMeter.hidden = !boss;
    if (boss) {
        const unitCount = boss.plates ? boss.maxPlates : boss.coreHits;
        const remaining = boss.plates || boss.coreHp;
        const portion = String(remaining / unitCount);
        if (expeditionMeter.style.getPropertyValue('--plates') !== portion)
            expeditionMeter.style.setProperty('--plates', portion);
        const division = 100 / unitCount + '%';
        if (expeditionMeter.style.getPropertyValue('--division') !== division)
            expeditionMeter.style.setProperty('--division', division);
    }
    updateText(
        expeditionPlates,
        boss
            ? boss.plates
                ? '대광맥 · 방어판 ' + boss.plates + '/' + boss.maxPlates
                : '대광맥 코어 · ' + boss.coreHp + '/' + boss.coreHits
            : returned
              ? '원정 완주 · 다이아 곡괭이'
              : '대광맥 격파',
    );
    updateText(
        expeditionOpening,
        !boss || boss.coreHp === 0
            ? returned
                ? '귀환 캠프를 나침반에 표시했어요'
                : readyToReturn
                  ? '귀환 통로가 열렸어요'
                  : '거대 결정이 무너졌어요'
            : exposed
              ? '약점 노출 ' + seconds.toFixed(1) + '초'
              : boss.pulsing
                ? boss.coreHp === 1
                    ? '최후 파동 · 낙석과 바닥 표시를 피하세요'
                    : '코어 파동 · 바닥 표시를 피하세요'
                : boss.quaking
                  ? boss.plates === 0
                      ? '코어가 깨어나요 · 낙석을 피하세요'
                      : '연속 낙석 · 마지막 충격 뒤에 반격하세요'
                  : boss.plates === 0
                    ? '코어가 두 번 돌진한 뒤 파동을 일으켜요'
                    : boss.plates === 1
                      ? '붕괴 직전 · 낙석 범위를 피하세요'
                      : boss.plates <= 3
                        ? '균열이 퍼졌어요 · 낙석 주의'
                        : '돌진이 끝나면 약점이 열려요',
    );
}
function refresh(state) {
    const miningStep =
        state.level > 0
            ? 'delve'
            : state.stats?.kills > 0 || state.stats?.pickups > 0
              ? 'gather'
              : state.target?.actor?.cracks?.some((crack) => crack.armed)
                ? 'ram'
                : 'strike';
    if (arena.dataset.miningStep !== miningStep) arena.dataset.miningStep = miningStep;
    const current = pickaxes[state.level];
    const next = pickaxes[state.level + 1];
    if (renderedLevel !== state.level) {
        renderedLevel = state.level;
        updateText(tool, current.name);
        tool.style.setProperty('--tool-color', current.color);
        updateText(nextTool, next ? '다음 · ' + next.name : '다이아 곡괭이 완성');
        for (const { id, item } of ingredients) item.hidden = next ? !(id in next.recipe) : false;
    }
    for (const { id, item, count } of ingredients) {
        if (item.hidden) continue;
        const need = next?.recipe[id];
        updateText(count, need ? state.bag[id] + '/' + need : state.bag[id]);
        const progress = need ? Math.round(Math.min(1, state.bag[id] / need) * 100) + '%' : '';
        if (item.style.getPropertyValue('--progress') !== progress)
            item.style.setProperty('--progress', progress);
    }
    updateText(
        status,
        (online && online.info().phase !== 'online'
            ? '연결이 끊겼어요. 다시 연결해 주세요.'
            : state.message) ||
            (state.level > 0
                ? ''
                : touchScreen.matches
                  ? '오른쪽 버튼으로 금 내기 · 왼쪽 스틱으로 밀어 깨기'
                  : '클릭으로 금 내기 · WASD로 밀어 깨기'),
    );
    const { center, expedition } = state;
    const compactFight = Boolean(expedition?.boss) && !expedition.completed;
    if (online) {
        if (online.info().phase !== 'online') return;
        const { channelId } = online.info();
        const count = Number.isInteger(state.population) ? ' · ' + state.population + '명' : '';
        updateText(connectionStatus, '채널 ' + channelId + count);
        if (compactFight) mineRank.hidden = true;
        else showRank(state);
    }
    compass.hidden = compactFight || (!center && !expedition);
    mineMap.hidden = compass.hidden;
    showExpeditionBoss(state);
    if (!compass.hidden) {
        drawMineMap(state);
        const goal =
            expedition ??
            (state.level === 1
                ? onlineCopperRavineCenter
                : state.level === 2
                  ? onlineIronRidgeCenter
                  : center);
        const label =
            expedition?.label ??
            (state.level === 1 ? '구리 광맥' : state.level === 2 ? '철 능선' : '대광맥');
        const x = goal.x - state.player.x;
        const y = goal.y - state.player.y;
        const distance = Math.hypot(x, y);
        const bearing = view.screenAngle({ x, y });
        compass.style.setProperty('--bearing', bearing + 'rad');
        updateText(centerDistance, distance < 95 ? label : label + ' ' + Math.round(distance));
    }
}

function getAxes() {
    const stick = moveStick.read();
    if (stick.x || stick.y) return view.stickVector(stick);
    const any = (...a) => a.some((key) => held.has(key));
    return view.worldVector(
        Number(any('KeyD', 'ArrowRight')) - Number(any('KeyA', 'ArrowLeft')),
        Number(any('KeyS', 'ArrowDown')) - Number(any('KeyW', 'ArrowUp')),
    );
}
function sendInput(now) {
    if (!online) return;
    const { x, y } = getAxes();
    const movement = x.toFixed(3) + ':' + y.toFixed(3);
    if (!queuedAttack && movement === sentMovement && now - sentAt < 100) return;
    if (!online.send({ x, y, attack: queuedAttack })) return;
    sentMovement = movement;
    sentAt = now;
    queuedAttack = false;
}
canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.pointerType === 'touch') return;
    canvas.focus({ preventScroll: true });
    requestAttack();
});
resetButton.addEventListener('click', () => {
    resetInputs();
    if (online) {
        online.connect();
        return;
    }
    if (!world) {
        location.reload();
        return;
    }
    world.dispose();
    world = createFractureWorld(Rapier, seed);
    offlinePlayback = createPlayback(tickMs);
    offlinePlayback.push(world.state);
    carry = 0;
    heard = new WeakSet();
    canvas.focus({ preventScroll: true });
    refresh(world.state);
});
window.addEventListener('keydown', (e) => {
    if (!keys.includes(e.code) || e.target.closest?.('button,select,input')) return;
    e.preventDefault();
    if (e.repeat || held.has(e.code)) return;
    held.add(e.code);
    if (online) sendInput(performance.now());
});
window.addEventListener('keyup', (e) => {
    if (held.delete(e.code) && online) sendInput(performance.now());
});
window.addEventListener('blur', resetInputs);
window.addEventListener('pagehide', resetInputs);
document.addEventListener('visibilitychange', () => {
    if (document.hidden) resetInputs();
});
touchScreen.addEventListener('change', resetInputs);

function frame(now) {
    metrics?.frame(now);
    const sampleStart = metrics ? performance.now() : 0;
    let state;
    if (online) {
        sendInput(now);
        state = online.sample(now);
    } else if (world) {
        if (lastFrame !== undefined) carry += Math.min(80, now - lastFrame);
        lastFrame = now;
        const axes = getAxes();
        while (carry >= tickMs) {
            world.step(axes);
            offlinePlayback.push(world.state);
            carry -= tickMs;
        }
        state = offlinePlayback.sample(now);
    }
    if (metrics) metrics.record('sampleMs', performance.now() - sampleStart);
    if (state) {
        const drawStart = metrics ? performance.now() : 0;
        view.draw(state, now);
        if (metrics) metrics.record('drawMs', performance.now() - drawStart);
        metrics?.record('renderScale', view.renderScale());
        playSounds(state);
        if (now - lastHudFrame >= tickMs) {
            lastHudFrame = now;
            const hudStart = metrics ? performance.now() : 0;
            refresh(state);
            if (metrics) metrics.record('hudMs', performance.now() - hudStart);
        }
    }
    metrics?.render(now);
    requestAnimationFrame(frame);
}
if (online) online.connect();
else if (forceOnline) updateConnection();
else if (world) {
    updateText(connectionStatus, '혼자 연습');
    onlinePanel.hidden = false;
    refresh(world.state);
    view.draw(world.state);
}
requestAnimationFrame(frame);
