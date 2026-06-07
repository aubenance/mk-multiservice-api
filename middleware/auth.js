// ── middleware/auth.js ─────────────────────────────────────
const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');

const JWT_SECRET = process.env.JWT_SECRET;

// ── Vérification du token JWT ─────────────────────────────
const verifyToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Token manquant ou invalide' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);

        // Vérifier que l'utilisateur existe encore et est actif
        const { data: user, error } = await supabase
            .from('users')
            .select('id, nom, username, role_id, actif, roles(nom)')
            .eq('id', decoded.userId)
            .single();

        if (error || !user || !user.actif) {
            return res.status(401).json({ error: 'Utilisateur introuvable ou désactivé' });
        }

        req.user = user;
        req.userId = user.id;
        req.userRole = user.roles?.nom;
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Session expirée. Reconnectez-vous.' });
        }
        return res.status(401).json({ error: 'Token invalide' });
    }
};

// ── Vérification des permissions ──────────────────────────
const checkPermission = (permissionField) => {
    return async (req, res, next) => {
        try {
            // L'administrateur a toujours accès
            if (req.userRole === 'administrateur') return next();

            const { data: perms, error } = await supabase
                .from('permissions')
                .select('*')
                .eq('user_id', req.userId)
                .single();

            if (error || !perms || !perms[permissionField]) {
                return res.status(403).json({ error: 'Accès refusé. Permission insuffisante.' });
            }
            next();
        } catch (err) {
            return res.status(403).json({ error: 'Erreur de vérification des permissions' });
        }
    };
};

// ── Réservé à l'administrateur ────────────────────────────
const adminOnly = (req, res, next) => {
    if (req.userRole !== 'administrateur') {
        return res.status(403).json({ error: 'Réservé à l\'administrateur.' });
    }
    next();
};

module.exports = { verifyToken, checkPermission, adminOnly };
