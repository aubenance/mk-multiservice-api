// ── routes/customers.js ───────────────────────────────────
const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { verifyToken, checkPermission } = require('../middleware/auth');
router.use(verifyToken);

router.get('/', async (req, res) => {
    const { search } = req.query;
    let q = supabase.from('customers').select('*').order('nom');
    if (search) q = q.ilike('nom', `%${search}%`);
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.post('/', checkPermission('perm_clients'), async (req, res) => {
    const { data, error } = await supabase.from('customers').insert(req.body).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
});

router.put('/:id', checkPermission('perm_clients'), async (req, res) => {
    const { data, error } = await supabase.from('customers').update(req.body).eq('id', req.params.id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.get('/:id/historique', async (req, res) => {
    const { data, error } = await supabase.from('sales')
        .select('*, sale_items(*)')
        .eq('customer_id', req.params.id)
        .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

module.exports = router;
