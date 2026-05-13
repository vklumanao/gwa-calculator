const STORAGE_KEY = "gwa-calculator-subjects";
const NAME_STORAGE_KEY = "gwa-calculator-full-name";

// Store subjects and track which row is being edited.
let subjects = loadSubjects();
let editingIndex = null;
let fullName = loadFullName();

const subjectForm = document.getElementById("subjectForm");
const calculateBtn = document.getElementById("calculateBtn");
const exportPdfBtn = document.getElementById("exportPdfBtn");
const exportCertificateBtn = document.getElementById("exportCertificateBtn");
const clearAllBtn = document.getElementById("clearAllBtn");
const confirmClearAllBtn = document.getElementById("confirmClearAllBtn");
const gwaResult = document.getElementById("gwaResult");
const formFeedback = document.getElementById("formFeedback");
const storageStatus = document.getElementById("storageStatus");
const clearAllModalElement = document.getElementById("clearAllModal");
const clearAllModal = new bootstrap.Modal(clearAllModalElement);
const certificatePreviewModalElement = document.getElementById(
  "certificatePreviewModal",
);
const certificatePreviewModal = new bootstrap.Modal(
  certificatePreviewModalElement,
);
const certificatePreviewImage = document.getElementById(
  "certificatePreviewImage",
);
const downloadCertificateBtn = document.getElementById(
  "downloadCertificateBtn",
);
const fullNameInput = document.getElementById("fullName");
const subjectInput = document.getElementById("subject");
const unitsInput = document.getElementById("units");
const gradeInput = document.getElementById("grade");
let certificateImageDataUrl = "";

fullNameInput.value = fullName;
renderAll();
setStorageStatus(
  subjects.length
    ? `Restored ${subjects.length} saved subject${
        subjects.length === 1 ? "" : "s"
      } from this browser.`
    : "Entries save only in this browser on this device.",
);

fullNameInput.addEventListener("input", function () {
  fullName = normalizeFullName(this.value);
  persistFullName();
});

subjectForm.onsubmit = function (e) {
  e.preventDefault();

  const subject = subjectInput.value.trim();
  const units = parseFloat(unitsInput.value);
  const grade = parseFloat(gradeInput.value);

  const validationError = validateSubjectEntry(
    {
      subject,
      units,
      grade,
    },
    {
      subjectInput,
      unitsInput,
      gradeInput,
    },
  );
  if (validationError) {
    setFormFeedback(validationError, "error");
    return;
  }

  subjects.push({ subject, units, grade });
  editingIndex = null;
  persistSubjects();
  renderAll();
  setFormFeedback(`Added ${subject} successfully.`, "success");
  setStorageStatus(
    `Saved ${subjects.length} subject${
      subjects.length === 1 ? "" : "s"
    } in this browser.`,
  );
  trackAnalytics("add_subject", {
    units,
    grade,
  });
  this.reset();
  resetInputState();
  subjectInput.focus();
};

calculateBtn.onclick = function () {
  renderResult();
  if (subjects.length > 0) {
    const gwa = calculateGwa();
    setStorageStatus(
      `Latest computed GWA: ${gwa.toFixed(2)} across ${subjects.length} subject${
        subjects.length === 1 ? "" : "s"
      }.`,
    );
    trackAnalytics("calculate_gwa", {
      subjectCount: subjects.length,
      gwa: Number(gwa.toFixed(2)),
    });
  }
};

exportPdfBtn.onclick = function () {
  if (subjects.length === 0) {
    setFormFeedback(
      "Add at least one subject before exporting a PDF.",
      "error",
    );
    return;
  }

  const printWindow = window.open("", "_blank", "width=960,height=720");
  if (!printWindow) {
    setFormFeedback(
      "Your browser blocked the export window. Please allow pop-ups and try again.",
      "error",
    );
    return;
  }

  const reportMarkup = buildPdfReportMarkup();
  printWindow.document.open();
  printWindow.document.write(reportMarkup);
  printWindow.document.close();
  setFormFeedback("PDF report is ready in the print dialog.", "success");
  setStorageStatus(
    `Prepared a printable report for ${subjects.length} subject${
      subjects.length === 1 ? "" : "s"
    }.`,
  );
  trackAnalytics("export_pdf", {
    subjectCount: subjects.length,
    gwa: Number(calculateGwa().toFixed(2)),
  });
};

exportCertificateBtn.onclick = function () {
  if (subjects.length === 0) {
    setFormFeedback(
      "Add at least one subject before generating a certificate image.",
      "error",
    );
    return;
  }

  certificateImageDataUrl = buildCertificateImageDataUrl();
  certificatePreviewImage.src = certificateImageDataUrl;
  certificatePreviewModal.show();
  setFormFeedback("Certificate preview is ready.", "success");
  setStorageStatus(
    `Prepared a certificate image for ${subjects.length} subject${
      subjects.length === 1 ? "" : "s"
    }.`,
  );
  trackAnalytics("export_certificate", {
    subjectCount: subjects.length,
    gwa: Number(calculateGwa().toFixed(2)),
  });
};

downloadCertificateBtn.onclick = function () {
  if (!certificateImageDataUrl) {
    setFormFeedback("Generate the certificate preview first.", "error");
    return;
  }

  downloadDataUrl(certificateImageDataUrl, getCertificateFileName());
  setFormFeedback("Certificate image downloaded successfully.", "success");
};

clearAllBtn.onclick = function () {
  if (subjects.length === 0) {
    setFormFeedback("There are no saved subjects to clear.", "error");
    return;
  }

  clearAllModal.show();
};

confirmClearAllBtn.onclick = function () {
  const removedCount = subjects.length;
  subjects = [];
  editingIndex = null;
  persistSubjects();
  renderAll();
  clearAllModal.hide();
  setFormFeedback("All subjects were cleared.", "success");
  setStorageStatus("Saved entries were removed from this browser.");
  trackAnalytics("clear_all", {
    subjectCount: removedCount,
  });
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

  const gwa = calculateGwa();
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

  const validationError = validateSubjectEntry(
    {
      subject,
      units,
      grade,
    },
    {
      subjectInput: document.getElementById(`edit-subject-${index}`),
      unitsInput: document.getElementById(`edit-units-${index}`),
      gradeInput: document.getElementById(`edit-grade-${index}`),
    },
  );
  if (validationError) {
    setFormFeedback(validationError, "error");
    return;
  }

  subjects[index] = { subject, units, grade };
  editingIndex = null;
  persistSubjects();
  renderAll();
  setFormFeedback(`Updated ${subject}.`, "success");
  setStorageStatus(
    `Changes saved. ${subjects.length} subject${
      subjects.length === 1 ? "" : "s"
    } stored in this browser.`,
  );
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
  setStorageStatus(
    subjects.length
      ? `Saved list updated. ${subjects.length} subject${
          subjects.length === 1 ? "" : "s"
        } remain in this browser.`
      : "No saved subjects remain in this browser.",
  );
}

function validateSubjectEntry(
  { subject, units, grade },
  { subjectInput, unitsInput, gradeInput },
) {
  resetInputState(subjectInput, unitsInput, gradeInput);

  if (!subject) {
    setFieldError(subjectInput, "Please enter a subject name.");
    return "Please enter a subject name.";
  }

  if (Number.isNaN(units) || units <= 0) {
    setFieldError(unitsInput, "Units must be greater than 0.");
    return "Units must be greater than 0.";
  }

  if (Number.isNaN(grade) || grade < 1 || grade > 5) {
    setFieldError(gradeInput, "Grade must be between 1.00 and 5.00.");
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

function persistFullName() {
  if (!fullName) {
    window.localStorage.removeItem(NAME_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(NAME_STORAGE_KEY, fullName);
}

function loadFullName() {
  const savedName = window.localStorage.getItem(NAME_STORAGE_KEY);
  return normalizeFullName(savedName || "");
}

function formatNumber(value) {
  return Number.isInteger(value) ? value.toString() : value.toFixed(2);
}

function normalizeFullName(value) {
  return value.replace(/\s+/g, " ").trim();
}

function calculateGwa() {
  const totalUnits = subjects.reduce((sum, s) => sum + s.units, 0);
  const totalWeighted = subjects.reduce((sum, s) => sum + s.units * s.grade, 0);
  return totalWeighted / totalUnits;
}

function resetInputState(...inputs) {
  inputs.forEach((input) => {
    input.setCustomValidity("");
    input.removeAttribute("aria-invalid");
  });
}

function setFieldError(input, message) {
  input.setCustomValidity(message);
  input.setAttribute("aria-invalid", "true");
  input.reportValidity();
}

function setStorageStatus(message) {
  storageStatus.textContent = message;
}

function trackAnalytics(name, data) {
  if (typeof window.va !== "function") {
    return;
  }

  window.va("event", {
    name,
    data,
  });
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

function buildPdfReportMarkup() {
  const gwa = calculateGwa();
  const evaluation = getStanding(gwa);
  const totalUnits = subjects.reduce((sum, subject) => sum + subject.units, 0);
  const totalWeighted = subjects.reduce(
    (sum, subject) => sum + subject.units * subject.grade,
    0,
  );
  const generatedAt = new Date().toLocaleString("en-PH", {
    dateStyle: "long",
    timeStyle: "short",
  });
  const generatedDate = new Date().toLocaleDateString("en-PH", {
    dateStyle: "long",
  });
  const recipientName = fullName || "The Recorded Student";
  const subjectChunks = chunkSubjectsForPdf(subjects, 12);
  const standingToneClass = getStandingToneClass(gwa);
  const detailPages = subjectChunks
    .map((chunk, pageIndex) => {
      const rows = chunk
        .map(
          (subject, index) => `
            <tr>
              <td>${pageIndex * 12 + index + 1}</td>
              <td>${escapeHtml(subject.subject)}</td>
              <td>${formatNumber(subject.units)}</td>
              <td>${formatNumber(subject.grade)}</td>
              <td>${formatNumber(subject.units * subject.grade)}</td>
            </tr>
          `,
        )
        .join("");
      const chunkWeighted = chunk.reduce(
        (sum, subject) => sum + subject.units * subject.grade,
        0,
      );
      const pageTitle =
        pageIndex === 0
          ? "Attached Subject Breakdown"
          : `Attached Subject Breakdown (Page ${pageIndex + 1})`;
      const pageLead =
        pageIndex === 0
          ? "A detailed record of the subjects, grades, units, and weighted values used to compute the certified GWA."
          : "Continuation of the subject-by-subject breakdown used in the certificate summary.";
      const summaryBlock =
        pageIndex === 0
          ? `
            <section class="summary-grid detail-summary-grid">
              <div class="summary-card">
                <span class="summary-label">Subjects</span>
                <span class="summary-value">${subjects.length}</span>
              </div>
              <div class="summary-card">
                <span class="summary-label">Total Units</span>
                <span class="summary-value">${formatNumber(totalUnits)}</span>
              </div>
              <div class="summary-card">
                <span class="summary-label">Computed GWA</span>
                <span class="summary-value">${gwa.toFixed(2)}</span>
              </div>
              <div class="summary-card">
                <span class="summary-label">Standing</span>
                <span class="summary-value">${escapeHtml(evaluation.label)}</span>
              </div>
            </section>
          `
          : `
            <div class="table-page-note">
              <span class="table-page-count">Rows ${pageIndex * 12 + 1}-${pageIndex * 12 + chunk.length}</span>
              <span>Page ${pageIndex + 1} of ${subjectChunks.length}</span>
            </div>
          `;

      return `
        <section class="report-page detail-page">
          <header class="report-header detail-header">
            <div>
              <div class="brand-mark brand-mark-left">
                <span class="brand-badge">G</span>
                <p class="eyebrow">GWA Genie</p>
              </div>
              <h2 class="details-page-title">${pageTitle}</h2>
              <p class="lead">${pageLead}</p>
            </div>
            <p class="meta">
              Generated on<br />
              <strong>${escapeHtml(generatedAt)}</strong>
            </p>
          </header>

          ${summaryBlock}

          <section class="report-table-shell">
            <div class="report-table-bar">
              <span>Recorded Subjects</span>
              <span>Weighted Value on This Page: ${formatNumber(chunkWeighted)}</span>
            </div>
            <table aria-label="Subject summary table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Subject</th>
                  <th>Units</th>
                  <th>Grade</th>
                  <th>Weighted Value</th>
                </tr>
              </thead>
              <tbody>
                ${rows}
              </tbody>
            </table>
          </section>
        </section>
      `;
    })
    .join("");

  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>GWA Genie Report</title>
        <style>
          @page {
            size: portrait;
            margin: 10mm;
          }

          :root {
            color-scheme: light;
          }

          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;
            font-family: "Poppins", "Segoe UI", Arial, sans-serif;
            color: #183126;
            background:
              linear-gradient(135deg, #fff4bc 0%, #f8f3dc 52%, #dff2df 100%);
          }

          .report {
            max-width: 1320px;
            margin: 0 auto;
            padding: 18px 14px 24px;
          }

          .report-page {
            background: #ffffff;
            border: 3px solid #183126;
            border-radius: 24px;
            padding: 20px;
            box-shadow: 12px 12px 0 #183126;
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .report-page + .report-page {
            margin-top: 28px;
          }

          .certificate-page {
            position: relative;
            overflow: hidden;
            min-height: 0;
            padding: 18px;
            background:
              radial-gradient(circle at top left, #ffe37a 0, transparent 28%),
              radial-gradient(circle at bottom right, #d8f0dd 0, transparent 24%),
              linear-gradient(180deg, #fffdf4 0%, #fff8da 52%, #f7f4e6 100%);
          }

          .certificate-frame {
            border: 3px solid #183126;
            border-radius: 24px;
            min-height: 0;
            padding: 20px 20px 16px;
            background:
              linear-gradient(180deg, rgba(255, 250, 230, 0.98), rgba(252, 255, 247, 0.98));
            display: grid;
            gap: 14px;
          }

          .certificate-frame::before {
            content: "";
            position: absolute;
            inset: 8px;
            border: 1px dashed rgba(24, 49, 38, 0.28);
            border-radius: 28px;
            pointer-events: none;
          }

          .brand-mark {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            margin-bottom: 8px;
          }

          .brand-mark-left {
            justify-content: flex-start;
          }

          .brand-badge {
            width: 38px;
            height: 38px;
            border-radius: 14px;
            display: grid;
            place-items: center;
            background: linear-gradient(180deg, #ffe37a 0%, #ffd700 100%);
            border: 2px solid #183126;
            color: #004225;
            font-size: 18px;
            box-shadow: 3px 3px 0 #183126;
          }

          .certificate-header {
            display: grid;
            grid-template-columns: 1fr;
            justify-items: center;
            text-align: center;
            gap: 8px;
            margin-bottom: 0;
            border: 2px solid #183126;
            border-radius: 18px;
            background:
              linear-gradient(180deg, rgba(255, 241, 184, 0.42), rgba(255, 255, 255, 0.96) 42%, rgba(216, 240, 221, 0.48));
            padding: 14px 16px 12px;
          }

          .eyebrow {
            margin: 0;
            color: #00693e;
            text-transform: uppercase;
            letter-spacing: 0.12em;
            font-size: 10px;
            font-weight: 700;
          }

          .certificate-title {
            margin: 0;
            font-family: Georgia, "Times New Roman", serif;
            font-size: 32px;
            line-height: 1.02;
            letter-spacing: -0.02em;
            text-align: center;
            color: #0e2b1d;
          }

          .lead,
          .meta,
          .note {
            margin: 0;
            color: #51645c;
            line-height: 1.6;
          }

          .certificate-intro {
            margin: 0;
            text-align: center;
            font-size: 12px;
            line-height: 1.35;
            max-width: 580px;
          }

          .certificate-recipient {
            display: grid;
            justify-items: center;
            gap: 4px;
            padding: 8px 10px 10px;
            border: 2px dashed rgba(24, 49, 38, 0.22);
            border-radius: 18px;
            background: rgba(255, 255, 255, 0.82);
          }

          .certificate-recipient-label {
            color: #00693e;
            text-transform: uppercase;
            letter-spacing: 0.12em;
            font-size: 10px;
            font-weight: 700;
          }

          .certificate-recipient-name {
            margin: 0;
            font-family: Georgia, "Times New Roman", serif;
            font-size: 28px;
            line-height: 1.05;
            letter-spacing: -0.01em;
            color: #0e2b1d;
            text-align: center;
          }

          .certificate-body {
            display: grid;
            grid-template-columns: 1fr;
            gap: 12px;
            align-items: stretch;
            margin-bottom: 0;
          }

          .certificate-side {
            display: grid;
            grid-template-columns: 1fr;
            gap: 10px;
          }

          .certificate-main,
          .certificate-card {
            border: 2px solid #183126;
            border-radius: 18px;
            background: #ffffff;
            padding: 10px 12px;
          }

          .certificate-main {
            display: grid;
            grid-template-columns: 1fr;
            justify-items: center;
            text-align: center;
            gap: 10px;
            box-shadow: 6px 6px 0 #183126;
            background:
              linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(247, 252, 242, 0.98));
            padding: 16px 16px 14px;
          }

          .certificate-score {
            text-align: center;
            border-right: none;
          }

          .certificate-copy {
            text-align: center;
            max-width: 520px;
          }

          .certificate-copy h2 {
            margin: 0 0 4px;
            font-family: Georgia, "Times New Roman", serif;
            font-size: 22px;
            line-height: 1.05;
            color: #004225;
          }

          .certificate-label {
            display: block;
            margin-bottom: 4px;
            color: #00693e;
            text-transform: uppercase;
            letter-spacing: 0.12em;
            font-size: 10px;
            font-weight: 700;
          }

          .certificate-gwa {
            display: block;
            margin-bottom: 4px;
            font-family: Georgia, "Times New Roman", serif;
            font-size: 72px;
            line-height: 0.9;
            color: #004225;
            text-shadow: 0 1px 0 rgba(255, 255, 255, 0.8);
          }

          .certificate-standing {
            display: inline-block;
            margin-bottom: 6px;
            padding: 7px 14px;
            border: 2px solid #183126;
            border-radius: 999px;
            background: linear-gradient(180deg, #fff4c7 0%, #ffe37a 100%);
            font-weight: 700;
            font-size: 11px;
            box-shadow: 2px 2px 0 #183126;
          }

          .certificate-card {
            background:
              linear-gradient(180deg, rgba(255, 248, 220, 0.96), rgba(255, 255, 255, 0.98));
          }

          .certificate-detail {
            max-width: none;
            margin: 0;
            font-size: 12px;
            line-height: 1.35;
          }

          .meta {
            text-align: right;
            font-size: 14px;
          }

          .certificate-panel-title {
            display: block;
            margin-bottom: 4px;
            color: #00693e;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            font-size: 10px;
            font-weight: 700;
          }

          .certificate-panel-copy {
            margin: 0;
            color: #385047;
            line-height: 1.2;
            font-size: 10px;
          }

          .certificate-summary {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 8px;
            margin-top: 10px;
          }

          .certificate-metric {
            padding-top: 6px;
            border-top: 1px solid rgba(24, 49, 38, 0.12);
          }

          .certificate-card-value {
            display: block;
            margin-top: 2px;
            font-size: 18px;
            font-weight: 700;
            color: #004225;
          }

          .certificate-footer {
            margin-top: 0;
            padding-top: 10px;
            border-top: 1px dashed rgba(24, 49, 38, 0.2);
            text-align: center;
            font-size: 10px;
            line-height: 1.2;
            color: #51645c;
          }

          .details-page-title {
            margin: 0 0 10px;
            font-family: Georgia, "Times New Roman", serif;
            font-size: 34px;
            line-height: 1.1;
            letter-spacing: -0.02em;
          }

          .report-header {
            display: flex;
            justify-content: space-between;
            gap: 20px;
            align-items: flex-start;
            margin-bottom: 16px;
            padding-bottom: 14px;
            border-bottom: 2px dashed rgba(24, 49, 38, 0.22);
          }

          .detail-header {
            margin-bottom: 12px;
            padding-bottom: 12px;
          }

          .summary-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
            margin-bottom: 14px;
          }

          .detail-summary-grid {
            margin-bottom: 10px;
          }

          .summary-card {
            border: 2px solid #183126;
            border-radius: 18px;
            padding: 12px 14px;
            background: #fff9d7;
            box-shadow: 4px 4px 0 #183126;
          }

          .summary-label {
            display: block;
            margin-bottom: 6px;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: #00693e;
          }

          .summary-value {
            display: block;
            font-size: 20px;
            font-weight: 700;
            color: #004225;
          }

          .report-table-shell {
            border: 3px solid #183126;
            border-radius: 20px;
            overflow: hidden;
            margin-bottom: 12px;
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .report-table-bar {
            display: flex;
            justify-content: space-between;
            gap: 16px;
            padding: 10px 14px;
            background: #ffe37a;
            border-bottom: 3px solid #183126;
            font-size: 12px;
            color: #004225;
            font-weight: 600;
          }

          .table-page-note {
            display: flex;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 10px;
            color: #51645c;
            font-size: 11px;
            font-weight: 600;
          }

          .table-page-count {
            color: #00693e;
            text-transform: uppercase;
            letter-spacing: 0.08em;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            margin: 0;
            background: #ffffff;
          }

          th,
          td {
            border: 1px solid rgba(24, 49, 38, 0.14);
            padding: 7px 9px;
            text-align: left;
            font-size: 12px;
          }

          th {
            background: #d8f0dd;
            color: #004225;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }

          td:nth-child(1),
          td:nth-child(3),
          td:nth-child(4),
          td:nth-child(5) {
            text-align: center;
          }

          tbody tr:nth-child(even) {
            background: #fffcf1;
          }

          .report-footer {
            display: flex;
            justify-content: space-between;
            gap: 16px;
            margin-top: 10px;
            padding-top: 10px;
            border-top: 1px dashed rgba(24, 49, 38, 0.2);
          }

          .note {
            font-size: 11px;
          }

          @media print {
            body {
              background: #ffffff;
            }

            .report {
              max-width: none;
              padding: 0;
            }

            .report-page {
              border: none;
              border-radius: 0;
              padding: 0;
              box-shadow: none;
              width: 100%;
              min-height: auto;
              height: auto;
              overflow: visible;
              break-after: page;
              page-break-after: always;
            }

            .report-page + .report-page {
              margin-top: 0;
            }

            .certificate-page {
              min-height: auto;
              background: #ffffff;
              padding: 0;
            }

            .certificate-frame {
              min-height: auto;
              padding: 16px 18px;
            }

            .certificate-frame::before {
              inset: 6px;
            }

            .summary-card,
            .certificate-main {
              box-shadow: none;
            }
          }

          @media (max-width: 1120px) {
            .certificate-page {
              min-height: auto;
              padding: 24px;
            }

            .certificate-frame {
              padding: 24px 18px;
            }

            .certificate-title {
              font-size: 30px;
            }

            .certificate-gwa {
              font-size: 52px;
            }

            .certificate-body,
            .certificate-summary,
            .report-header {
              display: grid;
              grid-template-columns: 1fr;
            }

            .meta {
              text-align: left;
            }

            .summary-grid,
            .detail-summary-grid {
              grid-template-columns: 1fr;
            }

            .table-page-note,
            .report-table-bar,
            .report-footer {
              display: grid;
              grid-template-columns: 1fr;
            }
          }
        </style>
      </head>
      <body>
        <main class="report">
          <section class="report-page certificate-page">
            <div class="certificate-frame">
              <header class="certificate-header">
                <div class="brand-mark">
                  <span class="brand-badge">G</span>
                  <p class="eyebrow">GWA Genie</p>
                </div>
                <div>
                  <h1 class="certificate-title">Certificate of Computed General Weighted Average</h1>
                  <p class="certificate-intro lead">
                    This certifies the computed General Weighted Average based on the
                    subject entries recorded in GWA Genie.
                  </p>
                </div>
                <p class="eyebrow">Issued ${escapeHtml(generatedDate)}</p>
              </header>
              <section class="certificate-recipient">
                <span class="certificate-recipient-label">Presented To</span>
                <h2 class="certificate-recipient-name">${escapeHtml(recipientName)}</h2>
              </section>

              <section class="certificate-body">
                <div class="certificate-main">
                  <div class="certificate-score">
                    <span class="certificate-label">Certified Computed GWA</span>
                    <strong class="certificate-gwa">${gwa.toFixed(2)}</strong>
                    <span class="certificate-standing">${escapeHtml(evaluation.label)}</span>
                  </div>
                  <div class="certificate-copy">
                    <h2>Academic Standing Summary</h2>
                    <p class="certificate-detail lead">
                      ${escapeHtml(evaluation.detail)}
                    </p>
                  </div>
                </div>
                <div class="certificate-side">
                  <div class="certificate-card">
                    <span class="certificate-panel-title">Certificate Scope</span>
                    <p class="certificate-panel-copy">
                      This certificate reflects the weighted average generated from
                      the currently recorded semester entries and is supported by
                      the attached subject breakdown.
                    </p>
                    <section class="certificate-summary">
                      <div class="certificate-metric">
                        <span class="summary-label">Subjects</span>
                        <span class="certificate-card-value">${subjects.length}</span>
                      </div>
                      <div class="certificate-metric">
                        <span class="summary-label">Units</span>
                        <span class="certificate-card-value">${formatNumber(totalUnits)}</span>
                      </div>
                      <div class="certificate-metric">
                        <span class="summary-label">Standing</span>
                        <span class="certificate-card-value">${escapeHtml(evaluation.label)}</span>
                      </div>
                    </section>
                  </div>
                </div>
              </section>
            </div>
          </section>
          ${detailPages}
        </main>
        <script>
          window.addEventListener("load", () => {
            window.print();
          });

          window.addEventListener("afterprint", () => {
            window.close();
          });
        </script>
      </body>
    </html>
  `;
}

function buildCertificateImageDataUrl() {
  const canvas = document.createElement("canvas");
  const width = 1600;
  const height = 1120;
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  const gwa = calculateGwa();
  const evaluation = getStanding(gwa);
  const totalUnits = subjects.reduce((sum, subject) => sum + subject.units, 0);
  const generatedDate = new Date().toLocaleDateString("en-PH", {
    dateStyle: "long",
  });
  const recipientName = fullName || "The Recorded Student";
  const subjectCount = subjects.length;

  context.fillStyle = "#f1ead2";
  context.fillRect(0, 0, width, height);

  const paperGradient = context.createLinearGradient(0, 0, width, height);
  paperGradient.addColorStop(0, "#fff6cf");
  paperGradient.addColorStop(0.45, "#fffdf5");
  paperGradient.addColorStop(1, "#f0ecd8");
  context.fillStyle = paperGradient;
  context.fillRect(40, 40, width - 80, height - 80);

  drawCertificateGlow(context, width, height);

  context.strokeStyle = "#183126";
  context.lineWidth = 8;
  context.strokeRect(40, 40, width - 80, height - 80);
  context.lineWidth = 2;
  context.strokeRect(72, 72, width - 144, height - 144);

  drawCertificateSeal(context, width / 2, 138, 32);
  drawTopDivider(context, width);

  context.textAlign = "center";
  context.fillStyle = "#00693e";
  context.font = "700 17px Poppins";
  context.fillText("GWA GENIE ACADEMIC ARCHIVE", width / 2, 195);
  context.fillStyle = "#7a6a2b";
  context.font = "600 15px Poppins";
  context.fillText("Personal Academic Summary Certificate", width / 2, 223);
  context.fillStyle = "#004225";
  context.font = "700 62px Lora, Georgia, serif";
  context.fillText("Certificate of Academic Standing", width / 2, 300);

  context.fillStyle = "#52655d";
  context.font = "500 22px Poppins";
  wrapCanvasText(
    context,
    "This certifies that the student named below has a computed general weighted average based on the recorded subjects in this session.",
    width / 2,
    358,
    920,
    30,
  );

  drawNamePlate(context, width / 2 - 430, 408, 860, 118, recipientName);
  drawCenterBadge(context, width / 2, 614, gwa, evaluation.label);

  const cards = [
    { label: "Computed GWA", value: gwa.toFixed(2) },
    { label: "Academic Standing", value: evaluation.label },
    { label: "Subjects Counted", value: `${subjectCount}` },
    { label: "Total Units", value: formatNumber(totalUnits) },
  ];

  const cardWidth = 266;
  const cardHeight = 150;
  const cardGap = 24;
  const cardsTotalWidth =
    cardWidth * cards.length + cardGap * (cards.length - 1);
  let cardX = (width - cardsTotalWidth) / 2;

  cards.forEach((card, index) => {
    const y = 736;
    const accentColor = index % 2 === 0 ? "#fff6cb" : "#e8f4ea";
    drawRoundedPanel(context, cardX, y, cardWidth, cardHeight, 22, "#ffffff");
    context.save();
    context.fillStyle = accentColor;
    context.beginPath();
    roundedRectPath(context, cardX + 12, y + 12, cardWidth - 24, 42, 14);
    context.fill();
    context.restore();

    context.strokeStyle = "#183126";
    context.lineWidth = 3;
    context.beginPath();
    roundedRectPath(context, cardX, y, cardWidth, cardHeight, 22);
    context.stroke();

    context.fillStyle = "#004225";
    context.font = "700 17px Poppins";
    context.fillText(card.label, cardX + cardWidth / 2, y + 39);

    context.fillStyle = "#004225";
    context.font =
      card.label === "Academic Standing"
        ? "700 24px Lora, Georgia, serif"
        : "700 32px Lora, Georgia, serif";
    wrapCanvasText(
      context,
      card.value,
      cardX + cardWidth / 2,
      y + 84,
      cardWidth - 38,
      30,
    );

    context.fillStyle = "#7b857f";
    context.font = "600 15px Poppins";
    context.fillText(
      "Based on current entries",
      cardX + cardWidth / 2,
      y + 126,
    );

    cardX += cardWidth + cardGap;
  });

  drawRibbonPanel(context, 200, 918, width - 400, 94);
  return canvas.toDataURL("image/png");
}

function drawCertificateGlow(context, width, height) {
  context.save();
  const glow = context.createRadialGradient(
    width / 2,
    320,
    140,
    width / 2,
    320,
    620,
  );
  glow.addColorStop(0, "rgba(255, 255, 255, 0.92)");
  glow.addColorStop(0.5, "rgba(255, 249, 214, 0.24)");
  glow.addColorStop(1, "rgba(255, 255, 255, 0)");
  context.fillStyle = glow;
  context.fillRect(100, 100, width - 200, height - 200);
  context.restore();
}

function drawTopDivider(context, width) {
  context.save();
  context.strokeStyle = "#b39a38";
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(width / 2 - 150, 176);
  context.lineTo(width / 2 + 150, 176);
  context.stroke();

  context.fillStyle = "#b39a38";
  for (let x = width / 2 - 138; x <= width / 2 + 138; x += 69) {
    context.beginPath();
    context.moveTo(x, 176);
    context.lineTo(x + 7, 169);
    context.lineTo(x + 14, 176);
    context.lineTo(x + 7, 183);
    context.closePath();
    context.fill();
  }
  context.restore();
}

function drawCertificateSeal(context, x, y, radius = 48) {
  context.save();
  context.fillStyle = "#00693e";
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = "#ffd700";
  context.lineWidth = Math.max(5, radius * 0.16);
  context.beginPath();
  context.arc(x, y, radius - 9, 0, Math.PI * 2);
  context.stroke();

  context.fillStyle = "#ffd700";
  context.font = `700 ${Math.round(radius * 0.9)}px Poppins`;
  context.textAlign = "center";
  context.fillText("G", x, y + radius * 0.28);
  context.restore();
}

function drawNamePlate(context, x, y, width, height, recipientName) {
  context.save();
  const plateGradient = context.createLinearGradient(x, y, x, y + height);
  plateGradient.addColorStop(0, "#fffdfa");
  plateGradient.addColorStop(1, "#f8f0c7");
  drawRoundedPanel(context, x, y, width, height, 24, plateGradient);

  context.strokeStyle = "#183126";
  context.lineWidth = 2.5;
  context.beginPath();
  roundedRectPath(context, x, y, width, height, 24);
  context.stroke();

  context.fillStyle = "#183126";
  context.font = "700 48px Lora, Georgia, serif";
  wrapCanvasText(
    context,
    recipientName,
    x + width / 2,
    y + 60,
    width - 110,
    44,
  );

  context.strokeStyle = "#183126";
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(x + 110, y + height - 24);
  context.lineTo(x + width - 110, y + height - 24);
  context.stroke();

  context.fillStyle = "#6c7b73";
  context.font = "600 14px Poppins";
  context.fillText("Student Name", x + width / 2, y + height - 4);
  context.restore();
}

function drawCenterBadge(context, centerX, centerY, gwa, standingLabel) {
  context.save();
  context.translate(centerX, centerY);

  context.fillStyle = "#00693e";
  context.beginPath();
  context.arc(0, 0, 76, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = "#ffd700";
  context.lineWidth = 8;
  context.beginPath();
  context.arc(0, 0, 65, 0, Math.PI * 2);
  context.stroke();

  context.strokeStyle = "#fff6c7";
  context.lineWidth = 2;
  context.beginPath();
  context.arc(0, 0, 54, 0, Math.PI * 2);
  context.stroke();

  context.fillStyle = "#ffd700";
  context.font = "700 15px Poppins";
  context.textAlign = "center";
  context.fillText("COMPUTED GWA", 0, -10);
  context.fillStyle = "#ffffff";
  context.font = "700 40px Lora, Georgia, serif";
  context.fillText(gwa.toFixed(2), 0, 26);

  context.restore();

  context.save();
  drawRibbonTag(context, centerX - 120, centerY + 92, 240, 34, standingLabel);
  context.restore();
}

function drawRibbonTag(context, x, y, width, height, label) {
  context.save();
  context.fillStyle = "#fff9e2";
  context.beginPath();
  context.moveTo(x + 16, y);
  context.lineTo(x + width - 16, y);
  context.lineTo(x + width, y + height / 2);
  context.lineTo(x + width - 16, y + height);
  context.lineTo(x + 16, y + height);
  context.lineTo(x, y + height / 2);
  context.closePath();
  context.fill();
  context.strokeStyle = "#183126";
  context.lineWidth = 2;
  context.stroke();

  context.fillStyle = "#004225";
  context.textAlign = "center";
  context.font = "700 14px Poppins";
  context.fillText(label.toUpperCase(), x + width / 2, y + 22);
  context.restore();
}

function drawRoundedPanel(context, x, y, width, height, radius, fillStyle) {
  context.save();
  context.fillStyle = fillStyle;
  context.beginPath();
  roundedRectPath(context, x, y, width, height, radius);
  context.fill();
  context.restore();
}

function drawRibbonPanel(context, x, y, width, height) {
  context.save();
  context.fillStyle = "#fff8d6";
  context.beginPath();
  roundedRectPath(context, x, y, width, height, 20);
  context.fill();
  context.strokeStyle = "#183126";
  context.lineWidth = 2;
  context.stroke();
  context.restore();
}

function drawFooterSignature(context, x, baselineY, generatedDate) {
  context.save();
  context.textAlign = "left";
  context.strokeStyle = "#183126";
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(x, baselineY - 22);
  context.lineTo(x + 250, baselineY - 22);
  context.stroke();

  context.fillStyle = "#6c7b73";
  context.font = "600 14px Poppins";
  context.fillText("Certificate Authority", x, baselineY - 30);

  context.fillStyle = "#183126";
  context.font = "600 19px Poppins";
  context.fillText("Verified by GWA Genie", x, baselineY);

  context.fillStyle = "#52655d";
  context.font = "500 16px Poppins";
  context.fillText(`Generated on ${generatedDate}`, x, baselineY + 22);
  context.restore();
}

function drawVerificationBlock(context, x, baselineY, subjectCount) {
  context.save();
  context.textAlign = "right";
  context.fillStyle = "#00693e";
  context.font = "700 22px Poppins";
  context.fillText("Academic Progress Snapshot", x, baselineY);

  context.fillStyle = "#52655d";
  context.font = "500 16px Poppins";
  context.fillText(
    `Prepared from ${subjectCount} recorded subject${subjectCount === 1 ? "" : "s"}`,
    x,
    baselineY + 22,
  );
  context.restore();
}

function roundedRectPath(context, x, y, width, height, radius) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(
    x + width,
    y + height,
    x + width - safeRadius,
    y + height,
  );
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
}

function wrapCanvasText(context, text, x, y, maxWidth, lineHeight) {
  const words = text.split(/\s+/);
  const lines = [];
  let currentLine = "";

  words.forEach((word) => {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (context.measureText(testLine).width <= maxWidth || !currentLine) {
      currentLine = testLine;
      return;
    }

    lines.push(currentLine);
    currentLine = word;
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  const startY = y - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, index) => {
    context.fillText(line, x, startY + index * lineHeight);
  });
}

function downloadDataUrl(dataUrl, fileName) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function getCertificateFileName() {
  const recipientName = normalizeFullName(fullName) || "recorded-student";
  const safeFileName = recipientName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `gwa-certificate-${safeFileName || "student"}.png`;
}

function getStandingToneClass(gwa) {
  if (gwa <= 1.75) {
    return "standing-good";
  }

  if (gwa <= 3) {
    return "standing-caution";
  }

  return "standing-alert";
}

function chunkSubjectsForPdf(subjectList, chunkSize) {
  const chunks = [];

  for (let index = 0; index < subjectList.length; index += chunkSize) {
    chunks.push(subjectList.slice(index, index + chunkSize));
  }

  return chunks;
}

window.startEdit = startEdit;
window.saveEdit = saveEdit;
window.cancelEdit = cancelEdit;
window.removeSubject = removeSubject;
