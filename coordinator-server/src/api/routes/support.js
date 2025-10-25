const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const { ResponseHelper } = require('../../utils/response');
const logger = require('../../utils/logger');

const router = express.Router();

// In-memory storage for demo (in production would use database)
const supportTickets = new Map();
const contactMessages = new Map();
let ticketCounter = 1000;
let messageCounter = 1;

/**
 * @route   POST /api/support/tickets
 * @desc    Create a new support ticket
 * @access  Public
 */
router.post('/tickets', [
  body('type').isIn(['technical', 'bug', 'feature', 'general']).withMessage('Invalid support type'),
  body('name').notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('priority').isIn(['low', 'normal', 'high', 'critical']).withMessage('Invalid priority'),
  body('subject').notEmpty().withMessage('Subject is required'),
  body('description').notEmpty().withMessage('Description is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const {
      type,
      name,
      email,
      priority,
      subject,
      description,
      operatingSystem,
      browser
    } = req.body;

    const ticket = {
      id: `TICK-${String(ticketCounter++).padStart(6, '0')}`,
      type,
      name,
      email,
      priority,
      subject,
      description,
      operatingSystem: operatingSystem || null,
      browser: browser || null,
      status: 'open',
      createdAt: new Date(),
      updatedAt: new Date(),
      assignedTo: null,
      responses: [],
      tags: [],
      estimatedResponseTime: getEstimatedResponseTime(priority)
    };

    supportTickets.set(ticket.id, ticket);

    logger.info(`New support ticket created: ${ticket.id}`, {
      ticketId: ticket.id,
      type: ticket.type,
      priority: ticket.priority,
      email: ticket.email
    });

    res.status(201).json({
      success: true,
      ticket: {
        id: ticket.id,
        type: ticket.type,
        priority: ticket.priority,
        subject: ticket.subject,
        status: ticket.status,
        createdAt: ticket.createdAt,
        estimatedResponseTime: ticket.estimatedResponseTime
      }
    });
  } catch (error) {
    logger.error('Error creating support ticket:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create support ticket'
    });
  }
});

/**
 * @route   GET /api/support/tickets
 * @desc    Get support tickets (with optional filtering)
 * @access  Public (would be admin-only in production)
 */
router.get('/tickets', [
  query('status').optional().isIn(['open', 'in_progress', 'waiting', 'resolved', 'closed']).withMessage('Invalid status'),
  query('priority').optional().isIn(['low', 'normal', 'high', 'critical']).withMessage('Invalid priority'),
  query('type').optional().isIn(['technical', 'bug', 'feature', 'general']).withMessage('Invalid type'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { status, priority, type, limit = 50 } = req.query;
    let tickets = Array.from(supportTickets.values());

    // Apply filters
    if (status) {
      tickets = tickets.filter(t => t.status === status);
    }
    if (priority) {
      tickets = tickets.filter(t => t.priority === priority);
    }
    if (type) {
      tickets = tickets.filter(t => t.type === type);
    }

    // Sort by creation date (newest first)
    tickets.sort((a, b) => b.createdAt - a.createdAt);

    // Apply limit
    tickets = tickets.slice(0, parseInt(limit));

    // Remove sensitive information for public access
    const publicTickets = tickets.map(ticket => ({
      id: ticket.id,
      type: ticket.type,
      priority: ticket.priority,
      subject: ticket.subject,
      status: ticket.status,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      responseCount: ticket.responses.length,
      estimatedResponseTime: ticket.estimatedResponseTime
    }));

    res.json({
      success: true,
      tickets: publicTickets,
      total: supportTickets.size,
      filtered: tickets.length
    });
  } catch (error) {
    logger.error('Error fetching support tickets:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch support tickets'
    });
  }
});

/**
 * @route   GET /api/support/tickets/:id
 * @desc    Get a specific support ticket
 * @access  Public (would need authentication in production)
 */
router.get('/tickets/:id', [
  param('id').matches(/^TICK-\d{6}$/).withMessage('Invalid ticket ID format')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { id } = req.params;
    const ticket = supportTickets.get(id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: 'Ticket not found'
      });
    }

    // Remove sensitive information for public access
    const publicTicket = {
      id: ticket.id,
      type: ticket.type,
      priority: ticket.priority,
      subject: ticket.subject,
      description: ticket.description,
      status: ticket.status,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      responses: ticket.responses.map(r => ({
        id: r.id,
        message: r.message,
        author: r.author,
        createdAt: r.createdAt,
        isStaff: r.isStaff
      })),
      estimatedResponseTime: ticket.estimatedResponseTime
    };

    res.json({
      success: true,
      ticket: publicTicket
    });
  } catch (error) {
    logger.error('Error fetching support ticket:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch support ticket'
    });
  }
});

/**
 * @route   POST /api/support/tickets/:id/responses
 * @desc    Add a response to a support ticket
 * @access  Public (would need authentication in production)
 */
router.post('/tickets/:id/responses', [
  param('id').matches(/^TICK-\d{6}$/).withMessage('Invalid ticket ID format'),
  body('message').notEmpty().withMessage('Message is required'),
  body('author').notEmpty().withMessage('Author is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { id } = req.params;
    const { message, author } = req.body;

    const ticket = supportTickets.get(id);
    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: 'Ticket not found'
      });
    }

    const response = {
      id: `RESP-${Date.now()}`,
      message,
      author,
      createdAt: new Date(),
      isStaff: false // In production, determine based on authentication
    };

    ticket.responses.push(response);
    ticket.updatedAt = new Date();

    // Update status if needed
    if (ticket.status === 'waiting') {
      ticket.status = 'in_progress';
    }

    logger.info(`Response added to ticket ${id}`, {
      ticketId: id,
      responseId: response.id,
      author: response.author
    });

    res.status(201).json({
      success: true,
      response: {
        id: response.id,
        message: response.message,
        author: response.author,
        createdAt: response.createdAt
      }
    });
  } catch (error) {
    logger.error('Error adding ticket response:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add response'
    });
  }
});

/**
 * @route   POST /api/support/contact
 * @desc    Submit a contact form message
 * @access  Public
 */
router.post('/contact', [
  body('name').notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('message').notEmpty().withMessage('Message is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { name, email, message } = req.body;

    const contactMessage = {
      id: `MSG-${String(messageCounter++).padStart(6, '0')}`,
      name,
      email,
      message,
      status: 'new',
      createdAt: new Date(),
      respondedAt: null,
      response: null
    };

    contactMessages.set(contactMessage.id, contactMessage);

    logger.info(`New contact message received: ${contactMessage.id}`, {
      messageId: contactMessage.id,
      email: contactMessage.email
    });

    res.status(201).json({
      success: true,
      message: {
        id: contactMessage.id,
        status: contactMessage.status,
        createdAt: contactMessage.createdAt
      }
    });
  } catch (error) {
    logger.error('Error processing contact message:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process contact message'
    });
  }
});

/**
 * @route   GET /api/support/stats
 * @desc    Get support statistics
 * @access  Public (would be admin-only in production)
 */
router.get('/stats', async (req, res) => {
  try {
    const tickets = Array.from(supportTickets.values());
    const messages = Array.from(contactMessages.values());

    const stats = {
      tickets: {
        total: tickets.length,
        open: tickets.filter(t => t.status === 'open').length,
        inProgress: tickets.filter(t => t.status === 'in_progress').length,
        resolved: tickets.filter(t => t.status === 'resolved').length,
        closed: tickets.filter(t => t.status === 'closed').length,
        byPriority: {
          critical: tickets.filter(t => t.priority === 'critical').length,
          high: tickets.filter(t => t.priority === 'high').length,
          normal: tickets.filter(t => t.priority === 'normal').length,
          low: tickets.filter(t => t.priority === 'low').length
        },
        byType: {
          technical: tickets.filter(t => t.type === 'technical').length,
          bug: tickets.filter(t => t.type === 'bug').length,
          feature: tickets.filter(t => t.type === 'feature').length,
          general: tickets.filter(t => t.type === 'general').length
        }
      },
      contacts: {
        total: messages.length,
        new: messages.filter(m => m.status === 'new').length,
        responded: messages.filter(m => m.status === 'responded').length
      },
      responseTime: {
        average: calculateAverageResponseTime(tickets),
        byPriority: {
          critical: '1 hour',
          high: '2-4 hours',
          normal: '4-8 hours',
          low: '1-2 business days'
        }
      }
    };

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    logger.error('Error fetching support statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch support statistics'
    });
  }
});

/**
 * @route   GET /api/support/faq
 * @desc    Get frequently asked questions
 * @access  Public
 */
router.get('/faq', async (req, res) => {
  try {
    const faqData = [
      {
        id: 1,
        question: 'How do I get started with NeuroGrid?',
        answer: 'Getting started with NeuroGrid is easy! First, create an account and you\'ll receive 10 free tokens. Then you can either submit AI tasks through our web interface or join as a compute node to earn tokens by providing your GPU resources.',
        category: 'getting-started',
        popularity: 100
      },
      {
        id: 2,
        question: 'What AI models are supported?',
        answer: 'We currently support LLaMA 2 for text generation, Stable Diffusion for image generation, and Whisper for speech-to-text. We\'re constantly adding support for new models based on community demand.',
        category: 'features',
        popularity: 95
      },
      {
        id: 3,
        question: 'How does the token system work?',
        answer: 'Tokens are used to pay for AI inference tasks. Task costs vary by model complexity and priority. Node operators earn tokens by completing tasks, with rewards based on performance ratings and completion speed.',
        category: 'tokens',
        popularity: 90
      },
      {
        id: 4,
        question: 'What are the system requirements for running a node?',
        answer: 'Minimum requirements: NVIDIA GPU with 8GB+ VRAM, 16GB+ RAM, stable internet connection, and Docker support. Higher-spec systems earn more tokens and handle more complex tasks.',
        category: 'technical',
        popularity: 85
      },
      {
        id: 5,
        question: 'Is my data secure?',
        answer: 'Yes! All communications use TLS encryption, tasks run in isolated Docker containers, and no personal data is stored on compute nodes. We follow enterprise-grade security practices.',
        category: 'security',
        popularity: 80
      }
    ];

    res.json({
      success: true,
      faq: faqData
    });
  } catch (error) {
    logger.error('Error fetching FAQ:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch FAQ'
    });
  }
});

// Utility functions
function getEstimatedResponseTime(priority) {
  const times = {
    'critical': '1 hour',
    'high': '2-4 hours',
    'normal': '4-8 hours',
    'low': '1-2 business days'
  };
  return times[priority] || '4-8 hours';
}

function calculateAverageResponseTime(tickets) {
  const respondedTickets = tickets.filter(t => t.responses.length > 0);
  if (respondedTickets.length === 0) return 'No data';

  let totalTime = 0;
  let count = 0;

  respondedTickets.forEach(ticket => {
    if (ticket.responses.length > 0) {
      const firstResponse = ticket.responses[0];
      const responseTime = firstResponse.createdAt - ticket.createdAt;
      totalTime += responseTime;
      count++;
    }
  });

  if (count === 0) return 'No data';

  const averageMs = totalTime / count;
  const averageHours = Math.round(averageMs / (1000 * 60 * 60));

  return `${averageHours} hours`;
}

module.exports = router;
