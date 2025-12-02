#!/usr/bin/env node

/**
 * 🧪 سكريبت اختبار نظام الصلاحيات المحلي
 * يختبر الإشعارات والـ Triggers محلياً قبل النشر
 */

const admin = require('firebase-admin');

// الاتصال بالـ Emulators
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

console.log('🔥 Connecting to Firebase Emulators...\n');

admin.initializeApp({
  projectId: 'hejazi-ssd'
});

const db = admin.firestore();

// ألوان للـ Console
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

function log(emoji, message, color = colors.reset) {
  console.log(`${color}${emoji} ${message}${colors.reset}`);
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Test 1: اختبار Trigger صلاحيات الوظيفة
 */
async function testJobPermissionTrigger() {
  log('🧪', 'Test 1: Job Permission Change Trigger', colors.cyan);
  console.log('─'.repeat(50));

  try {
    // 1. إنشاء وظيفة
    const jobRef = await db.collection('jobs').add({
      name_ar: 'مدير أمن',
      name_en: 'Security Manager',
      created_at: admin.firestore.FieldValue.serverTimestamp()
    });
    log('1️⃣', `Job created: ${jobRef.id}`, colors.green);

    // 2. إنشاء مستخدم في هذه الوظيفة
    const userRef = await db.collection('users').add({
      name_ar: 'أحمد محمد',
      name_en: 'Ahmed Mohammed',
      job_id: jobRef.id,
      company_id: 'company_test_1',
      department_id: 'dept_test_1',
      is_super_admin: false,
      created_at: admin.firestore.FieldValue.serverTimestamp()
    });
    log('2️⃣', `User created: ${userRef.id}`, colors.green);

    // 3. إضافة صلاحية (سيُطلق الـ Trigger)
    log('⚡', 'Adding permission (triggering notification)...', colors.yellow);
    const permRef = await db.collection('job_permissions').add({
      job_id: jobRef.id,
      service_id: '1',
      sub_service_id: null,
      sub_sub_service_id: null,
      scope_company_id: 'company_test_1',
      scope_department_id: 'dept_test_1',
      created_at: admin.firestore.FieldValue.serverTimestamp()
    });
    log('3️⃣', `Permission created: ${permRef.id}`, colors.green);

    // 4. الانتظار للـ Trigger
    log('⏳', 'Waiting 5 seconds for trigger...', colors.yellow);
    await sleep(5000);

    // 5. التحقق من الإشعار
    const notifications = await db
      .collection('users').doc(userRef.id)
      .collection('notifications')
      .where('type', '==', 'permission_change')
      .get();

    if (notifications.empty) {
      log('❌', 'No notifications found!', colors.red);
      log('ℹ️', 'Check Emulator logs for errors', colors.yellow);
      return false;
    }

    log('✅', `Found ${notifications.size} notification(s)`, colors.green);
    notifications.forEach(doc => {
      const n = doc.data();
      console.log('');
      log('📬', 'Notification Details:', colors.blue);
      console.log(`   Type: ${n.permissionType}`);
      console.log(`   Change: ${n.changeType}`);
      console.log(`   Message (AR): ${n.message_ar}`);
      console.log(`   Message (EN): ${n.message_en}`);
      console.log(`   Resource: ${n.resourceKey || 'N/A'}`);
      console.log(`   Job ID: ${n.jobId}`);
    });

    return true;
  } catch (error) {
    log('❌', `Test failed: ${error.message}`, colors.red);
    return false;
  }
}

/**
 * Test 2: اختبار Trigger نطاق الوصول
 */
async function testAccessScopeTrigger() {
  log('\n🧪', 'Test 2: Access Scope Change Trigger', colors.cyan);
  console.log('─'.repeat(50));

  try {
    const jobRef = await db.collection('jobs').add({
      name_ar: 'مشرف',
      name_en: 'Supervisor'
    });

    const userRef = await db.collection('users').add({
      name_ar: 'خالد علي',
      job_id: jobRef.id,
      company_id: 'comp_2',
      department_id: 'dept_2'
    });

    log('⚡', 'Adding access scope...', colors.yellow);
    await db.collection('access_job_scopes').add({
      job_id: jobRef.id,
      target_company_id: 'comp_target',
      target_job_id: 'job_target',
      scope_company_id: 'comp_2',
      scope_department_id: 'dept_2',
      created_at: admin.firestore.FieldValue.serverTimestamp()
    });

    log('⏳', 'Waiting 5 seconds...', colors.yellow);
    await sleep(5000);

    const notifications = await db
      .collection('users').doc(userRef.id)
      .collection('notifications')
      .where('permissionType', '==', 'access')
      .get();

    if (notifications.empty) {
      log('❌', 'No access notifications found!', colors.red);
      return false;
    }

    log('✅', `Found ${notifications.size} access notification(s)`, colors.green);
    notifications.forEach(doc => {
      const n = doc.data();
      console.log(`   ${n.message_ar}`);
    });

    return true;
  } catch (error) {
    log('❌', `Test failed: ${error.message}`, colors.red);
    return false;
  }
}

/**
 * Test 3: اختبار Trigger نطاق التحكم
 */
async function testControlScopeTrigger() {
  log('\n🧪', 'Test 3: Control Scope Change Trigger', colors.cyan);
  console.log('─'.repeat(50));

  try {
    const jobRef = await db.collection('jobs').add({
      name_ar: 'مدير',
      name_en: 'Manager'
    });

    const userRef = await db.collection('users').add({
      name_ar: 'سعيد أحمد',
      job_id: jobRef.id,
      company_id: 'comp_3',
      department_id: 'dept_3'
    });

    log('⚡', 'Adding control scope...', colors.yellow);
    await db.collection('control_job_scopes').add({
      job_id: jobRef.id,
      target_company_id: 'comp_target',
      target_job_id: 'job_target',
      scope_company_id: 'comp_3',
      scope_department_id: 'dept_3',
      created_at: admin.firestore.FieldValue.serverTimestamp()
    });

    log('⏳', 'Waiting 5 seconds...', colors.yellow);
    await sleep(5000);

    const notifications = await db
      .collection('users').doc(userRef.id)
      .collection('notifications')
      .where('permissionType', '==', 'control')
      .get();

    if (notifications.empty) {
      log('❌', 'No control notifications found!', colors.red);
      return false;
    }

    log('✅', `Found ${notifications.size} control notification(s)`, colors.green);
    notifications.forEach(doc => {
      const n = doc.data();
      console.log(`   ${n.message_ar}`);
    });

    return true;
  } catch (error) {
    log('❌', `Test failed: ${error.message}`, colors.red);
    return false;
  }
}

/**
 * تشغيل جميع الاختبارات
 */
async function runAllTests() {
  console.log('\n' + '═'.repeat(60));
  log('🚀', 'Starting Permission System Tests', colors.cyan);
  console.log('═'.repeat(60) + '\n');

  const results = [];

  // Test 1
  results.push(await testJobPermissionTrigger());

  // Test 2
  results.push(await testAccessScopeTrigger());

  // Test 3
  results.push(await testControlScopeTrigger());

  // النتائج النهائية
  console.log('\n' + '═'.repeat(60));
  log('📊', 'Test Results Summary', colors.cyan);
  console.log('═'.repeat(60));

  const passed = results.filter(r => r).length;
  const total = results.length;

  log('📈', `Passed: ${passed}/${total}`, passed === total ? colors.green : colors.red);

  if (passed === total) {
    log('✅', 'All tests passed successfully!', colors.green);
    log('🎉', 'Permission system is working correctly!', colors.green);
  } else {
    log('⚠️', 'Some tests failed. Check the logs above.', colors.yellow);
  }

  console.log('\n' + '═'.repeat(60) + '\n');

  // إغلاق الاتصال
  process.exit(passed === total ? 0 : 1);
}

// تشغيل الاختبارات
runAllTests().catch(error => {
  log('💥', `Fatal error: ${error.message}`, colors.red);
  console.error(error);
  process.exit(1);
});
