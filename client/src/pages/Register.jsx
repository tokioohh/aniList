import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router-dom";
import { registerSchema, registerDefaults } from "../schemas/auth.schema.js";
import { useRegister } from "../hooks/useAuthMutations.js";
import { FormField } from "../components/FormField.jsx";

export function Register() {
  const navigate = useNavigate();
  const register = useRegister();

  const {
    register: bind,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: registerDefaults,
  });

  const onSubmit = handleSubmit((values) => {
    register.mutate(
      { ...values },
      {
        onSuccess: () => navigate("/mi-lista", { replace: true }),
        onError: (error) => {
          // Los fieldErrors del servidor (incluido el 409 por correo o usuario
          // repetido) se mapean al campo exacto del formulario.
          if (error?.fieldErrors) {
            for (const [field, messages] of Object.entries(error.fieldErrors)) {
              setError(field, { type: "server", message: messages[0] });
            }
            return;
          }
          if (error?.status === 409) setError("email", { type: "server", message: error.message });
        },
      }
    );
  });

  return (
    <div className="max-w-md">
      <h1 className="text-2xl font-semibold leading-[1.15] tracking-[-0.02em]">Crear cuenta</h1>
      <p className="mt-3 text-sm text-muted">
        Tu cuenta guarda tu lista, tus calificaciones y tus reseñas.
      </p>

      <form onSubmit={onSubmit} noValidate className="surface mt-8 space-y-5 p-6">
        <FormField
          label="Nombre de usuario"
          autoComplete="username"
          placeholder="ana_23"
          hint="Entre 3 y 20 caracteres: letras, números o guion bajo."
          error={errors.username?.message}
          {...bind("username")}
        />
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
          autoComplete="new-password"
          hint="De 8 a 72 caracteres, con mayúscula, minúscula y número."
          error={errors.password?.message}
          {...bind("password")}
        />
        <FormField
          label="Repite la contraseña"
          type="password"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...bind("confirmPassword")}
        />

        {register.isError && !register.error?.fieldErrors ? (
          <p role="alert" className="text-sm text-danger">
            {register.error.message}
          </p>
        ) : null}

        <button type="submit" className="btn-primary w-full" disabled={register.isPending}>
          {register.isPending ? "Creando cuenta…" : "Crear cuenta"}
        </button>
      </form>

      <p className="mt-5 text-sm text-muted">
        ¿Ya tienes cuenta?{" "}
        <Link to="/login" className="font-medium text-accent hover:underline">
          Inicia sesión
        </Link>
      </p>
    </div>
  );
}
