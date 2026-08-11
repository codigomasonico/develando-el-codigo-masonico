export default async () => {
  return Response.json({
    servicio: "Cartes para WhatsApp",
    estado: "funcionando",
    fecha: new Date().toISOString()
  });
};
