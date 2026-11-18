<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * NCM (Nomenclatura Comum do Mercosul, 8 dígitos) do produto.
 * Vem no XML da NF-e de compra; usado em marketplaces (Mercado Livre) e na emissão de nota.
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('produtos', function (Blueprint $table) {
            $table->string('ncm', 8)->nullable()->after('sku');
        });
        Schema::table('itens_nf', function (Blueprint $table) {
            $table->string('ncm', 8)->nullable()->after('sku');
        });
    }

    public function down(): void
    {
        Schema::table('produtos', fn(Blueprint $t) => $t->dropColumn('ncm'));
        Schema::table('itens_nf', fn(Blueprint $t) => $t->dropColumn('ncm'));
    }
};
