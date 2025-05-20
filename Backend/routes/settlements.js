const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');

// Create settlement
router.post('/', async (req, res) => {
  const { id, group_id, from_address, to_address, amount, note } = req.body;
  const { data, error } = await supabase
    .from('settlements')
    .insert([{ id, group_id, from_address, to_address, amount, note }])
    .select();
  if (error) return res.status(400).json({ error });
  res.json(data[0]);
});

// Get settlement by id
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase
    .from('settlements')
    .select('*')
    .eq('id', id)
    .single();
  if (error) return res.status(404).json({ error });
  res.json(data);
});

// Get all settlements for a group
router.get('/group/:group_id', async (req, res) => {
  const { group_id } = req.params;
  const { data, error } = await supabase
    .from('settlements')
    .select('*')
    .eq('group_id', group_id);
  if (error) return res.status(400).json({ error });
  res.json(data);
});

// Delete settlement
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const { error } = await supabase
    .from('settlements')
    .delete()
    .eq('id', id);
  if (error) return res.status(400).json({ error });
  res.json({ success: true });
});

module.exports = router;
