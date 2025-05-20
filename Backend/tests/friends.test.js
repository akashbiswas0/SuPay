const request = require('supertest');
const app = require('../app');

describe('Friends API', () => {
  let user_id, friend_id;
  let wallet_address1 = '0xuser2';
  let wallet_address2 = '0xuser3';
  let name1 = 'User Two';
  let name2 = 'User Three';

  beforeAll(async () => {
    // Register two users
    const userRes1 = await request(app).post('/users').send({ wallet_address: wallet_address1, name: name1 });
    expect(userRes1.statusCode).toBe(200);
    user_id = userRes1.body.id;
    const userRes2 = await request(app).post('/users').send({ wallet_address: wallet_address2, name: name2 });
    expect(userRes2.statusCode).toBe(200);
    friend_id = userRes2.body.id;
  });

  afterAll(async () => {
    // Clean up
    await request(app).delete('/friends').send({ user_id, friend_id });
    await request(app).delete(`/users/${wallet_address1}`);
    await request(app).delete(`/users/${wallet_address2}`);
  });

  it('should add a friend', async () => {
    const res = await request(app)
      .post('/friends')
      .send({ user_id, friend_id });
    expect(res.statusCode).toBe(200);
    expect(res.body.user_id).toBe(user_id);
    expect(res.body.friend_id).toBe(friend_id);
  });

  it('should list friends for a user', async () => {
    const res = await request(app)
      .get(`/friends/${user_id}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some(f => f.friend_id === friend_id)).toBe(true);
  });

  it('should remove a friend', async () => {
    const res = await request(app)
      .delete('/friends')
      .send({ user_id, friend_id });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
