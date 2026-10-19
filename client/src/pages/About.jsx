import tmdbLogo from "../assets/tmdb-logo.svg";

export function About() {
  return (
    <div className="max-w-2xl space-y-12">
      <section>
        <h1 className="text-2xl font-semibold leading-[1.15] tracking-[-0.02em]">
          Acerca de AniList
        </h1>
        <p className="measure mt-4 text-base text-muted">
          AniList es un tracker personal de anime, películas y series: registras lo que ves, marcas si
          te gustó, guardas favoritos, calificas de 1 a 10 y escribes tu reseña.
        </p>
        <p className="measure mt-3 text-base text-muted">
          Es un proyecto escolar de la materia <em>Seguridad, web services y APIs</em>. Todas las
          consultas a servicios externos pasan por el servidor: el navegador nunca recibe una
          credencial.
        </p>
      </section>

      <section className="surface space-y-4 p-6">
        <h2 className="text-xl font-semibold leading-[1.15] tracking-[-0.02em]">
          Fuentes de datos
        </h2>

        <div className="flex flex-wrap items-center gap-3">
          <img src={tmdbLogo} alt="TMDB" className="h-6 w-auto opacity-70" />
          <p className="text-sm text-muted">Películas y series vía TMDB.</p>
        </div>

        <p className="measure text-xs text-muted">
          This product uses the TMDB API but is not endorsed or certified by TMDB.
          <br />
          Este producto usa la API de TMDB pero no está avalado ni certificado por TMDB.
        </p>

        <p className="measure text-sm text-muted">
          Anime mediante una API de esquema compatible con <strong>Jikan</strong>, no oficial de{" "}
          <strong>MyAnimeList</strong>. La base es configurable, así que puede apuntar a otra
          instancia.
        </p>

        <p className="measure text-xs text-muted">
          Los logotipos son marcas registradas de sus respectivos dueños y se usan únicamente con
          fines de atribución.
        </p>
      </section>

      <section className="surface p-6">
        <h2 className="text-xl font-semibold leading-[1.15] tracking-[-0.02em]">
          Cómo está construida
        </h2>
        <ul className="mt-4 list-inside list-disc space-y-2 text-sm text-muted">
          <li>Node.js 24, Express 5 y PostgreSQL 16 con Prisma 6.</li>
          <li>React 19 con Vite y Tailwind CSS v4 en el frontend.</li>
          <li>Sesión con JWT dentro de una cookie httpOnly, nunca en localStorage.</li>
          <li>Caché de 10 minutos y cola de peticiones para respetar los límites de cada API.</li>
          <li>Docker Compose para levantar la app completa con un solo comando.</li>
        </ul>
      </section>
    </div>
  );
}
