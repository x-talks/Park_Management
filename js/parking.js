// js/parking.js
// Renders the SVG parking layout and handles spot interactions.
// Uses SVG DOM API exclusively — no innerHTML.

const LEFT_SPOTS  = ['20','19','18','17','16','15','14','13','12','11','B'];
const RIGHT_SPOTS = ['10','9','8','7','6','5','4','3','2','1','A','21','22'];

const SPOT_W = 56;
const SPOT_H = 24;

function spotId(label) {
  return label === 'A' ? 'sA' : label === 'B' ? 'sB' : `s${label}`;
}

function buildSVG(spots, users, currentUser) {
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.getElementById('parking-svg');
  // Remove all children safely
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  const LANE_LEFT  = 250;
  const LANE_RIGHT = 350;
  const START_Y    = 40;
  const STEP_Y     = 38;
  const ANGLE      = 45;

  // Draw lane background first
  const lane = document.createElementNS(svgNS, 'rect');
  lane.setAttribute('x', LANE_LEFT);
  lane.setAttribute('y', 0);
  lane.setAttribute('width', LANE_RIGHT - LANE_LEFT);
  lane.setAttribute('height', 500);
  lane.setAttribute('fill', '#f8f8f8');
  lane.setAttribute('stroke', '#ccc');
  lane.setAttribute('stroke-width', '1');
  svg.appendChild(lane);

  function makeSpot(label, cx, cy, angle) {
    const sid = spotId(label);
    const spotData = spots.find(s => s.id === sid) || { state: 'free', assignedUserId: null };

    const g = document.createElementNS(svgNS, 'g');
    g.setAttribute('class', `spot ${spotData.state}`);
    g.setAttribute('data-id', sid);
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
    text.textContent = label; // textContent is safe — no HTML

    g.appendChild(rect);
    g.appendChild(text);

    if (currentUser) {
      g.addEventListener('click', () => showSpotInfo(spotData, label, users, currentUser));
    }

    return g;
  }

  LEFT_SPOTS.forEach((label, i) => {
    const cy = START_Y + i * STEP_Y;
    const cx = LANE_LEFT - SPOT_W / 2 - 2;
    svg.appendChild(makeSpot(label, cx, cy, -ANGLE));
  });

  RIGHT_SPOTS.forEach((label, i) => {
    const cy = START_Y + i * STEP_Y;
    const cx = LANE_RIGHT + SPOT_W / 2 + 2;
    svg.appendChild(makeSpot(label, cx, cy, ANGLE));
  });
}

function showSpotInfo(spotData, label, users, currentUser) {
  const panel = document.getElementById('info-panel');
  // Clear panel safely
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
    // admin or master: build info panel via DOM, not innerHTML
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
