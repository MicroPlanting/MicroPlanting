// Fill the REPLACE_ values from Firebase Console > Project settings > Your apps > Web app.
export const firebaseConfig = {
  apiKey: "REPLACE_WITH_REAL_WEB_API_KEY",
  authDomain: "microplanting.firebaseapp.com",
  databaseURL: "https://microplanting-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "microplanting",
  messagingSenderId: "REPLACE_WITH_SENDER_ID",
  appId: "REPLACE_WITH_APP_ID"
};
export const THRESH = { temp: 35, gas: 1000 };
export const STALE_S = 45, OFFLINE_S = 120;
