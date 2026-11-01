"""Modelos de dados (validação das entradas e formato das respostas)."""
import re
from enum import Enum

from pydantic import BaseModel, Field, ValidationInfo, field_validator


class Status(str, Enum):
    DISPONIVEL = "Disponível"
    VENDIDO = "Vendido"


class ProdutoDados(BaseModel):
    """Campos que o cliente envia para cadastrar ou atualizar um produto."""

    nome: str = Field(..., min_length=2, max_length=100, examples=["Tênis Nike Air Max"])
    marca: str = Field(..., min_length=1, max_length=60, examples=["Nike"])
    categoria: str = Field(..., min_length=2, max_length=60, examples=["Calçados"])
    preco_custo: float = Field(..., ge=0, description="Quanto você pagou", examples=[200.0])
    preco_venda: float = Field(..., gt=0, description="Quanto você vai cobrar", examples=[320.0])
    quantidade: int = Field(..., ge=0, description="Unidades em estoque", examples=[5])
    status: Status = Field(..., examples=["Disponível"])
    imagem: str | None = Field(None, description="Foto do produto em data URL (data:image/...)")
    cep: str | None = Field(None, description="CEP de onde o produto sai", examples=["01001000"])
    logradouro: str | None = Field(None, max_length=120)
    bairro: str | None = Field(None, max_length=80)
    cidade: str | None = Field(None, max_length=80)
    uf: str | None = Field(None, min_length=2, max_length=2)

    @field_validator("nome", "marca", "categoria", mode="before")
    @classmethod
    def remover_espacos(cls, valor):
        return valor.strip() if isinstance(valor, str) else valor

    @field_validator("cep", mode="before")
    @classmethod
    def cep_somente_numeros(cls, valor):
        if valor in (None, ""):
            return None
        digitos = re.sub(r"\D", "", str(valor))
        if len(digitos) != 8:
            raise ValueError("CEP inválido. Use 8 números.")
        return digitos

    @field_validator("imagem")
    @classmethod
    def validar_imagem(cls, valor):
        if not valor:
            return None
        if not valor.startswith("data:image/") or len(valor) > 600_000:
            raise ValueError("Imagem inválida ou grande demais (máximo de uns 450 KB).")
        return valor

    @field_validator("status")
    @classmethod
    def status_coerente_com_estoque(cls, status: Status, info: ValidationInfo):
        if status == Status.DISPONIVEL and info.data.get("quantidade") == 0:
            raise ValueError("Um produto sem estoque deve ficar como Vendido.")
        return status


class Produto(ProdutoDados):
    """Produto já cadastrado (inclui o ID gerado pelo sistema)."""

    id: int


class Resposta(BaseModel):
    """Resposta das operações de escrita: mensagem de sucesso + produto afetado."""

    mensagem: str
    produto: Produto | None = None
