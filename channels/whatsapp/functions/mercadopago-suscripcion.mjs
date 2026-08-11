export default async () => {
  return Response.json(
    {
      ok: false,
      retirado: true,
      mensaje:
        "Este endpoint directo fue retirado. La suscripción se inicia escribiendo 'Cartes Plus' por WhatsApp."
    },
    { status: 410 }
  );
};
