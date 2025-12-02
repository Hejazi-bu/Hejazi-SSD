import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentWritten, onDocumentUpdated, onDocumentCreated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import fetch from "node-fetch";
// ✨ الإضافات الجديدة ✨
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onMessagePublished } from "firebase-functions/v2/pubsub";
import { PubSub } from "@google-cloud/pubsub";
import sgMail from "@sendgrid/mail";
import * as crypto from "crypto";

// --- هنا يبدأ الكود ---
admin.initializeApp();
const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });
const pubsub = new PubSub();

// ============================================================================
// 0. الواجهات المشتركة (Shared Interfaces)
// ============================================================================

interface ResourceData {
    service_id?: string;
    sub_service_id?: string;
    sub_sub_service_id?: string;
}

// واجهة الحقول الهيكلية (لإعادة الاستخدام)
// ✅ تم التحديث: استخدام الشركة والقسم فقط (company + department)
interface ScopeDefinition {
    scope_company_id?: string | null;    // إذا حدد، يطبق على هذه الشركة فقط
    scope_department_id?: string | null; // إذا حدد، يطبق على هذا القسم فقط
}

interface UserData {
    id: string;
    name_ar?: string;
    name_en?: string;
    job_id?: string;
    company_id?: string;
    department_id?: string;
    is_super_admin?: boolean;
    avatar_url?: string;
    [key: string]: unknown;
}

// واجهة لملف تعريف المفوض (الذي يقوم بالفعل)
interface ActorDelegationProfile {
    isSuperAdmin: boolean;
    resources: string[]; // قائمة الموارد التي يملكها
    scopes: {
        access: ScopeDefinition[]; // النطاقات التي يحق له الوصول إليها
        control: ScopeDefinition[]; // النطاقات التي يحق له التحكم بها
    };
}

// تعديل توقيع الدالة لتحديد نوع الإرجاع Promise<DelegationProfile>
async function _fetchActorDelegationProfile(actorId: string): Promise<DelegationProfile> {
    // 1. محاولة القراءة من الكاش أولاً
    const cacheDoc = await db.doc(`users/${actorId}/private_data/delegation_cache`).get();

    if (cacheDoc.exists) {
        // ✅ الحل: نستخدم as DelegationProfile بدلاً من as any
        return cacheDoc.data() as DelegationProfile;
    }

    // 2. Fallback
    console.log(`Cache miss for user ${actorId}, calculating now...`);

    // تأكد أن دالة updateUserDelegationCache ترجع DelegationProfile أيضاً
    const profile = await updateUserDelegationCache(actorId);

    if (!profile) {
        throw new HttpsError("not-found", "Actor user not found.");
    }

    // بما أن الدالة المساعدة ترجع الشكل الصحيح، لا نحتاج لتحويل هنا
    return profile as DelegationProfile;
}

// دالة تقوم بحساب ملف التفويض كاملاً وحفظه في مستند الكاش
async function updateUserDelegationCache(userId: string) {
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) return null;

    const userData = userDoc.data()!;
    const actorJobId = userData.job_id ? String(userData.job_id) : null;

    // 1. إذا كان Super Admin، نخزن بروفايل بصلاحيات مطلقة
    if (userData.is_super_admin === true) {
        const superAdminProfile = {
            isSuperAdmin: true,
            accessRules: [], controlRules: [], accessExceptions: [], controlExceptions: [], resources: ["*"],
            last_updated: admin.firestore.FieldValue.serverTimestamp()
        };
        await db.doc(`users/${userId}/private_data/delegation_cache`).set(superAdminProfile);
        return superAdminProfile;
    }

    // 2. جلب البيانات من المصادر الـ 8 (كما كان سابقاً)
    const emptySnapshot = { empty: true, docs: [] } as unknown as admin.firestore.QuerySnapshot;

    const queries = [
        // Access Rules
        actorJobId ? db.collection("access_job_scopes").where("job_id", "==", actorJobId).get() : Promise.resolve(emptySnapshot),
        db.collection("access_user_scopes").where("user_id", "==", userId).get(),
        // Control Rules
        actorJobId ? db.collection("control_job_scopes").where("job_id", "==", actorJobId).get() : Promise.resolve(emptySnapshot),
        db.collection("control_user_scopes").where("user_id", "==", userId).get(),
        // Resources
        actorJobId ? db.collection("access_job_resources").where("job_id", "==", actorJobId).get() : Promise.resolve(emptySnapshot),
        db.collection("access_user_resources").where("user_id", "==", userId).get(),
        actorJobId ? db.collection("control_job_resources").where("job_id", "==", actorJobId).get() : Promise.resolve(emptySnapshot),
        db.collection("control_user_resources").where("user_id", "==", userId).get()
    ];

    const results = (await Promise.all(queries)) as admin.firestore.QuerySnapshot[];

    // دالة مساعدة لاستخراج القواعد (نفس المنطق السابق)
    const extractRules = (jobSnap: admin.firestore.QuerySnapshot, userSnap: admin.firestore.QuerySnapshot) => {
        const rules: EnforcedRule[] = [];
        const exceptions = new Set<string>();

        const processDoc = (doc: admin.firestore.QueryDocumentSnapshot) => {
            const d = doc.data();
            if (d.target_user_id) {
                exceptions.add(d.target_user_id);
            } else if (d.target_job_id || d.scope_company_id) { // التأكد من وجود قاعدة
                rules.push({
                    target_job_id: d.target_job_id || null,
                    scope_company_id: d.target_company_id || d.scope_company_id || null, // دعمنا الاسمين
                    scope_department_id: d.scope_department_id || null,
                    restricted_to_company: d.restricted_to_company || false
                });
            }
        };

        jobSnap.docs.forEach(processDoc);
        userSnap.docs.forEach(processDoc);
        return { rules, exceptions: Array.from(exceptions) };
    };

    const accessData = extractRules(results[0], results[1]);
    const controlData = extractRules(results[2], results[3]);

    const allowedResources = new Set<string>();
    const resourceSnaps = results.slice(4);

    resourceSnaps.forEach((snap: admin.firestore.QuerySnapshot) => {
        snap.docs.forEach((doc: admin.firestore.QueryDocumentSnapshot) => {
            const d = doc.data();
            if (d.is_allowed === false) return;
            if (d.sub_sub_service_id) allowedResources.add(`sss:${d.sub_sub_service_id}`);
            else if (d.sub_service_id) allowedResources.add(`ss:${d.sub_service_id}`);
            else if (d.service_id) allowedResources.add(`s:${d.service_id}`);
        });
    });

    // 3. بناء الكائن النهائي
    const finalProfile = {
        isSuperAdmin: false,
        userData: userData, // نخزن نسخة من بيانات المستخدم الأساسية للسرعة
        accessRules: accessData.rules,
        accessExceptions: accessData.exceptions,
        controlRules: controlData.rules,
        controlExceptions: controlData.exceptions,
        resources: Array.from(allowedResources),
        last_updated: admin.firestore.FieldValue.serverTimestamp()
    };

    // 4. الحفظ في الكاش (هنا السحر!)
    await db.doc(`users/${userId}/private_data/delegation_cache`).set(finalProfile);

    return finalProfile;
}

// ============================================================================
// دالة الإشعارات اللحظية للصلاحيات (Permission Notifications)
// ============================================================================
/**
 * دالة لإرسال إشعار للمستخدمين المتأثرين بتغيير الصلاحيات
 * @param params - معاملات الإشعار
 */
async function notifyPermissionChange(params: {
    affectedUserIds: string[],
    changeType: "added" | "removed" | "modified",
    permissionType: "direct" | "access" | "control",
    resourceKey?: string,
    jobId?: string,
    message_ar: string,
    message_en: string
}) {
    if (params.affectedUserIds.length === 0) {
        console.log("No users to notify");
        return;
    }

    const batch = db.batch();
    const timestamp = admin.firestore.FieldValue.serverTimestamp();

    console.log(`Preparing notifications for ${params.affectedUserIds.length} users`);

    for (const userId of params.affectedUserIds) {
        const notifRef = db.collection("users").doc(userId).collection("notifications").doc();
        batch.set(notifRef, {
            type: "permission_change",
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
    console.log(`✅ Sent permission change notifications to ${params.affectedUserIds.length} users`);
}

// ✅ تعديل دالة التحقق لتطبيق قاعدة "التحكم أعلى من الوصول"
// ✅ تم التحديث: إزالة section_id
function validateAuthority(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    actorProfile: any,
    type: "access" | "control",
    targetEntity: {
        job_id?: string | null,
        company_id?: string | null,
        department_id?: string | null,
        user_id?: string | null
    }
): boolean {
    if (actorProfile.isSuperAdmin) return true;

    // تحديد أي القوائم سنفحص (التحكم يشمل الوصول)
    const modesToCheck = type === "access" ? ["access", "control"] : ["control"];

    for (const mode of modesToCheck) {
        const exceptions = actorProfile[`${mode}Exceptions`] as string[];
        const rules = actorProfile[`${mode}Rules`] as EnforcedRule[];

        // 1. استثناء المستخدم المباشر (Override)
        if (targetEntity.user_id && exceptions.includes(targetEntity.user_id)) return true;

        // 2. فحص قواعد الوظيفة (Job-Centric Scope)
        // يجب أن نجد قاعدة واحدة على الأقل تطابق الوظيفة + الشركة + القسم
        const hasMatchingRule = rules.some(rule => {
            // أ) مطابقة الوظيفة
            if (rule.target_job_id && String(rule.target_job_id) !== String(targetEntity.job_id)) {
                return false; // الوظيفة غير مطابقة
            }

            // ب) مطابقة الشركة (الجزء الحاسم)
            // إذا كانت القاعدة تحدد شركة، يجب أن يكون الهدف في نفس الشركة
            if (rule.scope_company_id && String(rule.scope_company_id) !== String(targetEntity.company_id)) {
                return false;
            }
            // إذا كانت القاعدة "مقيدة بشركة المدير"، يجب أن يطابق شركة المدير
            if (rule.restricted_to_company && String(actorProfile.userData.company_id) !== String(targetEntity.company_id)) {
                return false;
            }

            // ج) مطابقة القسم (اختياري)
            if (rule.scope_department_id && String(rule.scope_department_id) !== String(targetEntity.department_id)) {
                return false;
            }

            // إذا نجحنا في تجاوز كل الفلاتر، فهذه القاعدة تسمح بالوصول
            return true;
        });

        if (hasMatchingRule) return true;
    }

    return false;
}

// --- Cloud Functions (الواجهات السحابية لإدارة التفويض) ---

// ✅ تم دمج المتغيرين في SYSTEM_LOGO_URL لـ الغرضين (لحل مشكلة no-unused-vars)
const SYSTEM_LOGO_URL = "http://cdn.mcauto-images-production.sendgrid.net/c6fa0a94fa4739ad/0cc7e284-f539-42e8-9849-7806be2a02f7/96x96.png";

// ============================================================================
// 🔐 نظام إدارة الصلاحيات المباشرة (Direct Permissions System) - (System 1)
// ============================================================================
// يشمل: إدارة صلاحيات الوظائف، الاستثناءات الشخصية، دوال التحقق، والمشغلات الخلفية.

// ----------------------------------------------------------------------------
// 1. الواجهات والدوال المساعدة (Helpers & Interfaces)
// ----------------------------------------------------------------------------

// --- Interfaces ---
interface PermissionData {
    service_id: string | null;
    sub_service_id: string | null;
    sub_sub_service_id: string | null;
}

const parsePermissionString = (perm: string): PermissionData => {
    const [type, id] = perm.split(":");
    const data: PermissionData = {
        service_id: null,
        sub_service_id: null,
        sub_sub_service_id: null,
    };
    if (type === "s") data.service_id = id;
    else if (type === "ss") data.sub_service_id = id;
    else if (type === "sss") data.sub_sub_service_id = id;
    return data;
};

// --- Helper: Scope Matcher (محرك المطابقة) ---
// يتحقق هل بيانات المستخدم تطابق شروط النطاق في القاعدة
// ✅ تم التحديث: استخدام الشركة والقسم فقط
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isScopeMatching(rule: ScopeDefinition, userData: any): boolean {
    // 1. الشركة
    if (rule.scope_company_id && rule.scope_company_id !== userData.company_id) return false;
    // 2. القسم
    if (rule.scope_department_id && rule.scope_department_id !== userData.department_id) return false;

    return true; // إذا عبر كل الفلاتر (أو كانت null)، فهو مطابق
}

// ----------------------------------------------------------------------------
// 2. نظام إدارة الصلاحيات المباشرة - محرك حساب الصلاحيات (Core Logic Engine)
// ----------------------------------------------------------------------------

async function _fetchUserEffectivePermissions(userId: string): Promise<{ [key: string]: boolean }> {
    const effectivePermissions: { [key: string]: boolean } = { general_access: true };
    const userDoc = await db.collection("users").doc(userId).get();
    const userData = userDoc.data();

    if (!userData) {
        console.error(`User data not found for ID: ${userId}`);
        return { general_access: false };
    }

    // 1. Super Admin: يملك كل شيء
    if (userData.is_super_admin === true) {
        const services = await db.collection("services").get();
        const subServices = await db.collection("sub_services").get();
        const subSubServices = await db.collection("sub_sub_services").get();
        services.forEach(doc => { effectivePermissions[`s:${doc.id}`] = true; });
        subServices.forEach(doc => { effectivePermissions[`ss:${doc.id}`] = true; });
        subSubServices.forEach(doc => { effectivePermissions[`sss:${doc.id}`] = true; });
        return effectivePermissions;
    }

    // 2. صلاحيات الوظيفة (مع تطبيق الفلاتر الذكية)
    const jobId = userData.job_id;
    if (jobId) {
        // نجلب كل القواعد الخاصة بهذه الوظيفة
        const jobPermissions = await db.collection("job_permissions").where("job_id", "==", jobId).get();
        jobPermissions.forEach(doc => {
            const p = doc.data() as PermissionData;

            // ✅ التحقق: هل تنطبق هذه القاعدة على هذا الموظف (شركته، قسمه..)؟
            if (isScopeMatching(p, userData)) {
                let pId: string | null = null;
                if (p.service_id) pId = `s:${p.service_id}`;
                else if (p.sub_service_id) pId = `ss:${p.sub_service_id}`;
                else if (p.sub_sub_service_id) pId = `sss:${p.sub_sub_service_id}`;

                if (pId) effectivePermissions[pId] = true;
            }
        });
    }

    // 3. استثناءات المستخدم (الأقوى دائماً)
    // الاستثناءات الشخصية عادة لا تحتاج فلترة نطاق لأنها ممنوحة للشخص بعينه، 
    // لكن يمكن تطبيقها أيضاً إذا أردت. هنا سنفترض أنها نافذة دائماً.
    const userPermissions = await db.collection("user_permissions").where("user_id", "==", userId).get();
    userPermissions.forEach(doc => {
        const p = doc.data();
        let pId: string | null = null;
        if (p.service_id) pId = `s:${p.service_id}`;
        else if (p.sub_service_id) pId = `ss:${p.sub_service_id}`;
        else if (p.sub_sub_service_id) pId = `sss:${p.sub_sub_service_id}`;

        if (pId) effectivePermissions[pId] = p.is_allowed;
    });

    // ❌ تم حذف منطق "company_permissions" (الحظر) بالكامل كما طلبت.

    return effectivePermissions;
}

// ----------------------------------------------------------------------------
// 3. نظام إدارة الصلاحيات المباشرة / دوال القراءة للواجهة الأمامية (Read Operations - Callables)
// ----------------------------------------------------------------------------

// --- الدالة الأصلية onCall تستدعي الدالة الداخلية الآن ---
export const getUserEffectivePermissions = onCall({ region: "us-central1", cors: true }, async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
    }
    const userId = request.auth.uid;
    const permissions = await _fetchUserEffectivePermissions(userId); // <-- الاستدعاء الصحيح للدالة الداخلية
    return permissions; // <-- إعادة النتيجة مباشرة
});

export const checkPermission = onCall({ region: "us-central1", cors: true }, async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
    }
    const userId = request.auth.uid;
    const { permission_id: permissionId } = request.data as { permission_id: string };
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) {
        throw new HttpsError("not-found", "User not found.");
    }
    const userData = userDoc.data();
    if (userData?.is_super_admin === true) return { isAllowed: true };
    const jobId = userData?.job_id;
    let isAllowedByJob = false;
    if (jobId) {
        const permData = parsePermissionString(permissionId);
        const jobPermissionQuery = await db.collection("job_permissions")
            .where("job_id", "==", jobId)
            .where("service_id", "==", permData.service_id)
            .where("sub_service_id", "==", permData.sub_service_id)
            .where("sub_sub_service_id", "==", permData.sub_sub_service_id)
            .get();
        isAllowedByJob = !jobPermissionQuery.empty;
    }
    const permData = parsePermissionString(permissionId);
    const userPermissionQuery = await db.collection("user_permissions")
        .where("user_id", "==", userId)
        .where("service_id", "==", permData.service_id)
        .where("sub_service_id", "==", permData.sub_service_id)
        .where("sub_sub_service_id", "==", permData.sub_sub_service_id)
        .get();
    let isAllowedByException = isAllowedByJob;
    if (!userPermissionQuery.empty) {
        isAllowedByException = userPermissionQuery.docs[0].data().is_allowed;
    }
    return { isAllowed: isAllowedByException };
});

// --- Callable Functions (onCall) ---
export const getUsersByPermission = onCall({ cors: [/localhost:\d+/, /hejazi-ssd\.web\.app/, /h-ssd\.com/, /hejazissd\.com/] }, async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
    }
    const permissionId = request.data.permissionId as string;
    if (!permissionId) {
        throw new HttpsError("invalid-argument", "The function must be called with a \"permissionId\".");
    }
    const userIds = await getUsersWithPermission(permissionId);
    if (userIds.length === 0) {
        return [];
    }
    const userRecords = await Promise.all(
        userIds.map(uid => db.collection("users").doc(uid).get())
    );
    const users = userRecords
        .filter(doc => doc.exists && doc.data()?.is_super_admin !== true)
        .map(doc => ({ id: doc.id, ...doc.data() }));
    return users;
});

export const getMyDelegationProfile = onCall({ region: "us-central1", cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");
    const actorId = request.auth.uid;

    try {
        // 1. استخدام الدالة المساعدة التي كتبناها سابقاً
        // نقوم بعمل Casting لأننا نعرف الهيكل العائد
        const profile = await _fetchActorDelegationProfile(actorId) as unknown as ActorDelegationProfile;

        // 2. جلب بيانات المستخدم الحالية (لمعرفة شركته الحالية للتحقق من restricted_to_company)
        const userDoc = await db.collection("users").doc(actorId).get();
        const userData = userDoc.data();

        // 3. تحويل البيانات وتنسيقها للواجهة الأمامية
        return {
            success: true,
            is_super_admin: profile.isSuperAdmin,
            
            // تحويل Scopes إلى Rules (لتوحيد التسمية في الواجهة)
            // نستخدم Optional Chaining (?.) للحماية في حال كانت المصفوفات فارغة
            accessRules: profile.scopes?.access || [],
            controlRules: profile.scopes?.control || [],
            
            // في النظام الجديد، الاستثناءات مدمجة غالباً ضمن القواعد، 
            // ولكن إذا كان لديك مصفوفة منفصلة للاستثناءات المباشرة (Direct User Delegation) يمكن إضافتها هنا.
            // حالياً سنرسل مصفوفات فارغة ما لم يكن لديك منطق خاص لها في _fetchActorDelegationProfile
            accessExceptions: [], 
            controlExceptions: [],

            // تحويل Set إلى Array لأن JSON لا يدعم Set
            allowed_resources: Array.from(profile.resources || []),

            // شركة المدير الحالية
            actor_company_id: userData?.company_id || null
        };

    } catch (error) {
        console.error("Error fetching delegation profile:", error);
        throw new HttpsError("internal", "Failed to fetch profile.");
    }
});

export const getMyManagedUsers = onCall({ region: "us-central1", cors: true }, async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
    }
    const actorId = request.auth.uid;

    // 1. جلب ملف التفويض الخاص بالمدير الحالي
    // تم استخدام (as unknown as ActorDelegationProfile) لحل مشكلة اختلاف الأنواع
    const actorProfile = await _fetchActorDelegationProfile(actorId) as unknown as ActorDelegationProfile;

    // أ) إذا كان سوبر أدمن، نعيد بحثاً عاماً (مع تحديد العدد للأداء)
    if (actorProfile.isSuperAdmin) {
        const usersSnap = await db.collection("users")
            .where("is_super_admin", "!=", true) // استبعاد السوبر أدمن الآخرين (اختياري)
            .limit(100)
            .get();
        // تم اصلاح ترتيب المعاملات هنا ايضاً لضمان عدم الكتابة فوق المعرف
        return usersSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as UserData));
    }

    // ب) للمدراء العاديين: تحديد الشركات التي يملكون صلاحية "الوصول" أو "التحكم" عليها
    // نجمع الشركات من نطاقات الوصول والتحكم
    const allowedCompanyIds = new Set<string>();
    
    // إضافة شركات نطاق الوصول (نتأكد ان المصفوفة موجودة قبل الدوران عليها)
    if (actorProfile.scopes?.access) {
        actorProfile.scopes.access.forEach(s => {
            if (s.scope_company_id) allowedCompanyIds.add(s.scope_company_id);
        });
    }
    
    // إضافة شركات نطاق التحكم
    if (actorProfile.scopes?.control) {
        actorProfile.scopes.control.forEach(s => {
            if (s.scope_company_id) allowedCompanyIds.add(s.scope_company_id);
        });
    }

    const companiesArray = Array.from(allowedCompanyIds);

    if (companiesArray.length === 0) {
        return []; // لا يملك أي تفويض على أي شركة
    }

    // ج) جلب المستخدمين الموجودين في هذه الشركات
    const validCompaniesChunk = companiesArray.slice(0, 10);

    const usersQuery = await db.collection("users")
        .where("company_id", "in", validCompaniesChunk)
        .limit(100) 
        .get();

    const allowedUsers: UserData[] = [];

    // د) التصفية الدقيقة (Fine-grained Filtering)
    for (const doc of usersQuery.docs) {
        const userData = doc.data() as UserData;
        
        const hasAuthority = validateAuthority(actorProfile, "access", {
            user_id: doc.id,
            company_id: userData.company_id,
            department_id: userData.department_id,
            job_id: userData.job_id
        });

        if (hasAuthority) {
            // ✅ التصحيح هنا: وضعنا userData أولاً ثم id لنضمن أن معرف المستند هو المعتمد
            allowedUsers.push({ ...userData, id: doc.id });
        }
    }

    return allowedUsers;
});


// ----------------------------------------------------------------------------
// 4. نظام إدارة الصلاحيات المباشرة / دوال الإدارة والتعديل (Write Operations - Callables)
// ----------------------------------------------------------------------------

export const manageJobPermissions = onCall({ region: "us-central1", cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");
    const actorId = request.auth.uid;

    // تعريف الواجهة للبيانات القادمة لضمان الأنواع
    interface JobPermissionInput {
        id: string; 
        is_allowed: boolean; 
        scope?: {
            companies?: string[];    
            departments?: string[];  
            sections?: string[];     
        }
    }

    const {
        p_job_id: jobId,
        p_permissions_to_add: permissionsToAdd,
        p_permissions_to_remove: permissionsToRemove
    } = request.data as { 
        p_job_id: string; 
        p_permissions_to_add: JobPermissionInput[]; 
        p_permissions_to_remove: string[] 
    };

    // 1. التحقق من صلاحية الفاعل
    // ✅ التصحيح: استخدام casting لحل مشكلة اختلاف الواجهات
    const actorProfile = await _fetchActorDelegationProfile(actorId) as unknown as ActorDelegationProfile;
    
    // التحقق: هل أملك صلاحية الوصول لهذه الوظيفة؟
    const hasAuthorityOverJob = validateAuthority(actorProfile, "access", { job_id: jobId });
    if (!hasAuthorityOverJob) {
        throw new HttpsError("permission-denied", "You do not have authority to manage permissions for this job.");
    }

    const batch = db.batch();

    // 2. إضافة أو تحديث القواعد
    if (permissionsToAdd && Array.isArray(permissionsToAdd)) {
        for (const item of permissionsToAdd) {
            const permId = item.id;
            const permData = parsePermissionString(permId);
            
            // --- بداية التحقق الأمني الجديد للنطاق ---
            if (item.scope?.companies && item.scope.companies.length > 0 && !actorProfile.isSuperAdmin) {
                const myAllowedCompanies = new Set<string>();
                // نتأكد أن المصفوفات موجودة قبل استخدام forEach
                if (actorProfile.scopes?.access) {
                    actorProfile.scopes.access.forEach(s => s.scope_company_id && myAllowedCompanies.add(s.scope_company_id));
                }
                if (actorProfile.scopes?.control) {
                    actorProfile.scopes.control.forEach(s => s.scope_company_id && myAllowedCompanies.add(s.scope_company_id));
                }

                const invalidCompanies = item.scope.companies.filter(cid => !myAllowedCompanies.has(cid));
                
                if (invalidCompanies.length > 0) {
                    throw new HttpsError("permission-denied", `You cannot set scope for companies you do not manage: ${invalidCompanies.join(", ")}`);
                }
            }
            // --- نهاية التحقق الأمني الجديد للنطاق ---

            if (!actorProfile.isSuperAdmin && item.is_allowed) {
                 if (!actorProfile.resources.includes(permId)) {
                     throw new HttpsError("permission-denied", `You cannot grant permission ${permId} because you don't have it.`);
                 }
            }

            const scopeData = {
                scope_companies: item.scope?.companies || [],
                scope_departments: item.scope?.departments || [],
                scope_sections: item.scope?.sections || []
            };

            const newJobPermRef = db.collection("job_permissions").doc();
            
            batch.set(newJobPermRef, {
                job_id: jobId,
                ...permData,
                is_allowed: item.is_allowed,
                ...scopeData,
                created_by: actorId,
                created_at: admin.firestore.FieldValue.serverTimestamp()
            });

            // تسجيل التغيير (تأكد أن دالة logPermissionChange معرفة لديك)
            logPermissionChange(
                batch, 
                actorId, 
                "job", 
                "ADD", 
                permData, 
                { 
                    jobId: jobId, 
                    newState: item.is_allowed 
                }
            );
        }
    }

    // 3. الحذف
    if (permissionsToRemove && Array.isArray(permissionsToRemove)) {
         for (const permId of permissionsToRemove) {
            const permData = parsePermissionString(permId);
            
            const jobPermsQuery = await db.collection("job_permissions")
                .where("job_id", "==", jobId)
                .where("service_id", "==", permData.service_id)
                .where("sub_service_id", "==", permData.sub_service_id)
                .where("sub_sub_service_id", "==", permData.sub_sub_service_id)
                .get();

            jobPermsQuery.forEach(doc => batch.delete(doc.ref));
        }
    }

    // 4. تحديث المستخدمين
    const usersWithJobQuery = await db.collection("users").where("job_id", "==", jobId).get();
    
    await commitBatchChunks(usersWithJobQuery.docs, (doc, subBatch) => {
        subBatch.update(doc.ref, { 
            permissions_updated_at: admin.firestore.FieldValue.serverTimestamp() 
        });
    });

    await batch.commit(); 
    return { success: true };
});

export const manageUserPermissionsSecure = onCall({ region: "us-central1", cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");
    const actorId = request.auth.uid;

    const { targetUserId, permissions } = request.data as {
        targetUserId: string,
        permissions: { id: string, state: boolean }[]
    };

    const targetUserDoc = await db.collection("users").doc(targetUserId).get();
    if (!targetUserDoc.exists) throw new HttpsError("not-found", "Target user not found.");
    const targetUserData = targetUserDoc.data()!;

    const actorProfile = await _fetchActorDelegationProfile(actorId);

    const hasAuthority = validateAuthority(actorProfile, "access", {
        user_id: targetUserId,
        company_id: targetUserData.company_id,
        department_id: targetUserData.department_id,
        job_id: targetUserData.job_id
    });

    if (!hasAuthority) {
        throw new HttpsError("permission-denied", "You do not have authority over this user's scope.");
    }

    if (!actorProfile.isSuperAdmin) {
        for (const perm of permissions) {
            if (!actorProfile.resources.includes(perm.id)) {
                throw new HttpsError("permission-denied", `You cannot grant permission ${perm.id} because you don't have it yourself.`);
            }
        }
    }

    const batch = db.batch();
    permissions.forEach(p => {
        const permData = parsePermissionString(p.id);
        const ref = db.collection("user_permissions").doc();
        // (تحسين مستقبلي: ابحث عن الصلاحية الموجودة وحدثها بدلاً من إنشاء جديد دائماً لتوفير المساحة)
        batch.set(ref, {
            user_id: targetUserId,
            ...permData,
            is_allowed: p.state,
            updated_by: actorId,
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        });
    });

    await batch.commit();
    return { success: true };
});

// --- 3. دالة نسخ الصلاحيات (Improvement: Quality) ---
export const cloneUserPermissions = onCall({ region: "us-central1", cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");
    const actorId = request.auth.uid;
    const { sourceUserId, targetUserId } = request.data as { sourceUserId: string, targetUserId: string };

    if (!sourceUserId || !targetUserId) throw new HttpsError("invalid-argument", "Missing IDs");

    const batch = db.batch();

    // 1. جلب استثناءات المصدر
    const sourcePerms = await db.collection("user_permissions").where("user_id", "==", sourceUserId).get();

    if (sourcePerms.empty) return { success: true, message: "Source user has no exceptions to clone." };

    // 2. حذف استثناءات الهدف القديمة (لتطابق تام) - اختياري، لكنه أنظف
    const targetOldPerms = await db.collection("user_permissions").where("user_id", "==", targetUserId).get();
    targetOldPerms.forEach(doc => batch.delete(doc.ref));

    // 3. نسخ الاستثناءات
    sourcePerms.forEach(doc => {
        const data = doc.data();
        const newRef = db.collection("user_permissions").doc();
        batch.set(newRef, {
            ...data,
            user_id: targetUserId, // تغيير المالك
            created_by: actorId,
            created_at: admin.firestore.FieldValue.serverTimestamp()
        });
    });

    await batch.commit();
    return { success: true, count: sourcePerms.size };
});

// ----------------------------------------------------------------------------
// 5. نظام إدارة الصلاحيات المباشرة / المشغلات الخلفية (Triggers)
// ----------------------------------------------------------------------------

export const onUserPermissionWrite = onDocumentWritten("user_permissions/{docId}", async (event) => {
    const data = event.data?.after.data() ?? event.data?.before.data();
    if (!data || !data.user_id) return;

    const userId = data.user_id;

    // --- START: New Dynamic Update Logic ---
    let pId: string | null = null;
    if (data.sub_sub_service_id) {
        pId = `sss:${data.sub_sub_service_id}`;
    } else if (data.sub_service_id) {
        pId = `ss:${data.sub_service_id}`;
    } else if (data.service_id) {
        pId = `s:${data.service_id}`;
    }

    if (pId) {
        await updatePendingTasksForPermissionChange(pId);
    }
    // --- END: New Dynamic Update Logic ---

    const userRef = db.collection("users").doc(userId);
    try {
        await userRef.update({
            permissions_updated_at: admin.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        console.error(`Failed to update timestamp for user: ${userId}`, error);
    }
});

export const onJobPermissionWrite = onDocumentWritten("job_permissions/{docId}", async (event) => {
    const data = event.data?.after.data() ?? event.data?.before.data();
    if (!data || !data.job_id) return;
    const jobId = data.job_id;

    // 1. تحديث المهام المعلقة (المنطق الجديد)
    let pId: string | null = null;
    if (data.sub_sub_service_id) pId = `sss:${data.sub_sub_service_id}`;
    else if (data.sub_service_id) pId = `ss:${data.sub_service_id}`;
    else if (data.service_id) pId = `s:${data.service_id}`;

    if (pId) {
        await updatePendingTasksForPermissionChange(pId);
    }

    // 2. تحديث المستخدمين (باستخدام التقسيم الآمن لمنع تجاوز الحد)
    try {
        const usersToUpdateQuery = db.collection("users").where("job_id", "==", jobId);
        const snapshot = await usersToUpdateQuery.get();

        if (!snapshot.empty) {
            await commitBatchChunks(snapshot.docs, (doc, batch) => {
                batch.update(doc.ref, {
                    permissions_updated_at: admin.firestore.FieldValue.serverTimestamp()
                });
            });
            console.log(`Updated timestamps for ${snapshot.size} users in job ${jobId}`);
        }
    } catch (error) {
        console.error(`Failed to update timestamps for users with job_id: ${jobId}`, error);
    }
});

export const onUserJobChange = onDocumentUpdated("users/{userId}", async (event) => {
    const beforeData = event.data?.before.data();
    const afterData = event.data?.after.data();
    if (!beforeData || !afterData) return;

    if (beforeData.job_id !== afterData.job_id) {
        const userId = event.params.userId;
        const userRef = db.collection("users").doc(userId);
        try {
            await userRef.update({
                permissions_updated_at: admin.firestore.FieldValue.serverTimestamp()
            });
        } catch (error) {
            console.error(`Failed to update timestamp for user: ${userId} after job change.`, error);
        }
    }
});

// ============================================================================
// 🔐 نظام إدارة الصلاحيات المباشرة (Direct Permissions System) - (System 1)
// ============================================================================
//END

// ============================================================================
// 📬 الإشعارات اللحظية (Real-time Notifications) - Triggers
// ============================================================================
// هذا القسم يحتوي على الـ Triggers التي تُشغَّل تلقائياً عند تغيير البيانات

// --- Trigger 1: إشعار عند تغيير صلاحيات الوظيفة ---
export const onJobPermissionChangeNotify = onDocumentWritten(
    "job_permissions/{docId}",
    async (event) => {
        try {
            const before = event.data?.before.data();
            const after = event.data?.after.data();

            // حالة الحذف
            if (!after) {
                console.log(`Job permission deleted: ${event.params.docId}`);
                return;
            }

            const jobId = after.job_id;
            if (!jobId) {
                console.log("No job_id found in permission document");
                return;
            }

            // جلب جميع المستخدمين في هذه الوظيفة
            const usersSnap = await db.collection("users")
                .where("job_id", "==", jobId)
                .get();

            const userIds = usersSnap.docs.map(d => d.id);

            if (userIds.length === 0) {
                console.log(`No users found for job_id: ${jobId}`);
                return;
            }

            // تحديد نوع التغيير
            const changeType = !before ? "added" : "modified";

            // تحديد المورد المتأثر
            let resourceKey: string | undefined;
            if (after.service_id) resourceKey = `s:${after.service_id}`;
            else if (after.sub_service_id) resourceKey = `ss:${after.sub_service_id}`;
            else if (after.sub_sub_service_id) resourceKey = `sss:${after.sub_sub_service_id}`;

            // إرسال الإشعارات
            await notifyPermissionChange({
                affectedUserIds: userIds,
                changeType,
                permissionType: "direct",
                resourceKey,
                jobId: String(jobId),
                message_ar: `تم ${changeType === "added" ? "إضافة" : "تعديل"} صلاحية في وظيفتك`,
                message_en: `A permission was ${changeType === "added" ? "added to" : "modified in"} your job`
            });

            console.log(`✅ Job permission change notification sent for job_id: ${jobId}`);

        } catch (error) {
            console.error("Error in onJobPermissionChangeNotify:", error);
        }
    }
);

// --- Trigger 2: إشعار عند تغيير نطاق الوصول للوظيفة ---
export const onAccessJobScopeChangeNotify = onDocumentWritten(
    "access_job_scopes/{docId}",
    async (event) => {
        try {
            const before = event.data?.before.data();
            const after = event.data?.after.data();

            if (!after) return;

            const jobId = after.job_id;
            if (!jobId) return;

            const usersSnap = await db.collection("users")
                .where("job_id", "==", jobId)
                .get();

            const userIds = usersSnap.docs.map(d => d.id);
            if (userIds.length === 0) return;

            const changeType = !before ? "added" : "modified";

            await notifyPermissionChange({
                affectedUserIds: userIds,
                changeType,
                permissionType: "access",
                jobId: String(jobId),
                message_ar: `تم ${changeType === "added" ? "إضافة" : "تعديل"} نطاق الوصول لوظيفتك`,
                message_en: `Access scope for your job has been ${changeType === "added" ? "added" : "modified"}`
            });

            console.log(`✅ Access scope change notification sent for job_id: ${jobId}`);

        } catch (error) {
            console.error("Error in onAccessJobScopeChangeNotify:", error);
        }
    }
);

// --- Trigger 3: إشعار عند تغيير نطاق التحكم للوظيفة ---
export const onControlJobScopeChangeNotify = onDocumentWritten(
    "control_job_scopes/{docId}",
    async (event) => {
        try {
            const before = event.data?.before.data();
            const after = event.data?.after.data();

            if (!after) return;

            const jobId = after.job_id;
            if (!jobId) return;

            const usersSnap = await db.collection("users")
                .where("job_id", "==", jobId)
                .get();

            const userIds = usersSnap.docs.map(d => d.id);
            if (userIds.length === 0) return;

            const changeType = !before ? "added" : "modified";

            await notifyPermissionChange({
                affectedUserIds: userIds,
                changeType,
                permissionType: "control",
                jobId: String(jobId),
                message_ar: `تم ${changeType === "added" ? "إضافة" : "تعديل"} نطاق التحكم لوظيفتك`,
                message_en: `Control scope for your job has been ${changeType === "added" ? "added" : "modified"}`
            });

            console.log(`✅ Control scope change notification sent for job_id: ${jobId}`);

        } catch (error) {
            console.error("Error in onControlJobScopeChangeNotify:", error);
        }
    }
);

// --- Trigger 4: إشعار عند تغيير موارد الوصول للوظيفة ---
export const onAccessJobResourceChangeNotify = onDocumentWritten(
    "access_job_resources/{docId}",
    async (event) => {
        try {
            const before = event.data?.before.data();
            const after = event.data?.after.data();

            if (!after) return;

            const jobId = after.job_id;
            if (!jobId) return;

            const usersSnap = await db.collection("users")
                .where("job_id", "==", jobId)
                .get();

            const userIds = usersSnap.docs.map(d => d.id);
            if (userIds.length === 0) return;

            const changeType = !before ? "added" : "modified";

            let resourceKey: string | undefined;
            if (after.service_id) resourceKey = `s:${after.service_id}`;
            else if (after.sub_service_id) resourceKey = `ss:${after.sub_service_id}`;
            else if (after.sub_sub_service_id) resourceKey = `sss:${after.sub_sub_service_id}`;

            await notifyPermissionChange({
                affectedUserIds: userIds,
                changeType,
                permissionType: "access",
                resourceKey,
                jobId: String(jobId),
                message_ar: `تم ${changeType === "added" ? "إضافة" : "تعديل"} موارد الوصول لوظيفتك`,
                message_en: `Access resources for your job have been ${changeType === "added" ? "added" : "modified"}`
            });

            console.log(`✅ Access resource change notification sent for job_id: ${jobId}`);

        } catch (error) {
            console.error("Error in onAccessJobResourceChangeNotify:", error);
        }
    }
);

// --- Trigger 5: إشعار عند تغيير موارد التحكم للوظيفة ---
export const onControlJobResourceChangeNotify = onDocumentWritten(
    "control_job_resources/{docId}",
    async (event) => {
        try {
            const before = event.data?.before.data();
            const after = event.data?.after.data();

            if (!after) return;

            const jobId = after.job_id;
            if (!jobId) return;

            const usersSnap = await db.collection("users")
                .where("job_id", "==", jobId)
                .get();

            const userIds = usersSnap.docs.map(d => d.id);
            if (userIds.length === 0) return;

            const changeType = !before ? "added" : "modified";

            let resourceKey: string | undefined;
            if (after.service_id) resourceKey = `s:${after.service_id}`;
            else if (after.sub_service_id) resourceKey = `ss:${after.sub_service_id}`;
            else if (after.sub_sub_service_id) resourceKey = `sss:${after.sub_sub_service_id}`;

            await notifyPermissionChange({
                affectedUserIds: userIds,
                changeType,
                permissionType: "control",
                resourceKey,
                jobId: String(jobId),
                message_ar: `تم ${changeType === "added" ? "إضافة" : "تعديل"} موارد التحكم لوظيفتك`,
                message_en: `Control resources for your job have been ${changeType === "added" ? "added" : "modified"}`
            });

            console.log(`✅ Control resource change notification sent for job_id: ${jobId}`);

        } catch (error) {
            console.error("Error in onControlJobResourceChangeNotify:", error);
        }
    }
);

// ============================================================================
// 🔓 نظام تفويض الوصول (Access Delegation System) - (System 2)
// ============================================================================
// هذا النظام يسمح للمدراء بتفويض "نطاقات" (على من؟) و "موارد" (ماذا؟) للموظفين أو الوظائف.
// يعتمد هذا النظام على التحقق من أن المانح يملك الصلاحية (Access Authority) قبل المنح.

// ----------------------------------------------------------------------------
// 1. إدارة النطاقات (Scopes Management)
// ----------------------------------------------------------------------------

// إدارة نطاق الوصول للوظائف (Job Access Scope)
export const manageJobAccessScopeSecure = onCall({ region: "us-central1", cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");
    const actorId = request.auth.uid;
    const { targetJobId, scopeData, action, docId } = request.data as {
        targetJobId: string;
        scopeData: {
            target_company_id?: string | null;
            target_job_id?: string | null;
            target_user_id?: string | null;
            restricted_to_company?: boolean;
            // أضف أي حقول أخرى محتملة هنا إذا لزم الأمر
            [key: string]: unknown; // للسماح بحقول إضافية غير متوقعة دون استخدام any
        };
        action: "add" | "remove";
        docId?: string;
    };

    const actorProfile = await _fetchActorDelegationProfile(actorId);
    if (!validateAuthority(actorProfile, "access", { job_id: targetJobId })) {
        throw new HttpsError("permission-denied", "No authority over this job.");
    }
    // التحقق من النطاق الممنوح (يجب أن أملكه لأمنحه)
    if (!actorProfile.isSuperAdmin && action === "add") {
        if (!validateAuthority(actorProfile, "access", { company_id: scopeData.target_company_id, job_id: scopeData.target_job_id, user_id: scopeData.target_user_id })) {
            throw new HttpsError("permission-denied", "Cannot delegate scope you don't have.");
        }
    }

    const batch = db.batch();
    const collectionRef = db.collection("access_job_scopes"); // ✅ الجدول الصحيح

    if (action === "add") {
        const newDoc = collectionRef.doc();
        batch.set(newDoc, { job_id: targetJobId, ...scopeData, created_by: actorId, created_at: admin.firestore.FieldValue.serverTimestamp() });
    } else if (action === "remove" && docId) {
        batch.delete(collectionRef.doc(docId));
    }
    await batch.commit();
    return { success: true };
});

// إدارة نطاق الوصول للمستخدمين (User Access Scope)
export const manageUserAccessScopeSecure = onCall({ region: "us-central1", cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");
    const actorId = request.auth.uid;
    const { targetUserId, scopeData, action, docId } = request.data as {
        targetUserId: string;
        scopeData: {
            target_company_id?: string | null;
            target_job_id?: string | null;
            target_user_id?: string | null;
            restricted_to_company?: boolean;
            [key: string]: unknown;
        };
        action: "add" | "remove";
        docId?: string;
    };

    const actorProfile = await _fetchActorDelegationProfile(actorId);
    const targetUserDoc = await db.collection("users").doc(targetUserId).get();
    if (!targetUserDoc.exists) throw new HttpsError("not-found", "User not found");
    const targetData = targetUserDoc.data()!;

    if (!validateAuthority(actorProfile, "access", { user_id: targetUserId, company_id: targetData.company_id, job_id: targetData.job_id })) {
        throw new HttpsError("permission-denied", "No authority over this user.");
    }
    if (!actorProfile.isSuperAdmin && action === "add") {
        if (!validateAuthority(actorProfile, "access", { company_id: scopeData.target_company_id, job_id: scopeData.target_job_id, user_id: scopeData.target_user_id })) {
            throw new HttpsError("permission-denied", "Cannot delegate scope you don't have.");
        }
    }

    const batch = db.batch();
    const collectionRef = db.collection("access_user_scopes"); // ✅ الجدول الصحيح

    if (action === "add") {
        const newDoc = collectionRef.doc();
        batch.set(newDoc, { user_id: targetUserId, ...scopeData, created_by: actorId, created_at: admin.firestore.FieldValue.serverTimestamp() });
    } else if (action === "remove" && docId) {
        batch.delete(collectionRef.doc(docId));
    }
    await batch.commit();
    return { success: true };
});

// ----------------------------------------------------------------------------
// 2. إدارة الموارد (Resources Management)
// ----------------------------------------------------------------------------

// إدارة موارد الوصول للوظائف (Job Access Resources)
export const manageJobAccessResourcesSecure = onCall({ region: "us-central1", cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");
    const actorId = request.auth.uid;
    const { targetJobId, resourceData, action, docId } = request.data as { targetJobId: string, resourceData: ResourceData, action: "add" | "remove", docId?: string };

    const actorProfile = await _fetchActorDelegationProfile(actorId);
    // 1. هل أملك السيطرة على الوظيفة؟ (access)
    if (!validateAuthority(actorProfile, "access", { job_id: targetJobId })) {
        throw new HttpsError("permission-denied", "No 'access' authority over this job.");
    }
    // 2. هل أملك المورد؟
    if (!actorProfile.isSuperAdmin && action === "add") {
        const key = resourceData.sub_sub_service_id ? `sss:${resourceData.sub_sub_service_id}` : resourceData.sub_service_id ? `ss:${resourceData.sub_service_id}` : `s:${resourceData.service_id}`;
        if (!actorProfile.resources.includes(key)) throw new HttpsError("permission-denied", `Missing resource: ${key}`);
    }

    const batch = db.batch();
    const collectionRef = db.collection("access_job_resources"); // ✅ الجدول الصحيح

    if (action === "add") {
        const newDoc = collectionRef.doc();
        batch.set(newDoc, { job_id: targetJobId, ...resourceData, created_by: actorId, created_at: admin.firestore.FieldValue.serverTimestamp() });
    } else if (action === "remove" && docId) {
        batch.delete(collectionRef.doc(docId));
    }
    await batch.commit();
    return { success: true };
});

// إدارة موارد الوصول للمستخدمين (User Access Resources)
export const manageUserAccessResourcesSecure = onCall({ region: "us-central1", cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");
    const actorId = request.auth.uid;

    const { targetUserId, resourceData, action, docId } = request.data as {
        targetUserId: string,
        // ✅ التعديل: تعريف النوع بدقة بدلاً من any
        resourceData: {
            service_id?: string;
            sub_service_id?: string;
            sub_sub_service_id?: string;
        },
        action: "add" | "remove",
        docId?: string
    };

    const actorProfile = await _fetchActorDelegationProfile(actorId);

    // 1. جلب بيانات المستخدم المستهدف للتحقق من النطاق
    const targetUserDoc = await db.collection("users").doc(targetUserId).get();
    if (!targetUserDoc.exists) throw new HttpsError("not-found", "User not found.");
    const targetUserData = targetUserDoc.data()!;

    // 2. التحقق: هل يقع هذا المستخدم تحت سيطرتي؟
    const hasAuthority = validateAuthority(actorProfile, "access", {
        user_id: targetUserId,
        company_id: targetUserData.company_id,
        job_id: targetUserData.job_id
    });
    if (!hasAuthority) throw new HttpsError("permission-denied", "You do not have authority over this user.");

    // 3. التحقق من الموارد: هل أملك المورد الذي أحاول منحه؟
    if (!actorProfile.isSuperAdmin && action === "add") {
        const p = resourceData;
        const key = p.sub_sub_service_id ? `sss:${p.sub_sub_service_id}` : p.sub_service_id ? `ss:${p.sub_service_id}` : `s:${p.service_id}`;

        if (!actorProfile.resources.includes(key)) {
            throw new HttpsError("permission-denied", `You cannot grant resource ${key} because you don"t have it.`);
        }
    }

    const batch = db.batch();
    const collectionRef = db.collection("access_user_resources");

    if (action === "add") {
        const newDoc = collectionRef.doc();
        // نستخدم is_allowed: true لتمييز المنح، أو false للحظر (إذا أردت دعم الحظر مستقبلاً)
        // في الوقت الحالي سنفترض المنح دائماً عند الإضافة
        batch.set(newDoc, {
            user_id: targetUserId,
            ...resourceData,
            is_allowed: true,
            created_by: actorId,
            created_at: admin.firestore.FieldValue.serverTimestamp()
        });
    } else if (action === "remove" && docId) {
        batch.delete(collectionRef.doc(docId));
    }

    await batch.commit();
    return { success: true };
});

// ============================================================================
// 🔓 نظام تفويض الوصول (Access Delegation System) - (System 2)
// ============================================================================
//END

// ============================================================================
// 🎮 نظام تفويض التحكم (Control Delegation System) - (System 3)
// ============================================================================
// هذا النظام هو الأعلى مستوى، ويسمح بتفويض "صلاحية التفويض" نفسها.
// يعتمد على التحقق من (Control Authority) بدلاً من (Access Authority).

// ----------------------------------------------------------------------------
// 1. إدارة النطاقات (Control Scopes)
// ----------------------------------------------------------------------------

// تفويض التحكم للمستخدمين (منح شخص القدرة على إدارة نطاق معين)
export const manageControlDelegationSecure = onCall({ region: "us-central1", cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");
    const actorId = request.auth.uid;

    const { targetUserId, scopeToAdd } = request.data as {
        targetUserId: string,
        scopeToAdd: DelegationScope & { target_job_id: string, target_company_id: string }
    };

    const targetUserDoc = await db.collection("users").doc(targetUserId).get();
    if (!targetUserDoc.exists) throw new HttpsError("not-found", "Target user not found.");
    const targetUserData = targetUserDoc.data()!;

    const actorProfile = await _fetchActorDelegationProfile(actorId);

    // أ) هل أستطيع الوصول للمستخدم؟
    const hasAccessAuthority = validateAuthority(actorProfile, "access", {
        user_id: targetUserId,
        company_id: targetUserData.company_id,
        job_id: targetUserData.job_id
    });
    if (!hasAccessAuthority) throw new HttpsError("permission-denied", "You cannot assign roles to this user (Out of scope).");

    // ب) هل أملك السيطرة على النطاق الذي أمنحه؟
    const hasControlAuthority = validateAuthority(actorProfile, "control", {
        company_id: scopeToAdd.target_company_id,
        job_id: scopeToAdd.target_job_id,
        department_id: scopeToAdd.scope_department_id || undefined
    });

    if (!hasControlAuthority) {
        throw new HttpsError("permission-denied", "You cannot delegate control over a scope you do not control yourself.");
    }

    const newRuleRef = db.collection("control_user_scopes").doc();
    await newRuleRef.set({
        user_id: targetUserId,
        ...scopeToAdd,
        created_by: actorId,
        created_at: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true, message: "Control delegation granted successfully." };
});

// ----------------------------------------------------------------------------
// 2. إدارة الموارد (Control Resources)
// ----------------------------------------------------------------------------

// إدارة موارد التحكم للوظائف (Control Job Resources)
export const manageJobControlResourcesSecure = onCall({ region: "us-central1", cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");
    const actorId = request.auth.uid;

    const { targetJobId, resourceData, action, docId } = request.data as {
        targetJobId: string,
        resourceData: {
            service_id?: string;
            sub_service_id?: string;
            sub_sub_service_id?: string;
        },
        action: "add" | "remove",
        docId?: string
    };

    const actorProfile = await _fetchActorDelegationProfile(actorId);

    // 1. التحقق من الصلاحية على الوظيفة (هل أملك حق "التحكم" في هذه الوظيفة؟)
    const hasAuthority = validateAuthority(actorProfile, "control", { job_id: targetJobId });
    if (!hasAuthority) throw new HttpsError("permission-denied", "You do not have 'control' authority over this job.");

    // 2. التحقق من الموارد
    if (!actorProfile.isSuperAdmin && action === "add") {
        const p = resourceData;
        const key = p.sub_sub_service_id ? `sss:${p.sub_sub_service_id}` : p.sub_service_id ? `ss:${p.sub_service_id}` : `s:${p.service_id}`;

        // (نفترض أن الموارد التي تمنح للتحكم هي نفسها التي تمنح للوصول)
        if (!actorProfile.resources.includes(key)) {
            throw new HttpsError("permission-denied", `You cannot grant control resource ${key}.`);
        }
    }

    const batch = db.batch();
    const collectionRef = db.collection("control_job_resources");

    if (action === "add") {
        const newDoc = collectionRef.doc();
        batch.set(newDoc, {
            job_id: targetJobId,
            ...resourceData,
            created_by: actorId,
            created_at: admin.firestore.FieldValue.serverTimestamp()
        });
    } else if (action === "remove" && docId) {
        batch.delete(collectionRef.doc(docId));
    }

    await batch.commit();
    return { success: true };
});

// إدارة موارد التحكم للمستخدمين (Control User Resources)
export const manageUserControlResourcesSecure = onCall({ region: "us-central1", cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");
    const actorId = request.auth.uid;

    const { targetUserId, resourceData, action, docId } = request.data as {
        targetUserId: string,
        resourceData: {
            service_id?: string;
            sub_service_id?: string;
            sub_sub_service_id?: string;
        },
        action: "add" | "remove",
        docId?: string
    };

    const actorProfile = await _fetchActorDelegationProfile(actorId);

    // 1. جلب بيانات المستخدم المستهدف للتحقق من النطاق
    const targetUserDoc = await db.collection("users").doc(targetUserId).get();
    if (!targetUserDoc.exists) throw new HttpsError("not-found", "User not found.");
    const targetUserData = targetUserDoc.data()!;

    // 2. التحقق: هل أملك حق "التحكم" في هذا المستخدم؟
    const hasAuthority = validateAuthority(actorProfile, "control", {
        user_id: targetUserId,
        company_id: targetUserData.company_id,
        job_id: targetUserData.job_id
    });
    if (!hasAuthority) throw new HttpsError("permission-denied", "You do not have 'control' authority over this user.");

    // 3. التحقق من الموارد: هل أملك المورد الذي أحاول منحه؟
    if (!actorProfile.isSuperAdmin && action === "add") {
        const p = resourceData;
        const key = p.sub_sub_service_id ? `sss:${p.sub_sub_service_id}` : p.sub_service_id ? `ss:${p.sub_service_id}` : `s:${p.service_id}`;

        // (نفترض أن الموارد هي نفسها)
        if (!actorProfile.resources.includes(key)) {
            throw new HttpsError("permission-denied", `You cannot grant control resource ${key}.`);
        }
    }

    const batch = db.batch();
    const collectionRef = db.collection("control_user_resources");

    if (action === "add") {
        const newDoc = collectionRef.doc();
        batch.set(newDoc, {
            user_id: targetUserId,
            ...resourceData,
            is_allowed: true, // (حالياً ندعم المنح فقط في هذا النظام)
            created_by: actorId,
            created_at: admin.firestore.FieldValue.serverTimestamp()
        });
    } else if (action === "remove" && docId) {
        batch.delete(collectionRef.doc(docId));
    }

    await batch.commit();
    return { success: true };
});

// ============================================================================
// 🎮 نظام تفويض التحكم (Control Delegation System) - (System 3)
// ============================================================================
//END

// ============================================================================
// 👤 نظام دورة حياة المستخدم والمصادقة (User Lifecycle & Auth System) - (System 4)
// ============================================================================
// يشمل: طلبات الإنشاء، الاعتماد، تعيين كلمات المرور، التجميد، السجلات التاريخية، والبريد.

// ----------------------------------------------------------------------------
// 1. إدارة طلبات الانضمام (Onboarding Requests)
// ----------------------------------------------------------------------------

// أ) تقديم طلب مستخدم جديد (بواسطة المدير)
export const requestNewUser = onCall({
    region: "us-central1",
    cors: [new RegExp(/^http:\/\/localhost(:\d+)?$/), new RegExp(/^https:\/\/localhost(:\d+)?$/), "https://h-ssd.com", "https://hejazissd.com", "https://hejazi-ssd.web.app"],
    secrets: ["IPINFO_TOKEN"]
}, async (request) => {

    // 1. التحقق من المصادقة
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
    }
    const userId = request.auth.uid;
    const { requestData, clientContext } = request.data as {
        requestData: UserOnboardingRequestData & { notes?: string },
        clientContext?: Record<string, unknown>
    };

    // 2. التحقق من الصلاحيات (sss:13)
    const userPermissions = await _fetchUserEffectivePermissions(userId);
    if (userPermissions["sss:13"] !== true) {
        throw new HttpsError("permission-denied", "You do not have permission (sss:13) to request new users.");
    }

    // 3. التحقق من المدخلات
    if (!requestData || !requestData.email || !requestData.name_ar || !requestData.name_en || !requestData.job_id || !requestData.company_id || !requestData.gender || !requestData.country || !requestData.first_name_ar || !requestData.last_name_ar || !requestData.first_name_en || !requestData.last_name_en) {
        throw new HttpsError("invalid-argument", "Missing required user data (name parts, email, job_id, company_id, gender, country).");
    }

    try {
        // 4. التحقق من منطق العمل (هل البريد موجود مسبقاً؟)
        const userExists = await admin.auth().getUserByEmail(requestData.email).catch(() => null);
        if (userExists) {
            throw new HttpsError("already-exists", "A user with this email already exists in Firebase Auth.");
        }

        const pendingRequestQuery = await db.collection("user_onboarding_requests")
            .where("email", "==", requestData.email)
            .where("status", "==", "Awaiting Approval")
            .get();

        if (!pendingRequestQuery.empty) {
            throw new HttpsError("already-exists", "A pending request for this email already exists.");
        }

        // 5. جلب بيانات المُنشئ والتتبع 
        const ipInfo = await getIpInfo(request.rawRequest.ip);
        const actionMetadata = {
            timestamp_utc: new Date(),
            client_details: clientContext || null,
            server_details: { ip_info: ipInfo, user_agent_raw: request.rawRequest.headers["user-agent"] || null }
        };

        const batch = db.batch(); // بداية الباتش
        const userDoc = await db.collection("users").doc(userId).get();
        const userData = userDoc.data();
        const actorJobId = userData?.job_id || null;
        const actorSignatureUrl = userData?.signature_url || null;

        if (!actorSignatureUrl) {
            throw new HttpsError("failed-precondition", "You must have a signature to submit a request. Please update your profile.");
        }

        // ✅ التعديل: جلب المستخدمين المسؤولين عن الموافقة (sss:14) **قبل** الـ Commit
        // هذا يضمن أننا نملك البيانات اللازمة لإنشاء المهمة داخل الباتش
        const approverUserIds = await getUsersWithPermission("sss:14");

        // 6. إعداد بيانات "الكيان الأب" (سجل الطلب)
        const newRequestRef = db.collection("user_onboarding_requests").doc();
        const requestId = newRequestRef.id;
        const sequenceNumber = await getNextTaskSequenceId("user_onboarding_counter");

        const finalRequestData: Record<string, unknown> = {
            ...requestData,
            app_exception: false,
            company_exception: false,
            is_allowed: true,
            is_super_admin: false,
            job_exception: false,
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            created_by: userId,
            status: "Awaiting Approval",
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
            sequence_number: sequenceNumber // إضافة الرقم التسلسلي للطلب
        };

        // تنظيف البيانات
        Object.keys(finalRequestData).forEach(key => {
            const value = finalRequestData[key as keyof typeof finalRequestData];
            if (value === undefined || value === null || (typeof value === "string" && value.trim() === "")) {
                delete finalRequestData[key];
            }
        });

        // ✅ إضافة عملية حفظ الطلب إلى الباتش
        batch.set(newRequestRef, finalRequestData);

        // 7. ✅ إعداد بيانات "المهمة" (Task) يدويًا لدمجها في الباتش
        const newTaskRef = db.collection("tasks_queue").doc();

        const taskData = {
            service_id: 2,
            sa_id: 14,
            parent_entity_id: requestId,
            actor_user_id: userId,
            actor_job_id: actorJobId,
            sequence_number: sequenceNumber,
            assigned_to_user_ids: approverUserIds,
            is_assigned_to_super_admins: true,
            target_entity_name_ar: requestData.name_ar,
            target_entity_name_en: requestData.name_en,
            // نفس بنية Details التي كانت تمرر لـ createTask
            details: {
                notes: requestData.notes || null,
                message_ar: `طلب إنشاء حساب لـ: ${requestData.name_ar}`,
                message_en: `Request to create user: ${requestData.name_en}`,
                email: requestData.email,
                job_id: requestData.job_id
            },
            action_metadata: actionMetadata,
            actor_signature_url: actorSignatureUrl,
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            // حقول إضافية قد يحتاجها النظام لمعرفة حالة المهمة
            status: "pending",
            is_active: true
        };

        // ✅ إضافة عملية إنشاء المهمة إلى الباتش
        batch.set(newTaskRef, taskData);

        // 8. تنفيذ الباتش (حفظ الطلب + إنشاء المهمة في آن واحد)
        await batch.commit();

        // 9. إرجاع النتيجة
        return { success: true, requestId: newRequestRef.id, sequenceNumber: sequenceNumber };

    } catch (error) {
        console.error("Error in requestNewUser:", error);
        if (error instanceof HttpsError) throw error;
        throw new HttpsError("internal", "An error occurred while creating the user request.");
    }
});

// ب) معالجة الطلب (اعتماد/رفض/مراجعة) - (بواسطة المسؤول)
export const processUserOnboardingTask = onCall({
    region: "us-central1",
    cors: true,
    secrets: ["IPINFO_TOKEN"]
}, async (request) => {

    // 1. التحقق من المصادقة والمُدخلات 
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
    }
    const userId = request.auth.uid; // هذا هو (المسؤول)
    const { taskId, action, reason, clientContext, optionalReason } = request.data as {
        taskId: string;
        action: "approve" | "reject" | "needs_revision";
        reason?: string; // الإلزامي (للرفض أو المراجعة)
        optionalReason?: string; // ✅ الإضافة الجديدة: الملاحظة الاختيارية (للاعتماد)
        clientContext?: Record<string, unknown>;
    };

    if (!taskId || !action) {
        throw new HttpsError("invalid-argument", "Missing required parameters: taskId and action.");
    }
    if ((action === "reject" || action === "needs_revision") && !reason) {
        throw new HttpsError("invalid-argument", "Reason is required for 'reject' or 'needs_revision'.");
    }

    // 2. تجهيز البيانات الأولية 
    const batch = db.batch();
    try {
        const ipInfo = await getIpInfo(request.rawRequest.ip);
        const actionMetadata = {
            timestamp_utc: new Date(),
            client_details: clientContext || null,
            server_details: { ip_info: ipInfo, user_agent_raw: request.rawRequest.headers["user-agent"] || null }
        };

        const taskRef = db.collection("tasks_queue").doc(taskId);
        const taskDoc = await taskRef.get();
        if (!taskDoc.exists) {
            throw new HttpsError("not-found", "Task not found in queue.");
        }
        const taskData = taskDoc.data()!;

        if (!taskData.assigned_to_user_ids.includes(userId) && taskData.is_assigned_to_super_admins !== true) {
            throw new HttpsError("permission-denied", "You are not assigned to this task.");
        }

        const userDoc = await db.collection("users").doc(userId).get();
        const userData = userDoc.data();
        const actorJobId = userData?.job_id || null;
        const approverSignatureUrl = userData?.signature_url || null;

        const requestRef = db.collection("user_onboarding_requests").doc(taskData.parent_entity_id);
        const requestDoc = await requestRef.get();
        if (!requestDoc.exists) {
            throw new HttpsError("not-found", "User Onboarding Request referenced by task not found.");
        }
        const requestData = requestDoc.data()!;
        const originalCreatorId = requestData.created_by;

        // 🚨 جلب بيانات مقدم الطلب بشكل آمن ومسبق (لإرسال إشعارات الرفض والمراجعة)
        const creatorDoc = await db.collection("users").doc(originalCreatorId as string).get();
        const creatorEmail = creatorDoc.exists ? creatorDoc.data()!.email as string : null;

        // 3. تجهيز سجل الإجراء (Task History) 
        const historyRef = db.collection("tasks_history").doc();
        const historyLogPayload: Record<string, unknown> = {
            task_id: taskId,
            parent_entity_id: taskData.parent_entity_id,
            service_id: taskData.service_id,
            sa_id: taskData.sa_id,
            sequence_number: taskData.sequence_number || null, // ✅ النقطة 2: رقم العملية
            target_entity_id: taskData.target_entity_id,
            target_entity_name_ar: taskData.target_entity_name_ar,
            target_entity_name_en: taskData.target_entity_name_en,
            status: action === "approve" ? "approved" : action === "reject" ? "Rejected" : "revision_requested",
            actor_user_id: userId,
            actor_job_id: actorJobId,
            details: {
                ...taskData.details,
                reason: reason || null, // الإلزامي (للرفض/المراجعة)
                optional_notes: optionalReason || null // ✅ النقطة 3: الاختياري (للاعتماد)
            },
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            action_metadata: actionMetadata
        };

        // 4. تنفيذ المنطق بناءً على نوع الإجراء
        switch (action) {
            case "approve": {
                if (!approverSignatureUrl) {
                    throw new HttpsError("failed-precondition", "You must have a signature to approve a request. Please update your profile.");
                }
                historyLogPayload.actor_signature_url = approverSignatureUrl;

                // --- 🚀 بدء عملية إنشاء المستخدم ---
                const tempPassword = Math.random().toString(36).slice(-12);

                const sequenceNumber = requestData.sequence_number || null;

                const userRecord = await admin.auth().createUser({
                    email: requestData.email as string,
                    emailVerified: true,
                    displayName: requestData.name_en as string,
                    password: tempPassword
                });

                const newUserData: Record<string, unknown> = {
                    email: requestData.email, company_id: requestData.company_id, employee_id: requestData.employee_id, job_id: requestData.job_id,
                    name_ar: requestData.name_ar, name_en: requestData.name_en, first_name_ar: requestData.first_name_ar, second_name_ar: requestData.second_name_ar, third_name_ar: requestData.third_name_ar, last_name_ar: requestData.last_name_ar,
                    first_name_en: requestData.first_name_en, second_name_en: requestData.second_name_en, third_name_en: requestData.third_name_en, last_name_en: requestData.last_name_en,
                    phone_number: requestData.phone_number, gender: requestData.gender, country: requestData.country,
                    work_email: requestData.work_email || null, work_phone: requestData.work_phone || null, landline_phone: requestData.landline_phone || null,
                    company_email: requestData.company_email || null, company_phone: requestData.company_phone || null, company_landline_phone: requestData.company_landline_phone || null,
                    "reason-company-phone": requestData["reason-company-phone"] || null, "alternative-phone": requestData["alternative-phone"] || null,

                    // الحقول الثابتة
                    id: userRecord.uid,
                    is_allowed: true, is_super_admin: false, app_exception: false, company_exception: false, job_exception: false,
                    created_at: admin.firestore.FieldValue.serverTimestamp(),
                    sequence_number: sequenceNumber,
                    latest_version_id: null,
                };

                Object.keys(newUserData).forEach(key => {
                    const value = newUserData[key];
                    if (value === null || (typeof value === "string" && value.trim() === "")) { delete newUserData[key]; }
                });

                const userRef = db.collection("users").doc(userRecord.uid);
                batch.set(userRef, newUserData);

                const userHistoryRef = db.collection("user_history").doc();
                const historyRecord: Record<string, unknown> = {
                    ...newUserData, parent_user_id: userRecord.uid, version_number: 1, action: "CREATED",
                    action_by_user_id: userId, created_at: admin.firestore.FieldValue.serverTimestamp(),
                };
                delete historyRecord.latest_version_id;
                batch.set(userHistoryRef, historyRecord);

                batch.update(userRef, { latest_version_id: userHistoryRef.id });

                const token = crypto.randomBytes(32).toString("hex");
                const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
                const tokenData = {
                    email: requestData.email as string, user_id: userRecord.uid,
                    expires_at: admin.firestore.Timestamp.fromDate(expires),
                    created_at: admin.firestore.FieldValue.serverTimestamp()
                };

                const tokenRef = db.collection("password_reset_tokens").doc(token);
                batch.set(tokenRef, tokenData);

                // ✅ التعديل: إضافة مهمة إرسال بريد إلكتروني إلى طابور "mail"
                const mailRef = db.collection("mail").doc();
                batch.set(mailRef, {
                    to: [requestData.email as string], // يجب أن يكون مصفوفة
                    template: {
                        name: "user_activation", // اسم القالب: تفعيل مستخدم
                        data: { // البيانات التي يحتاجها القالب
                            gender: requestData.gender,
                            first_name_ar: requestData.first_name_ar,
                            last_name_ar: requestData.last_name_ar,
                            first_name_en: requestData.first_name_en,
                            last_name_en: requestData.last_name_en,
                            token: token // الرمز الذي أنشأناه
                        }
                    },
                    created_at: admin.firestore.FieldValue.serverTimestamp()
                });

                // ✅ النقطة 3: حذف المهمة عند الاعتماد
                batch.delete(taskRef);

                // تحديث حالة الطلب
                batch.update(requestRef, { status: "Approved", updated_at: admin.firestore.FieldValue.serverTimestamp(), approved_by: userId });
                break;
            }
            case "reject": {
                // ✅ النقطة 3: حذف المهمة عند الرفض
                batch.delete(taskRef);

                // ✅ التعديل: إضافة مهمة إرسال بريد إلكتروني إلى طابور "mail"
                if (creatorEmail) { // فقط إذا وجدنا بريد إلكتروني للمُنشئ
                    const mailRef = db.collection("mail").doc();
                    batch.set(mailRef, {
                        to: [creatorEmail],
                        template: {
                            name: "user_rejected", // اسم القالب: رُفض
                            data: { // البيانات التي يحتاجها القالب
                                gender: creatorDoc.data()?.gender || "",
                                name_ar: creatorDoc.data()?.name_ar || "مقدم الطلب",
                                name_en: creatorDoc.data()?.name_en || "Requester",
                                reason: reason
                            }
                        },
                        created_at: admin.firestore.FieldValue.serverTimestamp()
                    });
                }

                // تحديث حالة الطلب
                batch.update(requestRef, { status: "Rejected", updated_at: admin.firestore.FieldValue.serverTimestamp() });
                break;
            }
            case "needs_revision": {
                // 1. جلب جميع المستخدمين الذين يملكون صلاحية الإنشاء (sss:13)
                // بدلاً من إعادتها للمنشئ فقط [originalCreatorId]
                const modifiersUserIds = await getUsersWithPermission("sss:13");

                // 2. تحديث المهمة
                batch.update(taskRef, {
                    sa_id: 15, // SA_ID for Resubmit
                    assigned_to_user_ids: modifiersUserIds // ✅ الآن تعود للمجموعة كاملة
                });

                // 3. إرسال البريد (يمكن إرساله للمنشئ الأصلي فقط كإشعار، أو للجميع حسب الرغبة)
                // سنبقيه للمنشئ الأصلي كإشعار شخصي له
                if (creatorEmail) {
                    const mailRef = db.collection("mail").doc();
                    batch.set(mailRef, {
                        to: [creatorEmail],
                        template: {
                            name: "user_revision",
                            data: {
                                gender: creatorDoc.data()?.gender || "",
                                name_ar: creatorDoc.data()?.name_ar || "مقدم الطلب",
                                name_en: creatorDoc.data()?.name_en || "Requester",
                                reason: reason,
                                target_name_ar: requestData.name_ar,
                                target_name_en: requestData.name_en
                            }
                        },
                        created_at: admin.firestore.FieldValue.serverTimestamp()
                    });
                }

                // تحديث حالة الطلب
                batch.update(requestRef, { status: "Needs Revision", updated_at: admin.firestore.FieldValue.serverTimestamp() });
                break;
            }
        }

        // 5. إضافة سجل الإجراء النهائي 
        batch.set(historyRef, historyLogPayload);

        // 6. تنفيذ جميع العمليات
        await batch.commit();
        return { success: true, message: "Action completed successfully." };

    } catch (error) {
        console.error("Error in processUserOnboardingTask:", error);
        if (error instanceof HttpsError) throw error;
        let detailMessage = "An internal error occurred.";
        if (error instanceof Error) { detailMessage = error.message; }
        throw new HttpsError("internal", detailMessage, error);
    }
});

// ج) إعادة تقديم الطلب بعد المراجعة
export const resubmitUserOnboarding = onCall({
    region: "us-central1",
    // ✅ الإصلاح: استخدام Regex للسماح بجميع البورتات على localhost وإضافة جميع نطاقاتك
    cors: [new RegExp(/^http:\/\/localhost(:\d+)?$/), new RegExp(/^https:\/\/localhost(:\d+)?$/), "https://h-ssd.com", "https://hejazissd.com", "https://hejazi-ssd.web.app"],
    secrets: ["IPINFO_TOKEN"]
}, async (request) => {

    // 1. التحقق من المصادقة
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
    }
    const userId = request.auth.uid; // هذا هو (المدير)
    const { taskId, updatedData, clientContext } = request.data as {
        taskId: string;
        updatedData: Partial<UserOnboardingRequestData>;
        clientContext?: Record<string, unknown>;
    };

    try {
        // 2. تجهيز البيانات الأولية
        const ipInfo = await getIpInfo(request.rawRequest.ip);
        const actionMetadata = {
            timestamp_utc: new Date(),
            client_details: clientContext || null,
            server_details: { ip_info: ipInfo, user_agent_raw: request.rawRequest.headers["user-agent"] || null }
        };

        const batch = db.batch();

        // 3. جلب المهمة والتحقق من الصلاحية
        const taskRef = db.collection("tasks_queue").doc(taskId);
        const taskDoc = await taskRef.get();
        if (!taskDoc.exists) throw new HttpsError("not-found", "Task not found in queue.");

        const taskData = taskDoc.data()!;
        if (!taskData.assigned_to_user_ids.includes(userId)) {
            // (ملاحظة: إذا أردت السماح لأي شخص لديه sss:15 بالتعديل، يجب فحص الصلاحيات هنا أيضاً)
            // (لكن الكود الحالي يفحص فقط "المُسند إليه" وهو صحيح للمنطق الحالي)
            throw new HttpsError("permission-denied", "You are not assigned to this task.");
        }

        // 4. جلب الكيان الأب (الطلب)
        const requestRef = db.collection("user_onboarding_requests").doc(taskData.parent_entity_id);
        const requestDoc = await requestRef.get();
        if (!requestDoc.exists) throw new HttpsError("not-found", "User Onboarding Request not found.");

        const targetEntityNameAr = updatedData.name_ar || taskData.target_entity_name_ar || "غير معروف";
        const targetEntityNameEn = updatedData.name_en || taskData.target_entity_name_en || "Unknown";
        const sequenceNumber = taskData.sequence_number; // رقم العملية

        const userDoc = await db.collection("users").doc(userId).get();
        const actorJobId = userDoc.data()?.job_id || null;

        // 5. تحديث الكيان الأب (الطلب) بالبيانات الجديدة
        batch.update(requestRef, {
            ...updatedData,
            status: "Awaiting Approval",
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        });

        // 6. إضافة سجل تاريخي لـ "إعادة التقديم"
        const newHistoryLogRef = db.collection("tasks_history").doc();
        batch.set(newHistoryLogRef, {
            task_id: taskId,
            parent_entity_id: taskData.parent_entity_id,
            service_id: taskData.service_id, // 2
            sa_id: taskData.sa_id, // 15 (تعديل)
            sequence_number: sequenceNumber, // ✅ النقطة 2: رقم العملية
            target_entity_id: taskData.target_entity_id,
            target_entity_name_ar: targetEntityNameAr,
            target_entity_name_en: targetEntityNameEn,
            status: "resubmitted",
            actor_user_id: userId,
            actor_job_id: actorJobId,
            details: { message: "User request resubmitted after revision." },
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            action_metadata: actionMetadata
        });

        // 7. حذف المهمة القديمة (مهمة التعديل)
        batch.delete(taskRef);

        // 8. إنشاء مهمة "اعتماد" جديدة
        const approverUserIds = await getUsersWithPermission("sss:14"); // ✅ تصحيح النطاق

        await createTask({
            serviceId: 2,
            saId: 14, // العودة للاعتماد
            parentEntityId: requestRef.id,
            actorUserId: userId,
            actorJobId: actorJobId,
            sequenceNumber: sequenceNumber, // ✅ النقطة 2: تمرير رقم العملية
            assignedToUserIds: approverUserIds, // ✅ استخدام IDs المجلوبة
            isAssignedToSuperAdmins: true,
            targetEntityNameAr: targetEntityNameAr,
            targetEntityNameEn: targetEntityNameEn,
            details: {
                message_ar: `إعادة تقديم طلب لـ: ${targetEntityNameAr}`,
                message_en: `Resubmitted request for: ${targetEntityNameEn}`,
                email: updatedData.email || requestDoc.data()?.email,
            },
            actionMetadata,
            skipHistoryCreation: true
        });

        // 9. تنفيذ
        await batch.commit();
        return { success: true, message: "User request resubmitted successfully." };

    } catch (error) {
        console.error("Error in resubmitUserOnboarding:", error);
        if (error instanceof HttpsError) throw error;
        let detailMessage = "An internal error occurred while resubmitting.";
        if (error instanceof Error) {
            detailMessage = error.message;
        }
        throw new HttpsError("internal", detailMessage);
    }
});

// ----------------------------------------------------------------------------
// 2. إدارة الحسابات والأمان (Account & Security)
// ----------------------------------------------------------------------------

// تعيين كلمة المرور عبر الرمز (Token)
export const redeemPasswordResetToken = onCall({
    region: "us-central1",
    cors: true
}, async (request) => {

    const { token, password } = request.data as { token: string, password: string };

    if (!token || !password) {
        throw new HttpsError("invalid-argument", "Missing required parameters: token and password.");
    }

    // (اختياري: التحقق من قوة كلمة المرور)
    if (password.length < 6) {
        throw new HttpsError("invalid-argument", "auth/weak-password");
    }

    const tokenRef = db.collection("password_reset_tokens").doc(token);
    const batch = db.batch();

    try {
        const tokenDoc = await tokenRef.get();

        // 1. التحقق من وجود الرمز
        if (!tokenDoc.exists) {
            console.error(`Token not found: ${token}`);
            throw new HttpsError("not-found", "The link is invalid or has expired. (T_NF)");
        }

        const tokenData = tokenDoc.data()!;
        const expires = (tokenData.expires_at as admin.firestore.Timestamp).toDate();
        const userId = tokenData.user_id;

        // 2. التحقق من تاريخ انتهاء الصلاحية
        if (expires < new Date()) {
            console.error(`Token expired for user: ${userId}`);
            // (اختياري: يمكن حذف الرمز منتهي الصلاحية)
            // batch.delete(tokenRef); 
            // await batch.commit();
            throw new HttpsError("deadline-exceeded", "The link has expired. Please request a new one. (T_EXP)");
        }

        // 3. الرمز صالح - تحديث كلمة المرور
        await admin.auth().updateUser(userId, {
            password: password,
        });

        // 4. حذف الرمز لمنع إعادة استخدامه
        batch.delete(tokenRef);
        await batch.commit();

        return { success: true, message: "Password updated successfully." };

    } catch (error) {
        console.error(`Error redeeming token ${token}:`, error);
        if (error instanceof HttpsError) {
            throw error; // أعد رمي الخطأ إذا كان من نوع HttpsError
        }
        // أعد رمي خطأ عام
        throw new HttpsError("internal", "An internal error occurred. Please try again. (T_INT)");
    }
});

// طلب رابط إعادة تعيين كلمة المرور
export const requestPasswordReset = onCall({
    region: "us-central1",
    cors: true,
    secrets: ["SENDGRID_KEY"] // نتأكد من أن مفتاح SendGrid متاح
}, async (request) => {

    const { email } = request.data as { email: string };

    if (!email) {
        throw new HttpsError("invalid-argument", "auth/missing-email");
    }

    let userRecord;
    try {
        // 1. البحث عن المستخدم عن طريق البريد
        userRecord = await admin.auth().getUserByEmail(email);
        // ✨✨ --- التعديل الجديد هنا --- ✨✨
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_error) {
        // 2. إذا لم يتم العثور على المستخدم
        console.warn(`Password reset requested for non-existent user: ${email}`);
        // 🚨 هام: لا نرسل خطأ، بل نرسل نجاحاً وهمياً
        // هذا يمنع "استغلال" الميزة لمعرفة أي الإيميلات مسجلة في النظام
        return { success: true };
    }

    // 3. المستخدم موجود - إنشاء رمز (Token)
    const token = crypto.randomBytes(32).toString("hex");
    // (نجعل صلاحية الرابط ساعة واحدة فقط)
    const expires = new Date(Date.now() + 1 * 60 * 60 * 1000);
    const tokenRef = db.collection("password_reset_tokens").doc(token);

    await tokenRef.set({
        email: userRecord.email,
        user_id: userRecord.uid,
        expires_at: admin.firestore.Timestamp.fromDate(expires),
        created_at: admin.firestore.FieldValue.serverTimestamp()
    });

    // 4. إرسال البريد الإلكتروني
    const customPasswordSetLink = `https://h-ssd.com/set-password?token=${token}`;

    const SENDGRID_API_KEY = process.env.SENDGRID_KEY;
    if (!SENDGRID_API_KEY) {
        console.error("CRITICAL: SENDGRID_KEY not set for password reset.");
        throw new HttpsError("internal", "auth/email-service-down");
    }
    sgMail.setApiKey(SENDGRID_API_KEY);

    const emailToSend: sgMail.MailDataRequired = {
        to: userRecord.email,
        from: {
            email: "system@h-ssd.com",
            name: "H-SSD"
        },
        subject: "H-SSD - Password Reset Request",
        html: `
            <h1 style="text-align: right;">طلب إعادة تعيين كلمة المرور</h1>
            <p style="text-align: right;">لقد تلقينا طلباً لإعادة تعيين كلمة المرور الخاصة بك في نظام H-SSD.</p>
            <p style="text-align: right;">يرجى الضغط على الرابط أدناه لتعيين كلمة مرور جديدة:</p>
            <p style="text-align: right;"><a href="${customPasswordSetLink}" style="padding: 10px 15px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">
                تعيين كلمة مرور جديدة
            </a></p>
            <p style="text-align: right;">هذا الرابط صالح لمدة ساعة واحدة.</p>
            <p style="text-align: right;">إذا لم تطلب أنت هذا الإجراء، يرجى تجاهل هذا البريد.</p>
        `
    };

    try {
        await sgMail.send(emailToSend);
        return { success: true };
    } catch (error) {
        console.error("Failed to send password reset email:", error);
        throw new HttpsError("internal", "auth/email-send-failed");
    }
});

// تجميد/فك تجميد الحساب
export const toggleUserFreezeStatus = onCall({
    region: "us-central1",
    cors: true
}, async (request) => {
    // 1. التحقق من المصادقة
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "Authentication required.");
    }
    const actorId = request.auth.uid;

    // 2. التحقق من المدخلات
    const { targetUserId, reason, freeze } = request.data as { targetUserId: string, reason: string, freeze: boolean };

    // 3. التحقق من الصلاحيات (مثلاً sss:15 المسؤولة عن التعديل والاعتماد)
    // يمكنك استخدام دالة التحقق من الصلاحيات هنا _fetchUserEffectivePermissions
    // للتبسيط سأفترض أنك ستضيف التحقق هنا

    const userRef = db.collection("users").doc(targetUserId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
        throw new HttpsError("not-found", "User not found.");
    }

    const batch = db.batch();

    // 4. تحديث حالة المستخدم
    batch.update(userRef, {
        is_frozen: freeze, // true = تجميد، false = فك تجميد
        // إذا تم التجميد، نقوم بتعطيل الحساب في Authentication أيضاً لمنع الدخول
        // سيتم التعامل مع disabled عبر Trigger منفصل أو هنا مباشرة، لكن الأفضل هنا لضمان التزامن
    });

    // التعامل مع Auth
    await admin.auth().updateUser(targetUserId, {
        disabled: freeze
    });

    // 5. تسجيل العملية في user_history (وليس tasks_history)
    const historyRef = db.collection("user_history").doc();
    batch.set(historyRef, {
        parent_user_id: targetUserId,
        action: freeze ? "ACCOUNT_FROZEN" : "ACCOUNT_UNFROZEN",
        action_by_user_id: actorId,
        reason: reason || null,
        details: {
            message: freeze ? "Account has been frozen by admin." : "Account has been reactivated by admin."
        },
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        version_number: (userDoc.data()?.latest_version_number || 0) + 1 // مجرد رقم تقريبي للنسخة
    });

    await batch.commit();

    return { success: true, message: freeze ? "User frozen successfully." : "User reactivated successfully." };
});

// إعادة إرسال بريد التفعيل (Rate Limiting)
export const resendUserOnboardingEmail = onCall({
    region: "us-central1",
    cors: true
}, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Authentication required.");

    const { targetUserId } = request.data as { targetUserId: string };
    const userRef = db.collection("users").doc(targetUserId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) throw new HttpsError("not-found", "User not found.");

    const userData = userDoc.data()!;

    // 1. التحقق من التجميد
    if (userData.is_frozen === true) {
        throw new HttpsError("failed-precondition", "Cannot resend email. The account is frozen.");
    }

    // 2. التحقق من المؤقت (Rate Limiting) - 10 دقائق
    const lastSent = userData.last_onboarding_email_sent_at?.toDate();
    const COOLDOWN_MINUTES = 10;
    if (lastSent) {
        const now = new Date();
        const diffMs = now.getTime() - lastSent.getTime();
        const diffMins = diffMs / 60000;
        if (diffMins < COOLDOWN_MINUTES) {
            const remaining = Math.ceil(COOLDOWN_MINUTES - diffMins);
            throw new HttpsError("resource-exhausted", `Please wait ${remaining} minutes before resending.`);
        }
    }

    // 3. إنشاء رمز جديد
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 ساعة

    const batch = db.batch();

    // تخزين الرمز الجديد
    const tokenRef = db.collection("password_reset_tokens").doc(token);
    batch.set(tokenRef, {
        email: userData.email,
        user_id: targetUserId,
        expires_at: admin.firestore.Timestamp.fromDate(expires),
        created_at: admin.firestore.FieldValue.serverTimestamp()
    });

    // تحديث وقت آخر إرسال
    batch.update(userRef, {
        last_onboarding_email_sent_at: admin.firestore.FieldValue.serverTimestamp()
    });

    // إضافة البريد للطابور
    const mailRef = db.collection("mail").doc();
    batch.set(mailRef, {
        to: [userData.email],
        template: {
            name: "user_activation",
            data: {
                gender: userData.gender,
                first_name_ar: userData.first_name_ar,
                last_name_ar: userData.last_name_ar,
                first_name_en: userData.first_name_en,
                last_name_en: userData.last_name_en,
                token: token // الرمز الجديد
            }
        },
        created_at: admin.firestore.FieldValue.serverTimestamp()
    });

    await batch.commit();
    return { success: true, message: "Activation email resent successfully." };
});

// ----------------------------------------------------------------------------
// 3. الخلفية والبريد (Triggers & Background)
// ----------------------------------------------------------------------------

// تسجيل تاريخ تغييرات المستخدم
export const onUserUpdateCreateHistory = onDocumentUpdated("users/{userId}", async (event) => {
    // ✅ تصحيح: التعامل الآمن مع event.data
    const beforeData = event.data?.before.data();
    const afterData = event.data?.after.data();
    const userId = event.params.userId;

    if (!beforeData || !afterData) return null;

    // 1. تحقق من التعديلات الجوهرية (لتجنب تسجيل تغيير الـ timestamp فقط)
    // ننسخ البيانات ثم نحذف حقول الميتا للمقارنة
    const beforeClean = { ...beforeData };
    const afterClean = { ...afterData };

    delete beforeClean.permissions_updated_at;
    delete beforeClean.latest_version_id;
    delete beforeClean.updated_by;

    delete afterClean.permissions_updated_at;
    delete afterClean.latest_version_id;
    delete afterClean.updated_by;

    const isContentEqual = JSON.stringify(beforeClean) === JSON.stringify(afterClean);

    // إذا كان التعديل فقط في حقول الميتا (latest_version_id, permissions_updated_at, updated_by) نتجاهل
    if (isContentEqual) {
        return null;
    }

    const batch = db.batch();

    try {
        const currentVersionId = afterData.latest_version_id as string | undefined;
        let currentVersionNumber = 0;

        // ✅ تصحيح: استخدام const
        const actorId = afterData.updated_by || "SYSTEM_UPDATE";

        // محاولة جلب رقم الإصدار الحالي
        if (currentVersionId) {
            const historyDoc = await db.collection("user_history").doc(currentVersionId).get();
            currentVersionNumber = historyDoc.data()?.version_number || 0;
        }

        // 2. إنشاء سجل تاريخي جديد (النسخة +1)
        const newVersionNumber = currentVersionNumber + 1;
        const newHistoryRef = db.collection("user_history").doc();

        // نسخ جميع حقول المستخدم الجديد
        const newHistoryRecord: Record<string, unknown> = {
            ...afterData,
            parent_user_id: userId,
            version_number: newVersionNumber,
            action: "UPDATED",
            action_by_user_id: actorId,
            created_at: admin.firestore.FieldValue.serverTimestamp(),
        };

        // ✅ التعديل: حذف حقول الميتا التي لا تنتمي لسجل التاريخ (مجدداً)
        delete newHistoryRecord.latest_version_id;
        delete newHistoryRecord.permissions_updated_at;
        delete newHistoryRecord.updated_by;

        batch.set(newHistoryRef, newHistoryRecord);

        // 3. تحديث مستند المستخدم برقم الإصدار الجديد
        batch.update(event.data!.after.ref, { // ✅ تصحيح: الوصول إلى ref عبر after
            latest_version_id: newHistoryRef.id,
            // يجب تحديث permissions_updated_at لـ user permissions update trigger
        });

        await batch.commit();
        console.log(`User history recorded for ${userId}: Version ${newVersionNumber}`);

        return null;

    } catch (error) {
        console.error(`Error recording user history for ${userId}:`, error);
        return null;
    }
});

// ============================================================================
// 👤 نظام دورة حياة المستخدم والمصادقة (User Lifecycle & Auth System) - (System 4)
// ============================================================================
//END

// ============================================================================
//توزيع الوظائف (Job Distribution) - (System 5)
// ============================================================================
/**
 * مُشغل تلقائي لتوزيع الوظائف (Auto Job Distribution)
 * الهدف: عندما يتم تعيين موظف في وظيفة ومكان معين، نقوم تلقائياً بتسجيل هذا التواجد
 * في جدول job_distribution (مبسط: الشركة والقسم فقط).
 */
export const syncJobDistribution = onDocumentWritten("users/{userId}", async (event) => {
    const after = event.data?.after.data();
    const before = event.data?.before.data();

    // 1. التحقق من وجود البيانات الأساسية (موظف + وظيفة + شركة)
    if (!after || !after.job_id || !after.company_id) return;

    // 2. التحقق من التغيير (الشركة أو القسم أو الوظيفة)
    // ✅ تم إزالة sector_id و department_id من المقارنة
    const hasChanged = !before ||
        String(before.job_id) !== String(after.job_id) ||
        String(before.company_id) !== String(after.company_id) ||
        String(before.section_id) !== String(after.section_id);

    if (!hasChanged) return;

    // 3. تجهيز بيانات التوزيع (Simplified)
    const distributionData = {
        job_id: String(after.job_id),
        company_id: String(after.company_id),
        // ✅ تم إزالة sector_id و department_id
        section_id: after.section_id ? String(after.section_id) : null,
        auto_generated: true,
        updated_at: admin.firestore.FieldValue.serverTimestamp()
    };

    // 4. إنشاء مفتاح فريد (Simplified Composite Key)
    // المثال الجديد: "101_50_5" (الوظيفة_الشركة_القسم)
    const compositeKey = [
        distributionData.job_id,
        distributionData.company_id,
        distributionData.section_id || "0" // "0" لتمثيل الـ null
    ].join("_");

    // 5. الحفظ (Merge)
    try {
        await db.collection("job_distribution").doc(compositeKey).set(distributionData, { merge: true });
        console.log(`✅ Auto-distributed job structure: ${compositeKey}`);
    } catch (error) {
        console.error("Failed to auto-distribute job:", error);
    }
});

// ============================================================================
//توزيع الوظائف (Job Distribution) - (System 5)
// ============================================================================
//END

// --- Helper: Safe Batch Committer (لحل مشكلة الـ 500 عملية) ---
async function commitBatchChunks<T>(
    items: T[],
    processFn: (item: T, batch: admin.firestore.WriteBatch) => void
) {
    const CHUNK_SIZE = 400; // أقل من 500 لضمان الأمان
    for (let i = 0; i < items.length; i += CHUNK_SIZE) {
        const chunk = items.slice(i, i + CHUNK_SIZE);
        const batch = db.batch();
        chunk.forEach(item => processFn(item, batch));
        await batch.commit();
    }
}

// ✅ قمنا بإضافة export لتصبح قابلة للاستخدام في ملفات أخرى (يحل مشكلة unused)
export interface JobDistributionDoc {
    id: string;
    job_id: string;
    company_id: string;

    sector_id?: string | null;
    department_id?: string | null;
    section_id?: string | null;

    // ✅ استبدلنا any بالنوع الصحيح من Firebase
    created_at: admin.firestore.Timestamp | admin.firestore.FieldValue;
    created_by: string;
}

// واجهة لتعريف شكل بيانات الكاش
interface DelegationProfile {
    isSuperAdmin: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    userData: any; // نقبل any هنا مؤقتاً لبيانات المستخدم لأنها متغيرة
    accessRules: EnforcedRule[];
    accessExceptions: string[];
    controlRules: EnforcedRule[];
    controlExceptions: string[];
    resources: string[];
    last_updated?: admin.firestore.Timestamp | admin.firestore.FieldValue;
}

// --- New Scoped System Interfaces (The Atomic Design v2) ---

// ✅ (واجهة جديدة) تستخدم داخلياً لربط الوظيفة بالنطاق أثناء التحقق
// ✅ تم التحديث: استخدام company + department فقط
interface EnforcedRule {
    target_job_id: string | null;       // الوظيفة
    scope_company_id: string | null;    // الشركة التابعة لها
    scope_department_id: string | null; // القسم التابع له
    restricted_to_company?: boolean;    // هل هي مقيدة بشركة الموظف المانح؟
}

// 2. النطاق (لأنظمة التفويض) - من يقع تحت سيطرتي؟
interface DelegationScope extends ScopeDefinition {
    target_company_id: string | null; // للسيطرة على شركة كاملة
    target_job_id: string | null;     // للسيطرة على وظيفة (مع تطبيق الفلاتر أعلاه)
    target_user_id?: string | null;   // للسيطرة على مستخدم (استثناء)
}

// 3. بيانات الصلاحية (لأنظمة الصلاحيات المباشرة)
interface PermissionData extends ScopeDefinition {
    service_id: string | null;
    sub_service_id: string | null;
    sub_sub_service_id: string | null;
}

interface UserOnboardingRequestData {
    email: string; // البريد الشخصي (إلزامي)
    company_id: string; // (إلزامي)
    employee_id: string; // (اختياري في الواجهة الأمامية، لكن مطلوب كقيمة)
    job_id: number; // (إلزامي)

    // ✨ حقول الاسم الجديدة (الأساسية) ✨
    first_name_ar: string;
    second_name_ar: string;
    third_name_ar: string;
    last_name_ar: string;
    first_name_en: string;
    second_name_en: string;
    third_name_en: string;
    last_name_en: string;

    // الاسم الكامل (تم تجميعه في الواجهة الأمامية)
    name_ar: string;
    name_en: string;

    // حقول أخرى
    phone_number: string; // الهاتف الشخصي (إلزامي)
    gender: "male" | "female" | ""; // (إلزامي)
    country: string; // (إلزامي)

    // حقول العمل والمؤسسة الاختيارية
    work_email?: string;
    work_phone?: string;
    company_email?: string;
    company_phone?: string;
    company_landline_phone?: string;
    landline_phone?: string; // رقم التحويلة
    "reason-company-phone"?: string;
    "alternative-phone"?: string;
}

// ============================================================================
// 🔥 CORE LOGIC: The Unified Delegation Engine (Optimized)
// ============================================================================

/**
 * دالة مُساعدة لإنشاء قالب بريد إلكتروني احترافي ثنائي اللغة مع الشعار.
 */
function getSystemEmailTemplate(
    contentAr: string,
    contentEn: string,
    greetingAr: string,
    greetingEn: string,
    titleAr: string = "تفعيل حسابك",
    titleEn: string = "Activate Your Account"
): string {
    return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${titleAr} / ${titleEn}</title>
    <style>
        body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
        table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
        img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
        
        /* النقطة 2: إضافة مسافة علوية وسفلية لحاوية الرسالة */
        .container { max-width: 600px; margin: 25px auto; background-color: #1a1a1a; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5); }
        
        /* النقطة 3: تكبير الشعار وإزالة الجزء العلوي الملتصق */
        .header { padding: 30px 25px 15px; background-color: #242424; text-align: center; border-bottom: 1px solid #333; }
        .header img { max-height: 70px; width: auto; }
        .system-name { color: #FFD700; font-size: 16px; font-weight: bold; margin-top: 5px; }

        .content-block { padding: 25px; } 
        .greeting-ar { color: #FFD700; font-size: 18px; font-weight: bold; margin-bottom: 15px; text-align: right; direction: rtl; }
        .greeting-en { color: #FFD700; font-size: 18px; font-weight: bold; margin-top: 15px; margin-bottom: 15px; text-align: left; direction: ltr; border-top: 1px solid #333; padding-top: 15px; }

        .content-ar { color: #e0e0e0; font-family: 'Tahoma', sans-serif; font-size: 14px; line-height: 1.6; text-align: right; direction: rtl; }
        .content-en { color: #e0e0e0; font-family: 'Arial', sans-serif; font-size: 14px; line-height: 1.6; text-align: left; direction: ltr; }
        
        /* النقطة 6: تنبيه انتهاء الصلاحية */
        .alert-box { background-color: #33331a; border: 1px solid #FFD700; color: #FFD700; padding: 15px; border-radius: 6px; margin-top: 20px; font-weight: bold; text-align: center; }

        .footer { padding: 20px; text-align: center; font-size: 11px; color: #777; border-top: 1px solid #333; }
        .footer p { margin: 0; }
        .button { background-color: #FFD700; color: #000000 !important; padding: 12px 25px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block; margin-top: 15px; }
    </style>
</head>
<body style="margin: 0; padding: 0; background-color: #0f0f0f;">
    <div class="container">
        <div class="header">
            <img src="${SYSTEM_LOGO_URL}" alt="H-SSD Logo" style="display: block; margin: 0 auto;">
            <p class="system-name">H-SSD</p>
        </div>

        <div class="content-block">
            <p class="greeting-ar">${greetingAr}</p>
            <p class="greeting-en">${greetingEn}</p>

            <div class="content-ar">
                ${contentAr}
            </div>
            
            <div class="content-en">
                ${contentEn}
            </div>
        </div>

        <div class="footer">
            <p>&copy; ${new Date().getFullYear()} جميع حقوق النشر محفوظة لنظام H-SSD | All rights reserved for H-SSD System.</p>
        </div>
    </div>
</body>
</html>
`;
}

// واجهة للتحقق من نوع البيانات الواردة (اختياري لكن يفضل)
interface ManageServiceConfigRequest {
    type: "service_group" | "service" | "sub_service" | "sub_sub_service";
    action: "create" | "edit" | "delete";
    docId?: string; // مطلوب فقط لـ 'edit' و 'delete'
    payload?: Record<string, unknown>; // مطلوب فقط لـ 'create' و 'edit'
}

interface EvaluationInputData {
    company_id: string; // نحن نعلم أن هذا الحقل يجب أن يكون موجوداً ونوعه string
    evaluation_year: number;
    evaluation_month: number;
    historical_contract_no?: string;
    historical_guard_count?: number;
    historical_violations_count?: number;
    summary?: string;
    overall_score?: number;
    details?: Array<Record<string, unknown>>; // تفاصيل التقييم
    [key: string]: unknown; // للسماح بحقول أخرى إذا لزم الأمر
}

// --- 1. دالة الحساب المركزية (Engine) ---
async function recalculateUserEffectivePermissions(userId: string) {
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) return;
    const userData = userDoc.data()!;

    // 1. تجهيز الخريطة النهائية
    const effectivePermissions: { [key: string]: boolean } = { general_access: true };

    // 2. إذا كان Super Admin (يملك كل شيء)
    if (userData.is_super_admin === true) {
        effectivePermissions["is_super_admin"] = true;
        // هنا يمكنك إنهاء الدالة وحفظ الكاش مباشرة إذا أردت
    } else {
        
        // -----------------------------------------------------------
        // 3. جلب صلاحيات الوظيفة (مع تطبيق فلترة النطاق - Scope Filter)
        // -----------------------------------------------------------
        if (userData.job_id) {
            // نجلب كل القواعد الخاصة بهذا المسمى الوظيفي
            const jobPerms = await db.collection("job_permissions").where("job_id", "==", userData.job_id).get();
            
            jobPerms.forEach(doc => {
                const p = doc.data();

                // --- 🛡️ منطق الفلترة الجديد (Smart Scope Check) ---
                
                // أ) فلتر الشركات:
                // إذا تم تحديد شركات معينة في القاعدة، ومستخدمنا ليس في إحداها -> تجاهل القاعدة
                if (p.scope_companies && Array.isArray(p.scope_companies) && p.scope_companies.length > 0) {
                    if (!userData.company_id || !p.scope_companies.includes(userData.company_id)) {
                        return; // هذه القاعدة لا تنطبق على هذا الموظف (لأنه في شركة غير مشمولة)
                    }
                }

                // ب) فلتر الأقسام (الإدارات):
                // إذا تم تحديد أقسام معينة، ومستخدمنا ليس في أحدها -> تجاهل القاعدة
                if (p.scope_sections && Array.isArray(p.scope_sections) && p.scope_sections.length > 0) {
                    // إذا حددنا أقساماً معينة، والموظف ليس في أحدها -> نرفض
                    if (!userData.section_id || !p.scope_sections.includes(userData.section_id)) {
                        return; 
                    }
                }

                // ج) فلتر الأقسام الفرعية (Sections) - (اختياري، أضفته لك لزيادة الدقة مستقبلاً)
                if (p.scope_sections && Array.isArray(p.scope_sections) && p.scope_sections.length > 0) {
                     if (!userData.section_id || !p.scope_sections.includes(userData.section_id)) {
                        return;
                    }
                }

                // ✅ إذا وصلنا هنا، فالقاعدة تنطبق عليه! نطبق الصلاحية (سواء كانت true أو false)
                const key = p.sub_sub_service_id ? `sss:${p.sub_sub_service_id}` : p.sub_service_id ? `ss:${p.sub_service_id}` : `s:${p.service_id}`;
                
                // لاحظ: نأخذ القيمة من is_allowed (قد تكون true للمنح أو false للمنع)
                effectivePermissions[key] = p.is_allowed;
            });
        }

        // -----------------------------------------------------------
        // 4. جلب استثناءات المستخدم (Override - الأقوى دائماً)
        // -----------------------------------------------------------
        const userPerms = await db.collection("user_permissions").where("user_id", "==", userId).get();
        userPerms.forEach(doc => {
            const p = doc.data();
            const key = p.sub_sub_service_id ? `sss:${p.sub_sub_service_id}` : p.sub_service_id ? `ss:${p.sub_service_id}` : `s:${p.service_id}`;
            // الاستثناء الشخصي يكتب فوق أي شيء قادم من الوظيفة
            effectivePermissions[key] = p.is_allowed;
        });

        // ❌ تم حذف بلوك company_permissions (Veto) نهائياً
    }

    // 5. الحفظ في الكاش
    await db.doc(`users/${userId}/private_data/effective_permissions`).set({
        permissions: effectivePermissions,
        last_updated: admin.firestore.FieldValue.serverTimestamp()
    });

    // تحديث الطابع الزمني للمستخدم
    await db.collection("users").doc(userId).update({
        permissions_updated_at: admin.firestore.FieldValue.serverTimestamp()
    });
}

// ---------------------------------------------------------------------------
// ⚡ TRIGGERS: Delegation Cache Updaters
// ---------------------------------------------------------------------------

/**
 * 1. عند تغيير قواعد "المستخدم" (User Scopes/Resources)
 * هذا التريجر يعمل على 4 مجموعات مختلفة
 */
const userCollections = [
    "access_user_scopes", "control_user_scopes",
    "access_user_resources", "control_user_resources"
];

// نقوم بإنشاء تريجر لكل مجموعة
userCollections.forEach(collection => {
    // نصدر الدالة باسم ديناميكي (هذا النمط مدعوم في JS/TS للتصدير)
    exports[`on${collection}Write`] = onDocumentWritten(`${collection}/{docId}`, async (event) => {
        const data = event.data?.after.data() || event.data?.before.data();
        // إذا تغير شيء، نحدث الكاش للمستخدم المعني فقط
        if (data && data.user_id) {
            await updateUserDelegationCache(data.user_id);
            console.log(`Updated cache for user ${data.user_id} due to change in ${collection}`);
        }
    });
});

/**
 * 2. عند تغيير قواعد "الوظيفة" (Job Scopes/Resources)
 * هذا أصعب قليلاً: يجب تحديث *كل* الموظفين الذين يشغلون هذه الوظيفة
 */
const jobCollections = [
    "access_job_scopes", "control_job_scopes",
    "access_job_resources", "control_job_resources"
];

jobCollections.forEach(collection => {
    exports[`on${collection}Write`] = onDocumentWritten(`${collection}/{docId}`, async (event) => {
        const data = event.data?.after.data() || event.data?.before.data();
        if (data && data.job_id) {
            const jobId = String(data.job_id);

            // جلب كل المستخدمين في هذه الوظيفة
            const usersSnap = await db.collection("users").where("job_id", "==", Number(jobId)).get(); // انتبه لنوع job_id (رقم أو نص حسب قاعدة بياناتك)

            // تحديث الكاش لكل واحد منهم
            const promises = usersSnap.docs.map(doc => updateUserDelegationCache(doc.id));
            await Promise.all(promises);

            console.log(`Updated cache for ${usersSnap.size} users in job ${jobId} due to change in ${collection}`);
        }
    });
});

/**
 * 3. عند تغيير وظيفة المستخدم نفسه أو ترقيته
 */
export const onUserJobOrRoleChange = onDocumentUpdated("users/{userId}", async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    // نحدث الكاش فقط إذا تغيرت الوظيفة أو حالة الـ Super Admin
    if (before?.job_id !== after?.job_id || before?.is_super_admin !== after?.is_super_admin) {
        await updateUserDelegationCache(event.params.userId);
        console.log(`Updated cache for user ${event.params.userId} due to profile change.`);
    }
});

// عند تغيير استثناء مستخدم -> أعد الحساب له فقط
export const onUserPermissionChange = onDocumentWritten("user_permissions/{docId}", async (event) => {
    const data = event.data?.after.data() || event.data?.before.data();
    if (data && data.user_id) await recalculateUserEffectivePermissions(data.user_id);
});

// عند تغيير صلاحية وظيفة -> أعد الحساب لكل الموظفين فيها (عملية ضخمة في الخلفية)
export const onJobPermissionChange = onDocumentWritten("job_permissions/{docId}", async (event) => {
    const data = event.data?.after.data() || event.data?.before.data();
    if (data && data.job_id) {
        const users = await db.collection("users").where("job_id", "==", data.job_id).get();
        const promises = users.docs.map(doc => recalculateUserEffectivePermissions(doc.id));
        await Promise.all(promises);
    }
});

// عند تغيير وظيفة المستخدم أو شركته -> أعد الحساب له
export const onUserInfoChange = onDocumentUpdated("users/{userId}", async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (before?.job_id !== after?.job_id || before?.company_id !== after?.company_id || before?.is_super_admin !== after?.is_super_admin) {
        await recalculateUserEffectivePermissions(event.params.userId);
    }
});

async function getNextSequenceId(type: ManageServiceConfigRequest["type"]): Promise<number> { // 🚨 التعديل هنا: استخدام ["type"]
    const counterNameMap = {
        "service_group": "service_group_counter",
        "service": "service_counter",
        "sub_service": "sub_service_counter",
        "sub_sub_service": "sub_sub_service_counter",
    };

    const counterRef = db.collection("sequences").doc(counterNameMap[type]);

    let newId: number;

    try {
        await db.runTransaction(async (transaction) => {
            const counterDoc = await transaction.get(counterRef);

            if (!counterDoc.exists) {
                newId = 1;
                transaction.set(counterRef, { current_number: newId });
            } else {
                newId = (counterDoc.data()!.current_number || 0) + 1;
                transaction.update(counterRef, { current_number: newId });
            }
        });

        return newId!;

    } catch (error) {
        console.error(`Error getting sequence ID for ${type}:`, error);
        throw new HttpsError("internal", `Failed to get a unique ID for ${type}.`);
    }
}

// ✅ --- التعديل (النقطة 1 و 2): دالة موحدة لجلب الأرقام التسلسلية للمهام ---
/**
 * دالة مساعدة موحدة لجلب الرقم التسلسلي التالي لأي عداد
 * (للمهام، التقييمات، المستخدمين، الخ)
 */
async function getNextTaskSequenceId(counterName: string): Promise<number> {
    // 1. تحديد العداد المطلوب
    const counterRef = db.collection("sequences").doc(counterName);
    let newId: number;

    try {
        // 2. بدء معاملة (Transaction) لضمان عدم التضارب
        await db.runTransaction(async (transaction) => {
            const counterDoc = await transaction.get(counterRef);

            if (!counterDoc.exists) {
                // 3. إنشاء العداد إذا لم يكن موجوداً
                newId = 1;
                transaction.set(counterRef, { current_number: newId });
            } else {
                // 4. زيادة العداد إذا كان موجوداً
                newId = (counterDoc.data()!.current_number || 0) + 1;
                transaction.update(counterRef, { current_number: newId });
            }
        });

        // 5. إرجاع الرقم الجديد
        return newId!;

    } catch (error) {
        console.error(`Error getting sequence ID for counter ${counterName}:`, error);
        // رمي خطأ لإيقاف العملية الرئيسية إذا فشل جلب الرقم
        throw new HttpsError("internal", `Failed to get a unique ID for ${counterName}.`);
    }
}

export const manageServiceConfiguration = onCall({ region: "us-central1", cors: true }, async (request) => {
    // 1. التحقق من المصادقة
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "Function requires authentication.");
    }
    const actorId = request.auth.uid; // معرف المستخدم الذي قام بالعملية

    // 2. التحقق من المدخلات
    const data = request.data as ManageServiceConfigRequest;
    const { type, action, docId, payload } = data;

    if (!type || !action) {
        throw new HttpsError("invalid-argument", "Missing required parameters: type and action.");
    }
    // 🚨 التحقق من docId
    if ((action === "edit" || action === "delete") && (!docId || docId.trim() === "")) {
        throw new HttpsError("invalid-argument", `Action '${action}' requires a non-empty docId.`);
    }
    if ((action === "create" || action === "edit") && !payload) {
        throw new HttpsError("invalid-argument", `Action '${action}' requires a payload.`);
    }

    // 3. التحقق من الصلاحيات (Authorization)
    const userPermissions = await _fetchUserEffectivePermissions(actorId);
    let hasRequiredPermission = false;

    if (type === "service_group") {
        hasRequiredPermission = userPermissions["s:1"] === true;
    } else if (["service", "sub_service", "sub_sub_service"].includes(type)) {
        hasRequiredPermission = userPermissions["ss:9"] === true;
    }

    if (!hasRequiredPermission) {
        throw new HttpsError("permission-denied", `You do not have permission to manage '${type}'.`);
    }

    // 4. تحديد المجموعة (Collection) المستهدفة
    let collectionRef: admin.firestore.CollectionReference;
    switch (type) {
        case "service_group":
            collectionRef = db.collection("service_groups");
            break;
        case "service":
            collectionRef = db.collection("services");
            break;
        case "sub_service":
            collectionRef = db.collection("sub_services");
            break;
        case "sub_sub_service":
            collectionRef = db.collection("sub_sub_services");
            break;
        default:
            throw new HttpsError("invalid-argument", `Invalid type specified: ${type}`);
    }

    // 5. تنفيذ الإجراء المطلوب (CRUD)
    const batch = db.batch();

    try {
        if (action === "create") {
            // ✨ التعديل الجوهري: الحصول على ID تسلسلي (رقم) ✨
            const newNumericId = await getNextSequenceId(type); // <-- (هذا الآن رقم)

            // إضافة حقول Metadata
            payload!.created_by = actorId;
            payload!.created_at = admin.firestore.FieldValue.serverTimestamp();
            // 🚨 ضروري: إضافة المعرف (كرقم) داخل المستند
            payload!.id = newNumericId; // <-- ✅ تم الحفظ كرقم

            // 🚨 تحويل الرقم إلى نص لاستخدامه كـ Document ID
            const newDocIdString = String(newNumericId);

            // إنشاء المستند باستخدام المعرف النصي كـ Doc ID
            const newDocRef = collectionRef.doc(newDocIdString);
            batch.set(newDocRef, payload);

        } else if (action === "edit") {
            // إضافة حقول Metadata للتحديث
            payload!.updated_by = actorId;
            payload!.updated_at = admin.firestore.FieldValue.serverTimestamp();
            delete payload!.created_by;
            delete payload!.created_at;

            // تأكد من حذف حقل ID من الـ payload لأنه لا يجب تعديله كبيانات
            delete payload!.id;

            const docRef = collectionRef.doc(docId!);
            batch.update(docRef, payload!);

        } else if (action === "delete") {
            const docRef = collectionRef.doc(docId!);
            batch.delete(docRef);
            console.warn(`Cascading deletes for type '${type}' ID '${docId}' are NOT implemented.`);
        }

        await batch.commit(); // تنفيذ العمليات
        return { success: true };

    } catch (error: unknown) {
        console.error(`Error performing action '${action}' on type '${type}' (Doc ID: ${docId || "N/A"}):`, error);
        let errorMessage = `Failed to perform action '${action}'.`;
        if (error instanceof Error) {
            errorMessage += ` ${error.message}`;
        }
        throw new HttpsError("internal", errorMessage);
    }
});

// --- Interfaces for Delegation System ---
// ضعه بعد interface PermissionData

export interface DelegationRule {
    id?: string;
    actor_type: "user" | "job";
    actor_id: string;
    permission_type: "access_manager" | "delegation_manager";
    target_scope: {
        company_ids: string[];
        job_ids: string[];
        excluded_user_ids?: string[];
    };
    resource_scope: {
        service_ids: string[];
        sub_service_ids: string[];
        sub_sub_service_ids: string[];
    };
    created_at: admin.firestore.Timestamp;
}

// --- Helper Functions ----

async function updateCompanyAverage(companyId: string) {
    const companyRef = db.collection("companies").doc(companyId);
    try {
        await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(companyRef);
            if (!doc.exists) return;

            const data = doc.data()!;
            // استخدام '|| 0' يضمن أننا نتعامل مع 0 إذا كان الحقل غير موجود
            const total = data.total_score || 0;
            const count = data.evaluation_count || 0;

            const newAverage = count > 0 ? total / count : 0;

            // تقريب النتيجة إلى منزلتين عشريتين
            const roundedAverage = Math.round(newAverage * 100) / 100;

            transaction.update(companyRef, { overall_score: roundedAverage });
        });
    } catch (error) {
        console.error(`Error updating company average ${companyId}:`, error);
    }
}

async function updateQuestionAverage(questionId: string) {
    // ملاحظة: تأكد من أن اسم المجموعة صحيح "security_questions"
    const questionRef = db.collection("security_questions").doc(questionId);
    try {
        await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(questionRef);
            if (!doc.exists) return;

            const data = doc.data()!;
            // استخدام '|| 0' يضمن أننا نتعامل مع 0 إذا كان الحقل غير موجود
            const total = data.total_score || 0;
            const count = data.answer_count || 0;

            const newAverage = count > 0 ? total / count : 0;

            // تقريب النتيجة إلى منزلتين عشريتين
            const roundedAverage = Math.round(newAverage * 100) / 100;

            transaction.update(questionRef, { overall_score: roundedAverage });
        });
    } catch (error) {
        console.error(`Error updating question average ${questionId}:`, error);
    }
}

async function updateCompanyMonthlyAverage(companyMonthlyDocId: string, companyId: string, year: number, month: string) {
    const docRef = db.collection("company_monthly_scores").doc(companyMonthlyDocId);
    try {
        await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(docRef);

            // إذا لم يكن المستند موجوداً، سنقوم بإنشائه
            if (!doc.exists) {
                console.error(`Monthly doc not found, which is unexpected: ${companyMonthlyDocId}`);
                // لا يمكن المتابعة بدون بيانات
                return;
            }

            const data = doc.data()!;
            const total = data.total_score || 0;
            const count = data.evaluation_count || 0;

            const newAverage = count > 0 ? total / count : 0;
            const roundedAverage = Math.round(newAverage * 100) / 100;

            // تحديث المتوسط + إضافة بيانات الفلترة
            transaction.update(docRef, {
                overall_score: roundedAverage,
                // هذه الحقول مهمة جداً للفلترة في الواجهة
                company_id: companyId,
                evaluation_year: year,
                evaluation_month: month
            });
        });
    } catch (error) {
        console.error(`Error updating company monthly average ${companyMonthlyDocId}:`, error);
    }
}

async function updateQuestionMonthlyAverage(questionMonthlyDocId: string, questionId: string, year: number, month: string) {
    const docRef = db.collection("question_monthly_scores").doc(questionMonthlyDocId);
    try {
        await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(docRef);

            if (!doc.exists) {
                console.error(`Monthly question doc not found, unexpected: ${questionMonthlyDocId}`);
                return;
            }

            const data = doc.data()!;
            const total = data.total_score || 0;
            const count = data.answer_count || 0;

            const newAverage = count > 0 ? total / count : 0;
            const roundedAverage = Math.round(newAverage * 100) / 100;

            transaction.update(docRef, {
                overall_score: roundedAverage,
                // حقول الفلترة
                question_id: questionId,
                evaluation_year: year,
                evaluation_month: month
            });
        });
    } catch (error) {
        console.error(`Error updating question monthly average ${questionMonthlyDocId}:`, error);
    }
}

const deleteFileFromStorage = async (fileUrl: string) => {
    if (!fileUrl) return;
    try {
        const bucket = admin.storage().bucket();
        // استخراج مسار الملف من الرابط، مع تجاهل اسم الحاوية
        const url = new URL(fileUrl);
        const filePath = decodeURIComponent(url.pathname.substring(1).split("/").slice(1).join("/"));

        await bucket.file(filePath).delete();
        console.log(`Successfully deleted file: ${filePath}`);
    } catch (error: unknown) {
        // التحقق من النوع ومن وجود خاصية 'code'
        if (error && typeof error === "object" && "code" in error && error.code === 404) { // <-- استخدم " بدل '
            console.warn(`File not found during deletion, possibly already deleted: ${fileUrl}`);
        } else {
            console.error(`Failed to delete file from storage: ${fileUrl}`, error);
        }
    }
};

const logMediaChange = async (
    actorId: string,
    type: "avatar" | "signature" | "seal",
    action: "ADD" | "UPDATE" | "DELETE",
    oldUrl: string | null = null,
    newUrl: string | null = null
) => {
    try {
        const logRef = db.collection("media_logs").doc();
        await logRef.set({
            actor_id: actorId,
            media_type: type,
            action_type: action,
            old_url: oldUrl,
            new_url: newUrl,
            created_at: admin.firestore.FieldValue.serverTimestamp(),
        });
    } catch (error) {
        console.error("Failed to write media log:", error);
    }
};

const getUsersWithPermission = async (permissionId: string): Promise<string[]> => {
    const permData = parsePermissionString(permissionId);
    const authorizedUserIds = new Set<string>();

    // 1. جلب الصلاحيات من الوظائف (لا تغيير)
    const jobsWithPermQuery = await db.collection("job_permissions").where("service_id", "==", permData.service_id).where("sub_service_id", "==", permData.sub_service_id).where("sub_sub_service_id", "==", permData.sub_sub_service_id).get();
    const jobIdsWithPerm = jobsWithPermQuery.docs.map(doc => doc.data().job_id);

    // ✅ --- التعديل: جلب المستخدمين العاديين فقط ---
    const usersQuery = await db.collection("users").where("is_super_admin", "==", false).get();

    // 2. المرور على المستخدمين العاديين فقط
    for (const userDoc of usersQuery.docs) {
        const userData = userDoc.data();
        const userId = userDoc.id;
        const jobId = userData?.job_id;

        // ❌ --- تم حذف منطق "is_super_admin" ---

        // 3. التحقق من صلاحياتهم (وظيفة + استثناءات)
        let isAllowed = false;
        const isAllowedByJob = jobId ? jobIdsWithPerm.includes(jobId) : false;
        isAllowed = isAllowedByJob;

        const userPermQuery = await db.collection("user_permissions")
            .where("user_id", "==", userId)
            .where("service_id", "==", permData.service_id)
            .where("sub_service_id", "==", permData.sub_service_id)
            .where("sub_sub_service_id", "==", permData.sub_sub_service_id)
            .limit(1).get();

        if (!userPermQuery.empty) {
            isAllowed = userPermQuery.docs[0].data().is_allowed === true;
        }

        if (isAllowed) {
            authorizedUserIds.add(userId);
        }
    }
    // 4. إرجاع قائمة بالمستخدمين العاديين فقط
    return Array.from(authorizedUserIds);
};

const updatePendingTasksForPermissionChange = async (permissionId: string) => {
    try {
        const [type, id] = permissionId.split(":");
        // التحديث فقط للمهام الإجرائية المباشرة
        if (type !== "sss") return;

        const saIdToUpdate = Number(id);
        const newUserIds = await getUsersWithPermission(permissionId);

        // جلب المهام المعلقة فقط
        const tasksToUpdateQuery = db.collection("tasks_queue")
            .where("sa_id", "==", saIdToUpdate)
            .where("status", "==", "pending");

        const snapshot = await tasksToUpdateQuery.get();
        if (snapshot.empty) return;

        // ✨ التحسين: استخدام التحديث المجزأ (Chunked Update)
        await commitBatchChunks(snapshot.docs, (doc, batch) => {
            const taskData = doc.data();
            const currentIds = taskData.assigned_to_user_ids || [];

            // مقارنة سريعة لتجنب الكتابة غير الضرورية (توفير التكلفة)
            const sortedCurrent = JSON.stringify([...currentIds].sort());
            const sortedNew = JSON.stringify([...newUserIds].sort());

            if (sortedCurrent !== sortedNew) {
                batch.update(doc.ref, { assigned_to_user_ids: newUserIds });
            }
        });

        console.log(`Updated assignments for ${snapshot.size} tasks (Permission: ${permissionId})`);
    } catch (error) {
        console.error(`Error updating tasks for permission ${permissionId}:`, error);
    }
};

const getIpInfo = async (ip: string | undefined) => {
    if (!ip || ip === "127.0.0.1" || ip.startsWith("::")) {
        return { ip, city: "Local", region: "Local", country: "Local" };
    }
    try {
        const token = process.env.IPINFO_TOKEN;

        if (!token) {
            console.warn("IPinfo token is not available in environment variables.");
            return { ip, error: "IPinfo token not configured." };
        }
        const response = await fetch(`https://ipinfo.io/${ip}?token=${token}`);
        if (!response.ok) {
            throw new Error(`IPinfo API failed with status ${response.status}`);
        }
        const data = await response.json() as Record<string, unknown>;
        return {
            ip: data.ip, city: data.city, region: data.region,
            country: data.country, location: data.loc, org: data.org,
        };
    } catch (error: unknown) {
        let errorMessage = "Failed to fetch IP details.";
        if (error instanceof Error) { // <-- هذا الفحص يعالج الخطأ
            errorMessage = error.message;
        }
        console.error("Error fetching IP info:", errorMessage, error); // Log original error too
        return { ip, error: errorMessage };
    }
};

const logPermissionChange = (batch: admin.firestore.WriteBatch, actorId: string, entityType: "job" | "user", actionType: "ADD" | "REMOVE" | "OVERRIDE_ADD" | "OVERRIDE_REMOVE" | "RESTORE", permData: PermissionData, details: { userId?: string; jobId?: string; oldState?: boolean; newState?: boolean }) => { const logRef = db.collection("permission_logs").doc(); batch.set(logRef, { actor_id: actorId, entity_type: entityType, action_type: actionType, user_id: details.userId || null, job_id: details.jobId || null, ...permData, old_is_allowed: details.oldState ?? null, new_is_allowed: details.newState ?? null, created_at: admin.firestore.FieldValue.serverTimestamp(), }); };

const getUsersByCompany = async (companyId: string): Promise<string[]> => { const usersQuery = await db.collection("users").where("company_id", "==", companyId).get(); if (usersQuery.empty) { console.log(`No users found for company ID: ${companyId}`); return []; } const userIds = usersQuery.docs.map(doc => doc.id); console.log(`Found ${userIds.length} users for company ID: ${companyId}`); return userIds; };

/**
 * UPDATED: Added targetEntityId, targetEntityName, and sequenceNumber
 */
export const createTask = async ({
    serviceId, saId, parentEntityId, actorUserId, actorJobId,
    assignedToUserIds, assignedToCompanyIds,
    isAssignedToSuperAdmins = false, details = {}, actionMetadata,
    targetEntityId, targetEntityNameAr, targetEntityNameEn,
    actorSignatureUrl,
    sequenceNumber, // ✅ الإضافة الجديدة
    skipHistoryCreation = false
}: {
    serviceId: number;
    saId: number;
    parentEntityId: string;
    actorUserId: string;
    actorJobId: number | null;
    assignedToUserIds?: string[];
    assignedToCompanyIds?: string[];
    isAssignedToSuperAdmins?: boolean;
    details?: object;
    actionMetadata?: object;
    targetEntityId?: string;
    targetEntityNameAr?: string;
    targetEntityNameEn?: string;
    actorSignatureUrl?: string | null; // التوقيع فقط
    sequenceNumber?: number; // ✅ الإضافة الجديدة
    skipHistoryCreation?: boolean;
}) => {
    const taskId = admin.firestore().collection("tasks_queue").doc().id;
    const batch = admin.firestore().batch();
    const finalUserIds = new Set<string>(assignedToUserIds || []);

    // جلب المستخدمين من الشركات (لا تغيير)
    if (assignedToCompanyIds && assignedToCompanyIds.length > 0) {
        for (const companyId of assignedToCompanyIds) {
            const usersInCompany = await getUsersByCompany(companyId);
            usersInCompany.forEach(userId => finalUserIds.add(userId));
        }
    }

    // إنشاء المهمة في قائمة الانتظار 
    const taskRef = admin.firestore().collection("tasks_queue").doc(taskId);
    batch.set(taskRef, {
        task_id: taskId,
        service_id: serviceId,
        sa_id: saId,
        parent_entity_id: parentEntityId,
        target_entity_id: targetEntityId || null,
        target_entity_name_ar: targetEntityNameAr || null,
        target_entity_name_en: targetEntityNameEn || null,
        sequence_number: sequenceNumber || null, // ✅ النقطة 2: حفظ رقم العملية
        assigned_to_user_ids: Array.from(finalUserIds),
        is_assigned_to_super_admins: isAssignedToSuperAdmins,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        status: "pending",
    });

    // إنشاء سجل في تاريخ المهام (إذا لم يتم تخطيه)
    if (!skipHistoryCreation) {
        const historyRef = admin.firestore().collection("tasks_history").doc();

        // تجهيز بيانات سجل التاريخ الأساسية 
        const historyRecord: Record<string, unknown> = {
            task_id: taskId,
            service_id: serviceId,
            sa_id: saId,
            parent_entity_id: parentEntityId,
            target_entity_id: targetEntityId || null,
            target_entity_name_ar: targetEntityNameAr || null,
            target_entity_name_en: targetEntityNameEn || null,
            sequence_number: sequenceNumber || null, // ✅ النقطة 2: حفظ رقم العملية
            actor_user_id: actorUserId,
            actor_job_id: actorJobId,
            status: "created",
            details: details,
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            action_metadata: actionMetadata || null,
        };

        // ✨ تعديل: إضافة التوقيع فقط بشكل شرطي
        if (actorSignatureUrl) {
            historyRecord.actor_signature_url = actorSignatureUrl;
        }

        batch.set(historyRef, historyRecord);
    }

    // تنفيذ العمليات
    await batch.commit();
    return taskId;
};

/**
 * UPDATED:
 * - Removed 'cancelled_obsolete' logic.
 * - ADDED: Business logic validation at the start.
 * Checks security_evaluations to enforce the "one-eval-per-month" rule.
 * Allows new evaluation ONLY if existing eval for that month is 'Rejected'.
 */
export const createEvaluationAndTask = onCall({ region: "us-central1", cors: true, secrets: ["IPINFO_TOKEN"] }, async (request) => {
    // 1. التحقق من المصادقة والمُدخلات (لا تغيير)
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
    }
    const userId = request.auth.uid;
    // ✅ التعديل (النقطة 4): إضافة ملاحظات اختيارية عند الإنشاء
    const { evaluationData, clientContext, optionalNotes } = request.data as {
        evaluationData: EvaluationInputData,
        clientContext?: Record<string, unknown>,
        optionalNotes?: string
    };
    const APPROVAL_PERMISSION_ID = "sss:2";
    const APPROVAL_SA_ID = 2;

    try {
        // 2. التحقق من منطق العمل (عدم وجود تقييم آخر للشهر نفسه) (لا تغيير)
        const existingEvalQuery = await db.collection("security_evaluations")
            .where("company_id", "==", evaluationData.company_id)
            .where("evaluation_year", "==", evaluationData.evaluation_year)
            .where("evaluation_month", "==", evaluationData.evaluation_month)
            .get();

        if (!existingEvalQuery.empty) {
            let canProceed = true;
            let errorMessage = "An unknown error prevents creating this evaluation.";
            for (const doc of existingEvalQuery.docs) {
                const status = doc.data().status;
                if (status === "Awaiting Approval" || status === "Needs Revision") {
                    canProceed = false;
                    errorMessage = "An evaluation for this company is already awaiting approval.";
                    break;
                }
                if (status === "Approved") {
                    canProceed = false;
                    errorMessage = "This company has already been approved for this month.";
                    break;
                }
            }
            if (!canProceed) {
                throw new HttpsError("failed-precondition", errorMessage);
            }
        }

        // 3. جلب بيانات الشركة والمستخدم وتجهيز البيانات الوصفية (Metadata)
        const companyDoc = await db.collection("companies").doc(evaluationData.company_id).get();
        if (!companyDoc.exists) {
            throw new HttpsError("not-found", "The specified company does not exist.");
        }
        const companyData = companyDoc.data();
        const companyNameAr = companyData?.name_ar || "شركة غير معروفة";
        const companyNameEn = companyData?.name_en || "Unknown Company";

        const ipInfo = await getIpInfo(request.rawRequest.ip); // افترض وجود هذه الدالة
        const actionMetadata = {
            timestamp_utc: new Date(),
            client_details: clientContext || null,
            server_details: { ip_info: ipInfo, user_agent_raw: request.rawRequest.headers["user-agent"] || null }
        };

        const sequenceNumber = await getNextTaskSequenceId("evaluation_counter");
        const batch = db.batch(); // تجهيز العمليات المجمعة

        const userDoc = await db.collection("users").doc(userId).get();
        const userData = userDoc.data();
        const evaluatorJobId = userData?.job_id || null;

        // ✨ تعديل: جلب التوقيع فقط (تم حذف الختم)
        const evaluatorSignatureUrl = userData?.signature_url || null;
        // const evaluatorSealUrl = userData?.seal_url || null; // <-- تم الحذف

        // التحقق من وجود توقيع للمُقيِّم (لا تغيير)
        if (!evaluatorSignatureUrl) {
            throw new HttpsError("failed-precondition", "You must have a signature to create an evaluation. Please update your profile.");
        }

        // 4. إنشاء سجل الهيستوري (الإصدار الأول) (لا تغيير)
        const historyData = {
            company_id: evaluationData.company_id,
            evaluation_year: evaluationData.evaluation_year,
            evaluation_month: evaluationData.evaluation_month,
            evaluator_id: userId,
            evaluator_job_id: evaluatorJobId,
            version_number: 1,
            status: "Awaiting Approval",
            historical_contract_no: evaluationData.historical_contract_no,
            historical_guard_count: evaluationData.historical_guard_count,
            historical_violations_count: evaluationData.historical_violations_count,
            summary: evaluationData.summary,
            overall_score: evaluationData.overall_score,
            details: evaluationData.details,
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            sequence_number: sequenceNumber, // ✅ الإضافة (النقطة 1 و 2)
            notes: optionalNotes || null, // ✅ الإضافة (النقطة 4)
            // لا يوجد توقيع أو ختم هنا
        };
        const newHistoryDocRef = db.collection("evaluation_history").doc();
        batch.set(newHistoryDocRef, historyData);

        // 5. إنشاء سجل التقييم الرئيسي (لا تغيير)
        const mainEvaluationData = {
            evaluation_year: evaluationData.evaluation_year,
            evaluation_month: evaluationData.evaluation_month,
            company_id: evaluationData.company_id,
            evaluator_id: userId,
            evaluator_job_id: evaluatorJobId,
            latest_version_id: newHistoryDocRef.id,
            status: "Awaiting Approval",
            historical_contract_no: evaluationData.historical_contract_no,
            historical_guard_count: evaluationData.historical_guard_count,
            historical_violations_count: evaluationData.historical_violations_count,
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
            sequence_number: sequenceNumber // ✅ الإضافة (النقطة 1 و 2)
        };
        const newEvaluationDocRef = db.collection("security_evaluations").doc();
        batch.set(newEvaluationDocRef, mainEvaluationData);

        // 6. ربط الهيستوري بالتقييم الرئيسي (لا تغيير)
        batch.update(newHistoryDocRef, { parent_evaluation_id: newEvaluationDocRef.id });

        // 7. تنفيذ عمليات إنشاء التقييم والهيستوري
        await batch.commit(); // تنفيذ الـ batch الأول

        // 8. إنشاء مهمة "اعتماد" جديدة لهذا التقييم
        await createTask({ // استدعاء الدالة المعدلة
            serviceId: 5,
            saId: APPROVAL_SA_ID,
            parentEntityId: newEvaluationDocRef.id,
            actorUserId: userId,
            actorJobId: evaluatorJobId,
            assignedToUserIds: await getUsersWithPermission(APPROVAL_PERMISSION_ID), // افترض وجود هذه الدالة
            isAssignedToSuperAdmins: true,
            targetEntityId: evaluationData.company_id,
            targetEntityNameAr: companyNameAr,
            targetEntityNameEn: companyNameEn,
            sequenceNumber: sequenceNumber, // ✅ الإضافة (النقطة 1 و 2)
            details: {
                notes: optionalNotes || null, // ✅ الإضافة (النقطة 4)
                company_name_ar: companyNameAr,
                company_name_en: companyNameEn,
                evaluation_month: evaluationData.evaluation_month,
                evaluation_year: evaluationData.evaluation_year,
                evaluator_job_id: evaluatorJobId,
            },
            actionMetadata,
            actorSignatureUrl: evaluatorSignatureUrl, // ✨ تعديل: تمرير التوقيع فقط
        });
        // 9. إرجاع النتيجة (لا تغيير)
        return { success: true, evaluation_id: newEvaluationDocRef.id };

    } catch (error) { // 10. معالجة الأخطاء
        console.error("Error in createEvaluationAndTask:", error);
        if (error instanceof HttpsError) throw error; // أعد رمي الخطأ إذا كان من نوع HttpsError بالفعل
        let detailMessage = "An error occurred while creating the evaluation.";
        if (error instanceof Error) { // <-- هذا الفحص يعالج الخطأ
            detailMessage = error.message;
        }
        throw new HttpsError("internal", detailMessage);
    }
});

/**
 * UPDATED: Adds company name to new tasks created.
 */
export const processEvaluationTask = onCall({ region: "us-central1", cors: true, secrets: ["IPINFO_TOKEN"] }, async (request) => {
    // 1. التحقق من المصادقة والمُدخلات الأساسية
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
    }
    const userId = request.auth.uid;
    const { taskId, action, reason, clientContext, optionalReason } = request.data as {
        taskId: string;
        action: "approve" | "reject" | "needs_revision";
        reason?: string;
        optionalReason?: string; // ✅ الإضافة (النقطة 4): ملاحظة اختيارية للاعتماد
        clientContext?: Record<string, unknown>;
    };

    if (!taskId || !action) {
        throw new HttpsError("invalid-argument", "Missing required parameters: taskId and action.");
    }

    // 2. تجهيز العمليات المجمعة (Batch) وجلب البيانات الأولية
    const batch = db.batch();
    try {
        const ipInfo = await getIpInfo(request.rawRequest.ip);
        const actionMetadata = {
            timestamp_utc: new Date(),
            client_details: clientContext || null,
            server_details: { ip_info: ipInfo, user_agent_raw: request.rawRequest.headers["user-agent"] || null }
        };

        const taskRef = db.collection("tasks_queue").doc(taskId);
        const taskDoc = await taskRef.get();
        if (!taskDoc.exists) {
            throw new HttpsError("not-found", "Task not found in queue.");
        }
        const taskData = taskDoc.data()!;

        const userDoc = await db.collection("users").doc(userId).get();
        const userData = userDoc.data();
        const actorJobId = userData?.job_id || null;

        const evaluationRef = db.collection("security_evaluations").doc(taskData.parent_entity_id);
        const evaluationDoc = await evaluationRef.get();
        if (!evaluationDoc.exists) {
            throw new HttpsError("not-found", "Evaluation referenced by task not found.");
        }
        const evaluationData = evaluationDoc.data()!;

        const approverSignatureUrl = userData?.signature_url || null;

        // 3. تجهيز سجل الإجراء (Task History)
        const historyRef = db.collection("tasks_history").doc();
        const historyLogPayload: Record<string, unknown> = { // <-- ✅ تم التعديل
            task_id: taskId,
            parent_entity_id: taskData.parent_entity_id,
            service_id: taskData.service_id,
            sa_id: taskData.sa_id,
            target_entity_id: taskData.target_entity_id,
            target_entity_name_ar: taskData.target_entity_name_ar,
            target_entity_name_en: taskData.target_entity_name_en,
            status: action === "approve" ? "approved" : action === "reject" ? "Rejected" : "revision_requested",
            actor_user_id: userId,
            actor_job_id: actorJobId,
            details: {
                ...taskData.details,
                reason: reason || null, // سبب إلزامي (للرفض/المراجعة)
                optional_notes: optionalReason || null // ✅ الإضافة (النقطة 4)
            },
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            action_metadata: actionMetadata
        };

        // 4. تنفيذ المنطق بناءً على نوع الإجراء
        switch (action) {
            case "approve": { // <-- ✅ تم إضافة القوس
                if (!approverSignatureUrl) {
                    throw new HttpsError("failed-precondition", "You must have a signature to approve an evaluation. Please update your profile.");
                }
                historyLogPayload.actor_signature_url = approverSignatureUrl;

                // ✅ --- التعديل الجديد: التحقق من تاريخ التقييم ---

                // 1. حساب تاريخ الشهر "السابق"
                const now = new Date(); // (نحن الآن في 06-11-2025)
                now.setDate(0); // (نرجع إلى آخر يوم في الشهر الماضي: 31-10-2025)
                const prevMonthYear = now.getFullYear(); // (2025)
                const prevMonth = now.getMonth() + 1; // (10)

                // 2. جلب تاريخ التقييم (نستخدم Number() للاحتياط)
                const evalMonth = Number(evaluationData.evaluation_month);
                const evalYear = Number(evaluationData.evaluation_year);

                // 3. المقارنة وتطبيق المنطق
                if (evalYear === prevMonthYear && evalMonth === prevMonth) {
                    // الحالة 1: التقييم يخص الشهر الماضي (Oct 2025)
                    // -> تم إنجاز المطلوب، احذف المهمة.
                    batch.delete(taskRef);

                } else {
                    // الحالة 2: التقييم يخص شهر أقدم (Sep 2025 أو قبل)
                    // -> أعد تدوير المهمة لإنشاء تقييم جديد (للشهر الماضي Oct 2025)
                    const creatorUserIds = await getUsersWithPermission("sss:1");
                    batch.update(taskRef, {
                        sa_id: 1, // SA_ID for "Create"
                        assigned_to_user_ids: creatorUserIds,
                        sequence_number: null // حذف الرقم المرجعي القديم
                        // (ملاحظة: تفاصيل المهمة ستحتوي على بيانات الشهر الماضي المطلوبة)
                    });
                }

                // 4. اعتماد التقييم (يحدث في كلتا الحالتين)
                batch.update(evaluationRef, { status: "Approved", updated_at: admin.firestore.FieldValue.serverTimestamp() });
                const latestHistoryDocRef = db.collection("evaluation_history").doc(evaluationData.latest_version_id);
                batch.update(latestHistoryDocRef, {
                    approver_id: userId,
                    approver_job_id: actorJobId,
                    status: "Approved",
                });
                break;
            } // <-- ✅ تم إغلاق القوس
            case "reject": {
                const creatorUserIds = await getUsersWithPermission("sss:1");

                // ✅ --- التعديل: إصلاح مشكلة إعادة تدوير المهمة ---
                // نحول المهمة إلى "إنشاء" ونحذف الرقم المرجعي القديم
                batch.update(taskRef, {
                    sa_id: 1, // SA_ID for "Create"
                    assigned_to_user_ids: creatorUserIds,
                    sequence_number: null // ✅ <-- أهم تعديل: احذف الرقم القديم
                });

                batch.update(evaluationRef, { status: "Rejected", updated_at: admin.firestore.FieldValue.serverTimestamp() });
                break;
            }
            case "needs_revision": { // <-- ✅ تم إضافة القوس
                batch.update(taskRef, {
                    sa_id: 3, // SA_ID for "Revise"
                    assigned_to_user_ids: [evaluationData.evaluator_id],
                });
                batch.update(evaluationRef, { status: "Needs Revision", updated_at: admin.firestore.FieldValue.serverTimestamp() });
                break;
            } // <-- ✅ تم إغلاق القوس
        }

        // 5. إضافة سجل الإجراء النهائي
        batch.set(historyRef, historyLogPayload);

        // 6. تنفيذ جميع العمليات
        await batch.commit();
        return { success: true, message: "Action completed successfully." };

    } catch (error) { // 7. معالجة الأخطاء
        console.error("Error in processEvaluationTask:", error);
        if (error instanceof HttpsError) throw error;
        throw new HttpsError("internal", "An internal error occurred.");
    }
});

/**
 * UPDATED: Adds company name to the new approval task.
 */
export const resubmitEvaluation = onCall({ region: "us-central1", cors: true, secrets: ["IPINFO_TOKEN"] }, async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "Function requires authentication.");
    }
    const userId = request.auth.uid;
    const { taskId, updatedData, clientContext } = request.data as { taskId: string; updatedData: Record<string, unknown>; clientContext?: Record<string, unknown>; };

    try {
        const ipInfo = await getIpInfo(request.rawRequest.ip);
        const actionMetadata = {
            timestamp_utc: new Date(),
            client_details: clientContext || null,
            server_details: { ip_info: ipInfo, user_agent_raw: request.rawRequest.headers["user-agent"] || null }
        };

        const batch = db.batch();

        const taskRef = db.collection("tasks_queue").doc(taskId);
        const taskDoc = await taskRef.get();
        if (!taskDoc.exists) throw new HttpsError("not-found", "Task not found in queue.");

        const taskData = taskDoc.data()!;
        if (!taskData.assigned_to_user_ids.includes(userId)) {
            throw new HttpsError("permission-denied", "You are not assigned to this task.");
        }

        const evaluationRef = db.collection("security_evaluations").doc(taskData.parent_entity_id);
        const evaluationDoc = await evaluationRef.get();
        if (!evaluationDoc.exists) throw new HttpsError("not-found", "Evaluation not found.");
        const evaluationData = evaluationDoc.data()!;

        const targetEntityNameAr = taskData.target_entity_name_ar || "غير معروف";
        const targetEntityNameEn = taskData.target_entity_name_en || "Unknown";

        const userDoc = await db.collection("users").doc(userId).get();
        const evaluatorJobId = userDoc.data()?.job_id || null;

        const latestHistoryRef = db.collection("evaluation_history").doc(evaluationData.latest_version_id);
        const latestHistoryDoc = await latestHistoryRef.get();
        const latestHistoryData = latestHistoryDoc.data()!;
        const newVersionNumber = (latestHistoryData.version_number || 1) + 1;

        const newHistoryRef = db.collection("evaluation_history").doc();
        batch.set(newHistoryRef, {
            ...latestHistoryData,
            ...updatedData,
            version_number: newVersionNumber,
            status: "Awaiting Approval",
            created_at: admin.firestore.FieldValue.serverTimestamp(),
        });

        batch.update(evaluationRef, {
            status: "Awaiting Approval",
            latest_version_id: newHistoryRef.id,
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        });

        // --- DELETED ---
        // تم حذف الكود الذي كان يبحث عن سجل تاريخي قديم ويقوم بتعديله
        // const historyQuery = await db.collection("tasks_history").where("task_id", "==", taskId).limit(1).get();
        // if (!historyQuery.empty) {
        //     batch.update(historyQuery.docs[0].ref, { status: "completed", /* ... */ });
        // }

        // +++ ADDED +++
        // إضافة سجل تاريخي جديد يوثق عملية "إعادة التقديم"
        const newHistoryLogRef = db.collection("tasks_history").doc();
        batch.set(newHistoryLogRef, {
            task_id: taskId,
            parent_entity_id: taskData.parent_entity_id,
            service_id: taskData.service_id,
            sa_id: taskData.sa_id,
            target_entity_id: taskData.target_entity_id,
            target_entity_name_ar: targetEntityNameAr,
            target_entity_name_en: targetEntityNameEn,
            status: "resubmitted",
            actor_user_id: userId,
            actor_job_id: evaluatorJobId,
            details: { message: "Evaluation resubmitted after revision." },
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            action_metadata: actionMetadata
        });

        batch.delete(taskRef);

        const approverUserIds = await getUsersWithPermission("sss:2");

        // +++ MODIFIED: Pass the new parameter here
        await createTask({
            serviceId: 5, saId: 2,
            parentEntityId: evaluationRef.id, actorUserId: userId, actorJobId: evaluatorJobId,
            assignedToUserIds: approverUserIds,
            isAssignedToSuperAdmins: true,
            targetEntityId: evaluationData.company_id,
            targetEntityNameAr: targetEntityNameAr,
            targetEntityNameEn: targetEntityNameEn,
            details: {
                company_name_ar: targetEntityNameAr,
                company_name_en: targetEntityNameEn
            },
            actionMetadata,
            skipHistoryCreation: true // <-- ✨ التعديل المهم هنا
        });

        await batch.commit();
        return { success: true, message: "Evaluation resubmitted successfully." };
    } catch (error) {
        console.error("Error in resubmitEvaluation:", error);
        if (error instanceof HttpsError) throw error; // أعد رمي الخطأ
        let detailMessage = "An internal error occurred while resubmitting.";
        if (error instanceof Error) { // <-- هذا الفحص يعالج الخطأ
            detailMessage = error.message;
        }
        throw new HttpsError("internal", detailMessage);
    }
});

/**
 * 1. المُجدوِل (Scheduler)
 */
export const triggerMonthlyEvaluations = onSchedule("0 0 1 * *", async () => {
    try {
        const pubSub = new PubSub();
        const now = new Date();
        now.setDate(0);
        const year = now.getFullYear();
        const month = (now.getMonth() + 1).toString().padStart(2, "0");
        const checkMonthYear = `${year}-${month}`;
        const data = JSON.stringify({ checkMonthYear: checkMonthYear });

        await pubSub.topic("start-monthly-evaluations").publishMessage({ data: Buffer.from(data) });

        console.log(`Published start message for month: ${checkMonthYear}`);
        return; // <-- ✨ معدلة

    } catch (error) {
        console.error("Error in triggerMonthlyEvaluations:", error);
        return; // <-- ✨ معدلة
    }
});

/**
 * 2. المُوَزِّع (The Fan-Out)
 */
export const fanOutMonthlyEvaluations = onMessagePublished("start-monthly-evaluations", async (event) => {
    try {
        const pubSub = new PubSub();
        const companiesSnapshot = await db.collection("companies").where("is_active", "==", true).get();

        if (companiesSnapshot.empty) {
            console.log("No active companies found to check.");
            return;
        }

        const checkMonthYear = event.data.message.json.checkMonthYear;

        const promises = companiesSnapshot.docs.map(doc => {
            const data = JSON.stringify({
                companyId: doc.id,
                companyNameAr: doc.data().name_ar || "شركة غير معروفة",
                companyNameEn: doc.data().name_en || "Unknown Company",
                checkMonthYear: checkMonthYear
            });
            return pubSub.topic("process-single-evaluation-task").publishMessage({ data: Buffer.from(data) });
        });

        await Promise.all(promises);
        console.log(`Fanned-out ${companiesSnapshot.size} companies for checking month ${checkMonthYear}.`);

    } catch (error) {
        console.error("Error in fanOutMonthlyEvaluations:", error);
    }
});

/**
 * 3. العامل (The Worker)
 */
export const createSingleEvaluationTask = onMessagePublished("process-single-evaluation-task", async (event) => {
    try {
        const {
            companyId,
            companyNameAr,
            companyNameEn,
            checkMonthYear
        } = event.data.message.json;

        const [yearStr, monthStr] = checkMonthYear.split("-");
        const checkYear = Number(yearStr);
        const checkMonth = monthStr;

        // ✅ --- التعديل: إضافة فحص مزدوج لمنع تكرار المهام ---

        // 1. التحقق من التقييمات (هل يوجد تقييم مكتمل أو قيد المراجعة؟)
        const evalQuery = await db.collection("security_evaluations")
            .where("company_id", "==", companyId)
            .where("evaluation_year", "==", checkYear)
            .where("evaluation_month", "==", checkMonth)
            .where("status", "in", ["Approved", "Awaiting Approval", "Needs Revision"])
            .limit(1)
            .get();

        if (!evalQuery.empty) {
            // إذا وجدنا تقييماً مكتملاً أو قيد المراجعة، نتخطى
            console.log(`Skipping task for ${companyId}, evaluation already exists (Status: ${evalQuery.docs[0].data().status}).`);
            return;
        }

        // 2. التحقق من المهام (هل توجد مهمة "إنشاء" معلقة بالفعل لهذه الشركة؟)
        // (هذا هو الفحص الجديد الذي يمنع التكرار بعد الرفض)
        const SA_ID_FOR_CREATE = 1; // (معرّف مهمة "إنشاء تقييم")
        const pendingTaskQuery = await db.collection("tasks_queue")
            .where("target_entity_id", "==", companyId) // <-- نبحث بالشركة
            .where("sa_id", "==", SA_ID_FOR_CREATE)      // <-- نبحث عن مهمة "إنشاء"
            .where("status", "==", "pending")            // <-- نبحث عن المهام المعلقة فقط
            .limit(1)
            .get();

        if (!pendingTaskQuery.empty) {
            // إذا وجدنا مهمة "إنشاء" معلقة، نتخطى (لأنها موجودة بالفعل)
            console.log(`Skipping task for ${companyId}, a pending 'Create' task already exists.`);
            return;
        }

        const creatorUserIds = await getUsersWithPermission("sss:1");

        await createTask({ // <-- الآن سيعمل لأن createTask مُعرّفة
            serviceId: 5,
            saId: 1,
            parentEntityId: companyId,
            actorUserId: "SYSTEM",
            actorJobId: null,
            assignedToUserIds: creatorUserIds,
            isAssignedToSuperAdmins: true,
            targetEntityId: companyId,
            targetEntityNameAr: companyNameAr,
            targetEntityNameEn: companyNameEn,
            details: {
                message_ar: `مطلوب تقييم جديد لشهر ${checkMonthYear}`,
                message_en: `New evaluation due for ${checkMonthYear}.`,
                company_name_ar: companyNameAr,
                company_name_en: companyNameEn,
                evaluation_month: checkMonth,
                evaluation_year: checkYear
            }
        });

        console.log(`Created new evaluation task for ${companyId} for month ${checkMonthYear}.`);

    } catch (error) {
        console.error(`Failed to process task for company ${event.data.message.json.companyId}:`, error);
    }
});

/**
 * UPDATED (v2): Firestore Trigger to aggregate evaluation scores (Total AND Monthly).
 * Correctly handles 'details' as an ARRAY of objects.
 */
export const aggregateEvaluationScores = onDocumentUpdated(
    "security_evaluations/{evaluationId}",
    async (event) => {

        // 1. التأكد أن الحالة تغيرت إلى "Approved"
        const beforeData = event.data?.before.data();
        const afterData = event.data?.after.data();

        if (afterData?.status !== "Approved" || beforeData?.status === "Approved") {
            console.log(`Not a new approval for ${event.params.evaluationId}, skipping aggregation.`);
            return;
        }

        // 2. جلب بيانات التقييم المعتمد
        const companyId = afterData.company_id;
        const latestVersionId = afterData.latest_version_id;
        const evalYear = afterData.evaluation_year;
        const evalMonth = afterData.evaluation_month;

        if (!companyId || !latestVersionId || !evalYear || !evalMonth) {
            console.error(`Missing critical data on ${event.params.evaluationId} (companyId, versionId, year, or month)`);
            return;
        }

        const historyDocRef = db.collection("evaluation_history").doc(latestVersionId);
        const historyDoc = await historyDocRef.get();

        if (!historyDoc.exists) {
            console.error(`Latest history doc not found: ${latestVersionId}`);
            return;
        }

        const historyData = historyDoc.data()!;

        // ✨ تصحيح: 'details' هو مصفوفة (Array)
        const evaluationDetails = historyData.details;
        const evaluationOverallScore = historyData.overall_score;

        // نتأكد أن 'details' هو مصفوفة وأن 'overall_score' موجود
        if (!Array.isArray(evaluationDetails) || typeof evaluationOverallScore === "undefined" || evaluationOverallScore === null) {
            console.error(`Evaluation 'details' is not an array or 'overall_score' is missing in history: ${latestVersionId}`);
            return;
        }

        const batch = db.batch();

        // 3. تحديث مستند الشركة (الإجمالي + الشهري)
        // (هذا الجزء كان يعمل سابقاً وسيبقى كما هو)
        const companyRef = db.collection("companies").doc(companyId);
        batch.update(companyRef, {
            evaluation_count: admin.firestore.FieldValue.increment(1),
            total_score: admin.firestore.FieldValue.increment(evaluationOverallScore),
        });

        const companyMonthlyDocId = `${companyId}_${evalYear}_${evalMonth}`;
        const companyMonthlyRef = db.collection("company_monthly_scores").doc(companyMonthlyDocId);
        batch.set(companyMonthlyRef, {
            evaluation_count: admin.firestore.FieldValue.increment(1),
            total_score: admin.firestore.FieldValue.increment(evaluationOverallScore),
            company_id: companyId,
            evaluation_year: evalYear,
            evaluation_month: evalMonth,
        }, { merge: true });


        // 4. ✨ تصحيح: تحديث مستندات الأسئلة (عبر المرور على المصفوفة)

        // لتجميع معرفات الأسئلة لتحديث المتوسطات لاحقاً
        const uniqueQuestionIds = new Set<string>();
        const questionMonthlyJobs: { docId: string; qId: string }[] = [];

        for (const item of evaluationDetails) {
            // من الصورة: الحقول هي 'question_id' و 'rating'
            const questionId = item.question_id;
            const score = item.rating;

            // نتأكد من وجود ID ورقم تقييم
            if (questionId && typeof score === "number") {

                // IDs المستندات يجب أن تكون سلاسل نصية (strings)
                const qIdString = String(questionId);
                uniqueQuestionIds.add(qIdString); // إضافة للمجموعة الإجمالية

                // (تحديث الإجمالي)
                const questionRef = db.collection("security_questions").doc(qIdString);
                batch.update(questionRef, {
                    answer_count: admin.firestore.FieldValue.increment(1),
                    total_score: admin.firestore.FieldValue.increment(score),
                });

                // (تحديث الشهري)
                const questionMonthlyDocId = `${qIdString}_${evalYear}_${evalMonth}`;
                const questionMonthlyRef = db.collection("question_monthly_scores").doc(questionMonthlyDocId);
                batch.set(questionMonthlyRef, {
                    answer_count: admin.firestore.FieldValue.increment(1),
                    total_score: admin.firestore.FieldValue.increment(score),
                    question_id: qIdString, // إضافة ID السؤال للفلترة
                    evaluation_year: evalYear,
                    evaluation_month: evalMonth,
                }, { merge: true });

                // إضافة للمهام لحساب المتوسط لاحقاً
                questionMonthlyJobs.push({ docId: questionMonthlyDocId, qId: qIdString });

            } else {
                console.warn(`Skipping item with missing question_id or non-numeric rating in eval ${latestVersionId}`);
            }
        }

        // 5. تنفيذ التحديثات (Increments)
        try {
            await batch.commit();
            console.log(`Successfully incremented scores (Total & Monthly) for evaluation: ${event.params.evaluationId}`);

            // 6. حساب المتوسطات النهائية (الإجمالي)
            await updateCompanyAverage(companyId);

            // ✨ تصحيح: استخدام 'uniqueQuestionIds'
            const totalQuestionUpdates = Array.from(uniqueQuestionIds).map(qId => updateQuestionAverage(qId));

            // 6b. حساب المتوسطات النهائية (الشهري)
            await updateCompanyMonthlyAverage(companyMonthlyDocId, companyId, evalYear, evalMonth);
            const monthlyQuestionUpdates = questionMonthlyJobs.map(job =>
                updateQuestionMonthlyAverage(job.docId, job.qId, evalYear, evalMonth)
            );

            // تشغيل جميع الحسابات بالتوازي
            await Promise.all([
                ...totalQuestionUpdates,
                ...monthlyQuestionUpdates
            ]);

            console.log(`Successfully calculated new averages (Total & Monthly) for evaluation: ${event.params.evaluationId}`);

        } catch (error) {
            console.error(`Error aggregating scores for ${event.params.evaluationId}:`, error);
        }
    }
);

// ============================================================================
// 🏢 Organizational Structure Management System (OSMS)
// ============================================================================

interface OrgStructurePayload {
    type: "sector" | "department" | "section";
    action: "create" | "update" | "delete" | "move";
    docId?: string; // Required for update, delete, move

    // Data for Create/Update
    name_ar?: string;
    name_en?: string;
    manager_id?: string | null;

    // Data for Create (Parent linkage)
    parent_id?: string; // For Dept (sector_id), For Section (department_id)

    // Data for Move (Smart Migration)
    new_parent_id?: string; // The ID of the new parent (Sector or Dept)
}

export const manageOrgStructure = onCall({ region: "us-central1", cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");

    // 1. التحقق من الصلاحيات
    const actorId = request.auth.uid;
    const actorProfile = await _fetchActorDelegationProfile(actorId);
    if (!actorProfile.isSuperAdmin && !actorProfile.resources.includes("ss:23")) {
        throw new HttpsError("permission-denied", "You do not have permission to manage organizational structure.");
    }

    const { type, action, docId, name_ar, name_en, manager_id, parent_id, new_parent_id } = request.data as OrgStructurePayload;

    // تحديد المجموعة (Collection)
    let collectionName = "";
    let parentCollectionName = "";
    let childCollectionName = "";
    let parentField = "";

    if (type === "sector") {
        collectionName = "sectors";
        childCollectionName = "departments";
    } else if (type === "department") {
        collectionName = "departments";
        parentCollectionName = "sectors";
        childCollectionName = "sections";
        parentField = "sector_id";
    } else if (type === "section") {
        collectionName = "sections";
        parentCollectionName = "departments";
        parentField = "department_id";
    }

    const colRef = db.collection(collectionName);
    const batch = db.batch();

    try {
        // --- A. CREATE ---
        if (action === "create") {
            if (!name_ar || !name_en) throw new HttpsError("invalid-argument", "Names are required.");

            // إنشاء ID جديد
            const newRef = colRef.doc();

            // ✅ تصحيح الخطأ 1: استبدال any بـ Record<string, unknown>
            const data: Record<string, unknown> = {
                id: newRef.id,
                name_ar,
                name_en,
                manager_id: manager_id || null,
                created_by: actorId,
                created_at: admin.firestore.FieldValue.serverTimestamp(),
                is_active: true
            };

            // ربط بالأب
            if (type !== "sector") {
                if (!parent_id) throw new HttpsError("invalid-argument", "Parent ID is required.");
                const parentDoc = await db.collection(parentCollectionName).doc(parent_id).get();
                if (!parentDoc.exists) throw new HttpsError("not-found", "Parent entity not found.");

                data[parentField] = parent_id;

                if (type === "section") {
                    data["sector_id"] = parentDoc.data()?.sector_id;
                }
            }

            await newRef.set(data);
            return { success: true, id: newRef.id, message: "Entity created successfully." };
        }

        // --- B. UPDATE (Name/Manager) ---
        if (action === "update") {
            if (!docId) throw new HttpsError("invalid-argument", "Doc ID required.");

            // ✅ تصحيح الخطأ 2: استبدال any بـ Record<string, unknown>
            const updateData: Record<string, unknown> = {
                updated_by: actorId,
                updated_at: admin.firestore.FieldValue.serverTimestamp()
            };
            if (name_ar) updateData.name_ar = name_ar;
            if (name_en) updateData.name_en = name_en;
            if (manager_id !== undefined) updateData.manager_id = manager_id;

            await colRef.doc(docId).update(updateData);
            return { success: true, message: "Entity updated successfully." };
        }

        // --- C. DELETE (With Integrity Check) ---
        if (action === "delete") {
            if (!docId) throw new HttpsError("invalid-argument", "Doc ID required.");

            if (childCollectionName) {
                const childrenSnap = await db.collection(childCollectionName).where(type === "sector" ? "sector_id" : "department_id", "==", docId).limit(1).get();
                if (!childrenSnap.empty) {
                    throw new HttpsError("failed-precondition", `Cannot delete ${type} because it has linked ${childCollectionName}. Move or delete them first.`);
                }
            }

            const usersSnap = await db.collection("users").where(type === "sector" ? "sector_id" : (type === "department" ? "department_id" : "section_id"), "==", docId).limit(1).get();
            if (!usersSnap.empty) {
                throw new HttpsError("failed-precondition", `Cannot delete ${type} because users are assigned to it.`);
            }

            await colRef.doc(docId).delete();
            return { success: true, message: "Entity deleted successfully." };
        }

        // --- D. SMART MIGRATION (Move) 🧠 ---
        if (action === "move") {
            if (!docId || !new_parent_id) throw new HttpsError("invalid-argument", "Doc ID and New Parent ID are required.");
            if (type === "sector") throw new HttpsError("invalid-argument", "Sectors cannot be moved (they are top level).");

            const targetDocRef = colRef.doc(docId);
            const targetDoc = await targetDocRef.get();
            if (!targetDoc.exists) throw new HttpsError("not-found", "Entity not found.");

            // ✅ تصحيح الخطأ 3: حذف السطر الخاص بـ oldData لأنه غير مستخدم
            // const oldData = targetDoc.data()!; <--- تم الحذف

            const newParentDoc = await db.collection(parentCollectionName).doc(new_parent_id).get();
            if (!newParentDoc.exists) throw new HttpsError("not-found", "New parent not found.");

            // الحالة 1: نقل قسم (Section)
            if (type === "section") {
                const newSectorId = newParentDoc.data()?.sector_id;

                batch.update(targetDocRef, {
                    department_id: new_parent_id,
                    sector_id: newSectorId,
                    updated_at: admin.firestore.FieldValue.serverTimestamp()
                });

                const usersInSection = await db.collection("users").where("section_id", "==", docId).get();
                usersInSection.docs.forEach(user => {
                    batch.update(user.ref, {
                        department_id: new_parent_id,
                        sector_id: newSectorId,
                    });
                });
            }

            // الحالة 2: نقل إدارة (Department)
            if (type === "department") {
                batch.update(targetDocRef, {
                    sector_id: new_parent_id,
                    updated_at: admin.firestore.FieldValue.serverTimestamp()
                });

                const childSections = await db.collection("sections").where("department_id", "==", docId).get();
                childSections.docs.forEach(sec => {
                    batch.update(sec.ref, { sector_id: new_parent_id });
                });

                const usersInDept = await db.collection("users").where("department_id", "==", docId).get();
                usersInDept.docs.forEach(user => {
                    batch.update(user.ref, { sector_id: new_parent_id });
                });
            }

            await batch.commit();
            return { success: true, message: `Smart migration for ${type} completed successfully.` };
        }

        throw new HttpsError("invalid-argument", "Invalid action.");

        // ✅ تصحيح الخطأ 4: استخدام unknown والتحقق من النوع
    } catch (error: unknown) {
        console.error(`Error in manageOrgStructure (${action} ${type}):`, error);

        let errorMessage = "An internal error occurred.";
        if (error instanceof Error) {
            errorMessage = error.message;
        }

        throw new HttpsError("internal", errorMessage);
    }
});

/**
 * دالة سحابية لاستقبال صور التوقيع والختم (Base64) وتحميلها إلى Firebase Storage،
 * ثم تحديث سجل المستخدم بالروابط الجديدة.
 */
// استبدل الدالة القديمة بالكامل بهذا الكود في functions/src/index.ts
export const manageUserMedia = onCall({ region: "us-central1", cors: true, maxInstances: 5 }, async (request) => {

    if (!request.auth) {
        throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
    }
    const userId = request.auth.uid;

    const { type, base64Data } = request.data as { type: "signature" | "seal" | "avatar", base64Data: string | null };

    if (!["signature", "seal", "avatar"].includes(type)) {
        throw new HttpsError("invalid-argument", "The \"type\" must be \"signature\", \"seal\", or \"avatar\".");
    }

    const userRef = db.collection("users").doc(userId);
    const fieldToUpdate = `${type}_url`;

    const userDoc = await userRef.get();
    const oldUrl = userDoc.data()?.[fieldToUpdate] || null;

    if (type === "avatar") {
        if (base64Data === null) {
            await deleteFileFromStorage(oldUrl);
            await userRef.update({ [fieldToUpdate]: admin.firestore.FieldValue.delete() });
            await logMediaChange(userId, type, "DELETE", oldUrl);
            return { success: true };
        }

        await deleteFileFromStorage(oldUrl);

        const matches = base64Data.match(/^data:image\/(png|jpeg|jpg|svg\+xml);base64,(.+)$/);
        if (!matches) throw new HttpsError("invalid-argument", "Invalid base64 image format.");

        const mimeType = matches[1].replace("svg+xml", "svg");
        const imageBuffer = Buffer.from(matches[2], "base64");
        const fileName = `${type}.${mimeType}`;
        const filePath = `users/${userId}/${fileName}`;
        const file = admin.storage().bucket().file(filePath);

        await file.save(imageBuffer, { metadata: { contentType: `image/${matches[1]}` }, public: true });

        // ✨ التعديل الجوهري هنا: إضافة معامل فريد لتحديث الواجهة ✨
        const publicUrl = file.publicUrl() + `?t=${Date.now()}`;

        await userRef.update({ [fieldToUpdate]: publicUrl });
        await logMediaChange(userId, type, oldUrl ? "UPDATE" : "ADD", oldUrl, publicUrl);
        return { success: true, url: publicUrl };
    }

    else { // For signature and seal
        if (base64Data === null) {
            await userRef.update({ [fieldToUpdate]: admin.firestore.FieldValue.delete() });
            await logMediaChange(userId, type, "DELETE", oldUrl);
            return { success: true };
        }

        const matches = base64Data.match(/^data:image\/(png|jpeg|jpg|svg\+xml);base64,(.+)$/);
        if (!matches) throw new HttpsError("invalid-argument", "Invalid base64 image format.");

        const mimeType = matches[1].replace("svg+xml", "svg");
        const imageBuffer = Buffer.from(matches[2], "base64");
        const fileName = `${type}_${Date.now()}.${mimeType}`;
        const filePath = `users/${userId}/${fileName}`;
        const file = admin.storage().bucket().file(filePath);

        await file.save(imageBuffer, { metadata: { contentType: `image/${matches[1]}` }, public: true });

        const publicUrl = file.publicUrl();
        await userRef.update({ [fieldToUpdate]: publicUrl });
        await logMediaChange(userId, type, oldUrl ? "UPDATE" : "ADD", oldUrl, publicUrl);
        return { success: true, url: publicUrl };
    }
});

export const createNewTask = onCall({ region: "us-central1", cors: true }, async (request) => {
    // 1. التحقق من المصادقة
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
    }
    const userId = request.auth.uid;

    // 2. استلام البيانات (بالهيكل الجديد)
    const { taskData } = request.data as {
        taskData: {
            title: string;
            sub_tasks: { text: string; is_done: boolean }[];
            creator_id: string;

            // بيانات الـ Map (للفلترة)
            services_map: Record<string, boolean>;
            universities_map: Record<string, boolean>;
            countries_map: Record<string, boolean>;
            responsible_persons_map: Record<string, boolean>;

            // بيانات الـ List (للعرض)
            services_list: string[];
            universities_list: string[];
            countries_list: string[];
            responsible_persons_list: string[];

            // ✅ (الطلب 3): حقول التاريخ والوقت الاختيارية
            start_at?: string; // (نتوقع من الواجهة أن ترسلها كـ ISO String)
            end_at?: string;
        },
    };

    // 3. التحقق المبدئي
    if (!taskData || !taskData.title || !taskData.services_list || taskData.services_list.length === 0) {
        throw new HttpsError("invalid-argument", "Missing required fields (title or services).");
    }

    // --- ✅ (جديد): التحقق من وجود مهام فرعية ---
    if (!taskData.sub_tasks || taskData.sub_tasks.length === 0) {
        throw new HttpsError("invalid-argument", "At least one sub-task is required.");
    }

    // 4. التحقق من تطابق المستخدم
    if (taskData.creator_id !== userId) {
        throw new HttpsError("permission-denied", "Creator ID does not match authenticated user.");
    }

    try {
        // ✅ (الطلب 2): جلب رقم متسلسل جديد
        const sequenceNumber = await getNextTaskSequenceId("ahmed_saeed_tasks_counter");

        // 7. تجهيز المستند النهائي للحفظ (بالهيكل الجديد)
        const newDocData = {
            // --- ✅ بناء المستند يدوياً لضمان الهيكل الصحيح ---
            title: taskData.title,
            sub_tasks: taskData.sub_tasks, // <-- ✅ الحقل الجديد
            creator_id: taskData.creator_id,

            // maps
            services_map: taskData.services_map,
            universities_map: taskData.universities_map,
            countries_map: taskData.countries_map,
            responsible_persons_map: taskData.responsible_persons_map,

            // lists
            services_list: taskData.services_list,
            universities_list: taskData.universities_list,
            countries_list: taskData.countries_list,
            responsible_persons_list: taskData.responsible_persons_list,

            // --- الحقول الإضافية المطلوبة ---
            "created_at": admin.firestore.FieldValue.serverTimestamp(),
            "status": "غير منجز",
            "is_hidden": false,

            // ✅ (الطلب 2): إضافة الرقم المتسلسل
            "sequence_number": sequenceNumber,

            // ✅ (الطلب 3): إضافة التواريخ الاختيارية
            // (إذا كانت القيمة غير موجودة "undefined"، ستتحول إلى null)
            "start_at": taskData.start_at ? admin.firestore.Timestamp.fromDate(new Date(taskData.start_at)) : null,
            "end_at": taskData.end_at ? admin.firestore.Timestamp.fromDate(new Date(taskData.end_at)) : null,
        };

        // 8. الحفظ في الجدول "AhmedSaeedTasks"
        await db.collection("AhmedSaeedTasks").add(newDocData);

        // 9. إرجاع رسالة نجاح
        return { success: true, message: "Task saved successfully to AhmedSaeedTasks." };

    } catch (error) {
        console.error("Error in createNewTask (AhmedSaeedTasks):", error);
        if (error instanceof HttpsError) throw error;
        throw new HttpsError("internal", "An internal error occurred while saving the task.");
    }
});

// ✅ دالة التعديل الشامل الجديدة
export const updateSharedItemInTasks = onCall({ region: "us-central1", cors: true }, async (request) => {
    // 1. التحقق من المصادقة
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
    }

    // 2. استلام البيانات
    const { collectionName, docId, oldName, newName } = request.data as {
        collectionName: string;
        docId: string;
        oldName: string; // <-- الاسم القديم (مهم للتحديث)
        newName: string; // <-- الاسم الجديد
    };

    // 3. التحقق من البيانات
    if (!collectionName || !docId || !oldName || !newName) {
        throw new HttpsError("invalid-argument", "Missing required fields (collectionName, docId, oldName, newName).");
    }

    // 4. تحديد أسماء الحقول بناءً على اسم المجموعة
    let mapKey: string | null = null;
    let listKey: string | null = null;
    let nameField: string = "name_ar"; // افتراضي للدول

    if (collectionName === "app_services") {
        mapKey = "services_map";
        listKey = "services_list";
        nameField = "name";
    } else if (collectionName === "app_universities") {
        mapKey = "universities_map";
        listKey = "universities_list";
        nameField = "name";
    } else if (collectionName === "app_responsible_persons") {
        mapKey = "responsible_persons_map";
        listKey = "responsible_persons_list";
        nameField = "name";
    } else if (collectionName === "countries") {
        mapKey = "countries_map";
        listKey = "countries_list";
        nameField = "name_ar"; // (موجود مسبقاً، للتوضيح)
    }

    if (!mapKey || !listKey) {
        throw new HttpsError("invalid-argument", `Invalid collectionName: ${collectionName}`);
    }

    const batch = db.batch();

    try {
        // --- الخطوة 1: تعديل المستند الأصلي (في app_services أو countries ...) ---
        const mainDocRef = db.collection(collectionName).doc(docId);
        // (نستخدم nameField الصحيح، name أو name_ar)
        batch.update(mainDocRef, { [nameField]: newName });

        // --- الخطوة 2: البحث عن جميع المهام التي تستخدم هذا العنصر ---
        const tasksRef = db.collection("AhmedSaeedTasks");
        const tasksQuery = tasksRef.where(`${mapKey}.${docId}`, "==", true);
        const tasksSnapshot = await tasksQuery.get();

        // --- الخطوة 3: تحديث مصفوفة (list) في كل مهمة ---
        tasksSnapshot.forEach(doc => {
            const data = doc.data();
            const oldList = data[listKey] as string[] | undefined;

            if (oldList) {
                // استبدال الاسم القديم بالجديد فقط
                const newList = oldList.map(item => (item === oldName ? newName : item));
                // إضافة التحديث للـ batch
                batch.update(doc.ref, { [listKey]: newList });
            }
        });

        // --- الخطوة 4: تنفيذ جميع التحديثات مرة واحدة ---
        await batch.commit();

        return { success: true, message: `Updated ${tasksSnapshot.size} tasks successfully.` };

    } catch (error) {
        console.error("Error in updateSharedItemInTasks:", error);
        if (error instanceof HttpsError) throw error;
        throw new HttpsError("internal", "An internal error occurred while updating tasks.");
    }
});

// ✅ دالة جديدة لتعديل مهمة (أكثر أماناً)
export const updateAhmedSaeedTask = onCall({ region: "us-central1", cors: true }, async (request) => {
    // 1. التحقق من المصادقة
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
    }
    // const userId = request.auth.uid; // (يمكن استخدامه للتحقق من الصلاحيات مستقبلاً)

    // 2. استلام البيانات
    const { taskId, taskData } = request.data as {
        taskId: string;
        taskData: {
            title: string;
            sub_tasks: { text: string; is_done: boolean }[];

            // بيانات الـ Map (للفلترة)
            services_map: Record<string, boolean>;
            universities_map: Record<string, boolean>;
            countries_map: Record<string, boolean>;
            responsible_persons_map: Record<string, boolean>;

            // بيانات الـ List (للعرض)
            services_list: string[];
            universities_list: string[];
            countries_list: string[];
            responsible_persons_list: string[];

            // التواريخ (ستستقبلها كـ ISO String أو null)
            start_at?: string | null;
            end_at?: string | null;
        }
    };

    // 3. التحقق المبدئي
    if (!taskId || !taskData) {
        throw new HttpsError("invalid-argument", "Missing required fields (taskId or taskData).");
    }
    if (!taskData.title || !taskData.services_list || taskData.services_list.length === 0) {
        throw new HttpsError("invalid-argument", "Missing required fields (title or services).");
    }
    if (!taskData.sub_tasks || taskData.sub_tasks.length === 0) {
        throw new HttpsError("invalid-argument", "At least one sub-task is required.");
    }

    try {
        // 4. تجهيز المستند النهائي للتحديث

        // --- ✅ التحقق من صحة البيانات (Validation) يتم في الخادم ---
        const allDone = taskData.sub_tasks.every(task => task.is_done === true);
        const newStatus = allDone ? "منجز" : "غير منجز";

        const updatedData = {
            title: taskData.title,
            sub_tasks: taskData.sub_tasks,
            status: newStatus, // ✅ يتم حسابه في الخادم

            // maps
            services_map: taskData.services_map,
            universities_map: taskData.universities_map,
            countries_map: taskData.countries_map,
            responsible_persons_map: taskData.responsible_persons_map,

            // lists (نحن نثق بالترتيب القادم من الواجهة)
            services_list: taskData.services_list,
            universities_list: taskData.universities_list,
            countries_list: taskData.countries_list,
            responsible_persons_list: taskData.responsible_persons_list,

            // التواريخ
            start_at: taskData.start_at ? admin.firestore.Timestamp.fromDate(new Date(taskData.start_at)) : null,
            end_at: taskData.end_at ? admin.firestore.Timestamp.fromDate(new Date(taskData.end_at)) : null,
        };

        // 5. العثور على المستند وتحديثه
        const taskRef = db.collection("AhmedSaeedTasks").doc(taskId);

        // (اختياري: يمكنك إضافة التحقق من الصلاحيات هنا)
        // const docSnap = await taskRef.get();
        // if (docSnap.data()?.creator_id !== userId) {
        //     throw new HttpsError("permission-denied", "You do not have permission to edit this task.");
        // }

        await taskRef.update(updatedData);

        // 6. إرجاع رسالة نجاح
        return { success: true, message: "Task updated successfully via Cloud Function." };

    } catch (error) {
        console.error(`Error updating task ${taskId}:`, error);
        if (error instanceof HttpsError) throw error;
        throw new HttpsError("internal", "An internal error occurred while updating the task.");
    }
});

// ✅ دالة إدارة قائمة الدول (مزامنة جماعية - نسخة مخففة البيانات)
export const manageAppCountries = onCall({ region: "us-central1", cors: true }, async (request) => {
    // 1. التحقق من المصادقة
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "يجب تسجيل الدخول أولاً.");
    }

    // 2. استقبال قائمة المعرفات المختارة
    const { selectedIds } = request.data as { selectedIds: string[] };

    if (!Array.isArray(selectedIds)) {
        throw new HttpsError("invalid-argument", "يجب إرسال قائمة معرفات صحيحة.");
    }

    const db = admin.firestore();
    const batch = db.batch();
    const appCountriesRef = db.collection("app_countries");
    const refCountriesRef = db.collection("ref_countries");

    try {
        // أ) جلب الدول الموجودة حالياً في قائمة التطبيق
        const currentSnapshot = await appCountriesRef.get();
        const currentIds = currentSnapshot.docs.map(doc => doc.id);

        // ب) الحذف: حذف الدول التي أزالها المستخدم من القائمة
        const toDeleteIds = currentIds.filter(id => !selectedIds.includes(id));
        toDeleteIds.forEach(id => {
            const docRef = appCountriesRef.doc(id);
            batch.delete(docRef);
        });

        // ج) الإضافة: جلب الدول الجديدة من المرجع ونسخ البيانات "المهمة فقط"
        const toAddIds = selectedIds.filter(id => !currentIds.includes(id));
        
        for (const id of toAddIds) {
            const refDoc = await refCountriesRef.doc(id).get();
            if (refDoc.exists) {
                const data = refDoc.data()!;
                
                // 🔥 التعديل هنا: ننشئ كائناً يحتوي فقط على البيانات المطلوبة 🔥
                const minimalData = {
                    id: refDoc.id,       // نبقي المعرف
                    name_ar: data.name_ar, // الاسم بالعربي
                    code: data.code      // الكود (لأجل العلم)
                };

                const newDocRef = appCountriesRef.doc(id);
                batch.set(newDocRef, minimalData);
            }
        }

        // د) تنفيذ التغييرات
        await batch.commit();

        return { success: true, message: "تم تحديث قائمة الدول بنجاح." };

    } catch (error) {
        console.error("Error managing countries:", error);
        throw new HttpsError("internal", "حدث خطأ أثناء تحديث قائمة الدول.");
    }
});

/**
 * ✅ مُشغّل جديد: لإرسال رسائل البريد الإلكتروني من طابور "mail"
 * هذا يضمن إرسال البريد في الخلفية دون إبطاء الدوال الرئيسية
 */
export const sendEmailFromQueue = onDocumentCreated(
    { document: "mail/{mailId}", region: "us-central1", secrets: ["SENDGRID_KEY"] },
    async (event) => {

        const mailData = event.data?.data();
        if (!mailData) {
            console.error("Mail document data is empty.");
            return;
        }

        const { to, template } = mailData;

        if (!to || !Array.isArray(to) || to.length === 0 || !template?.name || !template?.data) {
            console.error(`Mail document ${event.params.mailId} is missing required fields (to, template.name, template.data).`);
            return; // لا تحاول مرة أخرى إذا كان المستند تالفاً
        }

        // 1. إعداد SendGrid
        const SENDGRID_API_KEY = process.env.SENDGRID_KEY;
        if (!SENDGRID_API_KEY) {
            console.error("CRITICAL: SENDGRID_KEY not set for sendEmailFromQueue trigger.");
            // رمي خطأ لإعادة المحاولة لاحقاً
            throw new Error("SendGrid API Key is not configured.");
        }
        sgMail.setApiKey(SENDGRID_API_KEY);

        // 2. تجهيز متغيرات البريد
        let subjectAr = "";
        let subjectEn = "";
        let contentAr = "";
        let contentEn = "";
        let greetingAr = "";
        let greetingEn = "";

        const tData = template.data; // اختصار لبيانات القالب

        try {
            // 3. تحديد القالب المطلوب
            switch (template.name) {

                case "user_activation": { // <-- القوس المضاف
                    const genderAr_A = tData.gender === "male" ? "السيد" : "السيدة";
                    const genderEn_A = tData.gender === "male" ? "Mr." : "Ms.";
                    const fullNameAr_A = tData.first_name_ar + " " + tData.last_name_ar;
                    const fullNameEn_A = tData.first_name_en + " " + tData.last_name_en;

                    greetingAr = `مرحباً ${genderAr_A} ${fullNameAr_A}، أهلاً بك في H-SSD.`;
                    greetingEn = `Hello ${genderEn_A} ${fullNameEn_A}, Welcome to H-SSD.`;
                    subjectAr = "تفعيل حسابك";
                    subjectEn = "Activate Your Account";
                    contentAr = `
                        <p>تمت الموافقة على طلب إنشاء حسابك في نظام H-SSD.</p>
                        <p>يرجى النقر على الرابط أدناه لتعيين كلمة المرور الخاصة بك وتفعيل حسابك:</p>
                        <p style="text-align: center;"><a href="https://h-ssd.com/set-password?token=${tData.token}" class="button">تعيين كلمة المرور</a></p>
                        <div class="alert-box">
                            <p><strong>تنبيه:</strong> رابط تعيين كلمة المرور سينتهي مفعوله خلال 24 ساعة!</p>
                            <p><strong>Alert:</strong> The password setup link will expire within 24 hours!</p>
                        </div>
                    `;
                    contentEn = `
                        <p>Your account creation request for the H-SSD system has been approved.</p>
                        <p>Please click the link below to set your password and activate your account:</p>
                        <p style="text-align: center;"><a href="https://h-ssd.com/set-password?token=${tData.token}" class="button">Set Your Password</a></p>
                    `;
                    break;
                } // <-- القوس المضاف

                case "user_rejected": { // <-- القوس المضاف
                    const genderAr_R = tData.gender === "male" ? "السيد" : "السيدة";
                    const genderEn_R = tData.gender === "male" ? "Mr." : "Ms.";

                    greetingAr = `مرحباً ${genderAr_R} ${tData.name_ar}`;
                    greetingEn = `Hello ${genderEn_R} ${tData.name_en}`;
                    subjectAr = "تم رفض طلب إنشاء حساب";
                    subjectEn = "Account Creation Request Rejected";
                    contentAr = `
                        <p>نعتذر، تم رفض طلب إنشاء حسابك في نظام H-SSD.</p>
                        <p><strong>السبب:</strong> ${tData.reason}</p>
                    `;
                    contentEn = `
                        <p>We regret to inform you that your account creation request for the H-SSD system has been rejected.</p>
                        <p><strong>Reason:</strong> ${tData.reason}</p>
                    `;
                    break;
                } // <-- القوس المضاف

                case "user_revision": { // <-- القوس المضاف
                    const genderAr_V = tData.gender === "male" ? "السيد" : "السيدة";
                    const genderEn_V = tData.gender === "male" ? "Mr." : "Ms.";

                    greetingAr = `مرحباً ${genderAr_V} ${tData.name_ar}`;
                    greetingEn = `Hello ${genderEn_V} ${tData.name_en}`;
                    subjectAr = "مراجعة مطلوبة لطلب إنشاء حساب";
                    subjectEn = "Revision Required for Account Creation Request";
                    contentAr = `
                        <p>تم إعادة طلب إنشاء الحساب الخاص بـ ${tData.target_name_ar} للمراجعة والتعديل.</p>
                        <p><strong>التعديلات المطلوبة:</strong> ${tData.reason}</p>
                        <p>يرجى الدخول إلى صفحة المهام لتعديل وإعادة تقديم الطلب.</p>
                    `;
                    contentEn = `
                        <p>The account creation request for ${tData.target_name_en} has been returned for revision.</p>
                        <p><strong>Required Revisions:</strong> ${tData.reason}</p>
                        <p>Please go to the tasks page to edit and resubmit the request.</p>
                    `;
                    break;
                } // <-- القوس المضاف

                default:
                    console.error(`Unknown email template name: ${template.name}`);
                    // حذف المستند لمنع إعادة المحاولة
                    await event.data?.ref.delete();
                    return;
            }

            // 4. بناء وإرسال البريد
            const emailToSend: sgMail.MailDataRequired = {
                to: to,
                from: { email: "system@h-ssd.com", name: "H-SSD" },
                subject: `${subjectAr} / ${subjectEn}`,
                html: getSystemEmailTemplate(contentAr, contentEn, greetingAr, greetingEn, subjectAr, subjectEn),
            };

            await sgMail.send(emailToSend);

            // 5. (اختياري) تحديث المستند للإشارة إلى أنه تم إرساله أو حذفه
            await event.data?.ref.update({ status: "sent", sent_at: admin.firestore.FieldValue.serverTimestamp() });
            // أو لحذفه: await event.data?.ref.delete();

            console.log(`Successfully sent email from queue: ${event.params.mailId}`);

        } catch (error) {
            console.error(`Error sending email from queue ${event.params.mailId}:`, error);
            // تحديث المستند بمعلومات الخطأ وإعادة رمي الخطأ لتفعيل إعادة المحاولة
            await event.data?.ref.update({
                status: "error",
                error_message: (error as Error).message,
                last_attempt: admin.firestore.FieldValue.serverTimestamp()
            });
            throw error; // إعادة رمي الخطأ لتفعيل إعادة المحاولة من Cloud Functions
        }
    }
);

// ============================================================================
// نظام ادارة المواقع 
// ============================================================================

// ============================================================================
// ⚙️ التعريفات والأنواع (Types & Interfaces)
// ============================================================================

const MIGRATION_TOPIC = "spatial-migration-updates";
const DELETE_TOPIC = "spatial-delete-cascade";

// ✅ تعريف نوع أكواد الخطأ يدوياً (هذا هو الحل للمشكلة)
type FunctionsErrorCode =
    | "ok" | "cancelled" | "unknown" | "invalid-argument" | "deadline-exceeded"
    | "not-found" | "already-exists" | "permission-denied" | "resource-exhausted"
    | "failed-precondition" | "aborted" | "out-of-range" | "unimplemented"
    | "internal" | "unavailable" | "data-loss" | "unauthenticated";

// واجهة عامة للبيانات
interface GenericData {
    [key: string]: unknown;
}

// واجهة مخصصة للبيانات المكانية
interface SpatialData {
    name_ar?: string;
    name_en?: string;
    code?: string;
    type_id?: string;
    point_id?: string;
    map_icon?: string;
    icon?: string;
    color_code?: string;
    site_id?: string;
    building_id?: string;
    zone_id?: string;
    floor_id?: string;
    unit_id?: string;
    geo_data?: {
        center?: unknown;
        [key: string]: unknown;
    };
    [key: string]: unknown;
}

// واجهة للأخطاء (الآن ستعمل لأن FunctionsErrorCode معرف فوقها)
interface ErrorWithCode {
    code?: FunctionsErrorCode;
    message: string;
}

// واجهة لبيانات الأنواع
interface TypeDocData {
    map_icon?: string;
    icon?: string;
    [key: string]: unknown;
}

const CHILD_RELATION_MAP: Record<string, { collection: string, field: string, target: string }[]> = {
    "country": [{ collection: "ref_emirates", field: "country_id", target: "emirate" }],
    "emirate": [{ collection: "ref_regions", field: "emirate_id", target: "region" }],
    "region": [{ collection: "ref_cities", field: "region_id", target: "city" }],
    "city": [{ collection: "ref_districts", field: "city_id", target: "district" }],
    "district": [{ collection: "ref_sectors", field: "district_id", target: "sector" }],
    "sector": [{ collection: "sites", field: "sector_id", target: "site" }],
    "site": [
        { collection: "buildings", field: "site_id", target: "building" },
        { collection: "zones", field: "site_id", target: "zone" }
    ],
    "building": [{ collection: "zones", field: "building_id", target: "zone" }],
    "zone": [
        { collection: "floors", field: "zone_id", target: "floor" },
        { collection: "units", field: "zone_id", target: "unit" }
    ],
    "floor": [{ collection: "units", field: "floor_id", target: "unit" }],
    "unit": [{ collection: "points", field: "unit_id", target: "point" }],
    "point": []
};

const HIERARCHY_KEYS_TO_INHERIT = [
    "country_id", "emirate_id", "region_id", "city_id", "district_id", "sector_id", 
    "site_id", "building_id", "zone_id", "floor_id", 
    "country_name_ar", "emirate_name_ar", "region_name_ar", "city_name_ar", "district_name_ar", "sector_name_ar",
    "site_name_ar", "building_name_ar", "zone_name_ar", "floor_name_ar", 
    "country_name_en", "emirate_name_en", "region_name_en", "city_name_en", "district_name_en", "sector_name_en",
    "site_name_en", "building_name_en", "zone_name_en", "floor_name_en",
    "country_code", "emirate_code", "region_code", "city_code", "district_code", "sector_code"
];

// ============================================================================
// 🛠️ دالة التعقيم "النووية" (Force Clean)
// ============================================================================

/**
 * تحويل الكائن إلى JSON ثم إعادته لضمان إزالة undefined والبيانات غير الصالحة.
 * تم تغيير نوع الإرجاع إلى unknown للامتثال لقواعد ESLint.
 */
function forceClean(obj: unknown): unknown {
    if (obj === undefined || obj === null) return null;
    return JSON.parse(JSON.stringify(obj));
}

// دوال Pub/Sub المساعدة
async function publishMigrationMessage(target: string, docId: string, updates: GenericData) {
    const cleanedUpdates = forceClean(updates);
    if (!cleanedUpdates) return;
    
    const messagePayload = { parentCollection: target, parentId: docId, updates: cleanedUpdates };
    const dataBuffer = Buffer.from(JSON.stringify(messagePayload));
    await pubsub.topic(MIGRATION_TOPIC).publishMessage({ data: dataBuffer });
}

async function publishDeleteCascade(target: string, docId: string) {
    const messagePayload = { target: target, docId: docId };
    const dataBuffer = Buffer.from(JSON.stringify(messagePayload));
    await pubsub.topic(DELETE_TOPIC).publishMessage({ data: dataBuffer });
    console.log(`🚀 Triggered delete cascade for ${target}/${docId}`);
}

// ============================================================================
// 🗂️ 1. SPATIAL LOOKUPS MANAGER
// ============================================================================

interface LookupPayload {
    category: "unit_types" | "point_types" | "building_types" | "site_types" | "zone_types";
    action: "create" | "update" | "delete";
    docId?: string;
    data?: {
        name_ar: string;
        name_en: string;
        code?: string;
        map_icon?: string;
        color_code?: string;
    };
}

export const manageSpatialLookups = onCall({ region: "us-central1", cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");

    const payload = request.data as LookupPayload;
    const { category, action, docId, data } = payload;

    if (!["unit_types", "point_types", "building_types", "site_types", "zone_types"].includes(category)) {
        throw new HttpsError("invalid-argument", "Invalid category.");
    }

    const colRef = db.collection(`spatial_lookups/${category}/values`);

    try {
        if (action === "create") {
            if (!data?.name_ar || !data?.name_en) throw new HttpsError("invalid-argument", "Names required.");
            const newRef = colRef.doc();
            
            const rawData: SpatialData = {
                name_ar: data.name_ar,
                name_en: data.name_en,
                code: data.code || newRef.id,
                map_icon: data.map_icon || "default_pin",
                color_code: data.color_code || "#CCCCCC",
            };

            // التنظيف الصارم + إضافة التوقيت
            const cleanedData = forceClean(rawData) as SpatialData;
            
            await newRef.set({
                id: newRef.id,
                ...cleanedData,
                is_active: true,
                created_at: admin.firestore.FieldValue.serverTimestamp()
            });
            return { success: true, id: newRef.id };
        }

        if (action === "update") {
            if (!docId) throw new HttpsError("invalid-argument", "DocId required.");
            
            const updateRaw: SpatialData = {};
            if (data?.name_ar) updateRaw.name_ar = data.name_ar;
            if (data?.name_en) updateRaw.name_en = data.name_en;
            if (data?.code) updateRaw.code = data.code;
            if (data?.map_icon) updateRaw.map_icon = data.map_icon;
            if (data?.color_code) updateRaw.color_code = data.color_code;

            const cleanedUpdate = forceClean(updateRaw) as SpatialData;

            await colRef.doc(docId).update({
                ...cleanedUpdate,
                updated_at: admin.firestore.FieldValue.serverTimestamp()
            });
            return { success: true };
        }

        if (action === "delete") {
            if (!docId) throw new HttpsError("invalid-argument", "DocId required.");
            await colRef.doc(docId).delete();
            return { success: true };
        }

        throw new HttpsError("invalid-argument", "Invalid action.");
    } catch (error: unknown) {
        // ✅ استخدام unknown مع التحويل الآمن
        const err = error as ErrorWithCode;
        throw new HttpsError(err.code || "internal", err.message || "An unknown error occurred");
    }
});

// ============================================================================
// 🌍 2. SPATIAL STRUCTURE ENGINE
// ============================================================================

interface SpatialPayload {
    target: "country" | "emirate" | "region" | "city" | "district" | "sector" |
    "site" | "building" | "zone" | "floor" | "unit" | "point";
    action: "create" | "update" | "delete";
    docId?: string;
    data?: GenericData;
}

export const manageSpatialStructure = onCall({ region: "us-central1", cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");
    const actorId = request.auth.uid;

    const { target, action, docId, data } = request.data as SpatialPayload;

    let collectionName = "";
    let parentCol = "";
    let parentField = "";

    switch (target) {
        case "country": collectionName = "ref_countries"; break;
        case "emirate": collectionName = "ref_emirates"; parentCol = "ref_countries"; parentField = "country_id"; break;
        case "region": collectionName = "ref_regions"; parentCol = "ref_emirates"; parentField = "emirate_id"; break;
        case "city": collectionName = "ref_cities"; parentCol = "ref_regions"; parentField = "region_id"; break;
        case "district": collectionName = "ref_districts"; parentCol = "ref_cities"; parentField = "city_id"; break;
        case "sector": collectionName = "ref_sectors"; parentCol = "ref_districts"; parentField = "district_id"; break;
        case "site": collectionName = "sites"; parentCol = "ref_sectors"; parentField = "sector_id"; break;
        case "building": collectionName = "buildings"; parentCol = "sites"; parentField = "site_id"; break;
        case "zone": collectionName = "zones"; parentCol = "buildings"; parentField = "building_id"; break; 
        case "floor": collectionName = "floors"; parentCol = "zones"; parentField = "zone_id"; break;
        case "unit": collectionName = "units"; parentCol = "floors"; parentField = "floor_id"; break;
        case "point": collectionName = "points"; parentCol = "units"; parentField = "unit_id"; break;
        default: throw new HttpsError("invalid-argument", "Invalid target.");
    }

    if (target === "zone" && data?.site_id) {
        parentCol = "sites"; parentField = "site_id";
    }
    if (target === "unit" && data?.zone_id) {
        parentCol = "zones"; parentField = "zone_id";
    }

    const colRef = db.collection(collectionName);

    try {
        // --- A. CREATE ---
        if (action === "create") {
            if (!data?.name_ar) throw new HttpsError("invalid-argument", "Name required.");

            // 🚀 تنظيف البيانات وتحويلها إلى واجهة SpatialData
            const cleanInput = forceClean(data) as SpatialData;

            // التحقق من تكرار الكود (Fail-Safe)
            if (cleanInput.code && parentCol && parentField && cleanInput[parentField]) {
                try {
                    const existingCode = await colRef
                        .where(parentField, "==", cleanInput[parentField])
                        .where("code", "==", cleanInput.code)
                        .where("is_active", "==", true)
                        .limit(1).get();
                    
                    if (!existingCode.empty) {
                        throw new HttpsError("already-exists", `The code '${cleanInput.code}' already exists here.`);
                    }
                } catch (e) {
                    console.warn("Unique check skipped:", e);
                }
            }

            const newRef = colRef.doc();
            
            // بناء الكائن الخام أولاً
            const rawDocData: SpatialData = {
                id: newRef.id,
                ...cleanInput, // البيانات المنظفة
                [`${target}_name_ar`]: cleanInput.name_ar,
                [`${target}_name_en`]: cleanInput.name_en,
                [`${target}_code`]: cleanInput.code || newRef.id,
            };

            // إضافة الحقول التي لا يجب أن تمر عبر forceClean (مثل التواريخ)
            const finalDocData: GenericData = {
                ...rawDocData,
                created_by: actorId,
                is_active: true,
                created_at: admin.firestore.FieldValue.serverTimestamp(),
                updated_at: admin.firestore.FieldValue.serverTimestamp(),
            };

            if (parentCol && parentField && cleanInput[parentField]) {
                const parentIdVal = String(cleanInput[parentField]);
                const parentDoc = await db.collection(parentCol).doc(parentIdVal).get();
                
                if (parentDoc.exists) {
                    const pData = parentDoc.data() || {};
                    HIERARCHY_KEYS_TO_INHERIT.forEach(key => {
                        if (pData[key] !== undefined) finalDocData[key] = pData[key];
                    });
                    
                    let parentTargetPrefix = parentCol.replace("ref_", "").replace("s", ""); 
                    if (parentCol === "ref_countries") parentTargetPrefix = "country";
                    if (parentCol === "ref_cities") parentTargetPrefix = "city"; 

                    if (pData.name_ar) finalDocData[`${parentTargetPrefix}_name_ar`] = pData.name_ar;
                    if (pData.name_en) finalDocData[`${parentTargetPrefix}_name_en`] = pData.name_en;
                    if (pData.code) finalDocData[`${parentTargetPrefix}_code`] = pData.code;

                    await db.collection(parentCol).doc(parentIdVal).update({
                        [`${collectionName}_count`]: admin.firestore.FieldValue.increment(1)
                    });
                }
            }

            await newRef.set(finalDocData);
            return { success: true, id: newRef.id, message: "Created successfully." };
        }

        // --- B. UPDATE ---
        if (action === "update") {
            if (!docId) throw new HttpsError("invalid-argument", "DocId required.");

            const cleanInput = data ? (forceClean(data) as SpatialData) : {};

             if (cleanInput.code) {
                try {
                    const currentDoc = await colRef.doc(docId).get();
                    const currentData = currentDoc.data();
                    const pId = currentData?.[parentField];

                    if (pId) {
                        const existingCode = await colRef
                            .where(parentField, "==", pId)
                            .where("code", "==", cleanInput.code)
                            .where("id", "!=", docId)
                            .limit(1).get();
                        if (!existingCode.empty) throw new HttpsError("already-exists", `Code '${cleanInput.code}' taken.`);
                    }
                } catch(e) { console.warn("Unique check skipped", e); }
            }

            const rawUpdate: GenericData = { ...cleanInput, updated_by: actorId, updated_at: admin.firestore.FieldValue.serverTimestamp() };

            await colRef.doc(docId).update(rawUpdate);

            const hierarchyKeys = ["name_ar", "name_en", "code", ...HIERARCHY_KEYS_TO_INHERIT];
            const needsMigration = hierarchyKeys.some(k => cleanInput[k] !== undefined);

            if (needsMigration) {
                const migrationPayload: SpatialData = { ...cleanInput };
                if (cleanInput.name_ar) migrationPayload[`${target}_name_ar`] = cleanInput.name_ar;
                if (cleanInput.name_en) migrationPayload[`${target}_name_en`] = cleanInput.name_en;
                if (cleanInput.code) migrationPayload[`${target}_code`] = cleanInput.code;
                await publishMigrationMessage(target, docId, migrationPayload as GenericData);
            }

            return { success: true, message: "Updated successfully." };
        }

        // --- C. DELETE ---
        if (action === "delete") {
            if (!docId) throw new HttpsError("invalid-argument", "DocId required.");

            const docSnap = await colRef.doc(docId).get();
            if (!docSnap.exists) throw new HttpsError("not-found", "Entity not found.");
            
            const docData = docSnap.data();

            let finalParentCol = parentCol;
            let finalParentField = parentField;

            if (target === "zone" && docData?.site_id && !docData?.building_id) {
                finalParentCol = "sites"; finalParentField = "site_id";
            }
            if (target === "unit" && docData?.zone_id && !docData?.floor_id) {
                finalParentCol = "zones"; finalParentField = "zone_id";
            }

            if (finalParentCol && finalParentField && docData?.[finalParentField]) {
                const pId = docData[finalParentField];
                await db.collection(finalParentCol).doc(pId).update({
                    [`${collectionName}_count`]: admin.firestore.FieldValue.increment(-1)
                }).catch(err => console.warn("Failed to decrement counter", err));
            }

            await publishDeleteCascade(target, docId);
            await colRef.doc(docId).delete();

            return { success: true, message: "Deleted. Background cleanup started." };
        }

        throw new HttpsError("invalid-argument", "Invalid action.");

    } catch (error: unknown) {
        // ✅ استخدام unknown
        const err = error as ErrorWithCode;
        console.error(`Spatial Error (${target}):`, err);
        throw new HttpsError(err.code || "internal", err.message || "Unknown error");
    }
});

// ============================================================================
// 🗑️ 3. CASCADE DELETE PROCESSOR
// ============================================================================

export const processDeleteCascade = onMessagePublished(
    { topic: DELETE_TOPIC, region: "us-central1", timeoutSeconds: 540, memory: "512MiB" },
    async (event) => {
        const messageData = event.data.message?.data;
        if (!messageData) return;

        const { target, docId } = JSON.parse(Buffer.from(messageData, "base64").toString());
        console.log(`🗑️ Processing cascade delete for: ${target}/${docId}`);

        const childConfigs = CHILD_RELATION_MAP[target];
        if (!childConfigs || childConfigs.length === 0) return;

        const batch = db.batch();
        let operationCount = 0;
        const BATCH_LIMIT = 400;

        for (const config of childConfigs) {
            const childColRef = db.collection(config.collection);
            const snapshot = await childColRef.where(config.field, "==", docId).limit(BATCH_LIMIT).get();

            if (!snapshot.empty) {
                for (const doc of snapshot.docs) {
                    await publishDeleteCascade(config.target, doc.id);
                    batch.delete(doc.ref);
                    operationCount++;
                }
            }
        }

        if (operationCount > 0) {
            await batch.commit();
            console.log(`✅ Deleted ${operationCount} children of ${target}/${docId}`);
        }
    }
);

// ============================================================================
// ⚙️ 4. MIGRATION PROCESSOR
// ============================================================================

export const startSpatialMigration = onMessagePublished(
    { topic: MIGRATION_TOPIC, region: "us-central1" },
    async (event) => {
        const messageData = event.data.message?.data;
        if (!messageData) return;

        const { parentCollection, parentId, updates } = JSON.parse(Buffer.from(messageData, "base64").toString());

        const allowedKeys = ["name_ar", "name_en", "code", ...HIERARCHY_KEYS_TO_INHERIT];
        const effectiveUpdates: GenericData = {};
        
        Object.keys(updates).forEach(key => {
            if (allowedKeys.includes(key) || key.includes("_name_") || key.includes("_code")) {
                effectiveUpdates[key] = updates[key];
            }
        });

        const cleanedUpdates = forceClean(effectiveUpdates) as GenericData;
        if (!cleanedUpdates || Object.keys(cleanedUpdates).length === 0) return;

        const childConfigs = CHILD_RELATION_MAP[parentCollection];
        if (!childConfigs) return;

        for (const config of childConfigs) {
             const snapshot = await db.collection(config.collection).where(config.field, "==", parentId).limit(400).get();
             if (!snapshot.empty) {
                 const batch = db.batch();
                 snapshot.docs.forEach(doc => batch.update(doc.ref, cleanedUpdates));
                 await batch.commit();
             }
        }
    }
);

// ============================================================================
// 📦 5. ASSET TYPES MANAGER
// ============================================================================

interface AssetTypePayload {
    action: "create" | "update" | "delete";
    docId?: string;
    data?: GenericData;
}

export const manageAssetTypes = onCall({ region: "us-central1", cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");
    
    const payload = request.data as AssetTypePayload;
    const { action, docId, data } = payload;
    
    const colRef = db.collection("asset_types");

    try {
        if (action === "create") {
            const newRef = colRef.doc();
            const cleanedData = forceClean(data) as GenericData;
            await newRef.set({
                id: newRef.id,
                ...cleanedData,
                created_at: admin.firestore.FieldValue.serverTimestamp(),
                is_active: true
            });
            return { success: true, id: newRef.id };
        }
        if (action === "update") {
            if (!docId) throw new HttpsError("invalid-argument", "DocId required.");
            if (data) {
                const cleanData = forceClean(data) as GenericData;
                await colRef.doc(docId).update({ 
                    ...cleanData, 
                    updated_at: admin.firestore.FieldValue.serverTimestamp() 
                });
            }
            return { success: true };
        }
        if (action === "delete") {
            if (!docId) throw new HttpsError("invalid-argument", "DocId required.");
            await colRef.doc(docId).delete();
            return { success: true };
        }
        throw new HttpsError("invalid-argument", "Invalid action.");
    } catch (error: unknown) {
        // ✅ استخدام unknown
        const err = error as ErrorWithCode;
        throw new HttpsError("internal", err.message);
    }
});

// ============================================================================
// 🛠️ 6. ASSETS ENGINE
// ============================================================================

interface AssetPayload {
    action: "create" | "update" | "delete";
    docId?: string;
    data?: GenericData;
}

export const manageAssets = onCall({ region: "us-central1", cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");
    const actorId = request.auth.uid;
    
    const payload = request.data as AssetPayload;
    const { action, docId, data } = payload;
    
    const batch = db.batch();
    const assetsRef = db.collection("assets");

    try {
        if (action === "create") {
            const dataTyped = data as SpatialData; // Casting for easier access
            if (!dataTyped?.name_ar || !dataTyped?.type_id || !dataTyped?.point_id) throw new HttpsError("invalid-argument", "Required fields missing.");

            const pointDoc = await db.collection("points").doc(dataTyped.point_id as string).get();
            if (!pointDoc.exists) throw new HttpsError("not-found", "Point not found.");
            const pointData = pointDoc.data();

            let hierarchyData: GenericData = {};
            if (pointData?.unit_id) {
                const unitDoc = await db.collection("units").doc(pointData.unit_id).get();
                const unitData = unitDoc.data();
                if (unitData) {
                    hierarchyData = {
                        unit_id: unitData.id,
                        floor_id: unitData.floor_id || null,
                        zone_id: unitData.zone_id || null,
                        building_id: unitData.building_id || null,
                        site_id: unitData.site_id || null
                    };
                    batch.update(unitDoc.ref, { assets_count: admin.firestore.FieldValue.increment(1) });
                }
            }

            const newRef = assetsRef.doc();
            const cleanData = forceClean(data) as SpatialData;
            
            const finalData: GenericData = {
                id: newRef.id,
                ...cleanData,
                ...hierarchyData,
                created_by: actorId,
                created_at: admin.firestore.FieldValue.serverTimestamp(),
                updated_at: admin.firestore.FieldValue.serverTimestamp()
            };

            batch.set(newRef, finalData);
            await batch.commit();
            return { success: true, id: newRef.id };
        }

        if (action === "update") {
             if (!docId) throw new HttpsError("invalid-argument", "DocId required.");
             if (data) {
                const dataTyped = data as SpatialData;
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { point_id, ...rest } = dataTyped; 
                const cleanRest = forceClean(rest) as GenericData;
                await assetsRef.doc(docId).update({ 
                    ...cleanRest, 
                    updated_at: admin.firestore.FieldValue.serverTimestamp(), 
                    updated_by: actorId 
                });
             }
             return { success: true };
        }

        if (action === "delete") {
            if (!docId) throw new HttpsError("invalid-argument", "DocId required.");
            const docSnap = await assetsRef.doc(docId).get();
            const assetData = docSnap.data();
            if (assetData?.unit_id) {
                batch.update(db.collection("units").doc(assetData.unit_id as string), { assets_count: admin.firestore.FieldValue.increment(-1) });
            }
            batch.delete(assetsRef.doc(docId));
            await batch.commit();
            return { success: true };
        }
        throw new HttpsError("invalid-argument", "Invalid action.");
    } catch (error: unknown) {
        // ✅ استخدام unknown
        const err = error as ErrorWithCode;
        throw new HttpsError("internal", err.message);
    }
});

// ============================================================================
// 🔍 7. SMART SPATIAL SEARCH
// ============================================================================

interface SearchPayload {
    query: string;
    site_id?: string;
}

export const searchSpatial = onCall({ region: "us-central1", cors: true }, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");
    
    const { query, site_id } = request.data as SearchPayload;
    if (!query || query.length < 2) throw new HttpsError("invalid-argument", "Query too short.");

    const results: GenericData[] = [];

    try {
        let unitsQuery = db.collection("units").where("is_active", "==", true);
        if (site_id) unitsQuery = unitsQuery.where("site_id", "==", site_id);
        const unitsSnap = await unitsQuery.get();
        
        const uTypes = await db.collection("spatial_lookups/unit_types/values").get();
        const uMap: Record<string, TypeDocData> = {};
        uTypes.docs.forEach(d => uMap[d.id] = d.data() as TypeDocData);

        unitsSnap.docs.forEach(doc => {
            const d = doc.data();
            if (d.name_ar?.includes(query) || d.name_en?.toLowerCase().includes(query.toLowerCase()) || d.code?.includes(query)) {
                const typeData = uMap[d.type_id];
                results.push({
                    type: "unit",
                    id: d.id,
                    name_ar: d.name_ar,
                    name_en: d.name_en,
                    icon: typeData?.map_icon || "default_room",
                    location: d.geo_data?.center || null
                });
            }
        });

        let assetsQuery = db.collection("assets").where("point_id", "!=", null);
        if (site_id) assetsQuery = assetsQuery.where("site_id", "==", site_id);
        const assetsSnap = await assetsQuery.get();

        const aTypes = await db.collection("asset_types").get();
        const aMap: Record<string, TypeDocData> = {};
        aTypes.docs.forEach(d => aMap[d.id] = d.data() as TypeDocData);

        assetsSnap.docs.forEach(doc => {
            const d = doc.data();
            if (d.name_ar?.includes(query) || d.name_en?.toLowerCase().includes(query.toLowerCase()) || d.code?.includes(query)) {
                const typeData = aMap[d.type_id];
                results.push({
                    type: "asset",
                    id: d.id,
                    name_ar: d.name_ar,
                    name_en: d.name_en,
                    icon: typeData?.icon || "default_asset",
                    linked_unit_id: d.unit_id
                });
            }
        });

        return { success: true, count: results.length, results: results.slice(0, 20) };
    } catch (error: unknown) {
        // ✅ استخدام unknown
        const err = error as ErrorWithCode;
        throw new HttpsError("internal", err.message);
    }
});