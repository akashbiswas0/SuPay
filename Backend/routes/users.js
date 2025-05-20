const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');

// Create user
router.post('/', async (req, res) => {
  const { wallet_address, name } = req.body;
  const { data, error } = await supabase
    .from('users')
    .insert([{ wallet_address, name }])
    .select();
  if (error) return res.status(400).json({ error });
  res.json(data[0]);
});

// Get user by wallet address
router.get('/:wallet_address', async (req, res) => {
  const { wallet_address } = req.params;
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('wallet_address', wallet_address)
    .single();
  if (error) return res.status(404).json({ error });
  res.json(data);
});

// Update user
router.put('/:wallet_address', async (req, res) => {
  const { wallet_address } = req.params;
  const { name } = req.body;
  const { data, error } = await supabase
    .from('users')
    .update({ name })
    .eq('wallet_address', wallet_address)
    .select();
  if (error) return res.status(400).json({ error });
  res.json(data[0]);
});

// Delete user
router.delete('/:wallet_address', async (req, res) => {
  const { wallet_address } = req.params;
  const { error } = await supabase
    .from('users')
    .delete()
    .eq('wallet_address', wallet_address);
  if (error) return res.status(400).json({ error });
  res.json({ success: true });
});

module.exports = router;
