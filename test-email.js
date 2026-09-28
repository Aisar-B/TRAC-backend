import { sendEmail } from './src/config/email.js';

async function testEmail() {
  const result = await sendEmail(
    'your-email@gmail.com', // Send to yourself first!
    'Test Email from TRAC Registrar',
    '<h1>Hello!</h1><p>This is a test email from your Registrar System.</p>'
  );

  if (result.success) {
    console.log('✅ Test email sent successfully!');
  } else {
    console.log('❌ Test email failed:', result.error);
  }
}

testEmail();