const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');

// Create group
router.post('/', async (req, res) => {
  const { id, name, owner_address } = req.body;
  const { data, error } = await supabase
    .from('groups')
    .insert([{ id, name, owner_address }])
    .select();
  if (error) return res.status(400).json({ error });
  res.json(data[0]);
});

// Get group by id
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase
    .from('groups')
    .select('*')
    .eq('id', id)
    .single();
  if (error) return res.status(404).json({ error });
  res.json(data);
});

// Update group name
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  const { data, error } = await supabase
    .from('groups')
    .update({ name })
    .eq('id', id)
    .select();
  if (error) return res.status(400).json({ error });
  res.json(data[0]);
});

// Delete group
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const { error } = await supabase
    .from('groups')
    .delete()
    .eq('id', id);
  if (error) return res.status(400).json({ error });
  res.json({ success: true });
});

module.exports = router;
