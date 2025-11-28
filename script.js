console.log("Band Cards site loaded!");

// Placeholder student data — will load from Google Sheet soon
const students = [
  { name: "Student Example", points: 15, cards: ["sample-card.png"] }
];

function renderStudents() {
  const container = document.getElementById("student-container");
  container.innerHTML = "";

  students.forEach(student => {
    const cardDiv = document.createElement("div");
    cardDiv.className = "student-card";

    cardDiv.innerHTML = `
      <div class="student-name">${student.name}</div>
      <div class="cards-container">
        ${student.cards.map(c => `<img src="images/${c}">`).join("")}
      </div>
      <div class="points">Points: ${student.points}</div>
    `;

    container.appendChild(cardDiv);
  });
}

renderStudents();
