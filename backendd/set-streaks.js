// Script to set random login streak values
import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('./firebase-service-account.json', 'utf8'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function setStreaks() {
  try {
    const usersRef = db.collection('users');
    const snapshot = await usersRef.get();
    
    console.log(`Found ${snapshot.size} users`);
    
    const batch = db.batch();
    let count = 0;
    
    for (const doc of snapshot.docs) {
      const randomStreak = Math.floor(Math.random() * 30); // 0-30 days
      
      batch.update(doc.ref, {
        loginStreak: randomStreak,
        lastLogin: new Date().toISOString()
      });
      
      console.log(`✅ ${doc.data().displayName || doc.data().email}: Streak = ${randomStreak} days`);
      count++;
    }
    
    await batch.commit();
    console.log(`\n✅ Updated ${count} users with login streaks!`);
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

setStreaks();
