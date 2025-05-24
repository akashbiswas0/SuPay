const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(bodyParser.json());
app.use(cors());

// Import routes
const users = require('./routes/users');
const groups = require('./routes/groups');
const userGroups = require('./routes/userGroups');
const expenses = require('./routes/expenses');
const expenseParticipants = require('./routes/expenseParticipants');
const settlements = require('./routes/settlements');
const friends = require('./routes/friends');
const chat = require('./routes/chat');

// Use routes
app.use('/users', users);
app.use('/groups', groups);
app.use('/user_groups', userGroups);
app.use('/expenses', expenses);
app.use('/expense_participants', expenseParticipants);
app.use('/settlements', settlements);
app.use('/friends', friends);
app.use('/chat', chat);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Supay backend listening on port ${PORT}`);
});
