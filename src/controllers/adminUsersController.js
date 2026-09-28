// backend/src/controllers/adminUsersController.js

import { supabase } from '../config/supabase.js';
import { hashPassword } from '../utils/hash.js';
import { adminAppUrl, sendEmail } from '../config/email.js';
import { renderEmailHeader } from '../utils/emailLayout.js';

// Helper: Generate random password
const generateTempPassword = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$';
  let password = '';
  for (let i = 0; i < 10; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

// Helper: Generate username from email
const generateUsername = (email) => {
  return email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
};

// Department list for validation
const VALID_DEPARTMENTS = ['CCS', 'COED', 'CAS', 'COF', 'CIAS', 'IOES', 'ALL'];

// =============================================
// GET ALL ADMIN USERS
// =============================================
export const getAllAdminUsers = async (req, res) => {
  try {
    const { data: users, error } = await supabase
      .from('admins')
      .select('id, username, email, full_name, role, department, is_active, last_login, created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const transformedUsers = users.map(user => ({
      id: user.id,
      name: user.full_name,
      username: user.username,
      email: user.email,
      role: user.role,
      status: user.is_active ? 'active' : 'inactive',
      department: user.department || 'CCS',
      last_active: user.last_login,
      created_at: user.created_at
    }));

    res.status(200).json({
      success: true,
      users: transformedUsers
    });
  } catch (err) {
    console.error('Error fetching admin users:', err);
    res.status(500).json({ error: err.message });
  }
};

// =============================================
// ADD NEW ADMIN USER
// =============================================
export const addAdminUser = async (req, res) => {
  try {
    let { name, email, phone, role = 'staff', department = 'CCS' } = req.body;

    if (!name || !email) {
      return res.status(400).json({ message: 'Name and email are required' });
    }

    // Validate department
    if (!VALID_DEPARTMENTS.includes(department)) {
      return res.status(400).json({ message: 'Invalid department selected' });
    }

    // Check if user already exists
    const { data: existing, error: checkError } = await supabase
      .from('admins')
      .select('id')
      .eq('email', email)
      .single();

    if (existing) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    // Generate username and temporary password
    const username = generateUsername(email);
    const tempPassword = generateTempPassword();
    const password_hash = await hashPassword(tempPassword);

    // If department is 'ALL', automatically set role to 'super_admin'
    const finalRole = department === 'ALL' ? 'super_admin' : role;

    const { data: newUser, error } = await supabase
      .from('admins')
      .insert([{
        username,
        email,
        full_name: name,
        role: finalRole,
        department: department,
        password_hash,
        is_active: true,
        created_at: new Date().toISOString()
      }])
      .select('id, username, email, full_name, role, department, is_active, created_at')
      .single();

    if (error) throw error;

    // Send invitation email with CORRECT login link
    const departmentDisplay = department === 'ALL' ? 'All Departments (Registrar)' : department;
    const subject = 'Your TRAC Request admin account';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; background: #f1f8e9; padding: 24px; border: 1px solid #c8e6c9; border-radius: 12px;">
        ${renderEmailHeader()}
        <h2 style="color: #1B5E20;">Welcome to TRAC Request Admin</h2>
        <p>Dear ${name},</p>
        <p>Your admin account has been created. You can now login using:</p>
        <div style="background: #fff; padding: 15px; border-left: 4px solid #F9A825; border-radius: 8px; margin: 15px 0;">
          <p><strong>Username:</strong> ${username}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Temporary Password:</strong> ${tempPassword}</p>
          <p><strong>Assigned Department:</strong> ${departmentDisplay}</p>
        </div>
        <p>Please change your password after first login.</p>
        <a href="${adminAppUrl}/login" style="display: inline-block; background: #1B5E20; color: white; padding: 10px 20px; text-decoration: none; border-radius: 8px; margin-top: 10px;">Go to Admin Login</a>
        <p style="margin-top: 20px; font-size: 12px; color: #666;">This is an automated message, please do not reply.</p>
      </div>
    `;
    
    await sendEmail(email, subject, html).catch(err => console.log('Email error:', err));

    res.status(201).json({
      success: true,
      message: 'Admin user added successfully',
      user: {
        id: newUser.id,
        name: newUser.full_name,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
        department: newUser.department,
        status: newUser.is_active ? 'active' : 'inactive',
        created_at: newUser.created_at
      }
    });
  } catch (err) {
    console.error('Error adding admin user:', err);
    res.status(500).json({ error: err.message });
  }
};

// =============================================
// UPDATE ADMIN USER
// =============================================
export const updateAdminUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, status, role, department } = req.body;

    const updateData = {};
    if (name !== undefined) updateData.full_name = name;
    if (email !== undefined) updateData.email = email;
    if (role !== undefined) updateData.role = role;
    if (department !== undefined && VALID_DEPARTMENTS.includes(department)) updateData.department = department;
    if (status !== undefined) updateData.is_active = status === 'active';
    
    updateData.updated_at = new Date().toISOString();

    const { data: updatedUser, error } = await supabase
      .from('admins')
      .update(updateData)
      .eq('id', id)
      .select('id, username, email, full_name, role, department, is_active, created_at')
      .single();

    if (error) throw error;

    res.status(200).json({
      success: true,
      message: 'Admin user updated successfully',
      user: {
        id: updatedUser.id,
        name: updatedUser.full_name,
        username: updatedUser.username,
        email: updatedUser.email,
        role: updatedUser.role,
        department: updatedUser.department,
        status: updatedUser.is_active ? 'active' : 'inactive',
        created_at: updatedUser.created_at
      }
    });
  } catch (err) {
    console.error('Error updating admin user:', err);
    res.status(500).json({ error: err.message });
  }
};

// =============================================
// DELETE ADMIN USER
// =============================================
export const deleteAdminUser = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: user, error: fetchError } = await supabase
      .from('admins')
      .select('role')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    if (user.role === 'super_admin') {
      return res.status(400).json({ message: 'Cannot delete the Registrar account' });
    }

    const { error } = await supabase
      .from('admins')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.status(200).json({
      success: true,
      message: 'Admin user deleted successfully'
    });
  } catch (err) {
    console.error('Error deleting admin user:', err);
    res.status(500).json({ error: err.message });
  }
};

// =============================================
// RESET ADMIN PASSWORD
// =============================================
export const resetAdminPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { email, name } = req.body;

    const tempPassword = generateTempPassword();
    const password_hash = await hashPassword(tempPassword);

    const { error } = await supabase
      .from('admins')
      .update({
        password_hash,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw error;

    const subject = 'Password Reset - TRAC Request Admin';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; background: #f1f8e9; padding: 24px; border: 1px solid #c8e6c9; border-radius: 12px;">
        ${renderEmailHeader()}
        <h2 style="color: #1B5E20;">Password Reset</h2>
        <p>Dear ${name},</p>
        <p>Your password has been reset. Use the following temporary password to login:</p>
        <div style="background: #fff; padding: 15px; border-left: 4px solid #F9A825; border-radius: 8px; margin: 15px 0;">
          <p><strong>Temporary Password:</strong> ${tempPassword}</p>
        </div>
        <p>Please change your password after logging in.</p>
        <p style="color: #1B5E20; font-weight: bold;">Use the TRAC Request Admin Login page to continue.</p>
        <a href="${adminAppUrl}/login" style="display: inline-block; background: #1B5E20; color: white; padding: 10px 20px; text-decoration: none; border-radius: 8px;">Go to Admin Login</a>
      </div>
    `;
    
    await sendEmail(email, subject, html).catch(err => console.log('Email error:', err));

    res.status(200).json({
      success: true,
      message: 'Password reset email sent successfully'
    });
  } catch (err) {
    console.error('Error resetting password:', err);
    res.status(500).json({ error: err.message });
  }
};