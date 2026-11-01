import { useState } from "react";
import { buscarCep } from "../api.js";
import { lucro, moeda } from "../format.js";

// Reduz a foto no navegador (máx. 800 px) para ela caber no Redis.
function reduzirImagem(arquivo, max = 800) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => {
      const esc = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * esc);
      canvas.height = Math.round(img.height * esc);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.8));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não foi possível ler essa imagem."));
    };
    img.src = url;
  });
}

const VAZIO = {
  nome: "",
  marca: "",
  categoria: "",
  preco_custo: "",
  preco_venda: "",
  quantidade: "",
  status: "Disponível",
  imagem: "",
  cep: "",
  logradouro: "",
  bairro: "",
  cidade: "",
  uf: "",
};

// Mesmas regras do backend, para avisar o erro antes de enviar.
function validar(v) {
  const e = {};
  if (v.nome.trim().length < 2) e.nome = "Informe o nome (mínimo 2 caracteres).";
  if (!v.marca.trim()) e.marca = "Informe a marca.";
  if (v.categoria.trim().length < 2) e.categoria = "Informe a categoria (mínimo 2 caracteres).";
  if (v.preco_custo === "" || Number(v.preco_custo) < 0)
    e.preco_custo = "Informe o preço de custo (0 ou mais).";
  if (v.preco_venda === "" || Number(v.preco_venda) <= 0)
    e.preco_venda = "Informe o preço de venda (maior que 0).";
  if (v.quantidade === "" || !Number.isInteger(Number(v.quantidade)) || Number(v.quantidade) < 0)
    e.quantidade = "Informe a quantidade em estoque (número inteiro, 0 ou mais).";
  if (v.status === "Disponível" && v.quantidade !== "" && Number(v.quantidade) === 0 && !e.quantidade)
    e.status = "Um produto sem estoque deve ficar como Vendido.";
  if (v.cep.replace(/\D/g, "").length !== 8 || !v.cidade)
    e.cep = "Informe um CEP válido e espere o endereço aparecer.";
  return e;
}

function Campo({ id, rotulo, erro, children }) {
  return (
    <div className="campo">
      <label htmlFor={id}>{rotulo}</label>
      {children}
      {erro && (
        <p className="erro" id={`${id}-erro`}>
          {erro}
        </p>
      )}
    </div>
  );
}

export default function ProdutoForm({ produto, categorias, onSalvar, onCancelar }) {
  const [valores, setValores] = useState(
    produto
      ? {
          ...VAZIO,
          ...Object.fromEntries(Object.entries(produto).filter(([, x]) => x !== null)),
          preco_custo: String(produto.preco_custo),
          preco_venda: String(produto.preco_venda),
          quantidade: String(produto.quantidade),
        }
      : VAZIO
  );
  const [erros, setErros] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);

  async function aoEscolherImagem(ev) {
    const arquivo = ev.target.files?.[0];
    if (!arquivo) return;
    if (!arquivo.type.startsWith("image/")) {
      setErros((x) => ({ ...x, imagem: "Escolha um arquivo de imagem (JPG, PNG ou WebP)." }));
      return;
    }
    try {
      const imagem = await reduzirImagem(arquivo);
      setValores((v) => ({ ...v, imagem }));
      setErros((x) => ({ ...x, imagem: undefined }));
    } catch (err) {
      setErros((x) => ({ ...x, imagem: err.message }));
    }
  }

  // Digitou os 8 números do CEP: busca o endereço sozinho.
  async function aoMudarCep(ev) {
    const digitos = ev.target.value.replace(/\D/g, "").slice(0, 8);
    const mascara = digitos.length > 5 ? `${digitos.slice(0, 5)}-${digitos.slice(5)}` : digitos;
    setValores((v) => ({
      ...v,
      cep: mascara,
      ...(digitos.length < 8 ? { logradouro: "", bairro: "", cidade: "", uf: "" } : {}),
    }));
    if (digitos.length < 8) return;
    setBuscandoCep(true);
    try {
      const e = await buscarCep(digitos);
      setValores((v) => ({ ...v, logradouro: e.logradouro, bairro: e.bairro, cidade: e.cidade, uf: e.uf }));
      setErros((x) => ({ ...x, cep: undefined }));
    } catch (err) {
      setErros((x) => ({ ...x, cep: err.message }));
    } finally {
      setBuscandoCep(false);
    }
  }

  const entrada = (nome) => ({
    id: `campo-${nome}`,
    value: valores[nome],
    onChange: (ev) => setValores((v) => ({ ...v, [nome]: ev.target.value })),
    "aria-invalid": erros[nome] ? true : undefined,
    "aria-describedby": erros[nome] ? `campo-${nome}-erro` : undefined,
  });

  async function enviar(ev) {
    ev.preventDefault();
    const novosErros = validar(valores);
    setErros(novosErros);
    if (Object.keys(novosErros).length) return;

    setEnviando(true);
    try {
      await onSalvar({
        nome: valores.nome.trim(),
        marca: valores.marca.trim(),
        categoria: valores.categoria.trim(),
        preco_custo: Number(valores.preco_custo),
        preco_venda: Number(valores.preco_venda),
        quantidade: Number(valores.quantidade),
        status: valores.status,
        imagem: valores.imagem || null,
        cep: valores.cep.replace(/\D/g, "") || null,
        logradouro: valores.logradouro || null,
        bairro: valores.bairro || null,
        cidade: valores.cidade || null,
        uf: valores.uf || null,
      });
    } catch (err) {
      // Erros de campo vindos do backend aparecem junto de cada campo.
      const porCampo = {};
      (err.erros || []).forEach((x) => (porCampo[x.campo] = x.mensagem));
      setErros(Object.keys(porCampo).length ? porCampo : { geral: err.message });
    } finally {
      setEnviando(false);
    }
  }

  const custo = Number(valores.preco_custo);
  const venda = Number(valores.preco_venda);
  const mostrarLucro = valores.preco_custo !== "" && valores.preco_venda !== "" && venda > 0;
  const { valor: lucroUn, pct } = mostrarLucro ? lucro(custo, venda) : {};

  return (
    <form onSubmit={enviar} noValidate>
      {erros.geral && (
        <p className="alerta" role="alert">
          {erros.geral}
        </p>
      )}

      <div className="campo">
        <label htmlFor="campo-imagem">Foto do produto</label>
        <div className="foto">
          {valores.imagem ? <img src={valores.imagem} alt="Pré-visualização do produto" /> : <span>Sem foto</span>}
          <div>
            <input id="campo-imagem" type="file" accept="image/*" onChange={aoEscolherImagem} />
            {valores.imagem && (
              <button type="button" className="link perigo" onClick={() => setValores((v) => ({ ...v, imagem: "" }))}>
                Remover foto
              </button>
            )}
          </div>
        </div>
        {erros.imagem && <p className="erro">{erros.imagem}</p>}
      </div>

      <Campo id="campo-nome" rotulo="Nome do produto" erro={erros.nome}>
        <input type="text" maxLength={100} autoComplete="off" {...entrada("nome")} />
      </Campo>

      <div className="linha">
        <Campo id="campo-marca" rotulo="Marca" erro={erros.marca}>
          <input type="text" maxLength={60} autoComplete="off" {...entrada("marca")} />
        </Campo>
        <Campo id="campo-categoria" rotulo="Categoria" erro={erros.categoria}>
          <input type="text" maxLength={60} list="lista-categorias" autoComplete="off" {...entrada("categoria")} />
          <datalist id="lista-categorias">
            {categorias.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Campo>
      </div>

      <div className="linha">
        <Campo id="campo-preco_custo" rotulo="Preço de custo (R$)" erro={erros.preco_custo}>
          <input type="number" min="0" step="0.01" inputMode="decimal" {...entrada("preco_custo")} />
        </Campo>
        <Campo id="campo-preco_venda" rotulo="Preço de venda (R$)" erro={erros.preco_venda}>
          <input type="number" min="0" step="0.01" inputMode="decimal" {...entrada("preco_venda")} />
        </Campo>
      </div>

      {mostrarLucro && (
        <p className={`lucro ${lucroUn < 0 ? "negativo" : ""}`}>
          {lucroUn < 0 ? "Prejuízo" : "Lucro"} por unidade: {moeda(Math.abs(lucroUn))}
          {pct !== null && ` (${Math.abs(pct).toFixed(0)}% sobre o custo)`}
        </p>
      )}

      <div className="linha">
        <Campo id="campo-quantidade" rotulo="Quantidade em estoque" erro={erros.quantidade}>
          <input type="number" min="0" step="1" inputMode="numeric" {...entrada("quantidade")} />
        </Campo>
        <Campo id="campo-status" rotulo="Status" erro={erros.status}>
          <select {...entrada("status")}>
            <option value="Disponível">Disponível</option>
            <option value="Vendido">Vendido</option>
          </select>
        </Campo>
      </div>

      <Campo id="campo-cep" rotulo="CEP de onde o produto sai" erro={erros.cep}>
        <input type="text" inputMode="numeric" placeholder="00000-000" autoComplete="postal-code" {...entrada("cep")} onChange={aoMudarCep} />
      </Campo>
      {buscandoCep && <p className="dica">Buscando endereço...</p>}
      {valores.cidade && (
        <p className="local">
          {[valores.logradouro, valores.bairro, `${valores.cidade} - ${valores.uf}`].filter(Boolean).join(", ")}
        </p>
      )}

      <div className="acoes-form">
        <button type="button" className="botao secundario" onClick={onCancelar}>
          Cancelar
        </button>
        <button type="submit" className="botao" disabled={enviando}>
          {enviando ? "Salvando..." : produto ? "Salvar alterações" : "Cadastrar produto"}
        </button>
      </div>
    </form>
  );
}
