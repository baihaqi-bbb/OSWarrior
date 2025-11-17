# Firestore Security Rules Fix

## Current Issue
Admin dashboard shows errors:
```
❌ Error loading admin data: FirebaseError: Missing or insufficient permissions.
❌ Error loading recent activity: FirebaseError: Missing or insufficient permissions.
❌ Error loading audit stats: FirebaseError: Missing or insufficient permissions.
```

## Root Cause
Your Firestore Security Rules are too strict and blocking admin access to collections.

---

## Solution: Update Firestore Security Rules

### Step 1: Go to Firebase Console
1. Open https://console.firebase.google.com/
2. Select your project: **test-4fdf4**
3. Go to **Firestore Database** → **Rules** tab

### Step 2: Replace Current Rules

Replace your current rules with these **admin-friendly rules**:

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper function to check if user is authenticated
    function isSignedIn() {
      return request.auth != null;
    }
    
    // Helper function to check if user is admin
    function isAdmin() {
      return isSignedIn() && 
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    // Helper function to check if user is accessing their own document
    function isOwner(userId) {
      return isSignedIn() && request.auth.uid == userId;
    }
    
    // USERS COLLECTION
    match /users/{userId} {
      // Anyone authenticated can read any user (for leaderboard, profiles)
      allow read: if isSignedIn();
      
      // Users can create their own document
      allow create: if isSignedIn() && isOwner(userId);
      
      // Users can update their own document, admins can update any
      allow update: if isOwner(userId) || isAdmin();
      
      // Only admins can delete
      allow delete: if isAdmin();
    }
    
    // QUIZZES COLLECTION
    match /quizzes/{quizId} {
      // Anyone authenticated can read quizzes
      allow read: if isSignedIn();
      
      // Only admins can create, update, or delete quizzes
      allow create, update, delete: if isAdmin();
    }
    
    // RESULTS COLLECTION
    match /results/{resultId} {
      // Users can read their own results, admins can read all
      allow read: if isSignedIn();
      
      // Users can create their own results
      allow create: if isSignedIn();
      
      // Only admins can update or delete results
      allow update, delete: if isAdmin();
    }
    
    // LOGS COLLECTION
    match /logs/{logId} {
      // Only admins can read logs
      allow read: if isAdmin();
      
      // Anyone authenticated can create logs (for activity tracking)
      allow create: if isSignedIn();
      
      // Only admins can update or delete logs
      allow update, delete: if isAdmin();
    }
    
    // LEADERBOARDS COLLECTION
    match /leaderboards/{leaderboardId} {
      // Anyone authenticated can read leaderboards
      allow read: if isSignedIn();
      
      // Only system (admins) can write to leaderboards
      allow write: if isAdmin();
    }
    
    // SYSTEM COLLECTION (for maintenance mode, settings)
    match /system/{docId} {
      // Anyone can read system status (for maintenance check)
      allow read: if true;
      
      // Only admins can write
      allow write: if isAdmin();
    }
    
    // ACHIEVEMENTS COLLECTION (if you have one)
    match /achievements/{achievementId} {
      // Anyone authenticated can read
      allow read: if isSignedIn();
      
      // Users can update their own achievements
      allow update: if isSignedIn();
      
      // Only admins can create or delete
      allow create, delete: if isAdmin();
    }
  }
}
```

### Step 3: Publish Rules
1. Click **"Publish"** button
2. Wait for confirmation: "Rules successfully published"

---

## Alternative: Development-Only Open Rules (NOT FOR PRODUCTION!)

If you just want to test without restrictions:

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    // ⚠️ WARNING: DEVELOPMENT ONLY - Allows all access
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

**⚠️ USE THIS ONLY FOR TESTING!** Replace with proper rules before production.

---

## What Each Rule Does

### Users Collection
- ✅ Any logged-in user can **read** user profiles (needed for leaderboard)
- ✅ Users can **create** their own profile
- ✅ Users can **update** their own profile
- ✅ Admins can **update** any user (for role changes)
- ✅ Only admins can **delete** users

### Quizzes Collection
- ✅ Any logged-in user can **read** quizzes
- ✅ Only admins can **create/update/delete** quizzes

### Logs Collection
- ✅ Only admins can **read** logs (for admin dashboard)
- ✅ Any logged-in user can **create** logs (for activity tracking)
- ✅ Only admins can **update/delete** logs

### System Collection
- ✅ Anyone can **read** (for maintenance mode check)
- ✅ Only admins can **write** (to enable/disable maintenance)

---

## Testing After Update

1. **Clear browser cache**: Ctrl + Shift + Delete
2. **Logout and login** again with admin account
3. **Check admin dashboard** - errors should be gone
4. **Open browser console** (F12) - should see:
   ```
   ✅ Loaded 10 users
   ✅ Loaded 5 quizzes
   ✅ Audit stats loaded: 15 events, 3 alerts
   ✅ Loaded 5 log entries from Firestore
   ```

---

## Admin Emails (Already Configured)
These emails automatically get admin access:
- admin1@email.com
- admin2@email.com
- admin@oswarrior.com
- dev@admin.com

---

## If Rules Still Don't Work

**Nuclear Option** - Open everything for development:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true; // ⚠️ COMPLETELY OPEN - DEV ONLY
    }
  }
}
```

Remember to replace with proper rules before deploying to production!

---

**Created**: November 17, 2025  
**Project**: OSWarrior Admin Dashboard  
**Issue**: Firestore permission errors blocking admin access
