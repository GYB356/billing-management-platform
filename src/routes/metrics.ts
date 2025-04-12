import express from 'express';
import { anomalyDetection } from '../services/monitoring/anomalyDetection';
import { isAuthenticated } from '../middleware/auth';

const router = express.Router();

/**
 * @swagger
 * /api/metrics/collect:
 *   post:
 *     summary: Submit metrics for anomaly detection
 *     description: Collects metrics for CPU usage, payment failures, or churn rate for anomaly detection
 *     tags:
 *       - Monitoring
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - value
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [cpu, payment, churn]
 *                 description: Type of metric being collected
 *               value:
 *                 type: number
 *                 description: The metric value
 *                 example: 85.5
 *     responses:
 *       200:
 *         description: Metrics collected successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       400:
 *         description: Missing or invalid parameters
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Server error while processing metrics
 */
router.post('/collect', isAuthenticated, async (req, res) => {
  try {
    const { type, value } = req.body;
    
    if (!type || value === undefined) {
      return res.status(400).json({ error: 'Type and value are required' });
    }

    if (!['cpu', 'payment', 'churn'].includes(type)) {
      return res.status(400).json({ error: 'Invalid metric type' });
    }

    await anomalyDetection.detectAnomalies({
      timestamp: new Date(),
      value,
      type: type as 'cpu' | 'payment' | 'churn'
    });

    res.json({ message: 'Metrics collected successfully' });
  } catch (error) {
    console.error('Error collecting metrics:', error);
    res.status(500).json({ error: 'Failed to collect metrics' });
  }
});

export default router;