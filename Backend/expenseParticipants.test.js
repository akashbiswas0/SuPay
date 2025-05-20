const request = require('supertest');
const app = require('./app');

describe('Expense Participants API', () => {
  let expense_id = 'test-expense-1';
  let group_id = 'test-group-1';
  let participant_address = '0x123';
  let payer_address = '0xabc';
  let share = 100;

  beforeAll(async () => {
    // Create a test group
    await request(app)
      .post('/groups')
      .send({ id: group_id, name: 'Test Group', owner_address: payer_address });
    // Create a test expense
    await request(app)
      .post('/expenses')
      .send({ id: expense_id, group_id, description: 'Test Expense', payer_address, amount: share });
  });

  afterAll(async () => {
    // Clean up test data
    await request(app)
      .delete('/expense_participants')
      .send({ expense_id, participant_address });
    await request(app)
      .delete(`/expenses/${expense_id}`);
    await request(app)
      .delete(`/groups/${group_id}`);
  });

  it('should add a participant to an expense', async () => {
    const res = await request(app)
      .post('/expense_participants')
      .send({ expense_id, participant_address, share });
    expect(res.statusCode).toBe(200);
    expect(res.body.expense_id).toBe(expense_id);
    expect(res.body.participant_address).toBe(participant_address);
    expect(res.body.share).toBe(share);
  });

  it('should get all participants for an expense', async () => {
    const res = await request(app)
      .get(`/expense_participants/${expense_id}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some(p => p.participant_address === participant_address)).toBe(true);
  });

  it('should remove a participant from an expense', async () => {
    const res = await request(app)
      .delete('/expense_participants')
      .send({ expense_id, participant_address });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// Remove old test files after moving to tests/
