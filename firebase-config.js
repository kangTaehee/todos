// Firebase 콘솔(console.firebase.google.com)에서 프로젝트 설정 > 앱 추가 > 웹 앱에서 복사한 값으로 교체하세요
  const firebaseConfig = {
    apiKey: "AIzaSyBIvHRHL0NUSfZw77-I-FUOoIwIFDZ_jlI",
    authDomain: "toodo-31021.firebaseapp.com",
    projectId: "toodo-31021",
    storageBucket: "toodo-31021.firebasestorage.app",
    messagingSenderId: "349933996409",
    appId: "1:349933996409:web:02d4e79bad161fa67947a8",
    measurementId: "G-VLHYXXL69C"
  };

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
