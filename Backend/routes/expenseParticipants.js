const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');

// Add participant to expense
router.post('/', async (req, res) => {
  const { expense_id, participant_address, share } = req.body;
  const { data, error } = await supabase
    .from('expense_participants')
    .insert([{ expense_id, participant_address, share }])
    .select();
  if (error) return res.status(400).json({ error });
  res.json(data[0]);
});

// Get all participants for an expense
router.get('/:expense_id', async (req, res) => {
  const { expense_id } = req.params;
  const { data, error } = await supabase
    .from('expense_participants')
    .select('*')
    .eq('expense_id', expense_id);
  if (error) return res.status(400).json({ error });
  res.json(data);
});

// Remove participant from expense
router.delete('/', async (req, res) => {
  const { expense_id, participant_address } = req.body;
  const { error } = await supabase
    .from('expense_participants')
    .delete()
    .eq('expense_id', expense_id)
    .eq('participant_address', participant_address);
  if (error) return res.status(400).json({ error });
  res.json({ success: true });
});

module.exports = router;
