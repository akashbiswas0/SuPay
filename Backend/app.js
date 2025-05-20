const express = require('express');
const bodyParser = require('body-parser');

// Import routes
const users = require('./routes/users');
const groups = require('./routes/groups');
const userGroups = require('./routes/userGroups');
const expenses = require('./routes/expenses');
const expenseParticipants = require('./routes/expenseParticipants');
const settlements = require('./routes/settlements');

const app = express();
app.use(bodyParser.json());
app.use('/users', users);
app.use('/groups', groups);
app.use('/user_groups', userGroups);
app.use('/expenses', expenses);
app.use('/expense_participants', expenseParticipants);
app.use('/settlements', settlements);

module.exports = app;
