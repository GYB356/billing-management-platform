import { sendWelcomeEmail } from '../emails/emails';

export async function handleSendWelcomeEmail(email: string) {
    await sendWelcomeEmail(email);
}