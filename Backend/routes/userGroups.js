const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');

// Add user to group
router.post('/', async (req, res) => {
  const { user_id, group_id } = req.body;
  const { data, error } = await supabase
    .from('user_groups')
    .insert([{ user_id, group_id }])
    .select();
  if (error) return res.status(400).json({ error });
  res.json(data[0]);
});

// Get all groups for a user
router.get('/:user_id', async (req, res) => {
  const { user_id } = req.params;
  const { data, error } = await supabase
    .from('user_groups')
    .select('group_id')
    .eq('user_id', user_id);
  if (error) return res.status(400).json({ error });
  res.json(data);
});

// Get all users for a group
router.get('/group/:group_id', async (req, res) => {
  const { group_id } = req.params;
  console.log('Fetching users for group_id:', group_id); // LOG
  const { data, error } = await supabase
    .from('user_groups')
    .select('user_id')
    .eq('group_id', group_id);
  if (error) {
    console.error('Error fetching users for group:', error); // LOG
    return res.status(400).json({ error });
  }
  console.log('Fetched users for group:', group_id, data); // LOG
  res.json(data);
});

// Remove user from group
router.delete('/', async (req, res) => {
  const { user_id, group_id } = req.body;
  const { error } = await supabase
    .from('user_groups')
    .delete()
    .eq('user_id', user_id)
    .eq('group_id', group_id);
  if (error) return res.status(400).json({ error });
  res.json({ success: true });
});

module.exports = router;
