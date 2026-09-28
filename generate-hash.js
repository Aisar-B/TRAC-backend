import bcrypt from 'bcryptjs';

async function generateHash() {
  const password = process.env.ADMIN_INITIAL_PASSWORD;
  if (!password) {
    console.error('Set ADMIN_INITIAL_PASSWORD in your local environment before running this script.');
    process.exitCode = 1;
    return;
  }

  const saltRounds = 10;
  
  try {
    const hash = await bcrypt.hash(password, saltRounds);
    console.log('✅ Hash:', hash);
    console.log('\n📋 Copy this SQL:');
    console.log('----------------------------------------');
    console.log(`INSERT INTO admins (username, password_hash, email, full_name, role, is_active) VALUES (`);
    console.log(`  'superadmin',`);
    console.log(`  '${hash}',`);
    console.log(`  'admin@trac.edu.ph',`);
    console.log(`  'Super Administrator',`);
    console.log(`  'super_admin',`);
    console.log(`  true`);
    console.log(`);`);
    console.log('----------------------------------------');
  } catch (error) {
    console.error('Error generating hash:', error);
  }
}

generateHash();