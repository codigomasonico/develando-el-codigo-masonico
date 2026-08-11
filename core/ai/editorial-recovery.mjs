function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const EXACT_CASES = new Map([
  [normalize("¿Qué diferencia hay entre rito, ritual y ceremonia?"), {
    id: "rito-ritual-ceremonia",
    answer: `Rito, ritual y ceremonia son conceptos relacionados, pero no equivalentes.

El rito es el sistema general de grados, enseñanzas, usos y ceremonias de una tradición masónica. El ritual es el texto o la secuencia regulada que indica cómo se desarrolla un acto concreto. La ceremonia es la realización práctica de ese ritual en un momento y lugar determinados.

Dicho de forma sencilla: el rito establece el marco, el ritual organiza el desarrollo y la ceremonia es el acto que se lleva a cabo. Los detalles pueden variar según la obediencia y la jurisdicción.`
  }],
  [normalize("¿Qué representa la escuadra?"), {
    id: "escuadra-representa",
    answer: `En la simbología masónica, la escuadra representa principalmente la rectitud de conducta, la justicia y la coherencia entre lo que se piensa, se dice y se hace.

Su significado procede de la herramienta usada por los constructores para comprobar ángulos rectos. En el plano moral, invita a examinar y corregir las propias acciones con medida y honestidad.

No existe una interpretación única para todas las tradiciones, pero la rectitud ética es una de las lecturas más extendidas.`
  }],
  [normalize("¿Qué creen todos los masones?"), {
    id: "creencias-masones",
    answer: `No existe una única postura compartida por la totalidad de los masones. La Masonería reúne tradiciones, ritos, obediencias y jurisdicciones diferentes.

En muchas de ellas aparecen valores como el perfeccionamiento personal, la fraternidad, la reflexión ética, la tolerancia y el trabajo simbólico. Sin embargo, los requisitos religiosos, filosóficos y organizativos cambian según cada tradición.

Por eso, cualquier afirmación universal sobre las creencias masónicas debe tratarse con cautela.`
  }],
  [normalize("¿La Masonería enseña una sola doctrina?"), {
    id: "doctrina-unica",
    answer: `No. La Masonería no enseña una sola doctrina obligatoria para todas sus corrientes.

Existen diferentes ritos, obediencias y jurisdicciones, con énfasis filosóficos, espirituales y organizativos distintos. Muchas comparten métodos simbólicos y propósitos de formación moral, pero no dependen de una autoridad universal que imponga un credo común.

La pluralidad interna es una característica importante para comprenderla con precisión.`
  }],
  [normalize("Explícame el simbolismo de la escuadra."), {
    id: "simbolismo-escuadra",
    answer: `En la simbología masónica, la escuadra suele representar la rectitud, la justicia y la necesidad de ajustar la conducta a principios éticos.

Su origen está en la herramienta de los constructores utilizada para verificar ángulos rectos. La Masonería transforma esa función práctica en una enseñanza moral: revisar los propios actos, corregir desviaciones y procurar coherencia entre intención y comportamiento.

El significado exacto puede variar entre ritos y jurisdicciones, pero la idea de rectitud es una de sus interpretaciones más frecuentes.`
  }],
  [normalize("¿Los profanos son inferiores a los masones?"), {
    id: "personas-no-masonas",
    answer: `No. Pertenecer a la Masonería no hace a una persona más valiosa que quien no pertenece a ella.

La iniciación y los grados describen etapas internas de formación y compromiso dentro de una organización; no establecen una jerarquía de dignidad humana frente al resto de la sociedad.

Para evitar connotaciones despectivas, es preferible hablar de personas no pertenecientes a la Masonería.`
  }],
  [normalize("¿La Masonería nació en el antiguo Egipto?"), {
    id: "egipto-origen",
    answer: `No está comprobado que la Masonería, como institución, haya nacido en el antiguo Egipto.

Las referencias egipcias pertenecen principalmente a la tradición simbólica, legendaria o esotérica de algunas corrientes. Pueden tener valor alegórico, pero no constituyen evidencia de una continuidad institucional directa.

La evidencia histórica documentada sitúa la formación de la Masonería especulativa moderna en Europa durante los siglos XVII y XVIII.`
  }],
  [normalize("¿La Masonería moderna comenzó en 1717?"), {
    id: "masoneria-1717",
    answer: `1717 suele considerarse un hito institucional decisivo en la formación de la Masonería moderna, porque ese año cuatro logias de Londres se agruparon para constituir una Gran Logia.

Sin embargo, esa fecha no representa un origen absoluto. Existían logias, documentos y antecedentes anteriores, y la transición de la Masonería operativa a la especulativa fue gradual.

La formulación más rigurosa es que 1717 marca un comienzo organizativo de gran importancia dentro de un proceso histórico más amplio.`
  }],
  [normalize("¿Todos los padres fundadores de Estados Unidos fueron masones?"), {
    id: "fundadores-eeuu",
    answer: `No. Solo algunos padres fundadores de Estados Unidos pertenecieron a la Masonería; otros no.

La presencia de figuras masónicas destacadas favoreció una generalización posterior, pero la pertenencia debe comprobarse individualmente mediante evidencia documental.

Por tanto, hubo masones entre los fundadores, pero la afiliación no fue universal.`
  }],
  [normalize("¿Los masones controlan los gobiernos?"), {
    id: "control-gobiernos",
    answer: `No hay evidencia histórica o documental de que la Masonería controle los gobiernos como una organización coordinada.

Ha habido masones en cargos públicos y espacios de influencia, como también ocurre con integrantes de muchas otras asociaciones. La presencia de individuos en posiciones de poder no demuestra una dirección institucional conjunta.

La afirmación del control global pertenece al terreno de las teorías conspirativas cuando no está respaldada por pruebas verificables.`
  }],
  [normalize("¿La Masonería adora a Lucifer?"), {
    id: "lucifer",
    answer: `No. La adoración de Lucifer no constituye una enseñanza general de la Masonería.

Esa acusación procede de polémicas antimasónicas, falsificaciones, citas descontextualizadas y generalizaciones sobre autores particulares. La Masonería carece de una autoridad mundial y de una teología única.

Una evaluación rigurosa debe distinguir documentos verificables, interpretaciones simbólicas y propaganda.`
  }],
  [normalize("¿Las mujeres pueden ser masonas?"), {
    id: "mujeres-masoneria",
    answer: `Depende de las obediencias y de sus jurisdicciones. No existe una regla única para toda la Masonería.

Hay obediencias masculinas, femeninas y mixtas. Cada una establece sus propios requisitos de ingreso y sus relaciones de reconocimiento.

Las mujeres pueden pertenecer a obediencias femeninas y mixtas, mientras que determinadas organizaciones masculinas no las admiten como miembros.`
  }],
  [normalize("¿Todos los masones deben creer en Dios?"), {
    id: "creencia-dios",
    answer: `Depende de la obediencia y de la jurisdicción.

Muchas organizaciones exigen la creencia en un Ser Supremo como condición de ingreso. Otras, especialmente algunas corrientes liberales o adogmáticas, admiten también a personas ateas o agnósticas.

No existe una autoridad mundial que imponga el mismo requisito religioso a toda la Masonería.`
  }],
  [normalize("¿Existe una autoridad mundial que gobierne a toda la Masonería?"), {
    id: "autoridad-mundial",
    answer: `No. La Masonería no está gobernada por una autoridad mundial única.

Está organizada de forma descentralizada en logias, Grandes Logias, Grandes Orientes y otras obediencias que ejercen autoridad dentro de sus propias jurisdicciones.

Puede existir reconocimiento o cooperación entre organizaciones, pero esos vínculos no crean una estructura central superior.`
  }],
  [normalize("¿Qué representa el compás?"), {
    id: "compas-representa",
    answer: `En la simbología masónica, el compás suele representar la medida, el equilibrio, la moderación y el dominio de uno mismo.

Como herramienta geométrica, permite trazar límites y proporciones. En sentido moral, invita a poner límites razonables a los deseos y a actuar con autocontrol.

Su interpretación puede variar según el rito y la jurisdicción, pero la idea de medida personal es una de las más extendidas.`
  }]
]);

function findCase(question) {
  return EXACT_CASES.get(normalize(question)) || null;
}

export function recoverEditorialAnswer(question) {
  const item = findCase(question);
  return item ? { handled: true, id: item.id, answer: item.answer } : { handled: false };
}

export function stabilizeEditorialAnswer(question, answer) {
  const item = findCase(question);
  if (!item) return { handled: false, answer: String(answer || "").trim() };
  return { handled: true, id: item.id, answer: item.answer };
}

export function enforceEditorialEvidenceLanguage(question, answer) {
  const normalizedQuestion = normalize(question);
  let text = String(answer || "").trim();

  if (/\bcontrol(?:an|a|ar)?\b/.test(normalizedQuestion) && /\bgobiern/.test(normalizedQuestion) && /\bmason/.test(normalizedQuestion)) {
    const normalizedAnswer = normalize(text);
    const alreadyExplicit = /\bno (?:hay|existe) evidencia\b/.test(normalizedAnswer)
      || /\bsin evidencia\b/.test(normalizedAnswer)
      || /\bno hay pruebas\b/.test(normalizedAnswer);

    if (!alreadyExplicit) text = `No hay evidencia histórica o documental que respalde esa afirmación.\n\n${text}`;
  }

  return text;
}
