import { z } from "zod";

// Los mensajes por defecto de Zod vienen en inglés: se fuerzan en español para
// que fieldErrors sea lo que ve la persona en el formulario.
z.config(z.locales.es());

const { ZodError } = z;

/**
 * Valida body, query y params con Zod y reemplaza los valores por los ya parseados
 * (los defaults del esquema se aplican: p. ej. page=1, type=ALL).
 * Todo esquema de entrada usa .strict(): un campo desconocido es un 400, no se ignora.
 */
export function validate(schemas) {
  return (req, res, next) => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body ?? {});
      if (schemas.params) req.params = schemas.params.parse(req.params ?? {});
      if (schemas.query) {
        const parsedQuery = schemas.query.parse(req.query ?? {});
        // En Express 5 req.query es un getter de solo lectura: se redefine por instancia.
        Object.defineProperty(req, "query", {
          value: parsedQuery,
          writable: true,
          configurable: true,
          enumerable: true,
        });
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) return next(error);
      next(error);
    }
  };
}