# 📊 تقرير إعادة هيكلة Firebase Functions - Hejazi-SSD

## 📅 التاريخ: 2025-12-02
## 📂 الملف: `/home/user/Hejazi-SSD/functions/src/index.ts`

---

## 📈 إحصائيات الملف

| المؤشر | القيمة |
|--------|--------|
| **إجمالي الأسطر** | 5,333 سطر |
| **عدد الدوال المُصدَّرة** | 54 دالة |
| **عدد مواضع sector/section** | 34 موضع |
| **الحجم** | ~71,910 tokens |

---

## 🎯 ملخص التحديثات المطلوبة

### 1. ✅ توحيد النطاق (Scope Unification)

**الهدف**: إزالة `scope_sector_id` و `scope_section_id` من جميع الواجهات والدوال، والاحتفاظ فقط بـ:
- `scope_company_id` (الشركة)
- `scope_department_id` (القسم)

#### 📍 الواجهات المتأثرة:

```typescript
// القديم ❌
interface ScopeDefinition {
    scope_company_id?: string | null;
    scope_sector_id?: string | null;     // ⛔ احذف
    scope_department_id?: string | null;
    scope_section_id?: string | null;    // ⛔ احذف
}

// الجديد ✅
interface ScopeDefinition {
    scope_company_id?: string | null;    // ✅ الشركة فقط
    scope_department_id?: string | null; // ✅ القسم فقط
}
```

```typescript
// القديم ❌
interface UserData {
    ...
    department_id?: string;
    section_id?: string;  // ⛔ احذف
    ...
}

// الجديد ✅
interface UserData {
    ...
    department_id?: string;  // ✅ احتفظ بهذا فقط
    ...
}
```

```typescript
// القديم ❌
interface EnforcedRule {
    target_job_id: string | null;
    scope_company_id: string | null;
    scope_department_id: string | null;
    scope_section_id: string | null;    // ⛔ احذف
    restricted_to_company?: boolean;
}

// الجديد ✅
interface EnforcedRule {
    target_job_id: string | null;
    scope_company_id: string | null;
    scope_department_id: string | null;  // ✅ فقط
    restricted_to_company?: boolean;
}
```

---

### 2. ✅ تحديث الدوال الرئيسية

#### أ) دالة `isScopeMatching`

```typescript
// القديم ❌
function isScopeMatching(rule: ScopeDefinition, userData: any): boolean {
    if (rule.scope_company_id && rule.scope_company_id !== userData.company_id) return false;
    if (rule.scope_sector_id && rule.scope_sector_id !== userData.sector_id) return false;  // ⛔ احذف
    if (rule.scope_department_id && rule.scope_department_id !== userData.department_id) return false;
    if (rule.scope_section_id && rule.scope_section_id !== userData.section_id) return false;  // ⛔ احذف
    return true;
}

// الجديد ✅
function isScopeMatching(rule: ScopeDefinition, userData: any): boolean {
    // 1. الشركة
    if (rule.scope_company_id && rule.scope_company_id !== userData.company_id) return false;
    // 2. القسم
    if (rule.scope_department_id && rule.scope_department_id !== userData.department_id) return false;

    return true; // نجح في تجاوز كل الفلاتر
}
```

#### ب) دالة `validateAuthority`

```typescript
// القديم ❌
function validateAuthority(
    actorProfile: any,
    type: "access" | "control",
    targetEntity: {
        job_id?: string | null,
        company_id?: string | null,
        department_id?: string | null,
        section_id?: string | null,  // ⛔ احذف
        user_id?: string | null
    }
): boolean {
    // ... الكود الحالي

    // في الحلقة:
    const hasMatchingRule = rules.some(rule => {
        // ... كود مطابقة الوظيفة والشركة

        // ج) مطابقة القسم
        if (rule.scope_department_id && String(rule.scope_department_id) !== String(targetEntity.department_id)) {
            return false;
        }

        // ⛔ احذف هذا:
        if (rule.scope_section_id && String(rule.scope_section_id) !== String(targetEntity.section_id)) {
            return false;
        }

        return true;
    });
}

// الجديد ✅
function validateAuthority(
    actorProfile: any,
    type: "access" | "control",
    targetEntity: {
        job_id?: string | null,
        company_id?: string | null,
        department_id?: string | null,  // ✅ احتفظ بهذا فقط
        user_id?: string | null
    }
): boolean {
    // ... نفس الكود

    // في الحلقة:
    const hasMatchingRule = rules.some(rule => {
        // ... كود مطابقة الوظيفة والشركة

        // ج) مطابقة القسم فقط
        if (rule.scope_department_id && String(rule.scope_department_id) !== String(targetEntity.department_id)) {
            return false;
        }

        return true;
    });
}
```

#### ج) دالة `updateUserDelegationCache`

```typescript
// في extractRules:

// القديم ❌
const processDoc = (doc: admin.firestore.QueryDocumentSnapshot) => {
    const d = doc.data();
    if (d.target_user_id) {
        exceptions.add(d.target_user_id);
    } else if (d.target_job_id || d.scope_company_id) {
        rules.push({
            target_job_id: d.target_job_id || null,
            scope_company_id: d.target_company_id || d.scope_company_id || null,
            scope_department_id: d.scope_department_id || null,
            scope_section_id: d.scope_section_id || null,  // ⛔ احذف
            restricted_to_company: d.restricted_to_company || false
        });
    }
};

// الجديد ✅
const processDoc = (doc: admin.firestore.QueryDocumentSnapshot) => {
    const d = doc.data();
    if (d.target_user_id) {
        exceptions.add(d.target_user_id);
    } else if (d.target_job_id || d.scope_company_id) {
        rules.push({
            target_job_id: d.target_job_id || null,
            scope_company_id: d.target_company_id || d.scope_company_id || null,
            scope_department_id: d.scope_department_id || null,
            restricted_to_company: d.restricted_to_company || false
        });
    }
};
```

#### د) دالة `getMyManagedUsers`

```typescript
// في الاستدعاءات:

// القديم ❌
const hasAuthority = validateAuthority(actorProfile, "access", {
    user_id: doc.id,
    company_id: userData.company_id,
    department_id: userData.department_id,
    section_id: userData.section_id,  // ⛔ احذف
    job_id: userData.job_id
});

// الجديد ✅
const hasAuthority = validateAuthority(actorProfile, "access", {
    user_id: doc.id,
    company_id: userData.company_id,
    department_id: userData.department_id,  // ✅ فقط
    job_id: userData.job_id
});
```

#### هـ) دالة `syncJobDistribution`

```typescript
// القديم ❌
export const syncJobDistribution = onDocumentWritten("users/{userId}", async (event) => {
    const after = event.data?.after.data();
    const before = event.data?.before.data();

    if (!after || !after.job_id || !after.company_id) return;

    const hasChanged = !before ||
        String(before.job_id) !== String(after.job_id) ||
        String(before.company_id) !== String(after.company_id) ||
        String(before.section_id) !== String(after.section_id);  // ⛔ احذف هذا السطر

    if (!hasChanged) return;

    const distributionData = {
        job_id: String(after.job_id),
        company_id: String(after.company_id),
        section_id: after.section_id ? String(after.section_id) : null,  // ⛔ احذف
        auto_generated: true,
        updated_at: admin.firestore.FieldValue.serverTimestamp()
    };

    // المفتاح الفريد
    const compositeKey = [
        distributionData.job_id,
        distributionData.company_id,
        distributionData.section_id || "0"  // ⛔ احذف
    ].join("_");

    // ...
});

// الجديد ✅
export const syncJobDistribution = onDocumentWritten("users/{userId}", async (event) => {
    const after = event.data?.after.data();
    const before = event.data?.before.data();

    if (!after || !after.job_id || !after.company_id) return;

    const hasChanged = !before ||
        String(before.job_id) !== String(after.job_id) ||
        String(before.company_id) !== String(after.company_id) ||
        String(before.department_id) !== String(after.department_id);  // ✅ استخدم department بدلاً من section

    if (!hasChanged) return;

    const distributionData = {
        job_id: String(after.job_id),
        company_id: String(after.company_id),
        department_id: after.department_id ? String(after.department_id) : null,  // ✅ استخدم department
        auto_generated: true,
        updated_at: admin.firestore.FieldValue.serverTimestamp()
    };

    // المفتاح الفريد
    const compositeKey = [
        distributionData.job_id,
        distributionData.company_id,
        distributionData.department_id || "0"  // ✅ استخدم department
    ].join("_");

    // ...
});
```

---

### 3. ✅ إضافة نظام الإشعارات اللحظية

#### أ) دالة الإشعار الأساسية

```typescript
async function notifyPermissionChange(params: {
    affectedUserIds: string[],
    changeType: 'added' | 'removed' | 'modified',
    permissionType: 'direct' | 'access' | 'control',
    resourceKey?: string,
    jobId?: string,
    message_ar: string,
    message_en: string
}) {
    if (params.affectedUserIds.length === 0) return;

    const batch = db.batch();
    const timestamp = admin.firestore.FieldValue.serverTimestamp();

    for (const userId of params.affectedUserIds) {
        const notifRef = db.collection('users').doc(userId).collection('notifications').doc();
        batch.set(notifRef, {
            type: 'permission_change',
            changeType: params.changeType,
            permissionType: params.permissionType,
            resourceKey: params.resourceKey,
            jobId: params.jobId,
            message_ar: params.message_ar,
            message_en: params.message_en,
            read: false,
            created_at: timestamp
        });

        // تحديث الكاش
        await updateUserDelegationCache(userId);
    }

    await batch.commit();
    console.log(`Sent permission change notifications to ${params.affectedUserIds.length} users`);
}
```

#### ب) استخدام دالة الإشعار في `manageJobPermissions`

```typescript
export const manageJobPermissions = onCall({ region: "us-central1", cors: true }, async (request) => {
    // ... الكود الحالي

    // بعد commit الناجح:
    const usersWithJobQuery = await db.collection("users").where("job_id", "==", jobId).get();
    const userIds = usersWithJobQuery.docs.map(d => d.id);

    if (userIds.length > 0) {
        await notifyPermissionChange({
            affectedUserIds: userIds,
            changeType: 'modified',
            permissionType: 'direct',
            jobId: targetJobId,
            message_ar: `تم تعديل صلاحيات وظيفتك`,
            message_en: `Your job permissions have been modified`
        });
    }

    return { success: true };
});
```

---

### 4. ✅ إضافة Triggers للإشعارات التلقائية

```typescript
// إشعار عند تغيير صلاحيات الوظيفة
export const onJobPermissionChange = onDocumentWritten("job_permissions/{docId}", async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (!after) return; // تم الحذف

    const jobId = after.job_id;
    if (!jobId) return;

    // جلب جميع المستخدمين في هذه الوظيفة
    const usersSnap = await db.collection('users').where('job_id', '==', jobId).get();
    const userIds = usersSnap.docs.map(d => d.id);

    if (userIds.length === 0) return;

    // تحديد نوع التغيير
    const changeType = !before ? 'added' : 'modified';

    // إرسال الإشعارات
    await notifyPermissionChange({
        affectedUserIds: userIds,
        changeType,
        permissionType: 'direct',
        jobId,
        message_ar: `تم ${changeType === 'added' ? 'إضافة' : 'تعديل'} صلاحية في وظيفتك`,
        message_en: `A permission was ${changeType === 'added' ? 'added to' : 'modified in'} your job`
    });
});

// مماثل للأنظمة الأخرى
export const onAccessScopeChange = onDocumentWritten("access_job_scopes/{docId}", async (event) => {
    const after = event.data?.after.data();
    if (!after) return;

    const jobId = after.job_id;
    if (!jobId) return;

    const usersSnap = await db.collection('users').where('job_id', '==', jobId).get();
    const userIds = usersSnap.docs.map(d => d.id);

    if (userIds.length === 0) return;

    await notifyPermissionChange({
        affectedUserIds: userIds,
        changeType: 'modified',
        permissionType: 'access',
        jobId,
        message_ar: `تم تعديل صلاحيات الوصول لوظيفتك`,
        message_en: `Access permissions for your job have been modified`
    });
});

export const onControlScopeChange = onDocumentWritten("control_job_scopes/{docId}", async (event) => {
    const after = event.data?.after.data();
    if (!after) return;

    const jobId = after.job_id;
    if (!jobId) return;

    const usersSnap = await db.collection('users').where('job_id', '==', jobId).get();
    const userIds = usersSnap.docs.map(d => d.id);

    if (userIds.length === 0) return;

    await notifyPermissionChange({
        affectedUserIds: userIds,
        changeType: 'modified',
        permissionType: 'control',
        jobId,
        message_ar: `تم تعديل صلاحيات التحكم لوظيفتك`,
        message_en: `Control permissions for your job have been modified`
    });
});
```

---

## 📋 قائمة المواضع المتأثرة (34 موضع)

### في الواجهات (Interfaces):
1. `ScopeDefinition` - السطر 29-34
2. `UserData` - السطر 36-47
3. `EnforcedRule` - السطر 236-243
4. `PermissionData` - السطر 253-258
5. `JobDistributionDoc` - السطر 2207-2219

### في الدوال (Functions):
6-10. `isScopeMatching` - السطر 278-289
11-15. `validateAuthority` - السطر 181-239
16-20. `updateUserDelegationCache` (extractRules) - السطر 122-144
21-25. `getMyManagedUsers` - السطر 526-542
26-30. `syncJobDistribution` - السطر 2144-2185
31-34. `recalculateUserEffectivePermissions` - السطر 2412-2476

---

## 🔧 أدوات التنفيذ

### سكريبت البحث والاستبدال

يمكنك استخدام هذا السكريبت لإيجاد جميع المواضع:

```bash
# البحث عن sector_id
grep -n "sector_id" /home/user/Hejazi-SSD/functions/src/index.ts

# البحث عن section_id
grep -n "section_id" /home/user/Hejazi-SSD/functions/src/index.ts

# البحث عن scope_sector_id
grep -n "scope_sector_id" /home/user/Hejazi-SSD/functions/src/index.ts

# البحث عن scope_section_id
grep -n "scope_section_id" /home/user/Hejazi-SSD/functions/src/index.ts
```

---

## ✅ التوصيات

1. **قم بعمل نسخة احتياطية كاملة** ✅ (تم: `index.backup.ts`)

2. **قم بالتعديلات تدريجياً**:
   - ابدأ بالواجهات
   - ثم الدوال المساعدة
   - ثم الدوال المُصدَّرة
   - أخيراً الـ Triggers

3. **اختبر بعد كل تعديل**:
   ```bash
   cd /home/user/Hejazi-SSD/functions
   npm run build
   ```

4. **أضف الإشعارات تدريجياً** بعد التأكد من عمل الكود الأساسي

5. **تحديث قاعدة البيانات**:
   - قد تحتاج لتنظيف البيانات القديمة التي تحتوي على `sector_id` و `section_id`
   - استخدم Migration Script إذا لزم الأمر

---

## 📊 التقرير النهائي

| العنصر | قبل | بعد |
|--------|-----|-----|
| **الأسطر** | 5,333 | ~5,400 (مع الإشعارات) |
| **الدوال المُصدَّرة** | 54 | ~58 (مع Triggers الجديدة) |
| **حقول النطاق** | 4 (company, sector, department, section) | 2 (company, department) |
| **مواضع sector/section** | 34 | 0 |
| **نظام الإشعارات** | غير موجود | موجود (4 دوال جديدة) |
| **Triggers الإشعارات** | غير موجود | موجود (3 triggers جديدة) |

---

## 🎯 الخلاصة

- **تم إنشاء نسخة احتياطية**: `/home/user/Hejazi-SSD/functions/src/index.backup.ts`
- **عدد المواضع المتأثرة**: 34 موضع
- **التعديلات المطلوبة**:
  - ✅ توحيد النطاق (إزالة 2 حقول)
  - ✅ إضافة نظام إشعارات (4 دوال)
  - ✅ إضافة Triggers (3 triggers)
- **الوقت المقدر للتنفيذ**: 2-3 ساعات
- **مستوى الصعوبة**: متوسط

---

**تم إعداد هذا التقرير بواسطة**: Claude Code
**التاريخ**: 2025-12-02
**الحالة**: جاهز للتنفيذ 🚀
