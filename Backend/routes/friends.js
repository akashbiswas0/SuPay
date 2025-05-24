const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');

// Add a friend
router.post('/', async (req, res) => {
  const { user_id, friend_id } = req.body;
  
  try {
    // Add the friendship record
    const { data: friendshipData, error: friendshipError } = await supabase
      .from('friends')
      .insert([{ user_id, friend_id }])
      .select();
    
    if (friendshipError) {
      return res.status(400).json({ error: friendshipError });
    }

    // Create bidirectional friendship (so both users can see each other as friends)
    const { error: bidirectionalError } = await supabase
      .from('friends')
      .insert([{ user_id: friend_id, friend_id: user_id }])
      .select();
    
    // Don't fail if bidirectional friendship already exists
    if (bidirectionalError && bidirectionalError.code !== '23505') {
      console.warn('Warning: Could not create bidirectional friendship:', bidirectionalError);
    }

    // Automatically create a direct chat between the two users
    try {
      await createDirectChatForUsers(user_id, friend_id);
    } catch (chatError) {
      console.warn('Warning: Could not create direct chat:', chatError);
      // Don't fail the friendship creation if chat creation fails
    }

    res.json(friendshipData[0]);
  } catch (error) {
    console.error('Error adding friend:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Helper function to create direct chat between two users
async function createDirectChatForUsers(user1_id, user2_id) {
  // Check if direct chat already exists between these users
  const { data: existingChats, error: searchError } = await supabase
    .from('chat_group_members')
    .select(`
      group_id,
      chat_groups (
        id, name, description, created_by_user_id, created_at, updated_at
      )
    `)
    .in('user_id', [user1_id, user2_id]);

  if (searchError) throw searchError;

  // Find groups that have both users and are direct chats (name starts with "direct_")
  const groupCounts = {};
  existingChats.forEach(chat => {
    if (chat.chat_groups && chat.chat_groups.name.startsWith('direct_')) {
      groupCounts[chat.group_id] = (groupCounts[chat.group_id] || 0) + 1;
    }
  });

  // Find group where both users are members (count = 2)
  const existingDirectChat = Object.keys(groupCounts).find(groupId => groupCounts[groupId] === 2);

  if (existingDirectChat) {
    // Direct chat already exists, no need to create
    return;
  }

  // Create new direct chat group
  const directChatName = `direct_${user1_id < user2_id ? user1_id : user2_id}_${user1_id < user2_id ? user2_id : user1_id}`;

  const { data: newGroup, error: groupError } = await supabase
    .from('chat_groups')
    .insert([{ 
      name: directChatName,
      description: 'Direct conversation',
      created_by_user_id: user1_id 
    }])
    .select()
    .single();

  if (groupError) throw groupError;

  // Add both users as members
  const { error: membersError } = await supabase
    .from('chat_group_members')
    .insert([
      { group_id: newGroup.id, user_id: user1_id, role: 'member' },
      { group_id: newGroup.id, user_id: user2_id, role: 'member' }
    ]);

  if (membersError) throw membersError;
}

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
