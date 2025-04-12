import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { initializeWeeklySummary } from './cron/weeklySummary';
import billingRoutes from './routes/billing';
import metricsRoutes from './routes/metrics';
import { specs } from './config/swagger';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// Routes
app.use('/api/billing', billingRoutes);
app.use('/api/metrics', metricsRoutes);

// Initialize cron jobs
initializeWeeklySummary();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API Documentation available at http://localhost:${PORT}/api-docs`);
});

export default app; 