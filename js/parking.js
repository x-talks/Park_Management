// js/parking.js
// Renders the SVG parking layout using the v40 map design:
// dark background, gradient fills, double-polygon depth (shadow + face),
// rounded corners via morphology filter, and a glow filter on the current
// user's own spots. Spot states: free (green), occupied (red),
// reserved (grey), pending (amber), mine (indigo + glow).

const LEFT_SPOTS  = ['20','19','18','17','16','15','14','13','12','11'];
const RIGHT_SPOTS = ['10','9','8','7','6','5','4','3','2','1'];

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

// ── v40 map design ──
// Static <defs> (gradients + filters) injected on every render since the SVG
// is cleared and rebuilt each time buildSVG runs.
const V40_STATUS_GRADIENT = {
  free:     { face: 'gFree', shadow: 'gFreeS' },
  occupied: { face: 'gOcc',  shadow: 'gOccS'  },
  reserved: { face: 'gRes',  shadow: 'gResS'  },
  pending:  { face: 'gPend', shadow: 'gPendS' },
  mine:     { face: 'gMine', shadow: 'gMineS' },
};

// Text fill per status: green (free) spots use dark green, pending uses black,
// occupied/reserved/mine use white.
function v40TextFill(kind) {
  if (kind === 'free') return '#052e16';
  if (kind === 'pending') return '#000';
  return '#fff';
}

const V40_DEFS = `
  <linearGradient id="gFree" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#4ade80"/><stop offset="100%" stop-color="#15803d"/></linearGradient>
  <linearGradient id="gFreeS" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#052e16"/><stop offset="100%" stop-color="#041a0c"/></linearGradient>
  <linearGradient id="gOcc" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#f87171"/><stop offset="100%" stop-color="#b91c1c"/></linearGradient>
  <linearGradient id="gOccS" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#3b0a0a"/><stop offset="100%" stop-color="#250707"/></linearGradient>
  <linearGradient id="gRes" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#9ca3af"/><stop offset="100%" stop-color="#4b5563"/></linearGradient>
  <linearGradient id="gResS" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#1f2937"/><stop offset="100%" stop-color="#111827"/></linearGradient>
  <linearGradient id="gMine" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#c4b5fd"/><stop offset="100%" stop-color="#4f46e5"/></linearGradient>
  <linearGradient id="gMineS" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#2e1065"/><stop offset="100%" stop-color="#1e0a47"/></linearGradient>
  <linearGradient id="gPend" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#fbbf24"/><stop offset="100%" stop-color="#b45309"/></linearGradient>
  <linearGradient id="gPendS" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#451a03"/><stop offset="100%" stop-color="#2d1102"/></linearGradient>
  <linearGradient id="gLane" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#131c2e"/><stop offset="50%" stop-color="#0f172a"/><stop offset="100%" stop-color="#131c2e"/></linearGradient>
  <filter id="myGlow" x="-50%" y="-50%" width="200%" height="200%">
    <feGaussianBlur stdDeviation="5" result="blur"/>
    <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <filter id="round" x="-5%" y="-5%" width="110%" height="110%">
    <feMorphology in="SourceGraphic" operator="erode" radius="2" result="eroded"/>
    <feMorphology in="eroded" operator="dilate" radius="2" result="rounded"/>
    <feComposite in="rounded" in2="SourceGraphic" operator="in"/>
  </filter>`;

function buildSVG(spots, users, currentUser, pendingSpotIds) {
  pendingSpotIds = pendingSpotIds || new Set();
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.getElementById('parking-svg');
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  const el = (name, attrs) => {
    const node = document.createElementNS(svgNS, name);
    for (const k in attrs) node.setAttribute(k, attrs[k]);
    return node;
  };

  // Determine which spots belong to the current user ("mine").
  const myRecord = currentUser
    ? (users || []).find(u => u.id === currentUser.id)
    : null;
  const mineSpotIds = new Set(
    (myRecord && Array.isArray(myRecord.assignedSpots)) ? myRecord.assignedSpots : []
  );

  // ── <defs>: gradients + filters (rebuilt each render) ──
  const defs = el('defs', {});
  defs.innerHTML = V40_DEFS;
  svg.appendChild(defs);

  // ── dm background grid ──
  const gridLine = (x1, y1, x2, y2, stroke, dash) => {
    const attrs = { x1, y1, x2, y2, stroke, 'stroke-width': '0.5' };
    if (dash) attrs['stroke-dasharray'] = dash;
    return el('line', attrs);
  };
  const gridG = el('g', { 'pointer-events': 'none' });
  // Vertical (X) grid lines every 5dm: SVGx = 8 + n*10.14285
  const gxStep = 10.142857;
  for (let n = 0; n <= 28; n++) {
    const x = +(8 + n * gxStep).toFixed(2);
    let stroke, dash;
    if (n === 0 || n === 28) { stroke = 'rgba(255,255,255,0.08)'; }
    else if (Math.abs(x - 150) < 0.5) { continue; } // center handled separately
    else if (n % 2 === 0) { stroke = 'rgba(255,255,255,0.06)'; }
    else { stroke = 'rgba(255,255,255,0.04)'; dash = '2,3'; }
    gridG.appendChild(gridLine(x, 22, x, 492, stroke, dash));
  }
  // Center X line (highlighted)
  gridG.appendChild(el('line', { x1: 150, y1: 22, x2: 150, y2: 492, stroke: 'rgba(255,255,255,0.35)', 'stroke-width': '1' }));
  // Horizontal (Y) grid lines every 5dm: SVGy = 22 + n*5.34222
  const gyStep = 5.342222;
  for (let n = 0; n <= 88; n++) {
    const y = +(22 + n * gyStep).toFixed(2);
    let stroke, dash;
    if (n === 0 || n === 88) { stroke = 'rgba(255,255,255,0.08)'; }
    else if (n % 2 === 0) { stroke = 'rgba(255,255,255,0.06)'; }
    else { stroke = 'rgba(255,255,255,0.04)'; dash = '2,3'; }
    gridG.appendChild(gridLine(8, y, 292, y, stroke, dash));
  }
  svg.appendChild(gridG);

  // ── Card + driving lane ──
  svg.appendChild(el('rect', { x: 8, y: 22, width: 284, height: 480, rx: 12, fill: '#0d1117', stroke: 'rgba(255,255,255,0.07)', 'stroke-width': '1.5' }));
  svg.appendChild(el('rect', { x: 105, y: 30, width: 90, height: 462, rx: 5, fill: 'url(#gLane)', stroke: 'rgba(255,255,255,0.04)', 'stroke-width': '1' }));
  svg.appendChild(el('line', { x1: 150, y1: 50, x2: 150, y2: 483, stroke: 'rgba(255,255,255,0.11)', 'stroke-width': '1.5', 'stroke-dasharray': '13,9' }));

  const entrance = el('text', { x: 150, y: 37, 'text-anchor': 'middle', fill: 'rgba(255,255,255,0.28)', 'font-size': '6.5', 'font-weight': '700', 'letter-spacing': '2', 'font-family': 'system-ui' });
  entrance.textContent = 'ENTRANCE';
  svg.appendChild(entrance);
  svg.appendChild(el('polygon', { points: '144,44 156,44 150,56', fill: 'rgba(255,255,255,0.35)' }));

  // ── Spot factory: double polygon (shadow + face), optional glow, number ──
  function classifyStatus(spotData) {
    if (mineSpotIds.has(spotData.id)) return 'mine';
    return spotStateClass(spotData, pendingSpotIds); // free | occupied | reserved | pending
  }

  // Build a spot group from precomputed geometry.
  //   facePts / shadowPts: polygon point strings (null => use rect coords)
  //   rect: {x,y,w,h} for the perpendicular bottom-row spots
  //   textX / textY: number label position
  function makeSpotGroup(label, geom) {
    const spotData = getSpotData(spots, label);
    const kind = classifyStatus(spotData);
    const grad = V40_STATUS_GRADIENT[kind] || V40_STATUS_GRADIENT.free;
    const isMine = kind === 'mine';

    const g = el('g', { 'data-id': spotData.id, class: `spot spot-group ${kind}`, style: 'cursor:pointer' });

    // Shadow (offset +5 down)
    if (geom.rect) {
      const r = geom.rect;
      g.appendChild(el('rect', { x: r.x, y: r.y + 5, width: r.w, height: r.h, rx: 2, fill: `url(#${grad.shadow})`, opacity: 0.85 }));
    } else {
      g.appendChild(el('polygon', { points: geom.shadowPts, fill: `url(#${grad.shadow})`, opacity: isMine ? 0.9 : 0.85 }));
    }

    // Face (with round filter), wrapped in glow group if mine
    let faceParent = g;
    if (isMine) {
      const glow = el('g', { filter: 'url(#myGlow)' });
      g.appendChild(glow);
      faceParent = glow;
    }
    if (geom.rect) {
      const r = geom.rect;
      faceParent.appendChild(el('rect', { x: r.x, y: r.y, width: r.w, height: r.h, rx: 3, fill: `url(#${grad.face})`, filter: 'url(#round)' }));
    } else {
      faceParent.appendChild(el('polygon', { points: geom.facePts, fill: `url(#${grad.face})`, filter: 'url(#round)' }));
    }

    // Spot number
    const num = el('text', {
      x: geom.textX, y: geom.textY,
      'text-anchor': 'middle', 'dominant-baseline': 'middle',
      fill: v40TextFill(kind), 'font-size': '9', 'font-weight': '800', 'font-family': 'system-ui',
      'pointer-events': 'none',
    });
    num.textContent = label;
    g.appendChild(num);

    if (currentUser) {
      g.addEventListener('click', () => {
        const alreadySelected = svg.querySelector('.spot.selected') === g;
        svg.querySelectorAll('.spot.selected').forEach(x => x.classList.remove('selected'));
        if (alreadySelected) {
          closeBottomSheet();
        } else {
          g.classList.add('selected');
          openBottomSheet(spotData, label, users, currentUser, pendingSpotIds);
        }
      });
    }
    return g;
  }

  // ── Angled lane spots ──
  // rank 1 = bottom (spot 11 / spot 1), rank 10 = top (spot 20 / spot 10).
  // y0 = 456 - (rank-1)*34, shift = rank*2, y0_eff = y0 - shift.
  function laneGeom(rank, side) {
    const y0 = 456 - (rank - 1) * 34;
    const shift = rank * 2;
    const y = y0 - shift; // y0_eff
    if (side === 'left') {
      // TL(25,y) TR(95,y-67) BR(95,y-40) BL(25,y+27)
      const facePts = `25,${y} 95,${y - 67} 95,${y - 40} 25,${y + 27}`;
      const shadowPts = `25,${y + 5} 95,${y - 67 + 5} 95,${y - 40 + 5} 25,${y + 27 + 5}`;
      return { facePts, shadowPts, textX: 60, textY: y - 20 };
    }
    // right (mirror): TL(205,y-67) TR(275,y) BR(275,y+27) BL(205,y-40)
    const facePts = `205,${y - 67} 275,${y} 275,${y + 27} 205,${y - 40}`;
    const shadowPts = `205,${y - 67 + 5} 275,${y + 5} 275,${y + 27 + 5} 205,${y - 40 + 5}`;
    return { facePts, shadowPts, textX: 240, textY: y - 20 };
  }

  // Left lane: spots 20..11 (top to bottom). rank 10 = spot20, rank 1 = spot11.
  LEFT_SPOTS.forEach((label, i) => {
    const rank = 10 - i; // i=0 -> 20 -> rank 10 ; i=9 -> 11 -> rank 1
    svg.appendChild(makeSpotGroup(label, laneGeom(rank, 'left')));
  });
  // Right lane: spots 10..1 (top to bottom). rank 10 = spot10, rank 1 = spot1.
  RIGHT_SPOTS.forEach((label, i) => {
    const rank = 10 - i; // i=0 -> 10 -> rank 10 ; i=9 -> 1 -> rank 1
    svg.appendChild(makeSpotGroup(label, laneGeom(rank, 'right')));
  });

  // ── Bottom-row perpendicular spots (22 left, 21 right) ──
  svg.appendChild(makeSpotGroup('22', { rect: { x: 107, y: 423, w: 36, h: 67 }, textX: 125, textY: 456 }));
  svg.appendChild(makeSpotGroup('21', { rect: { x: 157, y: 423, w: 36, h: 67 }, textX: 175, textY: 456 }));

  // ── Corner triangle spots (B left, A right) ──
  svg.appendChild(makeSpotGroup('B', {
    facePts: '95,423 25,490 95,490',
    shadowPts: '95,428 25,495 95,495',
    textX: 72, textY: 468,
  }));
  svg.appendChild(makeSpotGroup('A', {
    facePts: '205,423 275,490 205,490',
    shadowPts: '205,428 275,495 205,495',
    textX: 228, textY: 468,
  }));
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

function openBottomSheet(spotData, label, users, currentUser, pendingSpotIds) {
  const sheet = document.getElementById('spot-sheet');
  const backdrop = document.getElementById('sheet-backdrop');
  const content = document.getElementById('sheet-content');
  if (!sheet || !content) return;

  // Keep #info-panel silently updated for E2E compat
  const panel = document.getElementById('info-panel');
  if (panel) { panel.innerHTML = ''; panel.classList.add('has-content'); }

  const renter = spotData.assignedUserId
    ? users.find(u => u.id === spotData.assignedUserId)
    : null;

  const isAdmin = currentUser.role === 'admin' || currentUser.role === 'master';
  const isMySpot = renter && renter.id === currentUser.id;

  // Status
  let statusClass = 'free', statusText = 'Free';
  if (spotData.reserved) { statusClass = 'reserved'; statusText = 'Reserved'; }
  else if (pendingSpotIds && pendingSpotIds.has(spotData.id)) { statusClass = 'pending'; statusText = 'Pending'; }
  else if (spotData.state === 'occupied') { statusClass = 'occupied'; statusText = 'Occupied'; }

  // Title line
  const titleEl = document.createElement('div');
  titleEl.className = 'sheet-title';
  titleEl.innerHTML = `Spot ${label}` +
    (isMySpot ? ' <span style="font-size:0.75rem;color:var(--accent)">★ Your spot</span>' : '') +
    `<span class="sheet-status ${statusClass}">${statusText}</span>`;

  // Meta line
  const metaEl = document.createElement('div');
  metaEl.className = 'sheet-meta';
  if (renter) {
    const name = isAdmin
      ? `${renter.name || ''} ${renter.lastName || ''}`.trim() || renter.username
      : (isMySpot ? 'Assigned to you' : 'Occupied');
    const plate = (renter.licensePlate || renter.username || '').toUpperCase();
    metaEl.textContent = `${name} · ${plate}`;
  } else if (spotData.reserved) {
    metaEl.textContent = 'External reservation — not available';
  } else {
    metaEl.textContent = 'No one assigned';
  }

  // Actions
  const actionsEl = document.createElement('div');
  actionsEl.className = 'sheet-actions';

  // Reserve — shown to resident if spot is free and they have no assignment yet
  const hasOwnSpot = typeof _users !== 'undefined' && _users
    ? (_users.find(u => u.id === currentUser.id)?.assignedSpots?.length > 0)
    : false;
  if (!isAdmin && spotData.state === 'free' && !spotData.reserved && !hasOwnSpot && !(pendingSpotIds && pendingSpotIds.has(spotData.id))) {
    const btn = document.createElement('button');
    btn.className = 'sheet-btn primary';
    btn.textContent = 'Reserve';
    btn.onclick = () => { closeBottomSheet(); toast('Reservation flow coming soon', 'info'); };
    actionsEl.appendChild(btn);
  }

  // Pay — shown if user is assigned to this spot
  if (isMySpot) {
    const btn = document.createElement('button');
    btn.className = 'sheet-btn secondary';
    btn.textContent = 'Pay';
    btn.onclick = () => { closeBottomSheet(); document.getElementById('my-payments-section')?.scrollIntoView({ behavior: 'smooth' }); };
    actionsEl.appendChild(btn);
  }

  // Report incident — always shown
  const reportBtn = document.createElement('button');
  reportBtn.className = 'sheet-btn warn';
  reportBtn.textContent = '⚠ Report';
  reportBtn.onclick = () => { closeBottomSheet(); window.location.href = `incident.html?spot=${spotData.id}`; };
  actionsEl.appendChild(reportBtn);

  // Admin-only: Release
  if (isAdmin && spotData.state === 'occupied' && spotData.assignedUserId) {
    const btn = document.createElement('button');
    btn.className = 'sheet-btn danger';
    btn.textContent = 'Release';
    btn.onclick = async () => {
      try {
        await unassignSpot(spotData.id);
        toast('Spot released', 'success');
        closeBottomSheet();
        refresh();
      } catch (err) { toast(err.message, 'error'); }
    };
    actionsEl.appendChild(btn);
  }

  // Admin-only: Assign
  if (isAdmin && !spotData.assignedUserId && !spotData.reserved) {
    const btn = document.createElement('button');
    btn.className = 'sheet-btn admin';
    btn.textContent = 'Assign';
    btn.onclick = () => { closeBottomSheet(); typeof showAssignModal === 'function' && showAssignModal(spotData.id); };
    actionsEl.appendChild(btn);
  }

  content.innerHTML = '';
  content.appendChild(titleEl);
  content.appendChild(metaEl);
  content.appendChild(actionsEl);

  sheet.classList.add('open');
  if (backdrop) backdrop.classList.add('open');
}

function closeBottomSheet() {
  const sheet = document.getElementById('spot-sheet');
  const backdrop = document.getElementById('sheet-backdrop');
  if (sheet) sheet.classList.remove('open');
  if (backdrop) backdrop.classList.remove('open');
  // Deselect any selected spot
  document.querySelectorAll('#parking-svg .spot.selected').forEach(el => el.classList.remove('selected'));
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
