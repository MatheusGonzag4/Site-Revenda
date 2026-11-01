"""API REST da Revenda (FastAPI + Redis).

Documentação interativa: http://localhost:8000/docs
"""
import json
import os
import urllib.error
import urllib.request

from fastapi import Depends, FastAPI, HTTPException, Path, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from redis import Redis
from redis.exceptions import RedisError

from . import repository
from .database import get_redis
from .schemas import Produto, ProdutoDados, Resposta, Status

app = FastAPI(
    title="API Revenda",
    description="CRUD de produtos de uma revenda, com dados guardados no Redis.",
    version="1.0.0",
)

origens = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in origens.split(",") if o.strip()],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- Tratamento de erros ----------

def _traduzir(erro: dict) -> str:
    tipo, ctx = erro["type"], erro.get("ctx", {})
    if tipo == "missing":
        return "Campo obrigatório."
    if tipo == "string_too_short":
        return f"Use pelo menos {ctx.get('min_length')} caractere(s)."
    if tipo == "string_too_long":
        return f"Use no máximo {ctx.get('max_length')} caracteres."
    if tipo == "greater_than":
        return f"O valor deve ser maior que {ctx.get('gt')}."
    if tipo == "greater_than_equal":
        return f"O valor deve ser {ctx.get('ge')} ou mais."
    if tipo == "string_pattern_mismatch":
        return "CEP inválido. Use 8 números."
    if tipo == "enum":
        return "Valor inválido. Use 'Disponível' ou 'Vendido'."
    if tipo == "value_error":
        return str(erro["msg"]).removeprefix("Value error, ")
    if tipo.endswith(("_parsing", "_type", "_from_float")):
        return "Valor inválido."
    return str(erro["msg"])


@app.exception_handler(RequestValidationError)
async def erro_de_validacao(_: Request, exc: RequestValidationError):
    erros = [{"campo": str(e["loc"][-1]), "mensagem": _traduzir(e)} for e in exc.errors()]
    return JSONResponse(
        status_code=422,
        content={"detail": "Dados inválidos. Corrija os campos indicados.", "erros": erros},
    )


@app.exception_handler(RedisError)
async def erro_do_redis(_: Request, exc: RedisError):
    return JSONResponse(
        status_code=503,
        content={"detail": "Banco de dados indisponível. Verifique se o Redis está rodando."},
    )


def _nao_encontrado(produto_id: int) -> HTTPException:
    return HTTPException(status_code=404, detail=f"Produto {produto_id} não encontrado.")


def _buscar_viacep(cep: str) -> dict:
    """Chama a API pública ViaCEP: https://viacep.com.br/ws/<cep>/json/"""
    try:
        with urllib.request.urlopen(f"https://viacep.com.br/ws/{cep}/json/", timeout=5) as resp:
            return json.load(resp)
    except (urllib.error.URLError, TimeoutError, ValueError):
        raise HTTPException(status_code=503, detail="Não foi possível consultar o ViaCEP agora. Tente novamente.")


# ---------- Endpoints ----------

@app.get("/", tags=["Geral"], summary="Verifica se a API está no ar")
def raiz():
    return {"mensagem": "API Revenda no ar.", "documentacao": "/docs"}


@app.get("/saude", tags=["Geral"], summary="Verifica a conexão com o Redis")
def saude(r: Redis = Depends(get_redis)):
    r.ping()
    return {"api": "ok", "redis": "ok"}


@app.get("/cep/{cep}", tags=["CEP"], summary="Consulta o endereço de um CEP (via ViaCEP)")
def consultar_cep(cep: str = Path(..., pattern=r"^\d{8}$", description="8 números, sem traço")):
    dados = _buscar_viacep(cep)
    if dados.get("erro"):
        raise HTTPException(status_code=404, detail="CEP não encontrado.")
    return {
        "cep": cep,
        "logradouro": dados.get("logradouro", ""),
        "bairro": dados.get("bairro", ""),
        "cidade": dados.get("localidade", ""),
        "uf": dados.get("uf", ""),
    }


@app.post("/produtos", response_model=Resposta, status_code=201, tags=["Produtos"],
          summary="Cadastrar produto")
def cadastrar(dados: ProdutoDados, r: Redis = Depends(get_redis)):
    produto = repository.criar(r, dados)
    return Resposta(mensagem=f"Produto '{produto.nome}' cadastrado com sucesso.", produto=produto)


@app.get("/produtos", response_model=list[Produto], tags=["Produtos"],
         summary="Listar produtos (com filtros opcionais)")
def listar(
    busca: str | None = Query(None, description="Texto no nome ou na marca"),
    categoria: str | None = Query(None, description="Categoria exata"),
    status: Status | None = Query(None, description="Disponível ou Vendido"),
    r: Redis = Depends(get_redis),
):
    return repository.listar(r, busca, categoria, status.value if status else None)


@app.get("/produtos/{produto_id}", response_model=Produto, tags=["Produtos"],
         summary="Consultar produto por ID")
def consultar(produto_id: int = Path(..., ge=1), r: Redis = Depends(get_redis)):
    produto = repository.obter(r, produto_id)
    if produto is None:
        raise _nao_encontrado(produto_id)
    return produto


@app.put("/produtos/{produto_id}", response_model=Resposta, tags=["Produtos"],
         summary="Atualizar produto")
def atualizar(dados: ProdutoDados, produto_id: int = Path(..., ge=1),
              r: Redis = Depends(get_redis)):
    produto = repository.atualizar(r, produto_id, dados)
    if produto is None:
        raise _nao_encontrado(produto_id)
    return Resposta(mensagem=f"Produto '{produto.nome}' atualizado com sucesso.", produto=produto)


@app.delete("/produtos/{produto_id}", response_model=Resposta, tags=["Produtos"],
            summary="Excluir produto")
def excluir(produto_id: int = Path(..., ge=1), r: Redis = Depends(get_redis)):
    produto = repository.excluir(r, produto_id)
    if produto is None:
        raise _nao_encontrado(produto_id)
    return Resposta(mensagem=f"Produto '{produto.nome}' excluído com sucesso.", produto=produto)
