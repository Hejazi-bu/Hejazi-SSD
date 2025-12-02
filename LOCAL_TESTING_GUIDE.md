# 🧪 دليل الاختبار المحلي - Firebase Emulators

## 📋 المتطلبات الأساسية

### 1. تثبيت Firebase Emulators

```bash
# إذا لم يكن مثبتاً بالفعل
npm install -g firebase-tools

# تسجيل الدخول
firebase login

# تهيئة الـ Emulators
firebase init emulators
```

**اختر**:
- ✅ Functions Emulator
- ✅ Firestore Emulator
- ✅ Authentication Emulator (اختياري)

---

## 🚀 الخطوة 1: تشغيل الـ Emulators

### طريقة 1: تشغيل كل شيء (موصى بها)

```bash
cd /home/user/Hejazi-SSD

# تشغيل جميع الـ Emulators
firebase emulators:start
```

### طريقة 2: تشغيل Functions فقط

```bash
# إذا كنت تريد اختبار Functions فقط
firebase emulators:start --only functions,firestore
```

**النتيجة المتوقعة**:
```
✔  functions: Emulator started at http://127.0.0.1:5001
✔  firestore: Emulator started at http://127.0.0.1:8080
✔  ui: Emulator UI started at http://127.0.0.1:4000
```

---

## 🔍 الخطوة 2: فحص الـ Emulator UI

افتح المتصفح على:
```
http://127.0.0.1:4000
```

**ستجد**:
- 📊 **Functions**: قائمة بجميع الـ Functions المنشورة
- 🔥 **Firestore**: بيانات قاعدة البيانات المحلية
- 📜 **Logs**: سجلات Cloud Functions الحية
- 👤 **Authentication**: المستخدمين المحليين

---

## 🧪 الخطوة 3: اختبار الـ Functions

### أ) اختبار من خلال REST API

استخدم `curl` أو Postman:

```bash
# مثال: اختبار getUserEffectivePermissions
curl -X POST \
  http://127.0.0.1:5001/hejazi-ssd/us-central1/getUserEffectivePermissions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TEST_TOKEN" \
  -d '{}'
```

### ب) اختبار باستخدام Firebase Admin SDK

أنشئ ملف اختبار:

```bash
cd /home/user/Hejazi-SSD
nano test-local-functions.js
```

```javascript
const admin = require('firebase-admin');

// الاتصال بالـ Emulator
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

admin.initializeApp({
  projectId: 'hejazi-ssd'
});

const db = admin.firestore();

async function testPermissions() {
  try {
    // 1. إنشاء وظيفة تجريبية
    const jobRef = await db.collection('jobs').add({
      name_ar: 'مدير أمن',
      name_en: 'Security Manager',
      created_at: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log('✅ Job created:', jobRef.id);

    // 2. إضافة صلاحية للوظيفة
    const permRef = await db.collection('job_permissions').add({
      job_id: jobRef.id,
      service_id: '1',
      sub_service_id: null,
      sub_sub_service_id: null,
      scope_company_id: 'company_1',
      scope_department_id: 'dept_1',
      created_at: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log('✅ Permission created:', permRef.id);

    // 3. إنشاء مستخدم تجريبي
    const userRef = await db.collection('users').add({
      name_ar: 'أحمد محمد',
      name_en: 'Ahmed Mohammed',
      job_id: jobRef.id,
      company_id: 'company_1',
      department_id: 'dept_1',
      is_super_admin: false,
      created_at: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log('✅ User created:', userRef.id);

    // 4. الانتظار قليلاً للـ Trigger
    console.log('\n⏳ Waiting for trigger...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 5. التحقق من الإشعار
    const notifications = await db.collection('users')
      .doc(userRef.id)
      .collection('notifications')
      .get();

    console.log(`\n📬 Found ${notifications.size} notification(s)`);
    notifications.forEach(doc => {
      const data = doc.data();
      console.log('  -', data.message_ar);
      console.log('    Type:', data.permissionType);
      console.log('    Change:', data.changeType);
    });

    console.log('\n✅ Test completed successfully!');
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testPermissions();
```

**تشغيل الاختبار**:
```bash
node test-local-functions.js
```

---

## 🎯 الخطوة 4: اختبار الـ Triggers

### اختبار Trigger: onJobPermissionChangeNotify

```bash
# افتح terminal جديد ونفذ
cd /home/user/Hejazi-SSD
nano test-triggers.js
```

```javascript
const admin = require('firebase-admin');
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';

admin.initializeApp({ projectId: 'hejazi-ssd' });
const db = admin.firestore();

async function testTrigger() {
  console.log('🧪 Testing Permission Change Trigger...\n');

  // 1. إنشاء وظيفة
  const jobDoc = await db.collection('jobs').add({
    name_ar: 'مشرف أمن',
    name_en: 'Security Supervisor'
  });
  console.log('1️⃣ Job created:', jobDoc.id);

  // 2. إنشاء مستخدم في هذه الوظيفة
  const userDoc = await db.collection('users').add({
    name_ar: 'خالد علي',
    job_id: jobDoc.id,
    company_id: 'comp_1',
    department_id: 'dept_1'
  });
  console.log('2️⃣ User created:', userDoc.id);

  // 3. إضافة صلاحية (سيُطلق الـ Trigger)
  console.log('\n⚡ Triggering permission change...');
  const permDoc = await db.collection('job_permissions').add({
    job_id: jobDoc.id,
    service_id: '5',
    sub_service_id: null,
    sub_sub_service_id: null,
    scope_company_id: 'comp_1',
    scope_department_id: 'dept_1',
    created_at: admin.firestore.FieldValue.serverTimestamp()
  });
  console.log('3️⃣ Permission created:', permDoc.id);

  // 4. الانتظار للـ Trigger
  console.log('\n⏳ Waiting 5 seconds for trigger...');
  await new Promise(r => setTimeout(r, 5000));

  // 5. التحقق من الإشعار
  const notifications = await db
    .collection('users').doc(userDoc.id)
    .collection('notifications')
    .where('type', '==', 'permission_change')
    .get();

  console.log(`\n📬 Notifications: ${notifications.size}`);

  if (notifications.empty) {
    console.log('⚠️  No notifications found. Check Emulator logs.');
  } else {
    notifications.forEach(doc => {
      const n = doc.data();
      console.log('\n✅ Notification received:');
      console.log('   Type:', n.permissionType);
      console.log('   Change:', n.changeType);
      console.log('   Message (AR):', n.message_ar);
      console.log('   Message (EN):', n.message_en);
      console.log('   Resource:', n.resourceKey);
    });
  }

  console.log('\n✅ Trigger test complete!');
}

testTrigger().catch(console.error);
```

**التشغيل**:
```bash
node test-triggers.js
```

---

## 🖥️ الخطوة 5: ربط الواجهة الأمامية بالـ Emulator

### في ملف Firebase config (src/lib/firebase.ts):

```typescript
import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  // ... باقي الإعدادات
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app);

// 🔥 الاتصال بالـ Emulators (للتطوير فقط)
if (import.meta.env.DEV) {
  console.log('🧪 Connected to Firebase Emulators');

  connectAuthEmulator(auth, 'http://localhost:9099');
  connectFirestoreEmulator(db, 'localhost', 8080);
  connectFunctionsEmulator(functions, 'localhost', 5001);
}

export { auth, db, functions };
```

**الآن شغّل التطبيق**:
```bash
cd /home/user/Hejazi-SSD
npm run dev
```

---

## 📊 الخطوة 6: مراقبة الـ Logs

### في Terminal الـ Emulators:

ستشاهد Logs مباشرة:
```
i  functions: Beginning execution of "onJobPermissionChangeNotify"
i  functions: ✅ Job permission change notification sent for job_id: abc123
```

### أو استخدم:
```bash
# في terminal منفصل
firebase emulators:logs
```

---

## 🧪 اختبار سريع للإشعارات

### سكريبت اختبار سريع:

```bash
nano quick-test.js
```

```javascript
const admin = require('firebase-admin');
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';

admin.initializeApp({ projectId: 'hejazi-ssd' });
const db = admin.firestore();

async function quickTest() {
  // إنشاء بيانات تجريبية بسرعة
  const job = await db.collection('jobs').add({ name_ar: 'Test Job' });
  const user = await db.collection('users').add({
    job_id: job.id,
    company_id: 'c1',
    department_id: 'd1'
  });

  // إطلاق الـ Trigger
  await db.collection('job_permissions').add({
    job_id: job.id,
    service_id: '1',
    scope_company_id: 'c1',
    scope_department_id: 'd1'
  });

  console.log('⏳ Waiting...');
  await new Promise(r => setTimeout(r, 3000));

  const notifs = await db.collection(`users/${user.id}/notifications`).get();
  console.log(`📬 Notifications: ${notifs.size}`);
  notifs.forEach(d => console.log('  -', d.data().message_ar));
}

quickTest();
```

---

## 📝 نصائح للاختبار

### 1. **تنظيف البيانات بين الاختبارات**:
```bash
# مسح جميع البيانات في الـ Emulator
# أعد تشغيل الـ Emulator
# أو استخدم:
firebase emulators:start --import=./emulator-data --export-on-exit
```

### 2. **استيراد بيانات تجريبية**:
```bash
# إنشاء مجلد للبيانات
mkdir emulator-data

# تصدير البيانات الحالية
firebase emulators:export ./emulator-data

# الاستيراد عند التشغيل
firebase emulators:start --import=./emulator-data
```

### 3. **فحص الـ Triggers من الـ UI**:
- افتح `http://localhost:4000`
- اذهب إلى **Logs** tab
- شاهد الـ Triggers تعمل في الوقت الفعلي

---

## ✅ قائمة التحقق

قبل النشر للإنتاج، تأكد من:

- [ ] تشغيل جميع الـ Functions محلياً بدون أخطاء
- [ ] اختبار جميع الـ Triggers الـ 5
- [ ] التحقق من إنشاء الإشعارات
- [ ] اختبار تحديث الكاش (`delegation_cache`)
- [ ] التأكد من عمل الواجهة الأمامية مع الـ Emulator
- [ ] فحص الـ Logs للتأكد من عدم وجود أخطاء
- [ ] اختبار السيناريوهات المختلفة (إضافة، تعديل، حذف)

---

## 🚨 استكشاف الأخطاء

### المشكلة: الـ Triggers لا تعمل

**الحل**:
```bash
# تأكد من أن Functions مبنية
cd /home/user/Hejazi-SSD/functions
npm run build

# أعد تشغيل الـ Emulator
firebase emulators:start
```

### المشكلة: لا توجد إشعارات

**الحل**:
1. تحقق من الـ Logs في Emulator UI
2. تأكد من أن المستخدم له `job_id` صحيح
3. تحقق من أن `notifyPermissionChange` تعمل

### المشكلة: خطأ في الاتصال

**الحل**:
```typescript
// تأكد من الـ ports في firebase.json
{
  "emulators": {
    "functions": { "port": 5001 },
    "firestore": { "port": 8080 },
    "auth": { "port": 9099 },
    "ui": { "port": 4000 }
  }
}
```

---

## 🎯 الخطوة النهائية: اختبار شامل

```bash
# 1. نظف البيانات
firebase emulators:start --import=./seed-data

# 2. شغّل الاختبار الشامل
node test-all.js

# 3. افحص النتائج في UI
open http://localhost:4000
```

---

## 📚 موارد إضافية

- [Firebase Emulator Suite](https://firebase.google.com/docs/emulator-suite)
- [Testing Cloud Functions](https://firebase.google.com/docs/functions/local-emulator)
- [Emulator UI](https://firebase.google.com/docs/emulator-suite/connect_and_prototype)

---

**بالتوفيق في الاختبار! 🚀**
