const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');

// Create expense
router.post('/', async (req, res) => {
  const { id, group_id, description, payer_address, amount } = req.body;
  const { data, error } = await supabase
    .from('expenses')
    .insert([{ id, group_id, description, payer_address, amount }])
    .select();
  if (error) return res.status(400).json({ error });
  res.json(data[0]);
});

// Get expense by id
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('id', id)
    .single();
  if (error) return res.status(404).json({ error });
  res.json(data);
});

// Get all expenses for a group
router.get('/group/:group_id', async (req, res) => {
  const { group_id } = req.params;
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('group_id', group_id);
  if (error) return res.status(400).json({ error });
  res.json(data);
});

// Update expense
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { description, amount } = req.body;
  const { data, error } = await supabase
    .from('expenses')
    .update({ description, amount })
    .eq('id', id)
    .select();
  if (error) return res.status(400).json({ error });
  res.json(data[0]);
});

// Delete expense
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const { error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', id);
  if (error) return res.status(400).json({ error });
  res.json({ success: true });
});

module.exports = router;
