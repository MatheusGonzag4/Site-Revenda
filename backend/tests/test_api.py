"""Testes da API usando um Redis falso em memória (não precisa do Redis real).

Rodar:  pytest
"""
import fakeredis
import pytest
from fastapi.testclient import TestClient

from app.database import get_redis
from app.main import app


@pytest.fixture()
def client():
    falso = fakeredis.FakeRedis(decode_responses=True)
    app.dependency_overrides[get_redis] = lambda: falso
    yield TestClient(app)
    app.dependency_overrides.clear()


PRODUTO = {
    "nome": "Tênis Nike Air",
    "marca": "Nike",
    "categoria": "Calçados",
    "preco_custo": 200,
    "preco_venda": 320,
    "quantidade": 5,
    "status": "Disponível",
}


def test_crud_completo(client):
    r = client.post("/produtos", json=PRODUTO)
    assert r.status_code == 201
    assert "cadastrado com sucesso" in r.json()["mensagem"]
    pid = r.json()["produto"]["id"]

    assert client.get(f"/produtos/{pid}").json()["nome"] == "Tênis Nike Air"
    assert len(client.get("/produtos").json()) == 1

    r = client.put(f"/produtos/{pid}", json={**PRODUTO, "preco_venda": 350, "quantidade": 3})
    assert r.status_code == 200
    assert client.get(f"/produtos/{pid}").json()["preco_venda"] == 350

    assert client.delete(f"/produtos/{pid}").status_code == 200
    assert client.get(f"/produtos/{pid}").status_code == 404
    assert client.get("/produtos").json() == []


def test_ids_sao_sequenciais(client):
    ids = [client.post("/produtos", json=PRODUTO).json()["produto"]["id"] for _ in range(3)]
    assert ids == [1, 2, 3]


def test_produto_inexistente_retorna_404(client):
    for metodo, kwargs in [("get", {}), ("put", {"json": PRODUTO}), ("delete", {})]:
        r = getattr(client, metodo)("/produtos/999", **kwargs)
        assert r.status_code == 404
        assert "não encontrado" in r.json()["detail"]


def test_validacoes(client):
    r = client.post("/produtos", json={**PRODUTO, "nome": "A", "preco_venda": 0, "quantidade": -1})
    assert r.status_code == 422
    campos = {e["campo"] for e in r.json()["erros"]}
    assert {"nome", "preco_venda", "quantidade"} <= campos


def test_campo_obrigatorio(client):
    incompleto = {k: v for k, v in PRODUTO.items() if k != "marca"}
    r = client.post("/produtos", json=incompleto)
    assert r.status_code == 422
    assert r.json()["erros"][0] == {"campo": "marca", "mensagem": "Campo obrigatório."}


def test_disponivel_exige_estoque(client):
    r = client.post("/produtos", json={**PRODUTO, "quantidade": 0})
    assert r.status_code == 422
    assert r.json()["erros"][0]["campo"] == "status"
    r = client.post("/produtos", json={**PRODUTO, "quantidade": 0, "status": "Vendido"})
    assert r.status_code == 201


def test_filtros_da_listagem(client):
    client.post("/produtos", json=PRODUTO)
    client.post("/produtos", json={**PRODUTO, "nome": "Camiseta", "marca": "Hering",
                                   "categoria": "Roupas", "quantidade": 0, "status": "Vendido"})
    assert len(client.get("/produtos", params={"busca": "hering"}).json()) == 1
    assert len(client.get("/produtos", params={"categoria": "calçados"}).json()) == 1
    assert len(client.get("/produtos", params={"status": "Vendido"}).json()) == 1
    assert client.get("/produtos", params={"status": "Outro"}).status_code == 422


def test_id_invalido(client):
    assert client.get("/produtos/0").status_code == 422
    assert client.get("/produtos/abc").status_code == 422


def test_cep_consulta(client, monkeypatch):
    monkeypatch.setattr("app.main._buscar_viacep", lambda cep: {
        "logradouro": "Praça da Sé", "bairro": "Sé", "localidade": "São Paulo", "uf": "SP"})
    r = client.get("/cep/01001000")
    assert r.status_code == 200
    assert r.json() == {"cep": "01001000", "logradouro": "Praça da Sé",
                        "bairro": "Sé", "cidade": "São Paulo", "uf": "SP"}


def test_cep_inexistente_e_invalido(client, monkeypatch):
    monkeypatch.setattr("app.main._buscar_viacep", lambda cep: {"erro": True})
    assert client.get("/cep/99999999").status_code == 404
    assert client.get("/cep/123").status_code == 422


def test_imagem_e_endereco(client):
    imagem = "data:image/jpeg;base64,/9j/4AAQ"
    dados = {**PRODUTO, "imagem": imagem, "cep": "01001-000", "cidade": "São Paulo", "uf": "SP"}
    pid = client.post("/produtos", json=dados).json()["produto"]["id"]
    p = client.get(f"/produtos/{pid}").json()
    assert p["imagem"] == imagem and p["cep"] == "01001000" and p["uf"] == "SP"

    client.put(f"/produtos/{pid}", json={**dados, "imagem": None})  # remove a foto
    assert client.get(f"/produtos/{pid}").json()["imagem"] is None

    assert client.post("/produtos", json={**PRODUTO, "imagem": "texto"}).status_code == 422
    assert client.post("/produtos", json={**PRODUTO, "cep": "123"}).status_code == 422
