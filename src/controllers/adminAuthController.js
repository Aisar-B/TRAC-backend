import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabase } from '../config/supabase.js';
import { storageService } from '../services/cloudinaryService.js';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = '8h';

export const adminLogin = async (req, res) => {
  try {
    console.log('📥 Login request received. Body:', req.body);

    const { username, password } = req.body;

    if (!username || !password) {
      console.log('❌ Missing username or password');
      return res.status(400).json({ 
        message: 'Username and password are required' 
      });
    }

    console.log(`🔍 Looking for admin with username: "${username}"`);

    const { data: admin, error } = await supabase
      .from('admins')
      .select('*')
      .eq('username', username)
      .single();

    if (error) {
      console.log('❌ Supabase error:', error);
    }

    if (!admin) {
      console.log('❌ Admin not found for username:', username);
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    console.log('✅ Admin found:', { id: admin.id, username: admin.username, is_active: admin.is_active });
    console.log('📦 Stored hash (first 20 chars):', admin.password_hash?.substring(0, 20));

    if (!admin.is_active) {
      console.log('❌ Account is deactivated');
      return res.status(401).json({ 
        message: 'Account is deactivated. Please contact the system administrator.' 
      });
    }

    console.log('🔐 Comparing password...');
    const isValidPassword = await bcrypt.compare(password, admin.password_hash);
    console.log('🔐 Password match result:', isValidPassword);

    if (!isValidPassword) {
      console.log('❌ Password mismatch');
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    // Update last login
    await supabase
      .from('admins')
      .update({ last_login: new Date().toISOString() })
      .eq('id', admin.id);

    const token = jwt.sign(
      { 
        userId: admin.id,
        role: admin.role,
        department: admin.department || 'CCS',
        type: 'admin',
        username: admin.username
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    const { password_hash, ...adminData } = admin;

    console.log('✅ Login successful:', { username: admin.username, role: admin.role });

    res.status(200).json({
      message: 'Login successful',
      token,
      admin: adminData,
      user: {
        id: admin.id,
        username: admin.username,
        role: admin.role,
        department: admin.department,
        name: admin.full_name
      }
    });

  } catch (err) {
    console.error('🔥 Admin login error:', err);
    res.status(500).json({ 
      message: 'Login failed. Please try again.' 
    });
  }
};

export const adminRegister = async (req, res) => {
  try {
    const { 
      username, 
      password, 
      email, 
      full_name, 
      role = 'admin',
      department 
    } = req.body;

    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ 
        message: 'Only super admins can create new admins' 
      });
    }

    if (!username || !password) {
      return res.status(400).json({ 
        message: 'Username and password are required' 
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ 
        message: 'Password must be at least 6 characters' 
      });
    }

    const { data: existingAdmin } = await supabase
      .from('admins')
      .select('username')
      .eq('username', username)
      .single();

    if (existingAdmin) {
      return res.status(409).json({ 
        message: 'Username already exists' 
      });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const { data: admin, error } = await supabase
      .from('admins')
      .insert([{
        username,
        password_hash,
        email,
        full_name,
        role,
        department,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;

    const { password_hash: _, ...adminData } = admin;

    res.status(201).json({
      message: 'Admin created successfully',
      admin: adminData
    });

  } catch (err) {
    console.error('Admin registration error:', err);
    res.status(500).json({ 
      message: 'Registration failed. Please try again.' 
    });
  }
};

export const getCurrentAdmin = async (req, res) => {
  try {
    const { data: admin, error } = await supabase
      .from('admins')
      .select('id, username, email, full_name, role, department, last_login, created_at, is_active, avatar_url')
      .eq('id', req.user.userId)
      .single();

    if (error || !admin) {
      return res.status(404).json({ 
        message: 'Admin not found' 
      });
    }

    res.status(200).json(admin);

  } catch (err) {
    console.error('Get current admin error:', err);
    res.status(500).json({ 
      message: 'Failed to get admin data' 
    });
  }
};

export const updateCurrentAdmin = async (req, res) => {
  try {
    const { email, full_name } = req.body;
    const updates = {};

    if (email !== undefined) updates.email = email;
    if (full_name !== undefined) updates.full_name = full_name;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    if (email) {
      const { data: existingAdmin } = await supabase
        .from('admins')
        .select('id')
        .eq('email', email)
        .neq('id', req.user.userId)
        .maybeSingle();

      if (existingAdmin) {
        return res.status(400).json({ message: 'Email already in use by another account' });
      }
    }

    const { data: admin, error } = await supabase
      .from('admins')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', req.user.userId)
      .select('id, username, email, full_name, role, department, last_login, created_at, is_active, avatar_url')
      .single();

    if (error || !admin) throw error || new Error('Admin not found');

    res.status(200).json({ message: 'Profile updated successfully', admin });
  } catch (err) {
    console.error('Update current admin error:', err);
    res.status(500).json({ message: 'Failed to update admin profile' });
  }
};

export const uploadAdminAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'An image file is required' });
    }

    const { data: admin, error: adminError } = await supabase
      .from('admins')
      .select('avatar_public_id')
      .eq('id', req.user.userId)
      .single();

    if (adminError || !admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    const upload = await storageService.uploadImage(req.file, {
      folder: 'trac/avatars/admins'
    });

    const { data: updatedAdmin, error: updateError } = await supabase
      .from('admins')
      .update({ avatar_url: upload.url, avatar_public_id: upload.publicId, updated_at: new Date().toISOString() })
      .eq('id', req.user.userId)
      .select('avatar_url')
      .single();

    if (updateError) {
      await storageService.deleteImage(upload.publicId).catch(() => {});
      throw updateError;
    }

    if (admin.avatar_public_id) {
      await storageService.deleteImage(admin.avatar_public_id).catch((error) => {
        console.error('Previous admin avatar cleanup failed:', error.message);
      });
    }

    res.status(200).json({ message: 'Profile photo updated successfully', avatar_url: updatedAdmin.avatar_url });
  } catch (err) {
    console.error('Upload admin avatar error:', err);
    res.status(500).json({ message: err.message || 'Failed to update profile photo' });
  }
};

export const deleteAdminAvatar = async (req, res) => {
  try {
    const { data: admin, error: adminError } = await supabase
      .from('admins')
      .select('avatar_public_id')
      .eq('id', req.user.userId)
      .single();

    if (adminError || !admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    if (admin.avatar_public_id) {
      await storageService.deleteImage(admin.avatar_public_id);
    }

    const { error } = await supabase
      .from('admins')
      .update({ avatar_url: null, avatar_public_id: null, updated_at: new Date().toISOString() })
      .eq('id', req.user.userId);

    if (error) throw error;

    res.status(200).json({ message: 'Profile photo removed successfully' });
  } catch (err) {
    console.error('Delete admin avatar error:', err);
    res.status(500).json({ message: err.message || 'Failed to remove profile photo' });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    const adminId = req.user.userId;

    if (!current_password || !new_password) {
      return res.status(400).json({ 
        message: 'Current password and new password are required' 
      });
    }

    if (new_password.length < 6) {
      return res.status(400).json({ 
        message: 'New password must be at least 6 characters' 
      });
    }

    const { data: admin, error } = await supabase
      .from('admins')
      .select('*')
      .eq('id', adminId)
      .single();

    if (error || !admin) {
      return res.status(404).json({ 
        message: 'Admin not found' 
      });
    }

    const isValidPassword = await bcrypt.compare(current_password, admin.password_hash);
    
    if (!isValidPassword) {
      return res.status(401).json({ 
        message: 'Current password is incorrect' 
      });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(new_password, salt);
    const { error: updateError } = await supabase
      .from('admins')
      .update({ 
        password_hash,
        updated_at: new Date().toISOString()
      })
      .eq('id', adminId);

    if (updateError) throw updateError;

    res.status(200).json({ 
      message: 'Password changed successfully' 
    });

  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ 
      message: 'Failed to change password' 
    });
  }
};

export const getAllAdmins = async (req, res) => {
  try {
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ 
        message: 'Only super admins can view all admins' 
      });
    }

    const { data: admins, error } = await supabase
      .from('admins')
      .select('id, username, email, full_name, role, department, is_active, last_login, created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.status(200).json(admins);

  } catch (err) {
    console.error('Get all admins error:', err);
    res.status(500).json({ 
      message: 'Failed to get admins' 
    });
  }
};

export const updateAdminStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active, role } = req.body;

    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ 
        message: 'Only super admins can update admin status' 
      });
    }

    if (id === req.user.userId && is_active === false) {
      return res.status(400).json({ 
        message: 'You cannot deactivate your own account' 
      });
    }

    const updates = {
      ...(is_active !== undefined && { is_active }),
      ...(role !== undefined && { role }),
      updated_at: new Date().toISOString()
    };

    const { data: admin, error } = await supabase
      .from('admins')
      .update(updates)
      .eq('id', id)
      .select('id, username, email, full_name, role, is_active')
      .single();

    if (error) throw error;

    res.status(200).json({
      message: 'Admin updated successfully',
      admin
    });

  } catch (err) {
    console.error('Update admin status error:', err);
    res.status(500).json({ 
      message: 'Failed to update admin' 
    });
  }
};

export const verifyAdminToken = async (req, res) => {
  try {
    const adminId = req.user.userId;
    const role = req.user.role;
    const { data: admin, error } = await supabase
      .from('admins')
      .select('id, username, role, is_active')
      .eq('id', adminId)
      .single();

    if (error || !admin || !admin.is_active) {
      return res.status(401).json({ 
        message: 'Admin account is inactive or not found' 
      });
    }

    res.status(200).json({
      valid: true,
      admin: {
        id: admin.id,
        username: admin.username,
        role: admin.role
      }
    });

  } catch (err) {
    console.error('Verify admin token error:', err);
    res.status(500).json({ 
      message: 'Failed to verify token' 
    });
  }
};