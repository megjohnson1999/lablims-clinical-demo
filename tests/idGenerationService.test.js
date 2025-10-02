const idGenerationService = require('../services/idGenerationService');
const db = require('../db');

// Mock the database module
jest.mock('../db');

describe('IdGenerationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getNextId', () => {
    it('should generate next ID for collaborator', async () => {
      const mockResult = {
        rows: [{ id: 123, next_id: 124 }]
      };
      db.query.mockResolvedValue(mockResult);

      const result = await idGenerationService.getNextId('collaborator', 'testuser');

      expect(db.query).toHaveBeenCalledWith(
        'SELECT * FROM get_next_id($1, $2)',
        ['collaborator', 'testuser']
      );
      expect(result).toEqual({ id: 123, nextId: 124 });
    });

    it('should generate next ID for project', async () => {
      const mockResult = {
        rows: [{ id: 456, next_id: 457 }]
      };
      db.query.mockResolvedValue(mockResult);

      const result = await idGenerationService.getNextId('project');

      expect(db.query).toHaveBeenCalledWith(
        'SELECT * FROM get_next_id($1, $2)',
        ['project', null]
      );
      expect(result).toEqual({ id: 456, nextId: 457 });
    });

    it('should generate next ID for specimen', async () => {
      const mockResult = {
        rows: [{ id: 789, next_id: 790 }]
      };
      db.query.mockResolvedValue(mockResult);

      const result = await idGenerationService.getNextId('specimen', 'otheruser');

      expect(db.query).toHaveBeenCalledWith(
        'SELECT * FROM get_next_id($1, $2)',
        ['specimen', 'otheruser']
      );
      expect(result).toEqual({ id: 789, nextId: 790 });
    });

    it('should throw error for invalid entity type', async () => {
      await expect(
        idGenerationService.getNextId('invalid_type')
      ).rejects.toThrow('Invalid entity type: invalid_type');
    });

    it('should throw error when database query fails', async () => {
      db.query.mockRejectedValue(new Error('Database error'));

      await expect(
        idGenerationService.getNextId('collaborator')
      ).rejects.toThrow('Database error');
    });

    it('should throw error when no rows returned', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await expect(
        idGenerationService.getNextId('collaborator')
      ).rejects.toThrow('Failed to generate ID for collaborator');
    });
  });

  describe('peekNextId', () => {
    it('should peek at next ID without incrementing', async () => {
      const mockResult = {
        rows: [{ next_id: 100 }]
      };
      db.query.mockResolvedValue(mockResult);

      const result = await idGenerationService.peekNextId('collaborator');

      expect(db.query).toHaveBeenCalledWith(
        'SELECT peek_next_id($1) as next_id',
        ['collaborator']
      );
      expect(result).toBe(100);
    });

    it('should throw error for invalid entity type', async () => {
      await expect(
        idGenerationService.peekNextId('invalid_type')
      ).rejects.toThrow('Invalid entity type: invalid_type');
    });
  });

  describe('getGenerationHistory', () => {
    it('should fetch generation history', async () => {
      const mockHistory = {
        rows: [
          {
            entity_type: 'collaborator',
            generated_id: 123,
            generated_by: 'user1',
            generated_at: new Date()
          },
          {
            entity_type: 'collaborator',
            generated_id: 122,
            generated_by: 'user2',
            generated_at: new Date()
          }
        ]
      };
      db.query.mockResolvedValue(mockHistory);

      const result = await idGenerationService.getGenerationHistory('collaborator', 50);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM id_generation_log'),
        ['collaborator', 50]
      );
      expect(result).toEqual(mockHistory.rows);
    });

    it('should use default limit of 100', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await idGenerationService.getGenerationHistory('project');

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        ['project', 100]
      );
    });
  });

  describe('isIdInUse', () => {
    it('should check if collaborator ID is in use', async () => {
      db.query.mockResolvedValue({ rows: [{ count: '1' }] });

      const result = await idGenerationService.isIdInUse('collaborator', 123);

      expect(db.query).toHaveBeenCalledWith(
        'SELECT COUNT(*) FROM collaborators WHERE collaborator_number = $1',
        [123]
      );
      expect(result).toBe(true);
    });

    it('should check if project ID is in use', async () => {
      db.query.mockResolvedValue({ rows: [{ count: '0' }] });

      const result = await idGenerationService.isIdInUse('project', 456);

      expect(db.query).toHaveBeenCalledWith(
        'SELECT COUNT(*) FROM projects WHERE project_id = $1',
        [456]
      );
      expect(result).toBe(false);
    });

    it('should check if specimen ID is in use', async () => {
      db.query.mockResolvedValue({ rows: [{ count: '3' }] });

      const result = await idGenerationService.isIdInUse('specimen', 789);

      expect(db.query).toHaveBeenCalledWith(
        'SELECT COUNT(*) FROM specimens WHERE specimen_number = $1',
        [789]
      );
      expect(result).toBe(true);
    });

    it('should throw error for invalid entity type', async () => {
      await expect(
        idGenerationService.isIdInUse('invalid_type', 123)
      ).rejects.toThrow('Invalid entity type: invalid_type');
    });
  });

  describe('resetSequence', () => {
    it('should reset sequence to specified value', async () => {
      db.query.mockResolvedValue({});

      await idGenerationService.resetSequence('collaborator', 1000);

      expect(db.query).toHaveBeenCalledWith(
        'SELECT setval($1, $2, false)',
        ['collaborator_id_seq', 1000]
      );
    });

    it('should throw error for invalid entity type', async () => {
      await expect(
        idGenerationService.resetSequence('invalid_type', 100)
      ).rejects.toThrow('Invalid entity type: invalid_type');
    });

    it('should throw error for invalid value', async () => {
      await expect(
        idGenerationService.resetSequence('collaborator', 0)
      ).rejects.toThrow('Value must be a positive integer');

      await expect(
        idGenerationService.resetSequence('collaborator', -5)
      ).rejects.toThrow('Value must be a positive integer');

      await expect(
        idGenerationService.resetSequence('collaborator', 'not a number')
      ).rejects.toThrow('Value must be a positive integer');
    });
  });
});