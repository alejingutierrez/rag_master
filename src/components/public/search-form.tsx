import "@/components/public/search-form.css";

/**
 * Campo de búsqueda pública. Es un formulario GET nativo hacia /buscar: sin
 * JavaScript, sin estado, y cada consulta queda en la URL (`/buscar?q=…`), así
 * que se puede compartir y el navegador la recuerda. Lo usan la página de
 * búsqueda y la cabecera del archivo.
 */
export function SearchForm({
  defaultValue = "",
  placeholder = "Buscar en el archivo…",
  submitLabel = "Buscar",
  id = "buscador",
  label = "Buscar en el archivo",
  hint,
}: {
  defaultValue?: string;
  placeholder?: string;
  submitLabel?: string;
  id?: string;
  label?: string;
  /** Nota breve bajo el campo (qué se busca). */
  hint?: string;
}) {
  return (
    <form className="sf" action="/buscar" method="get" role="search">
      <label className="sf-label" htmlFor={id}>
        {label}
      </label>
      <div className="sf-row">
        <span className="sf-icon" aria-hidden>
          ⌕
        </span>
        <input
          id={id}
          className="sf-input"
          type="search"
          name="q"
          defaultValue={defaultValue}
          placeholder={placeholder}
          autoComplete="off"
          maxLength={120}
        />
        <button type="submit" className="sf-submit">
          {submitLabel}
        </button>
      </div>
      {hint && <p className="sf-hint">{hint}</p>}
    </form>
  );
}
