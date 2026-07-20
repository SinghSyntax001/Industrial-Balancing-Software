const canvas = document.getElementById('balanceCanvas');
const ctx = canvas.getContext('2d');
const calculateBtn = document.getElementById('calculateBtn');
const drawBtn = document.getElementById('drawBtn');
const resetBtn = document.getElementById('resetBtn');
const splitBtn = document.getElementById('splitBtn');
const outputBox = document.getElementById('outputBox');
const inputForm = document.getElementById('inputForm');

if (!(canvas instanceof HTMLCanvasElement) || !ctx) {
    throw new Error('Balancing canvas is not available.');
}

const apiBase = ['127.0.0.1:8000', 'localhost:8000'].includes(window.location.host) ? '' : 'http://127.0.0.1:8000';
const correctionColor = '#168a4a';

const chartState = {
    geometry: null,
    payload: null,
    marker: null,
    markerMetrics: null,
    dragging: false,
    animationFrame: null,
    animationStart: 0,
    showSplit: false,
    progress: 1
};

function getInput(id) {
    const input = document.getElementById(id);
    if (!(input instanceof HTMLInputElement)) {
        throw new Error(`Input #${id} was not found.`);
    }
    return input;
}

function getElement(id) {
    const element = document.getElementById(id);
    if (!(element instanceof HTMLElement)) {
        throw new Error(`Element #${id} was not found.`);
    }
    return element;
}

function readPayload(includeMeasurements = true) {
    const payload = {
        blades: Number.parseInt(getInput('blades').value, 10) || 0,
        trial_weight: Number.parseFloat(getInput('trial_weight').value) || 0,
        initial_vib: Number.parseFloat(getInput('initial_vib').value) || 0
    };

    if (includeMeasurements) {
        payload.red_vib = Number.parseFloat(getInput('red_vib').value) || 0;
        payload.blue_vib = Number.parseFloat(getInput('blue_vib').value) || 0;
        payload.green_vib = Number.parseFloat(getInput('green_vib').value) || 0;
    }

    return payload;
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function normalizeAngle(angle) {
    return ((angle % 360) + 360) % 360;
}

function angleDistance(a, b) {
    return Math.abs(((a - b + 180) % 360) - 180);
}

function layout() {
    const size = Math.min(canvas.clientWidth || canvas.width, 760);
    const ratio = window.devicePixelRatio || 1;
    const pixelSize = Math.floor(size * ratio);
    if (canvas.width !== pixelSize || canvas.height !== pixelSize) {
        canvas.width = pixelSize;
        canvas.height = pixelSize;
    }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

    const cssSize = pixelSize / ratio;
    const margin = 46;
    const geometry = chartState.geometry;
    const extent = geometry ? geometryExtent(geometry) : 1;
    return {
        cx: cssSize / 2,
        cy: cssSize / 2,
        radius: cssSize / 2 - margin,
        scale: (cssSize / 2 - margin) / extent,
        extent
    };
}

function geometryExtent(geometry) {
    let extent = Math.max(geometry.baseline_circle?.radius || 1, 1);
    (geometry.trial_circles || []).forEach((circle) => {
        const centerRadius = Math.hypot(circle.center.x, circle.center.y);
        extent = Math.max(extent, centerRadius + circle.radius);
    });
    if (geometry.correction_vector) {
        extent = Math.max(extent, geometry.correction_vector.distance * 1.18);
    }
    return extent * 1.08;
}

function worldToCanvas(point, frame) {
    return {
        x: frame.cx + point.x * frame.scale,
        y: frame.cy - point.y * frame.scale
    };
}

function canvasToWorld(point, frame) {
    return {
        x: (point.x - frame.cx) / frame.scale,
        y: (frame.cy - point.y) / frame.scale
    };
}

function polarPoint(angle, radius, frame) {
    const radians = angle * Math.PI / 180;
    return worldToCanvas({ x: radius * Math.cos(radians), y: radius * Math.sin(radians) }, frame);
}

function clearCanvas(frame) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#f7f8f9';
    ctx.fillRect(0, 0, frame.cx * 2, frame.cy * 2);
}

class CanvasRenderer {
    render(geometry, marker, progress = 1) {
        const frame = layout();
        clearCanvas(frame);
        this.drawPolarGrid(frame);
        if (geometry) {
            this.drawBladeLines(geometry.blade_positions || [], frame);
            this.drawBaseline(geometry.baseline_circle, frame);
            this.drawReferences(geometry.reference_positions || [], frame);
            this.drawTrialCircles(geometry.trial_circles || [], frame, progress);
            this.drawIntersection(geometry.intersection, frame, progress);
            this.drawCorrection(marker, frame, progress);
            this.drawSplit(marker, frame);
        } else {
            this.drawEmptyHub(frame);
        }
        return frame;
    }

    drawPolarGrid(frame) {
        ctx.save();
        ctx.strokeStyle = '#d4d8dd';
        ctx.lineWidth = 1;
        for (let i = 1; i <= 20; i += 1) {
            ctx.beginPath();
            ctx.arc(frame.cx, frame.cy, frame.radius * i / 20, 0, Math.PI * 2);
            ctx.strokeStyle = i % 5 === 0 ? '#aeb5bd' : '#dde1e5';
            ctx.lineWidth = i % 5 === 0 ? 1.2 : 0.7;
            ctx.stroke();
        }

        for (let deg = 0; deg < 360; deg += 5) {
            const major = deg % 30 === 0;
            const medium = deg % 10 === 0;
            const outer = polarPoint(deg, frame.extent, frame);
            const innerRadius = frame.extent * (major ? 0.02 : medium ? 0.04 : 0.065);
            const inner = polarPoint(deg, innerRadius, frame);
            ctx.beginPath();
            ctx.moveTo(inner.x, inner.y);
            ctx.lineTo(outer.x, outer.y);
            ctx.strokeStyle = major ? '#b6bdc5' : medium ? '#cbd1d7' : '#e4e7ea';
            ctx.lineWidth = major ? 1.1 : 0.6;
            ctx.stroke();
        }

        ctx.fillStyle = '#404852';
        ctx.font = '11px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let deg = 0; deg < 360; deg += 30) {
            const point = polarPoint(deg, frame.extent * 1.015, frame);
            ctx.fillText(`${deg}`, point.x, point.y);
        }
        this.drawEmptyHub(frame);
        ctx.restore();
    }

    drawEmptyHub(frame) {
        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#6f7885';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(frame.cx, frame.cy, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }

    drawBladeLines(blades, frame) {
        ctx.save();
        ctx.strokeStyle = '#c46a1d';
        ctx.fillStyle = '#8d4610';
        ctx.lineWidth = 1.2;
        ctx.font = '11px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        blades.forEach((blade) => {
            const start = polarPoint(blade.angle, frame.extent * 0.08, frame);
            const end = polarPoint(blade.angle, frame.extent * 0.98, frame);
            ctx.globalAlpha = 0.72;
            ctx.beginPath();
            ctx.moveTo(start.x, start.y);
            ctx.lineTo(end.x, end.y);
            ctx.stroke();
            ctx.globalAlpha = 1;
            const label = polarPoint(blade.angle, frame.extent * 0.9, frame);
            ctx.fillText(String(blade.blade), label.x, label.y);
        });
        ctx.restore();
    }

    drawBaseline(circle, frame) {
        if (!circle) return;
        const center = worldToCanvas(circle.center, frame);
        ctx.save();
        ctx.strokeStyle = '#69727d';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 5]);
        ctx.beginPath();
        ctx.arc(center.x, center.y, circle.radius * frame.scale, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#4a535f';
        ctx.font = '12px Arial, sans-serif';
        ctx.fillText('baseline', center.x + circle.radius * frame.scale + 6, center.y - 6);
        ctx.restore();
    }

    drawReferences(references, frame) {
        ctx.save();
        ctx.font = 'bold 12px Arial, sans-serif';
        ctx.textAlign = 'center';
        references.forEach((ref) => {
            const point = worldToCanvas(ref.point, frame);
            ctx.fillStyle = '#ffffff';
            ctx.strokeStyle = ref.color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(point.x, point.y, 7, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = ref.color;
            ctx.fillText(`${ref.label} ${ref.angle.toFixed(1)}`, point.x, point.y - 14);
        });
        ctx.restore();
    }

    drawTrialCircles(circles, frame, progress) {
        ctx.save();
        circles.forEach((circle, index) => {
            const localProgress = clamp(progress * 1.3 - index * 0.12, 0, 1);
            const center = worldToCanvas(circle.center, frame);
            ctx.strokeStyle = circle.color;
            ctx.fillStyle = circle.color;
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.82;
            ctx.beginPath();
            ctx.arc(center.x, center.y, circle.radius * frame.scale, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * localProgress);
            ctx.stroke();
            ctx.globalAlpha = 1;
            ctx.beginPath();
            ctx.arc(center.x, center.y, 4.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.font = '12px Arial, sans-serif';
            ctx.fillText(circle.label, center.x + 8, center.y - 8);
        });
        ctx.restore();
    }

    drawIntersection(intersection, frame, progress) {
        if (!intersection || progress < 0.55) return;
        const point = worldToCanvas(intersection.point, frame);
        ctx.save();
        ctx.strokeStyle = '#30363d';
        ctx.setLineDash([3, 4]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(point.x, point.y, 16, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#30363d';
        ctx.font = '11px Arial, sans-serif';
        ctx.fillText('intersection region', point.x + 22, point.y + 4);
        ctx.restore();
    }

    drawCorrection(marker, frame, progress) {
        if (!marker || !marker.point || progress < 0.35) return;
        const origin = worldToCanvas({ x: 0, y: 0 }, frame);
        const target = worldToCanvas(marker.point, frame);
        const localProgress = clamp((progress - 0.35) / 0.65, 0, 1);
        const end = {
            x: origin.x + (target.x - origin.x) * localProgress,
            y: origin.y + (target.y - origin.y) * localProgress
        };

        ctx.save();
        ctx.strokeStyle = correctionColor;
        ctx.fillStyle = correctionColor;
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.moveTo(origin.x, origin.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
        const angle = Math.atan2(end.y - origin.y, end.x - origin.x);
        ctx.beginPath();
        ctx.moveTo(end.x, end.y);
        ctx.lineTo(end.x - 12 * Math.cos(angle - Math.PI / 7), end.y - 12 * Math.sin(angle - Math.PI / 7));
        ctx.lineTo(end.x - 12 * Math.cos(angle + Math.PI / 7), end.y - 12 * Math.sin(angle + Math.PI / 7));
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = correctionColor;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(target.x, target.y, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = correctionColor;
        ctx.font = 'bold 12px Arial, sans-serif';
        ctx.fillText(`${marker.metrics.weight.toFixed(2)} g`, target.x + 13, target.y - 10);
        ctx.fillText(`${marker.metrics.angle.toFixed(1)} deg`, target.x + 13, target.y + 6);
        ctx.restore();
    }

    drawSplit(marker, frame) {
        if (!chartState.showSplit || !marker || !marker.metrics.split) return;
        const split = marker.metrics.split;
        ctx.save();
        ctx.strokeStyle = '#76521c';
        ctx.fillStyle = '#76521c';
        ctx.lineWidth = 2;
        [
            { angle: split.angle_a, weight: split.weight_a, blade: split.blade_a },
            { angle: split.angle_b, weight: split.weight_b, blade: split.blade_b }
        ].forEach((item) => {
            const end = polarPoint(item.angle, frame.extent * 0.72, frame);
            ctx.beginPath();
            ctx.moveTo(frame.cx, frame.cy);
            ctx.lineTo(end.x, end.y);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(end.x, end.y, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.font = '12px Arial, sans-serif';
            ctx.fillText(`B${item.blade} ${item.weight.toFixed(2)}g`, end.x + 10, end.y);
        });
        ctx.restore();
    }
}

class MarkerController {
    createFromGeometry(geometry) {
        if (!geometry || !geometry.correction_vector) return null;
        const point = { ...geometry.correction_vector.point };
        return { point, metrics: this.metricsForPoint(point, geometry) };
    }

    metricsForPoint(point, geometry) {
        const distance = Math.hypot(point.x, point.y);
        const angle = normalizeAngle(Math.atan2(point.y, point.x) * 180 / Math.PI);
        const baseline = geometry.baseline_circle?.radius || 0;
        const trialWeight = chartState.payload?.trial_weight || 0;
        const weight = distance > 1e-9 ? trialWeight * baseline / distance : 0;
        const nearest = this.nearestBlade(angle, geometry.blade_positions || []);
        const split = this.splitWeight(weight, angle, geometry.blade_positions || []);
        return { distance, angle, weight, nearest, split };
    }

    nearestBlade(angle, blades) {
        if (!blades.length) return null;
        return blades.reduce((best, blade) => {
            const error = angleDistance(angle, blade.angle);
            return !best || error < best.angular_error ? { blade: blade.blade, angle: blade.angle, angular_error: error } : best;
        }, null);
    }

    splitWeight(weight, angle, blades) {
        if (blades.length <= 1 || weight <= 0) return null;
        const sorted = [...blades].sort((a, b) => a.angle - b.angle);
        let a = sorted[sorted.length - 1];
        let b = sorted[0];
        for (let i = 0; i < sorted.length; i += 1) {
            const current = sorted[i];
            const next = sorted[(i + 1) % sorted.length];
            const endAngle = next.angle <= current.angle ? next.angle + 360 : next.angle;
            const testAngle = angle < current.angle ? angle + 360 : angle;
            if (testAngle >= current.angle && testAngle <= endAngle) {
                a = current;
                b = next;
                break;
            }
        }
        const span = ((b.angle - a.angle + 360) % 360) || 360;
        const offset = (angle - a.angle + 360) % 360;
        const denominator = Math.sin(span * Math.PI / 180);
        if (Math.abs(denominator) < 1e-9) return null;
        return {
            blade_a: a.blade,
            angle_a: a.angle,
            weight_a: Math.max(0, weight * Math.sin((span - offset) * Math.PI / 180) / denominator),
            blade_b: b.blade,
            angle_b: b.angle,
            weight_b: Math.max(0, weight * Math.sin(offset * Math.PI / 180) / denominator)
        };
    }

    startDrag(event) {
        if (!chartState.marker) return;
        const frame = layout();
        const mouse = this.eventPoint(event);
        const markerPoint = worldToCanvas(chartState.marker.point, frame);
        if (Math.hypot(mouse.x - markerPoint.x, mouse.y - markerPoint.y) <= 18) {
            chartState.dragging = true;
            canvas.setPointerCapture(event.pointerId);
        }
    }

    drag(event) {
        if (!chartState.dragging || !chartState.geometry || !chartState.marker) return;
        const frame = layout();
        const world = canvasToWorld(this.eventPoint(event), frame);
        chartState.marker.point = world;
        chartState.marker.metrics = this.metricsForPoint(world, chartState.geometry);
        renderer.render(chartState.geometry, chartState.marker, 1);
        updateResultsFromMarker();
    }

    endDrag(event) {
        if (chartState.dragging) {
            chartState.dragging = false;
            try {
                canvas.releasePointerCapture(event.pointerId);
            } catch (_) {
                // Pointer capture may already be released by the browser.
            }
        }
    }

    eventPoint(event) {
        const rect = canvas.getBoundingClientRect();
        return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }
}

const renderer = new CanvasRenderer();
const markerController = new MarkerController();

function updateReferenceBox(geometry) {
    const refs = geometry?.reference_positions || [];
    getElement('referenceOut').textContent = refs.length
        ? refs.map((ref) => `${ref.label}: ${ref.angle.toFixed(1)} deg`).join(' | ')
        : 'Draw the chart to generate blade-aligned trial positions.';
}

function updateResultsFromMarker() {
    const marker = chartState.marker;
    if (!marker) return;
    const metrics = marker.metrics;
    getElement('w_out').textContent = metrics.weight.toFixed(2);
    getElement('a_out').textContent = metrics.angle.toFixed(1);
    getElement('fit_out').textContent = chartState.geometry?.intersection?.fit_error?.toFixed(4) || '--';

    const bladeOut = getElement('blade_out');
    const bladeRow = getElement('blade_row');
    if (metrics.nearest) {
        bladeOut.textContent = `Blade #${metrics.nearest.blade}`;
        bladeRow.textContent = `Nearest blade ${metrics.nearest.blade} at ${metrics.nearest.angle.toFixed(1)} deg, offset ${metrics.nearest.angular_error.toFixed(1)} deg.`;
        bladeRow.style.display = 'block';
    } else {
        bladeOut.textContent = 'N/A';
        bladeRow.style.display = 'none';
    }

    updateSplitBox(metrics.split);
    outputBox.style.display = 'block';
}

function updateSplitBox(split) {
    const splitBox = getElement('splitBox');
    if (!chartState.showSplit || !split) {
        splitBox.style.display = 'none';
        return;
    }
    getElement('splitA').textContent = `Blade ${split.blade_a}: ${split.weight_a.toFixed(2)} g @ ${split.angle_a.toFixed(1)} deg`;
    getElement('splitB').textContent = `Blade ${split.blade_b}: ${split.weight_b.toFixed(2)} g @ ${split.angle_b.toFixed(1)} deg`;
    splitBox.style.display = 'grid';
}

function animateGeometry(geometry, withSolution) {
    cancelAnimation();
    chartState.animationStart = performance.now();
    const duration = withSolution ? 900 : 400;
    const step = (now) => {
        chartState.progress = clamp((now - chartState.animationStart) / duration, 0, 1);
        renderer.render(geometry, chartState.marker, chartState.progress);
        if (chartState.progress < 1) {
            chartState.animationFrame = requestAnimationFrame(step);
        } else {
            chartState.animationFrame = null;
        }
    };
    chartState.animationFrame = requestAnimationFrame(step);
}

function cancelAnimation() {
    if (chartState.animationFrame !== null) {
        cancelAnimationFrame(chartState.animationFrame);
        chartState.animationFrame = null;
    }
}

async function postJson(route, payload) {
    const response = await fetch(`${apiBase}${route}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) {
        throw new Error(result.detail || 'Balancing request failed.');
    }
    return result;
}

async function drawChart() {
    try {
        chartState.showSplit = false;
        chartState.payload = readPayload(false);
        chartState.geometry = await postJson('/draw', chartState.payload);
        chartState.marker = null;
        outputBox.style.display = 'none';
        updateReferenceBox(chartState.geometry);
        animateGeometry(chartState.geometry, false);
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

async function plotChart() {
    try {
        chartState.showSplit = false;
        chartState.payload = readPayload(true);
        chartState.geometry = await postJson('/calculate', chartState.payload);
        chartState.marker = markerController.createFromGeometry(chartState.geometry);
        updateReferenceBox(chartState.geometry);
        updateResultsFromMarker();
        animateGeometry(chartState.geometry, true);
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

function resetChart() {
    cancelAnimation();
    inputForm.reset();
    getInput('blades').value = '0';
    chartState.geometry = null;
    chartState.payload = null;
    chartState.marker = null;
    chartState.dragging = false;
    chartState.showSplit = false;
    outputBox.style.display = 'none';
    updateReferenceBox(null);
    renderer.render(null, null, 1);
}

calculateBtn.addEventListener('click', plotChart);
drawBtn.addEventListener('click', drawChart);
resetBtn.addEventListener('click', resetChart);
splitBtn.addEventListener('click', () => {
    if (!chartState.marker) return;
    chartState.showSplit = true;
    updateResultsFromMarker();
    renderer.render(chartState.geometry, chartState.marker, 1);
});

canvas.addEventListener('pointerdown', (event) => markerController.startDrag(event));
canvas.addEventListener('pointermove', (event) => markerController.drag(event));
canvas.addEventListener('pointerup', (event) => markerController.endDrag(event));
canvas.addEventListener('pointercancel', (event) => markerController.endDrag(event));
window.addEventListener('resize', () => renderer.render(chartState.geometry, chartState.marker, 1));

renderer.render(null, null, 1);
