// ── routes/auth.js ────────────────────────────────────────
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');
const { verifyToken } = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES = process.env.JWT_EXPIRES || '8h';

// ── POST /api/auth/login ──────────────────────────────────
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Nom d\'utilisateur et mot de passe requis.' });
        }

        // Chercher l'utilisateur
        const { data: user, error } = await supabase
            .from('users')
            .select('id, nom, prenom, username, password_hash, actif, role_id, roles(nom)')
            .eq('username', username.toLowerCase().trim())
            .single();

        if (error || !user) {
            return res.status(401).json({ error: 'Identifiants incorrects.' });
        }

        if (!user.actif) {
            return res.status(401).json({ error: 'Compte désactivé. Contactez l\'administrateur.' });
        }

        // Vérifier le mot de passe
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            // Logger la tentative échouée
            await supabase.from('logs').insert({
                user_id: user.id,
                action: 'LOGIN_ECHEC',
                module: 'auth',
                details: `Tentative échouée pour ${username}`,
                ip_address: req.ip
            });
            return res.status(401).json({ error: 'Identifiants incorrects.' });
        }

        // Récupérer les permissions
        const { data: perms } = await supabase
            .from('permissions')
            .select('*')
            .eq('user_id', user.id)
            .single();

        // Générer le token JWT
        const token = jwt.sign(
            { userId: user.id, username: user.username, role: user.roles?.nom },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES }
        );

        // Mettre à jour la dernière connexion
        await supabase
            .from('users')
            .update({ derniere_connexion: new Date().toISOString() })
            .eq('id', user.id);

        // Logger la connexion réussie
        await supabase.from('logs').insert({
            user_id: user.id,
            action: 'LOGIN_SUCCES',
            module: 'auth',
            ip_address: req.ip
        });

        res.json({
            token,
            user: {
                id: user.id,
                nom: user.nom,
                prenom: user.prenom,
                username: user.username,
                role: user.roles?.nom,
                permissions: perms || {}
            }
        });
    } catch (err) {
        console.error('[AUTH LOGIN]', err);
        res.status(500).json({ error: 'Erreur serveur lors de la connexion.' });
    }
});

// ── POST /api/auth/logout ─────────────────────────────────
router.post('/logout', verifyToken, async (req, res) => {
    await supabase.from('logs').insert({
        user_id: req.userId,
        action: 'LOGOUT',
        module: 'auth',
        ip_address: req.ip
    });
    res.json({ message: 'Déconnexion réussie.' });
});

// ── POST /api/auth/change-password ───────────────────────
router.post('/change-password', verifyToken, async (req, res) => {
    try {
        const { ancien_mot_de_passe, nouveau_mot_de_passe } = req.body;

        if (!ancien_mot_de_passe || !nouveau_mot_de_passe) {
            return res.status(400).json({ error: 'Les deux mots de passe sont requis.' });
        }

        if (nouveau_mot_de_passe.length < 8) {
            return res.status(400).json({ error: 'Le nouveau mot de passe doit avoir au moins 8 caractères.' });
        }

        const { data: user } = await supabase
            .from('users')
            .select('password_hash')
            .eq('id', req.userId)
            .single();

        const valid = await bcrypt.compare(ancien_mot_de_passe, user.password_hash);
        if (!valid) {
            return res.status(401).json({ error: 'Ancien mot de passe incorrect.' });
        }

        const newHash = await bcrypt.hash(nouveau_mot_de_passe, 10);
        await supabase
            .from('users')
            .update({ password_hash: newHash })
            .eq('id', req.userId);

        await supabase.from('logs').insert({
            user_id: req.userId,
            action: 'CHANGEMENT_MOT_DE_PASSE',
            module: 'auth',
            ip_address: req.ip
        });

        res.json({ message: 'Mot de passe modifié avec succès.' });
    } catch (err) {
        res.status(500).json({ error: 'Erreur lors du changement de mot de passe.' });
    }
});

// ── GET /api/auth/me ──────────────────────────────────────
router.get('/me', verifyToken, async (req, res) => {
    const { data: perms } = await supabase
        .from('permissions')
        .select('*')
        .eq('user_id', req.userId)
        .single();

    res.json({ user: req.user, permissions: perms || {} });
});

module.exports = router;
