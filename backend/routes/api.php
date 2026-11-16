<?php
use App\Http\Controllers\Api\DespesaController;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\{
    AuthController,
    CategoriaController,
    ProdutoController,
    ClienteController,
    VendaController,
    NotaFiscalController,
    MovimentacaoController,
    DashboardController,
    PedidoController,
    FreteController,
    ImportacaoProdutoController,
    ParcelaController,
    RecebimentoController,
    VitrineController,
};

// ─── Autenticação ───────────────────────────────────────────────────────────
// Limite de 5 tentativas por minuto contra tentativa de adivinhar senha
Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:5,1');

Route::middleware('auth:sanctum')->group(function () {

    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/me',     [AuthController::class, 'me']);
    Route::put('/auth/senha',  [AuthController::class, 'trocarSenha'])->middleware('throttle:5,1');

    // ─── Dashboard ──────────────────────────────────────────────────────────
    Route::get('/dashboard/resumo', [DashboardController::class, 'resumo']);

    // ─── Categorias ─────────────────────────────────────────────────────────
    Route::get('/categorias',          [CategoriaController::class, 'index']);
    Route::post('/categorias',         [CategoriaController::class, 'store']);
    Route::put('/categorias/{categoria}', [CategoriaController::class, 'update']);
    Route::delete('/categorias/{categoria}', [CategoriaController::class, 'destroy']);

    // ─── Produtos ───────────────────────────────────────────────────────────
    Route::get('/produtos/estoque-baixo', [ProdutoController::class, 'estoqueBaixo']);
    Route::get('/produtos/inventario',    [ProdutoController::class, 'inventario']);
    Route::get('/produtos/caixas-duplicadas',  [ProdutoController::class, 'caixasDuplicadas']);
    Route::post('/produtos/caixas-duplicadas', [ProdutoController::class, 'resolverCaixasDuplicadas']);
    Route::get('/produtos',              [ProdutoController::class, 'index']);
    Route::post('/produtos',             [ProdutoController::class, 'store']);
    Route::get('/produtos/{produto}',    [ProdutoController::class, 'show']);
    Route::put('/produtos/{produto}',    [ProdutoController::class, 'update']);
    Route::delete('/produtos/{produto}', [ProdutoController::class, 'destroy']);
    Route::post('/produtos/{produto}/foto', [ProdutoController::class, 'uploadFoto']);

    // ─── Clientes ───────────────────────────────────────────────────────────
    Route::get('/clientes',    [ClienteController::class, 'index']);
    Route::post('/clientes',   [ClienteController::class, 'store']);
    Route::get('/clientes/{cliente}', [ClienteController::class, 'show']);

    Route::get('/clientes/{cliente}/fiado',           [ClienteController::class, 'contaFiado']);
    Route::post('/clientes/{cliente}/fiado/debito', [ClienteController::class, 'lancarDebito']);
    Route::post('/clientes/{cliente}/fiado/pagamento', [ClienteController::class, 'pagarFiado']);
    Route::post('/clientes/{cliente}/fiado/ajuste',    [ClienteController::class, 'ajustarSaldo']);
    Route::post('/fiado/transferencia',                [ClienteController::class, 'transferirSaldo']);
    Route::post('/fiado/lancamentos/{lancamento}/estornar', [ClienteController::class, 'estornarLancamento']);
    Route::put('/fiado/lancamentos/{lancamento}',      [ClienteController::class, 'editarLancamento']);
    Route::post('/clientes/{cliente}/dependentes', [ClienteController::class, 'adicionarDependente']);
    Route::delete('/clientes/{cliente}/dependentes/{dependente}', [ClienteController::class, 'removerDependente']);
    Route::put('/clientes/{cliente}', [ClienteController::class, 'update']);
    Route::put('/clientes/{cliente}', [ClienteController::class, 'update']);
    
    // ─── Vendas ─────────────────────────────────────────────────────────────
    Route::get('/vendas',   [VendaController::class, 'index']);
    Route::post('/vendas',  [VendaController::class, 'store']);
    Route::get('/parcelas', [ParcelaController::class, 'index']);
    Route::post('/parcelas/{parcela}/pagar', [ParcelaController::class, 'marcarPaga']);
    Route::post('/parcelas/{parcela}/desfazer', [ParcelaController::class, 'desmarcarPaga']);
    Route::get('/vendas/{venda}', [VendaController::class, 'show']);
    Route::delete('/vendas/{venda}', [VendaController::class, 'destroy']);

    // ─── Notas Fiscais ───────────────────────────────────────────────────────
    Route::get('/notas-fiscais',                        [NotaFiscalController::class, 'index']);
    Route::post('/notas-fiscais/analisar',              [NotaFiscalController::class, 'analisar']);
    Route::post('/notas-fiscais/entrada',               [NotaFiscalController::class, 'registrarEntrada']);
    Route::get('/notas-fiscais/{notaFiscal}',           [NotaFiscalController::class, 'show']);
    Route::post('/notas-fiscais',                       [NotaFiscalController::class, 'store']);
    Route::post('/notas-fiscais/{notaFiscal}/confirmar',[NotaFiscalController::class, 'confirmarEntrada']);
    Route::put('/notas-fiscais/{notaFiscal}/itens/{item}', [NotaFiscalController::class, 'atualizarItem']);

    // ─── Movimentações ──────────────────────────────────────────────────────
    Route::get('/movimentacoes',      [MovimentacaoController::class, 'index']);
    Route::post('/movimentacoes/saida', [MovimentacaoController::class, 'saida']);

    // ─── Pedidos (admin) ─────────────────────────────────────────────────────────
    Route::get('/pedidos', [PedidoController::class, 'index']);
    Route::put('/pedidos/{pedido}/status', [PedidoController::class, 'atualizarStatus']);
    
    Route::get('/despesas', [DespesaController::class, 'index']);
    Route::post('/despesas', [DespesaController::class, 'store']);
    Route::put('/despesas/{despesa}', [DespesaController::class, 'update']);
    Route::delete('/despesas/{despesa}', [DespesaController::class, 'destroy']);
    
    // ─── Importar Lote de Produto ─────────────────────────────────────────────────────────
    Route::post('/produtos/importar-lote', [ImportacaoProdutoController::class, 'importarLote']);
    
     // ─── Recebimentos ─────────────────────────────────────────────────────────
    Route::get('/recebimentos', [RecebimentoController::class, 'index']);
});

Route::get('/ver-categorias-id', function() {
    return App\Models\Categoria::all(['id', 'nome']);
});
// ─── Rotas públicas (vitrine) ─────────────────────────────────────────────
Route::get('/vitrine/produtos',   [VitrineController::class, 'produtos']);
Route::get('/vitrine/produtos/{id}', [VitrineController::class, 'produto'])->whereNumber('id');
Route::get('/vitrine/categorias', [VitrineController::class, 'categorias']);

// ─── Fora do grupo auth (rotas públicas) ─────────────────────────────────────
// Adicionar FORA do middleware auth:sanctum:

Route::post('/vitrine/pedidos',                 [PedidoController::class, 'store']);
Route::get('/vitrine/pedidos/{codigo}',         [PedidoController::class, 'show']);
Route::post('/vitrine/frete/calcular',          [FreteController::class, 'calcular']);

// Webhook MP (sem auth):
Route::post('/webhook/mercadopago',             [PedidoController::class, 'webhook']);