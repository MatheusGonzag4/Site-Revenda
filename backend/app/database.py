"""Conexão com o Redis. Os dados de acesso vêm de variáveis de ambiente."""
import os

import redis

_cliente: redis.Redis | None = None


def get_redis() -> redis.Redis:
    """Retorna (e cria, na primeira chamada) o cliente Redis compartilhado."""
    global _cliente
    if _cliente is None:
        _cliente = redis.Redis(
            host=os.getenv("REDIS_HOST", "localhost"),
            port=int(os.getenv("REDIS_PORT", "6379")),
            db=int(os.getenv("REDIS_DB", "0")),
            password=os.getenv("REDIS_PASSWORD") or None,
            decode_responses=True,  # devolve str em vez de bytes
        )
    return _cliente
