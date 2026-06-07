// ============================================================
//  MK MULTISERVICE — API Backend Node.js FINAL
//  Fichier : server.js — VERSION COMPLÈTE
//  Toutes les routes enregistrées
// ============================================================

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middlewares sécurité ──────────────────────────────────
app.use(helmet());
app.use(cors({
    origin: function(origin, callback) {
        // Autoriser les requêtes sans origin (app desktop Electron, Postman, apps mobiles)
        if (!origin) return callback(null, true);

        const allowed = process.env.ALLOWED_ORIGINS
            ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
            : [];

        if (allowed.length === 0 || allowed.includes(origin)) {
            return callback(null, true);
        }
        callback(new Error('CORS non autorisé pour: ' + origin));
    },
    credentials: true
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Rate limiting ─────────────────────────────────────────
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    message: { error: 'Trop de requêtes. Réessayez dans 15 minutes.' }
});
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: 'Trop de tentatives. Attendez 15 minutes.' }
});
app.use('/api/', limiter);

// ── Routes ────────────────────────────────────────────────
const authRoutes       = require('./routes/auth');
const productsRoutes   = require('./routes/products');
const stocksRoutes     = require('./routes/stocks');
const salesRoutes      = require('./routes/sales');
const customersRoutes  = require('./routes/customers');
const servicesRoutes   = require('./routes/services');
const reportsRoutes    = require('./routes/reports');
const usersRoutes      = require('./routes/users');
const settingsRoutes   = require('./routes/settings');
const logsRoutes       = require('./routes/logs');
const categoriesRoutes = require('./routes/categories');

app.use('/api/auth',       loginLimiter, authRoutes);
app.use('/api/products',   productsRoutes);
app.use('/api/stocks',     stocksRoutes);
app.use('/api/sales',      salesRoutes);
app.use('/api/customers',  customersRoutes);
app.use('/api/services',   servicesRoutes);
app.use('/api/reports',    reportsRoutes);
app.use('/api/users',      usersRoutes);
app.use('/api/settings',   settingsRoutes);
app.use('/api/logs',       logsRoutes);
app.use('/api/categories', categoriesRoutes);

// ── Alias sans /api (compatibilité app desktop) ──────────
app.use('/auth',       loginLimiter, authRoutes);
app.use('/products',   productsRoutes);
app.use('/stocks',     stocksRoutes);
app.use('/sales',      salesRoutes);
app.use('/customers',  customersRoutes);
app.use('/services',   servicesRoutes);
app.use('/reports',    reportsRoutes);
app.use('/users',      usersRoutes);
app.use('/settings',   settingsRoutes);
app.use('/logs',       logsRoutes);
app.use('/categories', categoriesRoutes);

// ── Santé ─────────────────────────────────────────────────
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        app: 'MK MULTISERVICE API',
        version: '1.0.0',
        routes: [
            'POST /api/auth/login',
            'POST /api/auth/logout',
            'POST /api/auth/change-password',
            'GET  /api/auth/me',
            'GET  /api/products',
            'POST /api/products',
            'PUT  /api/products/:id',
            'DEL  /api/products/:id',
            'GET  /api/products/alertes',
            'GET  /api/stocks',
            'POST /api/stocks/entree',
            'POST /api/stocks/sortie',
            'GET  /api/stocks/alertes',
            'GET  /api/sales',
            'POST /api/sales',
            'PUT  /api/sales/:id/annuler',
            'GET  /api/customers',
            'POST /api/customers',
            'PUT  /api/customers/:id',
            'GET  /api/customers/:id/historique',
            'GET  /api/services',
            'POST /api/services',
            'PUT  /api/services/:id',
            'DEL  /api/services/:id',
            'GET  /api/reports/dashboard',
            'GET  /api/reports/ventes',
            'GET  /api/reports/top-produits',
            'GET  /api/users',
            'POST /api/users',
            'PUT  /api/users/:id',
            'PUT  /api/users/:id/toggle',
            'POST /api/users/:id/reset-password',
            'GET  /api/settings',
            'PUT  /api/settings',
            'GET  /api/logs',
            'GET  /api/categories',
            'POST /api/categories'
        ],
        timestamp: new Date().toISOString()
    });
});

// ── Gestion des erreurs ───────────────────────────────────
app.use((err, req, res, next) => {
    console.error('[ERREUR]', err.stack);
    res.status(err.status || 500).json({
        error: err.message || 'Erreur interne du serveur'
    });
});

app.use('*', (req, res) => {
    res.status(404).json({ error: `Route introuvable: ${req.originalUrl}` });
});

// ── Démarrage ─────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════╗
║      MK MULTISERVICE — API v1.0.0 FINAL      ║
║      Port    : ${PORT}                             ║
║      Santé   : http://localhost:${PORT}/health  ║
║      Statut  : ✓ Démarré avec succès         ║
╚══════════════════════════════════════════════╝
    `);
});

module.exports = app;
