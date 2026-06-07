// ── routes/sales.js ───────────────────────────────────────
const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { verifyToken, checkPermission } = require('../middleware/auth');

router.use(verifyToken);

// GET /api/sales — Liste des ventes
router.get('/', checkPermission('perm_ventes'), async (req, res) => {
    try {
        const { date_debut, date_fin, customer_id, statut, limit = 50 } = req.query;
        let query = supabase
            .from('sales')
            .select('*, customers(nom, prenom), users(nom, username), sale_items(*)')
            .order('created_at', { ascending: false })
            .limit(parseInt(limit));

        if (date_debut) query = query.gte('created_at', date_debut);
        if (date_fin) query = query.lte('created_at', date_fin);
        if (customer_id) query = query.eq('customer_id', customer_id);
        if (statut) query = query.eq('statut', statut);

        const { data, error } = await query;
        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/sales — Créer une nouvelle vente
router.post('/', checkPermission('perm_ventes'), async (req, res) => {
    try {
        const { customer_id, items, remise = 0, montant_paye, remarque } = req.body;

        if (!items || items.length === 0) {
            return res.status(400).json({ error: 'La vente doit contenir au moins un article.' });
        }

        // Calculer le sous-total
        let sous_total = 0;
        const itemsProcessed = [];

        for (const item of items) {
            let designation = item.designation;
            let prix = item.prix_unitaire;

            if (item.type_item === 'article' && item.product_id) {
                const { data: prod } = await supabase
                    .from('products')
                    .select('designation, prix_vente, quantite')
                    .eq('id', item.product_id)
                    .single();

                if (!prod) return res.status(400).json({ error: `Article introuvable: ${item.product_id}` });
                if (prod.quantite < item.quantite) {
                    return res.status(400).json({ error: `Stock insuffisant pour: ${prod.designation}` });
                }
                designation = prod.designation;
                prix = prod.prix_vente;
            }

            const total_ligne = prix * item.quantite;
            sous_total += total_ligne;
            itemsProcessed.push({ ...item, designation, prix_unitaire: prix, total_ligne });
        }

        const total = sous_total - remise;
        const monnaie_rendue = montant_paye ? Math.max(0, montant_paye - total) : 0;

        // Déterminer le type de vente
        const hasArticles = itemsProcessed.some(i => i.type_item === 'article');
        const hasServices = itemsProcessed.some(i => i.type_item === 'service');
        const type_vente = hasArticles && hasServices ? 'mixte' : hasArticles ? 'article' : 'service';

        // Générer numéro de reçu
        const { data: numData } = await supabase.rpc('generate_numero_recu');
        const numero_recu = numData || `REC-${Date.now()}`;

        // Insérer la vente
        const { data: sale, error: saleError } = await supabase
            .from('sales')
            .insert({
                numero_recu, customer_id, user_id: req.userId,
                type_vente, sous_total, remise, total,
                montant_paye: montant_paye || total,
                monnaie_rendue, statut: 'paye', remarque
            })
            .select()
            .single();

        if (saleError) throw saleError;

        // Insérer les lignes (le trigger SQL décrémentera le stock automatiquement)
        const saleItems = itemsProcessed.map(item => ({
            sale_id: sale.id,
            product_id: item.product_id || null,
            service_id: item.service_id || null,
            type_item: item.type_item,
            designation: item.designation,
            quantite: item.quantite,
            prix_unitaire: item.prix_unitaire,
            total_ligne: item.total_ligne
        }));

        const { error: itemsError } = await supabase.from('sale_items').insert(saleItems);
        if (itemsError) throw itemsError;

        // Logger
        await supabase.from('logs').insert({
            user_id: req.userId, action: 'CREATION_VENTE',
            module: 'ventes', details: `Vente ${numero_recu} — ${total} FCFA`
        });

        res.status(201).json({ ...sale, items: saleItems });
    } catch (err) {
        console.error('[VENTE]', err);
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/sales/:id/annuler — Annuler une vente
router.put('/:id/annuler', checkPermission('perm_annulation_facture'), async (req, res) => {
    try {
        const { id } = req.params;
        const { data: sale } = await supabase.from('sales').select('*').eq('id', id).single();
        if (!sale) return res.status(404).json({ error: 'Vente introuvable.' });
        if (sale.statut === 'annule') return res.status(400).json({ error: 'Vente déjà annulée.' });

        // Réintégrer le stock pour les articles
        const { data: items } = await supabase
            .from('sale_items').select('*').eq('sale_id', id).eq('type_item', 'article');

        for (const item of (items || [])) {
            if (item.product_id) {
                const { data: prod } = await supabase
                    .from('products').select('quantite').eq('id', item.product_id).single();
                await supabase.from('products')
                    .update({ quantite: prod.quantite + item.quantite })
                    .eq('id', item.product_id);
                await supabase.from('stocks').insert({
                    product_id: item.product_id, type_mouvement: 'entree',
                    quantite: item.quantite, user_id: req.userId,
                    remarque: `Annulation vente ${sale.numero_recu}`
                });
            }
        }

        await supabase.from('sales').update({ statut: 'annule' }).eq('id', id);
        await supabase.from('logs').insert({
            user_id: req.userId, action: 'ANNULATION_VENTE',
            module: 'ventes', details: `Vente ${sale.numero_recu} annulée`
        });

        res.json({ message: 'Vente annulée avec succès.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
