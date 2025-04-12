import express from 'express';
import { billingAssistant } from '../services/ai/billingAssistant';
import { isAuthenticated } from '../middleware/auth';

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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 answer:
 *                   type: string
 *       400:
 *         description: Missing or invalid question
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Server error while processing the request
 */
router.post('/ask', isAuthenticated, async (req, res) => {
  try {
    const { question } = req.body;
    
    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    const response = await billingAssistant.handleBillingQuery(question);
    res.json({ answer: response });
  } catch (error) {
    console.error('Error in billing assistant:', error);
    res.status(500).json({ error: 'Failed to process billing query' });
  }
});

export default router; 