// ── routes/services.js ────────────────────────────────────
const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { verifyToken, checkPermission, adminOnly } = require('../middleware/auth');
router.use(verifyToken);

router.get('/', async (req, res) => {
    const { data, error } = await supabase.from('services').select('*').eq('actif', true).order('nom');
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.post('/', adminOnly, async (req, res) => {
    const { data, error } = await supabase.from('services').insert(req.body).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
});

router.put('/:id', adminOnly, async (req, res) => {
    const { data, error } = await supabase.from('services').update(req.body).eq('id', req.params.id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.delete('/:id', adminOnly, async (req, res) => {
    await supabase.from('services').update({ actif: false }).eq('id', req.params.id);
    res.json({ message: 'Service désactivé.' });
});

module.exports = router;
