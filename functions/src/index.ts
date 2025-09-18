import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

// 1. الدالة الأولى: checkPermission
interface CheckPermissionData {
  permission_id: string;
}

export const checkPermission = functions.https.onCall(
  { region: "us-central1" },
  async (request: functions.https.CallableRequest<CheckPermissionData>) => {
    if (!request.auth) {
      throw new functions.https.HttpsError("unauthenticated", "The function must be called while authenticated.");
    }

    const userId = request.auth.uid;
    const { permission_id: permissionId } = request.data;

    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) {
      throw new functions.https.HttpsError("not-found", "User not found.");
    }
    const isSuperAdmin = userDoc.data()?.is_super_admin;
    if (isSuperAdmin === true) {
      return { isAllowed: true };
    }

    const jobId = userDoc.data()?.job_id;
    let isAllowedByJob = false;
    if (jobId) {
      const [type, id] = permissionId.split(":");
      const serviceId = type === "s" ? parseInt(id) : null;
      const subServiceId = type === "ss" ? parseInt(id) : null;
      const subSubServiceId = type === "sss" ? parseInt(id) : null;

      const jobPermissionQuery = await db.collection("job_permissions")
        .where("job_id", "==", jobId)
        .where("service_id", "==", serviceId)
        .where("sub_service_id", "==", subServiceId)
        .where("sub_sub_service_id", "==", subSubServiceId)
        .get();
      isAllowedByJob = !jobPermissionQuery.empty;
    }

    const [type, id] = permissionId.split(":");
    const serviceId = type === "s" ? parseInt(id) : null;
    const subServiceId = type === "ss" ? parseInt(id) : null;
    const subSubServiceId = type === "sss" ? parseInt(id) : null;

    const userPermissionQuery = await db.collection("user_permissions")
      .where("user_id", "==", userId)
      .where("service_id", "==", serviceId)
      .where("sub_service_id", "==", subServiceId)
      .where("sub_sub_service_id", "==", subSubServiceId)
      .get();

    let isAllowedByException = isAllowedByJob;
    if (!userPermissionQuery.empty) {
      const exceptionDoc = userPermissionQuery.docs[0];
      isAllowedByException = exceptionDoc.data().is_allowed;
    }

    return { isAllowed: isAllowedByException };
  });

// 2. الدالة الثانية: getUserEffectivePermissions
export const getUserEffectivePermissions = functions.https.onCall(
  { region: "us-central1" },
  async (request: functions.https.CallableRequest<unknown>) => {
    if (!request.auth) {
      throw new functions.https.HttpsError("unauthenticated", "The function must be called while authenticated.");
    }
    const userId = request.auth.uid;

    const effectivePermissions: { [key: string]: boolean } = { general_access: true };

    const userDoc = await db.collection("users").doc(userId).get();
    const isSuperAdmin = userDoc.data()?.is_super_admin;
    const jobId = userDoc.data()?.job_id;

    if (isSuperAdmin === true) {
      const services = await db.collection("services").get();
      const subServices = await db.collection("sub_services").get();
      const subSubServices = await db.collection("sub_sub_services").get();

      services.forEach(doc => effectivePermissions[`s:${doc.id}`] = true);
      subServices.forEach(doc => effectivePermissions[`ss:${doc.id}`] = true);
      subSubServices.forEach(doc => effectivePermissions[`sss:${doc.id}`] = true);

      return effectivePermissions;
    }

    if (jobId) {
      const jobPermissions = await db.collection("job_permissions").where("job_id", "==", jobId).get();
      jobPermissions.forEach(doc => {
        const permData = doc.data();
        let pId: string | null = null;
        if (permData.service_id !== null) pId = `s:${permData.service_id}`;
        else if (permData.sub_service_id !== null) pId = `ss:${permData.sub_service_id}`;
        else if (permData.sub_sub_service_id !== null) pId = `sss:${permData.sub_sub_service_id}`;
        if (pId) effectivePermissions[pId] = true;
      });
    }

    const userPermissions = await db.collection("user_permissions").where("user_id", "==", userId).get();
    userPermissions.forEach(doc => {
      const permData = doc.data();
      let pId: string | null = null;
      if (permData.service_id !== null) pId = `s:${permData.service_id}`;
      else if (permData.sub_service_id !== null) pId = `ss:${permData.sub_service_id}`;
      else if (permData.sub_sub_service_id !== null) pId = `sss:${permData.sub_sub_service_id}`;
      if (pId) effectivePermissions[pId] = permData.is_allowed;
    });

    return effectivePermissions;
  });

// 3. الدالة الثالثة: manageUserPermissions
interface PermissionItem {
  service_id?: number | null;
  sub_service_id?: number | null;
  sub_sub_service_id?: number | null;
  is_allowed: boolean;
}

interface ManageUserPermissionsData {
  p_user_id: string;
  p_permissions_to_process: PermissionItem[];
}

export const manageUserPermissions = functions.https.onCall(
  { region: "us-central1" },
  async (request: functions.https.CallableRequest<ManageUserPermissionsData>) => {
    if (!request.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Function requires authentication.");
    }
    const changedByUserId = request.auth.uid;
    const { p_user_id: targetUserId, p_permissions_to_process: permissionsToProcess } = request.data;

    const userDoc = await db.collection("users").doc(targetUserId).get();
    const jobId = userDoc.data()?.job_id;
    const batch = db.batch();

    for (const rec of permissionsToProcess) {
      const { service_id = null, sub_service_id = null, sub_sub_service_id = null, is_allowed } = rec;

      let permFoundInJob = false;
      if (jobId) {
        const jobPermissionQuery = await db.collection("job_permissions")
          .where("job_id", "==", jobId)
          .where("service_id", "==", service_id)
          .where("sub_service_id", "==", sub_service_id)
          .where("sub_sub_service_id", "==", sub_sub_service_id)
          .get();
        permFoundInJob = !jobPermissionQuery.empty;
      }

      const userPermissionQuery = await db.collection("user_permissions")
        .where("user_id", "==", targetUserId)
        .where("service_id", "==", service_id)
        .where("sub_service_id", "==", sub_service_id)
        .where("sub_sub_service_id", "==", sub_sub_service_id)
        .get();

      if (is_allowed === true) {
        if (permFoundInJob) {
          userPermissionQuery.forEach(doc => batch.delete(doc.ref));
        } else {
          if (userPermissionQuery.empty) {
            const docRef = db.collection("user_permissions").doc();
            batch.set(docRef, { user_id: targetUserId, service_id, sub_service_id, sub_sub_service_id, is_allowed: true, is_manual_exception: true, created_by: changedByUserId });
          } else {
            userPermissionQuery.forEach(doc => {
              batch.update(doc.ref, { is_allowed: true, created_by: changedByUserId });
            });
          }
        }
      } else {
        if (permFoundInJob) {
          if (userPermissionQuery.empty) {
            const docRef = db.collection("user_permissions").doc();
            batch.set(docRef, { user_id: targetUserId, service_id, sub_service_id, sub_sub_service_id, is_allowed: false, is_manual_exception: true, created_by: changedByUserId });
          } else {
            userPermissionQuery.forEach(doc => {
              batch.update(doc.ref, { is_allowed: false, created_by: changedByUserId });
            });
          }
        } else {
          userPermissionQuery.forEach(doc => batch.delete(doc.ref));
        }
      }
    }
    await batch.commit();
    return { success: true };
  });

// 4. الدالة الرابعة: manageJobPermissions
interface ManageJobPermissionsData {
  p_job_id: number;
  p_permissions_to_add: string[];
  p_permissions_to_remove: string[];
}

export const manageJobPermissions = functions.https.onCall(
  { region: "us-central1" },
  async (request: functions.https.CallableRequest<ManageJobPermissionsData>) => {
    if (!request.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Function requires authentication.");
    }
    const changedByUserId = request.auth.uid;
    const { p_job_id: jobId, p_permissions_to_add: permissionsToAdd, p_permissions_to_remove: permissionsToRemove } = request.data;

    const batch = db.batch();

    for (const perm of permissionsToAdd) {
      let sId: number | null = null;
      let ssId: number | null = null;
      let sssId: number | null = null;
      if (perm.startsWith("s:")) sId = parseInt(perm.substring(2));
      else if (perm.startsWith("ss:")) ssId = parseInt(perm.substring(3));
      else if (perm.startsWith("sss:")) sssId = parseInt(perm.substring(4));

      if (sId !== null || ssId !== null || sssId !== null) {
        const jobPermissionQuery = await db.collection("job_permissions")
          .where("job_id", "==", jobId)
          .where("service_id", "==", sId)
          .where("sub_service_id", "==", ssId)
          .where("sub_sub_service_id", "==", sssId)
          .get();

        if (jobPermissionQuery.empty) {
          const docRef = db.collection("job_permissions").doc();
          batch.set(docRef, { job_id: jobId, service_id: sId, sub_service_id: ssId, sub_sub_service_id: sssId, created_by: changedByUserId });
        }
      }
    }

    for (const perm of permissionsToRemove) {
      let sId: number | null = null;
      let ssId: number | null = null;
      let sssId: number | null = null;
      if (perm.startsWith("s:")) sId = parseInt(perm.substring(2));
      else if (perm.startsWith("ss:")) ssId = parseInt(perm.substring(3));
      else if (perm.startsWith("sss:")) sssId = parseInt(perm.substring(4));

      if (sId !== null || ssId !== null || sssId !== null) {
        const query = await db.collection("job_permissions")
          .where("job_id", "==", jobId)
          .where("service_id", "==", sId)
          .where("sub_service_id", "==", ssId)
          .where("sub_sub_service_id", "==", sssId)
          .get();
        query.forEach(doc => batch.delete(doc.ref));
      }
    }

    await batch.commit();
    return { success: true };
  });