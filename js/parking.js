// js/parking.js
// Renders the SVG parking layout.
// Spot states: free (green), occupied (red), reserved (grey).
// Occupied/reserved spots with a renter show license plate inside the spot rect.
// No car color indicators.

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

function spotId(label) {
  return label === 'A' ? 'sA' : label === 'B' ? 'sB' : `s${label}`;
}

function getSpotData(spots, label) {
  const sid = spotId(label);
  return spots.find(s => s.id === sid) || { id: sid, state: 'free', assignedUserId: null, reserved: false };
}

function spotStateClass(spotData) {
  if (spotData.reserved) return 'reserved';
  return spotData.state === 'occupied' ? 'occupied' : 'free';
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
  // All elements live inside the rotated group — no separate overlay groups.
  function makeSpot(label, cx, cy, angle, side) {
    const spotData = getSpotData(spots, label);
    const renter = spotData.assignedUserId
      ? users.find(u => u.id === spotData.assignedUserId)
      : null;

    const stateClass = spotStateClass(spotData);

    const g = document.createElementNS(svgNS, 'g');
    g.setAttribute('class', `spot ${stateClass}`);
    g.setAttribute('data-id', spotData.id);
    g.setAttribute('transform', `rotate(${angle}, ${cx}, ${cy})`);

    // Spot rectangle
    const rect = document.createElementNS(svgNS, 'rect');
    rect.setAttribute('x', cx - SPOT_W / 2);
    rect.setAttribute('y', cy - SPOT_H / 2);
    rect.setAttribute('width', SPOT_W);
    rect.setAttribute('height', SPOT_H);
    rect.setAttribute('rx', '2');
    g.appendChild(rect);

    // Spot number label (centred, always visible)
    const numText = document.createElementNS(svgNS, 'text');
    numText.setAttribute('class', 'spot-label');
    numText.setAttribute('x', cx);
    numText.setAttribute('y', cy);
    numText.textContent = label;
    g.appendChild(numText);

    // License plate text at the lane-facing (front) edge, inside the rotated group.
    // For left spots (angle=-45), front is the right side (+x).
    // For right spots (angle=+45), front is the left side (-x).
    if (renter) {
      const plate = (renter.licensePlate || renter.username || '').toUpperCase();
      if (plate) {
        const plateX = side === 'left'
          ? cx + SPOT_W / 2 - 2   // right edge for left-side spots
          : cx - SPOT_W / 2 + 2;  // left edge for right-side spots
        const anchor = side === 'left' ? 'end' : 'start';

        const plateText = document.createElementNS(svgNS, 'text');
        plateText.setAttribute('x', plateX);
        plateText.setAttribute('y', cy + 1);
        plateText.setAttribute('text-anchor', anchor);
        plateText.setAttribute('dominant-baseline', 'middle');
        plateText.setAttribute('font-family', 'inherit');
        plateText.setAttribute('font-size', '7');
        plateText.setAttribute('font-weight', '700');
        plateText.setAttribute('fill', '#fff');
        plateText.setAttribute('pointer-events', 'none');
        plateText.textContent = plate;
        g.appendChild(plateText);
      }
    }

    if (currentUser) {
      g.addEventListener('click', () => showSpotInfo(spotData, label, users, currentUser));
    }
    return g;
  }

  // Left diagonal row
  LEFT_SPOTS.forEach((label, i) => {
    const cy = START_Y + i * STEP_Y;
    const cx = LANE_LEFT - SPOT_W / 2 - 4;
    svg.appendChild(makeSpot(label, cx, cy, -ANGLE, 'left'));
  });

  // Right diagonal row
  RIGHT_SPOTS.forEach((label, i) => {
    const cy = START_Y + i * STEP_Y;
    const cx = LANE_RIGHT + SPOT_W / 2 + 4;
    svg.appendChild(makeSpot(label, cx, cy, ANGLE, 'right'));
  });

  // ── Bottom wedge spots (A, B) ──
  function makeWedge(label, points) {
    const spotData = getSpotData(spots, label);
    const renter = spotData.assignedUserId
      ? users.find(u => u.id === spotData.assignedUserId)
      : null;

    const stateClass = spotStateClass(spotData);

    const g = document.createElementNS(svgNS, 'g');
    g.setAttribute('class', `spot ${stateClass}`);
    g.setAttribute('data-id', spotData.id);

    const poly = document.createElementNS(svgNS, 'polygon');
    poly.setAttribute('points', points.map(p => p.join(',')).join(' '));
    g.appendChild(poly);

    const cx = points.reduce((a, p) => a + p[0], 0) / points.length;
    const cy = points.reduce((a, p) => a + p[1], 0) / points.length;

    const numText = document.createElementNS(svgNS, 'text');
    numText.setAttribute('class', 'spot-label');
    numText.setAttribute('x', cx);
    numText.setAttribute('y', cy - 8);
    numText.textContent = label;
    g.appendChild(numText);

    if (renter) {
      const plate = (renter.licensePlate || renter.username || '').toUpperCase();
      if (plate) {
        const pt = document.createElementNS(svgNS, 'text');
        pt.setAttribute('x', cx); pt.setAttribute('y', cy + 8);
        pt.setAttribute('text-anchor', 'middle');
        pt.setAttribute('dominant-baseline', 'middle');
        pt.setAttribute('font-size', '7'); pt.setAttribute('font-weight', '700');
        pt.setAttribute('fill', '#fff'); pt.setAttribute('pointer-events', 'none');
        pt.textContent = plate;
        g.appendChild(pt);
      }
    }

    if (currentUser) {
      g.addEventListener('click', () => showSpotInfo(spotData, label, users, currentUser));
    }
    return g;
  }

  // ── Bottom perpendicular spots (21, 22) ──
  function makeBottomLanePerpSpot(label, x, y, w, h) {
    const spotData = getSpotData(spots, label);
    const renter = spotData.assignedUserId
      ? users.find(u => u.id === spotData.assignedUserId)
      : null;

    const stateClass = spotStateClass(spotData);

    const g = document.createElementNS(svgNS, 'g');
    g.setAttribute('class', `spot ${stateClass}`);
    g.setAttribute('data-id', spotData.id);

    const rect = document.createElementNS(svgNS, 'rect');
    rect.setAttribute('x', x); rect.setAttribute('y', y);
    rect.setAttribute('width', w); rect.setAttribute('height', h);
    rect.setAttribute('rx', '2');
    g.appendChild(rect);

    const numText = document.createElementNS(svgNS, 'text');
    numText.setAttribute('class', 'spot-label');
    numText.setAttribute('x', x + w / 2);
    numText.setAttribute('y', y + h / 2 - 8);
    numText.textContent = label;
    g.appendChild(numText);

    if (renter) {
      const plate = (renter.licensePlate || renter.username || '').toUpperCase();
      if (plate) {
        const pt = document.createElementNS(svgNS, 'text');
        pt.setAttribute('x', x + w / 2); pt.setAttribute('y', y + h / 2 + 8);
        pt.setAttribute('text-anchor', 'middle');
        pt.setAttribute('dominant-baseline', 'middle');
        pt.setAttribute('font-size', '7'); pt.setAttribute('font-weight', '700');
        pt.setAttribute('fill', '#fff'); pt.setAttribute('pointer-events', 'none');
        pt.textContent = plate;
        g.appendChild(pt);
      }
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

  if (spotData.reserved) {
    panel.textContent = `Spot ${label}: Reserved (external — not available)`;
    return;
  }

  if (spotData.state === 'free' || !spotData.assignedUserId) {
    panel.textContent = `Spot ${label}: Free`;
    return;
  }

  const renter = users.find(u => u.id === spotData.assignedUserId);
  if (!renter) { panel.textContent = `Spot ${label}: Occupied`; return; }

  const lines = [`Spot ${label}  ·  ${(renter.licensePlate || renter.username || '').toUpperCase()}`];
  if (currentUser.role !== 'renter') {
    const name = `${renter.name || ''} ${renter.lastName || ''}`.trim();
    if (name) lines.push(name);
    if (renter.phone)   lines.push(`📞 ${renter.phone}`);
    if (renter.address) lines.push(`🏠 ${renter.address}`);
  }
  if (renter.carModel) lines.push(`${renter.carModel}${renter.carColor ? ' · ' + renter.carColor : ''}`);

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
