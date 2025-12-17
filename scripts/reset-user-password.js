/**
 * Script para resetar senha de usuários via Edge Function
 * 
 * Uso:
 * node scripts/reset-user-password.js <email> <nova_senha> [admin_token]
 * 
 * Exemplo:
 * node scripts/reset-user-password.js usuario@exemplo.com NovaSenha123
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://bfcssdogttmqeujgmxdf.supabase.co';
const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/admin-reset-password`;

async function resetPassword(email, newPassword, adminToken) {
  try {
    console.log('🔐 Resetando senha para:', email);
    console.log('📡 Chamando Edge Function:', EDGE_FUNCTION_URL);

    const response = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        email: email,
        new_password: newPassword
      })
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('❌ Erro:', result.error);
      process.exit(1);
    }

    console.log('✅ Senha resetada com sucesso!');
    console.log('👤 Usuário:', result.user);
    console.log('📧 Email:', result.user.email);
    console.log('👤 Nome:', result.user.full_name);
    console.log('🔑 Role:', result.user.role);

  } catch (error) {
    console.error('❌ Erro ao resetar senha:', error.message);
    process.exit(1);
  }
}

// Verificar argumentos
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('❌ Uso: node reset-user-password.js <email> <nova_senha> [admin_token]');
  console.error('');
  console.error('Exemplo:');
  console.error('  node reset-user-password.js usuario@exemplo.com NovaSenha123');
  console.error('');
  console.error('Ou com token admin:');
  console.error('  node reset-user-password.js usuario@exemplo.com NovaSenha123 eyJhbGc...');
  process.exit(1);
}

const [email, newPassword, adminToken] = args;

if (!adminToken) {
  console.error('⚠️  Token admin não fornecido.');
  console.error('💡 Você precisa do token JWT de um usuário admin.');
  console.error('   Obtenha fazendo login no sistema e copiando o token do localStorage.');
  console.error('');
  console.error('   Ou use o Supabase Dashboard > Authentication > Users para resetar manualmente.');
  process.exit(1);
}

if (newPassword.length < 6) {
  console.error('❌ Senha deve ter pelo menos 6 caracteres');
  process.exit(1);
}

resetPassword(email, newPassword, adminToken);








