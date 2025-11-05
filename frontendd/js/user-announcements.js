// User Announcements System
import { db } from './firebase-config.js';
import { collection, query, where, getDocs } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';

// Check and display announcements
export async function checkAnnouncements() {
  try {
    const announcementsRef = collection(db, 'announcements');
    const q = query(
      announcementsRef,
      where('active', '==', true)
    );
    
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
      // Sort manually in JS to avoid Firestore index requirement
      const announcements = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => {
          const timeA = a.timestamp?.toDate().getTime() || 0;
          const timeB = b.timestamp?.toDate().getTime() || 0;
          return timeB - timeA; // newest first
        });
      
      const announcement = announcements[0];
      showAnnouncementModal(announcement);
    }
  } catch (error) {
    console.error('Error loading announcements:', error);
  }
}

// Show announcement modal
function showAnnouncementModal(announcement) {
  // Check if user already saw this announcement
  const lastSeenId = localStorage.getItem('lastSeenAnnouncement');
  const currentId = announcement.timestamp?.toDate().getTime() || Date.now();
  
  if (lastSeenId === currentId.toString()) {
    return; // Already seen
  }
  
  // Create modal
  const modal = document.createElement('div');
  modal.id = 'announcement-modal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.9);
    backdrop-filter: blur(10px);
    z-index: 99999;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: fadeIn 0.3s ease;
  `;
  
  const urgentClass = announcement.urgent ? 'urgent' : '';
  
  modal.innerHTML = `
    <div style="
      background: linear-gradient(135deg, rgba(10, 25, 45, 0.98), rgba(5, 15, 30, 0.98));
      border: 3px solid ${announcement.urgent ? '#ff3333' : '#00ffff'};
      border-radius: 15px;
      max-width: 600px;
      width: 90%;
      padding: 0;
      box-shadow: 0 0 50px ${announcement.urgent ? 'rgba(255, 51, 51, 0.5)' : 'rgba(0, 255, 255, 0.5)'};
      animation: slideIn 0.4s ease;
    ">
      <div style="
        padding: 25px 30px;
        border-bottom: 2px solid rgba(0, 255, 255, 0.3);
        display: flex;
        align-items: center;
        gap: 15px;
        background: ${announcement.urgent ? 'rgba(255, 0, 0, 0.1)' : 'rgba(0, 255, 255, 0.05)'};
      ">
        <span style="font-size: 2rem;">📢</span>
        <h2 style="
          flex: 1;
          margin: 0;
          color: ${announcement.urgent ? '#ff3333' : '#00ffff'};
          font-family: 'Orbitron', sans-serif;
          font-size: 1.5rem;
          text-shadow: 0 0 10px ${announcement.urgent ? 'rgba(255, 51, 51, 0.5)' : 'rgba(0, 255, 255, 0.5)'};
        ">${announcement.title || 'Announcement'}</h2>
        ${announcement.urgent ? '<span style="background: #ff3333; color: #fff; padding: 5px 12px; border-radius: 5px; font-size: 0.8rem; font-weight: bold;">URGENT</span>' : ''}
      </div>
      
      <div style="padding: 30px;">
        <p style="
          color: rgba(255, 255, 255, 0.9);
          font-size: 1.1rem;
          line-height: 1.8;
          margin: 0;
          white-space: pre-wrap;
        ">${announcement.message || ''}</p>
      </div>
      
      <div style="
        padding: 20px 30px;
        border-top: 2px solid rgba(0, 255, 255, 0.3);
        display: flex;
        justify-content: flex-end;
      ">
        <button id="close-announcement-btn" style="
          padding: 12px 30px;
          background: linear-gradient(135deg, #00ffff, #0088ff);
          color: #000;
          border: 2px solid #00ffff;
          border-radius: 8px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          font-family: 'Orbitron', sans-serif;
          transition: all 0.3s ease;
        ">Got it!</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Close button handler
  document.getElementById('close-announcement-btn').addEventListener('click', () => {
    localStorage.setItem('lastSeenAnnouncement', currentId.toString());
    modal.style.animation = 'fadeOut 0.3s ease';
    setTimeout(() => modal.remove(), 300);
  });
  
  // Add animations
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes fadeOut {
      from { opacity: 1; }
      to { opacity: 0; }
    }
    @keyframes slideIn {
      from { transform: translateY(-30px) scale(0.95); opacity: 0; }
      to { transform: translateY(0) scale(1); opacity: 1; }
    }
    #close-announcement-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 5px 20px rgba(0, 255, 255, 0.5);
    }
  `;
  document.head.appendChild(style);
}
