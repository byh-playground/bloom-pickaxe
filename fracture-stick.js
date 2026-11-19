const deadzone = 4;

export function createStick(element, onStart, { onVector } = {}) {
    let pointer = null;
    let x = 0;
    let y = 0;
    let armed = true;
    const knob = element.querySelector('.stick-knob');

    function setVector(dx, dy, radius = 1) {
        const length = Math.hypot(dx, dy);
        const strength =
            Math.min(1, Math.max(0, (length - deadzone) / Math.max(1, radius - deadzone))) ** 1.2;
        x = (dx / (length || 1)) * strength;
        y = (dy / (length || 1)) * strength;
        const travel = Math.max(0, radius - knob.offsetWidth / 2 - 3);
        knob.style.transform = `translate(${x * travel}px, ${y * travel}px)`;
    }

    function reset() {
        const id = pointer;
        pointer = null;
        armed = true;
        if (id !== null && element.hasPointerCapture(id)) element.releasePointerCapture(id);
        element.removeAttribute('data-held');
        setVector(0, 0);
    }

    function update(event) {
        const box = element.getBoundingClientRect();
        const dx = event.clientX - box.left - box.width / 2;
        const dy = event.clientY - box.top - box.height / 2;
        setVector(dx, dy, Math.min(box.width, box.height) / 2);
        const travel = Math.hypot(dx, dy);
        if (travel <= deadzone) armed = true;
        if (armed && travel >= deadzone + 2) {
            armed = false;
            onVector?.({ x, y });
        }
    }

    element.addEventListener('pointerdown', (event) => {
        if (pointer !== null || event.button !== 0) return;
        event.preventDefault();
        pointer = event.pointerId;
        element.setPointerCapture(pointer);
        element.setAttribute('data-held', '');
        update(event);
        onStart();
    });
    element.addEventListener('pointermove', (event) => {
        if (event.pointerId === pointer) update(event);
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
        element.addEventListener(type, (event) => {
            if (event.pointerId !== pointer) return;
            reset();
        });
    }
    return {
        reset,
        read() {
            return onVector && armed ? { x: 0, y: 0 } : { x, y };
        },
    };
}
