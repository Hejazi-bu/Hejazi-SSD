const { initializeApp } = require('firebase/app');
const { getFirestore, collection, doc, setDoc } = require('firebase/firestore');

const firebaseConfig = {
    apiKey: "AIzaSyAaP_skZH15nFpkUh4l8xW3JWALQyG0E0Y",
    authDomain: "hejazi-ssd.firebaseapp.com",
    projectId: "hejazi-ssd",
    storageBucket: "hejazi-ssd.firebasestorage.app",
    messagingSenderId: "880985922577",
    appId: "1:880985922577:web:ec6db20848d692195625b0"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

const data = require('./firestore_data.json');

async function importData() {
    console.log('Starting data import...');

    // Firestore Client SDK يتطلب أن تكون القواعد (Security Rules) مفتوحة لإدخال البيانات
    // تأكد من أن قواعدك تسمح بالوصول للقراءة والكتابة
    
    for (const collectionName in data) {
        if (Object.hasOwnProperty.call(data, collectionName)) {
            const items = data[collectionName];
            if (items && items.length > 0) {
                console.log(`Starting import for collection: ${collectionName}`);
                for (const item of items) {
                    if (item.id) {
                        const docRef = doc(collection(db, collectionName), String(item.id));
                        await setDoc(docRef, item);
                    } else {
                        await setDoc(doc(collection(db, collectionName)), item);
                    }
                }
            } else {
                console.log(`Collection ${collectionName} has no data, skipping.`);
            }
        }
    }
    console.log('All data imported successfully!');
}

importData().catch(error => {
    console.error("Error importing data: ", error);
});