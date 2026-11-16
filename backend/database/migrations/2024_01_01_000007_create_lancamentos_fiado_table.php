<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('lancamentos_fiado', function (Blueprint $table) {
            $table->id();
            $table->foreignId('conta_id')->constrained('contas_fiado')->cascadeOnDelete();
            // cliente que efetivamente comprou (pode ser dependente do titular)
            $table->foreignId('cliente_id')->constrained('clientes')->restrictOnDelete();
            $table->enum('tipo', ['debito', 'credito']); // debito=compra, credito=pagamento
            $table->decimal('valor', 10, 2);
            $table->string('descricao')->nullable();
            $table->foreignId('venda_id')->nullable()->constrained('vendas')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lancamentos_fiado');
    }
};
