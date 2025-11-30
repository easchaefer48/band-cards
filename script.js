// script.js — Band Achievements (CSV sheet -> grouped students -> spotlight zoom)
// Sheet and GID
const SHEET_ID = "1Rdi7AdcFcNd2hCbvqUkmkO-WVxi1qjVZ9jlu_G4JPm4";
let GID = "0";

// global holder for students list (used by filters)
let allStudents = [];

// --- Utilities ---
console.log("Band Cards script running...");

async function fetchSheetCSV(sheetId, gid = "0") {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Could not fetch sheet CSV: " + res.statusText);
  return await res.text();
}

function parseCSV(csvText) {
  const rows = csvText.split(/\r?\n/).filter(r => r.trim() !== "");
  return rows.map(row => {
    const cols = [];
    let cur = "", inQuotes = false;
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === '"' && row[i+1] === '"') { cur += '"'; i++; continue; }
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === ',' && !inQuotes) { cols.push(cur); cur = ""; continue; }
      cur += ch;
    }
    cols.push(cur);
    return cols.map(c => c.trim());
  });
}

function rowsToObjects(parsedRows) {
  const header = parsedRows[0].map(h => h.toLowerCase());
  return parsedRows.slice(1).map(r => {
    const obj = {};
    for (let i = 0; i < header.length; i++) obj[header[i]] = r[i] !== undefined ? r[i] : "";
    return obj;
  });
}

function cardNameToFilename(cardName) {
  if (!cardName) return "missing-card.png";
  const fname = cardName
    .toLowerCase()
    .replace(/[\/\\]/g, "_")
    .replace(/[^a-z0-9_\- ]+/g, "")
    .trim()
    .replace(/\s+/g, "_");
  return fname + ".png";
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, function(m) {
    return ({ '&': '&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[m];
  });
}

// --- Create student card DOM ---
function createStudentCardElem(student) {
  const div = document.createElement("div");
  // base class + optional glow class added below
  div.className = "student-card";

  // compute glow class by total
  if (student.total >= 200) div.classList.add("glow-blue");
  else if (student.total >= 150) div.classList.add("glow-gold");
  else if (student.total >= 100) div.classList.add("glow-silver");
  else if (student.total >= 50) div.classList.add("glow-bronze");

  // build cards
  const cardsHtml = student.cards.map(c => {
    const filename = cardNameToFilename(c.card);
    const src = `images/${filename}`;
    return `<img class="achievement-card" src="${src}" alt="${escapeHtml(c.card)}" title="${escapeHtml(c.card)}" onerror="this.src='images/missing-card.png'; this.style.opacity=0.9">`;
  }).join("");

  // Points element: label small + number big
  const pointsHtml = `
    <div class="points">
      <div class="label">Achievement Points</div>
      <div class="num">${Math.round(student.total)}</div>
    </div>
  `;

  div.innerHTML = `
    <div class="student-name">${escapeHtml(student.name)}</div>
    ${pointsHtml}
    <div class="cards-container">${cardsHtml}</div>
  `;

  return div;
}

// --- Render and attach handlers ---
function renderStudents(students) {
  const container = document.getElementById("student-container");
  container.innerHTML = "";
  students.forEach(student => container.appendChild(createStudentCardElem(student)));
  attachCardClickHandlers();
}

// Attach overlay/zoom handlers (spotlight mode)
function attachCardClickHandlers() {
  // prepare overlay element
  let overlay = document.getElementById('card-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'card-overlay';
    document.body.appendChild(overlay);
  }
  // ensure overlay has inner zoom image element
  if (!overlay.querySelector('.zoom-image')) {
    const img = document.createElement('img');
    img.className = 'zoom-image';
    overlay.appendChild(img);
  }
  const zoomImg = overlay.querySelector('.zoom-image');

  // helper functions
  function openOverlay(src, alt) {
    zoomImg.src = src;
    zoomImg.alt = alt || '';
    overlay.style.display = 'flex';
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('overlay-open');
    // tiny setTimeout to allow CSS transitions to show
    setTimeout(()=> zoomImg.classList.add('glow'), 20);
  }
  function closeOverlay() {
    zoomImg.classList.remove('glow');
    overlay.style.display = 'none';
    overlay.setAttribute('aria-hidden', 'true');
    zoomImg.src = '';
    document.body.classList.remove('overlay-open');
  }

  // attach click to each achievement-card - clone nodes to clear previous listeners
  document.querySelectorAll('.achievement-card').forEach(img => {
    const fresh = img.cloneNode(true);
    img.parentNode.replaceChild(fresh, img);
    fresh.addEventListener('click', (ev) => {
      ev.stopPropagation();
      // open overlay with full-size image
      // use absolute src (browser will resolve relative automatically)
      const src = fresh.src;
      const alt = fresh.getAttribute('alt') || fresh.getAttribute('title') || '';
      openOverlay(src, alt);
    });
  });

  // close overlay when clicking overlay background (not the image)
  overlay.addEventListener('click', (ev) => {
    // if clicked directly on overlay (or on the image) -> close
    if (ev.target === overlay || ev.target === zoomImg) closeOverlay();
  });

  // close on Escape key
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && overlay.style.display === 'flex') closeOverlay();
  });

  // also close when clicking anywhere outside (safety)
  document.addEventListener('click', (ev) => {
    if (overlay.style.display === 'flex' && !overlay.contains(ev.target)) closeOverlay();
  });
}

// --- Filters & sorting ---
function applyFilters() {
  const q = document.getElementById("searchBar")?.value?.toLowerCase() || "";
  const sort = document.getElementById("sortSelect")?.value || "points";
  let filtered = allStudents.filter(s => s.name.toLowerCase().includes(q));
  if (sort === "points") filtered.sort((a,b) => b.total - a.total);
  else if (sort === "name") filtered.sort((a,b) => a.name.localeCompare(b.name));
  else if (sort === "cards") filtered.sort((a,b) => b.cards.length - a.cards.length);
  renderStudents(filtered);
}
document.addEventListener("input", e => { if (e.target.id === "searchBar") applyFilters(); });
document.addEventListener("change", e => { if (e.target.id === "sortSelect") applyFilters(); });

// --- Main loader ---
async function loadAndRender() {
  try {
    const csv = await fetchSheetCSV(SHEET_ID, GID);
    const parsed = parseCSV(csv);
    if (parsed.length < 2) {
      document.getElementById("student-container").innerHTML = "<p>No data rows found in sheet.</p>";
      return;
    }
    const objs = rowsToObjects(parsed);

    const studentKey = Object.keys(objs[0]).find(k => k.includes("student")) || Object.keys(objs[0])[0];
    const cardKey = Object.keys(objs[0]).find(k => k.includes("card")) || Object.keys(objs[0])[1];
    const pointsKey = Object.keys(objs[0]).find(k => k.includes("point")) || Object.keys(objs[0])[2];

    const studentsMap = {};
    objs.forEach(row => {
      const studentName = row[studentKey] || "Unnamed";
      const cardName = row[cardKey] || "";
      const points = Number(row[pointsKey]) || 0;
      if (!studentsMap[studentName]) studentsMap[studentName] = { name: studentName, cards: [], total: 0 };
      studentsMap[studentName].cards.push({ card: cardName, points });
      studentsMap[studentName].total += points;
    });

    const studentsArr = Object.values(studentsMap).sort((a,b) => b.total - a.total);
    allStudents = studentsArr;
    applyFilters();
  } catch (err) {
    console.error("Error loading sheet:", err);
    document.getElementById("student-container").innerHTML = `<p style="color:crimson">Error loading sheet: ${escapeHtml(err.message)}</p>`;
  }
}

// start
loadAndRender();

