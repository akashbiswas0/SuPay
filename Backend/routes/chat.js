const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');

// Chat Groups Management

// Create a new chat group
router.post('/groups', async (req, res) => {
  const { name, description, created_by_user_id } = req.body;
  
  if (!name || !created_by_user_id) {
    return res.status(400).json({ error: 'Name and created_by_user_id are required' });
  }

  try {
    const { data, error } = await supabase
      .from('chat_groups')
      .insert([{ name, description, created_by_user_id }])
      .select();
    
    if (error) throw error;
    res.json(data[0]);
  } catch (error) {
    console.error('Error creating chat group:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get chat group by ID
router.get('/groups/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    const { data, error } = await supabase
      .from('chat_groups')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Chat group not found' });
      }
      throw error;
    }
    
    res.json(data);
  } catch (error) {
    console.error('Error fetching chat group:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get chat groups for a user (both created and member groups)
router.get('/groups/user/:user_id', async (req, res) => {
  const { user_id } = req.params;
  
  try {
    // Get groups where user is creator
    const { data: createdGroups, error: createdError } = await supabase
      .from('chat_groups')
      .select('*')
      .eq('created_by_user_id', user_id)
      .order('updated_at', { ascending: false });
    
    if (createdError) throw createdError;
    
    // Get groups where user is a member
    const { data: memberGroups, error: memberError } = await supabase
      .from('chat_group_members')
      .select(`
        chat_groups (
          id, name, description, created_by_user_id, created_at, updated_at
        )
      `)
      .eq('user_id', user_id);
    
    if (memberError) throw memberError;
    
    // Combine and deduplicate
    const allGroups = [...createdGroups];
    memberGroups.forEach(memberGroup => {
      if (memberGroup.chat_groups && 
          !allGroups.some(g => g.id === memberGroup.chat_groups.id)) {
        allGroups.push(memberGroup.chat_groups);
      }
    });
    
    res.json(allGroups);
  } catch (error) {
    console.error('Error fetching user chat groups:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Update chat group
router.put('/groups/:id', async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;
  
  try {
    const { data, error } = await supabase
      .from('chat_groups')
      .update({ 
        name, 
        description, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', id)
      .select();
    
    if (error) throw error;
    
    if (data.length === 0) {
      return res.status(404).json({ error: 'Chat group not found' });
    }
    
    res.json(data[0]);
  } catch (error) {
    console.error('Error updating chat group:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Delete chat group
router.delete('/groups/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    const { error } = await supabase
      .from('chat_groups')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting chat group:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Chat Group Members Management

// Add member to chat group
router.post('/groups/:group_id/members', async (req, res) => {
  const { group_id } = req.params;
  const { user_id, role = 'member' } = req.body;
  
  if (!user_id) {
    return res.status(400).json({ error: 'user_id is required' });
  }
  
  try {
    const { data, error } = await supabase
      .from('chat_group_members')
      .insert([{ group_id: parseInt(group_id), user_id, role }])
      .select();
    
    if (error) {
      if (error.code === '23505') { // Unique constraint violation
        return res.status(409).json({ error: 'User is already a member of this group' });
      }
      throw error;
    }
    
    res.json(data[0]);
  } catch (error) {
    console.error('Error adding group member:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get members of a chat group
router.get('/groups/:group_id/members', async (req, res) => {
  const { group_id } = req.params;
  
  try {
    const { data, error } = await supabase
      .from('chat_group_members')
      .select(`
        user_id,
        role,
        joined_at,
        users (
          id, name, wallet_address
        )
      `)
      .eq('group_id', group_id)
      .order('joined_at', { ascending: true });
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error fetching group members:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Remove member from chat group
router.delete('/groups/:group_id/members/:user_id', async (req, res) => {
  const { group_id, user_id } = req.params;
  
  try {
    const { error } = await supabase
      .from('chat_group_members')
      .delete()
      .eq('group_id', group_id)
      .eq('user_id', user_id);
    
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('Error removing group member:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Chat Messages Management

// Send a message to a chat group
router.post('/groups/:group_id/messages', async (req, res) => {
  const { group_id } = req.params;
  const { sender_user_id, content, message_type = 'text', parent_message_id } = req.body;
  
  if (!sender_user_id || !content) {
    return res.status(400).json({ error: 'sender_user_id and content are required' });
  }
  
  try {
    // Allow anyone to send messages - removed membership verification
    
    const { data, error } = await supabase
      .from('chat_group_messages')
      .insert([{ 
        group_id: parseInt(group_id), 
        sender_user_id, 
        content, 
        message_type,
        parent_message_id 
      }])
      .select(`
        *,
        users (
          id, name, wallet_address
        )
      `);
    
    if (error) throw error;
    
    // Update group's updated_at timestamp
    await supabase
      .from('chat_groups')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', group_id);
    
    res.json(data[0]);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get messages from a chat group with pagination
router.get('/groups/:group_id/messages', async (req, res) => {
  const { group_id } = req.params;
  const { limit = 50, offset = 0, before_id } = req.query;
  
  try {
    // Allow anyone to view messages - removed membership verification
    let query = supabase
      .from('chat_group_messages')
      .select(`
        *,
        users (
          id, name, wallet_address
        ),
        parent_message:parent_message_id (
          id, content, sender_user_id,
          users (
            id, name, wallet_address
          )
        )
      `)
      .eq('group_id', group_id)
      .order('sent_at', { ascending: false })
      .limit(parseInt(limit))
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);
    
    if (before_id) {
      query = query.lt('id', before_id);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    // Reverse to show oldest first
    res.json(data.reverse());
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Direct Chat Management (1-to-1 using group structure)

// Create or get direct chat between two users
router.post('/direct', async (req, res) => {
  const { user1_id, user2_id } = req.body;
  
  if (!user1_id || !user2_id) {
    return res.status(400).json({ error: 'Both user1_id and user2_id are required' });
  }
  
  if (user1_id === user2_id) {
    return res.status(400).json({ error: 'Cannot create direct chat with yourself' });
  }
  
  try {
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
      const existingGroup = existingChats.find(chat => 
        chat.group_id == existingDirectChat
      )?.chat_groups;
      return res.json(existingGroup);
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
    
    res.json(newGroup);
  } catch (error) {
    console.error('Error creating/getting direct chat:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get direct chats for a user
router.get('/direct/user/:user_id', async (req, res) => {
  const { user_id } = req.params;
  
  try {
    const { data, error } = await supabase
      .from('chat_group_members')
      .select(`
        chat_groups (
          id, name, description, created_by_user_id, created_at, updated_at
        )
      `)
      .eq('user_id', user_id);
    
    if (error) throw error;
    
    // Filter for direct chats and get the other user's info
    const directChats = [];
    
    for (const memberData of data) {
      const group = memberData.chat_groups;
      if (group && group.name.startsWith('direct_')) {
        // Get the other member
        const { data: members, error: membersError } = await supabase
          .from('chat_group_members')
          .select(`
            user_id,
            users (
              id, name, wallet_address
            )
          `)
          .eq('group_id', group.id)
          .neq('user_id', user_id);
        
        if (membersError) {
          console.error('Error fetching other member:', membersError);
          continue;
        }
        
        if (members.length > 0) {
          directChats.push({
            ...group,
            other_user: members[0].users
          });
        }
      }
    }
    
    res.json(directChats);
  } catch (error) {
    console.error('Error fetching direct chats:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Integration with existing user_groups system

// Create or get chat group for an existing user group
router.post('/groups/from-user-group', async (req, res) => {
  const { user_group_id, user_id } = req.body;
  
  if (!user_group_id || !user_id) {
    return res.status(400).json({ error: 'user_group_id and user_id are required' });
  }
  
  try {
    // Allow anyone to create/access chat groups - removed membership verification
    
    // Check if chat group already exists for this user group
    const chatGroupName = `group_${user_group_id}`;
    const { data: existingChatGroup, error: existingError } = await supabase
      .from('chat_groups')
      .select('*')
      .eq('name', chatGroupName)
      .single();
    
    if (!existingError && existingChatGroup) {
      return res.json(existingChatGroup);
    }
    
    // Get the group details
    const { data: groupDetails, error: groupError } = await supabase
      .from('groups')
      .select('*')
      .eq('id', user_group_id)
      .single();
    
    if (groupError || !groupDetails) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    // Create new chat group
    const { data: newChatGroup, error: chatGroupError } = await supabase
      .from('chat_groups')
      .insert([{
        name: chatGroupName,
        description: `Chat for ${groupDetails.name}`,
        created_by_user_id: user_id
      }])
      .select()
      .single();
    
    if (chatGroupError) throw chatGroupError;
    
    // Get all members of the user group
    const { data: allMembers, error: membersError } = await supabase
      .from('user_groups')
      .select('user_id')
      .eq('group_id', user_group_id);
    
    if (membersError) throw membersError;
    
    // Add all members to the chat group
    const chatMembersData = allMembers.map(member => ({
      group_id: newChatGroup.id,
      user_id: member.user_id,
      role: member.user_id === user_id ? 'admin' : 'member'
    }));
    
    const { error: addMembersError } = await supabase
      .from('chat_group_members')
      .insert(chatMembersData);
    
    if (addMembersError) throw addMembersError;
    
    res.json(newChatGroup);
  } catch (error) {
    console.error('Error creating chat group from user group:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

module.exports = router;