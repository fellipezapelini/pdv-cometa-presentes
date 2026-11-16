<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Nome apresentável para o site (opcional). Vazio = o site usa uma versão limpa do nome interno.
 * O nome interno (como vem da nota) continua sendo o usado no PDV, estoque e notas.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('produtos', function (Blueprint $table) {
            $table->string('nome_vitrine')->nullable()->after('nome');
        });
    }

    public function down(): void
    {
        Schema::table('produtos', function (Blueprint $table) {
            $table->dropColumn('nome_vitrine');
        });
    }
};
