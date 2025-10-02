const request = require('supertest');
const app = require('../server');
const db = require('../db');

// Note: These are integration tests that require a running database
// Run with: npm test -- --testPathPattern=concurrentIdGeneration

describe('Concurrent ID Generation Tests', () => {
  const authToken = process.env.TEST_AUTH_TOKEN || 'test-token';
  
  beforeAll(async () => {
    // Reset sequences to known state
    await db.query('SELECT setval(\'collaborator_id_seq\', 1000, false)');
    await db.query('SELECT setval(\'project_id_seq\', 2000, false)');
    await db.query('SELECT setval(\'specimen_id_seq\', 3000, false)');
  });

  afterAll(async () => {
    await db.end();
  });

  describe('Concurrent collaborator ID generation', () => {
    it('should generate unique IDs for concurrent requests', async () => {
      const numRequests = 10;
      const promises = [];

      // Make multiple concurrent requests
      for (let i = 0; i < numRequests; i++) {
        promises.push(
          request(app)
            .get('/api/ids/next-collaborator')
            .set('Authorization', `Bearer ${authToken}`)
        );
      }

      // Wait for all requests to complete
      const responses = await Promise.all(promises);

      // Extract IDs from responses
      const ids = responses.map(res => {
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        return res.body.data.id;
      });

      // Check that all IDs are unique
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(numRequests);

      // Check that IDs are sequential (though order may vary)
      const sortedIds = [...ids].sort((a, b) => a - b);
      expect(sortedIds[0]).toBeGreaterThanOrEqual(1000);
      for (let i = 1; i < sortedIds.length; i++) {
        expect(sortedIds[i]).toBe(sortedIds[i - 1] + 1);
      }
    });
  });

  describe('Concurrent mixed entity ID generation', () => {
    it('should generate unique IDs across different entity types', async () => {
      const promises = [];

      // Make concurrent requests for different entity types
      for (let i = 0; i < 5; i++) {
        promises.push(
          request(app)
            .get('/api/ids/next-collaborator')
            .set('Authorization', `Bearer ${authToken}`)
        );
        promises.push(
          request(app)
            .get('/api/ids/next-project')
            .set('Authorization', `Bearer ${authToken}`)
        );
        promises.push(
          request(app)
            .get('/api/ids/next-specimen')
            .set('Authorization', `Bearer ${authToken}`)
        );
      }

      const responses = await Promise.all(promises);

      // Group IDs by entity type
      const collaboratorIds = [];
      const projectIds = [];
      const specimenIds = [];

      responses.forEach((res, index) => {
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        
        const entityType = index % 3;
        const id = res.body.data.id;
        
        if (entityType === 0) collaboratorIds.push(id);
        else if (entityType === 1) projectIds.push(id);
        else specimenIds.push(id);
      });

      // Check uniqueness within each entity type
      expect(new Set(collaboratorIds).size).toBe(5);
      expect(new Set(projectIds).size).toBe(5);
      expect(new Set(specimenIds).size).toBe(5);

      // Check that different entity types have different ID ranges
      const allCollaboratorIds = [...collaboratorIds].sort((a, b) => a - b);
      const allProjectIds = [...projectIds].sort((a, b) => a - b);
      const allSpecimenIds = [...specimenIds].sort((a, b) => a - b);

      expect(allCollaboratorIds[0]).toBeGreaterThanOrEqual(1000);
      expect(allProjectIds[0]).toBeGreaterThanOrEqual(2000);
      expect(allSpecimenIds[0]).toBeGreaterThanOrEqual(3000);
    });
  });

  describe('Stress test with high concurrency', () => {
    it('should handle 100 concurrent requests without duplicates', async () => {
      const numRequests = 100;
      const promises = [];

      // Reset specimen sequence for this test
      await db.query('SELECT setval(\'specimen_id_seq\', 5000, false)');

      // Make many concurrent requests
      for (let i = 0; i < numRequests; i++) {
        promises.push(
          request(app)
            .get('/api/ids/next-specimen')
            .set('Authorization', `Bearer ${authToken}`)
        );
      }

      const responses = await Promise.all(promises);

      // Extract and validate IDs
      const ids = responses.map(res => {
        expect(res.status).toBe(200);
        return res.body.data.id;
      });

      // Check no duplicates
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(numRequests);

      // Verify all IDs are in expected range
      const sortedIds = [...ids].sort((a, b) => a - b);
      expect(sortedIds[0]).toBeGreaterThanOrEqual(5000);
      expect(sortedIds[sortedIds.length - 1]).toBeLessThan(5000 + numRequests + 10);
    });
  });

  describe('Error handling under concurrent load', () => {
    it('should handle errors gracefully during concurrent requests', async () => {
      const promises = [];

      // Mix valid and invalid requests
      for (let i = 0; i < 10; i++) {
        if (i % 3 === 0) {
          // Invalid entity type
          promises.push(
            request(app)
              .get('/api/ids/next-invalid')
              .set('Authorization', `Bearer ${authToken}`)
          );
        } else {
          // Valid request
          promises.push(
            request(app)
              .get('/api/ids/next-collaborator')
              .set('Authorization', `Bearer ${authToken}`)
          );
        }
      }

      const responses = await Promise.all(promises);

      let validCount = 0;
      let errorCount = 0;

      responses.forEach((res, index) => {
        if (index % 3 === 0) {
          // Should be error response
          expect(res.status).toBe(404); // Or appropriate error code
          errorCount++;
        } else {
          // Should be success
          expect(res.status).toBe(200);
          expect(res.body.success).toBe(true);
          validCount++;
        }
      });

      expect(errorCount).toBeGreaterThan(0);
      expect(validCount).toBeGreaterThan(0);
    });
  });
});