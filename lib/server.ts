import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { errorHandler } from '@/lib/middleware/errorHandler';
import { notFoundHandler } from '@/lib/middleware/notFoundHandler';
import routes from '@/lib/routes';
import '@/lib/cron/metrics';

const app = express();

app.use(bodyParser.json());
app.use(cors());
app.use(helmet());
app.use(morgan('combined'));

app.use('/api', routes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;