const labels = {
  checkout: 'Waiting checkout', assigned: 'Assigned', cleaning: 'Cleaning', inspection: 'Inspection', ready: 'Ready', occupied: 'Occupied', blocked: 'Blocked',
};
const nextStatus = { checkout: 'assigned', assigned: 'cleaning', cleaning: 'inspection', inspection: 'ready' };
const actionLabel = { checkout: 'Assign room', assigned: 'Start cleaning', cleaning: 'Send to inspection', inspection: 'Mark ready' };
const checkNames = ['Bedroom reset', 'Bathroom sanitized', 'Fresh linen and towels', 'Amenities restocked', 'Floor and balcony checked'];
const staff = ['Alicia', 'Sharlene', 'Denise', 'Keisha', 'Milagros', 'Roxanne'];
const guestNames = ['Van Dijk', 'Martinez', 'Williams', 'De Boer', 'Johnson', 'Croes', 'Bakker', 'Smith', 'Pieters', 'Ramirez'];
const roomTypes = ['King studio', 'Pool suite', 'Two-bedroom villa', 'Garden studio'];
const storageKey = 'paradise-room-operations-demo-v3';

function roomNumber(index) { return Math.floor(index / 20) * 100 + 101 + (index % 20); }
function defaultChecks(status) {
  if (status === 'inspection' || status === 'ready') return [1, 1, 1, 1, 1];
  if (status === 'cleaning') return [1, 1, 0, 0, 0];
  return [0, 0, 0, 0, 0];
}

function makeRooms() {
  const special = {
    119: { status: 'blocked', assignee: 'Sharlene', issue: 'Balcony door does not lock', arrival: '13:30', checks: [1, 1, 1, 0, 0] },
    205: { status: 'cleaning', assignee: 'Alicia', guest: 'Williams', arrival: '15:00', checks: [1, 1, 0, 0, 0] },
    211: { status: 'inspection', assignee: 'Alicia', guest: 'De Boer', arrival: '15:00', checks: [1, 1, 1, 1, 1] },
    217: { status: 'assigned', assignee: 'Alicia', guest: 'Martinez', arrival: '13:30', checks: [0, 0, 0, 0, 0] },
  };
  return Array.from({ length: 80 }, (_, index) => {
    const turnover = index < 52;
    const id = roomNumber(index);
    const cycle = ['checkout', 'assigned', 'cleaning', 'cleaning', 'inspection', 'ready', 'ready'];
    let status = turnover ? cycle[index % cycle.length] : 'occupied';
    let issue;
    if ([18, 37, 47].includes(index)) {
      status = 'blocked';
      issue = index === 18 ? 'Balcony door does not lock' : index === 37 ? 'Air-conditioning not cooling' : 'Bathroom drain is slow';
    }
    const priority = index % 17 === 0 ? 'VIP' : index % 9 === 0 ? 'Early' : 'Standard';
    const room = {
      id, turnover, type: roomTypes[index % roomTypes.length],
      zone: index < 20 ? 'Courtyard' : index < 40 ? 'Palm wing' : index < 60 ? 'Pool wing' : 'Garden villas',
      guest: guestNames[index % guestNames.length],
      checkout: turnover ? `${10 + (index % 3)}:${index % 2 ? '30' : '00'}` : '—',
      arrival: turnover ? (priority === 'Early' ? '13:30' : priority === 'VIP' ? '14:00' : `${15 + (index % 2)}:00`) : 'In house',
      assignee: turnover && status !== 'checkout' ? staff[index % staff.length] : 'Unassigned',
      status, priority, issue, checks: defaultChecks(status),
    };
    return { ...room, ...(special[id] || {}) };
  });
}

const $ = (query) => document.querySelector(query);
const $$ = (query) => [...document.querySelectorAll(query)];
let rooms = makeRooms();
let role = 'housekeeping';
let view = 'housekeeping';
let identity = 'Alicia';
let eventStep = 0;
let roomSearch = '';
let statusFilter = 'all';

try {
  const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
  if (Array.isArray(saved?.rooms) && saved.rooms.length === 80) rooms = saved.rooms;
  if (Number.isInteger(saved?.eventStep)) eventStep = saved.eventStep;
} catch { rooms = makeRooms(); }

function saveState() {
  try { localStorage.setItem(storageKey, JSON.stringify({ rooms, eventStep })); } catch {}
}

function setRole(next) {
  role = next;
  $$('.role-option').forEach((button) => {
    const active = button.dataset.role === next;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  const select = $('#identity');
  select.innerHTML = (next === 'housekeeping' ? staff : ['Front Desk 1', 'Front Desk 2']).map((name) => `<option>${name}</option>`).join('');
  identity = select.value;
  $('#identity-label').textContent = next === 'housekeeping' ? 'Staff member' : 'Station';
  $('#pin').value = next === 'housekeeping' ? '0420' : '1052';
  $('.login-form .primary-button').textContent = `Open ${next === 'housekeeping' ? 'housekeeping' : 'front desk'}`;
}

function login(nextRole, nextIdentity) {
  role = nextRole; identity = nextIdentity; view = role === 'manager' ? 'control' : role;
  $('#login').hidden = true; $('#app').hidden = false;
  $('#user-name').textContent = identity;
  $('#user-role').textContent = role === 'manager' ? 'Supervisor' : role === 'frontdesk' ? 'Front desk' : 'Housekeeping';
  $('#user-initials').textContent = role === 'manager' ? 'OP' : role === 'frontdesk' ? 'FD' : identity.slice(0, 2).toUpperCase();
  $('.demo-controls').hidden = role !== 'manager';
  $$('[data-view]').forEach((button) => {
    button.hidden = (role === 'housekeeping' && button.dataset.view !== 'housekeeping') || (role === 'frontdesk' && button.dataset.view !== 'frontdesk');
  });
  setNotice(role === 'manager' ? 'Supervisor overview opened.' : role === 'frontdesk' ? 'Room-release board loaded.' : `${identity}'s assigned rooms loaded.`);
  render();
}

function turnoverRooms() { return rooms.filter((room) => room.turnover); }
function statusPill(status) { return `<span class="status ${status}">${labels[status]}</span>`; }
function counts() {
  return turnoverRooms().reduce((all, room) => { all[room.status] = (all[room.status] || 0) + 1; return all; }, {});
}
function roomRow(room) {
  return `<button class="room-row" data-room="${room.id}"><strong>${room.id}</strong><span>${room.type}</span><small>${room.assignee}</small>${statusPill(room.status)}<b>${room.arrival}</b><i aria-hidden="true">→</i></button>`;
}

function metrics() {
  const values = counts();
  const items = [['WAITING', 'checkout'], ['ASSIGNED', 'assigned'], ['CLEANING', 'cleaning'], ['INSPECTION', 'inspection'], ['BLOCKED', 'blocked'], ['READY', 'ready']];
  return `<div class="metric-row">${items.map(([label, status]) => `<div class="metric metric-${status}"><span>${label}</span><strong>${values[status] || 0}</strong></div>`).join('')}</div>`;
}

function renderControl() {
  const list = turnoverRooms().filter((room) => {
    const matchesSearch = `${room.id} ${room.guest} ${room.assignee}`.toLowerCase().includes(roomSearch.toLowerCase().trim());
    return matchesSearch && (statusFilter === 'all' || room.status === statusFilter);
  });
  const options = ['checkout', 'assigned', 'cleaning', 'inspection', 'blocked', 'ready'].map((status) => `<option value="${status}" ${statusFilter === status ? 'selected' : ''}>${labels[status]}</option>`).join('');
  return `${metrics()}<section class="panel"><div class="panel-head control-head"><div><h2>All departures</h2><small>${list.length} of 52 rooms shown</small></div><div class="control-filters"><label><span class="sr-only">Search room, guest or staff member</span><input id="room-search" value="${roomSearch}" placeholder="Search room or guest" /></label><label><span class="sr-only">Filter by status</span><select id="status-filter"><option value="all">All statuses</option>${options}</select></label></div></div><div class="room-list">${list.length ? list.map(roomRow).join('') : '<p class="empty">No rooms match this filter.</p>'}</div></section>`;
}

function renderHousekeeping() {
  const assigned = turnoverRooms().filter((room) => room.assignee === identity && room.status !== 'ready').sort((a, b) => a.arrival.localeCompare(b.arrival));
  const completed = turnoverRooms().filter((room) => room.assignee === identity && room.status === 'ready').length;
  return `<div class="route-summary"><div><span>ACTIVE ROUTE</span><strong>${assigned.length}</strong><small>rooms remaining</small></div><div><span>COMPLETED</span><strong>${completed}</strong><small>rooms released</small></div><div><span>NEXT ARRIVAL</span><strong>${assigned[0]?.arrival || '—'}</strong><small>${assigned[0] ? `room ${assigned[0].id}` : 'route complete'}</small></div></div><section class="panel"><div class="panel-head"><h2>Next rooms</h2><small>Tap a room to update its checklist</small></div><div class="room-list">${assigned.length ? assigned.map(roomRow).join('') : '<p class="empty">No rooms remaining on this route.</p>'}</div></section>`;
}

function renderFrontdesk() {
  const ready = turnoverRooms().filter((room) => room.status === 'ready');
  const waiting = turnoverRooms().filter((room) => room.status !== 'ready').sort((a, b) => a.arrival.localeCompare(b.arrival));
  return `${metrics()}<div class="frontdesk-grid"><section class="panel column"><div class="panel-head"><h2>Ready to release</h2><small>${ready.length} rooms</small></div>${ready.map(roomRow).join('')}</section><section class="panel column"><div class="panel-head"><h2>Still in process</h2><small>${waiting.length} rooms</small></div>${waiting.map(roomRow).join('')}</section></div>`;
}

function bindWorkspaceEvents() {
  $$('[data-room]').forEach((button) => button.addEventListener('click', () => openRoom(Number(button.dataset.room))));
  $('#room-search')?.addEventListener('input', (event) => { roomSearch = event.target.value; render(); $('#room-search')?.focus(); });
  $('#status-filter')?.addEventListener('change', (event) => { statusFilter = event.target.value; render(); });
}

function render() {
  const titles = {
    control: ['MASTER VIEW', 'Housekeeping control', '52 departures, live assignments and open maintenance issues'],
    housekeeping: ['STAFF VIEW', `${identity}'s route`, 'Assigned rooms ordered by arrival time and priority'],
    frontdesk: ['ARRIVAL VIEW', 'Arrivals and room release', 'Rooms appear here as soon as housekeeping releases them'],
  };
  const [kicker, title, description] = titles[view];
  $('#view-kicker').textContent = kicker; $('#view-title').textContent = title; $('#view-description').textContent = description;
  $$('[data-view]').forEach((button) => button.classList.toggle('active', button.dataset.view === view));
  $('#workspace-content').innerHTML = view === 'control' ? renderControl() : view === 'housekeeping' ? renderHousekeeping() : renderFrontdesk();
  const values = counts(); const ready = values.ready || 0; const blocked = values.blocked || 0;
  $('#ready-side').textContent = ready; $('#blocked-side').textContent = blocked; $('#issue-badge').textContent = blocked;
  $('#ready-progress').style.width = `${(ready / 52) * 100}%`;
  bindWorkspaceEvents();
}

function openRoom(id) {
  const room = rooms.find((item) => item.id === id); if (!room) return;
  const editable = role === 'manager' || (role === 'housekeeping' && room.assignee === identity);
  const canAdvance = editable && room.status !== 'blocked' && !['ready', 'occupied'].includes(room.status);
  const assignment = role === 'manager' ? `<select id="assignee-select"><option>Unassigned</option>${staff.map((name) => `<option ${room.assignee === name ? 'selected' : ''}>${name}</option>`).join('')}</select>` : `<strong>${room.assignee}</strong>`;
  $('#room-detail').innerHTML = `<header class="detail-head"><span>ROOM</span><h2>${room.id}</h2><p>${room.type} · ${room.zone}</p>${statusPill(room.status)}</header><div class="detail-body"><div class="detail-meta"><div><span>GUEST</span><strong>${room.guest}</strong></div><div><span>ARRIVAL</span><strong>${room.arrival}</strong></div><div><span>ASSIGNED</span>${assignment}</div></div>${room.issue ? `<p class="notice"><b>BLOCKED</b><span>${room.issue}</span></p>` : ''}<div class="checklist">${checkNames.map((name, index) => `<label><input type="checkbox" data-check="${index}" ${room.checks[index] ? 'checked' : ''} ${editable ? '' : 'disabled'} /><span>${name}</span></label>`).join('')}</div><div class="detail-actions">${canAdvance ? `<button class="primary-button" id="advance-room" type="button">${actionLabel[room.status]}</button>` : ''}${editable && room.status === 'blocked' ? '<button class="primary-button" id="resolve-room" type="button">Repair complete · inspect room</button>' : ''}${editable && !['blocked', 'ready', 'occupied'].includes(room.status) ? '<button class="secondary-button" id="block-room" type="button">Report maintenance issue</button>' : ''}</div>${!editable ? '<p class="brand-note">This workspace can review the room, but only the assigned housekeeper or supervisor can change it.</p>' : ''}</div>`;
  $$('[data-check]').forEach((input) => input.addEventListener('change', () => { room.checks[Number(input.dataset.check)] = input.checked ? 1 : 0; saveState(); }));
  $('#assignee-select')?.addEventListener('change', (event) => { room.assignee = event.target.value; if (room.status === 'checkout' && room.assignee !== 'Unassigned') room.status = 'assigned'; setNotice(`Room ${room.id} assigned to ${room.assignee}.`); saveState(); render(); });
  $('#advance-room')?.addEventListener('click', () => advanceRoom(room));
  $('#block-room')?.addEventListener('click', () => blockRoom(room));
  $('#resolve-room')?.addEventListener('click', () => resolveRoom(room));
  $('#room-dialog').showModal();
}

function advanceRoom(room) {
  if (room.status === 'inspection' && !room.checks.every(Boolean)) { setNotice(`Complete every checklist item before releasing room ${room.id}.`); return; }
  room.status = nextStatus[room.status] || room.status;
  if (room.status === 'assigned' && room.assignee === 'Unassigned') room.assignee = role === 'housekeeping' ? identity : 'Alicia';
  setNotice(room.status === 'ready' ? `Room ${room.id} is ready. Front desk notified.` : `Room ${room.id} changed to ${labels[room.status].toLowerCase()}.`);
  saveState(); $('#room-dialog').close(); render();
}
function blockRoom(room) {
  room.status = 'blocked'; room.issue = 'Air-conditioning is not cooling'; setNotice(`Room ${room.id} blocked. Engineering notified.`);
  saveState(); $('#room-dialog').close(); render();
}
function resolveRoom(room) {
  room.status = 'inspection'; room.issue = undefined; setNotice(`Room ${room.id} repair complete. Inspection requested.`);
  saveState(); $('#room-dialog').close(); render();
}
function setNotice(text) { $('#notice-text').textContent = text; }

function nextEvent() {
  const steps = [
    () => { const room = rooms.find((item) => item.id === 217); room.status = 'cleaning'; setNotice('Alicia started cleaning room 217.'); },
    () => { const room = rooms.find((item) => item.id === 205); room.status = 'blocked'; room.issue = 'Air-conditioning is not cooling'; setNotice('Room 205 blocked. Engineering notified.'); },
    () => { const room = rooms.find((item) => item.id === 205); room.status = 'inspection'; room.issue = undefined; room.checks = [1, 1, 1, 1, 1]; setNotice('Room 205 repair complete. Inspection requested.'); },
    () => { const room = rooms.find((item) => item.id === 211); room.status = 'ready'; setNotice('Room 211 is ready. Front desk notified.'); },
  ];
  const nextLabels = ['Report an A/C issue', 'Engineering resolves room 205', 'Release room 211', 'Start room 217'];
  steps[eventStep % steps.length](); eventStep = (eventStep + 1) % steps.length;
  $('#next-event').textContent = nextLabels[eventStep]; saveState(); render();
}

$$('.role-option').forEach((button) => button.addEventListener('click', () => setRole(button.dataset.role)));
$('#identity').addEventListener('change', (event) => { identity = event.target.value; });
$('#login-form').addEventListener('submit', (event) => { event.preventDefault(); login(role, $('#identity').value); });
$('#supervisor-login').addEventListener('click', () => login('manager', 'Manager'));
$('#switch-role').addEventListener('click', () => { $('#app').hidden = true; $('#login').hidden = false; setRole('housekeeping'); });
$$('[data-view]').forEach((button) => button.addEventListener('click', () => { view = button.dataset.view; render(); }));
$('#reset').addEventListener('click', () => {
  rooms = makeRooms(); eventStep = 0; roomSearch = ''; statusFilter = 'all'; localStorage.removeItem(storageKey);
  $('#next-event').textContent = 'Start room 217'; setNotice('Demonstration reset to the start of the shift.'); render();
});
$('#next-event').addEventListener('click', nextEvent);
setRole('housekeeping');
