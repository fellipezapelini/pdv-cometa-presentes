<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use App\Models\{Usuario, Categoria};

class UsuarioAdminSeeder extends Seeder
{
    public function run(): void
    {
        // Credenciais do primeiro acesso vêm do .env — nunca ficam no código
        $senha = env('ADMIN_PASSWORD');
        if (!$senha || strlen($senha) < 10) {
            throw new \RuntimeException('Defina ADMIN_PASSWORD (mín. 10 caracteres) no .env antes de rodar o seeder.');
        }

        Usuario::create([
            'nome'  => 'Administrador',
            'email' => env('ADMIN_EMAIL', 'admin@example.com'),
            'senha' => Hash::make($senha),
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
