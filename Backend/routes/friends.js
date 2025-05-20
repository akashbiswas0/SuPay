const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');

// Add a friend
router.post('/', async (req, res) => {
  const { user_id, friend_id } = req.body;
  const { data, error } = await supabase
    .from('friends')
    .insert([{ user_id, friend_id }])
    .select();
  if (error) return res.status(400).json({ error });
  res.json(data[0]);
});

// List friends for a user
router.get('/:user_id', async (req, res) => {
  const { user_id } = req.params;
  const { data, error } = await supabase
    .from('friends')
    .select('friend_id')
    .eq('user_id', user_id);
  if (error) return res.status(400).json({ error });
  res.json(data);
});

// Remove a friend
router.delete('/', async (req, res) => {
  const { user_id, friend_id } = req.body;
  const { error } = await supabase
    .from('friends')
    .delete()
    .eq('user_id', user_id)
    .eq('friend_id', friend_id);
  if (error) return res.status(400).json({ error });
  res.json({ success: true });
});

module.exports = router;
