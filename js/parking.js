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

// Arrow tip is at LANE_TOP + 32; spots start just after that
const ARROW_TIP_Y = LANE_TOP + 32;
const START_Y = ARROW_TIP_Y + 22;   // first spot (20/10) begins after arrow tip
const STEP_Y  = 50;
const ANGLE   = 45;

// Widen the gap between spots and the outer boundary wall
const SIDE_MARGIN = 36;             // was ~20; more breathing room left/right

// Bottom row geometry (21, 22 perpendicular; A, B triangular wedges)
const BOTTOM_ROW_Y = LANE_BOTTOM + 50;

function spotId(label) {
  return label === 'X' ? 'sA' : label === 'Y' ? 'sB' : `s${label}`;
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
  const bxLeft   = LANE_LEFT  - SPOT_W - SIDE_MARGIN;
  const bxRight  = LANE_RIGHT + SPOT_W + SIDE_MARGIN;
  const byTop    = LANE_TOP - 10;
  const byBottom = BOTTOM_ROW_Y + SPOT_H + 30;   // extra space below bottom row

  const boundary = document.createElementNS(svgNS, 'rect');
  boundary.setAttribute('x', bxLeft);
  boundary.setAttribute('y', byTop);
  boundary.setAttribute('width',  bxRight - bxLeft);
  boundary.setAttribute('height', byBottom - byTop);
  boundary.setAttribute('fill', '#fff');
  boundary.setAttribute('stroke', '#000');
  boundary.setAttribute('stroke-width', '2');
  svg.appendChild(boundary);

  // ── "Entrance" label at the top centre of the boundary ──
  const entranceText = document.createElementNS(svgNS, 'text');
  entranceText.setAttribute('x', (LANE_LEFT + LANE_RIGHT) / 2);
  entranceText.setAttribute('y', byTop + 16);
  entranceText.setAttribute('text-anchor', 'middle');
  entranceText.setAttribute('dominant-baseline', 'middle');
  entranceText.setAttribute('font-family', 'monospace');
  entranceText.setAttribute('font-size', '13');
  entranceText.setAttribute('font-weight', 'bold');
  entranceText.setAttribute('fill', '#000');
  entranceText.textContent = 'Entrance';
  svg.appendChild(entranceText);

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
  // refIdx alternates 0/1 to cover all edges+corners across neighbouring spots:
  //   even (0): show edges a(top)/c(bottom) + corners 1(TL)/3(BR)
  //   odd  (1): show edges b(right)/d(left) + corners 2(TR)/4(BL)
  function makeSpot(label, cx, cy, angle, refIdx) {
    const spotData = getSpotData(spots, label);

    const g = document.createElementNS(svgNS, 'g');
    g.setAttribute('class', `spot ${spotData.state}`);
    g.setAttribute('data-id', spotData.id);
    g.setAttribute('transform', `rotate(${angle}, ${cx}, ${cy})`);

    const rx = cx - SPOT_W / 2;
    const ry = cy - SPOT_H / 2;
    const rw = SPOT_W;
    const rh = SPOT_H;

    const rect = document.createElementNS(svgNS, 'rect');
    rect.setAttribute('x', rx);
    rect.setAttribute('y', ry);
    rect.setAttribute('width', rw);
    rect.setAttribute('height', rh);
    rect.setAttribute('rx', '2');

    const text = document.createElementNS(svgNS, 'text');
    text.setAttribute('class', 'spot-label');
    text.setAttribute('x', cx);
    text.setAttribute('y', cy);
    text.textContent = label;

    g.appendChild(rect);
    g.appendChild(text);

    // Edge labels
    const edgeStyle = 'font-family:monospace;font-size:6px;fill:#666;pointer-events:none;';
    function edgeText(x, y, anchor, baseline, content) {
      const t = document.createElementNS(svgNS, 'text');
      t.setAttribute('x', x); t.setAttribute('y', y);
      t.setAttribute('text-anchor', anchor);
      t.setAttribute('dominant-baseline', baseline);
      t.setAttribute('style', edgeStyle);
      t.textContent = content;
      return t;
    }
    function cornerText(x, y, anchor, baseline, content) {
      const t = document.createElementNS(svgNS, 'text');
      t.setAttribute('x', x); t.setAttribute('y', y);
      t.setAttribute('text-anchor', anchor);
      t.setAttribute('dominant-baseline', baseline);
      t.setAttribute('style', 'font-family:monospace;font-size:6px;fill:#999;pointer-events:none;');
      t.textContent = content;
      return t;
    }

    if (refIdx % 2 === 0) {
      // edges a (top) and c (bottom)
      g.appendChild(edgeText(cx, ry + 2,      'middle', 'hanging',    'a'));
      g.appendChild(edgeText(cx, ry + rh - 2, 'middle', 'text-bottom', 'c'));
      // corners 1 (TL) and 3 (BR)
      g.appendChild(cornerText(rx + 2,      ry + 2,      'start', 'hanging',    '1'));
      g.appendChild(cornerText(rx + rw - 2, ry + rh - 2, 'end',   'text-bottom','3'));
    } else {
      // edges b (right) and d (left)
      g.appendChild(edgeText(rx + rw - 2, cy, 'end',   'middle', 'b'));
      g.appendChild(edgeText(rx + 2,      cy, 'start', 'middle', 'd'));
      // corners 2 (TR) and 4 (BL)
      g.appendChild(cornerText(rx + rw - 2, ry + 2,      'end',   'hanging',    '2'));
      g.appendChild(cornerText(rx + 2,      ry + rh - 2, 'start', 'text-bottom','4'));
    }

    if (currentUser) {
      g.addEventListener('click', () => showSpotInfo(spotData, label, users, currentUser));
    }
    return g;
  }

  // Left diagonal row (right edge touching lane left wall)
  LEFT_SPOTS.forEach((label, i) => {
    const cy = START_Y + i * STEP_Y;
    const cx = LANE_LEFT - SPOT_W / 2 - 4;
    svg.appendChild(makeSpot(label, cx, cy, -ANGLE, i));
  });

  // Right diagonal row (left edge touching lane right wall)
  RIGHT_SPOTS.forEach((label, i) => {
    const cy = START_Y + i * STEP_Y;
    const cx = LANE_RIGHT + SPOT_W / 2 + 4;
    svg.appendChild(makeSpot(label, cx, cy, ANGLE, i));
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

  // Custom-sized perpendicular spot to fit the lane width
  function makeBottomLanePerpSpot(label, x, y, w, h, refIdx) {
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

    // Edge/corner reference labels
    const eStyle = 'font-family:monospace;font-size:6px;fill:#666;pointer-events:none;';
    const cStyle = 'font-family:monospace;font-size:6px;fill:#999;pointer-events:none;';
    function et(px, py, anchor, baseline, val) {
      const t = document.createElementNS(svgNS, 'text');
      t.setAttribute('x', px); t.setAttribute('y', py);
      t.setAttribute('text-anchor', anchor);
      t.setAttribute('dominant-baseline', baseline);
      t.setAttribute('style', eStyle);
      t.textContent = val; return t;
    }
    function ct(px, py, anchor, baseline, val) {
      const t = document.createElementNS(svgNS, 'text');
      t.setAttribute('x', px); t.setAttribute('y', py);
      t.setAttribute('text-anchor', anchor);
      t.setAttribute('dominant-baseline', baseline);
      t.setAttribute('style', cStyle);
      t.textContent = val; return t;
    }
    if (refIdx % 2 === 0) {
      g.appendChild(et(x + w / 2, y + 2,       'middle', 'hanging',    'a'));
      g.appendChild(et(x + w / 2, y + h - 2,   'middle', 'text-bottom','c'));
      g.appendChild(ct(x + 2,     y + 2,        'start',  'hanging',   '1'));
      g.appendChild(ct(x + w - 2, y + h - 2,   'end',    'text-bottom','3'));
    } else {
      g.appendChild(et(x + w - 2, y + h / 2,   'end',   'middle', 'b'));
      g.appendChild(et(x + 2,     y + h / 2,   'start', 'middle', 'd'));
      g.appendChild(ct(x + w - 2, y + 2,       'end',   'hanging',    '2'));
      g.appendChild(ct(x + 2,     y + h - 2,   'start', 'text-bottom','4'));
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

  // 22 (left half of lane), 21 (right half of lane)
  svg.appendChild(makeBottomLanePerpSpot('22',
    LANE_LEFT + 4, bottomY, perpW, bottomH, 0));
  svg.appendChild(makeBottomLanePerpSpot('21',
    laneCenterX + 4, bottomY, perpW, bottomH, 1));

  // Y — wedge: front edge flush with 22 (was B)
  svg.appendChild(makeWedge('Y', [
    [bxLeft,      bottomY],
    [LANE_LEFT,   bottomY],
    [LANE_LEFT,   bottomY + bottomH],
    [bxLeft,      byBottom]
  ]));

  // X — wedge: front edge flush with 21 (was A)
  svg.appendChild(makeWedge('X', [
    [LANE_RIGHT,  bottomY],
    [bxRight,     bottomY],
    [bxRight,     byBottom],
    [LANE_RIGHT,  bottomY + bottomH]
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
