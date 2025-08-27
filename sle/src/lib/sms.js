import dotenv from 'dotenv';
dotenv.config();

let client = null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  const twilio = await import('twilio');
  client = twilio.default(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );
}

export async function sendSms({ to, body }) {
  if (!client) {
    console.log('[SMS STUB]', { to, body });
    return { sid: 'stub' };
  }
  if (!process.env.TWILIO_FROM) throw new Error('TWILIO_FROM not set');
  return client.messages.create({ from: process.env.TWILIO_FROM, to, body });
}
