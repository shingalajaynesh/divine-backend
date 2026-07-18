import { RazorpayWebhookService } from './razorpayWebhook.service.js';

const safeErrorStatus = (error) => error.statusCode || (error.message?.includes('signature') ? 401 : 500);

export const handleRazorpayWebhook = async (req, res) => {
  const signature = req.get('x-razorpay-signature');
  const service = new RazorpayWebhookService(req.models, req.sequelize, req.logger);

  try {
    const result = await service.process(req.body, signature, req.requestId);
    res.status(200).json({ ok: true, status: result.status });
  } catch (error) {
    const status = safeErrorStatus(error);
    req.logger?.warn?.(`Razorpay webhook rejected or deferred: ${status} ${error.message}`);
    res.status(status).json({
      ok: false,
      error: status >= 500 ? 'Webhook processing failed' : error.message,
    });
  }
};
