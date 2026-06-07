// Vercel Serverless Function: POST /api/create-checkout-session
// Creates a Stripe Checkout Session and returns its URL.
// Your secret key lives ONLY here (in Vercel env vars) — never in the browser.

const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // Vercel usually parses JSON, but handle the raw case too.
    const body =
      typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const items = body.items || [];
    const email = body.email;

    if (!items.length) {
      res.status(400).json({ error: 'Cart is empty' });
      return;
    }

    const line_items = items.map((i) => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: i.name,
          description: [i.size, i.color].filter(Boolean).join(' / ') || undefined,
        },
        unit_amount: Math.round(Number(i.price) * 100), // cents
      },
      quantity: Math.max(1, parseInt(i.qty, 10) || 1),
    }));

    // Build the return URLs from the request's own host so it works on any domain.
    const proto = (req.headers['x-forwarded-proto'] || 'https');
    const host = req.headers['host'];
    const origin = `${proto}://${host}`;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items,
      customer_email: email || undefined,
      shipping_address_collection: { allowed_countries: ['US', 'CA'] },
      success_url: `${origin}/?paid=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?canceled=1`,
    });

    res.status(200).json({ id: session.id, url: session.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
