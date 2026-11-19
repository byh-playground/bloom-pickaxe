import { createFracturePhysics } from './fracture-physics.js';
import { clockToleranceMs, dashRules, tickRate } from './fracture-world.js';

const maxLeadMs = 120;
const playerRadius = 13;
const playerBoundary = 24;
const correctionMs = 70;
const maxDisplaySpeed = (dashRules.distance * 1000) / dashRules.durationMs + 100;
const respawnDistance = 350;
const clamp = (value, lower, upper) => Math.min(upper, Math.max(lower, value));

export function createDashPrediction(Rapier, serverTickRate = tickRate) {
    const tickMs = 1000 / serverTickRate;
    const physics = createFracturePhysics(Rapier, true);
    const obstacles = new Map();
    const player = { x: 0, y: 0 };
    physics.add(player, playerRadius);
    let bounds, dash, time, frameAt, limit;
    let pending = [];
    let acknowledged = { x: 0, y: 0 };
    let held = acknowledged;
    let cursor = 0;
    let correction = null;
    let hurtAt = -Infinity;
    let displayed = null;
    let authoritative = null;

    function updateColliders(state) {
        const active = new Set();
        function update(key, source, radius) {
            active.add(key);
            let actor = obstacles.get(key);
            if (!actor) {
                actor = { ...source };
                obstacles.set(key, actor);
                physics.add(actor, radius);
                return;
            }
            const changed = actor.polygon !== source.polygon;
            Object.assign(actor, source);
            if (changed && actor.polygon) physics.replaceHull(actor);
            physics.sync(actor);
        }
        for (const rock of state.rocks) update('rock:' + rock.uid, rock, rock.r * 1.1);
        for (const [index, obstacle] of state.obstacles.entries())
            update('obstacle:' + index, obstacle, obstacle.r);
        for (const other of state.others) update('peer:' + other.id, other, playerRadius);
        for (const [key, actor] of obstacles) {
            if (active.has(key)) continue;
            physics.remove(actor);
            obstacles.delete(key);
        }
    }

    function step(intent) {
        time += tickMs;
        if (dash.charges < dashRules.capacity && time + clockToleranceMs >= dash.nextChargeAt) {
            dash.charges++;
            dash.nextChargeAt =
                dash.charges < dashRules.capacity ? dash.nextChargeAt + dashRules.rechargeMs : 0;
        }
        if (time + clockToleranceMs >= dash.until) {
            dash.direction = null;
            const direction = held.x || held.y ? held : intent;
            const length = direction ? Math.hypot(direction.x, direction.y) : 0;
            if (dash.charges && length > 0 && time - player.hurtAt >= 120) {
                dash.direction = { x: direction.x / length, y: direction.y / length };
                dash.until = time + dashRules.durationMs;
                dash.charges--;
                if (!dash.nextChargeAt) dash.nextChargeAt = time + dashRules.rechargeMs;
            }
        }
        if (!dash.direction) return;
        const stride =
            (dashRules.distance * Math.min(tickMs, dash.until - time)) / dashRules.durationMs;
        const { x, y } = dash.direction;
        physics.move(player, {
            x:
                clamp(player.x + x * stride, playerBoundary, bounds.width - playerBoundary) -
                player.x,
            y:
                clamp(player.y + y * stride, playerBoundary, bounds.height - playerBoundary) -
                player.y,
        });
        player.faceX = x;
        player.faceY = y;
    }

    function advance(now) {
        const until = Math.min(now, limit);
        while (frameAt + tickMs <= until) {
            frameAt += tickMs;
            let intent = null;
            while (pending[cursor] && pending[cursor].at <= frameAt) {
                const command = pending[cursor++];
                held = command;
                intent = command.dashIntent ?? intent;
            }
            step(intent);
        }
    }

    function correctionAt(now) {
        const weight = correction ? Math.exp(-(now - correction.at) / correctionMs) : 0;
        return weight > 0.02
            ? { x: correction.x * weight, y: correction.y * weight }
            : { x: 0, y: 0 };
    }

    function presentationPose(now) {
        advance(now);
        const { x, y } = player;
        const direction = dash.direction;
        const elapsed = Math.max(0, Math.min(tickMs, Math.min(now, limit) - frameAt));
        const span = Math.min(elapsed, Math.max(0, dash.until - time - tickMs));
        if (!direction || span < clockToleranceMs) return { x, y };
        const distance = (dashRules.distance * span) / dashRules.durationMs;
        physics.move(player, {
            x: clamp(x + direction.x * distance, playerBoundary, bounds.width - playerBoundary) - x,
            y:
                clamp(y + direction.y * distance, playerBoundary, bounds.height - playerBoundary) -
                y,
        });
        const display = { x: player.x, y: player.y };
        player.x = x;
        player.y = y;
        physics.sync(player);
        return display;
    }

    return {
        record(seq, input, now) {
            pending.push({ seq, ...input, at: now });
            if (pending.length > 128) {
                pending.shift();
                cursor = Math.max(0, cursor - 1);
            }
        },
        reconcile(state, now) {
            const ack = state.ackSeq;
            if (!Number.isSafeInteger(ack) || !state.bounds) {
                dash = null;
                return;
            }
            const nextAuthority = { x: state.player.x, y: state.player.y };
            if (
                authoritative &&
                Math.hypot(nextAuthority.x - authoritative.x, nextAuthority.y - authoritative.y) >
                    respawnDistance
            )
                displayed = null;
            authoritative = nextAuthority;
            let first = 0;
            while (pending[first]?.seq <= ack) acknowledged = pending[first++];
            pending = pending.slice(first);
            held = acknowledged;
            cursor = 0;
            bounds = state.bounds;
            updateColliders(state);
            Object.assign(player, state.player);
            physics.sync(player);
            time = state.time;
            dash = { ...state.dash };
            limit = now + maxLeadMs;
            const replayMs = pending.length ? clamp(now - pending[0].at, 0, maxLeadMs) : 0;
            frameAt = now - replayMs - (pending.length ? tickMs : 0);
            const pose = presentationPose(now);

            const dx = displayed ? displayed.x - pose.x : 0;
            const dy = displayed ? displayed.y - pose.y : 0;
            const delta = Math.hypot(dx, dy);
            correction =
                delta > 0.5 && hurtAt === state.player.hurtAt ? { x: dx, y: dy, at: now } : null;
            hurtAt = state.player.hurtAt;
        },
        sample(now, displayTime) {
            if (!dash) return null;
            const pose = presentationPose(now);
            const offset = correctionAt(now);
            const x = pose.x + offset.x;
            const y = pose.y + offset.y;
            if (displayed) {
                const distance = Math.hypot(x - displayed.x, y - displayed.y);
                const budget = (maxDisplaySpeed * clamp(now - displayed.at, 0, 50)) / 1000;
                const fraction = distance ? Math.min(1, budget / distance) : 1;
                displayed = {
                    x: displayed.x + (x - displayed.x) * fraction,
                    y: displayed.y + (y - displayed.y) * fraction,
                    at: now,
                };
            } else {
                displayed = { x, y, at: now };
            }
            return {
                x: displayed.x,
                y: displayed.y,
                faceX: player.faceX,
                faceY: player.faceY,
                dash: {
                    ...dash,
                    until: dash.direction ? displayTime + dash.until - time : 0,
                    nextChargeAt: dash.nextChargeAt ? displayTime + dash.nextChargeAt - time : 0,
                },
            };
        },
        dispose: physics.dispose,
    };
}
