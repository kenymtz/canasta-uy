import { ArrowsClockwise, GoogleLogo, SignOut, Trash, UserCircle, WarningCircle } from "@phosphor-icons/react";
import { useState } from "react";

import { nube } from "../lib/nube";
import { useCompras } from "../store/compras";

const botonSecundario =
  "presionable inline-flex h-10 items-center gap-1.5 rounded-control border border-linea bg-ticket px-3 text-sm font-medium text-tinta hover:border-tinta-suave disabled:opacity-50";

const PRIVACIDAD = `${import.meta.env.BASE_URL}privacidad.html`;

function AvisoError({ mensaje }: { mensaje: string }) {
  return (
    <p className="flex gap-1.5 text-[13px] leading-snug text-alerta" role="alert">
      <WarningCircle size={16} className="mt-px shrink-0" aria-hidden />
      {mensaje}
    </p>
  );
}

/**
 * Cuenta opcional: sin sesión, explica que el historial queda en el teléfono y ofrece entrar
 * con Google; con sesión, permite salir o borrar la cuenta con todas sus compras.
 */
export function Cuenta() {
  const { usuario, sincronizando, errorNube } = useCompras();
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [confirmarBorrado, setConfirmarBorrado] = useState(false);

  async function hacer(accion: () => Promise<void>) {
    setError(null);
    setOcupado(true);
    try {
      await accion();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  if (!usuario) {
    return (
      <div className="flex flex-col gap-2.5">
        <p className="flex gap-2 text-[13px] leading-snug text-tinta-suave">
          <UserCircle size={18} className="mt-px shrink-0 text-acento" aria-hidden />
          <span>
            Sin cuenta, tus compras quedan guardadas solo en este teléfono. Si querés, iniciá sesión (no es obligatorio)
            para tener tu historial en cualquier dispositivo y no perderlo.
          </span>
        </p>
        <div>
          <button type="button" className={botonSecundario} disabled={ocupado} onClick={() => hacer(nube.entrarConGoogle)}>
            <GoogleLogo size={18} weight="bold" aria-hidden />
            Entrar con Google
          </button>
        </div>
        <p className="text-[12px] leading-snug text-tinta-suave">
          Al entrar aceptás la{" "}
          <a href={PRIVACIDAD} className="font-medium text-acento underline underline-offset-2">
            política de privacidad
          </a>
          . Las compras que ya guardaste en este teléfono se suman a tu cuenta.
        </p>
        {error && <AvisoError mensaje={error} />}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <p className="flex gap-2 text-[13px] leading-snug text-tinta-suave">
        <UserCircle size={18} weight="fill" className="mt-px shrink-0 text-acento" aria-hidden />
        <span>
          Sesión iniciada como <strong className="font-medium text-tinta">{usuario.email ?? usuario.nombre}</strong>. Tus
          compras se guardan en tu cuenta.
          {sincronizando && (
            <span className="ml-1 inline-flex items-center gap-1">
              <ArrowsClockwise size={14} className="animate-spin" aria-hidden />
              Sincronizando...
            </span>
          )}
        </span>
      </p>

      {confirmarBorrado ? (
        <div className="flex flex-col gap-2 rounded-control border border-alerta/50 px-3 py-2.5" role="alertdialog" aria-label="Borrar la cuenta">
          <p className="text-[13px] leading-snug">
            Se borran tu cuenta y todas las compras guardadas en ella. No se puede deshacer.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="presionable h-9 rounded-control bg-alerta px-3 text-[13px] font-semibold text-ticket disabled:opacity-50"
              disabled={ocupado}
              onClick={() => hacer(nube.borrarCuenta)}
            >
              Sí, borrar todo
            </button>
            <button type="button" className="presionable h-9 rounded-control px-3 text-[13px] font-medium" onClick={() => setConfirmarBorrado(false)}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" className={botonSecundario} disabled={ocupado} onClick={() => hacer(nube.salir)}>
            <SignOut size={18} aria-hidden />
            Cerrar sesión
          </button>
          <button
            type="button"
            className="presionable inline-flex h-10 items-center gap-1.5 rounded-control px-2 text-sm font-medium text-tinta-suave hover:text-alerta"
            onClick={() => setConfirmarBorrado(true)}
          >
            <Trash size={16} aria-hidden />
            Borrar mi cuenta
          </button>
        </div>
      )}
      <p className="text-[12px] leading-snug text-tinta-suave">
        Al cerrar sesión, tus compras se quitan de este teléfono y quedan en tu cuenta.{" "}
        <a href={PRIVACIDAD} className="font-medium text-acento underline underline-offset-2">
          Privacidad
        </a>
      </p>
      {(error ?? errorNube) && <AvisoError mensaje={(error ?? errorNube)!} />}
    </div>
  );
}
