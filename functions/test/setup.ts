/**
 * ============================================================================
 * Test Setup & Configuration
 * ============================================================================
 *
 * This file initializes the testing environment for Firebase Cloud Functions
 * - Sets up firebase-functions-test for offline testing
 * - Configures Firestore mocks
 * - Provides reusable test utilities and fixtures
 *
 * @module test/setup
 */

import * as admin from 'firebase-admin';
import functionsTest from 'firebase-functions-test';

// Set Firestore Emulator host to use in-memory database for testing
// This prevents tests from connecting to real Firestore
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_FIRESTORE_EMULATOR_ADDRESS = 'localhost:8080';

// Initialize firebase-functions-test in offline mode
// This must be done before initializing admin
export const test = functionsTest();

// Initialize Firebase Admin for testing
// Using a unique app name to avoid conflicts
const testApp = admin.initializeApp({
  projectId: 'test-project-id',
}, 'test-app');

export const db = admin.firestore(testApp);

// Configure Firestore for faster testing
db.settings({
  host: 'localhost:8080',
  ssl: false,
  ignoreUndefinedProperties: true,
});

/**
 * ============================================================================
 * Test Fixtures & Mock Data
 * ============================================================================
 */

/**
 * Mock user data for testing
 */
export const mockUsers = {
  superAdmin: {
    uid: 'super-admin-user-id',
    data: {
      is_super_admin: true,
      job_id: 1,
      is_allowed: true,
      name_ar: 'مسؤول عام',
      name_en: 'Super Admin',
    },
  },
  regularUser: {
    uid: 'regular-user-id',
    data: {
      is_super_admin: false,
      job_id: 2,
      is_allowed: true,
      name_ar: 'مستخدم عادي',
      name_en: 'Regular User',
    },
  },
  userWithoutJob: {
    uid: 'no-job-user-id',
    data: {
      is_super_admin: false,
      job_id: null,
      is_allowed: true,
      name_ar: 'مستخدم بدون وظيفة',
      name_en: 'User Without Job',
    },
  },
  notAllowedUser: {
    uid: 'not-allowed-user-id',
    data: {
      is_super_admin: false,
      job_id: 3,
      is_allowed: false,
      name_ar: 'مستخدم محظور',
      name_en: 'Not Allowed User',
    },
  },
};

/**
 * Mock permission IDs for testing
 */
export const mockPermissions = {
  service: 's:1',
  subService: 'ss:10',
  subSubService: 'sss:100',
  invalidFormat: 'invalid:123',
  serviceOnly: 's:5',
};

/**
 * Mock job permissions data
 */
export const mockJobPermissions = {
  job2Service1: {
    job_id: 2,
    service_id: 1,
    sub_service_id: null,
    sub_sub_service_id: null,
  },
  job2SubService10: {
    job_id: 2,
    service_id: null,
    sub_service_id: 10,
    sub_sub_service_id: null,
  },
  job3Service5: {
    job_id: 3,
    service_id: 5,
    sub_service_id: null,
    sub_sub_service_id: null,
  },
};

/**
 * Mock user exception permissions
 */
export const mockUserPermissions = {
  allowException: {
    user_id: 'regular-user-id',
    service_id: 2,
    sub_service_id: null,
    sub_sub_service_id: null,
    is_allowed: true,
    is_manual_exception: true,
  },
  denyException: {
    user_id: 'regular-user-id',
    service_id: 1,
    sub_service_id: null,
    sub_sub_service_id: null,
    is_allowed: false,
    is_manual_exception: true,
  },
};

/**
 * ============================================================================
 * Test Utilities
 * ============================================================================
 */

/**
 * Creates a wrapped callable function request
 */
export function createCallableRequest<T>(
  data: T,
  auth?: { uid: string; token?: any }
) {
  return {
    data,
    auth: auth || null,
    rawRequest: {} as any,
  };
}

/**
 * Cleans up Firestore collections after tests
 */
export async function clearFirestoreCollections(collectionNames: string[]) {
  for (const collectionName of collectionNames) {
    const snapshot = await db.collection(collectionName).get();
    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();
  }
}

/**
 * Creates mock Firestore documents for testing
 */
export async function seedFirestore(
  collectionName: string,
  documents: Array<{ id?: string; data: any }>
) {
  const batch = db.batch();
  documents.forEach((doc) => {
    const ref = doc.id
      ? db.collection(collectionName).doc(doc.id)
      : db.collection(collectionName).doc();
    batch.set(ref, doc.data);
  });
  await batch.commit();
}

/**
 * Cleanup function to be called after all tests
 */
export function cleanup() {
  test.cleanup();
}
