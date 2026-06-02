// js/parking.js
// Renders the SVG parking layout.
// Spots: green=free, red=occupied, blue=your spot.
// Occupied spots show: license plate text at front edge + car-color shape indicator.

const LEFT_SPOTS  = ['20','19','18','17','16','15','14','13','12','11'];
const RIGHT_SPOTS = ['10','9','8','7','6','5','4','3','2','1'];

const CANVAS_W = 800;
const CANVAS_H = 760;
const SPOT_W   = 76;
const SPOT_H   = 32;

const LANE_LEFT   = 320;
const LANE_RIGHT  = 480;
const LANE_TOP    = 30;
const LANE_BOTTOM = 600;

const ARROW_TIP_Y = LANE_TOP + 32;
const START_Y     = ARROW_TIP_Y + 22;
const STEP_Y      = 50;
const ANGLE       = 45;
const SIDE_MARGIN = 36;
const BOTTOM_ROW_Y = LANE_BOTTOM + 50;

// Map CSS color name / hex to a simple label for the legend
const CAR_COLOR_SHAPES = {
  // shape type mapped by color category; fallback = circle
};

function spotId(label) {
  return label === 'A' ? 'sA' : label === 'B' ? 'sB' : `s${label}`;
}

function getSpotData(spots, label) {
  const sid = spotId(label);
  return spots.find(s => s.id === sid) || { id: sid, state: 'free', assignedUserId: null };
}

// Normalize a color string to something SVG understands.
// Returns { fill, stroke } for the shape.
function resolveCarColor(colorStr) {
  if (!colorStr) return { fill: '#888', stroke: '#444' };
  const s = colorStr.trim().toLowerCase();
  // Named color → hex map for common car colors
  const map = {
    white: '#f5f5f5', black: '#222', gray: '#888', grey: '#888',
    silver: '#c0c0c0', red: '#e03030', blue: '#2060d0', navy: '#001f6e',
    green: '#2a7a2a', yellow: '#e8d000', orange: '#e87000',
    brown: '#7a4a1a', beige: '#d4c59a', gold: '#c8a800', purple: '#7030a0',
    pink: '#e06090', turquoise: '#00b4b4', 'dark blue': '#001f6e',
    'light blue': '#6ab4f0', 'dark green': '#1a4a1a', 'dark gray': '#555',
    'dark grey': '#555',
  };
  const fill = map[s] || s; // pass through if it looks like a hex or valid CSS color
  // derive a darker stroke
  return { fill, stroke: 'rgba(0,0,0,0.45)' };
}

// Draw a small car-color indicator shape inside the spot
// shape cycles through: circle, diamond, triangle, square per color initial
function drawColorIndicator(svgNS, cx, cy, colorStr, angle) {
  // We draw the indicator BEFORE rotation so we de-rotate it (counter-angle)
  // Actually easier: create a group that sits at cx,cy and counter-rotates
  const { fill, stroke } = resolveCarColor(colorStr);
  const g = document.createElementNS(svgNS, 'g');
  // counter-rotate so indicator always shows upright
  g.setAttribute('transform', `rotate(${-angle}, ${cx}, ${cy})`);

  // small filled circle
  const circle = document.createElementNS(svgNS, 'circle');
  circle.setAttribute('cx', cx);
  circle.setAttribute('cy', cy + 8); // slightly toward back of spot
  circle.setAttribute('r', '5');
  circle.setAttribute('fill', fill);
  circle.setAttribute('stroke', stroke);
  circle.setAttribute('stroke-width', '1');
  circle.setAttribute('pointer-events', 'none');
  g.appendChild(circle);
  return g;
}

// Draw license plate text at the "front" edge of a diagonal spot
// Front edge = the lane side (closest to driving lane)
function drawPlateLabel(svgNS, cx, cy, angle, plateText, side) {
  // front edge offset: for left spots (angle=-45) front is to the right (+x),
  // for right spots (angle=+45) front is to the left (-x)
  const offsetX = side === 'left' ? SPOT_W / 2 - 4 : -(SPOT_W / 2 - 4);

  const g = document.createElementNS(svgNS, 'g');
  g.setAttribute('transform', `rotate(${angle}, ${cx}, ${cy})`);

  const text = document.createElementNS(svgNS, 'text');
  text.setAttribute('x', cx + offsetX);
  text.setAttribute('y', cy);
  text.setAttribute('text-anchor', side === 'left' ? 'end' : 'start');
  text.setAttribute('dominant-baseline', 'middle');
  text.setAttribute('font-family', 'inherit');
  text.setAttribute('font-size', '7');
  text.setAttribute('font-weight', '700');
  text.setAttribute('fill', '#fff');
  text.setAttribute('pointer-events', 'none');
  // counter-rotate the text so it reads horizontally along the front edge
  const tx = cx + offsetX;
  text.setAttribute('transform', `rotate(${-angle}, ${tx}, ${cy})`);
  text.textContent = plateText;
  g.appendChild(text);
  return g;
}

function buildSVG(spots, users, currentUser) {
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.getElementById('parking-svg');
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  const bxLeft   = LANE_LEFT  - SPOT_W - SIDE_MARGIN;
  const bxRight  = LANE_RIGHT + SPOT_W + SIDE_MARGIN;
  const byTop    = LANE_TOP - 10;
  const byBottom = BOTTOM_ROW_Y + SPOT_H + 30;

  // Outer boundary
  const boundary = document.createElementNS(svgNS, 'rect');
  boundary.setAttribute('x', bxLeft); boundary.setAttribute('y', byTop);
  boundary.setAttribute('width', bxRight - bxLeft);
  boundary.setAttribute('height', byBottom - byTop);
  boundary.setAttribute('fill', '#f0f4f0');
  boundary.setAttribute('stroke', '#444'); boundary.setAttribute('stroke-width', '2');
  svg.appendChild(boundary);

  // Entrance label
  const entranceText = document.createElementNS(svgNS, 'text');
  entranceText.setAttribute('x', (LANE_LEFT + LANE_RIGHT) / 2);
  entranceText.setAttribute('y', byTop + 16);
  entranceText.setAttribute('text-anchor', 'middle');
  entranceText.setAttribute('dominant-baseline', 'middle');
  entranceText.setAttribute('font-family', 'inherit');
  entranceText.setAttribute('font-size', '13');
  entranceText.setAttribute('font-weight', 'bold');
  entranceText.setAttribute('fill', '#444');
  entranceText.textContent = 'Entrance';
  svg.appendChild(entranceText);

  // Driving lane
  const lane = document.createElementNS(svgNS, 'rect');
  lane.setAttribute('x', LANE_LEFT); lane.setAttribute('y', LANE_TOP);
  lane.setAttribute('width', LANE_RIGHT - LANE_LEFT);
  lane.setAttribute('height', LANE_BOTTOM - LANE_TOP);
  lane.setAttribute('fill', '#e8e8e8'); lane.setAttribute('stroke', '#bbb');
  lane.setAttribute('stroke-width', '1');
  svg.appendChild(lane);

  // Entry arrow
  const arrow = document.createElementNS(svgNS, 'polygon');
  const ax = (LANE_LEFT + LANE_RIGHT) / 2;
  arrow.setAttribute('points',
    `${ax - 12},${LANE_TOP + 10} ${ax + 12},${LANE_TOP + 10} ${ax},${LANE_TOP + 32}`);
  arrow.setAttribute('fill', '#555');
  svg.appendChild(arrow);

  // ── Diagonal spot factory ──
  function makeSpot(label, cx, cy, angle, side) {
    const spotData = getSpotData(spots, label);
    const renter = spotData.assignedUserId
      ? users.find(u => u.id === spotData.assignedUserId)
      : null;

    const g = document.createElementNS(svgNS, 'g');
    g.setAttribute('class', `spot ${spotData.state}`);
    g.setAttribute('data-id', spotData.id);
    g.setAttribute('transform', `rotate(${angle}, ${cx}, ${cy})`);

    const rect = document.createElementNS(svgNS, 'rect');
    rect.setAttribute('x', cx - SPOT_W / 2);
    rect.setAttribute('y', cy - SPOT_H / 2);
    rect.setAttribute('width', SPOT_W);
    rect.setAttribute('height', SPOT_H);
    rect.setAttribute('rx', '2');

    // Spot number label (always visible, centred)
    const numText = document.createElementNS(svgNS, 'text');
    numText.setAttribute('class', 'spot-label');
    numText.setAttribute('x', cx);
    numText.setAttribute('y', cy);
    numText.textContent = label;

    g.appendChild(rect);
    g.appendChild(numText);

    if (currentUser) {
      g.addEventListener('click', () => showSpotInfo(spotData, label, users, currentUser));
    }

    // Overlay group added after (so it sits on top of click target)
    const overlayG = document.createElementNS(svgNS, 'g');

    if (renter) {
      // Car color indicator (counter-rotated circle)
      overlayG.appendChild(drawColorIndicator(svgNS, cx, cy, angle, renter.carColor));
      // License plate at front edge
      const plate = renter.licensePlate || renter.username || '';
      if (plate) overlayG.appendChild(drawPlateLabel(svgNS, cx, cy, angle, plate, side));
    }

    return [g, overlayG];
  }

  // Left diagonal row
  LEFT_SPOTS.forEach((label, i) => {
    const cy = START_Y + i * STEP_Y;
    const cx = LANE_LEFT - SPOT_W / 2 - 4;
    const [spotG, overlayG] = makeSpot(label, cx, cy, -ANGLE, 'left');
    svg.appendChild(spotG);
    svg.appendChild(overlayG);
  });

  // Right diagonal row
  RIGHT_SPOTS.forEach((label, i) => {
    const cy = START_Y + i * STEP_Y;
    const cx = LANE_RIGHT + SPOT_W / 2 + 4;
    const [spotG, overlayG] = makeSpot(label, cx, cy, ANGLE, 'right');
    svg.appendChild(spotG);
    svg.appendChild(overlayG);
  });

  // ── Bottom row ──
  function makeWedge(label, points) {
    const spotData = getSpotData(spots, label);
    const renter = spotData.assignedUserId
      ? users.find(u => u.id === spotData.assignedUserId)
      : null;

    const g = document.createElementNS(svgNS, 'g');
    g.setAttribute('class', `spot ${spotData.state}`);
    g.setAttribute('data-id', spotData.id);

    const poly = document.createElementNS(svgNS, 'polygon');
    poly.setAttribute('points', points.map(p => p.join(',')).join(' '));

    const cx = points.reduce((a, p) => a + p[0], 0) / points.length;
    const cy = points.reduce((a, p) => a + p[1], 0) / points.length;

    const text = document.createElementNS(svgNS, 'text');
    text.setAttribute('class', 'spot-label');
    text.setAttribute('x', cx); text.setAttribute('y', cy - 8);
    text.textContent = label;

    g.appendChild(poly);
    g.appendChild(text);

    // License plate + color dot for wedge
    if (renter) {
      const plate = renter.licensePlate || renter.username || '';
      if (plate) {
        const pt = document.createElementNS(svgNS, 'text');
        pt.setAttribute('x', cx); pt.setAttribute('y', cy + 6);
        pt.setAttribute('text-anchor', 'middle'); pt.setAttribute('dominant-baseline', 'middle');
        pt.setAttribute('font-size', '7'); pt.setAttribute('font-weight', '700');
        pt.setAttribute('fill', '#fff'); pt.setAttribute('pointer-events', 'none');
        pt.textContent = plate;
        g.appendChild(pt);
      }
      const { fill, stroke } = resolveCarColor(renter.carColor);
      const dot = document.createElementNS(svgNS, 'circle');
      dot.setAttribute('cx', cx); dot.setAttribute('cy', cy + 16);
      dot.setAttribute('r', '5');
      dot.setAttribute('fill', fill); dot.setAttribute('stroke', stroke);
      dot.setAttribute('stroke-width', '1'); dot.setAttribute('pointer-events', 'none');
      g.appendChild(dot);
    }

    if (currentUser) {
      g.addEventListener('click', () => showSpotInfo(spotData, label, users, currentUser));
    }
    return g;
  }

  function makeBottomLanePerpSpot(label, x, y, w, h) {
    const spotData = getSpotData(spots, label);
    const renter = spotData.assignedUserId
      ? users.find(u => u.id === spotData.assignedUserId)
      : null;

    const g = document.createElementNS(svgNS, 'g');
    g.setAttribute('class', `spot ${spotData.state}`);
    g.setAttribute('data-id', spotData.id);

    const rect = document.createElementNS(svgNS, 'rect');
    rect.setAttribute('x', x); rect.setAttribute('y', y);
    rect.setAttribute('width', w); rect.setAttribute('height', h); rect.setAttribute('rx', '2');

    const numText = document.createElementNS(svgNS, 'text');
    numText.setAttribute('class', 'spot-label');
    numText.setAttribute('x', x + w / 2); numText.setAttribute('y', y + h / 2 - 8);
    numText.textContent = label;

    g.appendChild(rect);
    g.appendChild(numText);

    if (renter) {
      const plate = renter.licensePlate || renter.username || '';
      if (plate) {
        const pt = document.createElementNS(svgNS, 'text');
        pt.setAttribute('x', x + w / 2); pt.setAttribute('y', y + 8);
        pt.setAttribute('text-anchor', 'middle'); pt.setAttribute('dominant-baseline', 'middle');
        pt.setAttribute('font-size', '7'); pt.setAttribute('font-weight', '700');
        pt.setAttribute('fill', '#fff'); pt.setAttribute('pointer-events', 'none');
        pt.textContent = plate;
        g.appendChild(pt);
      }
      const { fill, stroke } = resolveCarColor(renter.carColor);
      const dot = document.createElementNS(svgNS, 'circle');
      dot.setAttribute('cx', x + w / 2); dot.setAttribute('cy', y + h / 2 + 8);
      dot.setAttribute('r', '5');
      dot.setAttribute('fill', fill); dot.setAttribute('stroke', stroke);
      dot.setAttribute('stroke-width', '1'); dot.setAttribute('pointer-events', 'none');
      g.appendChild(dot);
    }

    if (currentUser) {
      g.addEventListener('click', () => showSpotInfo(spotData, label, users, currentUser));
    }
    return g;
  }

  const bottomY = LANE_BOTTOM + 10;
  const bottomH = 60;
  const perpW = (LANE_RIGHT - LANE_LEFT) / 2 - 4;
  const laneCenterX = (LANE_LEFT + LANE_RIGHT) / 2;

  svg.appendChild(makeBottomLanePerpSpot('22', LANE_LEFT + 4, bottomY, perpW, bottomH));
  svg.appendChild(makeBottomLanePerpSpot('21', laneCenterX + 4, bottomY, perpW, bottomH));

  svg.appendChild(makeWedge('B', [
    [bxLeft,    bottomY],
    [LANE_LEFT, bottomY],
    [LANE_LEFT, bottomY + bottomH],
    [bxLeft,    byBottom]
  ]));
  svg.appendChild(makeWedge('A', [
    [LANE_RIGHT, bottomY],
    [bxRight,    bottomY],
    [bxRight,    byBottom],
    [LANE_RIGHT, bottomY + bottomH]
  ]));
}

function showSpotInfo(spotData, label, users, currentUser) {
  const panel = document.getElementById('info-panel');
  panel.innerHTML = '';

  if (spotData.state === 'free' || !spotData.assignedUserId) {
    panel.textContent = `Spot ${label}: Free`;
    return;
  }

  const renter = users.find(u => u.id === spotData.assignedUserId);
  if (!renter) { panel.textContent = `Spot ${label}: Occupied`; return; }

  const lines = [`Spot ${label}  ·  ${renter.licensePlate || renter.username}`];
  if (currentUser.role !== 'renter') {
    lines.push(`${renter.name || ''} ${renter.lastName || ''}`.trim());
    if (renter.phone)   lines.push(`📞 ${renter.phone}`);
    if (renter.address) lines.push(`🏠 ${renter.address}`);
  }
  if (renter.carModel) lines.push(`${renter.carModel} · ${renter.carColor || '—'}`);

  lines.forEach((line, i) => {
    if (i === 0) {
      const s = document.createElement('strong');
      s.textContent = line; panel.appendChild(s);
    } else {
      panel.appendChild(document.createElement('br'));
      panel.appendChild(document.createTextNode(line));
    }
  });
}

async function initParking(highlightSpotId) {
  const [spots, users] = await Promise.all([
    readFile('data/spots.json'),
    readFile('data/users.json')
  ]);
  const currentUser = getSession();
  buildSVG(spots, users, currentUser);
  if (highlightSpotId) {
    const g = document.querySelector(`[data-id="${highlightSpotId}"]`);
    if (g) g.classList.add('highlighted');
  }
}
