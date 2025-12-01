/**
 * ============================================================================
 * TEST SUITE: manageJobPermissions Cloud Function
 * ============================================================================
 *
 * Purpose: Tests the manageJobPermissions function which manages permissions
 *          assigned to job roles (applied to all users with that job).
 *
 * Function Behavior:
 * 1. Accepts two arrays: permissions_to_add and permissions_to_remove
 * 2. Parses permission IDs (s:X, ss:X, sss:X) into service IDs
 * 3. Creates job_permissions records for additions (if not exist)
 * 4. Deletes job_permissions records for removals
 * 5. Uses batch operations for efficiency
 *
 * @module test/manageJobPermissions
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
  describe('manageJobPermissions() - Job Permission Management Function', () => {
    describe('═══════════════════════════════════════════════════════════', () => {
      // -----------------------------------------------------------------------
      // Setup & Teardown
      // -----------------------------------------------------------------------

      let manageJobPermissions: any;

      beforeEach(async () => {
        // Clear all Firestore data before each test
        await clearFirestoreCollections(['job_permissions']);

        // Wrap the function for testing
        manageJobPermissions = test.wrap(myFunctions.manageJobPermissions);
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
            p_job_id: 2,
            p_permissions_to_add: [],
            p_permissions_to_remove: [],
          });

          try {
            await manageJobPermissions(request);
            expect.fail('Should have thrown an error');
          } catch (error: any) {
            expect(error.code).to.equal('unauthenticated');
            expect(error.message).to.include('authentication');
          }
        });

        it('should succeed for authenticated admin users', async () => {
          const request = createCallableRequest(
            {
              p_job_id: 2,
              p_permissions_to_add: [],
              p_permissions_to_remove: [],
            },
            { uid: 'admin-user-id' }
          );

          const result = await manageJobPermissions(request);
          expect(result).to.deep.equal({ success: true });
        });

        it('should track who made the changes (created_by field)', async () => {
          const request = createCallableRequest(
            {
              p_job_id: 2,
              p_permissions_to_add: ['s:1'],
              p_permissions_to_remove: [],
            },
            { uid: 'admin-user-id' }
          );

          await manageJobPermissions(request);

          const snapshot = await db.collection('job_permissions').get();
          expect(snapshot.docs[0].data().created_by).to.equal('admin-user-id');
        });
      });

      // =======================================================================
      // 📌 SECTION 2: Adding Permissions
      // =======================================================================
      describe('➕ Adding Job Permissions', () => {
        it('should add service permission (s:X)', async () => {
          const request = createCallableRequest(
            {
              p_job_id: 2,
              p_permissions_to_add: ['s:1'],
              p_permissions_to_remove: [],
            },
            { uid: 'admin-user-id' }
          );

          await manageJobPermissions(request);

          const snapshot = await db.collection('job_permissions').get();
          expect(snapshot.size).to.equal(1);

          const permission = snapshot.docs[0].data();
          expect(permission).to.include({
            job_id: 2,
            service_id: 1,
            sub_service_id: null,
            sub_sub_service_id: null,
            created_by: 'admin-user-id',
          });
        });

        it('should add sub-service permission (ss:X)', async () => {
          const request = createCallableRequest(
            {
              p_job_id: 3,
              p_permissions_to_add: ['ss:10'],
              p_permissions_to_remove: [],
            },
            { uid: 'admin-user-id' }
          );

          await manageJobPermissions(request);

          const snapshot = await db.collection('job_permissions').get();
          const permission = snapshot.docs[0].data();

          expect(permission).to.include({
            job_id: 3,
            service_id: null,
            sub_service_id: 10,
            sub_sub_service_id: null,
          });
        });

        it('should add sub-sub-service permission (sss:X)', async () => {
          const request = createCallableRequest(
            {
              p_job_id: 4,
              p_permissions_to_add: ['sss:100'],
              p_permissions_to_remove: [],
            },
            { uid: 'admin-user-id' }
          );

          await manageJobPermissions(request);

          const snapshot = await db.collection('job_permissions').get();
          const permission = snapshot.docs[0].data();

          expect(permission).to.include({
            job_id: 4,
            service_id: null,
            sub_service_id: null,
            sub_sub_service_id: 100,
          });
        });

        it('should add multiple permissions at once', async () => {
          const request = createCallableRequest(
            {
              p_job_id: 2,
              p_permissions_to_add: ['s:1', 's:2', 'ss:10', 'sss:100'],
              p_permissions_to_remove: [],
            },
            { uid: 'admin-user-id' }
          );

          await manageJobPermissions(request);

          const snapshot = await db.collection('job_permissions').get();
          expect(snapshot.size).to.equal(4);

          const permissions = snapshot.docs.map((d) => d.data());
          expect(permissions).to.deep.include.members([
            {
              job_id: 2,
              service_id: 1,
              sub_service_id: null,
              sub_sub_service_id: null,
              created_by: 'admin-user-id',
            },
            {
              job_id: 2,
              service_id: 2,
              sub_service_id: null,
              sub_sub_service_id: null,
              created_by: 'admin-user-id',
            },
            {
              job_id: 2,
              service_id: null,
              sub_service_id: 10,
              sub_sub_service_id: null,
              created_by: 'admin-user-id',
            },
            {
              job_id: 2,
              service_id: null,
              sub_service_id: null,
              sub_sub_service_id: 100,
              created_by: 'admin-user-id',
            },
          ]);
        });

        it('should not duplicate existing permissions', async () => {
          // Pre-seed existing permission
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

          // Try to add the same permission again
          const request = createCallableRequest(
            {
              p_job_id: 2,
              p_permissions_to_add: ['s:1'],
              p_permissions_to_remove: [],
            },
            { uid: 'admin-user-id' }
          );

          await manageJobPermissions(request);

          // Should still be only 1 permission
          const snapshot = await db.collection('job_permissions').get();
          expect(snapshot.size).to.equal(1);
        });

        it('should handle adding permissions with large IDs', async () => {
          const request = createCallableRequest(
            {
              p_job_id: 2,
              p_permissions_to_add: ['s:999999', 'ss:888888', 'sss:777777'],
              p_permissions_to_remove: [],
            },
            { uid: 'admin-user-id' }
          );

          await manageJobPermissions(request);

          const snapshot = await db.collection('job_permissions').get();
          expect(snapshot.size).to.equal(3);
        });
      });

      // =======================================================================
      // 📌 SECTION 3: Removing Permissions
      // =======================================================================
      describe('➖ Removing Job Permissions', () => {
        beforeEach(async () => {
          // Pre-seed some permissions to remove
          await seedFirestore('job_permissions', [
            {
              id: 'perm-1',
              data: {
                job_id: 2,
                service_id: 1,
                sub_service_id: null,
                sub_sub_service_id: null,
              },
            },
            {
              id: 'perm-2',
              data: {
                job_id: 2,
                service_id: 2,
                sub_service_id: null,
                sub_sub_service_id: null,
              },
            },
            {
              id: 'perm-3',
              data: {
                job_id: 2,
                service_id: null,
                sub_service_id: 10,
                sub_sub_service_id: null,
              },
            },
          ]);
        });

        it('should remove service permission', async () => {
          const request = createCallableRequest(
            {
              p_job_id: 2,
              p_permissions_to_add: [],
              p_permissions_to_remove: ['s:1'],
            },
            { uid: 'admin-user-id' }
          );

          await manageJobPermissions(request);

          const snapshot = await db.collection('job_permissions').get();
          expect(snapshot.size).to.equal(2);

          // s:1 should be removed
          const permissions = snapshot.docs.map((d) => d.data());
          expect(permissions).to.not.deep.include({
            job_id: 2,
            service_id: 1,
            sub_service_id: null,
            sub_sub_service_id: null,
          });
        });

        it('should remove sub-service permission', async () => {
          const request = createCallableRequest(
            {
              p_job_id: 2,
              p_permissions_to_add: [],
              p_permissions_to_remove: ['ss:10'],
            },
            { uid: 'admin-user-id' }
          );

          await manageJobPermissions(request);

          const snapshot = await db.collection('job_permissions').get();
          expect(snapshot.size).to.equal(2);
        });

        it('should remove multiple permissions at once', async () => {
          const request = createCallableRequest(
            {
              p_job_id: 2,
              p_permissions_to_add: [],
              p_permissions_to_remove: ['s:1', 's:2'],
            },
            { uid: 'admin-user-id' }
          );

          await manageJobPermissions(request);

          const snapshot = await db.collection('job_permissions').get();
          expect(snapshot.size).to.equal(1);

          // Only ss:10 should remain
          const permission = snapshot.docs[0].data();
          expect(permission.sub_service_id).to.equal(10);
        });

        it('should handle removing non-existent permission gracefully', async () => {
          const request = createCallableRequest(
            {
              p_job_id: 2,
              p_permissions_to_add: [],
              p_permissions_to_remove: ['s:999'], // Doesn't exist
            },
            { uid: 'admin-user-id' }
          );

          await manageJobPermissions(request);

          // Original permissions should remain
          const snapshot = await db.collection('job_permissions').get();
          expect(snapshot.size).to.equal(3);
        });

        it('should only remove permissions for specified job', async () => {
          // Add permission for different job
          await seedFirestore('job_permissions', [
            {
              id: 'other-job-perm',
              data: {
                job_id: 3,
                service_id: 1,
                sub_service_id: null,
                sub_sub_service_id: null,
              },
            },
          ]);

          // Remove s:1 from job 2
          const request = createCallableRequest(
            {
              p_job_id: 2,
              p_permissions_to_add: [],
              p_permissions_to_remove: ['s:1'],
            },
            { uid: 'admin-user-id' }
          );

          await manageJobPermissions(request);

          // Job 3's permission should remain
          const snapshot = await db
            .collection('job_permissions')
            .where('job_id', '==', 3)
            .get();
          expect(snapshot.size).to.equal(1);
        });
      });

      // =======================================================================
      // 📌 SECTION 4: Combined Add & Remove Operations
      // =======================================================================
      describe('🔄 Combined Add & Remove Operations', () => {
        it('should add and remove permissions in single call', async () => {
          // Pre-seed some permissions
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
                service_id: 2,
                sub_service_id: null,
                sub_sub_service_id: null,
              },
            },
          ]);

          const request = createCallableRequest(
            {
              p_job_id: 2,
              p_permissions_to_add: ['s:3', 'ss:10'],
              p_permissions_to_remove: ['s:1'],
            },
            { uid: 'admin-user-id' }
          );

          await manageJobPermissions(request);

          const snapshot = await db.collection('job_permissions').get();
          expect(snapshot.size).to.equal(3); // s:2, s:3, ss:10

          const permissions = snapshot.docs.map((d) => d.data());
          const serviceIds = permissions.map((p) => p.service_id);

          expect(serviceIds).to.not.include(1); // Removed
          expect(serviceIds).to.include(2); // Kept
          expect(serviceIds).to.include(3); // Added
        });

        it('should handle adding same permission that is being removed', async () => {
          // Pre-seed permission
          await seedFirestore('job_permissions', [
            {
              id: 'perm-to-remove-and-add',
              data: {
                job_id: 2,
                service_id: 1,
                sub_service_id: null,
                sub_sub_service_id: null,
              },
            },
          ]);

          // Remove and add s:1
          const request = createCallableRequest(
            {
              p_job_id: 2,
              p_permissions_to_add: ['s:1'],
              p_permissions_to_remove: ['s:1'],
            },
            { uid: 'admin-user-id' }
          );

          await manageJobPermissions(request);

          // Permission should exist (add is processed after remove)
          const snapshot = await db.collection('job_permissions').get();
          expect(snapshot.size).to.equal(1);
        });
      });

      // =======================================================================
      // 📌 SECTION 5: Permission ID Parsing
      // =======================================================================
      describe('🔍 Permission ID Format Parsing', () => {
        it('should correctly parse service IDs (s:X)', async () => {
          const request = createCallableRequest(
            {
              p_job_id: 2,
              p_permissions_to_add: ['s:123'],
              p_permissions_to_remove: [],
            },
            { uid: 'admin-user-id' }
          );

          await manageJobPermissions(request);

          const snapshot = await db.collection('job_permissions').get();
          const permission = snapshot.docs[0].data();

          expect(permission.service_id).to.equal(123);
          expect(permission.sub_service_id).to.be.null;
          expect(permission.sub_sub_service_id).to.be.null;
        });

        it('should correctly parse sub-service IDs (ss:X)', async () => {
          const request = createCallableRequest(
            {
              p_job_id: 2,
              p_permissions_to_add: ['ss:456'],
              p_permissions_to_remove: [],
            },
            { uid: 'admin-user-id' }
          );

          await manageJobPermissions(request);

          const snapshot = await db.collection('job_permissions').get();
          const permission = snapshot.docs[0].data();

          expect(permission.service_id).to.be.null;
          expect(permission.sub_service_id).to.equal(456);
          expect(permission.sub_sub_service_id).to.be.null;
        });

        it('should correctly parse sub-sub-service IDs (sss:X)', async () => {
          const request = createCallableRequest(
            {
              p_job_id: 2,
              p_permissions_to_add: ['sss:789'],
              p_permissions_to_remove: [],
            },
            { uid: 'admin-user-id' }
          );

          await manageJobPermissions(request);

          const snapshot = await db.collection('job_permissions').get();
          const permission = snapshot.docs[0].data();

          expect(permission.service_id).to.be.null;
          expect(permission.sub_service_id).to.be.null;
          expect(permission.sub_sub_service_id).to.equal(789);
        });

        it('should ignore malformed permission IDs', async () => {
          const request = createCallableRequest(
            {
              p_job_id: 2,
              p_permissions_to_add: [
                'invalid:123',
                'malformed',
                's:',
                ':123',
                'xyz:999',
              ],
              p_permissions_to_remove: [],
            },
            { uid: 'admin-user-id' }
          );

          await manageJobPermissions(request);

          // No permissions should be created for malformed IDs
          const snapshot = await db.collection('job_permissions').get();
          expect(snapshot.empty).to.be.true;
        });

        it('should handle mixed valid and invalid permission IDs', async () => {
          const request = createCallableRequest(
            {
              p_job_id: 2,
              p_permissions_to_add: ['s:1', 'invalid:123', 'ss:10'],
              p_permissions_to_remove: [],
            },
            { uid: 'admin-user-id' }
          );

          await manageJobPermissions(request);

          // Only valid permissions should be created
          const snapshot = await db.collection('job_permissions').get();
          expect(snapshot.size).to.equal(2);
        });
      });

      // =======================================================================
      // 📌 SECTION 6: Edge Cases
      // =======================================================================
      describe('🧪 Edge Cases & Special Scenarios', () => {
        it('should handle empty add and remove arrays', async () => {
          const request = createCallableRequest(
            {
              p_job_id: 2,
              p_permissions_to_add: [],
              p_permissions_to_remove: [],
            },
            { uid: 'admin-user-id' }
          );

          const result = await manageJobPermissions(request);
          expect(result).to.deep.equal({ success: true });
        });

        it('should handle job_id of 0', async () => {
          const request = createCallableRequest(
            {
              p_job_id: 0,
              p_permissions_to_add: ['s:1'],
              p_permissions_to_remove: [],
            },
            { uid: 'admin-user-id' }
          );

          await manageJobPermissions(request);

          const snapshot = await db.collection('job_permissions').get();
          const permission = snapshot.docs[0].data();

          expect(permission.job_id).to.equal(0);
        });

        it('should handle very large job_id', async () => {
          const request = createCallableRequest(
            {
              p_job_id: 999999,
              p_permissions_to_add: ['s:1'],
              p_permissions_to_remove: [],
            },
            { uid: 'admin-user-id' }
          );

          await manageJobPermissions(request);

          const snapshot = await db.collection('job_permissions').get();
          const permission = snapshot.docs[0].data();

          expect(permission.job_id).to.equal(999999);
        });

        it('should handle permissions with ID 0', async () => {
          const request = createCallableRequest(
            {
              p_job_id: 2,
              p_permissions_to_add: ['s:0', 'ss:0', 'sss:0'],
              p_permissions_to_remove: [],
            },
            { uid: 'admin-user-id' }
          );

          await manageJobPermissions(request);

          const snapshot = await db.collection('job_permissions').get();
          expect(snapshot.size).to.equal(3);
        });

        it('should handle large batch operations', async () => {
          // Create array of 100 permissions to add
          const permissionsToAdd = [];
          for (let i = 1; i <= 100; i++) {
            permissionsToAdd.push(`s:${i}`);
          }

          const request = createCallableRequest(
            {
              p_job_id: 2,
              p_permissions_to_add: permissionsToAdd,
              p_permissions_to_remove: [],
            },
            { uid: 'admin-user-id' }
          );

          await manageJobPermissions(request);

          const snapshot = await db.collection('job_permissions').get();
          expect(snapshot.size).to.equal(100);
        });

        it('should handle duplicate IDs in add array', async () => {
          const request = createCallableRequest(
            {
              p_job_id: 2,
              p_permissions_to_add: ['s:1', 's:1', 's:1'],
              p_permissions_to_remove: [],
            },
            { uid: 'admin-user-id' }
          );

          await manageJobPermissions(request);

          // Should only create one permission
          const snapshot = await db.collection('job_permissions').get();
          expect(snapshot.size).to.equal(1);
        });

        it('should handle duplicate IDs in remove array', async () => {
          // Pre-seed permission
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

          const request = createCallableRequest(
            {
              p_job_id: 2,
              p_permissions_to_add: [],
              p_permissions_to_remove: ['s:1', 's:1', 's:1'],
            },
            { uid: 'admin-user-id' }
          );

          await manageJobPermissions(request);

          // Permission should be removed
          const snapshot = await db.collection('job_permissions').get();
          expect(snapshot.empty).to.be.true;
        });
      });

      // =======================================================================
      // 📌 SECTION 7: Integration & Complex Scenarios
      // =======================================================================
      describe('🔄 Complex Integration Scenarios', () => {
        it('should handle complete permission overhaul', async () => {
          // Pre-seed existing permissions
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
                service_id: 2,
                sub_service_id: null,
                sub_sub_service_id: null,
              },
            },
            {
              data: {
                job_id: 2,
                service_id: 3,
                sub_service_id: null,
                sub_sub_service_id: null,
              },
            },
          ]);

          // Remove all existing, add new ones
          const request = createCallableRequest(
            {
              p_job_id: 2,
              p_permissions_to_add: ['ss:10', 'ss:20', 'sss:100'],
              p_permissions_to_remove: ['s:1', 's:2', 's:3'],
            },
            { uid: 'admin-user-id' }
          );

          await manageJobPermissions(request);

          const snapshot = await db.collection('job_permissions').get();
          expect(snapshot.size).to.equal(3);

          const permissions = snapshot.docs.map((d) => d.data());
          const hasSubService = permissions.every(
            (p) =>
              p.service_id === null &&
              (p.sub_service_id !== null || p.sub_sub_service_id !== null)
          );
          expect(hasSubService).to.be.true;
        });

        it('should maintain permissions for different jobs', async () => {
          // Seed permissions for multiple jobs
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
                job_id: 3,
                service_id: 1,
                sub_service_id: null,
                sub_sub_service_id: null,
              },
            },
            {
              data: {
                job_id: 4,
                service_id: 1,
                sub_service_id: null,
                sub_sub_service_id: null,
              },
            },
          ]);

          // Modify only job 2
          const request = createCallableRequest(
            {
              p_job_id: 2,
              p_permissions_to_add: ['s:2'],
              p_permissions_to_remove: ['s:1'],
            },
            { uid: 'admin-user-id' }
          );

          await manageJobPermissions(request);

          // Job 3 and 4 should still have s:1
          const job3Snapshot = await db
            .collection('job_permissions')
            .where('job_id', '==', 3)
            .get();
          const job4Snapshot = await db
            .collection('job_permissions')
            .where('job_id', '==', 4)
            .get();

          expect(job3Snapshot.size).to.equal(1);
          expect(job4Snapshot.size).to.equal(1);

          // Job 2 should have s:2
          const job2Snapshot = await db
            .collection('job_permissions')
            .where('job_id', '==', 2)
            .get();

          expect(job2Snapshot.size).to.equal(1);
          expect(job2Snapshot.docs[0].data().service_id).to.equal(2);
        });
      });
    });
  });
});
