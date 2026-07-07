import Logger from '../util/logger.js';

const log = new Logger('WhatsAppService');

export class WhatsAppService {
  constructor(models) {
    this.models = models;
  }

  /**
   * Dispatches a daily reminder update to an expecting mother
   * @param {Object} user - User record
   * @param {Object} dailyContent - Daily activity/content record
   */
  async sendDailyUpdate(user, dailyContent) {
    const mobileNo = user.mobileNo;
    if (!mobileNo) {
      log.warn(`Skipping WhatsApp reminder: user ${user.id} has no registered mobile number.`);
      return { success: false, reason: 'No mobile number' };
    }

    const lang = user.language || 'en';
    const isHi = lang === 'hi';

    // Bilingual Daily Reminder template
    const title = dailyContent.title || 'Daily Activity';
    const body = dailyContent.body || 'Keep tracking your pregnancy vitals and join today class!';

    const greeting = isHi 
      ? `नमस्ते ${user.displayName || 'प्रिय माँ'}! ✨` 
      : `Hello ${user.displayName || 'Dear Mother'}! ✨`;
      
    const headerMsg = isHi
      ? `आपके गर्भ संस्कार का आज का दिन: दिन ${dailyContent.dayNumber}`
      : `Your Garbh Sanskar today: Day ${dailyContent.dayNumber}`;

    const contentText = isHi
      ? `आज की गतिविधि: *${title}*\n\n${body}`
      : `Today's Activity: *${title}*\n\n${body}`;

    const footerMsg = isHi
      ? `लॉग इन करें और अपना दैनिक विवरण भरें।`
      : `Log in to your dashboard to complete your vitals log.`;

    const fullMessage = `${greeting}\n\n*${headerMsg}*\n\n${contentText}\n\n${footerMsg}`;

    log.info(`Sending daily WhatsApp message to ${mobileNo} (${lang}) for user ${user.id}.`);

    // Meta API Configuration
    const token = process.env.WP_FALLBACK_ACCESS_TOKEN || 'EAA...';
    const phoneId = process.env.WP_FALLBACK_PHONE_NUMBER_ID || '123456';
    const templateName = isHi 
      ? (process.env.WP_TEMPLATE_DAILY_HI || 'daily_update_hi')
      : (process.env.WP_TEMPLATE_DAILY_EN || 'daily_update_en');

    // For local development, if fallback credentials are mock values, log and succeed
    if (token === 'EAA...' || phoneId === '123456') {
      log.info(`[MOCK MODE] WhatsApp message sent successfully via console fallback for user: ${user.id}`);
      return { success: true, mock: true };
    }

    try {
      const url = `https://graph.facebook.com/v19.0/${phoneId}/messages`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: mobileNo.replace(/\+/g, '').trim(),
          type: 'template',
          template: {
            name: templateName,
            language: { code: lang },
            components: [
              {
                type: 'body',
                parameters: [
                  { type: 'text', text: user.displayName || 'Mother' },
                  { type: 'text', text: String(dailyContent.dayNumber) },
                  { type: 'text', text: title }
                ]
              }
            ]
          }
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to dispatch Meta WhatsApp notification');
      }

      log.info(`WhatsApp message successfully sent to ${mobileNo} via Meta API.`);
      return { success: true, metaResponse: data };
    } catch (err) {
      log.error(`WhatsApp dispatch failed for user ${user.id}:`, err);
      return { success: false, error: err.message };
    }
  }
}
