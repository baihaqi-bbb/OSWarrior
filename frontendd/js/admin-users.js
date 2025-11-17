import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
const API_BASE = "https://oswarrior-backend.onrender.com";
import {
  getFirestore, collection, getDocs, query, orderBy,
  updateDoc, doc, getDoc, addDoc
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// Use already-initialized Firebase app from js/home-admin.js
const auth = getAuth();
const db = getFirestore();

let usersCache = [];

// Admin emails list (same as other admin pages)
const adminEmails = [
  "admin1@email.com",
  "admin2@email.com",
  "admin@oswarrior.com",
  "dev@admin.com"
];

// require admin role and load users
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    console.log("No user authenticated, redirecting to login");
    return window.location.href = "index.html";
  }
  
  console.log("User authenticated:", user.email);
  
  // ✅ Check email first (most reliable)
  if (adminEmails.includes(user.email)) {
    console.log("✅ Admin email verified:", user.email);
    await loadUsers();
    return;
  }
  
  // Otherwise check Firestore role
  try {
    const meDoc = await getDoc(doc(db, "users", user.uid));
    const me = meDoc.exists() ? meDoc.data() : null;
    if (!me || me.role !== "admin") {
      console.log("Access denied: Not admin");
      return window.location.href = "home-user.html";
    }
    await loadUsers();
  } catch (e) {
    console.error("Role check / load users error:", e);
    // If Firestore fails but not admin email, redirect to user page
    window.location.href = "home-user.html";
  }
});

async function loadUsers() {
  try {
    const q = query(collection(db, "users"), orderBy("email"));
    const snap = await getDocs(q);
    // Filter out deleted users
    usersCache = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(u => !u.deleted);
    renderTable(usersCache);
    
    // Check for duplicates and show/hide fix button
    checkForDuplicates();
  } catch (err) {
    console.error("loadUsers error:", err);
    const tbody = document.querySelector("#usersTable tbody");
    if (tbody) tbody.innerHTML = `<tr><td colspan="6">❌ Failed to load users</td></tr>`;
  }
}

// Check for duplicate emails and show fix button if needed
function checkForDuplicates() {
  const emailCounts = {};
  usersCache.forEach(u => {
    if (u.email) {
      const email = u.email.toLowerCase();
      emailCounts[email] = (emailCounts[email] || 0) + 1;
    }
  });
  
  const hasDuplicates = Object.values(emailCounts).some(count => count > 1);
  const fixButton = document.getElementById("fixDuplicates");
  
  if (fixButton) {
    if (hasDuplicates) {
      fixButton.style.display = "inline-block";
      fixButton.textContent = `⚠️ Fix Duplicates (${Object.values(emailCounts).filter(count => count > 1).length} groups)`;
    } else {
      fixButton.style.display = "none";
    }
  }
}

function renderTable(list) {
  const tbody = document.querySelector("#usersTable tbody");
  if (!tbody) return;
  tbody.innerHTML = "";
  
  // Find duplicate emails
  const emailCounts = {};
  list.forEach(u => {
    if (u.email) {
      const email = u.email.toLowerCase();
      emailCounts[email] = (emailCounts[email] || 0) + 1;
    }
  });
  
  list.forEach(u => {
    const tr = document.createElement("tr");
    tr.dataset.uid = u.id;
    
    // Check if this email is duplicated
    const isDuplicate = u.email && emailCounts[u.email.toLowerCase()] > 1;
    
    // Format join date
    const joinDate = u.createdAt ? new Date(u.createdAt.seconds * 1000).toLocaleDateString() : 'N/A';
    
    tr.innerHTML = `
      <td>
        <div class="user-cell">
          <img src="${u.photoURL || 'image/default-profile.png'}" alt="Avatar" class="user-avatar">
          <div class="user-info">
            <h4>${u.name || 'No Name'}</h4>
            <p class="${isDuplicate ? 'duplicate-email' : ''}">${u.email || 'No Email'}${isDuplicate ? ' ⚠️' : ''}</p>
          </div>
        </div>
      </td>
      <td class="${isDuplicate ? 'duplicate-email' : ''}">${u.email || 'N/A'}${isDuplicate ? ' ⚠️ DUPLICATE' : ''}</td>
      <td>
        <select class="role-select" data-uid="${u.id}">
          <option value="user" ${u.role==='user'?'selected':''}>User</option>
          <option value="admin" ${u.role==='admin'?'selected':''}>Admin</option>
        </select>
      </td>
      <td>
        <span class="status-chip ${u.disabled ? 'status-disabled' : 'status-active'}">
          ${u.disabled ? 'Disabled' : 'Active'}
        </span>
      </td>
      <td>${joinDate}</td>
      <td>
        <div class="action-buttons">
          <button class="btn-small btn-edit" data-uid="${u.id}" title="Edit User">
            ✏️ Edit
          </button>
          <button class="btn-small ${u.disabled ? 'btn-enable' : 'btn-disable'}" 
                  data-uid="${u.id}" title="${u.disabled ? 'Enable' : 'Disable'} User">
            ${u.disabled ? '✅ Enable' : '🚫 Disable'}
          </button>
          <button class="btn-small btn-delete" data-uid="${u.id}" title="Delete User">
            🗑️ Delete
          </button>
        </div>
      </td>`;
    tbody.appendChild(tr);
  });
}

// Event delegation for all user actions
document.querySelector("#usersTable tbody")?.addEventListener("change", async (e) => {
  const target = e.target;
  if (target.classList && target.classList.contains("role-select")) {
    const uid = target.dataset.uid;
    const newRole = target.value;
    if (!uid) return;
    
    if (!confirm(`Change user role to "${newRole}"?`)) {
      const u = usersCache.find(x => x.id === uid);
      if (u) target.value = u.role || "user";
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/admin/set-role`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUid: uid, role: newRole })
      });

      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Request failed");

      alert("✅ Role updated successfully! User needs to sign out & sign in again.");
      await loadUsers();
    } catch (err) {
      console.error("set role via backend error:", err);
      alert("❌ Failed to update role: " + (err.message || err));
      const u = usersCache.find(x => x.id === uid);
      if (u) target.value = u.role || "user";
    }
  }
});

document.querySelector("#usersTable tbody")?.addEventListener("click", async (e) => {
  const target = e.target;
  const uid = target.dataset.uid;
  
  if (!uid) return;
  const user = usersCache.find(x => x.id === uid);
  if (!user) return;

  // Edit User Action
  if (target.classList.contains("btn-edit")) {
    editUser(user);
  }
  
  // Toggle Disable/Enable Action
  else if (target.classList.contains("btn-disable") || target.classList.contains("btn-enable")) {
    const newDisabled = !user.disabled;
    const action = newDisabled ? 'disable' : 'enable';
    
    // Show disable/enable confirmation modal
    document.getElementById("disable-modal-title").textContent = newDisabled ? 'Disable User Account' : 'Enable User Account';
    document.getElementById("disable-message").textContent = newDisabled ? 
      'Are you sure you want to disable this user account?' : 
      'Are you sure you want to enable this user account?';
    document.getElementById("disable-user-name").textContent = user.name || 'No Name';
    document.getElementById("disable-user-email").textContent = user.email || 'No Email';
    document.getElementById("disable-user-avatar").src = user.photoURL || 'image/default-profile.png';
    document.getElementById("disable-action-text").textContent = newDisabled ? 'Yes, Disable' : 'Yes, Enable';
    document.getElementById("disable-note").textContent = newDisabled ? 
      'This user will be unable to access the platform until re-enabled.' : 
      'This user will regain access to the platform immediately.';
    
    // Store current user and action for processing
    window.currentDisableUser = user;
    window.currentDisableAction = newDisabled;
    
    // Show disable modal
    document.getElementById("modal-confirm-disable").style.display = "flex";
  }
  
  // Delete User Action
  else if (target.classList.contains("btn-delete")) {
    deleteUser(user);
  }
});

// Edit User Function
function editUser(user) {
  // Show edit modal with current user data
  document.getElementById("edit-user-name").value = user.name || '';
  document.getElementById("edit-user-email").value = user.email || '';
  
  // Store current user data for saving
  window.currentEditUser = user;
  
  // Show edit modal
  document.getElementById("modal-edit-user").style.display = "flex";
}

// Delete User Function
function deleteUser(user) {
  // Show delete confirmation modal with user data
  document.getElementById("delete-user-name").textContent = user.name || 'No Name';
  document.getElementById("delete-user-email").textContent = user.email || 'No Email';
  document.getElementById("delete-user-avatar").src = user.photoURL || 'image/default-profile.png';
  
  // Clear confirmation input
  document.getElementById("delete-confirmation").value = '';
  document.getElementById("confirm-delete-btn").disabled = true;
  
  // Store current user data for deletion
  window.currentDeleteUser = user;
  
  // Show delete modal
  document.getElementById("modal-confirm-delete").style.display = "flex";
}

// Update User Details
async function updateUserDetails(uid, updates) {
  try {
    await updateDoc(doc(db, "users", uid), updates);
    
    // Show success modal
    showSuccessModal(updates.name || 'User', 'Updated');
    await loadUsers();
  } catch (err) {
    console.error("update user details error:", err);
    alert("❌ Failed to update user details: " + (err.message || err));
  }
}

// Perform User Deletion
async function performUserDeletion(uid, userName) {
  try {
    // Note: This only removes from Firestore, not Firebase Auth
    // For full deletion, you'd need a cloud function to delete from Auth too
    await updateDoc(doc(db, "users", uid), { 
      deleted: true, 
      deletedAt: new Date(),
      originalEmail: usersCache.find(u => u.id === uid)?.email 
    });
    
    // Show success modal
    showSuccessModal(userName, 'Deleted');
    await loadUsers();
  } catch (err) {
    console.error("delete user error:", err);
    alert("❌ Failed to delete user: " + (err.message || err));
  }
}

// Perform Disable/Enable Action
async function performDisableAction(uid, disabled, userName) {
  try {
    await updateDoc(doc(db, "users", uid), { disabled });
    
    // Show success modal
    const action = disabled ? 'Disabled' : 'Enabled';
    showSuccessModal(userName, action);
    await loadUsers();
  } catch (err) {
    console.error("toggle disable error:", err);
    alert("❌ Failed to update user status. Check permissions.");
  }
}

// Show Success Modal
function showSuccessModal(userName, actionType) {
  document.getElementById("success-action-title").textContent = `${actionType} Successfully!`;
  document.getElementById("success-action-message").textContent = `User has been ${actionType.toLowerCase()} successfully!`;
  document.getElementById("success-action-user").textContent = userName;
  document.getElementById("success-action-type").textContent = actionType;
  
  document.getElementById("modal-success-action").style.display = "flex";
}

// Search and filter functionality
const searchEl = document.getElementById("search");
const roleFilterEl = document.getElementById("roleFilter");
const statusFilterEl = document.getElementById("statusFilter");

function applyFilters() {
  const searchQuery = searchEl?.value.toLowerCase() || '';
  const roleFilter = roleFilterEl?.value || '';
  const statusFilter = statusFilterEl?.value || '';
  
  let filteredUsers = usersCache.filter(u => {
    // Search filter
    const matchesSearch = searchQuery === '' || 
      (u.email || '').toLowerCase().includes(searchQuery) || 
      (u.name || '').toLowerCase().includes(searchQuery);
    
    // Role filter
    const matchesRole = roleFilter === '' || u.role === roleFilter;
    
    // Status filter
    const matchesStatus = statusFilter === '' || 
      (statusFilter === 'active' && !u.disabled) ||
      (statusFilter === 'disabled' && u.disabled);
    
    return matchesSearch && matchesRole && matchesStatus;
  });
  
  renderTable(filteredUsers);
}

// Attach filter event listeners
if (searchEl) {
  searchEl.addEventListener("input", applyFilters);
}

if (roleFilterEl) {
  roleFilterEl.addEventListener("change", applyFilters);
}

if (statusFilterEl) {
  statusFilterEl.addEventListener("change", applyFilters);
}

// Export CSV functionality
const exportBtn = document.getElementById("exportCsv");
if (exportBtn) {
  exportBtn.addEventListener("click", () => {
    const headers = ["Email", "Name", "Role", "Status", "Join Date"];
    const rows = usersCache.map(u => [
      u.email || "",
      u.name || "",
      u.role || "user",
      u.disabled ? "Disabled" : "Active",
      u.createdAt ? new Date(u.createdAt.seconds * 1000).toLocaleDateString() : "N/A"
    ]);
    
    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g,'""')}"`).join(","))
      .join("\n");
    
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `oswarrior-users-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    
    alert("✅ Users data exported successfully!");
  });
}

// Add User functionality
const addUserBtn = document.getElementById("addUser");
const modalAddUser = document.getElementById("modal-add-user");
const modalConfirmAddUser = document.getElementById("modal-confirm-add-user");
const modalSuccessAddUser = document.getElementById("modal-success-add-user");
const saveUserBtn = document.getElementById("save-user-btn");
const cancelUserBtn = document.getElementById("cancel-user-btn");
const confirmAddUserBtn = document.getElementById("confirm-add-user-btn");
const cancelConfirmAddUserBtn = document.getElementById("cancel-confirm-add-user-btn");
const closeSuccessBtn = document.getElementById("close-success-btn");
const addAnotherUserBtn = document.getElementById("add-another-user-btn");

if (addUserBtn && modalAddUser) {
  addUserBtn.addEventListener("click", () => {
    // Clear form inputs
    document.getElementById("input-user-name").value = "";
    document.getElementById("input-user-email").value = "";
    document.getElementById("input-user-role").value = "user";
    document.getElementById("input-user-avatar").value = "";
    
    modalAddUser.style.display = "flex";
  });

  // Close modal handlers
  if (cancelUserBtn) {
    cancelUserBtn.addEventListener("click", () => {
      modalAddUser.style.display = "none";
    });
  }

  // Click outside modal to close
  modalAddUser.addEventListener("click", (e) => {
    if (e.target === modalAddUser) {
      modalAddUser.style.display = "none";
    }
  });

  // Save new user - show confirmation modal
  if (saveUserBtn) {
    saveUserBtn.addEventListener("click", async () => {
      const name = document.getElementById("input-user-name").value.trim();
      const email = document.getElementById("input-user-email").value.trim();
      const role = document.getElementById("input-user-role").value;
      const avatarUrl = document.getElementById("input-user-avatar").value.trim();

      // Validation
      if (!name) {
        alert("❌ Please enter a name!");
        return;
      }

      if (!email) {
        alert("❌ Please enter an email address!");
        return;
      }

      // Basic email validation
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        alert("❌ Please enter a valid email address!");
        return;
      }

      // Check if email already exists
      const emailExists = usersCache.find(u => u.email?.toLowerCase() === email.toLowerCase());
      if (emailExists) {
        alert("❌ A user with this email already exists!");
        return;
      }

      // Show confirmation modal with user preview
      document.getElementById("preview-user-name").textContent = name;
      document.getElementById("preview-user-email").textContent = email;
      document.getElementById("preview-user-role").textContent = role.charAt(0).toUpperCase() + role.slice(1);
      
      const previewAvatar = document.getElementById("preview-user-avatar");
      previewAvatar.src = avatarUrl || "image/default-profile.png";
      
      // Hide add user modal and show confirmation modal
      modalAddUser.style.display = "none";
      modalConfirmAddUser.style.display = "flex";
    });
  }
}

// Confirmation modal handlers
if (modalConfirmAddUser) {
  // Cancel confirmation
  if (cancelConfirmAddUserBtn) {
    cancelConfirmAddUserBtn.addEventListener("click", () => {
      modalConfirmAddUser.style.display = "none";
      modalAddUser.style.display = "flex"; // Go back to add user modal
    });
  }

  // Click outside modal to close
  modalConfirmAddUser.addEventListener("click", (e) => {
    if (e.target === modalConfirmAddUser) {
      modalConfirmAddUser.style.display = "none";
      modalAddUser.style.display = "flex"; // Go back to add user modal
    }
  });

  // Confirm add user
  if (confirmAddUserBtn) {
    confirmAddUserBtn.addEventListener("click", async () => {
      const name = document.getElementById("input-user-name").value.trim();
      const email = document.getElementById("input-user-email").value.trim();
      const role = document.getElementById("input-user-role").value;
      const avatarUrl = document.getElementById("input-user-avatar").value.trim();

      try {
        // Show loading state
        confirmAddUserBtn.innerHTML = '<span class="btn-icon">⏳</span><span>Adding User...</span>';
        confirmAddUserBtn.disabled = true;

        // Create user document
        const newUserData = {
          name: name,
          displayName: name,
          email: email,
          role: role,
          photoURL: avatarUrl || null,
          xp: 0,
          level: 1,
          disabled: false,
          createdAt: new Date(),
          createdBy: "admin"
        };

        // Add to Firestore
        const docRef = await addDoc(collection(db, "users"), newUserData);
        
        // Show success modal with user details
        document.getElementById("success-user-name").textContent = name;
        document.getElementById("success-user-email").textContent = email;
        document.getElementById("success-user-role").textContent = role.charAt(0).toUpperCase() + role.slice(1);
        
        modalConfirmAddUser.style.display = "none";
        modalSuccessAddUser.style.display = "flex";
        
        // Reload users list
        await loadUsers();
        
      } catch (error) {
        console.error("Add user error:", error);
        alert("❌ Failed to add user: " + (error.message || error));
      } finally {
        // Reset button state
        confirmAddUserBtn.innerHTML = '<span class="btn-icon">✅</span><span>Yes, Add User</span>';
        confirmAddUserBtn.disabled = false;
      }
    });
  }
}

// Success modal handlers
if (modalSuccessAddUser) {
  // Close success modal
  if (closeSuccessBtn) {
    closeSuccessBtn.addEventListener("click", () => {
      modalSuccessAddUser.style.display = "none";
    });
  }

  // Add another user
  if (addAnotherUserBtn) {
    addAnotherUserBtn.addEventListener("click", () => {
      modalSuccessAddUser.style.display = "none";
      
      // Clear form and show add user modal
      document.getElementById("input-user-name").value = "";
      document.getElementById("input-user-email").value = "";
      document.getElementById("input-user-role").value = "user";
      document.getElementById("input-user-avatar").value = "";
      
      modalAddUser.style.display = "flex";
    });
  }

  // Click outside modal to close
  modalSuccessAddUser.addEventListener("click", (e) => {
    if (e.target === modalSuccessAddUser) {
      modalSuccessAddUser.style.display = "none";
    }
  });
}

// === MODAL EVENT HANDLERS ===

// Edit User Modal Handlers
const modalEditUser = document.getElementById("modal-edit-user");
const saveEditUserBtn = document.getElementById("save-edit-user-btn");
const cancelEditUserBtn = document.getElementById("cancel-edit-user-btn");

if (modalEditUser) {
  // Cancel edit
  if (cancelEditUserBtn) {
    cancelEditUserBtn.addEventListener("click", () => {
      modalEditUser.style.display = "none";
    });
  }

  // Click outside to close
  modalEditUser.addEventListener("click", (e) => {
    if (e.target === modalEditUser) {
      modalEditUser.style.display = "none";
    }
  });

  // Save edit changes
  if (saveEditUserBtn) {
    saveEditUserBtn.addEventListener("click", async () => {
      const newName = document.getElementById("edit-user-name").value.trim();
      const newEmail = document.getElementById("edit-user-email").value.trim();

      if (!newName) {
        alert("❌ Name cannot be empty!");
        return;
      }

      if (!newEmail) {
        alert("❌ Email cannot be empty!");
        return;
      }

      // Basic email validation
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
        alert("❌ Please enter a valid email address!");
        return;
      }

      const user = window.currentEditUser;
      if (user) {
        // Check if email already exists (excluding current user)
        const emailExists = usersCache.find(u => 
          u.id !== user.id && u.email?.toLowerCase() === newEmail.toLowerCase()
        );
        
        if (emailExists) {
          alert(`❌ Email "${newEmail}" is already used by another user: ${emailExists.name || 'Unknown'}`);
          return;
        }

        modalEditUser.style.display = "none";
        await updateUserDetails(user.id, { name: newName, email: newEmail });
      }
    });
  }
}

// Disable/Enable Modal Handlers
const modalConfirmDisable = document.getElementById("modal-confirm-disable");
const confirmDisableBtn = document.getElementById("confirm-disable-btn");
const cancelDisableBtn = document.getElementById("cancel-disable-btn");

if (modalConfirmDisable) {
  // Cancel disable
  if (cancelDisableBtn) {
    cancelDisableBtn.addEventListener("click", () => {
      modalConfirmDisable.style.display = "none";
    });
  }

  // Click outside to close
  modalConfirmDisable.addEventListener("click", (e) => {
    if (e.target === modalConfirmDisable) {
      modalConfirmDisable.style.display = "none";
    }
  });

  // Confirm disable/enable
  if (confirmDisableBtn) {
    confirmDisableBtn.addEventListener("click", async () => {
      const user = window.currentDisableUser;
      const disabled = window.currentDisableAction;
      
      if (user) {
        modalConfirmDisable.style.display = "none";
        await performDisableAction(user.id, disabled, user.name || user.email);
      }
    });
  }
}

// Delete Modal Handlers
const modalConfirmDelete = document.getElementById("modal-confirm-delete");
const confirmDeleteBtn = document.getElementById("confirm-delete-btn");
const cancelDeleteBtn = document.getElementById("cancel-delete-btn");
const deleteConfirmationInput = document.getElementById("delete-confirmation");

if (modalConfirmDelete) {
  // Cancel delete
  if (cancelDeleteBtn) {
    cancelDeleteBtn.addEventListener("click", () => {
      modalConfirmDelete.style.display = "none";
    });
  }

  // Click outside to close
  modalConfirmDelete.addEventListener("click", (e) => {
    if (e.target === modalConfirmDelete) {
      modalConfirmDelete.style.display = "none";
    }
  });

  // Enable/disable delete button based on confirmation text
  if (deleteConfirmationInput) {
    deleteConfirmationInput.addEventListener("input", (e) => {
      const value = e.target.value.toUpperCase();
      const deleteBtn = document.getElementById("confirm-delete-btn");
      
      if (value === "DELETE") {
        deleteBtn.disabled = false;
        deleteBtn.style.opacity = "1";
      } else {
        deleteBtn.disabled = true;
        deleteBtn.style.opacity = "0.5";
      }
    });
  }

  // Confirm delete
  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener("click", async () => {
      const confirmText = document.getElementById("delete-confirmation").value.toUpperCase();
      
      if (confirmText !== "DELETE") {
        alert("❌ Please type 'DELETE' to confirm deletion.");
        return;
      }

      const user = window.currentDeleteUser;
      if (user) {
        modalConfirmDelete.style.display = "none";
        await performUserDeletion(user.id, user.name || user.email);
      }
    });
  }
}

// Success Action Modal Handlers
const modalSuccessAction = document.getElementById("modal-success-action");
const closeSuccessActionBtn = document.getElementById("close-success-action-btn");

if (modalSuccessAction) {
  // Close success modal
  if (closeSuccessActionBtn) {
    closeSuccessActionBtn.addEventListener("click", () => {
      modalSuccessAction.style.display = "none";
    });
  }

  // Click outside to close
  modalSuccessAction.addEventListener("click", (e) => {
    if (e.target === modalSuccessAction) {
      modalSuccessAction.style.display = "none";
    }
  });
}

// === FIX DUPLICATES FUNCTIONALITY ===

// Fix Duplicates Button Handler
const fixDuplicatesBtn = document.getElementById("fixDuplicates");
const modalFixDuplicates = document.getElementById("modal-fix-duplicates");
const applyDuplicateFixesBtn = document.getElementById("apply-duplicate-fixes");
const cancelDuplicateFixesBtn = document.getElementById("cancel-duplicate-fixes");

if (fixDuplicatesBtn && modalFixDuplicates) {
  fixDuplicatesBtn.addEventListener("click", () => {
    showDuplicatesModal();
  });

  // Cancel fixes
  if (cancelDuplicateFixesBtn) {
    cancelDuplicateFixesBtn.addEventListener("click", () => {
      modalFixDuplicates.style.display = "none";
    });
  }

  // Apply fixes
  if (applyDuplicateFixesBtn) {
    applyDuplicateFixesBtn.addEventListener("click", async () => {
      await applyDuplicateFixes();
    });
  }

  // Click outside to close
  modalFixDuplicates.addEventListener("click", (e) => {
    if (e.target === modalFixDuplicates) {
      modalFixDuplicates.style.display = "none";
    }
  });
}

function showDuplicatesModal() {
  const duplicatesContainer = document.getElementById("duplicates-list");
  duplicatesContainer.innerHTML = "";
  
  // Group users by email
  const emailGroups = {};
  usersCache.forEach(u => {
    if (u.email) {
      const email = u.email.toLowerCase();
      if (!emailGroups[email]) emailGroups[email] = [];
      emailGroups[email].push(u);
    }
  });
  
  // Show only groups with duplicates
  Object.entries(emailGroups).forEach(([email, users]) => {
    if (users.length > 1) {
      const groupDiv = document.createElement("div");
      groupDiv.className = "duplicate-group";
      
      groupDiv.innerHTML = `
        <h4>📧 ${email} (${users.length} users)</h4>
        ${users.map((user, index) => `
          <div class="duplicate-user">
            <input type="radio" name="keep-${email}" value="${user.id}" ${index === 0 ? 'checked' : ''}>
            <div class="duplicate-user-info">
              <img src="${user.photoURL || 'image/default-profile.png'}" alt="Avatar">
              <div class="duplicate-user-details">
                <h5>${user.name || 'No Name'}</h5>
                <p>Role: ${user.role || 'user'} | Created: ${user.createdAt ? new Date(user.createdAt.seconds * 1000).toLocaleDateString() : 'Unknown'}</p>
              </div>
            </div>
          </div>
        `).join('')}
      `;
      
      duplicatesContainer.appendChild(groupDiv);
    }
  });
  
  modalFixDuplicates.style.display = "flex";
}

async function applyDuplicateFixes() {
  const duplicatesContainer = document.getElementById("duplicates-list");
  const radioInputs = duplicatesContainer.querySelectorAll('input[type="radio"]:checked');
  
  if (radioInputs.length === 0) {
    alert("❌ Please select which users to keep!");
    return;
  }
  
  const keepUserIds = Array.from(radioInputs).map(input => input.value);
  const deleteUserIds = usersCache
    .filter(u => !keepUserIds.includes(u.id))
    .filter(u => {
      // Only delete if this user's email has duplicates
      const email = u.email?.toLowerCase();
      const sameEmailUsers = usersCache.filter(other => other.email?.toLowerCase() === email);
      return sameEmailUsers.length > 1;
    })
    .map(u => u.id);
  
  if (!confirm(`This will delete ${deleteUserIds.length} duplicate users. Are you sure?`)) {
    return;
  }
  
  try {
    // Delete duplicate users
    for (const userId of deleteUserIds) {
      await updateDoc(doc(db, "users", userId), { 
        deleted: true, 
        deletedAt: new Date(),
        deletedReason: "Duplicate email cleanup"
      });
    }
    
    modalFixDuplicates.style.display = "none";
    showSuccessModal(`${deleteUserIds.length} duplicate users`, 'Removed');
    await loadUsers();
    
  } catch (error) {
    console.error("Fix duplicates error:", error);
    alert("❌ Failed to fix duplicates: " + (error.message || error));
  }
}

// expose signOut for admin-common.js
window.firebaseSignOut = async function () {
  try {
    await signOut(auth);
  } catch (e) {
    console.error("firebaseSignOut error:", e);
    throw e;
  }
};