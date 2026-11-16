<?php
/**
 * SEEDER — rode UMA VEZ após criar o banco:
 *   php artisan db:seed --class=UsuarioAdminSeeder
 *
 * Cria:
 *   - 1 admin (email: definido em ADMIN_EMAIL, senha: definida em ADMIN_PASSWORD)
 *   - Categoria "Outros" com id=1 (usada como fallback na entrada de NF)
 */

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use App\Models\{Usuario, Categoria};

class UsuarioAdminSeeder extends Seeder
{
    public function run(): void
    {
        Usuario::create([
            'nome'  => 'Administrador',
            'email' => env('ADMIN_EMAIL', 'admin@example.com'),
            'senha' => Hash::make(env('ADMIN_PASSWORD')),
            'papel' => 'admin',
        ]);

        Categoria::create([
            'nome'      => 'Outros',
            'slug'      => 'outros',
            'descricao' => 'Categoria padrão para produtos sem categoria definida.',
            'ativo'     => true,
        ]);
    }
}
