// ============================================================
//  MK MULTISERVICE — Script d'initialisation administrateur
//  Fichier : scripts/setup-admin.js
//  Usage   : node scripts/setup-admin.js
// ============================================================

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function setupAdmin() {
    console.log('\n╔══════════════════════════════════════════╗');
    console.log('║   MK MULTISERVICE — Initialisation       ║');
    console.log('╚══════════════════════════════════════════╝\n');

    try {
        // 1. Vérifier la connexion Supabase
        console.log('🔌 Vérification de la connexion Supabase...');
        const { error: testError } = await supabase.from('roles').select('count').limit(1);
        if (testError) {
            console.error('❌ Connexion échouée:', testError.message);
            console.log('\n💡 Vérifiez vos variables dans le fichier .env :');
            console.log('   SUPABASE_URL=https://votreprojet.supabase.co');
            console.log('   SUPABASE_SERVICE_ROLE_KEY=votreclé');
            process.exit(1);
        }
        console.log('✅ Connexion Supabase OK\n');

        // 2. Hash du mot de passe admin
        const motDePasse = process.argv[2] || 'Admin@2024';
        const hash = await bcrypt.hash(motDePasse, 10);
        console.log(`🔐 Mot de passe hashé pour : ${motDePasse}`);

        // 3. Mettre à jour l'administrateur
        const { data: admin, error: adminError } = await supabase
            .from('users')
            .update({ password_hash: hash })
            .eq('username', 'admin')
            .select()
            .single();

        if (adminError) {
            console.log('⚠️  L\'administrateur n\'existe pas encore, création...');
            
            // Récupérer le rôle admin
            const { data: role } = await supabase
                .from('roles')
                .select('id')
                .eq('nom', 'administrateur')
                .single();

            if (!role) {
                console.error('❌ Le rôle "administrateur" n\'existe pas.');
                console.log('   Exécutez d\'abord le script SQL : sql/01_schema.sql');
                process.exit(1);
            }

            // Créer l'admin
            const { data: newAdmin, error: createError } = await supabase
                .from('users')
                .insert({
                    nom: 'Administrateur',
                    prenom: 'MK',
                    username: 'admin',
                    password_hash: hash,
                    role_id: role.id,
                    actif: true
                })
                .select()
                .single();

            if (createError) {
                console.error('❌ Erreur création admin:', createError.message);
                process.exit(1);
            }

            // Créer les permissions complètes
            await supabase.from('permissions').insert({
                user_id: newAdmin.id,
                perm_ventes: true, perm_stocks: true, perm_rapports: true,
                perm_clients: true, perm_services: true, perm_parametres: true,
                perm_utilisateurs: true, perm_suppression_articles: true,
                perm_modification_prix: true, perm_annulation_facture: true
            });

            console.log('✅ Administrateur créé avec succès !');
        } else {
            console.log('✅ Mot de passe administrateur mis à jour !');
        }

        // 4. Résumé
        console.log('\n╔══════════════════════════════════════════╗');
        console.log('║          INITIALISATION RÉUSSIE          ║');
        console.log('╠══════════════════════════════════════════╣');
        console.log(`║  Utilisateur : admin                      ║`);
        console.log(`║  Mot de passe: ${motDePasse.padEnd(26)} ║`);
        console.log('║                                          ║');
        console.log('║  ⚠ CHANGEZ CE MOT DE PASSE              ║');
        console.log('║    après la première connexion !         ║');
        console.log('╚══════════════════════════════════════════╝\n');

        console.log('🚀 Vous pouvez maintenant démarrer l\'API :');
        console.log('   npm start\n');

    } catch (err) {
        console.error('❌ Erreur inattendue:', err.message);
        process.exit(1);
    }
}

setupAdmin();
