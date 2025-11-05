// Script to set random XP values for testing
import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(readFileSync('./firebase-service-account.json', 'utf8'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function setXP() {
  try {
    const usersRef = db.collection('users');
    const snapshot = await usersRef.get();
    
    console.log(`Found ${snapshot.size} users`);
    
    const batch = db.batch();
    let count = 0;
    
    for (const doc of snapshot.docs) {
      const randomXP = Math.floor(Math.random() * 500); // 0-500 XP
      const level = Math.floor(randomXP / 100) + 1; // Calculate level
      
      batch.update(doc.ref, {
        xp: randomXP,
        level: level
      });
      
      console.log(`✅ ${doc.data().displayName || doc.data().email}: XP = ${randomXP}, Level = ${level}`);
      count++;
    }
    
    await batch.commit();
    console.log(`\n✅ Updated ${count} users with XP values!`);
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

setXP();
