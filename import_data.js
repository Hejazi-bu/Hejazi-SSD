const { initializeApp } = require('firebase/app');
const { getFirestore, collection, doc, setDoc } = require('firebase/firestore');
require('dotenv').config(); // تأكد من تثبيت مكتبة dotenv واستدعائها

const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

const data = require('./firestore_data.json');

async function importSecurityQuestions() {
    console.log('Starting import for security_questions ONLY...');
    
    // --- تم التعديل هنا ---
    // حددنا اسم الجدول المطلوب مباشرة
    const collectionName = 'security_questions';
    const items = data[collectionName];

    if (items && items.length > 0) {
        console.log(`Found ${items.length} questions to import into collection: ${collectionName}`);
        
        for (const item of items) {
            if (item.id) {
                // نستخدم ID الموجود في الملف لإنشاء المستند بنفس الـ ID
                const docRef = doc(collection(db, collectionName), String(item.id));
                await setDoc(docRef, item);
                console.log(`  -> Imported question with ID: ${item.id}`);
            } else {
                // في حالة عدم وجود ID (كود احتياطي، لن يتم استخدامه مع بياناتك الحالية)
                await setDoc(doc(collection(db, collectionName)), item);
            }
        }
        console.log(`Collection ${collectionName} imported successfully!`);
    } else {
        console.log(`Collection ${collectionName} not found in JSON file or is empty.`);
    }
    // --- نهاية التعديل ---
    
    console.log('Import process finished.');
}

importSecurityQuestions().catch(error => {
    console.error("Error importing data: ", error);
});