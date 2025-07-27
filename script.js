// Array to store subjects
let subjects = [];

// Handle form submit
document.getElementById("subjectForm").onsubmit = function (e) {
  e.preventDefault();
  const subject = document.getElementById("subject").value.trim();
  const units = parseFloat(document.getElementById("units").value);
  const grade = parseFloat(document.getElementById("grade").value);

  // Add to array
  subjects.push({ subject, units, grade });

  // Update table
  renderTable();

  // Reset form
  this.reset();
};

// Render table rows
function renderTable() {
  const tbody = document.getElementById("subjectsTable");
  tbody.innerHTML = "";
  subjects.forEach((s, i) => {
    tbody.innerHTML += `
      <tr>
        <td>
          <input type="text" class="form-control form-control-sm text-center" value="${s.subject}" 
            onchange="updateSubject(${i}, 'subject', this.value)" />
        </td>
        <td>
          <input type="number" class="form-control form-control-sm text-center" min="1" value="${s.units}" 
            onchange="updateSubject(${i}, 'units', this.value)" />
        </td>
        <td>
          <input type="number" class="form-control form-control-sm text-center" min="1" max="5" step="0.01" value="${s.grade}" 
            onchange="updateSubject(${i}, 'grade', this.value)" />
        </td>
        <td>
          <button class="btn btn-outline-danger btn-sm rounded-circle d-flex align-items-center justify-content-center mx-auto" onclick="removeSubject(${i})" title="Remove" aria-label="Remove">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      </tr>
    `;
  });
}

// Add this function to handle updates
function updateSubject(index, key, value) {
  if (key === "units" || key === "grade") {
    value = parseFloat(value);
  }
  subjects[index][key] = value;
  renderTable();
}

// Remove subject
function removeSubject(index) {
  subjects.splice(index, 1);
  renderTable();
}

// Make removeSubject globally accessible
window.removeSubject = removeSubject;

// Calculate GWA when button is clicked
document.getElementById("calculateBtn").onclick = function () {
  if (subjects.length === 0) {
    document.getElementById("gwaResult").innerHTML = "No subjects added.";
    return;
  }
  let totalUnits = 0;
  let totalWeighted = 0;
  subjects.forEach((s) => {
    totalUnits += s.units;
    totalWeighted += s.units * s.grade;
  });
  const gwa = totalWeighted / totalUnits;
  let message = `Your GWA is: ${gwa.toFixed(2)}`;

  if (gwa >= 1.0 && gwa <= 1.25) {
    message +=
      " 🎉<br><span class='text-success'>Congratulations! You are qualified as a President Lister.</span>";
  } else if (gwa > 1.25 && gwa <= 1.5) {
    message +=
      " 🎉<br><span class='text-success'>Congratulations! You are qualified as a Vice President Lister.</span>";
  } else if (gwa > 1.5 && gwa <= 1.75) {
    message +=
      " 🎉<br><span class='text-success'>Congratulations! You are qualified as a Dean Lister.</span>";
  } else if (gwa >= 2.0 && gwa <= 3.0) {
    message +=
      " 🎉<br><span class='text-primary'>Congratulations, you passed!</span>";
  } else if (gwa >= 4.0 && gwa <= 5.0) {
    message +=
      " 😭<br><span class='text-danger'>ARAY KO, SEE YOU NEXT LIFE!</span>";
  }

  document.getElementById("gwaResult").innerHTML = message;
};
