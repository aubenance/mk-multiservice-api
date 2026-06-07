// ── routes/settings.js ────────────────────────────────────
const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { verifyToken, adminOnly } = require('../middleware/auth');
router.use(verifyToken);

router.get('/', async (req, res) => {
    const { data, error } = await supabase.from('settings').select('*');
    if (error) return res.status(500).json({ error: error.message });
    const obj = {};
    data.forEach(s => obj[s.cle] = s.valeur);
    res.json(obj);
});

router.put('/', adminOnly, async (req, res) => {
    try {
        const entries = Object.entries(req.body);
        for (const [cle, valeur] of entries) {
            await supabase.from('settings').upsert({ cle, valeur }, { onConflict: 'cle' });
        }
        res.json({ message: 'Paramètres sauvegardés.' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
