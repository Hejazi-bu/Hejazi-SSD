/**
 * ============================================================================
 * TEST SUITE: manageUserPermissions Cloud Function
 * ============================================================================
 *
 * Purpose: Tests the manageUserPermissions function which manages user-specific
 *          permission exceptions that override job-level permissions.
 *
 * Function Behavior (Complex Logic):
 * 1. If is_allowed=true and permission exists in job → DELETE exception (use job default)
 * 2. If is_allowed=true and permission NOT in job → CREATE/UPDATE exception with is_allowed=true
 * 3. If is_allowed=false and permission exists in job → CREATE/UPDATE exception with is_allowed=false
 * 4. If is_allowed=false and permission NOT in job → DELETE exception (no need to deny what doesn't exist)
 *
 * @module test/manageUserPermissions
 * ============================================================================
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import {
  test,
  db,
  createCallableRequest,
  clearFirestoreCollections,
  seedFirestore,
} from './setup';

// Import the function to test
import * as myFunctions from '../src/index';

describe('═══════════════════════════════════════════════════════════', () => {
  describe('manageUserPermissions() - User Exception Management Function', () => {
    describe('═══════════════════════════════════════════════════════════', () => {
      // -----------------------------------------------------------------------
      // Setup & Teardown
      // -----------------------------------------------------------------------

      let manageUserPermissions: any;

      beforeEach(async () => {
        // Clear all Firestore data before each test
        await clearFirestoreCollections([
          'users',
          'job_permissions',
          'user_permissions',
        ]);

        // Wrap the function for testing
        manageUserPermissions = test.wrap(myFunctions.manageUserPermissions);
      });

      afterEach(() => {
        sinon.restore();
      });

      // =======================================================================
      // 📌 SECTION 1: Authentication Tests
      // =======================================================================
      describe('🔐 Authentication & Authorization', () => {
        it('should reject unauthenticated requests', async () => {
          const request = createCallableRequest({
            p_user_id: 'target-user-id',
            p_permissions_to_process: [],
          });

          try {
            await manageUserPermissions(request);
            expect.fail('Should have thrown an error');
          } catch (error: any) {
            expect(error.code).to.equal('unauthenticated');
            expect(error.message).to.include('authentication');
          }
        });

        it('should succeed for authenticated admin users', async () => {
          await seedFirestore('users', [
            {
              id: 'target-user-id',
              data: { job_id: 2, is_allowed: true },
            },
          ]);

          const request = createCallableRequest(
            {
              p_user_id: 'target-user-id',
              p_permissions_to_process: [],
            },
            { uid: 'admin-user-id' }
          );

          const result = await manageUserPermissions(request);
          expect(result).to.deep.equal({ success: true });
        });

        it('should track who made the changes (created_by field)', async () => {
          await seedFirestore('users', [
            {
              id: 'target-user-id',
              data: { job_id: null, is_allowed: true },
            },
          ]);

          const request = createCallableRequest(
            {
              p_user_id: 'target-user-id',
              p_permissions_to_process: [
                {
                  service_id: 1,
                  sub_service_id: null,
                  sub_sub_service_id: null,
                  is_allowed: true,
                },
              ],
            },
            { uid: 'admin-user-id' }
          );

          await manageUserPermissions(request);

          // Verify created_by field
          const snapshot = await db.collection('user_permissions').get();
          expect(snapshot.docs[0].data().created_by).to.equal('admin-user-id');
        });
      });

      // =======================================================================
      // 📌 SECTION 2: Logic Case 1 - Allow Permission in Job
      // =======================================================================
      describe('✅ Case 1: is_allowed=true + Permission EXISTS in Job', () => {
        beforeEach(async () => {
          // Setup: User with job that has s:1 permission
          await seedFirestore('users', [
            {
              id: 'target-user-id',
              data: { job_id: 2, is_allowed: true },
            },
          ]);

          await seedFirestore('job_permissions', [
            {
              data: {
                job_id: 2,
                service_id: 1,
                sub_service_id: null,
                sub_sub_service_id: null,
              },
            },
          ]);
        });

        it('should DELETE existing exception when allowing job permission', async () => {
          // Pre-existing exception that denies s:1
          await seedFirestore('user_permissions', [
            {
              id: 'exception-to-delete',
              data: {
                user_id: 'target-user-id',
                service_id: 1,
                sub_service_id: null,
                sub_sub_service_id: null,
                is_allowed: false,
                is_manual_exception: true,
              },
            },
          ]);

          // Now allow s:1 (which job already has)
          const request = createCallableRequest(
            {
              p_user_id: 'target-user-id',
              p_permissions_to_process: [
                {
                  service_id: 1,
                  sub_service_id: null,
                  sub_sub_service_id: null,
                  is_allowed: true,
                },
              ],
            },
            { uid: 'admin-user-id' }
          );

          await manageUserPermissions(request);

          // Exception should be deleted
          const snapshot = await db.collection('user_permissions').get();
          expect(snapshot.empty).to.be.true;
        });

        it('should do nothing if no exception exists and allowing job permission', async () => {
          // No exceptions exist, allowing s:1 (which job has)
          const request = createCallableRequest(
            {
              p_user_id: 'target-user-id',
              p_permissions_to_process: [
                {
                  service_id: 1,
                  sub_service_id: null,
                  sub_sub_service_id: null,
                  is_allowed: true,
                },
              ],
            },
            { uid: 'admin-user-id' }
          );

          await manageUserPermissions(request);

          // No exceptions should be created
          const snapshot = await db.collection('user_permissions').get();
          expect(snapshot.empty).to.be.true;
        });
      });

      // =======================================================================
      // 📌 SECTION 3: Logic Case 2 - Allow Permission NOT in Job
      // =======================================================================
      describe('➕ Case 2: is_allowed=true + Permission NOT in Job', () => {
        beforeEach(async () => {
          // Setup: User with job that does NOT have s:5
          await seedFirestore('users', [
            {
              id: 'target-user-id',
              data: { job_id: 2, is_allowed: true },
            },
          ]);

          await seedFirestore('job_permissions', [
            {
              data: {
                job_id: 2,
                service_id: 1, // Job has s:1, not s:5
                sub_service_id: null,
                sub_sub_service_id: null,
              },
            },
          ]);
        });

        it('should CREATE new exception when allowing permission not in job', async () => {
          const request = createCallableRequest(
            {
              p_user_id: 'target-user-id',
              p_permissions_to_process: [
                {
                  service_id: 5,
                  sub_service_id: null,
                  sub_sub_service_id: null,
                  is_allowed: true,
                },
              ],
            },
            { uid: 'admin-user-id' }
          );

          await manageUserPermissions(request);

          // Exception should be created
          const snapshot = await db.collection('user_permissions').get();
          expect(snapshot.size).to.equal(1);

          const exception = snapshot.docs[0].data();
          expect(exception).to.include({
            user_id: 'target-user-id',
            service_id: 5,
            is_allowed: true,
            is_manual_exception: true,
            created_by: 'admin-user-id',
          });
        });

        it('should UPDATE existing exception to is_allowed=true', async () => {
          // Pre-existing exception that denies s:5
          await seedFirestore('user_permissions', [
            {
              id: 'existing-exception',
              data: {
                user_id: 'target-user-id',
                service_id: 5,
                sub_service_id: null,
                sub_sub_service_id: null,
                is_allowed: false,
                is_manual_exception: true,
              },
            },
          ]);

          // Now allow s:5
          const request = createCallableRequest(
            {
              p_user_id: 'target-user-id',
              p_permissions_to_process: [
                {
                  service_id: 5,
                  sub_service_id: null,
                  sub_sub_service_id: null,
                  is_allowed: true,
                },
              ],
            },
            { uid: 'admin-user-id' }
          );

          await manageUserPermissions(request);

          // Exception should be updated
          const snapshot = await db.collection('user_permissions').get();
          expect(snapshot.size).to.equal(1);

          const exception = snapshot.docs[0].data();
          expect(exception.is_allowed).to.be.true;
          expect(exception.created_by).to.equal('admin-user-id');
        });
      });

      // =======================================================================
      // 📌 SECTION 4: Logic Case 3 - Deny Permission in Job
      // =======================================================================
      describe('🚫 Case 3: is_allowed=false + Permission EXISTS in Job', () => {
        beforeEach(async () => {
          // Setup: User with job that has s:1
          await seedFirestore('users', [
            {
              id: 'target-user-id',
              data: { job_id: 2, is_allowed: true },
            },
          ]);

          await seedFirestore('job_permissions', [
            {
              data: {
                job_id: 2,
                service_id: 1,
                sub_service_id: null,
                sub_sub_service_id: null,
              },
            },
          ]);
        });

        it('should CREATE denial exception when denying job permission', async () => {
          const request = createCallableRequest(
            {
              p_user_id: 'target-user-id',
              p_permissions_to_process: [
                {
                  service_id: 1,
                  sub_service_id: null,
                  sub_sub_service_id: null,
                  is_allowed: false,
                },
              ],
            },
            { uid: 'admin-user-id' }
          );

          await manageUserPermissions(request);

          // Exception should be created with is_allowed=false
          const snapshot = await db.collection('user_permissions').get();
          expect(snapshot.size).to.equal(1);

          const exception = snapshot.docs[0].data();
          expect(exception).to.include({
            user_id: 'target-user-id',
            service_id: 1,
            is_allowed: false,
            is_manual_exception: true,
          });
        });

        it('should UPDATE existing allow exception to denial', async () => {
          // Pre-existing exception that allows s:1
          await seedFirestore('user_permissions', [
            {
              id: 'existing-exception',
              data: {
                user_id: 'target-user-id',
                service_id: 1,
                sub_service_id: null,
                sub_sub_service_id: null,
                is_allowed: true,
                is_manual_exception: true,
              },
            },
          ]);

          // Now deny s:1
          const request = createCallableRequest(
            {
              p_user_id: 'target-user-id',
              p_permissions_to_process: [
                {
                  service_id: 1,
                  sub_service_id: null,
                  sub_sub_service_id: null,
                  is_allowed: false,
                },
              ],
            },
            { uid: 'admin-user-id' }
          );

          await manageUserPermissions(request);

          // Exception should be updated to deny
          const snapshot = await db.collection('user_permissions').get();
          expect(snapshot.size).to.equal(1);

          const exception = snapshot.docs[0].data();
          expect(exception.is_allowed).to.be.false;
        });
      });

      // =======================================================================
      // 📌 SECTION 5: Logic Case 4 - Deny Permission NOT in Job
      // =======================================================================
      describe('➖ Case 4: is_allowed=false + Permission NOT in Job', () => {
        beforeEach(async () => {
          // Setup: User with job that does NOT have s:5
          await seedFirestore('users', [
            {
              id: 'target-user-id',
              data: { job_id: 2, is_allowed: true },
            },
          ]);

          await seedFirestore('job_permissions', [
            {
              data: {
                job_id: 2,
                service_id: 1, // Job has s:1, not s:5
                sub_service_id: null,
                sub_sub_service_id: null,
              },
            },
          ]);
        });

        it('should DELETE exception when denying permission not in job', async () => {
          // Pre-existing exception that allows s:5
          await seedFirestore('user_permissions', [
            {
              id: 'exception-to-delete',
              data: {
                user_id: 'target-user-id',
                service_id: 5,
                sub_service_id: null,
                sub_sub_service_id: null,
                is_allowed: true,
                is_manual_exception: true,
              },
            },
          ]);

          // Now deny s:5 (which job doesn't have anyway)
          const request = createCallableRequest(
            {
              p_user_id: 'target-user-id',
              p_permissions_to_process: [
                {
                  service_id: 5,
                  sub_service_id: null,
                  sub_sub_service_id: null,
                  is_allowed: false,
                },
              ],
            },
            { uid: 'admin-user-id' }
          );

          await manageUserPermissions(request);

          // Exception should be deleted (no need to deny what doesn't exist)
          const snapshot = await db.collection('user_permissions').get();
          expect(snapshot.empty).to.be.true;
        });

        it('should do nothing if no exception exists when denying non-job permission', async () => {
          const request = createCallableRequest(
            {
              p_user_id: 'target-user-id',
              p_permissions_to_process: [
                {
                  service_id: 5,
                  sub_service_id: null,
                  sub_sub_service_id: null,
                  is_allowed: false,
                },
              ],
            },
            { uid: 'admin-user-id' }
          );

          await manageUserPermissions(request);

          // No exceptions should exist
          const snapshot = await db.collection('user_permissions').get();
          expect(snapshot.empty).to.be.true;
        });
      });

      // =======================================================================
      // 📌 SECTION 6: Batch Operations
      // =======================================================================
      describe('📦 Batch Processing', () => {
        beforeEach(async () => {
          await seedFirestore('users', [
            {
              id: 'target-user-id',
              data: { job_id: 2, is_allowed: true },
            },
          ]);

          // Job has s:1 and ss:10
          await seedFirestore('job_permissions', [
            {
              data: {
                job_id: 2,
                service_id: 1,
                sub_service_id: null,
                sub_sub_service_id: null,
              },
            },
            {
              data: {
                job_id: 2,
                service_id: null,
                sub_service_id: 10,
                sub_sub_service_id: null,
              },
            },
          ]);
        });

        it('should process multiple permissions in a single batch', async () => {
          const request = createCallableRequest(
            {
              p_user_id: 'target-user-id',
              p_permissions_to_process: [
                {
                  service_id: 2,
                  sub_service_id: null,
                  sub_sub_service_id: null,
                  is_allowed: true, // Add s:2
                },
                {
                  service_id: 3,
                  sub_service_id: null,
                  sub_sub_service_id: null,
                  is_allowed: true, // Add s:3
                },
                {
                  service_id: 1,
                  sub_service_id: null,
                  sub_sub_service_id: null,
                  is_allowed: false, // Deny s:1 (job has it)
                },
              ],
            },
            { uid: 'admin-user-id' }
          );

          await manageUserPermissions(request);

          const snapshot = await db.collection('user_permissions').get();
          expect(snapshot.size).to.equal(3);

          // Verify all exceptions were created correctly
          const exceptions = snapshot.docs.map((d) => d.data());
          expect(exceptions).to.deep.include.members([
            {
              user_id: 'target-user-id',
              service_id: 2,
              sub_service_id: null,
              sub_sub_service_id: null,
              is_allowed: true,
              is_manual_exception: true,
              created_by: 'admin-user-id',
            },
            {
              user_id: 'target-user-id',
              service_id: 3,
              sub_service_id: null,
              sub_sub_service_id: null,
              is_allowed: true,
              is_manual_exception: true,
              created_by: 'admin-user-id',
            },
            {
              user_id: 'target-user-id',
              service_id: 1,
              sub_service_id: null,
              sub_sub_service_id: null,
              is_allowed: false,
              is_manual_exception: true,
              created_by: 'admin-user-id',
            },
          ]);
        });

        it('should handle mixed create/update/delete operations', async () => {
          // Pre-seed some exceptions
          await seedFirestore('user_permissions', [
            {
              id: 'exception-1',
              data: {
                user_id: 'target-user-id',
                service_id: 5,
                sub_service_id: null,
                sub_sub_service_id: null,
                is_allowed: true,
              },
            },
          ]);

          const request = createCallableRequest(
            {
              p_user_id: 'target-user-id',
              p_permissions_to_process: [
                {
                  service_id: 5,
                  sub_service_id: null,
                  sub_sub_service_id: null,
                  is_allowed: false, // DELETE (deny non-job permission)
                },
                {
                  service_id: 2,
                  sub_service_id: null,
                  sub_sub_service_id: null,
                  is_allowed: true, // CREATE
                },
              ],
            },
            { uid: 'admin-user-id' }
          );

          await manageUserPermissions(request);

          const snapshot = await db.collection('user_permissions').get();
          expect(snapshot.size).to.equal(1);

          const exception = snapshot.docs[0].data();
          expect(exception.service_id).to.equal(2);
        });

        it('should handle empty permissions array', async () => {
          const request = createCallableRequest(
            {
              p_user_id: 'target-user-id',
              p_permissions_to_process: [],
            },
            { uid: 'admin-user-id' }
          );

          const result = await manageUserPermissions(request);
          expect(result).to.deep.equal({ success: true });
        });
      });

      // =======================================================================
      // 📌 SECTION 7: Different Permission Levels
      // =======================================================================
      describe('🎚️ Service Hierarchy Levels', () => {
        beforeEach(async () => {
          await seedFirestore('users', [
            {
              id: 'target-user-id',
              data: { job_id: 2, is_allowed: true },
            },
          ]);
        });

        it('should handle sub-service permissions', async () => {
          const request = createCallableRequest(
            {
              p_user_id: 'target-user-id',
              p_permissions_to_process: [
                {
                  service_id: null,
                  sub_service_id: 15,
                  sub_sub_service_id: null,
                  is_allowed: true,
                },
              ],
            },
            { uid: 'admin-user-id' }
          );

          await manageUserPermissions(request);

          const snapshot = await db.collection('user_permissions').get();
          const exception = snapshot.docs[0].data();

          expect(exception).to.include({
            service_id: null,
            sub_service_id: 15,
            sub_sub_service_id: null,
          });
        });

        it('should handle sub-sub-service permissions', async () => {
          const request = createCallableRequest(
            {
              p_user_id: 'target-user-id',
              p_permissions_to_process: [
                {
                  service_id: null,
                  sub_service_id: null,
                  sub_sub_service_id: 150,
                  is_allowed: true,
                },
              ],
            },
            { uid: 'admin-user-id' }
          );

          await manageUserPermissions(request);

          const snapshot = await db.collection('user_permissions').get();
          const exception = snapshot.docs[0].data();

          expect(exception).to.include({
            service_id: null,
            sub_service_id: null,
            sub_sub_service_id: 150,
          });
        });

        it('should handle permissions at all three levels', async () => {
          const request = createCallableRequest(
            {
              p_user_id: 'target-user-id',
              p_permissions_to_process: [
                {
                  service_id: 1,
                  sub_service_id: null,
                  sub_sub_service_id: null,
                  is_allowed: true,
                },
                {
                  service_id: null,
                  sub_service_id: 10,
                  sub_sub_service_id: null,
                  is_allowed: true,
                },
                {
                  service_id: null,
                  sub_service_id: null,
                  sub_sub_service_id: 100,
                  is_allowed: true,
                },
              ],
            },
            { uid: 'admin-user-id' }
          );

          await manageUserPermissions(request);

          const snapshot = await db.collection('user_permissions').get();
          expect(snapshot.size).to.equal(3);
        });
      });

      // =======================================================================
      // 📌 SECTION 8: Edge Cases
      // =======================================================================
      describe('🧪 Edge Cases & Special Scenarios', () => {
        it('should handle user without job_id', async () => {
          await seedFirestore('users', [
            {
              id: 'no-job-user',
              data: { job_id: null, is_allowed: true },
            },
          ]);

          // User has no job, so all is_allowed=true should create exceptions
          const request = createCallableRequest(
            {
              p_user_id: 'no-job-user',
              p_permissions_to_process: [
                {
                  service_id: 1,
                  sub_service_id: null,
                  sub_sub_service_id: null,
                  is_allowed: true,
                },
              ],
            },
            { uid: 'admin-user-id' }
          );

          await manageUserPermissions(request);

          const snapshot = await db.collection('user_permissions').get();
          expect(snapshot.size).to.equal(1);
        });

        it('should handle permissions with undefined/null values', async () => {
          await seedFirestore('users', [
            {
              id: 'target-user-id',
              data: { job_id: 2, is_allowed: true },
            },
          ]);

          const request = createCallableRequest(
            {
              p_user_id: 'target-user-id',
              p_permissions_to_process: [
                {
                  service_id: 1,
                  // sub_service_id not provided (undefined)
                  // sub_sub_service_id not provided (undefined)
                  is_allowed: true,
                },
              ],
            },
            { uid: 'admin-user-id' }
          );

          await manageUserPermissions(request);

          const snapshot = await db.collection('user_permissions').get();
          if (!snapshot.empty) {
            const exception = snapshot.docs[0].data();
            expect(exception.sub_service_id).to.be.null;
            expect(exception.sub_sub_service_id).to.be.null;
          }
        });

        it('should properly match permissions with exact null values', async () => {
          await seedFirestore('users', [
            {
              id: 'target-user-id',
              data: { job_id: 2, is_allowed: true },
            },
          ]);

          // Job has s:1 (null, null)
          await seedFirestore('job_permissions', [
            {
              data: {
                job_id: 2,
                service_id: 1,
                sub_service_id: null,
                sub_sub_service_id: null,
              },
            },
          ]);

          // User exception for s:1 (null, null) - should match
          await seedFirestore('user_permissions', [
            {
              id: 'exact-match',
              data: {
                user_id: 'target-user-id',
                service_id: 1,
                sub_service_id: null,
                sub_sub_service_id: null,
                is_allowed: false,
              },
            },
          ]);

          // Allow s:1 - should delete the exception
          const request = createCallableRequest(
            {
              p_user_id: 'target-user-id',
              p_permissions_to_process: [
                {
                  service_id: 1,
                  sub_service_id: null,
                  sub_sub_service_id: null,
                  is_allowed: true,
                },
              ],
            },
            { uid: 'admin-user-id' }
          );

          await manageUserPermissions(request);

          const snapshot = await db.collection('user_permissions').get();
          expect(snapshot.empty).to.be.true;
        });
      });
    });
  });
});
