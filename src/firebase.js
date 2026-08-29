const admin = require("firebase-admin");

function initFirebase() {
  if (admin.apps.length) return admin.database();

  let credential;

  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    credential = admin.credential.cert(
      JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
    );
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    credential = admin.credential.cert(
      require(require("path").resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH))
    );
  } else {
    throw new Error(
      "Firebase credentials missing. Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH."
    );
  }

  admin.initializeApp({
    credential,
    databaseURL:
      process.env.FIREBASE_DATABASE_URL ||
      "https://tournamentorganizer08-default-rtdb.asia-southeast1.firebasedatabase.app"
  });

  return admin.database();
}

module.exports = { admin, initFirebase };
