// System Maintenance Check
import { db, auth } from './firebase-config.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';

export async function checkMaintenanceMode(checkAdminRole = false) {
  try {
    const maintenanceRef = doc(db, 'system', 'maintenance');
    const maintenanceDoc = await getDoc(maintenanceRef);
    
    if (maintenanceDoc.exists() && maintenanceDoc.data().enabled === true) {
      // If checking admin role, allow admins to bypass
      if (checkAdminRole && auth.currentUser) {
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        const isAdmin = userDoc.exists() && userDoc.data().role === 'admin';
        if (isAdmin) {
          return false; // Allow admin to bypass
        }
      }
      
      showMaintenanceModal();
      return true; // Maintenance mode is active
    }
    return false;
  } catch (error) {
    console.error('Error checking maintenance mode:', error);
    return false;
  }
}

function showMaintenanceModal() {
  // Remove existing modal if any
  const existing = document.getElementById('maintenance-modal');
  if (existing) existing.remove();
  
  const modal = document.createElement('div');
  modal.id = 'maintenance-modal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.95);
    backdrop-filter: blur(15px);
    z-index: 999999;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: fadeIn 0.3s ease;
  `;
  
  modal.innerHTML = `
    <div style="
      background: linear-gradient(135deg, rgba(30, 15, 45, 0.98), rgba(15, 5, 25, 0.98));
      border: 3px solid #ff9900;
      border-radius: 20px;
      max-width: 650px;
      width: 90%;
      padding: 0;
      box-shadow: 0 0 80px rgba(255, 153, 0, 0.6);
      animation: slideIn 0.4s ease;
      text-align: center;
    ">
      <div style="padding: 40px;">
        <div style="
          font-size: 5rem;
          margin-bottom: 20px;
          animation: pulse 2s ease infinite;
        ">⚠️</div>
        
        <h1 style="
          color: #ff9900;
          font-family: 'Orbitron', sans-serif;
          font-size: 2.5rem;
          margin: 0 0 20px 0;
          text-shadow: 0 0 20px rgba(255, 153, 0, 0.8);
        ">SYSTEM MAINTENANCE</h1>
        
        <p style="
          color: rgba(255, 255, 255, 0.9);
          font-size: 1.2rem;
          line-height: 1.8;
          margin: 20px 0;
        ">
          Our system is currently undergoing maintenance to improve your experience.
          <br><br>
          <strong style="color: #00ffff;">Please check back later.</strong>
        </p>
        
        <div style="
          margin-top: 30px;
          padding: 20px;
          background: rgba(255, 153, 0, 0.1);
          border-radius: 10px;
          border: 1px solid rgba(255, 153, 0, 0.3);
        ">
          <p style="
            color: rgba(255, 255, 255, 0.7);
            font-size: 0.9rem;
            margin: 0;
          ">
            If you're an administrator, please login with your admin account.
          </p>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Add animations
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes slideIn {
      from { transform: translateY(-50px) scale(0.9); opacity: 0; }
      to { transform: translateY(0) scale(1); opacity: 1; }
    }
    @keyframes pulse {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.1); opacity: 0.8; }
    }
  `;
  document.head.appendChild(style);
  
  // Block all interactions except admin login
  document.body.style.overflow = 'hidden';
}
