// ── routes/products.js ────────────────────────────────────
const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { verifyToken, checkPermission } = require('../middleware/auth');

router.use(verifyToken);

// GET /api/products — Liste tous les articles
router.get('/', async (req, res) => {
    try {
        const { search, categorie_id, alerte } = req.query;
        let query = supabase
            .from('products')
            .select('*, categories(nom), fournisseurs(nom)')
            .eq('actif', true)
            .order('designation');

        if (search) query = query.ilike('designation', `%${search}%`);
        if (categorie_id) query = query.eq('categorie_id', categorie_id);
        if (alerte === 'true') query = query.lte('quantite', supabase.raw('seuil_alerte'));

        const { data, error } = await query;
        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/products — Créer un article
router.post('/', checkPermission('perm_stocks'), async (req, res) => {
    try {
        const { reference, designation, categorie_id, fournisseur_id,
                prix_achat, prix_vente, quantite, seuil_alerte, code_barres } = req.body;

        if (!designation || !prix_vente) {
            return res.status(400).json({ error: 'Désignation et prix de vente requis.' });
        }

        const { data, error } = await supabase
            .from('products')
            .insert({ reference, designation, categorie_id, fournisseur_id,
                      prix_achat, prix_vente, quantite: quantite || 0,
                      seuil_alerte: seuil_alerte || 10, code_barres })
            .select()
            .single();

        if (error) throw error;

        await supabase.from('logs').insert({
            user_id: req.userId, action: 'CREATION_ARTICLE',
            module: 'produits', details: `Article créé: ${designation}`
        });

        res.status(201).json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/products/:id — Modifier un article
router.put('/:id', checkPermission('perm_stocks'), async (req, res) => {
    try {
        const updates = req.body;
        delete updates.id;

        const { data, error } = await supabase
            .from('products')
            .update(updates)
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/products/:id — Désactiver un article
router.delete('/:id', checkPermission('perm_suppression_articles'), async (req, res) => {
    try {
        await supabase.from('products').update({ actif: false }).eq('id', req.params.id);
        res.json({ message: 'Article supprimé.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/products/alertes — Articles sous le seuil
router.get('/alertes', async (req, res) => {
    const { data, error } = await supabase
        .from('products')
        .select('id, reference, designation, quantite, seuil_alerte, categories(nom)')
        .eq('actif', true)
        .filter('quantite', 'lte', supabase.raw('seuil_alerte'))
        .order('quantite');
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

module.exports = router;
