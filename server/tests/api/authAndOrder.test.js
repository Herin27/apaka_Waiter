import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../../src/server.js';

describe('API Health & Auth Guards', () => {
  it('GET /api/v1/health returns 200 OK', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('rejects unauthenticated access to protected /api/v1/orders with 401', async () => {
    const res = await request(app).get('/api/v1/orders');
    expect(res.status).toBe(401);
  });

  it('rejects invalid login credentials with 401', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nonexistent@demo.com', password: 'WrongPassword123' });
    expect(res.status).toBe(401);
  });
});
