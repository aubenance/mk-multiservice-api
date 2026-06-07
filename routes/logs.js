// ── routes/logs.js ────────────────────────────────────────
const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { verifyToken, checkPermission } = require('../middleware/auth');

router.use(verifyToken, checkPermission('perm_rapports'));

// GET /api/logs — Journal des actions
router.get('/', async (req, res) => {
    try {
        const { limit = 200, user_id, module, action } = req.query;
        let query = supabase
            .from('logs')
            .select('*, users(nom, username)')
            .order('created_at', { ascending: false })
            .limit(parseInt(limit));

        if (user_id) query = query.eq('user_id', user_id);
        if (module) query = query.eq('module', module);
        if (action) query = query.ilike('action', `%${action}%`);

        const { data, error } = await query;
        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
