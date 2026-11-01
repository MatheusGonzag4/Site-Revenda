// Todas as chamadas à API Python ficam aqui.
const BASE_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(message, { status = 0, erros = [] } = {}) {
    super(message);
    this.status = status;
    this.erros = erros; // [{ campo, mensagem }] vindos da validação do backend
  }
}

async function request(caminho, opcoes = {}) {
  let resposta;
  try {
    resposta = await fetch(`${BASE_URL}${caminho}`, {
      ...opcoes,
      headers: opcoes.body ? { "Content-Type": "application/json" } : {},
    });
  } catch {
    throw new ApiError("Não foi possível conectar à API. Verifique se o backend está rodando.");
  }

  let corpo = null;
  try {
    corpo = await resposta.json();
  } catch {
    /* resposta sem corpo */
  }

  if (!resposta.ok) {
    throw new ApiError(corpo?.detail || `Erro inesperado (${resposta.status}).`, {
      status: resposta.status,
      erros: corpo?.erros ?? [],
    });
  }
  return corpo;
}

export function listarProdutos({ busca, categoria, status } = {}) {
  const params = new URLSearchParams();
  if (busca) params.set("busca", busca);
  if (categoria) params.set("categoria", categoria);
  if (status) params.set("status", status);
  const qs = params.toString();
  return request(`/produtos${qs ? `?${qs}` : ""}`);
}

export const buscarProduto = (id) => request(`/produtos/${id}`);

export const criarProduto = (dados) =>
  request("/produtos", { method: "POST", body: JSON.stringify(dados) });

export const atualizarProduto = (id, dados) =>
  request(`/produtos/${id}`, { method: "PUT", body: JSON.stringify(dados) });

export const excluirProduto = (id) => request(`/produtos/${id}`, { method: "DELETE" });

// Endereço pelo CEP (o backend consulta o ViaCEP)
export const buscarCep = (cep) => request(`/cep/${cep}`);
