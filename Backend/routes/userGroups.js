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
