import express from 'express';
import { billingAssistant } from '../services/ai/billingAssistant';
import { isAuthenticated } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { billingQuestionSchema } from '../validation/schemas';
import logger from '../lib/logger';

const router = express.Router();

/**
 * @swagger
 * /api/billing/ask:
 *   post:
 *     summary: Get AI assistance for billing questions
 *     description: Uses OpenAI to provide helpful responses to billing-related questions
 *     tags:
 *       - Billing
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - question
 *             properties:
 *               question:
 *                 type: string
 *                 description: The billing-related question
 *                 example: "How do I update my billing information?"
 *     responses:
 *       200:
 *         description: AI-generated response to the billing question
 *       400:
 *         description: Invalid request body
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post(
  '/ask',
  isAuthenticated,
  validate(billingQuestionSchema),
  async (req, res, next) => {
    try {
      logger.info('Processing billing question', {
        userId: req.user?.id,
        question: req.body.question
      });

      const response = await billingAssistant.handleBillingQuery(req.body.question);
      
      logger.info('Billing question processed successfully', {
        userId: req.user?.id
      });

      res.json({ answer: response });
    } catch (error) {
      logger.error('Error processing billing question', {
        userId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      next(error);
    }
  }
);

export default router; 