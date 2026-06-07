// ── routes/users.js ───────────────────────────────────────
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const supabase = require('../config/supabase');
const { verifyToken, adminOnly } = require('../middleware/auth');
router.use(verifyToken, adminOnly);

router.get('/', async (req, res) => {
    const { data, error } = await supabase
        .from('users')
        .select('id, nom, prenom, username, actif, derniere_connexion, roles(nom), permissions(*)')
        .order('nom');
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

router.post('/', async (req, res) => {
    try {
        const { nom, prenom, username, password, role_nom = 'employe', permissions = {} } = req.body;
        if (!nom || !username || !password) {
            return res.status(400).json({ error: 'Nom, username et mot de passe requis.' });
        }
        const hash = await bcrypt.hash(password, 10);
        const { data: role } = await supabase.from('roles').select('id').eq('nom', role_nom).single();
        const { data: user, error } = await supabase.from('users')
            .insert({ nom, prenom, username: username.toLowerCase(), password_hash: hash, role_id: role.id })
            .select().single();
        if (error) return res.status(500).json({ error: error.message });

        await supabase.from('permissions').insert({ user_id: user.id, ...permissions });

        await supabase.from('logs').insert({
            user_id: req.userId, action: 'CREATION_UTILISATEUR',
            module: 'utilisateurs', details: `Utilisateur créé: ${username}`
        });
        res.status(201).json(user);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', async (req, res) => {
    const { permissions, ...userFields } = req.body;
    if (userFields.password) {
        userFields.password_hash = await bcrypt.hash(userFields.password, 10);
        delete userFields.password;
    }
    const { data, error } = await supabase.from('users').update(userFields).eq('id', req.params.id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    if (permissions) {
        await supabase.from('permissions').update(permissions).eq('user_id', req.params.id);
    }
    res.json(data);
});

router.put('/:id/toggle', async (req, res) => {
    const { data: user } = await supabase.from('users').select('actif').eq('id', req.params.id).single();
    await supabase.from('users').update({ actif: !user.actif }).eq('id', req.params.id);
    res.json({ message: `Utilisateur ${user.actif ? 'désactivé' : 'activé'}.` });
});

router.post('/:id/reset-password', async (req, res) => {
    const { nouveau_mot_de_passe } = req.body;
    const hash = await bcrypt.hash(nouveau_mot_de_passe, 10);
    await supabase.from('users').update({ password_hash: hash }).eq('id', req.params.id);
    await supabase.from('logs').insert({
        user_id: req.userId, action: 'RESET_MOT_DE_PASSE',
        module: 'utilisateurs', details: `Reset mdp pour user ${req.params.id}`
    });
    res.json({ message: 'Mot de passe réinitialisé.' });
});

module.exports = router;
