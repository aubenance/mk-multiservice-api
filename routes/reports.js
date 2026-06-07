// ── routes/reports.js ─────────────────────────────────────
const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { verifyToken, checkPermission } = require('../middleware/auth');

// verifyToken sur toutes les routes, mais PAS checkPermission global
// Le dashboard est accessible à tous les utilisateurs connectés
router.use(verifyToken);

// GET /api/reports/dashboard — Données tableau de bord (accessible à tous)
router.get('/dashboard', async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];

        // Ventes du jour
        const { data: ventesJour } = await supabase
            .from('sales')
            .select('total')
            .gte('created_at', `${today}T00:00:00`)
            .lte('created_at', `${today}T23:59:59`)
            .eq('statut', 'paye');

        const caJour = ventesJour?.reduce((sum, v) => sum + parseFloat(v.total), 0) || 0;

        // Articles en stock
        const { count: nbArticles } = await supabase
            .from('products').select('*', { count: 'exact', head: true }).eq('actif', true);

        // Ruptures de stock
        const { data: ruptures } = await supabase
            .from('products').select('id').eq('actif', true).eq('quantite', 0);

        // Nombre de clients
        const { count: nbClients } = await supabase
            .from('customers').select('*', { count: 'exact', head: true });

        // Ventes 7 derniers jours
        const il_y_a_7_jours = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const { data: ventes7j } = await supabase
            .from('sales')
            .select('created_at, total')
            .gte('created_at', il_y_a_7_jours)
            .eq('statut', 'paye');

        res.json({
            ca_jour: caJour,
            nb_ventes_jour: ventesJour?.length || 0,
            nb_articles: nbArticles || 0,
            nb_ruptures: ruptures?.length || 0,
            nb_clients: nbClients || 0,
            ventes_7_jours: ventes7j || []
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/reports/ventes — Rapport ventes (nécessite perm_rapports)
router.get('/ventes', checkPermission('perm_rapports'), async (req, res) => {
    try {
        const { periode = 'mois', date_debut, date_fin } = req.query;

        let debut, fin;
        const now = new Date();

        if (date_debut && date_fin) {
            debut = date_debut; fin = date_fin;
        } else {
            switch (periode) {
                case 'jour':
                    debut = new Date(now.setHours(0,0,0,0)).toISOString();
                    fin = new Date().toISOString();
                    break;
                case 'semaine':
                    debut = new Date(Date.now() - 7*24*60*60*1000).toISOString();
                    fin = new Date().toISOString();
                    break;
                case 'mois':
                    debut = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
                    fin = new Date().toISOString();
                    break;
                case 'annee':
                    debut = new Date(now.getFullYear(), 0, 1).toISOString();
                    fin = new Date().toISOString();
                    break;
                default:
                    debut = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
                    fin = new Date().toISOString();
            }
        }

        const { data: ventes } = await supabase
            .from('sales')
            .select('*, customers(nom), sale_items(*)')
            .gte('created_at', debut)
            .lte('created_at', fin)
            .eq('statut', 'paye')
            .order('created_at', { ascending: false });

        const total_ca = ventes?.reduce((s, v) => s + parseFloat(v.total), 0) || 0;

        res.json({ ventes: ventes || [], total_ca, nb_ventes: ventes?.length || 0 });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/reports/top-produits — Top produits vendus (nécessite perm_rapports)
router.get('/top-produits', checkPermission('perm_rapports'), async (req, res) => {
    try {
        const { data } = await supabase
            .from('sale_items')
            .select('designation, quantite, total_ligne')
            .eq('type_item', 'article');

        const grouped = {};
        (data || []).forEach(item => {
            if (!grouped[item.designation]) grouped[item.designation] = { quantite: 0, revenu: 0 };
            grouped[item.designation].quantite += item.quantite;
            grouped[item.designation].revenu += parseFloat(item.total_ligne);
        });

        const sorted = Object.entries(grouped)
            .map(([nom, v]) => ({ nom, ...v }))
            .sort((a, b) => b.quantite - a.quantite)
            .slice(0, 10);

        res.json(sorted);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/reports/top-services — Top services vendus (nécessite perm_rapports)
router.get('/top-services', checkPermission('perm_rapports'), async (req, res) => {
    try {
        const { data } = await supabase
            .from('sale_items')
            .select('designation, quantite, total_ligne')
            .eq('type_item', 'service');

        const grouped = {};
        (data || []).forEach(item => {
            if (!grouped[item.designation]) grouped[item.designation] = { quantite: 0, revenu: 0 };
            grouped[item.designation].quantite += item.quantite;
            grouped[item.designation].revenu += parseFloat(item.total_ligne);
        });

        const sorted = Object.entries(grouped)
            .map(([nom, v]) => ({ nom, ...v }))
            .sort((a, b) => b.revenu - a.revenu)
            .slice(0, 10);

        res.json(sorted);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
