<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('contas_fiado', function (Blueprint $table) {
            $table->id();
            $table->foreignId('titular_id')->constrained('clientes')->cascadeOnDelete();
            $table->decimal('saldo_devedor', 10, 2)->default(0);
            $table->boolean('ativa')->default(true);
            $table->timestamps();
        });

        Schema::create('dependentes_fiado', function (Blueprint $table) {
            $table->id();
            $table->foreignId('titular_id')->constrained('clientes')->cascadeOnDelete();
            $table->foreignId('dependente_id')->constrained('clientes')->cascadeOnDelete();
            $table->unique(['titular_id', 'dependente_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dependentes_fiado');
        Schema::dropIfExists('contas_fiado');
    }
};
