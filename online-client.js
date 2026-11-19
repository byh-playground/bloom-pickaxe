import { createDashPrediction } from './client-prediction.js';

const sameShape = (a, b) =>
    a === b ||
    (a?.length === b?.length && a?.every((point, i) => point.x === b[i].x && point.y === b[i].y));

function makeActors() {
    let entries = new Map();
    return {
        update(rawRecords, keyFor, geometryField) {
            const next = new Map();
            for (const raw of rawRecords) {
                const id = keyFor(raw);
                const old = entries.get(id);
                const record = old?.record ?? {};
                if (geometryField && !Array.isArray(raw[geometryField])) {
                    if (
                        !Array.isArray(record[geometryField]) ||
                        (geometryField === 'polygon' &&
                            raw.geometryRevision !== record.geometryRevision)
                    )
                        throw new Error('Missing actor geometry');
                }
                const geometry =
                    geometryField &&
                    (raw[geometryField] === undefined ||
                    sameShape(record[geometryField], raw[geometryField])
                        ? record[geometryField]
                        : raw[geometryField]);
                Object.assign(record, raw);
                if (geometry) record[geometryField] = geometry;
                next.set(id, { record });
            }
            entries = next;
            return Array.from(entries.values(), ({ record }) => record);
        },
        get(id) {
            return entries.get(id)?.record;
        },
    };
}

const playbackDelayMs = 100;
const maximumSnapshots = 8;
const mix = (a, b, weight) => a + (b - a) * weight;

export function createPlayback(delayMs = playbackDelayMs, metrics) {
    const frames = [];
    const display = new Map();
    let time, lastFrameAt, firstFrameAt;
    let started = false;

    function actors(first, second, weight, prefix, identity, visible) {
        const models = [];
        for (const actor of first.values()) {
            const key = identity(actor);
            const cacheKey = prefix + key;
            visible.add(cacheKey);
            const model = display.get(cacheKey) ?? {};
            display.set(cacheKey, model);
            Object.assign(model, actor);
            const next = second.get(key);
            if (next && Math.hypot(actor.x - next.x, actor.y - next.y) <= 350) {
                model.x = mix(actor.x, next.x, weight);
                model.y = mix(actor.y, next.y, weight);
                if (Number.isFinite(actor.z) && Number.isFinite(next.z))
                    model.z = mix(actor.z, next.z, weight);
            }
            models.push(model);
        }
        return models;
    }
    function index(records, identity) {
        return new Map(records.map((actor) => [identity(actor), { ...actor }]));
    }
    const byId = (actor) => actor.id;
    const byUid = (actor) => actor.uid;

    function push(state) {
        if (frames.length && state.time <= frames.at(-1).state.time) return;
        frames.push({
            state: {
                ...state,
                dash: { ...state.dash },
                bag: { ...state.bag },
                marks: [...state.marks],
            },
            players: index([state.player, ...(state.others ?? [])], byId),
            rocks: index(state.rocks, byUid),
            shards: index(state.shards, byId),
        });
        if (frames.length > maximumSnapshots) frames.shift();
    }

    function sample(now) {
        if (!frames.length) return null;
        const newest = frames.at(-1).state.time;
        if (time === undefined) time = frames[0].state.time;
        firstFrameAt ??= now;
        started ||= newest - time >= delayMs - 0.001 || now - firstFrameAt >= delayMs * 1.5;
        const elapsed = lastFrameAt === undefined ? 0 : Math.max(0, now - lastFrameAt);
        lastFrameAt = now;
        // A small clock correction absorbs arrival jitter without resetting the lerp at each packet.
        const lag = newest - time;
        const pace = Math.min(1.12, Math.max(0.88, 1 + (lag - delayMs) / 400));
        if (started && frames.length > 1)
            time = Math.max(frames[0].state.time, Math.min(newest, time + elapsed * pace));
        if (started) {
            metrics?.record('bufferMs', newest - time);
            metrics?.record('bufferEmpty', newest - time <= 0.001 ? 1 : 0);
        }
        while (frames.length > 1 && frames[1].state.time <= time) frames.shift();
        const first = frames[0];
        const second = frames[1] ?? first;
        const weight =
            first === second
                ? 0
                : (time - first.state.time) / (second.state.time - first.state.time);
        const visible = new Set();
        const [player, ...others] = actors(
            first.players,
            second.players,
            weight,
            'p:',
            byId,
            visible,
        );
        const rocks = actors(first.rocks, second.rocks, weight, 'r:', byUid, visible);
        const shards = actors(first.shards, second.shards, weight, 's:', byId, visible);
        for (const key of display.keys()) if (!visible.has(key)) display.delete(key);
        const actorFor = (actor) =>
            actor?.uid ? display.get('r:' + actor.uid) : display.get('s:' + actor?.id);
        const remap = (entry, field) => {
            const actor = actorFor(entry?.[field]);
            return actor ? { ...entry, [field]: actor } : null;
        };
        return {
            ...first.state,
            time,
            player,
            others,
            rocks,
            shards,
            target: remap(first.state.target, 'actor'),
            breaking: remap(first.state.breaking, 'target'),
            breakingOthers: (first.state.breakingOthers ?? [])
                .map((entry) => remap(entry, 'target'))
                .filter(Boolean),
        };
    }
    return { push, sample };
}

export function normalizeServerOrigin(value) {
    try {
        const url = new URL(value);
        if (url.username || url.password || url.pathname !== '/' || url.search || url.hash)
            return null;
        if (url.protocol === 'https:') return url.origin;
        const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
        return url.protocol === 'http:' && loopback ? url.origin : null;
    } catch {
        return null;
    }
}

export async function hasOnlineServer(origin = location.origin) {
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const response = await fetch(new URL('/api/online', origin), {
                signal: AbortSignal.timeout(4500),
                cache: 'no-store',
                credentials: 'omit',
                referrerPolicy: 'no-referrer',
            });
            if (response.status >= 500) continue;
            if (!response.ok) return null;
            const manifest = await response.json();
            return manifest?.online === true && manifest.protocol === 1 ? manifest : null;
        } catch {
            // Retry a transient network error or timeout once.
        }
    }
    return null;
}

export function createOnlineClient(
    onChange,
    origin = location.origin,
    capabilities,
    engine,
    metrics,
) {
    let socket;
    let state = null;
    let seq = 0;
    let channelId = '';
    let playerId = '';
    let phase = 'connecting';
    let playback;
    let players, rocks, shards, marks;
    let Rapier, prediction;
    const sentInputs = new Map();
    const info = () => ({ phase, channelId, playerId });
    const notify = () => onChange(info());

    engine?.then((module) => {
        Rapier = module;
    });

    function receive(raw, bytes) {
        const now = performance.now();
        if (metrics) {
            metrics.packet(now, bytes, raw.time);
            let sent;
            for (const [key, timestamp] of sentInputs) {
                if (!Number.isSafeInteger(raw.ackSeq) || key > raw.ackSeq) break;
                sent = timestamp;
                sentInputs.delete(key);
            }
            if (sent !== undefined) metrics.record('inputAckMs', now - sent);
        }

        const [player, ...others] = players.update(
            [{ ...raw.player, id: playerId }, ...(raw.others ?? [])],
            ({ id }) => id,
        );
        const liveRocks = rocks.update(raw.rocks, ({ uid }) => uid, 'polygon');
        const liveShards = shards.update(raw.shards, ({ id }) => id, 'shape');
        const actorFor = (actor) => (actor?.uid ? rocks.get(actor.uid) : shards.get(actor?.id));
        const liveMarks = new Map();
        for (const mark of raw.marks) {
            const key = mark.eventId ?? `${mark.kind}:${mark.at}:${mark.x}:${mark.y}`;
            liveMarks.set(key, marks.get(key) ?? mark);
        }
        marks = liveMarks;

        const target = actorFor(raw.target?.actor);
        const breaking = actorFor(raw.breaking?.target);
        state = {
            ...raw,
            player,
            others,
            rocks: liveRocks,
            shards: liveShards,
            marks: [...marks.values()],
            target: target ? { ...raw.target, actor: target } : null,
            breaking: breaking ? { ...raw.breaking, target: breaking } : null,
            breakingOthers: (raw.breakingOthers ?? []).flatMap((entry) => {
                const actor = actorFor(entry.target);
                return actor ? [{ ...entry, target: actor }] : [];
            }),
        };
        if (Rapier && Number.isSafeInteger(raw.ackSeq)) {
            const reported = capabilities?.tickRate;
            const serverTickRate = Number.isInteger(reported) && reported > 0 ? reported : 100;
            prediction ??= createDashPrediction(Rapier, serverTickRate);
            prediction.reconcile(state, now);
        }
        playback.push(state);
        if (phase !== 'online') {
            phase = 'online';
            notify();
        }
    }

    function connect() {
        const previousSocket = socket;
        socket = null;
        previousSocket?.close();
        phase = 'connecting';
        channelId = '';
        playerId = '';
        state = null;
        seq = 0;
        playback = createPlayback(playbackDelayMs, metrics);
        sentInputs.clear();
        players = makeActors();
        rocks = makeActors();
        shards = makeActors();
        marks = new Map();
        prediction?.dispose();
        prediction = null;
        notify();
        const url = new URL('/play', origin);
        url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
        if (capabilities?.geometry === 1) url.searchParams.set('geometry', '1');
        let connection;
        try {
            connection = new WebSocket(url);
        } catch {
            phase = 'disconnected';
            notify();
            return;
        }
        socket = connection;
        const timeout = setTimeout(() => {
            if (socket === connection && phase === 'connecting') connection.close();
        }, 12_000);
        connection.addEventListener('close', () => {
            clearTimeout(timeout);
            if (socket !== connection) return;
            phase = 'disconnected';
            prediction?.dispose();
            prediction = null;
            notify();
        });
        connection.addEventListener('message', ({ data }) => {
            if (socket !== connection) return;
            let packet;
            try {
                packet = JSON.parse(data);
            } catch {
                connection.close(1002);
                return;
            }
            if (packet.type === 'welcome') {
                playerId = packet.playerId;
                channelId = packet.channelId;
            } else if (packet.type === 'state' && playerId) {
                clearTimeout(timeout);
                try {
                    receive(packet.state, metrics ? new TextEncoder().encode(data).byteLength : 0);
                } catch {
                    connection.close(1002);
                }
            }
        });
    }

    return {
        connect,
        info,
        send(input) {
            if (socket?.readyState !== WebSocket.OPEN || phase !== 'online') return false;
            socket.send(JSON.stringify({ type: 'input', seq: ++seq, ...input }));
            const now = performance.now();
            prediction?.record(seq, input, now);
            if (metrics && (input.dashIntent || input.attack)) {
                sentInputs.set(seq, now);
                if (sentInputs.size > 64) sentInputs.delete(sentInputs.keys().next().value);
            }
            return true;
        },
        sample(now) {
            const scene = playback?.sample(now);
            if (!scene) return null;
            const local = prediction?.sample(now, scene.time);
            if (local) {
                const { dash, ...pose } = local;
                return { ...scene, player: { ...scene.player, ...pose }, dash };
            }
            return scene;
        },
    };
}
