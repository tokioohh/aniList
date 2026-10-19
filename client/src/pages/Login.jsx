import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { loginSchema, loginDefaults } from "../schemas/auth.schema.js";
import { useLogin } from "../hooks/useAuthMutations.js";
import { FormField } from "../components/FormField.jsx";

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useLogin();

  // Si ProtectedRoute mandó a /login, volvemos a donde el usuario quería ir.
  const from = location.state?.from ?? "/mi-lista";

  const {
    register: bind,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: loginDefaults,
  });

  const onSubmit = handleSubmit((values) => {
    login.mutate(values, { onSuccess: () => navigate(from, { replace: true }) });
  });

  return (
    <div className="max-w-md">
      <h1 className="text-2xl font-semibold leading-[1.15] tracking-[-0.02em]">
        Iniciar sesión
      </h1>
      <p className="mt-3 text-sm text-muted">Entra para ver tu lista y tus estadísticas.</p>

      <form onSubmit={onSubmit} noValidate className="surface mt-8 space-y-5 p-6">
        <FormField
          label="Correo electrónico"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="ana@correo.com"
          error={errors.email?.message}
          {...bind("email")}
        />
        <FormField
          label="Contraseña"
          type="password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...bind("password")}
        />

        {login.isError ? (
          <p role="alert" className="text-sm text-danger">
            {/* Mensaje genérico: el servidor nunca revela si el correo existe */}
            {login.error.message}
          </p>
        ) : null}

        <button type="submit" className="btn-primary w-full" disabled={login.isPending}>
          {login.isPending ? "Entrando…" : "Entrar"}
        </button>
      </form>

      <p className="mt-5 text-sm text-muted">
        ¿Todavía no tienes cuenta?{" "}
        <Link to="/registro" className="font-medium text-accent hover:underline">
          Crea una
        </Link>
      </p>
    </div>
  );
}
