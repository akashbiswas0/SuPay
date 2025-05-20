# Supay Backend

This is the backend for the Supay app, built with Express and Supabase. It provides CRUD APIs for users, groups, expenses, participants, and settlements.

## Setup

1. Clone the repo and `cd` into `SuPay/Backend`.
2. Copy `sample.env` to `.env` and fill in your Supabase credentials.
3. Install dependencies:
   ```sh
   npm install
   ```
4. Start the server:
   ```sh
   npm start
   ```

## API Endpoints

### Users
- `POST   /users` — Create user `{ wallet_address, name }`
- `GET    /users/:wallet_address` — Get user by wallet address
- `PUT    /users/:wallet_address` — Update user name
- `DELETE /users/:wallet_address` — Delete user

### Groups
- `POST   /groups` — Create group `{ id, name, owner_address }`
- `GET    /groups/:id` — Get group by id
- `PUT    /groups/:id` — Update group name
- `DELETE /groups/:id` — Delete group

### User-Groups
- `POST   /user_groups` — Add user to group `{ user_id, group_id }`
- `GET    /user_groups/:user_id` — List group ids for user
- `DELETE /user_groups` — Remove user from group `{ user_id, group_id }`

### Expenses
- `POST   /expenses` — Create expense `{ id, group_id, description, payer_address, amount }`
- `GET    /expenses/:id` — Get expense by id
- `GET    /expenses/group/:group_id` — List expenses for group
- `PUT    /expenses/:id` — Update expense
- `DELETE /expenses/:id` — Delete expense

### Expense Participants
- `POST   /expense_participants` — Add participant `{ expense_id, participant_address, share }`
- `GET    /expense_participants/:expense_id` — List participants for expense
- `DELETE /expense_participants` — Remove participant `{ expense_id, participant_address }`

### Settlements
- `POST   /settlements` — Create settlement `{ id, group_id, from_address, to_address, amount, note }`
- `GET    /settlements/:id` — Get settlement by id
- `GET    /settlements/group/:group_id` — List settlements for group
- `DELETE /settlements/:id` — Delete settlement

## Testing

- Run all tests:
  ```sh
  npm test
  ```
- Example test: `expenseParticipants.test.js` covers the `/expense_participants` endpoints.

## Environment Variables

See `sample.env` for required variables:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `PORT`

## Project Structure

- `index.js` — Main entry, loads all routes
- `app.js` — Express app for testing
- `routes/` — Route handlers for each resource
- `db/supabase.js` — Supabase client setup

---

For more, see the contract and interface folders in the monorepo.