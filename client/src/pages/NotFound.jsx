import { Link } from "react-router-dom";

export function NotFound() {
  return (
    <div className="max-w-md space-y-4 py-16">
      <h1 className="text-4xl font-semibold leading-[1.15] tracking-[-0.02em]">
        Esta página no existe
      </h1>
      <p className="text-sm text-muted">
        Puede que el enlace esté mal escrito o que el título ya no esté disponible.
      </p>
      <Link to="/" className="btn-primary mt-2 inline-flex">
        Volver al inicio
      </Link>
    </div>
  );
}
