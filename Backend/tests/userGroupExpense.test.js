const request = require('supertest');
const app = require('../app');

describe('User Registration, Group Membership, and Expense Filtering', () => {
  let wallet_address = '0xuser1';
  let name = 'Test User';
  let user_id;
  let group_id = 'test-group-2';
  let expense_id = 'test-expense-2';
  let payer_address = wallet_address;
  let amount = 200;

  beforeAll(async () => {
    // Register user
    const userRes = await request(app)
      .post('/users')
      .send({ wallet_address, name });
    expect(userRes.statusCode).toBe(200);
    user_id = userRes.body.id;

    // Create group
    const groupRes = await request(app)
      .post('/groups')
      .send({ id: group_id, name: 'Group 2', owner_address: wallet_address });
    expect(groupRes.statusCode).toBe(200);

    // Add user to group
    const userGroupRes = await request(app)
      .post('/user_groups')
      .send({ user_id, group_id });
    expect(userGroupRes.statusCode).toBe(200);

    // Create expense in group
    const expenseRes = await request(app)
      .post('/expenses')
      .send({ id: expense_id, group_id, description: 'Expense 2', payer_address, amount });
    expect(expenseRes.statusCode).toBe(200);
  });

  afterAll(async () => {
    // Clean up
    await request(app).delete(`/expenses/${expense_id}`);
    await request(app).delete('/user_groups').send({ user_id, group_id });
    await request(app).delete(`/groups/${group_id}`);
    await request(app).delete(`/users/${wallet_address}`);
  });

  it('should register a user', async () => {
    const res = await request(app)
      .get(`/users/${wallet_address}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.wallet_address).toBe(wallet_address);
    expect(res.body.name).toBe(name);
  });

  it('should add user to group and list group for user', async () => {
    const res = await request(app)
      .get(`/user_groups/${user_id}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.some(g => g.group_id === group_id)).toBe(true);
  });

  it('should only list expenses for the group', async () => {
    const res = await request(app)
      .get(`/expenses/group/${group_id}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some(e => e.id === expense_id)).toBe(true);
    // Should not include expenses from other groups
    expect(res.body.every(e => e.group_id === group_id)).toBe(true);
  });
});
