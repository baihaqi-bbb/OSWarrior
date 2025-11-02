import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { auth } from './firebase-config.js';

const WEEKS_COUNT = 14;

// Use consistent API base URL like other pages
const API_BASE = "https://oswarrior-backend.onrender.com";

// === SUCCESS MODAL ===
function showSuccessModal(quiz, sourceFileName) {
  const modal = document.getElementById("modal-success");
  if (modal) {
    // Update success details
    document.getElementById("success-title").textContent = "🎉 Quiz Generated Successfully!";
    document.getElementById("success-quiz-title").textContent = quiz.title || "Untitled Quiz";
    document.getElementById("success-question-count").textContent = quiz.questions?.length || "0";
    document.getElementById("success-weeks").textContent = quiz.weeks || "Not specified";
    document.getElementById("success-source-file").textContent = sourceFileName || "Unknown";
    
    modal.style.display = "flex";
    
    // Trigger animations
    setTimeout(() => {
      modal.classList.add("show");
    }, 100);
  }
}

function hideSuccessModal() {
  console.log("🔹 hideSuccessModal called");
  const modal = document.getElementById("modal-success");
  if (modal) {
    console.log("🔹 Modal found, hiding...");
    console.log("Current display:", modal.style.display);
    console.log("Has show class:", modal.classList.contains("show"));
    
    // Remove show class
    modal.classList.remove("show");
    
    // Force hide immediately
    modal.style.display = "none";
    console.log("🔹 Modal hidden immediately");
    
    // Also remove any potential conflicting styles
    modal.style.visibility = "hidden";
    modal.style.opacity = "0";
    
    // Reset after animation time
    setTimeout(() => {
      modal.style.visibility = "";
      modal.style.opacity = "";
      console.log("🔹 Modal styles reset");
    }, 350);
  } else {
    console.log("❌ Success modal not found");
  }
}

// === SUCCESS MODAL ACTIONS ===
function viewQuiz(quizId) {
  hideSuccessModal();
  // Redirect to quiz view page
  window.location.href = `quiz.html?id=${quizId}`;
}

function uploadAnother() {
  hideSuccessModal();
  // Clear any selection and focus on file input
  resetUploadForm();
  document.getElementById("quiz-file").focus();
}

function closeSuccessModal() {
  console.log("🔸 closeSuccessModal called");
  hideSuccessModal();
}

// === INITIALIZATION ===
document.addEventListener("DOMContentLoaded", () => {
  initializeUploadPage();
  loadExistingQuizzes();
  updateStatsCards();
});

// === UI ELEMENTS ===
const weekDropdownBtn = document.getElementById("week-dropdown-btn");
const weekDropdownPanel = document.getElementById("week-dropdown-panel");
const weekListEl = document.getElementById("week-list");
const selectAllBtn = document.getElementById("select-all");
const clearAllBtn = document.getElementById("clear-all");
const doneWeeksBtn = document.getElementById("done-weeks");
const selectedCountEl = document.getElementById("selected-count");
const selectedChipsEl = document.getElementById("selected-chips");

const chooseFileBtn = document.getElementById("choose-file");
const fileInput = document.getElementById("file-input");
const fileNameEl = document.getElementById("file-name");
const fileSizeEl = document.getElementById("file-size");
const uploadBtn = document.getElementById("upload-btn");
const uploadProgressEl = document.getElementById("upload-progress");
const uploadStatusEl = document.getElementById("upload-status");

const uploadTableBody = document.querySelector("#uploadTable tbody");
const searchInput = document.getElementById("search-quizzes");
const filterWeekSelect = document.getElementById("filter-week");

// === STATE VARIABLES ===
let selectedWeeks = new Set();
let selectedFile = null;
let currentUser = null;
let uploadedQuizzes = [];

// === INITIALIZATION FUNCTIONS ===
function initializeUploadPage() {
  buildWeekList();
  updateUI();
  setupEventListeners();
  populateWeekFilter();
  updateSelectedSummary();
  
  // Ensure dropdown starts hidden (same pattern as home admin)
  if (weekDropdownPanel) {
    weekDropdownPanel.classList.add("hidden");
  }
}

function buildWeekList() {
  if (!weekListEl) return;
  
  weekListEl.innerHTML = "";
  for (let i = 1; i <= WEEKS_COUNT; i++) {
    const row = document.createElement("label");
    row.className = "week-row";
    row.innerHTML = `
      <input type="checkbox" data-week="${i}"> 
      <span>📚 Week ${i}</span>
    `;
    weekListEl.appendChild(row);
  }
}

function populateWeekFilter() {
  if (!filterWeekSelect) return;
  
  filterWeekSelect.innerHTML = '<option value="">All Weeks</option>';
  for (let i = 1; i <= WEEKS_COUNT; i++) {
    const option = document.createElement("option");
    option.value = i;
    option.textContent = `Week ${i}`;
    filterWeekSelect.appendChild(option);
  }
}

// === EVENT LISTENERS ===
function setupEventListeners() {
  // Week dropdown
  weekDropdownBtn?.addEventListener("click", toggleWeekDropdown);
  window.addEventListener("click", closeWeekDropdown);
  weekListEl?.addEventListener("click", handleWeekRowClick);
  weekListEl?.addEventListener("change", handleWeekCheckboxChange);
  
  // Week panel actions
  selectAllBtn?.addEventListener("click", selectAllWeeks);
  clearAllBtn?.addEventListener("click", clearAllWeeks);
  doneWeeksBtn?.addEventListener("click", () => {
    // Add visual feedback
    if (doneWeeksBtn) {
      doneWeeksBtn.textContent = "✅ Applied!";
      doneWeeksBtn.style.background = "linear-gradient(135deg, #10B981, #059669)";
      
      setTimeout(() => {
        doneWeeksBtn.textContent = "✅ Done";
        doneWeeksBtn.style.background = "";
      }, 1000);
    }
    
    // Close dropdown
    weekDropdownPanel?.classList.add("hidden");
    
    // Optional: Show notification
    if (selectedWeeks.size > 0) {
      console.log(`${selectedWeeks.size} week(s) selected successfully!`);
    }
  });
  
  // Chip removal
  selectedChipsEl?.addEventListener("click", handleChipRemoval);
  
  // File selection
  chooseFileBtn?.addEventListener("click", triggerFileSelection);
  fileInput?.addEventListener("change", handleFileSelection);
  
  // Upload
  uploadBtn?.addEventListener("click", handleUpload);
  
  // Quick actions
  document.getElementById("refresh-data")?.addEventListener("click", handleRefreshData);
  document.getElementById("clear-all-data")?.addEventListener("click", handleClearAllData);
  document.getElementById("export-data")?.addEventListener("click", handleExportData);
  document.getElementById("upload-help")?.addEventListener("click", handleUploadHelp);
  
  // Table controls
  searchInput?.addEventListener("input", filterTable);
  filterWeekSelect?.addEventListener("change", filterTable);
  document.getElementById("refresh-table")?.addEventListener("click", handleRefreshData);
  document.getElementById("export-table")?.addEventListener("click", handleExportData);
  
  // Auth state
  // (onAuthStateChanged already called above in handleAuthStateChange setup)
}

// === WEEK SELECTION FUNCTIONS ===
function toggleWeekDropdown(e) {
  e.stopPropagation();
  weekDropdownPanel?.classList.toggle("hidden");
}

function closeWeekDropdown(e) {
  // If called from Done button (no event) or from window click
  if (!e || (weekDropdownPanel && 
      !weekDropdownPanel.contains(e.target) && 
      !weekDropdownBtn.contains(e.target))) {
    weekDropdownPanel.classList.add("hidden");
  }
}

function handleWeekRowClick(e) {
  const row = e.target.closest(".week-row");
  if (!row) return;
  
  const checkbox = row.querySelector("input[type=checkbox]");
  if (e.target !== checkbox) {
    checkbox.checked = !checkbox.checked;
    checkbox.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

function handleWeekCheckboxChange(e) {
  const checkbox = e.target;
  const week = checkbox.dataset.week;
  if (!week) return;
  
  const row = checkbox.closest('.week-row');
  
  if (checkbox.checked) {
    selectedWeeks.add(week);
    row.classList.add('selected');
  } else {
    selectedWeeks.delete(week);
    row.classList.remove('selected');
  }
  
  updateUI();
  updateSelectedSummary();
}

function selectAllWeeks() {
  selectedWeeks.clear();
  for (let i = 1; i <= WEEKS_COUNT; i++) {
    selectedWeeks.add(String(i));
  }
  
  weekListEl?.querySelectorAll("input[type=checkbox]").forEach(cb => {
    cb.checked = true;
    cb.closest('.week-row').classList.add('selected');
  });
  updateUI();
  updateSelectedSummary();
}

function clearAllWeeks() {
  selectedWeeks.clear();
  weekListEl?.querySelectorAll("input[type=checkbox]").forEach(cb => {
    cb.checked = false;
    cb.closest('.week-row').classList.remove('selected');
  });
  updateUI();
  updateSelectedSummary();
}

function updateSelectedSummary() {
  const summaryEl = document.getElementById('selected-summary');
  if (!summaryEl) return;
  
  const count = selectedWeeks.size;
  if (count === 0) {
    summaryEl.textContent = "No weeks selected";
    summaryEl.classList.remove('has-selection');
  } else if (count === 1) {
    summaryEl.textContent = "1 week selected";
    summaryEl.classList.add('has-selection');
  } else {
    summaryEl.textContent = `${count} weeks selected`;
    summaryEl.classList.add('has-selection');
  }
}

function handleChipRemoval(e) {
  const button = e.target.closest("button[data-week]");
  if (!button) return;
  
  const week = button.dataset.week;
  selectedWeeks.delete(week);
  
  const checkbox = weekListEl?.querySelector(`input[data-week="${week}"]`);
  if (checkbox) {
    checkbox.checked = false;
    checkbox.closest('.week-row').classList.remove('selected');
  }
  
  updateUI();
  updateSelectedSummary();
}

// === FILE HANDLING ===
function triggerFileSelection() {
  fileInput?.click();
}

function handleFileSelection(e) {
  const file = e.target.files[0];
  selectedFile = file;
  
  if (file) {
    fileNameEl.textContent = file.name;
    fileNameEl.classList.add("selected");
    fileSizeEl.textContent = formatFileSize(file.size);
  } else {
    fileNameEl.textContent = "No file selected";
    fileNameEl.classList.remove("selected");
    fileSizeEl.textContent = "";
  }
  
  updateUI();
}

function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// === UPLOAD HANDLING ===
async function handleUpload() {
  if (!currentUser) {
    showNotification("❌ Not authenticated as admin", "error");
    return;
  }
  
  if (!selectedFile) {
    showNotification("📁 Please select a file first", "warning");
    return;
  }
  
  if (selectedWeeks.size === 0) {
    showNotification("📅 Please select at least one week", "warning");
    return;
  }
  
  // Show processing modal
  showProcessingModal();
  
  try {
    // Get auth headers without putting token in FormData
    const authHeaders = await getAuthHeaders();
    
    const formData = new FormData();
    formData.append("file", selectedFile);  // Ensure field name is "file"
    formData.append("weeks", JSON.stringify(Array.from(selectedWeeks)));
    
    // Update processing steps
    updateProcessingStep(1, "Reading file content...");
    
    console.log("Uploading to:", `${API_BASE}/api/upload-notes`);
    console.log("File:", selectedFile.name, selectedFile.size, "bytes");
    console.log("Weeks:", Array.from(selectedWeeks));
    
    // Prepare headers for FormData request (don't set Content-Type, let browser set it)
    const headers = {
      "Authorization": authHeaders.Authorization
    };
    
    const response = await fetch(`${API_BASE}/api/upload-notes`, {
      method: "POST",
      headers: headers,
      body: formData
    });
    
    updateProcessingStep(2, "Analyzing with GPT-4...");
    
    const data = await response.json().catch(() => null);
    
    if (!response.ok) {
      throw new Error(data?.error || data?.detail || `HTTP ${response.status}: Upload failed`);
    }
    
    updateProcessingStep(3, "Generating questions...");
    
    // Simulate some processing time for better UX
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    updateProcessingStep(4, "Finalizing quiz...");
    
    console.log("Upload response:", data);
    
    // Add quiz to table
    const quiz = data?.quiz || {
      id: data?.quizId || Date.now().toString(),
      weeks: Array.from(selectedWeeks),
      title: data?.quiz?.title || selectedFile.name.replace(/\.[^/.]+$/, ""),
      sourceFileName: selectedFile.name,
      questions: data?.quiz?.questions || [],
      createdAt: new Date().toISOString(),
      status: "active"
    };
    
    addQuizToTable(quiz);
    uploadedQuizzes.push(quiz);
    
    // Save to localStorage for persistence
    localStorage.setItem("uploaded-quizzes", JSON.stringify(uploadedQuizzes));
    
    // Success feedback
    setTimeout(() => {
      hideProcessingModal();
      showSuccessModal(quiz, selectedFile.name);
      resetUploadForm();
      updateStatsCards();
      showNotification("🎉 Quiz generated successfully!", "success");
    }, 1000);
    
  } catch (error) {
    console.error("Upload error:", error);
    hideProcessingModal();
    
    let errorMessage = "Upload failed";
    if (error.message.includes('fetch')) {
      errorMessage = "Connection failed. Please check if server is running.";
    } else if (error.message.includes('OpenAI')) {
      errorMessage = "AI processing failed. Please try again.";
    } else {
      errorMessage = error.message || error;
    }
    
    showNotification("❌ " + errorMessage, "error");
  }
}

// === PROCESSING MODAL ===
function showProcessingModal() {
  const modal = document.getElementById("modal-upload-processing");
  if (modal) {
    modal.style.display = "flex";
    resetProcessingSteps();
  }
}

function hideProcessingModal() {
  const modal = document.getElementById("modal-upload-processing");
  if (modal) {
    modal.style.display = "none";
  }
}

function resetProcessingSteps() {
  for (let i = 1; i <= 4; i++) {
    const step = document.getElementById(`step-${i}`);
    if (step) step.classList.remove("active");
  }
  
  const progressFill = document.getElementById("processing-progress-fill");
  if (progressFill) progressFill.style.width = "0%";
  
  const processingText = document.getElementById("processing-text");
  if (processingText) processingText.textContent = "Starting AI analysis...";
}

function updateProcessingStep(stepNumber, text) {
  // Activate current step
  const currentStep = document.getElementById(`step-${stepNumber}`);
  if (currentStep) currentStep.classList.add("active");
  
  // Deactivate previous step
  if (stepNumber > 1) {
    const prevStep = document.getElementById(`step-${stepNumber - 1}`);
    if (prevStep) prevStep.classList.remove("active");
  }
  
  // Update progress bar
  const progressFill = document.getElementById("processing-progress-fill");
  if (progressFill) {
    progressFill.style.width = `${(stepNumber / 4) * 100}%`;
  }
  
  // Update text
  const processingText = document.getElementById("processing-text");
  if (processingText) processingText.textContent = text;
}

// === TABLE MANAGEMENT ===
function addQuizToTable(quiz) {
  if (!uploadTableBody) return;
  
  // Remove empty state if exists
  const emptyRow = uploadTableBody.querySelector(".empty-row");
  if (emptyRow) emptyRow.remove();
  
  const row = document.createElement("tr");
  const createdDate = new Date(quiz.createdAt || Date.now()).toLocaleDateString();
  const questionCount = quiz.questions?.length || 0;
  
  row.innerHTML = `
    <td class="col-week">📅 ${(quiz.weeks || []).join(", ")}</td>
    <td class="col-title">📚 ${quiz.title || "Untitled Quiz"}</td>
    <td class="col-source">📄 ${quiz.sourceFileName || "-"}</td>
    <td class="col-created">⏰ ${createdDate}</td>
    <td class="col-questions">${questionCount}</td>
    <td class="col-status">
      <span class="status-badge ${quiz.status || 'active'}">${quiz.status || 'Active'}</span>
    </td>
    <td class="col-actions">
      <div class="action-buttons">
        <a href="admin-quizzes.html?id=${quiz.id || ''}" class="action-btn view">👁️ View</a>
        <button class="action-btn edit" onclick="editQuiz('${quiz.id || ''}')">✏️ Edit</button>
        <button class="action-btn delete" onclick="deleteQuiz('${quiz.id || ''}')">🗑️ Delete</button>
      </div>
    </td>
  `;
  
  uploadTableBody.insertBefore(row, uploadTableBody.firstChild);
}

function filterTable() {
  const searchTerm = searchInput?.value.toLowerCase() || "";
  const selectedWeek = filterWeekSelect?.value || "";
  
  const rows = uploadTableBody?.querySelectorAll("tr:not(.empty-row)") || [];
  
  rows.forEach(row => {
    const title = row.querySelector(".col-title")?.textContent.toLowerCase() || "";
    const weeks = row.querySelector(".col-week")?.textContent || "";
    
    const matchesSearch = title.includes(searchTerm);
    const matchesWeek = !selectedWeek || weeks.includes(selectedWeek);
    
    row.style.display = (matchesSearch && matchesWeek) ? "" : "none";
  });
}

// === UI UPDATE FUNCTIONS ===
function updateUI() {
  // Update selected count
  if (selectedCountEl) {
    selectedCountEl.textContent = `(${selectedWeeks.size})`;
  }
  
  // Update selected chips
  if (selectedChipsEl) {
    selectedChipsEl.innerHTML = "";
    const sortedWeeks = Array.from(selectedWeeks).sort((a, b) => Number(a) - Number(b));
    
    sortedWeeks.forEach(week => {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.innerHTML = `
        <span>Week ${week}</span>
        <button class="remove-chip" data-week="${week}" aria-label="Remove week ${week}">✕</button>
      `;
      selectedChipsEl.appendChild(chip);
    });
  }
  
  // Update upload button state
  if (uploadBtn) {
    uploadBtn.disabled = !(selectedWeeks.size > 0 && selectedFile && currentUser);
  }
}

function resetUploadForm() {
  // Clear weeks
  selectedWeeks.clear();
  weekListEl?.querySelectorAll("input[type=checkbox]").forEach(cb => {
    cb.checked = false;
  });
  
  // Clear file
  selectedFile = null;
  if (fileInput) fileInput.value = "";
  if (fileNameEl) {
    fileNameEl.textContent = "No file selected";
    fileNameEl.classList.remove("selected");
  }
  if (fileSizeEl) fileSizeEl.textContent = "";
  
  updateUI();
}

function updateStatsCards() {
  // Update total files
  const totalFilesEl = document.getElementById("total-files");
  if (totalFilesEl) {
    totalFilesEl.textContent = uploadedQuizzes.length;
  }
  
  // Update generated quizzes
  const generatedQuizzesEl = document.getElementById("generated-quizzes");
  if (generatedQuizzesEl) {
    generatedQuizzesEl.textContent = uploadedQuizzes.length;
  }
  
  // Update processing status
  const processingStatusEl = document.getElementById("processing-status");
  if (processingStatusEl) {
    processingStatusEl.textContent = "Ready";
  }
  
  // Update storage used (approximate)
  const storageUsedEl = document.getElementById("storage-used");
  if (storageUsedEl) {
    const totalSize = uploadedQuizzes.reduce((sum, quiz) => sum + (quiz.fileSize || 0), 0);
    storageUsedEl.textContent = Math.round(totalSize / (1024 * 1024)) || "-";
  }
  
  // Update badges
  const uploadsBadge = document.getElementById("uploads-badge");
  if (uploadsBadge) {
    uploadsBadge.textContent = uploadedQuizzes.length;
  }
  
  const quizCountBadge = document.getElementById("quiz-count-badge");
  if (quizCountBadge) {
    quizCountBadge.textContent = uploadedQuizzes.length;
  }
}

// === AUTH HANDLING ===
function handleAuthStateChange(user) {
  currentUser = user;
  updateUI();
  
  if (!user) {
    uploadStatusEl.textContent = "Please login as admin";
    showNotification("❌ Please login as admin to upload content", "warning");
  } else {
    uploadStatusEl.textContent = "Ready to upload";
    console.log("✅ Admin authenticated:", user.email);
  }
}

// Initialize auth state listener
onAuthStateChanged(auth, handleAuthStateChange);

// Helper function to get auth headers (consistent with other admin pages)
async function getAuthHeaders() {
  try {
    if (currentUser) {
      const token = await currentUser.getIdToken(true);
      return { 
        "Authorization": "Bearer " + token,
        "Content-Type": "application/json"
      };
    }
  } catch (e) {
    console.error("Failed to get auth token:", e);
  }
  return { "Content-Type": "application/json" };
}

// === DATA LOADING ===
async function loadExistingQuizzes() {
  try {
    console.log("📊 Loading existing quizzes...");
    
    // Try to fetch from API first (consistent with other admin pages)
    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/api/quizzes`, { 
        headers: authHeaders,
        credentials: 'include'
      });
      
      if (response.ok) {
        const apiQuizzes = await response.json();
        console.log("✅ Loaded quizzes from API:", apiQuizzes.length);
        uploadedQuizzes = Array.isArray(apiQuizzes) ? apiQuizzes : [];
      } else {
        throw new Error(`API returned ${response.status}`);
      }
    } catch (apiError) {
      console.warn("⚠️ API fetch failed, using localStorage:", apiError.message);
      // Fallback to localStorage
      const stored = localStorage.getItem("uploaded-quizzes");
      uploadedQuizzes = stored ? JSON.parse(stored) : [];
    }
    
    // Populate table
    if (uploadTableBody) {
      if (uploadedQuizzes.length === 0) {
        uploadTableBody.innerHTML = `
          <tr class="empty-row">
            <td colspan="7" class="empty-state">
              <div class="empty-content">
                <div class="empty-icon">🎯</div>
                <h4>No Generated Quizzes Yet</h4>
                <p>Upload course materials above to automatically generate AI-powered quizzes</p>
                <button class="btn-primary small" onclick="document.getElementById('choose-file').click()">
                  📤 Upload First File
                </button>
              </div>
            </td>
          </tr>
        `;
      } else {
        uploadTableBody.innerHTML = "";
        uploadedQuizzes.forEach(quiz => addQuizToTable(quiz));
      }
    }
    
    updateStatsCards();
  } catch (error) {
    console.error("Error loading quizzes:", error);
    showNotification("⚠️ Failed to load existing quizzes", "warning");
    uploadedQuizzes = [];
    updateStatsCards();
  }
}

// === GLOBAL FUNCTIONS (for onclick handlers) ===
window.editQuiz = function(quizId) {
  showNotification("✏️ Edit feature coming soon...", "info");
};

window.deleteQuiz = function(quizId) {
  // Use custom confirmation modal instead of browser confirm
  showConfirmationModal(
    "🗑️ Delete Quiz",
    "Are you sure you want to delete this quiz? This action cannot be undone.",
    "danger"
  ).then((confirmed) => {
    if (confirmed) {
      uploadedQuizzes = uploadedQuizzes.filter(quiz => quiz.id !== quizId);
      localStorage.setItem("uploaded-quizzes", JSON.stringify(uploadedQuizzes));
      loadExistingQuizzes();
      showNotification("✅ Quiz deleted successfully!", "success");
    }
  });
};

window.viewQuiz = viewQuiz;
window.uploadAnother = uploadAnother;
window.closeSuccessModal = closeSuccessModal;

// Test function for manual debugging
window.testCloseModal = function() {
  console.log("🧪 Testing modal close...");
  closeSuccessModal();
};

// Force close modal (for emergency debugging)
window.forceCloseModal = function() {
  console.log("🚨 Force closing all modals...");
  const modals = document.querySelectorAll('.modal');
  modals.forEach(modal => {
    modal.style.display = 'none';
    modal.classList.remove('show');
  });
};

// Quick Actions handlers
async function handleRefreshData() {
  showNotification('🔄 Refreshing upload data...', 'info');
  
  try {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Reload quizzes and update stats
    await loadExistingQuizzes();
    updateStatsCards();
    
    showNotification('✅ Upload data refreshed successfully', 'success');
  } catch (error) {
    showNotification('❌ Failed to refresh data: ' + error.message, 'error');
  }
}

async function handleClearAllData() {
  // Show confirmation modal
  const confirmed = await showConfirmationModal(
    '🗑️ Clear All Data',
    'Are you sure you want to delete all uploaded quizzes? This action cannot be undone.',
    'warning'
  );
  
  if (confirmed) {
    showNotification('🧹 Clearing all upload data...', 'warning');
    
    try {
      // Clear data
      uploadedQuizzes = [];
      localStorage.removeItem("uploaded-quizzes");
      
      // Update UI
      await loadExistingQuizzes();
      updateStatsCards();
      
      showNotification('✅ All upload data cleared successfully', 'success');
    } catch (error) {
      showNotification('❌ Failed to clear data: ' + error.message, 'error');
    }
  }
}

async function handleExportData() {
  showNotification('📊 Preparing export...', 'info');
  
  try {
    // Simulate export preparation
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Create export data
    const exportData = {
      exportDate: new Date().toISOString(),
      totalQuizzes: uploadedQuizzes.length,
      quizzes: uploadedQuizzes.map(quiz => ({
        id: quiz.id,
        title: quiz.title,
        weeks: quiz.weeks,
        questions: quiz.questions?.length || 0,
        sourceFile: quiz.sourceFileName,
        createdAt: quiz.createdAt,
        status: quiz.status
      }))
    };
    
    // Create download
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `quiz-export-${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    
    showNotification('✅ Export completed successfully', 'success');
  } catch (error) {
    showNotification('❌ Export failed: ' + error.message, 'error');
  }
}

function handleUploadHelp() {
  showHelpModal();
}

// === NOTIFICATION SYSTEM ===
function showNotification(message, type = 'info') {
  // Remove existing notifications
  const existingNotifications = document.querySelectorAll('.admin-notification');
  existingNotifications.forEach(notification => notification.remove());
  
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `admin-notification notification-${type}`;
  notification.innerHTML = `
    <div class="notification-content">
      <span class="notification-icon">${getNotificationIcon(type)}</span>
      <span class="notification-message">${message}</span>
      <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
    </div>
  `;
  
  // Add exact styles from home-admin
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: rgba(5, 15, 25, 0.9);
    border: 1px solid rgba(0, 255, 255, 0.3);
    border-radius: 10px;
    padding: 15px 20px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(10px);
    z-index: 10000;
    max-width: 400px;
    animation: slideInRight 0.3s ease;
    font-family: 'Poppins', sans-serif;
    color: #FFFFFF;
  `;
  
  document.body.appendChild(notification);
  
  // Auto remove after 5 seconds
  setTimeout(() => {
    if (notification.parentElement) {
      notification.remove();
    }
  }, 5000);
}

function getNotificationIcon(type) {
  const icons = {
    info: 'ℹ️',
    success: '✅',
    warning: '⚠️',
    error: '❌'
  };
  return icons[type] || '📢';
}

// === CONFIRMATION MODAL ===
function showConfirmationModal(title, message, type = 'warning') {
  return new Promise((resolve) => {
    // Remove existing modal
    const existingModal = document.getElementById('confirmation-modal');
    if (existingModal) {
      existingModal.remove();
    }
    
    // Create modal
    const modal = document.createElement('div');
    modal.id = 'confirmation-modal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content confirmation-content">
        <div class="confirmation-header">
          <div class="confirmation-icon ${type}">
            ${type === 'warning' ? '⚠️' : type === 'danger' ? '🚨' : 'ℹ️'}
          </div>
          <h3>${title}</h3>
        </div>
        <div class="confirmation-body">
          <p>${message}</p>
        </div>
        <div class="confirmation-actions">
          <button class="btn-confirmation cancel" onclick="resolveConfirmation(false)">Cancel</button>
          <button class="btn-confirmation confirm ${type}" onclick="resolveConfirmation(true)">Confirm</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    modal.style.display = 'flex';
    
    // Store resolve function globally
    window.resolveConfirmation = (result) => {
      modal.remove();
      delete window.resolveConfirmation;
      resolve(result);
    };
    
    // Close on outside click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        window.resolveConfirmation(false);
      }
    });
  });
}

// === HELP MODAL ===
function showHelpModal() {
  // Remove existing modal
  const existingModal = document.getElementById('help-modal');
  if (existingModal) {
    existingModal.remove();
  }
  
  // Create modal
  const modal = document.createElement('div');
  modal.id = 'help-modal';
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content help-content">
      <div class="help-header">
        <div class="help-icon">❓</div>
        <h3>Upload Help & Guidelines</h3>
        <button class="close-btn" onclick="document.getElementById('help-modal').remove()">×</button>
      </div>
      <div class="help-body">
        <div class="help-section">
          <h4>📤 Supported File Types</h4>
          <ul>
            <li><strong>PDF</strong> - Lecture notes, textbooks, research papers</li>
            <li><strong>DOCX</strong> - Word documents, assignments</li>
            <li><strong>TXT</strong> - Plain text files, code documentation</li>
          </ul>
        </div>
        
        <div class="help-section">
          <h4>🎯 Best Practices</h4>
          <ul>
            <li>Use clear, well-structured content for better quiz generation</li>
            <li>Select appropriate weeks to organize your quizzes</li>
            <li>Ensure file size is under 10MB for optimal processing</li>
            <li>Include detailed topic information in your documents</li>
          </ul>
        </div>
        
        <div class="help-section">
          <h4>⚡ Quick Actions</h4>
          <ul>
            <li><strong>Refresh</strong> - Reload all quiz data and update statistics</li>
            <li><strong>Clear All</strong> - Remove all uploaded quizzes (with confirmation)</li>
            <li><strong>Export</strong> - Download quiz data as JSON file</li>
            <li><strong>Help</strong> - Show this help dialog</li>
          </ul>
        </div>
        
        <div class="help-section">
          <h4>🔧 Troubleshooting</h4>
          <ul>
            <li>If upload fails, check your internet connection</li>
            <li>Large files may take longer to process</li>
            <li>Contact admin if processing takes more than 5 minutes</li>
            <li>Clear browser cache if experiencing issues</li>
          </ul>
        </div>
      </div>
      <div class="help-footer">
        <button class="btn-primary" onclick="document.getElementById('help-modal').remove()">Got It!</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  modal.style.display = 'flex';
  
  // Close on outside click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

// === MODAL CLOSE EVENTS ===
document.addEventListener("click", (e) => {
  // Only close modal if clicking on the modal backdrop, not the content
  if (e.target.classList.contains("modal")) {
    const modalId = e.target.id;
    
    switch(modalId) {
      case "modal-upload-processing":
        // Don't allow closing processing modal by clicking outside
        break;
      case "modal-success":
        hideSuccessModal();
        break;
      case "modal-edit-name":
        e.target.style.display = "none";
        break;
      case "modal-change-avatar":
        e.target.style.display = "none";
        break;
      default:
        // Generic modal close
        if (e.target.style.display !== "none") {
          e.target.style.display = "none";
        }
    }
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    // Check which modals are open and close appropriately
    const successModal = document.getElementById("modal-success");
    const processingModal = document.getElementById("modal-upload-processing");
    const editNameModal = document.getElementById("modal-edit-name");
    const editAvatarModal = document.getElementById("modal-change-avatar");
    
    if (successModal && successModal.style.display === "flex") {
      hideSuccessModal();
    } else if (editNameModal && editNameModal.style.display !== "none") {
      editNameModal.style.display = "none";
    } else if (editAvatarModal && editAvatarModal.style.display !== "none") {
      editAvatarModal.style.display = "none";
    }
    // Don't close processing modal with Escape key
  }
});

// Add close button handlers after DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  // Success modal close button
  const closeSuccessBtn = document.getElementById("close-success-btn");
  if (closeSuccessBtn) {
    closeSuccessBtn.addEventListener("click", closeSuccessModal);
  }
  
  // Upload another button
  const uploadAnotherBtn = document.getElementById("upload-another-btn");
  if (uploadAnotherBtn) {
    uploadAnotherBtn.addEventListener("click", uploadAnother);
  }
  
  // View quiz button
  const viewQuizBtn = document.getElementById("view-quiz-btn");
  if (viewQuizBtn) {
    viewQuizBtn.addEventListener("click", () => {
      // Implement view quiz functionality
      closeSuccessModal();
      showNotification("🎯 Quiz view feature coming soon...", "info");
    });
  }
  
  // Edit name modal handlers
  const cancelNameBtn = document.getElementById("cancel-name-btn");
  if (cancelNameBtn) {
    cancelNameBtn.addEventListener("click", () => {
      const modal = document.getElementById("modal-edit-name");
      if (modal) modal.style.display = "none";
    });
  }
  
  // Edit avatar modal handlers
  const cancelAvatarBtn = document.getElementById("cancel-avatar-btn");
  if (cancelAvatarBtn) {
    cancelAvatarBtn.addEventListener("click", () => {
      const modal = document.getElementById("modal-change-avatar");
      if (modal) modal.style.display = "none";
    });
  }
  
  // Close processing modal on outside click
  const processingModal = document.getElementById("modal-upload-processing");
  if (processingModal) {
    processingModal.addEventListener("click", (e) => {
      if (e.target === processingModal) {
        // Don't allow closing processing modal by clicking outside
        // hideProcessingModal();
      }
    });
  }
});