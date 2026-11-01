import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  atualizarProduto,
  buscarProduto,
  criarProduto,
  excluirProduto,
  listarProdutos,
} from "./api.js";
import { moeda } from "./format.js";
import Modal from "./components/Modal.jsx";
import ProdutoDetalhes from "./components/ProdutoDetalhes.jsx";
import ProdutoForm from "./components/ProdutoForm.jsx";
import ProdutosTabela from "./components/ProdutosTabela.jsx";
import ProdutosVitrine from "./components/ProdutosVitrine.jsx";
import Toasts from "./components/Toasts.jsx";

const FILTROS_VAZIOS = { busca: "", categoria: "", status: "" };

export default function App() {
  const [visao, setVisao] = useState("loja"); // "loja" | "estoque"
  const [produtos, setProdutos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState("");
  const [filtros, setFiltros] = useState(FILTROS_VAZIOS);
  const [buscaAtrasada, setBuscaAtrasada] = useState("");
  const [categorias, setCategorias] = useState([]);

  const [form, setForm] = useState(null); // { produto } (produto = null → novo)
  const [detalhe, setDetalhe] = useState(null);
  const [exclusao, setExclusao] = useState(null);
  const [excluindo, setExcluindo] = useState(false);
  const [idConsulta, setIdConsulta] = useState("");
  const [avisos, setAvisos] = useState([]);
  const ultimaRequisicao = useRef(0);

  // ----- avisos de sucesso/erro -----
  const fecharAviso = useCallback((id) => setAvisos((a) => a.filter((x) => x.id !== id)), []);
  const avisar = useCallback(
    (tipo, texto) => {
      const id = Date.now() + Math.random();
      setAvisos((a) => [...a, { id, tipo, texto }]);
      setTimeout(() => fecharAviso(id), 5000);
    },
    [fecharAviso]
  );

  // ----- busca com pequeno atraso para não chamar a API a cada tecla -----
  useEffect(() => {
    const t = setTimeout(() => setBuscaAtrasada(filtros.busca), 300);
    return () => clearTimeout(t);
  }, [filtros.busca]);

  // ----- carregar lista (GET /produtos) -----
  const carregar = useCallback(async () => {
    const minha = ++ultimaRequisicao.current;
    setCarregando(true);
    try {
      const lista = await listarProdutos({
        busca: buscaAtrasada,
        categoria: filtros.categoria,
        status: filtros.status,
      });
      if (minha !== ultimaRequisicao.current) return;
      setProdutos(lista);
      setErroLista("");
      setCategorias((antes) =>
        [...new Set([...antes, ...lista.map((p) => p.categoria)])].sort((a, b) =>
          a.localeCompare(b, "pt-BR")
        )
      );
    } catch (e) {
      if (minha !== ultimaRequisicao.current) return;
      setErroLista(e.message);
    } finally {
      if (minha === ultimaRequisicao.current) setCarregando(false);
    }
  }, [buscaAtrasada, filtros.categoria, filtros.status]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // ----- consultar por ID (GET /produtos/{id}) -----
  async function abrirDetalhe(id) {
    try {
      setDetalhe(await buscarProduto(id));
    } catch (e) {
      avisar("erro", e.message);
    }
  }

  function consultarPorId(ev) {
    ev.preventDefault();
    const id = Number(idConsulta);
    if (!Number.isInteger(id) || id < 1) {
      avisar("erro", "Informe um ID válido (número inteiro maior que 0).");
      return;
    }
    abrirDetalhe(id);
  }

  // ----- cadastrar / atualizar (POST / PUT) -----
  async function salvar(dados) {
    const editando = form?.produto;
    const resposta = editando
      ? await atualizarProduto(editando.id, dados)
      : await criarProduto(dados);
    setForm(null);
    avisar("sucesso", resposta.mensagem);
    carregar();
  }

  // ----- excluir (DELETE) -----
  async function confirmarExclusao() {
    setExcluindo(true);
    try {
      const resposta = await excluirProduto(exclusao.id);
      avisar("sucesso", resposta.mensagem);
    } catch (e) {
      avisar("erro", e.message);
    } finally {
      setExcluindo(false);
      setExclusao(null);
      carregar();
    }
  }

  function editarDoDetalhe(produto) {
    setDetalhe(null);
    setForm({ produto });
  }

  const resumo = useMemo(() => {
    const disponiveis = produtos.filter((p) => p.status === "Disponível");
    return {
      produtos: produtos.length,
      unidades: disponiveis.reduce((s, p) => s + p.quantidade, 0),
      valor: disponiveis.reduce((s, p) => s + p.preco_venda * p.quantidade, 0),
      lucro: disponiveis.reduce((s, p) => s + (p.preco_venda - p.preco_custo) * p.quantidade, 0),
    };
  }, [produtos]);

  const temFiltro = filtros.busca || filtros.categoria || filtros.status;
  const limparFiltros = () => setFiltros(FILTROS_VAZIOS);
  const mudarFiltro = (campo) => (ev) => setFiltros((f) => ({ ...f, [campo]: ev.target.value }));

  const loja = visao === "loja";

  return (
    <>
      <header className="marca">
        <div className="marca-in">
          <img src="/logo.png" alt="TudoOn: sua loja online sempre ligada em você!" />
          <nav aria-label="Áreas do site">
            <button type="button" aria-current={loja ? "page" : undefined} onClick={() => setVisao("loja")}>
              Loja
            </button>
            <button type="button" aria-current={!loja ? "page" : undefined} onClick={() => setVisao("estoque")}>
              Estoque
            </button>
          </nav>
        </div>
      </header>
    <div className="pagina">
      <header className="topo">
        <div>
          <h1>{loja ? "Vitrine" : "Estoque da revenda"}</h1>
          <p className="subtitulo">
            {loja
              ? "Escolha um produto para ver as fotos, o preço e de onde ele sai."
              : "Cadastre, consulte e atualize os produtos que você revende."}
          </p>
        </div>
      </header>

      {!loja && (
      <section className="resumo" aria-label="Resumo da lista atual">
        <div>
          <strong>{resumo.produtos}</strong>
          <span>produtos na lista</span>
        </div>
        <div>
          <strong>{resumo.unidades}</strong>
          <span>unidades disponíveis</span>
        </div>
        <div>
          <strong>{moeda(resumo.valor)}</strong>
          <span>valor em estoque</span>
        </div>
        <div>
          <strong>{moeda(resumo.lucro)}</strong>
          <span>lucro previsto</span>
        </div>
      </section>
      )}

      <section className="barra" aria-label="Filtros e consulta">
        <div className="filtros">
          <input
            type="search"
            placeholder="Buscar por nome ou marca"
            aria-label="Buscar por nome ou marca"
            value={filtros.busca}
            onChange={mudarFiltro("busca")}
          />
          <select aria-label="Filtrar por categoria" value={filtros.categoria} onChange={mudarFiltro("categoria")}>
            <option value="">Todas as categorias</option>
            {categorias.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select aria-label="Filtrar por status" value={filtros.status} onChange={mudarFiltro("status")}>
            <option value="">Todos os status</option>
            <option value="Disponível">Disponível</option>
            <option value="Vendido">Vendido</option>
          </select>
        </div>
        <div className="barra-acoes">
          <form className="consulta-id" onSubmit={consultarPorId}>
            <input
              type="number"
              min="1"
              placeholder="ID do produto"
              aria-label="ID do produto"
              value={idConsulta}
              onChange={(ev) => setIdConsulta(ev.target.value)}
            />
            <button type="submit" className="botao secundario">
              Consultar ID
            </button>
          </form>
          <button type="button" className="botao" onClick={() => setForm({ produto: null })}>
            Novo produto
          </button>
        </div>
      </section>

      <main>
        {erroLista && (
          <div className="alerta" role="alert">
            <p>{erroLista}</p>
            <button type="button" className="botao secundario" onClick={carregar}>
              Tentar novamente
            </button>
          </div>
        )}

        {!erroLista && carregando && produtos.length === 0 && <p className="vazio">Carregando produtos...</p>}

        {!erroLista && !carregando && produtos.length === 0 && (
          <div className="vazio">
            {temFiltro ? (
              <>
                <p>Nenhum produto encontrado com esses filtros.</p>
                <button type="button" className="botao secundario" onClick={limparFiltros}>
                  Limpar filtros
                </button>
              </>
            ) : (
              <>
                <p>Nenhum produto cadastrado ainda. Cadastre o primeiro para começar.</p>
                <button type="button" className="botao" onClick={() => setForm({ produto: null })}>
                  Novo produto
                </button>
              </>
            )}
          </div>
        )}

        {produtos.length > 0 && (
          <div className={`${loja ? "grade" : "lista"}${carregando ? " atualizando" : ""}`}>
            {loja ? (
              <ProdutosVitrine produtos={produtos} onDetalhes={abrirDetalhe} />
            ) : (
              <ProdutosTabela
                produtos={produtos}
                onDetalhes={abrirDetalhe}
                onEditar={(p) => setForm({ produto: p })}
                onExcluir={setExclusao}
              />
            )}
          </div>
        )}
      </main>

      <Modal
        aberto={form !== null}
        onFechar={() => setForm(null)}
        titulo={form?.produto ? "Editar produto" : "Novo produto"}
      >
        {form && (
          <ProdutoForm
            produto={form.produto}
            categorias={categorias}
            onSalvar={salvar}
            onCancelar={() => setForm(null)}
          />
        )}
      </Modal>

      <Modal aberto={detalhe !== null} onFechar={() => setDetalhe(null)} titulo="Detalhes do produto">
        {detalhe && (
          <ProdutoDetalhes produto={detalhe} onEditar={editarDoDetalhe} onFechar={() => setDetalhe(null)} />
        )}
      </Modal>

      <Modal aberto={exclusao !== null} onFechar={() => setExclusao(null)} titulo="Excluir produto?">
        {exclusao && (
          <div>
            <p className="confirma">
              "{exclusao.nome}" será removido do estoque. Essa ação não pode ser desfeita.
            </p>
            <div className="acoes-form">
              <button type="button" className="botao secundario" onClick={() => setExclusao(null)}>
                Cancelar
              </button>
              <button type="button" className="botao perigo" onClick={confirmarExclusao} disabled={excluindo}>
                {excluindo ? "Excluindo..." : "Excluir produto"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Toasts avisos={avisos} onFechar={fecharAviso} />
    </div>
    </>
  );
}
