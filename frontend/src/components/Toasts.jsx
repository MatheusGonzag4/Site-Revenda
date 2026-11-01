export default function Toasts({ avisos, onFechar }) {
  return (
    <div className="toasts" role="status" aria-live="polite">
      {avisos.map((a) => (
        <div key={a.id} className={`toast toast-${a.tipo}`}>
          <p>{a.texto}</p>
          <button type="button" onClick={() => onFechar(a.id)} aria-label="Fechar aviso">
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
