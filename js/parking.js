// js/parking.js
// Renders the SVG parking layout and handles spot interactions.
// Uses SVG DOM API exclusively — no innerHTML.

// Diagonal spots flanking the central lane (top → bottom)
const LEFT_SPOTS  = ['20','19','18','17','16','15','14','13','12','11'];
const RIGHT_SPOTS = ['10','9','8','7','6','5','4','3','2','1'];

// Layout constants — single source of truth for the whole diagram
const CANVAS_W = 800;
const CANVAS_H = 760;
const SPOT_W   = 76;
const SPOT_H   = 32;

const LANE_LEFT  = 320;
const LANE_RIGHT = 480;
const LANE_TOP   = 30;
const LANE_BOTTOM = 600;

const START_Y = LANE_TOP + 30;
const STEP_Y  = 50;
const ANGLE   = 45;

// Bottom row geometry (21, 22 perpendicular; A, B triangular wedges)
const BOTTOM_ROW_Y = LANE_BOTTOM + 50;

function spotId(label) {
  return label === 'A' ? 'sA' : label === 'B' ? 'sB' : `s${label}`;
}

function getSpotData(spots, label) {
  const sid = spotId(label);
  return spots.find(s => s.id === sid) || { id: sid, state: 'free', assignedUserId: null };
}

function buildSVG(spots, users, currentUser) {
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.getElementById('parking-svg');
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  // ── Outer parking area boundary ──
  const boundary = document.createElementNS(svgNS, 'rect');
  boundary.setAttribute('x', LANE_LEFT - SPOT_W - 20);
  boundary.setAttribute('y', LANE_TOP - 10);
  boundary.setAttribute('width', (LANE_RIGHT - LANE_LEFT) + 2 * (SPOT_W + 20));
  boundary.setAttribute('height', (BOTTOM_ROW_Y + SPOT_H) - LANE_TOP + 30);
  boundary.setAttribute('fill', '#fff');
  boundary.setAttribute('stroke', '#000');
  boundary.setAttribute('stroke-width', '2');
  svg.appendChild(boundary);

  // ── Driving lane (light fill) ──
  const lane = document.createElementNS(svgNS, 'rect');
  lane.setAttribute('x', LANE_LEFT);
  lane.setAttribute('y', LANE_TOP);
  lane.setAttribute('width', LANE_RIGHT - LANE_LEFT);
  lane.setAttribute('height', LANE_BOTTOM - LANE_TOP);
  lane.setAttribute('fill', '#f8f8f8');
  lane.setAttribute('stroke', '#ccc');
  lane.setAttribute('stroke-width', '1');
  svg.appendChild(lane);

  // ── Entry arrow ──
  const arrow = document.createElementNS(svgNS, 'polygon');
  const ax = (LANE_LEFT + LANE_RIGHT) / 2;
  arrow.setAttribute('points',
    `${ax - 12},${LANE_TOP + 10} ${ax + 12},${LANE_TOP + 10} ${ax},${LANE_TOP + 32}`);
  arrow.setAttribute('fill', '#000');
  svg.appendChild(arrow);

  // ── Diagonal spot factory ──
  function makeSpot(label, cx, cy, angle) {
    const spotData = getSpotData(spots, label);

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

    const text = document.createElementNS(svgNS, 'text');
    text.setAttribute('class', 'spot-label');
    text.setAttribute('x', cx);
    text.setAttribute('y', cy);
    text.textContent = label;

    g.appendChild(rect);
    g.appendChild(text);

    if (currentUser) {
      g.addEventListener('click', () => showSpotInfo(spotData, label, users, currentUser));
    }
    return g;
  }

  // Left diagonal row (right edge touching lane left wall)
  LEFT_SPOTS.forEach((label, i) => {
    const cy = START_Y + i * STEP_Y;
    const cx = LANE_LEFT - SPOT_W / 2 - 4;
    svg.appendChild(makeSpot(label, cx, cy, -ANGLE));
  });

  // Right diagonal row (left edge touching lane right wall)
  RIGHT_SPOTS.forEach((label, i) => {
    const cy = START_Y + i * STEP_Y;
    const cx = LANE_RIGHT + SPOT_W / 2 + 4;
    svg.appendChild(makeSpot(label, cx, cy, ANGLE));
  });

  // ── Bottom row: B (wedge), 22, 21 (perpendicular), A (wedge) ──

  // Triangular wedge spot — closes a corner of the rectangle
  function makeWedge(label, points) {
    const spotData = getSpotData(spots, label);

    const g = document.createElementNS(svgNS, 'g');
    g.setAttribute('class', `spot ${spotData.state}`);
    g.setAttribute('data-id', spotData.id);

    const poly = document.createElementNS(svgNS, 'polygon');
    poly.setAttribute('points', points.map(p => p.join(',')).join(' '));
    poly.setAttribute('rx', '2');

    // Compute centroid for the label
    const cx = points.reduce((a, p) => a + p[0], 0) / points.length;
    const cy = points.reduce((a, p) => a + p[1], 0) / points.length;
    const text = document.createElementNS(svgNS, 'text');
    text.setAttribute('class', 'spot-label');
    text.setAttribute('x', cx);
    text.setAttribute('y', cy);
    text.textContent = label;

    g.appendChild(poly);
    g.appendChild(text);

    if (currentUser) {
      g.addEventListener('click', () => showSpotInfo(spotData, label, users, currentUser));
    }
    return g;
  }

  // Perpendicular spot at the bottom row (axis-aligned, label-only)
  function makePerpendicular(label, cx, cy) {
    return makeSpot(label, cx, cy, 0);
  }

  // 22 sits to the left of 21 in the lane bottom (centred under the lane)
  const laneCenterX = (LANE_LEFT + LANE_RIGHT) / 2;
  const perpW = (LANE_RIGHT - LANE_LEFT) / 2 - 4;

  // Use a custom-sized rect for 21/22 to fit the lane width
  function makeBottomLanePerpSpot(label, x, y, w, h) {
    const spotData = getSpotData(spots, label);
    const g = document.createElementNS(svgNS, 'g');
    g.setAttribute('class', `spot ${spotData.state}`);
    g.setAttribute('data-id', spotData.id);

    const rect = document.createElementNS(svgNS, 'rect');
    rect.setAttribute('x', x);
    rect.setAttribute('y', y);
    rect.setAttribute('width', w);
    rect.setAttribute('height', h);
    rect.setAttribute('rx', '2');

    const text = document.createElementNS(svgNS, 'text');
    text.setAttribute('class', 'spot-label');
    text.setAttribute('x', x + w / 2);
    text.setAttribute('y', y + h / 2);
    text.textContent = label;

    g.appendChild(rect);
    g.appendChild(text);

    if (currentUser) {
      g.addEventListener('click', () => showSpotInfo(spotData, label, users, currentUser));
    }
    return g;
  }

  const bottomY = LANE_BOTTOM + 10;
  const bottomH = 60;

  // 22 (left half of lane), 21 (right half of lane)
  svg.appendChild(makeBottomLanePerpSpot('22',
    LANE_LEFT + 4, bottomY, perpW, bottomH));
  svg.appendChild(makeBottomLanePerpSpot('21',
    laneCenterX + 4, bottomY, perpW, bottomH));

  // B — triangular wedge closing the bottom-left corner
  // Triangle: left-bottom of last left diagonal spot → bottom-left boundary corner → lane bottom-left
  const bxLeft  = LANE_LEFT - SPOT_W - 20;          // boundary left
  const byBottom = bottomY + bottomH;                // boundary bottom
  svg.appendChild(makeWedge('B', [
    [bxLeft, byBottom - 10],
    [LANE_LEFT, byBottom],
    [LANE_LEFT, bottomY],
    [bxLeft, bottomY - 30]
  ]));

  // A — triangular wedge closing the bottom-right corner
  const bxRight = LANE_RIGHT + SPOT_W + 20;         // boundary right
  svg.appendChild(makeWedge('A', [
    [LANE_RIGHT, bottomY],
    [bxRight, bottomY - 30],
    [bxRight, byBottom - 10],
    [LANE_RIGHT, byBottom]
  ]));
}

function showSpotInfo(spotData, label, users, currentUser) {
  const panel = document.getElementById('info-panel');
  while (panel.firstChild) panel.removeChild(panel.firstChild);

  if (spotData.state === 'free' || !spotData.assignedUserId) {
    panel.textContent = `Spot ${label}: Free`;
    return;
  }

  const renter = users.find(u => u.id === spotData.assignedUserId);
  const renterName = renter ? renter.name : 'Unknown';

  if (currentUser.role === 'renter') {
    panel.textContent = `Spot ${label}: ${renterName}`;
  } else {
    const strong = document.createElement('strong');
    strong.textContent = `Spot ${label}`;
    const br1 = document.createElement('br');
    const renterLine = document.createTextNode(`Renter: ${renterName}`);
    const br2 = document.createElement('br');
    const phoneLine = document.createTextNode(`Phone: ${renter ? renter.phone : '—'}`);
    const br3 = document.createElement('br');
    const addrLine = document.createTextNode(`Address: ${renter ? renter.address : '—'}`);
    panel.append(strong, br1, renterLine, br2, phoneLine, br3, addrLine);
  }
}

async function initParking(highlightSpotId = null) {
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
