"""Acesso aos dados no Redis.

Modelagem (detalhes em docs/MODELAGEM.md):
  produto:seq        -> String  : contador usado para gerar IDs (INCR)
  produto:<id>       -> Hash    : os campos de um produto
  produtos:index     -> ZSet    : IDs de todos os produtos (score = próprio ID)
"""
from redis import Redis

from .schemas import Produto, ProdutoDados

CHAVE_SEQUENCIA = "produto:seq"
CHAVE_INDICE = "produtos:index"
OPCIONAIS = ("imagem", "cep", "logradouro", "bairro", "cidade", "uf")


def _chave(produto_id: int) -> str:
    return f"produto:{produto_id}"


def _para_hash(dados: ProdutoDados) -> dict[str, str]:
    campos = {
        "nome": dados.nome,
        "marca": dados.marca,
        "categoria": dados.categoria,
        "preco_custo": str(dados.preco_custo),
        "preco_venda": str(dados.preco_venda),
        "quantidade": str(dados.quantidade),
        "status": dados.status.value,
    }
    for nome in OPCIONAIS:  # o Redis não guarda "vazio": só grava o que foi informado
        valor = getattr(dados, nome)
        if valor:
            campos[nome] = valor
    return campos


def _para_produto(produto_id: int, campos: dict[str, str]) -> Produto:
    # O Pydantic converte as strings do Redis de volta para float/int/Enum.
    return Produto(id=produto_id, **campos)


def criar(r: Redis, dados: ProdutoDados) -> Produto:
    produto_id = r.incr(CHAVE_SEQUENCIA)
    pipe = r.pipeline()  # grava hash + índice juntos
    pipe.hset(_chave(produto_id), mapping=_para_hash(dados))
    pipe.zadd(CHAVE_INDICE, {str(produto_id): produto_id})
    pipe.execute()
    return Produto(id=produto_id, **dados.model_dump())


def obter(r: Redis, produto_id: int) -> Produto | None:
    campos = r.hgetall(_chave(produto_id))
    return _para_produto(produto_id, campos) if campos else None


def listar(
    r: Redis,
    busca: str | None = None,
    categoria: str | None = None,
    status: str | None = None,
) -> list[Produto]:
    ids = r.zrevrange(CHAVE_INDICE, 0, -1)  # mais recentes primeiro
    if not ids:
        return []

    pipe = r.pipeline()
    for produto_id in ids:
        pipe.hgetall(_chave(int(produto_id)))
    resultados = pipe.execute()

    produtos = [_para_produto(int(i), c) for i, c in zip(ids, resultados) if c]

    if busca:
        termo = busca.strip().lower()
        produtos = [
            p for p in produtos if termo in p.nome.lower() or termo in p.marca.lower()
        ]
    if categoria:
        produtos = [p for p in produtos if p.categoria.lower() == categoria.strip().lower()]
    if status:
        produtos = [p for p in produtos if p.status.value == status]
    return produtos


def atualizar(r: Redis, produto_id: int, dados: ProdutoDados) -> Produto | None:
    if not r.exists(_chave(produto_id)):
        return None
    campos = _para_hash(dados)
    r.hset(_chave(produto_id), mapping=campos)
    ausentes = [n for n in OPCIONAIS if n not in campos]  # ex.: foto removida
    if ausentes:
        r.hdel(_chave(produto_id), *ausentes)
    return Produto(id=produto_id, **dados.model_dump())


def excluir(r: Redis, produto_id: int) -> Produto | None:
    produto = obter(r, produto_id)
    if produto is None:
        return None
    pipe = r.pipeline()
    pipe.delete(_chave(produto_id))
    pipe.zrem(CHAVE_INDICE, str(produto_id))
    pipe.execute()
    return produto
