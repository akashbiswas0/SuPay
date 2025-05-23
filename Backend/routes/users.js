const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');

// Create user
router.post('/', async (req, res) => {
  const { wallet_address, name } = req.body;
  
  // Add validation
  if (!wallet_address || !name) {
    return res.status(400).json({ 
      error: 'Both wallet address and name are required' 
    });
  }

  try {
    // Check if wallet already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('wallet_address', wallet_address)
      .single();

    if (existingUser) {
      return res.status(409).json({ 
        error: 'Wallet address already registered' 
      });
    }

    // Create new user
    const { data, error } = await supabase
      .from('users')
      .insert([{ wallet_address, name }])
      .select();

    if (error) throw error;
    res.json(data[0]);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ 
      error: error.message || 'Internal server error' 
    });
  }
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

// Get user by UUID
router.get('/by-id/:uuid', async (req, res) => {
  const { uuid } = req.params;
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', uuid)
      .single();
    if (error || !data) return res.status(404).json({ error: error || 'User not found' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
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
