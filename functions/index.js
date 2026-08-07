const functions = require('firebase-functions');
const admin = require('firebase-admin');
const crypto = require('crypto');

admin.initializeApp();

const MAX_ADMINS = 5;

// Helper to check if caller is Super Admin
async function checkSuperAdmin(context) {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
  }
  if (context.auth.token.role !== 'superadmin') {
    throw new functions.https.HttpsError('permission-denied', 'Only Super Admins can perform this action.');
  }
}

// Generate a random temporary password
function generatePassword() {
  return crypto.randomBytes(6).toString('hex'); // 12 character hex string
}

exports.inviteAdmin = functions.https.onCall(async (data, context) => {
  await checkSuperAdmin(context);

  const email = data.email;
  if (!email || typeof email !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'Valid email address is required.');
  }

  // Check admin limit
  const adminsSnapshot = await admin.firestore().collection('adminMeta').get();
  if (adminsSnapshot.size >= MAX_ADMINS) {
    throw new functions.https.HttpsError('failed-precondition', `Maximum number of admins (${MAX_ADMINS}) reached.`);
  }

  try {
    const temporaryPassword = generatePassword();
    
    // Create the user in Auth
    const userRecord = await admin.auth().createUser({
      email: email,
      password: temporaryPassword,
      emailVerified: true
    });

    // Set custom claims
    await admin.auth().setCustomUserClaims(userRecord.uid, { role: 'admin' });

    // Store in adminMeta
    await admin.firestore().collection('adminMeta').doc(userRecord.uid).set({
      role: 'admin',
      needsPasswordReset: true,
      invitedBy: context.auth.uid,
      invitedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return {
      message: 'Admin invited successfully.',
      uid: userRecord.uid,
      email: userRecord.email,
      temporaryPassword: temporaryPassword
    };
  } catch (error) {
    console.error('Error inviting admin:', error);
    if (error.code === 'auth/email-already-exists') {
      throw new functions.https.HttpsError('already-exists', 'The email address is already in use by another account.');
    }
    throw new functions.https.HttpsError('internal', 'An error occurred while creating the admin.');
  }
});

exports.getAdminList = functions.https.onCall(async (data, context) => {
  await checkSuperAdmin(context);

  try {
    const adminDocs = await admin.firestore().collection('adminMeta').get();
    const adminList = [];

    for (const doc of adminDocs.docs) {
      const meta = doc.data();
      try {
        const userRecord = await admin.auth().getUser(doc.id);
        adminList.push({
          uid: userRecord.uid,
          email: userRecord.email,
          role: meta.role,
          needsPasswordReset: meta.needsPasswordReset,
          invitedAt: meta.invitedAt ? meta.invitedAt.toDate().toISOString() : null
        });
      } catch (authErr) {
        // User might be deleted from auth but not firestore, or just log it
        console.warn(`Could not fetch Auth data for UID: ${doc.id}`);
      }
    }

    return { admins: adminList };
  } catch (error) {
    console.error('Error fetching admin list:', error);
    throw new functions.https.HttpsError('internal', 'Could not fetch admin list.');
  }
});

exports.deleteAdmin = functions.https.onCall(async (data, context) => {
  await checkSuperAdmin(context);

  const uidToDelete = data.uid;
  if (!uidToDelete) {
    throw new functions.https.HttpsError('invalid-argument', 'UID of admin to delete is required.');
  }

  if (uidToDelete === context.auth.uid) {
    throw new functions.https.HttpsError('invalid-argument', 'You cannot delete yourself.');
  }

  try {
    // Check if the target is a superadmin
    const targetMetaDoc = await admin.firestore().collection('adminMeta').doc(uidToDelete).get();
    if (targetMetaDoc.exists && targetMetaDoc.data().role === 'superadmin') {
       throw new functions.https.HttpsError('permission-denied', 'You cannot delete another Super Admin.');
    }

    // Delete from Auth
    await admin.auth().deleteUser(uidToDelete);

    // Delete from Firestore
    await admin.firestore().collection('adminMeta').doc(uidToDelete).delete();

    return { message: 'Admin deleted successfully.' };
  } catch (error) {
    console.error('Error deleting admin:', error);
    throw new functions.https.HttpsError('internal', 'Could not delete admin.');
  }
});

// TEMPORARY: Bootstrap Super Admin via HTTP request to bypass local credential errors
exports.bootstrapSuperAdmin = functions.https.onRequest(async (req, res) => {
  const SUPER_ADMIN_EMAIL = 'connect.thesode@gmail.com';
  
  try {
    let userRecord;
    try {
      userRecord = await admin.auth().getUserByEmail(SUPER_ADMIN_EMAIL);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        userRecord = await admin.auth().createUser({
          email: SUPER_ADMIN_EMAIL,
          emailVerified: true
        });
      } else {
        throw error;
      }
    }

    // Set superadmin claim
    await admin.auth().setCustomUserClaims(userRecord.uid, { role: 'superadmin' });

    // Store in adminMeta
    await admin.firestore().collection('adminMeta').doc(userRecord.uid).set({
      role: 'superadmin',
      needsPasswordReset: false,
      invitedAt: admin.firestore.FieldValue.serverTimestamp(),
      invitedBy: 'system_bootstrap'
    });

    res.status(200).send(`<h2>✅ Success!</h2><p>${SUPER_ADMIN_EMAIL} is now the Super Admin.</p><p>You can close this page and log into the admin panel via Google Sign-In.</p>`);
  } catch (error) {
    console.error("Bootstrap Error:", error);
    res.status(500).send(`<h2>❌ Error</h2><p>${error.message}</p>`);
  }
});
