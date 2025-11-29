// script.js — Band Cards: fetch sheet as CSV, group by student, render leaderboard
// Assumptions:
// - Your sheet is public (Anyone with link -> Viewer).
// - Sheet with achievement rows is the first sheet (gid=0). If not, update GID below.
// - Header row must include: Student, Card, Points (Date optional).
// - Images live at /images/<filename>.png (simple mapping described below).

console.log("Band Cards script running...");

const SHEET_ID = "1Rdi7AdcFcNd2hCbvqUkmkO-WVxi1qjVZ9jlu_G4JPm4"; // Provided by you
let GID = "0"; // change if your data is on a different sheet tab (find gid in sheet URL)

// Utility: fetch CSV export of the sheet
async function fetchSheetCSV(sheetId, gid = "0") {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Could not fetch sheet CSV: " + res.statusText);
  return await res.text();
}

// Utility: simple CSV parser (handles basic CSV, not all edge cases)
function parseCSV(csvText) {
  const rows = csvText.split(/\r?\n/).filter(r => r.trim() !== "");
  return rows.map(row => {
    // split on commas that are not inside quotes
    const cols = [];
    let cur = "", inQuotes = false;
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === '"' && row[i+1] === '"') { cur += '"'; i++; continue; } // escaped quote
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === ',' && !inQuotes) { cols.push(cur); cur = ""; continue; }
      cur += ch;
    }
    cols.push(cur);
    return cols.map(c => c.trim());
  });
}

// Map row arrays to objects using header row
function rowsToObjects(parsedRows) {
  const header = parsedRows[0].map(h => h.toLowerCase());
  return parsedRows.slice(1).map(r => {
    const obj = {};
    for (let i = 0; i < header.length; i++) {
      obj[header[i]] = r[i] !== undefined ? r[i] : "";
    }
    return obj;
  });
}

// Convert a card name (e.g. "Concert Bb Scale") to an image filename
// Default rule: lowercase, replace spaces & slashes with underscores, remove punctuation, add .png
function cardNameToFilename(cardName) {
  if (!cardName) return "missing-card.png";
  const fname = cardName
    .toLowerCase()
    .replace(/[\/\\]/g, "_")
    .replace(/[^a-z0-9_\- ]+/g, "") // strip punctuation
    .trim()
    .replace(/\s+/g, "_");
  return fname + ".png"; // adjust to .jpg if your images are jpg
}

// Render functions
function createStudentCardElem(student) {
  const div = document.createElement("div");
  div.className = "student-card";

const cardsHtml = student.cards.map(c => {
  const filename = cardNameToFilename(c.card);
  const src = `images/${filename}`;
  return `<img class="achievement-card" src="${src}" alt="${escapeHtml(c.card)}" title="${escapeHtml(c.card)}" onerror="this.src='images/missing-card.png'; this.style.opacity=0.6">`;
}).join("");


  div.innerHTML = `
    <div class="student-name">${escapeHtml(student.name)}</div>
    <div class="points">Achievement Points: ${student.total}</div>
    <div class="cards-container">${cardsHtml}</div>    
  `;
  return div;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, function(m) {
    return ({ '&': '&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[m];
  });
}

function renderStudents(students) {
  const container = document.getElementById("student-container");
  container.innerHTML = "";
  students.forEach(student => {
    container.appendChild(createStudentCardElem(student));
  });

  attachCardClickHandlers(); // add listeners each time we render
}
function attachCardClickHandlers() {
  let currentlyExpanded = null;

  document.querySelectorAll('.achievement-card').forEach(img => {
    img.addEventListener('click', (event) => {
      event.stopPropagation(); // prevent click from immediately collapsing it

      // if clicking the already-expanded card → collapse
      if (currentlyExpanded === img) {
        img.classList.remove("expanded");
        currentlyExpanded = null;
        return;
      }

      // collapse previous card if needed
      if (currentlyExpanded) {
        currentlyExpanded.classList.remove("expanded");
      }

      // expand the clicked card
      img.classList.add("expanded");
      currentlyExpanded = img;
    });
  });

  // collapse card when clicking anywhere outside cards
  document.addEventListener('click', () => {
    if (currentlyExpanded) {
      currentlyExpanded.classList.remove("expanded");
      currentlyExpanded = null;
    }
  });
}


// Main logic
async function loadAndRender() {
  try {
    const csv = await fetchSheetCSV(SHEET_ID, GID);
    const parsed = parseCSV(csv);
    if (parsed.length < 2) {
      document.getElementById("student-container").innerHTML = "<p>No data rows found in sheet.</p>";
      return;
    }
    const objs = rowsToObjects(parsed);

    // Accept flexible header keys
    // look for possible keys for student/card/points
    const studentKey = Object.keys(objs[0]).find(k => k.includes("student")) || Object.keys(objs[0])[0];
    const cardKey = Object.keys(objs[0]).find(k => k.includes("card")) || Object.keys(objs[0])[1];
    const pointsKey = Object.keys(objs[0]).find(k => k.includes("point")) || Object.keys(objs[0])[2];

    // Group by student
    const studentsMap = {};
    objs.forEach(row => {
      const studentName = row[studentKey] || "Unnamed";
      const cardName = row[cardKey] || "";
      const points = Number(row[pointsKey]) || 0;

      if (!studentsMap[studentName]) {
        studentsMap[studentName] = { name: studentName, cards: [], total: 0 };
      }
      studentsMap[studentName].cards.push({ card: cardName, points });
      studentsMap[studentName].total += points;
    });

    // Turn into array & sort by total points descending
    const studentsArr = Object.values(studentsMap)
      .sort((a,b) => b.total - a.total);

    allStudents = studentsArr; // save original full list
applyFilters(); // render with search/sort


  } catch (err) {
    console.error("Error loading sheet:", err);
    document.getElementById("student-container").innerHTML = `<p style="color:crimson">Error loading sheet: ${escapeHtml(err.message)}</p>`;
  }
}
function applyFilters() {
  const q = document.getElementById("searchBar")?.value?.toLowerCase() || "";
  const sort = document.getElementById("sortSelect")?.value || "points";

  let filtered = allStudents.filter(s =>
    s.name.toLowerCase().includes(q)
  );

  if (sort === "points") {
    filtered.sort((a,b) => b.total - a.total);
  } else if (sort === "name") {
    filtered.sort((a,b) => a.name.localeCompare(b.name));
  } else if (sort === "cards") {
    filtered.sort((a,b) => b.cards.length - a.cards.length);
  }

  renderStudents(filtered);
}

// Event listeners for live filtering/sorting
document.addEventListener("input", e => {
  if (e.target.id === "searchBar") applyFilters();
});
document.addEventListener("change", e => {
  if (e.target.id === "sortSelect") applyFilters();
});


// Kick off
loadAndRender();
