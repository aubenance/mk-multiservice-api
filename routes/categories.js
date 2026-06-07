// ── routes/categories.js ──────────────────────────────────
const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { verifyToken, adminOnly } = require('../middleware/auth');

router.use(verifyToken);

// GET /api/categories
router.get('/', async (req, res) => {
    const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('nom');
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// POST /api/categories
router.post('/', adminOnly, async (req, res) => {
    const { data, error } = await supabase
        .from('categories')
        .insert(req.body)
        .select()
        .single();
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
});

// DELETE /api/categories/:id
router.delete('/:id', adminOnly, async (req, res) => {
    const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ message: 'Catégorie supprimée.' });
});

module.exports = router;
