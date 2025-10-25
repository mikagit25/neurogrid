const express = require('express');
const router = express.Router();
const { models } = require('../../models');
const { authenticate, validateRequest, validations } = require('../../middleware/security');
const { apiResponse } = require('../../utils/apiHelpers');
const logger = require('../../utils/logger');

/**
 * Job Management Routes
 * Handles CRUD operations for jobs
 */

// Get all jobs for authenticated user
router.get('/', authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 10, status, job_type } = req.query;
    const userId = req.user.id;

    const conditions = { user_id: userId };
    if (status) conditions.status = status;
    if (job_type) conditions.job_type = job_type;

    const jobs = await models.Job.findAll(conditions, {
      page: parseInt(page),
      limit: parseInt(limit),
      orderBy: 'created_at',
      order: 'DESC'
    });

    const total = await models.Job.count(conditions);

    apiResponse.success(res, {
      jobs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Error fetching jobs', { error: error.message, userId: req.user.id });
    apiResponse.error(res, 'Failed to fetch jobs', 500);
  }
});

// Get specific job
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const job = await models.Job.findById(id);

    if (!job) {
      return apiResponse.error(res, 'Job not found', 404);
    }

    // Check if user owns the job or is admin
    if (job.user_id !== userId && req.user.role !== 'admin') {
      return apiResponse.error(res, 'Access denied', 403);
    }

    apiResponse.success(res, { job });
  } catch (error) {
    logger.error('Error fetching job', { error: error.message, jobId: req.params.id });
    apiResponse.error(res, 'Failed to fetch job', 500);
  }
});

// Create new job
router.post('/',
  authenticate,
  validateRequest([
    validations.body('title').notEmpty().withMessage('Title is required'),
    validations.body('job_type').notEmpty().withMessage('Job type is required'),
    validations.body('description').optional().isString(),
    validations.body('requirements').optional().isObject(),
    validations.body('parameters').optional().isObject(),
    validations.body('priority').optional().isInt({ min: 1, max: 10 })
  ]),
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { title, description, job_type, requirements, parameters, priority = 5 } = req.body;

      const jobData = {
        user_id: userId,
        title,
        description,
        job_type,
        status: 'pending',
        priority,
        requirements: JSON.stringify(requirements || {}),
        parameters: JSON.stringify(parameters || {})
      };

      const job = await models.Job.create(jobData);

      logger.info('Job created', { jobId: job.id, userId, jobType: job_type });

      apiResponse.success(res, { job }, 201);
    } catch (error) {
      logger.error('Error creating job', { error: error.message, userId: req.user.id });
      apiResponse.error(res, 'Failed to create job', 500);
    }
  }
);

// Update job
router.put('/:id',
  authenticate,
  validateRequest([
    validations.body('title').optional().isString(),
    validations.body('description').optional().isString(),
    validations.body('priority').optional().isInt({ min: 1, max: 10 }),
    validations.body('status').optional().isIn(['pending', 'cancelled'])
  ]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const job = await models.Job.findById(id);

      if (!job) {
        return apiResponse.error(res, 'Job not found', 404);
      }

      // Check if user owns the job
      if (job.user_id !== userId && req.user.role !== 'admin') {
        return apiResponse.error(res, 'Access denied', 403);
      }

      // Don't allow updates to running or completed jobs
      if (['running', 'completed', 'failed'].includes(job.status)) {
        return apiResponse.error(res, 'Cannot update job in current status', 400);
      }

      const updateData = {};
      const allowedFields = ['title', 'description', 'priority', 'status'];

      allowedFields.forEach(field => {
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field];
        }
      });

      const updatedJob = await models.Job.update(id, updateData);

      logger.info('Job updated', { jobId: id, userId, updates: Object.keys(updateData) });

      apiResponse.success(res, { job: updatedJob });
    } catch (error) {
      logger.error('Error updating job', { error: error.message, jobId: req.params.id });
      apiResponse.error(res, 'Failed to update job', 500);
    }
  }
);

// Delete job
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const job = await models.Job.findById(id);

    if (!job) {
      return apiResponse.error(res, 'Job not found', 404);
    }

    // Check if user owns the job
    if (job.user_id !== userId && req.user.role !== 'admin') {
      return apiResponse.error(res, 'Access denied', 403);
    }

    // Don't allow deletion of running jobs
    if (job.status === 'running') {
      return apiResponse.error(res, 'Cannot delete running job', 400);
    }

    await models.Job.delete(id);

    logger.info('Job deleted', { jobId: id, userId });

    apiResponse.success(res, { message: 'Job deleted successfully' });
  } catch (error) {
    logger.error('Error deleting job', { error: error.message, jobId: req.params.id });
    apiResponse.error(res, 'Failed to delete job', 500);
  }
});

// Get job statistics
router.get('/stats/overview', authenticate, async (req, res) => {
  try {
    const userId = req.user.role === 'admin' ? null : req.user.id;
    const stats = await models.Job.getJobStats(userId);

    const overview = {
      total: 0,
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
      avgDuration: 0,
      totalCost: 0
    };

    stats.forEach(stat => {
      overview.total += stat.count;
      overview[stat.status] = stat.count;
      if (stat.avg_duration) {
        overview.avgDuration = Math.round(stat.avg_duration);
      }
      if (stat.total_cost) {
        overview.totalCost += parseFloat(stat.total_cost);
      }
    });

    apiResponse.success(res, { stats: overview });
  } catch (error) {
    logger.error('Error fetching job stats', { error: error.message, userId: req.user.id });
    apiResponse.error(res, 'Failed to fetch job statistics', 500);
  }
});

module.exports = router;
