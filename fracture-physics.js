const still = { x: 0, y: 0 };
const skin = 0.65;
const cellSize = 128;

export function createFracturePhysics(Rapier, indexed = false) {
    const world = new Rapier.World(still);
    const bodies = new Map();
    const cells = new Map();
    let maxReach = 0;

    function unindex(actor, body) {
        if (body.key === undefined) return;
        const bucket = cells.get(body.key);
        bucket.delete(actor);
        if (!bucket.size) cells.delete(body.key);
    }

    function reindex(actor, body) {
        if (!indexed) return;
        const key = `${Math.floor(actor.x / cellSize)}:${Math.floor(actor.y / cellSize)}`;
        if (body.key === key) return;
        unindex(actor, body);
        if (!cells.has(key)) cells.set(key, new Map());
        cells.get(key).set(actor, body);
        body.key = key;
    }

    function* nearby(actor, reach) {
        if (!indexed) {
            yield* bodies;
            return;
        }
        const left = Math.floor((actor.x - reach) / cellSize);
        const right = Math.floor((actor.x + reach) / cellSize);
        const top = Math.floor((actor.y - reach) / cellSize);
        const bottom = Math.floor((actor.y + reach) / cellSize);
        for (let y = top; y <= bottom; y++) {
            for (let x = left; x <= right; x++) {
                const bucket = cells.get(`${x}:${y}`);
                if (bucket) yield* bucket;
            }
        }
    }

    function hull(actor) {
        const points = new Float32Array(actor.polygon.flatMap(({ x, y }) => [x, y]));
        const desc = Rapier.ColliderDesc.convexHull(points);
        if (!desc) throw new Error('Remaining ore must have a valid convex hull');
        return desc;
    }

    function add(actor, radius) {
        const desc = actor.polygon ? hull(actor) : Rapier.ColliderDesc.ball(radius);
        desc.setTranslation(actor.x, actor.y).setRotation(actor.angle ?? 0);
        const collider = world.createCollider(desc);
        const body = { collider, reach: radius };
        bodies.set(actor, body);
        maxReach = Math.max(maxReach, radius);
        reindex(actor, body);
    }

    function sync(actor) {
        const body = bodies.get(actor);
        body.collider.setTranslation({ x: actor.x, y: actor.y });
        body.collider.setRotation(actor.angle ?? 0);
        reindex(actor, body);
    }

    function cast(actor, delta) {
        const body = bodies.get(actor);
        const travel = Math.hypot(delta.x, delta.y);
        let closest = null;
        for (const [other, shape] of nearby(actor, travel + body.reach + maxReach + skin)) {
            if (other === actor) continue;
            if (
                Math.abs(actor.x - other.x) > travel + body.reach + shape.reach + skin ||
                Math.abs(actor.y - other.y) > travel + body.reach + shape.reach + skin
            )
                continue;
            const hit = shape.collider.castCollider(still, body.collider, delta, skin, 1, false);
            if (!hit || (closest && hit.time_of_impact >= closest.time)) continue;
            const angle = other.angle ?? 0;
            const cs = Math.cos(angle),
                sn = Math.sin(angle);
            const n = hit.normal1;
            const nx = n.x * cs - n.y * sn,
                ny = n.x * sn + n.y * cs;
            if (delta.x * nx + delta.y * ny >= -0.0001) continue;
            const point = hit.witness1;
            closest = {
                actor: other,
                time: Math.max(0, hit.time_of_impact),
                nx,
                ny,
                x: other.x + point.x * cs - point.y * sn,
                y: other.y + point.x * sn + point.y * cs,
            };
        }
        return closest;
    }

    function move(actor, delta, slide = true) {
        sync(actor);
        let first = null;
        for (let i = 0; i < (slide ? 2 : 1); i++) {
            if (Math.hypot(delta.x, delta.y) < 0.001) break;
            const hit = cast(actor, delta);
            const t = hit?.time ?? 1;
            actor.x += delta.x * t;
            actor.y += delta.y * t;
            sync(actor);
            if (!hit) break;
            first ??= hit;
            const inward = Math.min(0, delta.x * hit.nx + delta.y * hit.ny);
            delta = {
                x: (delta.x - inward * hit.nx) * (1 - t),
                y: (delta.y - inward * hit.ny) * (1 - t),
            };
        }
        return first;
    }

    return {
        add,
        move,
        sync,
        replaceHull(actor) {
            bodies.get(actor).collider.setShape(hull(actor).shape);
        },
        remove(actor) {
            const body = bodies.get(actor);
            world.removeCollider(body.collider, false);
            unindex(actor, body);
            bodies.delete(actor);
        },
        closestPoint(actor, point) {
            return bodies.get(actor).collider.projectPoint(point, true)?.point;
        },
        dispose() {
            cells.clear();
            bodies.clear();
            world.free();
        },
    };
}
