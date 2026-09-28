import { supabase } from '../config/supabase.js';
import { DEFAULT_INSTITUTES, normalizeInstitutes } from '../utils/academicCatalog.js';
import { hashPassword, comparePassword } from '../utils/hash.js';
import { generateToken } from '../config/jwt.js';
import { sendEmail, studentAppUrl } from '../config/email.js';
import { storageService } from '../services/cloudinaryService.js';
import { renderEmailHeader } from '../utils/emailLayout.js';

// =============================================
// HELPER: Generate OTP Code
// =============================================
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// =============================================
// HELPER: Send Email Verification OTP
// =============================================
const sendVerificationEmail = async (email, otpCode, name) => {
  const subject = 'Verify Your Email - TRAC Request';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      ${renderEmailHeader()}
      
      <div style="background-color: #dcedc8; padding: 20px; border-left: 4px solid #2E7D32; border-radius: 8px;">
        <h3 style="color: #1B5E20;">Verify Your Email Address</h3>
        <p>Dear ${name},</p>
        <p>Thank you for creating an account with TRAC Request. Please verify your email address by entering the code below:</p>
        
        <div style="background-color: #fff; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1B5E20;">${otpCode}</span>
        </div>
        
        <p>This code will expire in <strong>30 minutes</strong>.</p>
        <p>If you didn't create this account, please ignore this email.</p>
      </div>
      
      <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center; color: #999; font-size: 12px;">
        <p>TRAC Request | Registrar document services</p>
      </div>
    </div>
  `;
  
  return await sendEmail(email, subject, html);
};

// =============================================
// HELPER: Send Welcome Email (after verification)
// =============================================
const sendWelcomeEmail = async (email, name) => {
  const subject = 'Welcome to TRAC Request';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      ${renderEmailHeader()}
      
      <div style="background-color: #dcedc8; padding: 20px; border-left: 4px solid #2E7D32; border-radius: 8px;">
        <h3 style="color: #1B5E20;">Welcome to TRAC Request</h3>
        <p>Dear ${name},</p>
        <p>Your email has been successfully verified! You can now login to the system and start requesting documents.</p>
        
        <div style="background-color: #fff; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
          <p style="margin: 0;">Login to your account at:</p>
          <p style="font-weight: bold; margin: 5px 0;"><a href="${studentAppUrl}" style="color: #1B5E20;">Open TRAC Request</a></p>
        </div>
        
        <p>Thank you for joining TRAC Request!</p>
      </div>
      
      <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center; color: #999; font-size: 12px;">
        <p>TRAC Request | Registrar document services</p>
      </div>
    </div>
  `;
  
  return await sendEmail(email, subject, html);
};

// =============================================
// HELPER: Send Password Reset OTP Email
// =============================================
const sendOTPEmail = async (email, otpCode, name) => {
  const subject = 'Password Reset - TRAC Request';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      ${renderEmailHeader()}
      
      <div style="background-color: #fff8e1; padding: 20px; border-left: 4px solid #F9A825; border-radius: 8px;">
        <h3 style="color: #8a5a00;">Password Reset Request</h3>
        <p>Dear ${name},</p>
        <p>We received a request to reset your password. Use the following code to proceed:</p>
        
        <div style="background-color: #fff; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1B5E20;">${otpCode}</span>
        </div>
        
        <p>This code will expire in <strong>30 minutes</strong>.</p>
        <p>If you didn't request this, please ignore this email.</p>
      </div>
      
      <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center; color: #999; font-size: 12px;">
        <p>TRAC Request | Registrar document services</p>
      </div>
    </div>
  `;
  
  return await sendEmail(email, subject, html);
};

// =============================================
// SIGNUP - Send verification email (NOT auto-verified)
// =============================================
export const signup = async (req, res) => {
  try {
    const {
      role,
      id_number,
      last_name,
      first_name,
      middle_name,
      year_level,
      year_graduated,
      department,
      course,
      email,
      password,
      confirmPassword
    } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match' });
    }

    if (!['student', 'alumni'].includes(role)) {
      return res.status(400).json({ message: 'Select a valid account role.' });
    }

    const { data: settings, error: settingsError } = await supabase
      .from('system_settings')
      .select('academic_settings')
      .single();
    if (settingsError && settingsError.code !== 'PGRST116') throw settingsError;
    const institutes = normalizeInstitutes(settings?.academic_settings || DEFAULT_INSTITUTES);
    const selectedInstitute = institutes.find((institute) => institute.code === String(department || '').trim().toUpperCase());
    if (!selectedInstitute) {
      return res.status(400).json({ message: 'Select an active institute from the current signup list.' });
    }
    if (!selectedInstitute.programs.some((program) => program.name === String(course || '').trim())) {
      return res.status(400).json({ message: 'Select a course offered by the chosen institute.' });
    }

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    const password_hash = await hashPassword(password);

    // Generate verification OTP
    const verificationCode = generateOTP();
    const nowUTC = new Date();
    const expiresAtUTC = new Date(nowUTC.getTime() + 30 * 60 * 1000); // 30 minutes

    console.log('🔐 Signup - New User (Pending Verification):');
    console.log('  - ID Number:', id_number);
    console.log('  - Email:', email);
    console.log('  - Role:', role);
    console.log('  - Verification Code:', verificationCode);

    // Create user with is_verified = false
    const { data: newUser, error } = await supabase.from('users').insert([{
      role,
      id_number,
      last_name,
      first_name,
      middle_name,
      year_level: role === 'student' ? year_level : null,
      year_graduated: role === 'alumni' ? year_graduated : null,
      department,
      course,
      email,
      password_hash,
      is_verified: false,
      verified_at: null,
      verification_token: verificationCode,
      verification_token_expires: expiresAtUTC.toISOString()
    }]).select().single();

    if (error) {
      console.error('Signup error:', error);
      throw error;
    }

    // Send verification email
    const fullName = `${first_name} ${last_name}`;
    await sendVerificationEmail(email, verificationCode, fullName).catch(err => console.log('Verification email failed:', err.message));

    res.status(201).json({ 
      message: 'Account created! Please check your email for verification code.',
      userId: newUser.id,
      requiresVerification: true
    });

  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: err.message });
  }
};

// =============================================
// VERIFY EMAIL - Verify user after signup
// =============================================
export const verifyEmail = async (req, res) => {
  try {
    const { userId, otpCode } = req.body;

    if (!userId || !otpCode) {
      return res.status(400).json({ message: 'User ID and verification code are required' });
    }

    // Get user
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if already verified
    if (user.is_verified) {
      return res.status(400).json({ message: 'Email already verified. You can now login.' });
    }

    // Check verification code
    if (user.verification_token !== otpCode) {
      return res.status(400).json({ message: 'Invalid verification code' });
    }

    // Check if expired
    const expiresAt = new Date(user.verification_token_expires);
    const nowUTC = new Date();

    if (nowUTC.getTime() > expiresAt.getTime()) {
      return res.status(400).json({ message: 'Verification code has expired. Please request a new one.' });
    }

    // Update user as verified
    const { error: updateError } = await supabase
      .from('users')
      .update({
        is_verified: true,
        verified_at: new Date().toISOString(),
        verification_token: null,
        verification_token_expires: null
      })
      .eq('id', userId);

    if (updateError) throw updateError;

    // Send welcome email
    const fullName = `${user.first_name} ${user.last_name}`;
    await sendWelcomeEmail(user.email, fullName).catch(err => console.log('Welcome email failed:', err.message));

    console.log('✅ Email verified for user:', userId);

    res.status(200).json({
      message: 'Email verified successfully! You can now login.',
      verified: true
    });

  } catch (err) {
    console.error('Verify email error:', err);
    res.status(500).json({ error: err.message });
  }
};

// =============================================
// RESEND VERIFICATION CODE
// =============================================
export const resendVerificationCode = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    // Get user
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if already verified
    if (user.is_verified) {
      return res.status(400).json({ message: 'Email already verified. You can now login.' });
    }

    // Generate new verification code
    const newCode = generateOTP();
    const nowUTC = new Date();
    const expiresAtUTC = new Date(nowUTC.getTime() + 30 * 60 * 1000); // 30 minutes

    // Update user with new code
    const { error: updateError } = await supabase
      .from('users')
      .update({
        verification_token: newCode,
        verification_token_expires: expiresAtUTC.toISOString()
      })
      .eq('id', userId);

    if (updateError) throw updateError;

    // Send new verification email
    const fullName = `${user.first_name} ${user.last_name}`;
    await sendVerificationEmail(user.email, newCode, fullName).catch(err => console.log('Verification email failed:', err.message));

    console.log('📧 Resent verification code to:', user.email);

    res.status(200).json({
      message: 'New verification code sent to your email',
      userId: userId
    });

  } catch (err) {
    console.error('Resend verification error:', err);
    res.status(500).json({ error: err.message });
  }
};

// =============================================
// LOGIN - Check if user is verified
// =============================================
export const login = async (req, res) => {
  try {
    const { id_number, password } = req.body;

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id_number', id_number)
      .single();

    if (error || !data) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check if email is verified
    if (!data.is_verified) {
      return res.status(403).json({ 
        message: 'Please verify your email first. Check your inbox for the verification code.',
        requiresVerification: true,
        userId: data.id
      });
    }

    const isValid = await comparePassword(password, data.password_hash);
    if (!isValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = generateToken({
      userId: data.id,
      role: data.role
    });

    res.json({
      token,
      user: {
        id_number: data.id_number,
        name: `${data.first_name} ${data.last_name}`,
        role: data.role
      }
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// =============================================
// REQUEST PASSWORD RESET (EMAIL ONLY)
// =============================================
export const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !user) {
      return res.status(200).json({ 
        message: 'If an account exists with that email, you will receive a reset code.',
        userId: null 
      });
    }

    // Check if user is verified
    if (!user.is_verified) {
      return res.status(403).json({ 
        message: 'Please verify your email first before resetting password.',
        requiresVerification: true,
        userId: user.id
      });
    }

    const otpCode = generateOTP();
    
    const nowUTC = new Date();
    const expiresAtUTC = new Date(nowUTC.getTime() + 30 * 60 * 1000);
    
    console.log('🔐 OTP Created (UTC):', {
      userId: user.id,
      email: user.email,
      now_utc: nowUTC.toISOString(),
      expires_at: expiresAtUTC.toISOString()
    });

    const { error: saveError } = await supabase
      .from('password_reset_otp')
      .insert([{
        user_id: user.id,
        code: otpCode,
        type: 'email',
        expires_at: expiresAtUTC.toISOString(),
        is_used: false
      }]);

    if (saveError) throw saveError;

    const fullName = `${user.first_name} ${user.last_name}`;
    await sendOTPEmail(user.email, otpCode, fullName);

    res.status(200).json({
      message: `Verification code sent to ${email}`,
      userId: user.id,
      method: 'email'
    });

  } catch (err) {
    console.error('Request password reset error:', err);
    res.status(500).json({ error: err.message });
  }
};

// =============================================
// VERIFY RESET OTP
// =============================================
export const verifyResetOTP = async (req, res) => {
  try {
    const { userId, otpCode } = req.body;

    if (!userId || !otpCode) {
      return res.status(400).json({ message: 'User ID and OTP code are required' });
    }

    const { data: otpRecord, error } = await supabase
      .from('password_reset_otp')
      .select('*')
      .eq('user_id', userId)
      .eq('code', otpCode)
      .eq('is_used', false)
      .single();

    if (error || !otpRecord) {
      return res.status(400).json({ message: 'Invalid verification code' });
    }

    const expiresAt = new Date(otpRecord.expires_at);
    const nowUTC = new Date();
    
    console.log('🔍 OTP Verification Check (UTC):', {
      userId: userId,
      otpCode: otpCode,
      expires_at: expiresAt.toISOString(),
      now_utc: nowUTC.toISOString(),
      isExpired: nowUTC.getTime() > expiresAt.getTime(),
      timeDifference: Math.floor((nowUTC.getTime() - expiresAt.getTime()) / 1000 / 60) + ' minutes'
    });
    
    if (nowUTC.getTime() > expiresAt.getTime()) {
      return res.status(400).json({ message: 'Verification code has expired. Please request a new one.' });
    }

    await supabase
      .from('password_reset_otp')
      .update({ is_used: true })
      .eq('id', otpRecord.id);

    const resetToken = generateOTP();
    const nowUTC2 = new Date();
    const resetTokenExpiresUTC = new Date(nowUTC2.getTime() + 120 * 60 * 1000);
    
    console.log('🔐 Reset Token Created (UTC):', {
      userId: userId,
      resetToken: resetToken,
      now_utc: nowUTC2.toISOString(),
      expires_at_utc: resetTokenExpiresUTC.toISOString()
    });

    const { error: updateError } = await supabase
      .from('users')
      .update({
        reset_token: resetToken,
        reset_token_expires: resetTokenExpiresUTC.toISOString()
      })
      .eq('id', userId);

    if (updateError) throw updateError;

    res.status(200).json({
      message: 'OTP verified successfully',
      resetToken: resetToken,
      userId: userId
    });

  } catch (err) {
    console.error('Verify OTP error:', err);
    res.status(500).json({ error: err.message });
  }
};

// =============================================
// RESET PASSWORD
// =============================================
export const resetPassword = async (req, res) => {
  try {
    const { userId, resetToken, newPassword, confirmPassword } = req.body;

    if (!userId || !resetToken || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .eq('reset_token', resetToken)
      .single();

    if (error || !user) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    const expiresAt = new Date(user.reset_token_expires);
    const nowUTC = new Date();
    
    console.log('🔐 Reset Password Check:', {
      userId: userId,
      resetToken: resetToken,
      expires_at: expiresAt.toISOString(),
      now_utc: nowUTC.toISOString(),
      isExpired: nowUTC.getTime() > expiresAt.getTime()
    });
    
    if (nowUTC.getTime() > expiresAt.getTime()) {
      return res.status(400).json({ message: 'Reset token has expired. Please request a new password reset.' });
    }

    const password_hash = await hashPassword(newPassword);

    await supabase
      .from('users')
      .update({
        password_hash,
        reset_token: null,
        reset_token_expires: null
      })
      .eq('id', userId);

    console.log('✅ Password reset successful for user:', userId);

    res.status(200).json({
      message: 'Password reset successfully. You can now login with your new password.'
    });

  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: err.message });
  }
};

// =============================================
// GET USER PROFILE
// =============================================
export const getProfile = async (req, res) => {
  try {
    const { userId } = req.user;

    const { data: user, error } = await supabase
      .from('users')
      .select('id_number, first_name, last_name, middle_name, email, course, year_level, year_graduated, department, role, is_verified, avatar_url')
      .eq('id', userId)
      .single();

    if (error || !user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const fullName = `${user.first_name} ${user.middle_name ? user.middle_name + '. ' : ''}${user.last_name}`;

    res.status(200).json({
      success: true,
      profile: {
        id_number: user.id_number,
        full_name: fullName,
        first_name: user.first_name,
        last_name: user.last_name,
        middle_name: user.middle_name,
        email: user.email,
        course: user.course,
        year_level: user.year_level,
        year_graduated: user.year_graduated,
        department: user.department,
        role: user.role,
        is_verified: user.is_verified,
        avatar_url: user.avatar_url
      }
    });

  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: err.message });
  }
};

// =============================================
// UPDATE USER PROFILE
// =============================================
export const updateProfile = async (req, res) => {
  try {
    const { userId } = req.user;
    const { email, course, year_level, year_graduated, department } = req.body;

    // Prepare updates (only editable fields)
    const updates = {};
    if (email !== undefined) updates.email = email;
    if (course !== undefined) updates.course = course;
    if (year_level !== undefined) updates.year_level = year_level;
    if (year_graduated !== undefined) updates.year_graduated = year_graduated;
    if (department !== undefined) updates.department = department;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    // Check if email is already taken by another user
    if (email) {
      const { data: existingUser, error: checkError } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .neq('id', userId)
        .single();

      if (existingUser) {
        return res.status(400).json({ message: 'Email already in use by another account' });
      }
    }

    const { data: updatedUser, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select('id_number, first_name, last_name, middle_name, email, course, year_level, year_graduated, department, role, avatar_url')
      .single();

    if (error) throw error;

    const fullName = `${updatedUser.first_name} ${updatedUser.middle_name ? updatedUser.middle_name + '. ' : ''}${updatedUser.last_name}`;

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      profile: {
        id_number: updatedUser.id_number,
        full_name: fullName,
        email: updatedUser.email,
        course: updatedUser.course,
        year_level: updatedUser.year_level,
        year_graduated: updatedUser.year_graduated,
        department: updatedUser.department,
        role: updatedUser.role,
        avatar_url: updatedUser.avatar_url
      }
    });

  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const uploadProfileAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'An image file is required' });
    }

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('avatar_public_id')
      .eq('id', req.user.userId)
      .single();

    if (userError || !user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const upload = await storageService.uploadImage(req.file, {
      folder: 'trac/avatars/students'
    });

    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update({ avatar_url: upload.url, avatar_public_id: upload.publicId })
      .eq('id', req.user.userId)
      .select('avatar_url, avatar_public_id')
      .single();

    if (updateError) {
      await storageService.deleteImage(upload.publicId).catch(() => {});
      throw updateError;
    }

    if (user.avatar_public_id) {
      await storageService.deleteImage(user.avatar_public_id).catch((error) => {
        console.error('Previous student avatar cleanup failed:', error.message);
      });
    }

    res.status(200).json({
      success: true,
      message: 'Profile photo updated successfully',
      avatar_url: updatedUser.avatar_url
    });
  } catch (err) {
    console.error('Upload profile avatar error:', err);
    res.status(500).json({ message: err.message || 'Failed to update profile photo' });
  }
};

export const deleteProfileAvatar = async (req, res) => {
  try {
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('avatar_public_id')
      .eq('id', req.user.userId)
      .single();

    if (userError || !user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.avatar_public_id) {
      await storageService.deleteImage(user.avatar_public_id);
    }

    const { error } = await supabase
      .from('users')
      .update({ avatar_url: null, avatar_public_id: null })
      .eq('id', req.user.userId);

    if (error) throw error;

    res.status(200).json({ success: true, message: 'Profile photo removed successfully' });
  } catch (err) {
    console.error('Delete profile avatar error:', err);
    res.status(500).json({ message: err.message || 'Failed to remove profile photo' });
  }
};

// =============================================
// CHANGE PASSWORD
// =============================================
export const changePassword = async (req, res) => {
  try {
    const { userId } = req.user;
    const { currentPassword, newPassword, confirmPassword } = req.body;

    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: 'All password fields are required' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: 'New passwords do not match' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    const hasUpper = /[A-Z]/.test(newPassword);
    const hasLower = /[a-z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);
    const hasSpecial = /[^A-Za-z0-9]/.test(newPassword);

    if (!hasUpper || !hasLower || !hasNumber || !hasSpecial) {
      return res.status(400).json({ 
        message: 'Password must contain uppercase, lowercase, number, and special character' 
      });
    }

    // Get current user
    const { data: user, error } = await supabase
      .from('users')
      .select('password_hash')
      .eq('id', userId)
      .single();

    if (error || !user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify current password
    const isValid = await comparePassword(currentPassword, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);

    // Update password
    const { error: updateError } = await supabase
      .from('users')
      .update({ password_hash: newPasswordHash })
      .eq('id', userId);

    if (updateError) throw updateError;

    console.log('✅ Password changed for user:', userId);

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: err.message });
  }
};