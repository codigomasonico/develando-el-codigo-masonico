function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

import { normalizeLocale } from "./i18n.mjs";

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

const EXACT_CASES_EN = new Map([
  [normalize("What is the difference between a rite, a ritual, and a ceremony?"), {
    id: "rite-ritual-ceremony-en",
    answer: `Rite, ritual, and ceremony are related concepts, but they are not interchangeable.

A rite is the broader system of degrees, teachings, customs, and ceremonies within a Masonic tradition. A ritual is the prescribed text or sequence governing a particular act. A ceremony is the actual performance of that ritual at a particular time and place.

In simple terms, the rite establishes the framework, the ritual organizes the proceedings, and the ceremony is the act being performed. Details vary among Masonic bodies and jurisdictions.`
  }],
  [normalize("What does the square represent?"), {
    id: "square-meaning-en",
    answer: `In Masonic symbolism, the square commonly represents moral rectitude, justice, and consistency between thought, word, and action.

Its meaning comes from the builder's tool used to test right angles. Morally, it suggests measuring and correcting one's conduct with honesty and sound judgment.

No interpretation is universal across every Masonic tradition, but ethical uprightness is among the square's most widespread meanings.`
  }],
  [normalize("What do all Freemasons believe?"), {
    id: "masonic-beliefs-en",
    answer: `There is no single position shared by every Freemason. Freemasonry includes different rites, Masonic bodies, and jurisdictions.

Many emphasize personal improvement, fraternity, ethical reflection, tolerance, and symbolic work. Religious requirements, philosophical emphases, and organizational practices nevertheless vary.

Any universal claim about what all Freemasons believe should therefore be treated with caution.`
  }],
  [normalize("Does Freemasonry teach one doctrine?"), {
    id: "single-doctrine-en",
    answer: `No. Freemasonry does not impose one doctrine on all of its traditions.

Different rites, Masonic bodies, and jurisdictions have distinct philosophical, spiritual, and organizational emphases. Many share symbolic methods and goals of moral formation, but there is no universal authority imposing one creed on every Freemason.

Its internal plurality is essential to understanding Freemasonry accurately.`
  }],
  [normalize("Explain the symbolism of the square."), {
    id: "square-symbolism-en",
    answer: `In Masonic symbolism, the square commonly represents rectitude, justice, and the effort to align conduct with ethical principles.

It originates in the builder's tool used to test right angles. Freemasonry turns that practical function into a moral image: measuring one's actions, correcting deviations, and seeking consistency between intention and conduct.

Its precise meaning may vary by rite and jurisdiction, but rectitude remains one of its most widespread interpretations.`
  }],
  [normalize("Are non-Masons inferior to Freemasons?"), {
    id: "non-masons-en",
    answer: `No. Membership in Freemasonry does not make a person more valuable than someone who is not a Freemason.

Initiation and degrees describe internal stages of formation and commitment within an organization. They do not establish a hierarchy of human dignity over the rest of society.

In English, "people who are not Freemasons" or "the general public" is normally clearer and less exclusionary than internal labels.`
  }],
  [normalize("Did Freemasonry begin in ancient Egypt?"), {
    id: "egypt-origin-en",
    answer: `There is no evidence that Freemasonry, as an institution, began in ancient Egypt.

Egyptian references belong mainly to the symbolic, legendary, or esoteric traditions of some currents. They may have allegorical value, but they do not establish direct institutional continuity.

Documentary evidence places the formation of modern speculative Freemasonry in Europe during the seventeenth and eighteenth centuries.`
  }],
  [normalize("Did modern Freemasonry begin in 1717?"), {
    id: "freemasonry-1717-en",
    answer: `The year 1717 is commonly treated as an important institutional milestone in modern Freemasonry because four London lodges are traditionally said to have formed a Grand Lodge that year.

It was not an absolute beginning. Lodges, documents, and earlier developments already existed, and the transition from operative to speculative Masonry was gradual.

The most careful formulation is that 1717 marks an influential organizational stage within a longer historical process.`
  }],
  [normalize("Were all the Founding Fathers of the United States Freemasons?"), {
    id: "us-founders-en",
    answer: `No. Some Founding Fathers of the United States were Freemasons, but many were not.

The prominence of several Masonic figures encouraged later generalizations, yet membership must be established individually through documentary evidence.

Freemasons were present among the founders, but Masonic affiliation was not universal.`
  }],
  [normalize("Do Freemasons control governments?"), {
    id: "government-control-en",
    answer: `There is no historical or documentary evidence that Freemasonry controls governments as a coordinated organization.

Individual Freemasons have held public office and positions of influence, as members of many other associations have. The presence of individuals in power does not demonstrate unified institutional direction.

Claims of global control belong to conspiracy theory when they are not supported by verifiable evidence.`
  }],
  [normalize("Does Freemasonry worship Lucifer?"), {
    id: "lucifer-en",
    answer: `No. Worship of Lucifer is not a general teaching of Freemasonry.

The accusation stems largely from anti-Masonic polemics, forgeries, quotations taken out of context, and generalizations based on particular authors. Freemasonry has no worldwide authority or single theology.

A rigorous assessment must distinguish verifiable documents, symbolic interpretations, and propaganda.`
  }],
  [normalize("Can women be Freemasons?"), {
    id: "women-en",
    answer: `It depends on the Masonic body and jurisdiction. There is no single rule throughout Freemasonry.

There are male-only, female-only, and mixed-gender Masonic bodies. Each establishes its own admission requirements and relationships of recognition.

Women may belong to female and mixed-gender organizations, while certain male-only Grand Lodges do not admit them as members.`
  }],
  [normalize("Must all Freemasons believe in God?"), {
    id: "belief-in-god-en",
    answer: `It depends on the Masonic body and jurisdiction.

Many organizations require belief in a Supreme Being as a condition of membership. Others, particularly some liberal or adogmatic traditions, also admit atheists or agnostics.

There is no worldwide authority imposing the same religious requirement on all of Freemasonry.`
  }],
  [normalize("Is there a world authority governing all Freemasonry?"), {
    id: "world-authority-en",
    answer: `No. Freemasonry is not governed by one worldwide authority.

It is decentralized among lodges, Grand Lodges, Grand Orients, and other Masonic bodies that exercise authority within their own jurisdictions.

Recognition and cooperation may exist among organizations, but those relationships do not create one central governing structure.`
  }],
  [normalize("What do the compasses represent?"), {
    id: "compasses-meaning-en",
    answer: `In Masonic symbolism, the compasses commonly represent measure, balance, moderation, and self-control.

As a geometric instrument, they draw limits and proportions. Morally, they suggest setting reasonable bounds on one's desires and acting with restraint.

Interpretations vary among rites and jurisdictions, but personal measure is one of the most widespread readings.`
  }]
]);

function findCase(question, locale = "es") {
  const cases = normalizeLocale(locale) === "en" ? EXACT_CASES_EN : EXACT_CASES;
  return cases.get(normalize(question)) || null;
}

export function recoverEditorialAnswer(question, locale = "es") {
  const item = findCase(question, locale);
  return item ? { handled: true, id: item.id, answer: item.answer } : { handled: false };
}

export function stabilizeEditorialAnswer(question, answer, locale = "es") {
  const item = findCase(question, locale);
  if (!item) return { handled: false, answer: String(answer || "").trim() };
  return { handled: true, id: item.id, answer: item.answer };
}

export function enforceEditorialEvidenceLanguage(question, answer, locale = "es") {
  const normalizedQuestion = normalize(question);
  let text = String(answer || "").trim();

  if (/\bcontrol(?:an|a|ar)?\b/.test(normalizedQuestion) && /\bgobiern/.test(normalizedQuestion) && /\bmason/.test(normalizedQuestion)) {
    const normalizedAnswer = normalize(text);
    const alreadyExplicit = /\bno (?:hay|existe) evidencia\b/.test(normalizedAnswer)
      || /\bsin evidencia\b/.test(normalizedAnswer)
      || /\bno hay pruebas\b/.test(normalizedAnswer);

    if (!alreadyExplicit) {
      text = normalizeLocale(locale) === "en"
        ? `There is no historical or documentary evidence supporting that claim.\n\n${text}`
        : `No hay evidencia histórica o documental que respalde esa afirmación.\n\n${text}`;
    }
  }

  return text;
}
