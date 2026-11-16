<?php

use App\Models\Usuario;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Hash;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

/*
 * Redefine a senha de um usuário do painel sem precisar da senha atual
 * (para quem esqueceu). Só quem tem acesso ao servidor consegue rodar.
 * A senha é digitada sem aparecer na tela e nunca fica em histórico/log.
 *
 *   php artisan admin:senha            → lista os usuários e pergunta qual
 *   php artisan admin:senha email@...  → redefine direto esse usuário
 */
Artisan::command('admin:senha {email?}', function (?string $email = null) {
    $usuarios = Usuario::orderBy('id')->get(['id', 'nome', 'email', 'ativo']);
    if ($usuarios->isEmpty()) {
        $this->error('Nenhum usuário cadastrado.');
        return 1;
    }

    if (!$email) {
        $this->table(['ID', 'Nome', 'E-mail', 'Ativo'], $usuarios->map(fn($u) => [$u->id, $u->nome, $u->email, $u->ativo ? 'sim' : 'não']));
        $email = $usuarios->count() === 1
            ? $usuarios->first()->email
            : $this->choice('Qual usuário?', $usuarios->pluck('email')->all());
    }

    $usuario = Usuario::where('email', $email)->first();
    if (!$usuario) {
        $this->error("Usuário {$email} não encontrado.");
        return 1;
    }

    $this->info("Redefinindo a senha de {$usuario->nome} ({$usuario->email}).");
    $this->line('A senha não aparece enquanto você digita. Use pelo menos 10 caracteres.');

    for ($tentativa = 1; $tentativa <= 3; $tentativa++) {
        $senha = (string) $this->secret('Nova senha');
        $repetida = (string) $this->secret('Repita a nova senha');

        if (mb_strlen($senha) < 10) { $this->warn('Muito curta: use pelo menos 10 caracteres.'); continue; }
        if ($senha !== $repetida)   { $this->warn('As duas senhas não são iguais.'); continue; }
        if (Hash::check($senha, $usuario->senha)) { $this->warn('Essa já é a senha atual. Escolha outra.'); continue; }

        $usuario->update(['senha' => Hash::make($senha)]);
        $encerradas = $usuario->tokens()->delete(); // desconecta todos os aparelhos

        $this->info("✓ Senha alterada. {$encerradas} sessão(ões) encerrada(s): entre de novo no painel com a senha nova.");
        return 0;
    }

    $this->error('Nada foi alterado. Rode o comando de novo.');
    return 1;
})->purpose('Redefine a senha de um usuário do painel (para quem esqueceu a senha atual)');
