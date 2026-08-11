export function tieneAccesoCartesPlus(registroSuscripcion, fecha = new Date()) {
  const estado = String(registroSuscripcion?.status || "").toLowerCase();

  if (estado === "authorized") return true;
  if (!registroSuscripcion?.renovacion_cancelada) return false;

  const accesoHasta = Date.parse(
    String(registroSuscripcion?.access_until || registroSuscripcion?.fecha_fin || "")
  );

  return Number.isFinite(accesoHasta) && accesoHasta > fecha.getTime();
}
