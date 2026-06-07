// ── routes/stocks.js ─────────────────────────────────────
const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { verifyToken, checkPermission } = require('../middleware/auth');
router.use(verifyToken);

// GET /api/stocks — Historique des mouvements
router.get('/', async (req, res) => {
    const { product_id, limit = 100 } = req.query;
    let q = supabase.from('stocks')
        .select('*, products(designation, reference), users(nom)')
        .order('created_at', { ascending: false })
        .limit(parseInt(limit));
    if (product_id) q = q.eq('product_id', product_id);
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// POST /api/stocks/entree — Entrée de stock
router.post('/entree', checkPermission('perm_stocks'), async (req, res) => {
    try {
        const { product_id, quantite, remarque } = req.body;
        const { data: prod } = await supabase
            .from('products').select('quantite').eq('id', product_id).single();
        const nouvQte = prod.quantite + parseInt(quantite);
        await supabase.from('products').update({ quantite: nouvQte }).eq('id', product_id);
        const { data } = await supabase.from('stocks').insert({
            product_id, type_mouvement: 'entree', quantite: parseInt(quantite),
            quantite_avant: prod.quantite, quantite_apres: nouvQte,
            remarque, user_id: req.userId
        }).select().single();
        await supabase.from('logs').insert({
            user_id: req.userId, action: 'ENTREE_STOCK',
            module: 'stocks', details: `+${quantite} unités — produit ${product_id}`
        });
        res.status(201).json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/stocks/sortie — Sortie de stock manuelle
router.post('/sortie', checkPermission('perm_stocks'), async (req, res) => {
    try {
        const { product_id, quantite, remarque } = req.body;
        const { data: prod } = await supabase
            .from('products').select('quantite, designation').eq('id', product_id).single();
        if (prod.quantite < quantite) {
            return res.status(400).json({ error: `Stock insuffisant: ${prod.quantite} disponible(s).` });
        }
        const nouvQte = prod.quantite - parseInt(quantite);
        await supabase.from('products').update({ quantite: nouvQte }).eq('id', product_id);
        const { data } = await supabase.from('stocks').insert({
            product_id, type_mouvement: 'sortie', quantite: parseInt(quantite),
            quantite_avant: prod.quantite, quantite_apres: nouvQte,
            remarque, user_id: req.userId
        }).select().single();
        res.status(201).json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/stocks/alertes — Produits sous le seuil d'alerte
router.get('/alertes', async (req, res) => {
    const { data, error } = await supabase
        .from('products')
        .select('id, reference, designation, quantite, seuil_alerte, categories(nom)')
        .eq('actif', true)
        .order('quantite');
    if (error) return res.status(500).json({ error: error.message });
    const alertes = (data || []).filter(p => p.quantite <= p.seuil_alerte);
    res.json(alertes);
});

module.exports = router;
