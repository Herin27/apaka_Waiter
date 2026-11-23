import http from 'http';
import path from 'path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import { initSocket } from './sockets/index.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { sanitizeXss } from './middleware/sanitizeXss.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';
import { startAutoConfirmScheduler } from './services/autoConfirm.scheduler.js';
import { startLateOrderScheduler } from './services/lateOrder.scheduler.js';
import { startDailySummaryScheduler } from './services/dailySummary.scheduler.js';
import v1Routes from './routes/index.js';

const app = express();
const httpServer = http.createServer(app);

initSocket(httpServer);

// Security Hardening: Helmet CSP, Strict CORS, NoSQL Sanitization, XSS Sanitization, Body Limits
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://checkout.razorpay.com'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        connectSrc: ["'self'", env.CLIENT_URL, 'ws:', 'wss:', 'https://api.razorpay.com'],
        frameSrc: ["'self'", 'https://api.razorpay.com'],
      },
    },
  })
);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || origin === env.CLIENT_URL) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS policy'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  })
);

app.use(morgan(env.NODE_ENV === 'development' ? 'dev' : 'combined'));

app.use(
  express.json({
    limit: '1mb',
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(mongoSanitize({ replaceWith: '_' }));
app.use(sanitizeXss);
app.use(cookieParser());

app.use('/uploads', express.static(path.resolve('uploads')));

app.use('/api', apiLimiter);
app.use('/api/v1', v1Routes);

app.use(notFound);
app.use(errorHandler);

const startServer = async () => {
  await connectDB();
  startAutoConfirmScheduler();
  startLateOrderScheduler();
  startDailySummaryScheduler();
  httpServer.listen(env.PORT, () => {
    console.log(`🚀 Aapka Waiter Server running on http://localhost:${env.PORT} [${env.NODE_ENV}]`);
  });
};

if (env.NODE_ENV !== 'test') {
  startServer();
}

export { app, httpServer };
