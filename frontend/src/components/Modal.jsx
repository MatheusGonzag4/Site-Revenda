import { useEffect, useId, useRef } from "react";

// Usa o <dialog> nativo: já traz foco preso, tecla Esc e fundo escurecido.
export default function Modal({ aberto, onFechar, titulo, children }) {
  const ref = useRef(null);
  const tituloId = useId();

  useEffect(() => {
    const dialogo = ref.current;
    if (!dialogo) return;
    if (aberto && !dialogo.open) dialogo.showModal();
    if (!aberto && dialogo.open) dialogo.close();
  }, [aberto]);

  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby={tituloId}
      onClose={onFechar}
      onClick={(e) => {
        if (e.target === ref.current) onFechar(); // clique no fundo escurecido
      }}
    >
      {aberto && (
        <div className="modal-corpo">
          <header className="modal-topo">
            <h2 id={tituloId}>{titulo}</h2>
            <button type="button" className="fechar" onClick={onFechar} aria-label="Fechar">
              ×
            </button>
          </header>
          {children}
        </div>
      )}
    </dialog>
  );
}
