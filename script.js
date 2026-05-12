const STORAGE_KEY = "gwa-calculator-subjects";

// Store subjects and track which row is being edited.
let subjects = loadSubjects();
let editingIndex = null;

const subjectForm = document.getElementById("subjectForm");
const calculateBtn = document.getElementById("calculateBtn");
const clearAllBtn = document.getElementById("clearAllBtn");
const confirmClearAllBtn = document.getElementById("confirmClearAllBtn");
const gwaResult = document.getElementById("gwaResult");
const formFeedback = document.getElementById("formFeedback");
const clearAllModalElement = document.getElementById("clearAllModal");
const clearAllModal = new bootstrap.Modal(clearAllModalElement);

renderAll();

subjectForm.onsubmit = function (e) {
  e.preventDefault();

  const subject = document.getElementById("subject").value.trim();
  const units = parseFloat(document.getElementById("units").value);
  const grade = parseFloat(document.getElementById("grade").value);

  const validationError = validateSubjectEntry(subject, units, grade);
  if (validationError) {
    setFormFeedback(validationError, "error");
    return;
  }

  subjects.push({ subject, units, grade });
  editingIndex = null;
  persistSubjects();
  renderAll();
  setFormFeedback(`Added ${subject} successfully.`, "success");
  this.reset();
};

calculateBtn.onclick = function () {
  renderResult();
};

clearAllBtn.onclick = function () {
  if (subjects.length === 0) {
    setFormFeedback("There are no saved subjects to clear.", "error");
    return;
  }

  clearAllModal.show();
};

confirmClearAllBtn.onclick = function () {
  subjects = [];
  editingIndex = null;
  persistSubjects();
  renderAll();
  clearAllModal.hide();
  setFormFeedback("All subjects were cleared.", "success");
};

function renderAll() {
  renderTable();
  updateSummary();
  updateStats();
  renderResult();
}

function renderTable() {
  const tbody = document.getElementById("subjectsTable");

  if (subjects.length === 0) {
    tbody.innerHTML = `
      <tr class="empty-row">
        <td colspan="4">No subjects added yet. Start with your first class above.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = subjects
    .map((subjectItem, index) =>
      index === editingIndex
        ? getEditableRow(subjectItem, index)
        : getDisplayRow(subjectItem, index),
    )
    .join("");
}

function getDisplayRow(subjectItem, index) {
  return `
    <tr>
      <td>
        <div class="subject-cell">
          <span class="subject-name">${escapeHtml(subjectItem.subject)}</span>
          <span class="subject-meta">Course entry</span>
        </div>
      </td>
      <td>
        <span class="table-chip">${formatNumber(subjectItem.units)} unit${
          Number(subjectItem.units) === 1 ? "" : "s"
        }</span>
      </td>
      <td>
        <span class="grade-badge">${formatNumber(subjectItem.grade)}</span>
      </td>
      <td class="action-cell">
        <div class="table-actions">
          <button
            class="btn btn-outline-secondary btn-sm btn-row-action"
            onclick="startEdit(${index})"
            title="Edit"
            aria-label="Edit"
          >
            <i class="bi bi-pencil"></i>
          </button>
          <button
            class="btn btn-outline-danger btn-sm btn-row-action"
            onclick="removeSubject(${index})"
            title="Remove"
            aria-label="Remove"
          >
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </td>
    </tr>
  `;
}

function getEditableRow(subjectItem, index) {
  return `
    <tr class="editing-row">
      <td>
        <div class="edit-field">
          <span class="edit-label">Subject</span>
          <input
            type="text"
            class="form-control form-control-sm"
            id="edit-subject-${index}"
            value="${escapeAttribute(subjectItem.subject)}"
          />
        </div>
      </td>
      <td>
        <div class="edit-field edit-field-compact">
          <span class="edit-label">Units</span>
          <input
            type="number"
            class="form-control form-control-sm text-center"
            id="edit-units-${index}"
            min="1"
            value="${subjectItem.units}"
          />
        </div>
      </td>
      <td>
        <div class="edit-field edit-field-compact">
          <span class="edit-label">Grade</span>
          <input
            type="number"
            class="form-control form-control-sm text-center"
            id="edit-grade-${index}"
            min="1"
            max="5"
            step="0.01"
            value="${subjectItem.grade}"
          />
        </div>
      </td>
      <td class="action-cell">
        <div class="table-actions">
          <button
            class="btn btn-csu btn-sm btn-row-save"
            onclick="saveEdit(${index})"
            title="Save"
            aria-label="Save"
          >
            <i class="bi bi-check-lg"></i>
          </button>
          <button
            class="btn btn-outline-secondary btn-sm btn-row-action"
            onclick="cancelEdit()"
            title="Cancel"
            aria-label="Cancel"
          >
            <i class="bi bi-x-lg"></i>
          </button>
        </div>
      </td>
    </tr>
  `;
}

function updateSummary() {
  const subjectCount = document.getElementById("subjectCount");
  const unitCount = document.getElementById("unitCount");
  const totalUnits = subjects.reduce(
    (sum, s) => sum + (Number(s.units) || 0),
    0,
  );

  subjectCount.textContent = `${subjects.length} subject${
    subjects.length === 1 ? "" : "s"
  }`;
  unitCount.textContent = `${formatNumber(totalUnits)} unit${
    totalUnits === 1 ? "" : "s"
  }`;
}

function updateStats() {
  const statSubjects = document.getElementById("statSubjects");
  const statUnits = document.getElementById("statUnits");
  const statBest = document.getElementById("statBest");
  const statWorst = document.getElementById("statWorst");

  statSubjects.textContent = subjects.length.toString();
  statUnits.textContent = formatNumber(
    subjects.reduce((sum, subjectItem) => sum + subjectItem.units, 0),
  );

  if (subjects.length === 0) {
    statBest.textContent = "--";
    statWorst.textContent = "--";
    return;
  }

  const grades = subjects.map((subjectItem) => subjectItem.grade);
  statBest.textContent = formatNumber(Math.min(...grades));
  statWorst.textContent = formatNumber(Math.max(...grades));
}

function renderResult() {
  if (subjects.length === 0) {
    gwaResult.innerHTML = `
      <span class="result-kicker">Current status</span>
      <strong class="result-value">Awaiting entries</strong>
      <span class="result-message">Add at least one subject to generate your weighted average.</span>
    `;
    return;
  }

  const totalUnits = subjects.reduce((sum, s) => sum + s.units, 0);
  const totalWeighted = subjects.reduce((sum, s) => sum + s.units * s.grade, 0);
  const gwa = totalWeighted / totalUnits;
  const evaluation = getStanding(gwa);

  gwaResult.innerHTML = `
    <span class="result-kicker">Computed GWA</span>
    <strong class="result-value">${gwa.toFixed(2)}</strong>
    <span class="result-message"><strong>${evaluation.label}.</strong> ${evaluation.detail}</span>
  `;
}

function getStanding(gwa) {
  if (gwa >= 1 && gwa <= 1.25) {
    return {
      label: "President's Lister",
      detail: "Excellent work. You qualify for President's Lister recognition.",
    };
  }

  if (gwa > 1.25 && gwa <= 1.5) {
    return {
      label: "Vice President's Lister",
      detail:
        "Strong performance. You qualify for Vice President's Lister recognition.",
    };
  }

  if (gwa > 1.5 && gwa <= 1.75) {
    return {
      label: "Dean's Lister",
      detail: "Great job. You qualify for Dean's Lister recognition.",
    };
  }

  if (gwa > 1.75 && gwa <= 3) {
    return {
      label: "Passed",
      detail:
        "You passed this set of subjects. Keep pushing for an even better average.",
    };
  }

  if (gwa > 3 && gwa < 4) {
    return {
      label: "For review",
      detail:
        "This result is above the usual passing range. Double-check your entries and academic standing rules.",
    };
  }

  return {
    label: "Needs attention",
    detail:
      "This result needs improvement. Review the entered grades and plan your next move.",
  };
}

function startEdit(index) {
  editingIndex = index;
  renderTable();
}

function saveEdit(index) {
  const subject = document.getElementById(`edit-subject-${index}`).value.trim();
  const units = parseFloat(
    document.getElementById(`edit-units-${index}`).value,
  );
  const grade = parseFloat(
    document.getElementById(`edit-grade-${index}`).value,
  );

  const validationError = validateSubjectEntry(subject, units, grade);
  if (validationError) {
    setFormFeedback(validationError, "error");
    return;
  }

  subjects[index] = { subject, units, grade };
  editingIndex = null;
  persistSubjects();
  renderAll();
  setFormFeedback(`Updated ${subject}.`, "success");
}

function cancelEdit() {
  editingIndex = null;
  renderTable();
}

function removeSubject(index) {
  const removedSubject = subjects[index]?.subject || "Subject";
  subjects.splice(index, 1);
  if (editingIndex === index) {
    editingIndex = null;
  } else if (editingIndex !== null && editingIndex > index) {
    editingIndex -= 1;
  }
  persistSubjects();
  renderAll();
  setFormFeedback(`Removed ${removedSubject}.`, "success");
}

function validateSubjectEntry(subject, units, grade) {
  if (!subject) {
    return "Please enter a subject name.";
  }

  if (Number.isNaN(units) || units <= 0) {
    return "Units must be greater than 0.";
  }

  if (Number.isNaN(grade) || grade < 1 || grade > 5) {
    return "Grade must be between 1.00 and 5.00.";
  }

  return "";
}

function setFormFeedback(message, type) {
  formFeedback.textContent = message;
  formFeedback.className = `form-feedback form-feedback-${type}`;
}

function persistSubjects() {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(subjects));
}

function loadSubjects() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return [];
    }

    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (item) =>
        item &&
        typeof item.subject === "string" &&
        Number.isFinite(item.units) &&
        Number.isFinite(item.grade),
    );
  } catch {
    return [];
  }
}

function formatNumber(value) {
  return Number.isInteger(value) ? value.toString() : value.toFixed(2);
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

window.startEdit = startEdit;
window.saveEdit = saveEdit;
window.cancelEdit = cancelEdit;
window.removeSubject = removeSubject;
