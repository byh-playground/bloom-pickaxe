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
                const from = old ? { x: record.x, y: record.y, z: record.z } : raw;
                Object.assign(record, raw);
                if (geometry) record[geometryField] = geometry;
                next.set(id, { record, from, to: raw });
            }
            entries = next;
            return Array.from(entries.values(), ({ record }) => record);
        },
        sample(ratio) {
            for (const { record, from, to } of entries.values()) {
                const jump = Math.hypot(from.x - to.x, from.y - to.y) > 350;
                const t = jump ? 1 : ratio;
                record.x = from.x + (to.x - from.x) * t;
                record.y = from.y + (to.y - from.y) * t;
                if (Number.isFinite(to.z))
                    record.z = (from.z ?? to.z) + (to.z - (from.z ?? to.z)) * t;
            }
        },
        get(id) {
            return entries.get(id)?.record;
        },
    };
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
    try {
        const response = await fetch(new URL('/api/online', origin), {
            signal: AbortSignal.timeout(1800),
            cache: 'no-store',
            credentials: 'omit',
            referrerPolicy: 'no-referrer',
        });
        if (!response.ok) return null;
        const manifest = await response.json();
        return manifest?.online === true && manifest.protocol === 1 ? manifest : null;
    } catch {
        return null;
    }
}

export function createOnlineClient(onChange, origin = location.origin, capabilities, engine) {
    let socket;
    let state = null;
    let seq = 0;
    let channelId = '';
    let playerId = '';
    let phase = 'connecting';
    let receivedAt = 0;
    let interval = 0;
    let previousTime = 0;
    let clock = 0;
    let players, rocks, shards, marks;
    let Rapier, prediction;
    const info = () => ({ phase, channelId, playerId });
    const notify = () => onChange(info());

    engine?.then((module) => {
        Rapier = module;
    });

    function receive(raw) {
        const now = performance.now();
        interval = previousTime ? Math.min(100, Math.max(0, raw.time - previousTime)) : 0;
        receivedAt = now;
        previousTime = raw.time;

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
            prediction ??= createDashPrediction(Rapier);
            prediction.reconcile(state, now);
        }
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
        previousTime = 0;
        clock = 0;
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
        }, 8000);
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
                    receive(packet.state);
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
            prediction?.record(seq, input, performance.now());
            return true;
        },
        sample(now) {
            if (!state) return null;
            const delay = Math.max(0, now - receivedAt);
            const progress = Math.min(1, delay / (interval || 1));
            players.sample(progress);
            rocks.sample(progress);
            shards.sample(progress);
            const serverTime = previousTime - interval * (1 - progress);
            clock = Math.max(clock, serverTime);
            state.time = clock;
            const local = prediction?.sample(now, clock);
            if (local) {
                const { dash, ...pose } = local;
                return { ...state, player: { ...state.player, ...pose }, dash };
            }
            return state;
        },
    };
}
