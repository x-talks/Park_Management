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

function spotStateClass(spotData, pendingSpotIds) {
  if (spotData.reserved) return 'reserved';
  if (pendingSpotIds && pendingSpotIds.has(spotData.id)) return 'pending';
  return spotData.state === 'occupied' ? 'occupied' : 'free';
}

function buildSVG(spots, users, currentUser, pendingSpotIds) {
  pendingSpotIds = pendingSpotIds || new Set();
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.getElementById('parking-svg');
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  const bxLeft   = LANE_LEFT  - SPOT_W - SIDE_MARGIN - 60;
  const bxRight  = LANE_RIGHT + SPOT_W + SIDE_MARGIN + 60;
  const byTop    = LANE_TOP - 10;
  const byBottom = BOTTOM_ROW_Y + SPOT_H + 30;

  // Outer boundary — rounded corners, theme-aware
  const boundary = document.createElementNS(svgNS, 'rect');
  boundary.setAttribute('x', bxLeft); boundary.setAttribute('y', byTop);
  boundary.setAttribute('width', bxRight - bxLeft);
  boundary.setAttribute('height', byBottom - byTop);
  boundary.setAttribute('rx', '10');
  boundary.setAttribute('style', 'fill:var(--svg-boundary);stroke:var(--svg-boundary-stroke);stroke-width:2');
  svg.appendChild(boundary);

  // Driving lane
  const lane = document.createElementNS(svgNS, 'rect');
  lane.setAttribute('x', LANE_LEFT); lane.setAttribute('y', LANE_TOP);
  lane.setAttribute('width', LANE_RIGHT - LANE_LEFT);
  lane.setAttribute('height', LANE_BOTTOM - LANE_TOP);
  lane.setAttribute('style', 'fill:var(--svg-lane);stroke:var(--svg-lane-stroke);stroke-width:1');
  svg.appendChild(lane);

  // Center dashed line down the driving lane
  const ax = (LANE_LEFT + LANE_RIGHT) / 2;
  const dashLen = 18, dashGap = 12;
  for (let y = LANE_TOP + 36; y < LANE_BOTTOM - 10; y += dashLen + dashGap) {
    const dash = document.createElementNS(svgNS, 'line');
    dash.setAttribute('x1', ax); dash.setAttribute('y1', y);
    dash.setAttribute('x2', ax); dash.setAttribute('y2', Math.min(y + dashLen, LANE_BOTTOM - 10));
    dash.setAttribute('style', 'stroke:var(--svg-arrow);stroke-width:2;opacity:0.4');
    svg.appendChild(dash);
  }

  // Entrance label (above arrow)
  const entranceText = document.createElementNS(svgNS, 'text');
  entranceText.setAttribute('x', ax);
  entranceText.setAttribute('y', byTop + 14);
  entranceText.setAttribute('text-anchor', 'middle');
  entranceText.setAttribute('dominant-baseline', 'middle');
  entranceText.setAttribute('font-family', 'inherit');
  entranceText.setAttribute('font-size', '10');
  entranceText.setAttribute('font-weight', '700');
  entranceText.setAttribute('letter-spacing', '1.5');
  entranceText.setAttribute('style', 'fill:var(--svg-text)');
  entranceText.textContent = 'ENTRANCE';
  svg.appendChild(entranceText);

  // Entry arrow
  const arrow = document.createElementNS(svgNS, 'polygon');
  arrow.setAttribute('points',
    `${ax - 10},${LANE_TOP + 8} ${ax + 10},${LANE_TOP + 8} ${ax},${LANE_TOP + 26}`);
  arrow.setAttribute('style', 'fill:var(--svg-arrow)');
  svg.appendChild(arrow);

  // ── Diagonal spot factory ──
  // Spot number: centred inside the rect (inherits rotation).
  // License plate: placed OUTSIDE the rect on the wall side (back edge),
  //   counter-rotated so it reads horizontally, in a dark pill for contrast.
  function makeSpot(label, cx, cy, angle, side) {
    const spotData = getSpotData(spots, label);
    const renter = spotData.assignedUserId
      ? users.find(u => u.id === spotData.assignedUserId)
      : null;

    const stateClass = spotStateClass(spotData, pendingSpotIds);

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
    rect.setAttribute('rx', '4');
    g.appendChild(rect);

    // Owned indicator — small dot in top-right corner of the rect
    if (spotData.owned) {
      const dot = document.createElementNS(svgNS, 'circle');
      dot.setAttribute('cx', cx + SPOT_W / 2 - 5);
      dot.setAttribute('cy', cy - SPOT_H / 2 + 5);
      dot.setAttribute('r', '3.5');
      dot.setAttribute('fill', 'rgba(255,255,255,0.9)');
      dot.setAttribute('pointer-events', 'none');
      g.appendChild(dot);
    }

    // Spot number label — centered inside rect
    const numText = document.createElementNS(svgNS, 'text');
    numText.setAttribute('class', 'spot-label');
    numText.setAttribute('x', cx);
    numText.setAttribute('y', renter ? cy - 4 : cy);
    numText.textContent = label;
    g.appendChild(numText);

    // License plate — outside the rect, on the wall (back) side.
    // Back edge: left spots → left side (cx - SPOT_W/2), right spots → right side (cx + SPOT_W/2).
    // We counter-rotate the plate group so text reads horizontally.
    if (renter) {
      const plate = (renter.licensePlate || renter.username || '').toUpperCase();
      if (plate) {
        const backEdgeX = side === 'left'
          ? cx - SPOT_W / 2   // wall side for left spots
          : cx + SPOT_W / 2;  // wall side for right spots
        const plateAnchor = side === 'left' ? 'end' : 'start';
        const plateOffsetX = side === 'left' ? -4 : 4;

        // Counter-rotate group so pill + text are always horizontal
        const plateG = document.createElementNS(svgNS, 'g');
        plateG.setAttribute('transform', `rotate(${-angle}, ${backEdgeX}, ${cy})`);
        plateG.setAttribute('pointer-events', 'none');

        // Dark pill background
        const PILL_H = 12, PILL_PAD = 4;
        const approxW = plate.length * 5.5 + PILL_PAD * 2;
        const pillX = plateAnchor === 'end'
          ? backEdgeX + plateOffsetX - approxW
          : backEdgeX + plateOffsetX;
        const pill = document.createElementNS(svgNS, 'rect');
        pill.setAttribute('x', pillX);
        pill.setAttribute('y', cy - PILL_H / 2);
        pill.setAttribute('width', approxW);
        pill.setAttribute('height', PILL_H);
        pill.setAttribute('rx', '3');
        pill.setAttribute('fill', 'rgba(0,0,0,0.85)');
        plateG.appendChild(pill);

        const pt = document.createElementNS(svgNS, 'text');
        pt.setAttribute('x', backEdgeX + plateOffsetX);
        pt.setAttribute('y', cy + 0.5);
        pt.setAttribute('text-anchor', plateAnchor);
        pt.setAttribute('dominant-baseline', 'middle');
        pt.setAttribute('font-family', 'inherit');
        pt.setAttribute('font-size', '8');
        pt.setAttribute('font-weight', '800');
        pt.setAttribute('fill', '#fff');
        pt.setAttribute('letter-spacing', '0.5');
        pt.textContent = plate;
        plateG.appendChild(pt);

        g.appendChild(plateG);
      }
    }

    if (currentUser) {
      g.addEventListener('click', () => {
        const panel = document.getElementById('info-panel');
        const alreadySelected = svg.querySelector('.spot.selected') === g;
        svg.querySelectorAll('.spot.selected').forEach(el => el.classList.remove('selected'));
        if (alreadySelected) {
          panel.innerHTML = '';
          panel.classList.remove('has-content');
          panel.setAttribute('data-i18n', 'map.info.default');
          panel.textContent = typeof t === 'function' ? t('map.info.default') : 'Tap a spot to see details.';
        } else {
          g.classList.add('selected');
          showSpotInfo(spotData, label, users, currentUser, pendingSpotIds);
        }
      });
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

    const stateClass = spotStateClass(spotData, pendingSpotIds);

    const g = document.createElementNS(svgNS, 'g');
    g.setAttribute('class', `spot ${stateClass}`);
    g.setAttribute('data-id', spotData.id);

    const poly = document.createElementNS(svgNS, 'polygon');
    poly.setAttribute('points', points.map(p => p.join(',')).join(' '));
    g.appendChild(poly);

    // Owned indicator
    if (spotData.owned) {
      const dot = document.createElementNS(svgNS, 'circle');
      dot.setAttribute('cx', points[1][0] - 8); dot.setAttribute('cy', points[0][1] + 8);
      dot.setAttribute('r', '4');
      dot.setAttribute('fill', 'rgba(255,255,255,0.9)');
      dot.setAttribute('pointer-events', 'none');
      g.appendChild(dot);
    }

    const cx = points.reduce((a, p) => a + p[0], 0) / points.length;
    const cy = points.reduce((a, p) => a + p[1], 0) / points.length;

    // Spot number — upper area
    const numText = document.createElementNS(svgNS, 'text');
    numText.setAttribute('class', 'spot-label');
    numText.setAttribute('x', cx);
    numText.setAttribute('y', renter ? cy - 10 : cy);
    numText.textContent = label;
    g.appendChild(numText);

    if (renter) {
      const plate = (renter.licensePlate || renter.username || '').toUpperCase();
      if (plate) {
        const PILL_H = 13, PILL_PAD = 5;
        const approxW = plate.length * 5.5 + PILL_PAD * 2;
        const pill = document.createElementNS(svgNS, 'rect');
        pill.setAttribute('x', cx - approxW / 2);
        pill.setAttribute('y', cy + 2);
        pill.setAttribute('width', approxW);
        pill.setAttribute('height', PILL_H);
        pill.setAttribute('rx', '3');
        pill.setAttribute('fill', 'rgba(0,0,0,0.85)');
        pill.setAttribute('pointer-events', 'none');
        g.appendChild(pill);

        const pt = document.createElementNS(svgNS, 'text');
        pt.setAttribute('x', cx); pt.setAttribute('y', cy + 9);
        pt.setAttribute('text-anchor', 'middle');
        pt.setAttribute('dominant-baseline', 'middle');
        pt.setAttribute('font-size', '8'); pt.setAttribute('font-weight', '800');
        pt.setAttribute('fill', '#fff'); pt.setAttribute('pointer-events', 'none');
        pt.setAttribute('letter-spacing', '0.5');
        pt.textContent = plate;
        g.appendChild(pt);
      }
    }

    if (currentUser) {
      g.addEventListener('click', () => {
        const panel = document.getElementById('info-panel');
        const alreadySelected = svg.querySelector('.spot.selected') === g;
        svg.querySelectorAll('.spot.selected').forEach(el => el.classList.remove('selected'));
        if (alreadySelected) {
          panel.innerHTML = '';
          panel.classList.remove('has-content');
          panel.setAttribute('data-i18n', 'map.info.default');
          panel.textContent = typeof t === 'function' ? t('map.info.default') : 'Tap a spot to see details.';
        } else {
          g.classList.add('selected');
          showSpotInfo(spotData, label, users, currentUser, pendingSpotIds);
        }
      });
    }
    return g;
  }

  // ── Bottom perpendicular spots (21, 22) ──
  function makeBottomLanePerpSpot(label, x, y, w, h) {
    const spotData = getSpotData(spots, label);
    const renter = spotData.assignedUserId
      ? users.find(u => u.id === spotData.assignedUserId)
      : null;

    const stateClass = spotStateClass(spotData, pendingSpotIds);

    const g = document.createElementNS(svgNS, 'g');
    g.setAttribute('class', `spot ${stateClass}`);
    g.setAttribute('data-id', spotData.id);

    const rect = document.createElementNS(svgNS, 'rect');
    rect.setAttribute('x', x); rect.setAttribute('y', y);
    rect.setAttribute('width', w); rect.setAttribute('height', h);
    rect.setAttribute('rx', '4');
    g.appendChild(rect);
    // Owned indicator
    if (spotData.owned) {
      const dot = document.createElementNS(svgNS, 'circle');
      dot.setAttribute('cx', x + w - 6); dot.setAttribute('cy', y + 6);
      dot.setAttribute('r', '3.5');
      dot.setAttribute('fill', 'rgba(255,255,255,0.9)');
      dot.setAttribute('pointer-events', 'none');
      g.appendChild(dot);
    }
    const numText = document.createElementNS(svgNS, 'text');
    numText.setAttribute('class', 'spot-label');
    numText.setAttribute('x', x + w / 2);
    numText.setAttribute('y', renter ? y + h / 2 - 12 : y + h / 2);
    numText.textContent = label;
    g.appendChild(numText);

    if (renter) {
      const plate = (renter.licensePlate || renter.username || '').toUpperCase();
      if (plate) {
        const PILL_H = 13, PILL_PAD = 5;
        const approxW = plate.length * 5.5 + PILL_PAD * 2;
        const pill = document.createElementNS(svgNS, 'rect');
        pill.setAttribute('x', x + w / 2 - approxW / 2);
        pill.setAttribute('y', y + h / 2 + 2);
        pill.setAttribute('width', approxW);
        pill.setAttribute('height', PILL_H);
        pill.setAttribute('rx', '3');
        pill.setAttribute('fill', 'rgba(0,0,0,0.85)');
        pill.setAttribute('pointer-events', 'none');
        g.appendChild(pill);

        const pt = document.createElementNS(svgNS, 'text');
        pt.setAttribute('x', x + w / 2); pt.setAttribute('y', y + h / 2 + 9);
        pt.setAttribute('text-anchor', 'middle');
        pt.setAttribute('dominant-baseline', 'middle');
        pt.setAttribute('font-size', '8'); pt.setAttribute('font-weight', '800');
        pt.setAttribute('fill', '#fff'); pt.setAttribute('pointer-events', 'none');
        pt.setAttribute('letter-spacing', '0.5');
        pt.textContent = plate;
        g.appendChild(pt);
      }
    }

    if (currentUser) {
      g.addEventListener('click', () => {
        const panel = document.getElementById('info-panel');
        const alreadySelected = svg.querySelector('.spot.selected') === g;
        svg.querySelectorAll('.spot.selected').forEach(el => el.classList.remove('selected'));
        if (alreadySelected) {
          panel.innerHTML = '';
          panel.classList.remove('has-content');
          panel.setAttribute('data-i18n', 'map.info.default');
          panel.textContent = typeof t === 'function' ? t('map.info.default') : 'Tap a spot to see details.';
        } else {
          g.classList.add('selected');
          showSpotInfo(spotData, label, users, currentUser, pendingSpotIds);
        }
      });
    }
    return g;
  }

  const bottomY = LANE_BOTTOM + 10;
  const bottomH = 60;
  const perpW = (LANE_RIGHT - LANE_LEFT) / 2 - 4;
  const laneCenterX = (LANE_LEFT + LANE_RIGHT) / 2;

  svg.appendChild(makeBottomLanePerpSpot('22', LANE_LEFT + 4, bottomY, perpW, bottomH));
  svg.appendChild(makeBottomLanePerpSpot('21', laneCenterX + 4, bottomY, perpW - 4, bottomH));

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

function showSpotInfo(spotData, label, users, currentUser, pendingSpotIds) {
  const panel = document.getElementById('info-panel');
  panel.innerHTML = '';
  panel.classList.add('has-content');

  if (spotData.reserved) {
    panel.textContent = `Spot ${label}: Reserved (external — not available)`;
    return;
  }

  if (pendingSpotIds && pendingSpotIds.has(spotData.id)) {
    panel.textContent = typeof t === 'function' ? `Spot ${label}: ${t('spot.state.pending')}` : `Spot ${label}: Pending registration`;
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
  const [spots, users, pendingRegs] = await Promise.all([
    readFile('data/spots.json'),
    readFile('data/users.json'),
    readFile('data/pending_registrations').catch(() => [])
  ]);
  const pendingSpotIds = new Set(pendingRegs.map(pr => pr.spotId));
  const currentUser = getSession();
  buildSVG(spots, users, currentUser, pendingSpotIds);
  if (highlightSpotId) {
    const g = document.querySelector(`[data-id="${highlightSpotId}"]`);
    if (g) g.classList.add('highlighted');
  }
}
